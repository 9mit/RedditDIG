// LocalAskThreadEngine: Grounded in-memory discussion question-answering engine.
// Fulfills Directive Section 35: Offline retrieval & synthesis with citations and honest boundaries.

import { CommentSchema, AskResponse } from '../../types';
import { defaultEmbeddingProvider } from '../search/embedding';
import { sanitizeDiscussionText, cleanSnippet, extractCleanSentences } from './sanitizer';

export class LocalAskThreadEngine {
  /**
   * Evaluates a user query against the thread comments and synthesizes a grounded answer.
   */
  static answerQuestion(
    question: string,
    comments: CommentSchema[]
  ): AskResponse {
    const cleanQ = sanitizeDiscussionText(question || '');
    if (!cleanQ) {
      return {
        answer: 'Please enter a question to analyze this thread.',
        confidence: 0,
        has_sufficient_info: false,
        cited_comments: [],
        is_ai_generated: false,
        ai_error: null
      };
    }

    const validComments = comments.filter(
      c => c.body && c.body.length > 15 && c.author !== '[deleted]' && c.author !== '[removed]'
    );

    if (validComments.length === 0) {
      return {
        answer: 'No substantive comments are loaded in the current page to answer this question.',
        confidence: 0,
        has_sufficient_info: false,
        cited_comments: [],
        is_ai_generated: false,
        ai_error: null
      };
    }

    // 1. Question Intent Extraction
    const isRecommendation = /\b(recommend|buy|worth|suggest|get|choose|pick|alternative)\b/i.test(cleanQ);
    const isComplaint = /\b(complaint|issue|problem|bad|worst|flaw|hate|bug|failure)\b/i.test(cleanQ);
    const isDisagreement = /\b(disagree|conflict|argue|debate|split|divide|controversy)\b/i.test(cleanQ);

    // 2. Token Matching & Vector Scoring
    const stopWords = new Set(
      'the a an and or but if then than this that is are was were to of in for on with from by as it be been what who how why which when where does do did can could would should will just for best'.split(' ')
    );
    const queryTokens = cleanQ.toLowerCase().match(/[a-z0-9]+/g)?.filter(t => !stopWords.has(t) && t.length > 2) || [];
    const queryVec = defaultEmbeddingProvider.generateEmbedding(cleanQ);

    interface ScoredCandidate {
      comment: CommentSchema;
      relevanceScore: number;
    }

    const scoredCandidates: ScoredCandidate[] = [];

    for (const c of validComments) {
      const text = c.body.toLowerCase();
      let matchCount = 0;
      for (const qt of queryTokens) {
        if (text.includes(qt)) matchCount++;
      }
      const tokenScore = queryTokens.length > 0 ? matchCount / queryTokens.length : 0;

      const commentVec = defaultEmbeddingProvider.generateEmbedding(c.body);
      const simScore = Math.max(defaultEmbeddingProvider.cosineSimilarity(queryVec, commentVec), 0);

      // Require at least one token match or high semantic similarity if specific query terms are present
      if (queryTokens.length > 0 && matchCount === 0 && simScore < 0.55) {
        continue;
      }

      // Evidence & Upvote weighting
      const evBonus = c.evidence_type === 'evidence_backed' ? 0.3 : c.evidence_type === 'personal_experience' ? 0.2 : 0;
      const scoreBonus = Math.min(Math.log1p(Math.max(c.score, 0)) / 10, 0.25);

      // Intent alignment bonus
      let intentBonus = 0;
      if (isRecommendation && c.comment_type === 'recommendation') intentBonus = 0.25;
      if (isComplaint && c.stance === 'against') intentBonus = 0.25;
      if (isDisagreement && c.comment_type === 'counterargument') intentBonus = 0.25;

      const relevanceScore = (tokenScore * 0.5) + (simScore * 0.3) + scoreBonus + evBonus + intentBonus;

      if (tokenScore > 0 || simScore >= 0.55) {
        scoredCandidates.push({ comment: c, relevanceScore });
      }
    }

    scoredCandidates.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const topCandidates = scoredCandidates.slice(0, 5).map(sc => sc.comment);

    if (topCandidates.length === 0 || (queryTokens.length > 0 && scoredCandidates[0].relevanceScore < 0.3)) {
      return {
        answer: `Based on this thread:\nThe loaded comments do not contain direct discussion answering "${cleanQ}".\n\nWhat the thread does not establish:\nNo participants provided specific evidence, claims, or benchmarks directly resolving this query.`,
        confidence: 0.15,
        has_sufficient_info: false,
        cited_comments: validComments.slice(0, 2),
        is_ai_generated: false,
        ai_error: null
      };
    }

    // 3. Synthesize Grounded Response
    const dissenting = topCandidates.filter(c => c.stance === 'against');
    const primaryComment = topCandidates[0];

    // Extract best representative snippet
    const primarySentences = extractCleanSentences(primaryComment.body, 20, 250);
    const primarySnippet = primarySentences[0] || cleanSnippet(primaryComment.body, 180);

    const keyReasons: string[] = [];
    for (const c of topCandidates.slice(0, 3)) {
      const sentences = extractCleanSentences(c.body, 20, 180);
      const rep = sentences[0] || cleanSnippet(c.body, 140);
      if (rep) {
        keyReasons.push(`• u/${c.author} (+${c.score}): "${rep}"`);
      }
    }

    const counterpoints: string[] = [];
    for (const c of dissenting.slice(0, 2)) {
      const sentences = extractCleanSentences(c.body, 20, 180);
      const rep = sentences[0] || cleanSnippet(c.body, 140);
      if (rep && !keyReasons.some(k => k.includes(rep))) {
        counterpoints.push(`• u/${c.author} (+${c.score}): "${rep}"`);
      }
    }

    let mainAnswer = `Based on this thread, participants emphasize that ${primarySnippet.replace(/^["']|["']$/g, '')}.`;
    if (isRecommendation) {
      mainAnswer = `Based on this thread, the community's primary recommendation leans toward: "${primarySnippet}"`;
    } else if (isComplaint) {
      mainAnswer = `Based on this thread, the most prominent concern raised is: "${primarySnippet}"`;
    } else if (isDisagreement) {
      mainAnswer = `Based on this thread, participants are divided: some support this view while others point out key drawbacks.`;
    }

    const answerLines: string[] = [
      mainAnswer,
      '',
      'Key observed points from thread:'
    ];

    for (const kr of keyReasons) {
      answerLines.push(kr);
    }

    if (counterpoints.length > 0) {
      answerLines.push('');
      answerLines.push('Counterpoints & Considerations:');
      for (const cp of counterpoints) {
        answerLines.push(cp);
      }
    }

    answerLines.push('');
    answerLines.push('What the thread does not establish:');
    answerLines.push(
      `This analysis is derived strictly from ${topCandidates.length} relevant comments in this post. Broader community consensus across Reddit or official vendor confirmation was not established here.`
    );

    const confidenceScore = Math.min(0.6 + (topCandidates.length * 0.08), 0.95);

    return {
      answer: answerLines.join('\n'),
      confidence: confidenceScore,
      has_sufficient_info: true,
      cited_comments: topCandidates,
      is_ai_generated: false,
      ai_error: null
    };
  }
}
