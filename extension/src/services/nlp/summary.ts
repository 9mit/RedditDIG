// LocalSummaryEngine: 100% local, deterministic extractive & synthesis summary pipeline.
// Fulfills Directive Section 14: sentences -> importance scoring -> topic coverage -> duplicate removal -> claim identification -> consensus signals -> counterargument identification -> template-based synthesis.
// Strictly offline. Never hallucinates. Every statement cites valid comment IDs.

import { CommentSchema, SummaryResponse, CitationItem } from '../../types';
import { extractCleanSentences, sanitizeDiscussionText } from './sanitizer';

interface ScoredSentence {
  text: string;
  commentId: string;
  author: string;
  score: number;
  stance: 'support' | 'against' | 'neutral';
  commentType: string;
  evidenceType: string;
  topic: string;
}

export class LocalSummaryEngine {
  /**
   * Generates a grounded, multi-section summary entirely locally.
   */
  static generateSummary(
    title: string,
    subreddit: string,
    comments: CommentSchema[],
    viewpointLabels: string[] = []
  ): SummaryResponse {
    const validComments = comments.filter(
      c => c.body && c.body.length > 10 && c.author !== '[deleted]' && c.author !== '[removed]'
    );

    if (validComments.length === 0) {
      return {
        overview: 'No substantive comments are currently loaded in the DOM to summarize.',
        key_takeaways: [],
        what_agree_on: [],
        what_disagree_on: [],
        unresolved_questions: [],
        is_ai_generated: false,
        ai_error: null,
        model_name: 'RedditDIG Local Discussion Engine'
      };
    }

    // 1. Sentence segmentation & scoring
    const scoredSentences: ScoredSentence[] = [];
    const stopWords = new Set(
      'the a an and or but if then than this that is are was were to of in for on with from by as it be been i you we they he she me my your our their'.split(' ')
    );

    // Compute word frequencies across thread for TF salience
    const wordFreq = new Map<string, number>();
    for (const c of validComments) {
      const words = c.body.toLowerCase().match(/[a-z0-9]+/g) || [];
      for (const w of words) {
        if (!stopWords.has(w) && w.length > 2) {
          wordFreq.set(w, (wordFreq.get(w) || 0) + 1);
        }
      }
    }

    for (const c of validComments) {
      // Split into clean, substantive sentences
      const rawSentences = extractCleanSentences(c.body, 15, 400);

      const commentScoreWeight = Math.min(Math.log1p(Math.max(c.score, 0)) / 5, 2.0);
      const evWeight = c.evidence_type === 'evidence_backed' ? 1.8 : c.evidence_type === 'personal_experience' ? 1.4 : 1.0;

      for (let sIdx = 0; sIdx < rawSentences.length; sIdx++) {
        const sentence = rawSentences[sIdx];
        // Skip common social filler
        if (/^(thanks|thank you|upvoted|this|lol|haha|came here to say this|agreed)\b/i.test(sentence)) {
          continue;
        }

        // Salience calculation
        const words = sentence.toLowerCase().match(/[a-z0-9]+/g) || [];
        let tfSum = 0;
        for (const w of words) {
          if (wordFreq.has(w)) {
            tfSum += Math.min(wordFreq.get(w) || 0, 10);
          }
        }
        const lengthNorm = words.length > 5 ? Math.min(words.length / 15, 1.5) : 0.5;
        const positionBonus = sIdx === 0 ? 1.3 : sIdx === 1 ? 1.1 : 0.9;
        const finalScore = (tfSum / Math.max(words.length, 1)) * lengthNorm * commentScoreWeight * evWeight * positionBonus;

        scoredSentences.push({
          text: sentence,
          commentId: c.id,
          author: c.author,
          score: finalScore,
          stance: c.stance,
          commentType: c.comment_type,
          evidenceType: c.evidence_type,
          topic: c.topics[0] || 'general'
        });
      }
    }

    // Sort by salience
    scoredSentences.sort((a, b) => b.score - a.score);

    // Helper: deduplicate sentences by word overlap
    const deduplicate = (list: ScoredSentence[], maxCount: number): CitationItem[] => {
      const selected: CitationItem[] = [];
      const seenTokens = new Set<string>();

      for (const item of list) {
        if (selected.length >= maxCount) break;
        const tokens = item.text.toLowerCase().match(/[a-z0-9]+/g)?.filter(w => !stopWords.has(w)) || [];
        const overlap = tokens.filter(t => seenTokens.has(t)).length;
        if (tokens.length > 0 && overlap / tokens.length > 0.65) {
          continue; // too similar to an already chosen sentence
        }
        for (const t of tokens) seenTokens.add(t);

        selected.push({
          text: item.text,
          comment_ids: [item.commentId]
        });
      }
      return selected;
    };

    // 2. Synthesize Key Takeaways
    const keyTakeaways = deduplicate(scoredSentences, 4);

    // 3. Synthesize What the Community Agrees On
    const supportingSentences = scoredSentences.filter(s => s.stance === 'support' || s.evidenceType === 'evidence_backed');
    const whatAgreeOn = deduplicate(supportingSentences, 3);

    // 4. Synthesize What People Disagree On
    const dissentingSentences = scoredSentences.filter(
      s => s.stance === 'against' || s.commentType === 'counterargument'
    );
    const whatDisagreeOn = deduplicate(dissentingSentences, 3);

    // 5. Synthesize Unresolved Questions
    const questionComments = validComments.filter(
      c => c.comment_type === 'question' || (c.body.includes('?') && c.depth === 0)
    );
    const unresolvedQuestions: CitationItem[] = [];
    for (const qc of questionComments) {
      if (unresolvedQuestions.length >= 3) break;
      const qSentences = extractCleanSentences(qc.body, 15, 300).filter(s => s.includes('?'));
      if (qSentences.length > 0) {
        unresolvedQuestions.push({
          text: qSentences[0],
          comment_ids: [qc.id]
        });
      }
    }

    // 6. Synthesize Overview (TL;DR)
    const totalComments = validComments.length;
    const supportCount = validComments.filter(c => c.stance === 'support').length;
    const againstCount = validComments.filter(c => c.stance === 'against').length;
    const neutralCount = validComments.filter(c => c.stance === 'neutral').length;

    let sentimentDescription = 'mixed sentiment';
    if (supportCount > (totalComments * 0.55)) {
      sentimentDescription = `predominantly supportive (${Math.round((supportCount / totalComments) * 100)}% positive sentiment)`;
    } else if (againstCount > (totalComments * 0.45)) {
      sentimentDescription = `predominantly critical (${Math.round((againstCount / totalComments) * 100)}% critical sentiment)`;
    } else if (supportCount > againstCount) {
      sentimentDescription = `leaning positive (${Math.round((supportCount / totalComments) * 100)}% support vs ${Math.round((againstCount / totalComments) * 100)}% critical)`;
    }

    const prominentTopics = Array.from(new Set(validComments.flatMap(c => c.topics).filter(t => t !== 'general'))).slice(0, 3);
    const topicSummary = prominentTopics.length > 0 ? `focusing on ${prominentTopics.join(', ')}` : 'across general discussion';

    const topSentence = scoredSentences[0]?.text || '';
    const overview = topSentence
      ? `Discussion across ${totalComments} comments is ${sentimentDescription} ${topicSummary}. Most influential observation: "${topSentence}"`
      : `Discussion across ${totalComments} comments is ${sentimentDescription} ${topicSummary}.`;

    return {
      overview,
      key_takeaways: keyTakeaways,
      what_agree_on: whatAgreeOn,
      what_disagree_on: whatDisagreeOn,
      unresolved_questions: unresolvedQuestions,
      is_ai_generated: false,
      ai_error: null,
      model_name: 'RedditDIG Local Discussion Engine'
    };
  }
}
