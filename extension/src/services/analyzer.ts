// DiscussionAnalyzer: Production-Grade Deterministic Discussion Intelligence for RedditDIG
// Performs multi-factor local statistical computations and 100% local discussion intelligence.
// All local formulas are documented, reproducible, and mathematically defensible (P10-P17).

import {
  ThreadIntelligenceEnvelope,
  CommentSchema,
  ViewpointItem,
  ConsensusResponse,
  MainArgumentItem,
  ContradictionItem,
  ContradictionResponse,
  QuestionResolutionResponse,
  OPInteractionResponse,
  TemperatureResponse,
  VerticalInsightsResponse,
  DebateMapNode,
  HealthDashboardResponse,
  CommentRankingsResponse,
  SummaryResponse,
  EvidenceType,
  CommentType,
  Stance
} from '../types';
import { ExtractionResult } from '../content/adapter';
import { LocalSummaryEngine } from './nlp/summary';
import { LocalContradictionDetector } from './nlp/contradictions';
import { cleanSnippet } from './nlp/sanitizer';

const STOP_WORDS = new Set(
  'the a an and or but if then than this that these those is are was were to of in for on with from by as it its be been being i you your we our they their he she them his her my me do does did can could would should will just not no yes very really about into after before over under more most much many some any what which who why how when where have has had'.split(' ')
);

const TOPIC_LEXICON: Record<string, string[]> = {
  price: ['price', 'cost', 'expensive', 'cheap', 'discount', 'value', 'msrp', 'dollar', 'money', 'budget', 'pricing', 'sale', 'afford'],
  battery: ['battery', 'batteries', 'charging', 'charger', 'runtime', 'drain', 'mah', 'watt', 'life', 'aldente', 'screen on time', 'sot'],
  performance: ['performance', 'speed', 'fast', 'slow', 'cpu', 'gpu', 'fps', 'benchmark', 'm3', 'm4', 'intel', 'amd', 'clock', 'ram', 'memory', 'geekbench'],
  thermals: ['overheat', 'overheating', 'heat', 'thermal', 'throttle', 'throttling', 'fan', 'temp', 'celsius', 'hot', 'warm'],
  reliability: ['reliable', 'reliability', 'durable', 'durability', 'issue', 'problem', 'failure', 'defect', 'flaw', 'broken', 'qc', 'quality control'],
  repairability: ['repair', 'repairable', 'parts', 'warranty', 'soldered', 'longevity', 'applecare', 'framework', 'service', 'replace'],
  alternatives: ['alternative', 'alternatives', 'previous', 'generation', 'competitor', 'thinkpad', 'dell', 'instead', 'other', 'compared to'],
  software: ['software', 'macos', 'update', 'driver', 'firmware', 'bug', 'os', 'docker', 'xcode', 'linux', 'windows', 'glitch'],
  career: ['salary', 'interview', 'offer', 'equity', 'remote', 'company', 'promotion', 'resume', 'level', 'tc', 'compensation', 'recruiter']
};

export class DiscussionAnalyzer {
  /**
   * Deterministically classifies an individual comment (stance, evidence, comment type, topics).
   * P14: Rigorous evidence classification that checks for actual measurements/specifics.
   */
  static classifyComment(c: CommentSchema, opAuthor: string): void {
    const text = c.body.toLowerCase();
    const tokens = text.match(/[a-z0-9]+/g)?.filter(w => !STOP_WORDS.has(w) && w.length > 2) || [];

    // 1. Topic detection
    const matchedTopics: string[] = [];
    for (const [topic, keywords] of Object.entries(TOPIC_LEXICON)) {
      if (keywords.some(kw => text.includes(kw))) {
        matchedTopics.push(topic);
      }
    }
    c.topics = matchedTopics.length > 0 ? matchedTopics : ['general'];

    // 2. Stance detection
    const posMarkers = ['great', 'good', 'excellent', 'love', 'recommend', 'worth', 'easy', 'reliable', 'best', 'satisfied', 'amazing', 'solid', 'impressive', 'praise', 'fantastic', 'flawless', 'superior', 'incredible', 'masterpiece', 'brilliant', 'clean', 'stellar', 'superb', 'game changer'];
    const negMarkers = ['bad', 'terrible', 'awful', 'hate', 'avoid', 'overpriced', 'expensive', 'worst', 'problem', 'issue', 'poor', 'not worth', 'fail', 'throttle', 'garbage', 'broken', 'disaster', 'ugly', 'useless', 'joke', 'overrated', 'mediocre', 'disappointing', 'waste', 'nightmare'];
    const posCount = posMarkers.filter(m => text.includes(m)).length;
    const negCount = negMarkers.filter(m => text.includes(m)).length;

    if (posCount > negCount) c.stance = 'support';
    else if (negCount > posCount) c.stance = 'against';
    else c.stance = 'neutral';

    // 3. Evidence classification (strict requirements, avoid buzzwords without context)
    const hasPersonalExperienceMarkers = [
      'i bought', 'i own', 'i have used', 'my experience', 'in my testing',
      'after six months', 'months ago', 'daily driver', 'in my workflow', 'my unit', 'i noticed',
      'in my experience', 'from my experience', 'speaking from experience', 'in my case',
      'i personally', 'i\'ve been using', 'i have been using', 'i use this', 'my setup',
      'i tested', 'what worked for me', 'i found that', 'in my usage', 'i switched to',
      'i upgraded to', 'i replaced', 'in practice', 'from what i\'ve seen', 'i work with',
      'i work as', 'in my field', 'pro tip', 'solution:', 'workaround:'
    ].some(m => text.includes(m));

    const hasMeasurements = /\b\d+(\.\d+)?\s*(hours?|hrs?|fps|celsius|°c|%|gb|tb|watts?|ms|mah|dollars?|\$)\b/i.test(text);
    const hasBenchmarkSource = [
      'geekbench', 'cinebench', 'benchmark', 'documentation', 'source:', 'according to', 'measured at',
      'tested with', 'datasheet', 'whitepaper', 'citation', 'github.com', 'official docs', 'reference:'
    ].some(m => text.includes(m));

    if (hasBenchmarkSource && hasMeasurements) {
      c.evidence_type = 'evidence_backed';
    } else if (hasPersonalExperienceMarkers) {
      c.evidence_type = 'personal_experience';
    } else if (c.body.includes('?') && c.body.length < 120) {
      c.evidence_type = 'none';
    } else if (['probably', 'might', 'maybe', 'i guess', 'speculate', 'rumor', 'not sure'].some(m => text.includes(m))) {
      c.evidence_type = 'speculation';
    } else if (tokens.length < 5) {
      c.evidence_type = 'unclear';
    } else {
      c.evidence_type = 'opinion';
    }

    // 4. Comment Type
    if (['buy', 'get', 'choose', 'wait for', 'consider', 'recommend', 'avoid', 'order'].some(m => text.includes(m)) && !text.includes('?')) {
      c.comment_type = 'recommendation';
      c.suggestion = c.body;
    } else if (c.body.includes('?') && c.depth === 0) {
      c.comment_type = 'question';
    } else if (c.evidence_type === 'personal_experience') {
      c.comment_type = 'experience';
    } else if (['however', 'disagree', 'counter', 'on the other hand', 'that is not true', 'wrong', 'actually'].some(m => text.includes(m))) {
      c.comment_type = 'counterargument';
    } else if (['lol', 'haha', '/s', 'lmao'].some(m => text.includes(m))) {
      c.comment_type = 'joke';
    } else {
      c.comment_type = 'opinion';
    }

    c.argument = tokens.slice(0, 25).join(' ');
    c.is_op = opAuthor !== '[deleted]' && c.author.toLowerCase() === opAuthor.toLowerCase();
    if (c.score < 0) {
      c.is_disputed = true;
    }
  }

  /**
   * Computes multi-factor comment rankings (P12).
   * Ensures deleted/removed comments cannot be selected as top results.
   */
  static computeRankings(comments: CommentSchema[]): CommentRankingsResponse {
    for (const c of comments) {
      const words = c.body.split(/\s+/).length;

      // Usefulness: factual evidence + substantive length + topic specificity
      const evScore = c.evidence_type === 'evidence_backed' ? 4.0 : c.evidence_type === 'personal_experience' ? 2.8 : 0.5;
      const detailScore = Math.min(words / 18, 3.5);
      c.usefulness_score = Math.round((evScore + detailScore) * 10) / 10;

      // Support: evidence corroborated by positive community upvotes
      const scoreWeight = Math.min(Math.log1p(Math.max(c.score, 0)), 4.0);
      c.support_score = Math.round((evScore * 1.4 + scoreWeight) * 10) / 10;

      // Impact: discussion depth and replies velocity
      c.impact_score = Math.round((Math.min(Math.log1p(Math.max(c.replies_count, 0)) * 2.0 + c.depth * 0.4, 5.0)) * 10) / 10;

      // Questionable / Disputed comment detection
      // Detects downvoted comments (score < 0), net-downvoted comments (score === 0 when other comments have upvotes),
      // heavily contested recommendations, ratio'd comments with high reply activity,
      // and controversial counterarguments.
      const hasPositiveScores = comments.some(other => other.score > 0);
      const isDownvoted = c.score < 0;
      const isDownvotedToZero = c.score === 0 && hasPositiveScores;
      const isContestedRec = c.comment_type === 'recommendation' && (c.score <= 0 || (c.stance === 'against' && c.score < 25));
      const isRatioed = c.replies_count >= 2 && c.score <= 1;
      const isHeavilyContested = c.replies_count >= 4 && c.score <= 3;
      const isContestedCounter = c.comment_type === 'counterargument' && c.replies_count >= 1 && c.score <= 2;

      if (isDownvoted || isDownvotedToZero || isContestedRec || isRatioed || isHeavilyContested || isContestedCounter) {
        c.is_disputed = true;
      }
    }

    // Filter valid non-deleted comments for rankings
    const valid = comments.filter(
      c => c.body && c.body !== '[deleted]' && c.body !== '[removed]' && c.body.trim().length > 0
    );

    if (valid.length === 0) {
      return {
        most_popular: null,
        most_rewarded: null,
        most_rewarded_reason: '',
        reward_data_available: Boolean(comments.some(c => c.awards_data_available)),
        best_supported: null,
        best_supported_reason: '',
        hidden_gem: null,
        hidden_gem_reason: '',
        questionable_suggestion: null,
        questionable_reason: '',
        most_discussed: null
      };
    }

    const mostPop = [...valid].sort((a, b) => b.score - a.score)[0];
    mostPop.is_most_popular = true;

    const bestSup = [...valid].sort((a, b) => b.support_score - a.support_score)[0];
    bestSup.is_best_supported = true;

    // Disputed / Most Downvoted Comment Selection (Feature 10)
    // Prioritizes:
    // 1. Most downvoted comments (strictly sorted by lowest score < 0, with reply controversy breaking ties)
    // 2. Net-downvoted comments (score === 0 when upvoted comments exist in thread)
    // 3. Heavily contested recommendations, ratio'd comments, or counterarguments
    const hasPositiveScores = valid.some(c => c.score > 0);
    const disputedCandidates = valid.filter(c => c.is_disputed || c.score < 0 || (c.score === 0 && hasPositiveScores));
    let disputed: CommentSchema | null = null;

    if (disputedCandidates.length > 0) {
      const scoreDispute = (c: CommentSchema): number => {
        if (c.score < 0) {
          // Tier 1: Negative scores.
          // Base 10,000 ensures negative scores strictly beat any non-negative candidate.
          // (-c.score * 100) ensures -42 beats -12, which beats -3, which beats -1.
          return 10000 + (-c.score * 100) + (c.replies_count * 5);
        }
        if (c.score === 0 && hasPositiveScores) {
          // Tier 2: Downvoted to 0 when positive scores exist in thread.
          // Base 1,000 ensures it beats positive contested candidates.
          return 1000 + (c.replies_count * 10);
        }
        // Tier 3: Non-negative contested candidates
        let score = c.replies_count * 5;
        if (c.comment_type === 'recommendation') score += 15;
        if (c.stance === 'against') score += 10;
        if (c.comment_type === 'counterargument') score += 8;
        score -= Math.max(c.score, 0) * 2;
        return score;
      };

      disputed = [...disputedCandidates].sort((a, b) => scoreDispute(b) - scoreDispute(a))[0] || null;
      if (disputed) {
        disputed.is_disputed = true;
      }
    }
    const mostDiscussed = [...valid].sort((a, b) => b.replies_count - a.replies_count)[0] || null;

    // Check reward data (P4)
    const getAwardCount = (c: CommentSchema): number => {
      const directCount = typeof c.awards_count === 'number'
        ? c.awards_count
        : (typeof c.awards_count === 'string' ? parseInt(c.awards_count, 10) || 0 : 0);
      const dataCount = Array.isArray(c.awards_data) && c.awards_data.length > 0
        ? c.awards_data.reduce((sum, a) => sum + (typeof a.count === 'number' && a.count > 0 ? a.count : 1), 0)
        : 0;
      return Math.max(directCount > 0 ? directCount : 0, dataCount > 0 ? dataCount : 0);
    };

    const commentsWithRewards = valid.filter(c => getAwardCount(c) > 0);
    const mostRewarded = commentsWithRewards.length > 0
      ? [...commentsWithRewards].sort((a, b) => {
          const diff = getAwardCount(b) - getAwardCount(a);
          if (diff !== 0) return diff;
          // Tie-break: highest upvote score
          if (b.score !== a.score) return b.score - a.score;
          // Tie-break: highest replies count
          return b.replies_count - a.replies_count;
        })[0]
      : null;

    let mostRewardedReason = '';
    if (mostRewarded) {
      mostRewarded.is_most_rewarded = true;
      const awardCount = getAwardCount(mostRewarded);
      const awardWord = awardCount === 1 ? 'award' : 'awards';
      const awardCountMap = new Map<string, number>();
      for (const a of mostRewarded.awards_data || []) {
        if (!a.name || a.name === 'Award' || a.name === 'Reddit Award') continue;
        awardCountMap.set(a.name, (awardCountMap.get(a.name) || 0) + (typeof a.count === 'number' && a.count > 0 ? a.count : 1));
      }
      const awardNames = Array.from(awardCountMap.entries())
        .map(([name, count]) => (count > 1 ? `${count}x ${name}` : name));
      const breakdown = awardNames.length > 0 ? ` (${awardNames.join(', ')})` : '';
      mostRewardedReason = `Recognized by the community with ${awardCount} ${awardWord}${breakdown}.`;
    }

    // Olympiad-Level Hidden Gem Discovery Algorithm
    // Discovers high-quality comments buried deep in replies that offer deep value without front-page visibility
    const topScore = Math.max(mostPop.score, 1);

    const scoreGemCandidate = (c: CommentSchema): number => {
      // Disqualifiers
      if (c.id === mostPop.id) return -9999;
      if (c.score < 0) return -9999;
      // Only disqualify disputed comments if they are downvoted or without community backing
      if (c.is_disputed && c.score <= 0) return -9999;
      const lowerAuthor = (c.author || '').toLowerCase();
      if (lowerAuthor === '[deleted]' || lowerAuthor.includes('bot') || lowerAuthor === 'automoderator') return -9999;

      const words = c.body.trim().split(/\s+/).length;
      if (words < 5) return -9999;

      // 1. Buried reply depth (replies in deep trees have much lower visibility on Reddit)
      let depthBonus = 0;
      if (c.depth >= 1) {
        depthBonus = Math.min(c.depth * 2.2, 5.5);
        if (c.depth >= 2) depthBonus += 1.2; // 3rd level and deeper are collapsed by default on Reddit
        if (c.depth >= 3) depthBonus += 1.0; // Very deep reply chain
      }

      // 2. Substance and formatting structure
      const lengthScore = Math.min(words / 18, 4.0);
      let structureBonus = 0;
      if (words >= 30) structureBonus += 0.8;
      if (words >= 60) structureBonus += 1.2;
      if (words > 700) structureBonus -= 2.0;

      // Structured formatting: bullet points, numbered steps, multi-paragraph, citations, solutions
      if (/(\n|^)\s*(\d+[\.\)]|\-|\*)\s+/.test(c.body)) structureBonus += 1.8;
      if (/\n\s*\n/.test(c.body)) structureBonus += 0.8;
      if (/https?:\/\/|github\.com|reddit\.com\/r\//i.test(c.body)) structureBonus += 1.5;
      if (/\b(step \d+|solution|workaround|fix(ed)?|resolv(ed|ing)|root cause|instead of|pro tip|turns out|worked for me|the trick is|how to fix|patch)\b/i.test(c.body)) {
        structureBonus += 1.6;
      }

      // 3. Evidence and first-hand value
      let evidenceWeight = 0;
      if (c.evidence_type === 'evidence_backed') {
        evidenceWeight = 4.5;
      } else if (c.evidence_type === 'personal_experience') {
        evidenceWeight = 3.2;
      } else if (c.comment_type === 'experience') {
        evidenceWeight = 2.5;
      } else if (c.comment_type === 'recommendation') {
        evidenceWeight = 1.8;
      } else if (c.comment_type === 'counterargument') {
        evidenceWeight = 1.5;
      }

      // 4. Positive community endorsement without front-page dominance
      const scoreWeight = Math.min(Math.log2(1 + Math.max(c.score, 0)), 5.0) * 0.8;

      let visibilityPenalty = 0;
      if (topScore > 80 && c.score > 0.5 * topScore) {
        visibilityPenalty = 3.0; // Already widely visible
      }

      return depthBonus + lengthScore + structureBonus + evidenceWeight + scoreWeight - visibilityPenalty;
    };

    const scoredCandidates = valid
      .map(c => ({ comment: c, gemScore: scoreGemCandidate(c) }))
      .filter(item => item.gemScore > 0)
      .sort((a, b) => b.gemScore - a.gemScore);

    let hiddenGem: CommentSchema | null = null;
    let hiddenGemReason = 'High factual specificity and personal experience with moderate community visibility.';

    if (scoredCandidates.length > 0) {
      // If the top candidate is already best_supported at depth 0 and another buried candidate exists, prefer the buried candidate
      let topCandidate = scoredCandidates[0];
      if (
        bestSup &&
        topCandidate.comment.id === bestSup.id &&
        bestSup.depth === 0 &&
        scoredCandidates.length > 1 &&
        scoredCandidates.some(c => c.comment.depth >= 1)
      ) {
        const alternate = scoredCandidates.find(c => c.comment.id !== bestSup.id && c.comment.depth >= 1);
        if (alternate) {
          topCandidate = alternate;
        }
      }

      hiddenGem = topCandidate.comment;
      hiddenGem.is_hidden_gem = true;

      const hasSolution = /\b(solution|workaround|fix(ed)?|resolv(ed|ing)|root cause|instead of|pro tip|turns out|worked for me|the trick is|step \d+|how to fix|patch)\b/i.test(hiddenGem.body);
      const hasFormatting = /(\n|^)\s*(\d+[\.\)]|\-|\*)\s+/.test(hiddenGem.body);

      if (hiddenGem.depth >= 1) {
        let insightType = 'substantive analysis';
        if (hasSolution) {
          insightType = 'actionable workaround and solution';
        } else if (hiddenGem.evidence_type === 'evidence_backed') {
          insightType = 'empirical benchmark evidence';
        } else if (hiddenGem.evidence_type === 'personal_experience') {
          insightType = 'first-hand practical experience';
        } else if (hasFormatting) {
          insightType = 'structured troubleshooting steps';
        } else if (hiddenGem.comment_type === 'counterargument') {
          insightType = 'nuanced counterargument';
        }
        hiddenGemReason = `Buried ${hiddenGem.depth} level${hiddenGem.depth > 1 ? 's' : ''} deep in replies with high-quality ${insightType}.`;
      } else if (hasSolution) {
        hiddenGemReason = 'Practical solution and workaround discovered beneath top-voted comments.';
      } else if (hiddenGem.evidence_type === 'evidence_backed') {
        hiddenGemReason = 'High factual specificity and benchmark evidence with moderate community visibility.';
      } else if (hiddenGem.evidence_type === 'personal_experience') {
        hiddenGemReason = 'Valuable first-hand experience and practical details discovered beneath top replies.';
      } else {
        hiddenGemReason = 'Substantive, in-depth insight with strong community value that did not receive front-page visibility.';
      }
    }

    let questionableReason = 'No heavily disputed comments found.';
    if (disputed) {
      if (disputed.score < 0) {
        const pointLabel = disputed.score === -1 ? 'point' : 'points';
        questionableReason = `Most downvoted comment (${disputed.score} ${pointLabel}) with strong community pushback.`;
      } else if (disputed.score === 0) {
        questionableReason = 'Downvoted comment (0 points) that received net downvotes and community pushback.';
      } else if (disputed.comment_type === 'recommendation') {
        questionableReason = 'Recommendation that received substantial counterarguments and skepticism.';
      } else if (disputed.replies_count >= 2) {
        questionableReason = `Contested comment with ${disputed.replies_count} replies questioning or challenging this viewpoint.`;
      } else {
        questionableReason = 'Comment that prompted notable skepticism and debate within the thread.';
      }
    }

    return {
      most_popular: mostPop,
      most_rewarded: mostRewarded,
      most_rewarded_reason: mostRewardedReason,
      reward_data_available: Boolean(
        mostRewarded ||
        valid.some(c => c.awards_data_available) ||
        comments.some(c => c.awards_data_available)
      ),
      best_supported: bestSup,
      best_supported_reason: 'Selected based on empirical evidence markers corroborated by community upvotes.',
      hidden_gem: hiddenGem,
      hidden_gem_reason: hiddenGem ? hiddenGemReason : '',
      questionable_suggestion: disputed,
      questionable_reason: disputed ? questionableReason : '',
      most_discussed: mostDiscussed
    };
  }

  /**
   * Statistical viewpoint clustering & consensus calculation (P10, P11).
   * Tracks BOTH unique user share and comment share.
   * Never labels a viewpoint as "majority" if it only represents a plurality (< 50% of distinct users).
   */
  static computeViewpointsAndConsensus(comments: CommentSchema[]): {
    viewpoints: ViewpointItem[];
    consensus: ConsensusResponse;
  } {
    const totalComments = comments.length || 1;
    const totalUsers = new Set(comments.map(c => c.author).filter(a => a !== '[deleted]')).size || 1;

    const groups: Record<string, CommentSchema[]> = {
      'Support / Recommend': comments.filter(c => c.stance === 'support'),
      'Critical / Against / Counter': comments.filter(c => c.stance === 'against'),
      'Neutral / Mixed / Inquiries': comments.filter(c => c.stance === 'neutral')
    };

    const viewpoints: ViewpointItem[] = [];

    for (const [label, gComments] of Object.entries(groups)) {
      if (gComments.length === 0) continue;
      const uniqueUsers = new Set(gComments.map(c => c.author).filter(a => a !== '[deleted]')).size;
      const userShare = Math.round((uniqueUsers / totalUsers) * 1000) / 10;
      const commentShare = Math.round((gComments.length / totalComments) * 1000) / 10;

      const scores = gComments.map(c => c.score).sort((a, b) => a - b);
      const medianScore = scores.length > 0 ? scores[Math.floor(scores.length / 2)] : 0;
      const avgScore = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0;

      let signal = 'Neutral / mixed discussion';
      if (medianScore > 80) signal = 'Strong community endorsement';
      else if (medianScore > 15) signal = 'Moderate agreement';
      else if (medianScore < 0) signal = 'Downvoted / skeptical';

      const reps = [...gComments].sort((a, b) => b.support_score - a.support_score).slice(0, 3);

      viewpoints.push({
        label,
        comments_count: gComments.length,
        unique_users: uniqueUsers,
        user_share: userShare,
        comment_share: commentShare,
        is_majority: userShare > 50.0,
        is_plurality: false, // determined after sorting
        median_score: medianScore,
        avg_score: avgScore,
        score_support_signal: signal,
        representative_comments: reps,
        strongest_supporting_arg: reps[0] ? cleanSnippet(reps[0].body, 140) : null,
        strongest_opposing_arg: null
      });
    }

    viewpoints.sort((a, b) => b.unique_users - a.unique_users);

    // Set plurality flag on top viewpoint if it's <= 50%
    if (viewpoints.length > 0) {
      if (viewpoints[0].user_share <= 50.0) {
        viewpoints[0].is_plurality = true;
      }
    }

    const topShare = viewpoints[0]?.user_share || 0;
    const topLabel = viewpoints[0]?.label || 'Mixed';
    let cLabel = 'Mixed';
    let isTrueMajority = false;
    let rationale = 'Discussion is distributed across opposing viewpoints.';

    if (topShare >= 68.0) {
      cLabel = `Strong Majority (${topLabel})`;
      isTrueMajority = true;
      rationale = `Clear majority: ${topShare}% of distinct participants align with "${topLabel}".`;
    } else if (topShare > 50.0) {
      cLabel = `Moderate Majority (${topLabel})`;
      isTrueMajority = true;
      rationale = `Majority agreement: ${topShare}% of distinct participants align with "${topLabel}".`;
    } else if (topShare >= 35.0) {
      cLabel = `Plurality (${topLabel})`;
      isTrueMajority = false;
      rationale = `Plurality view: "${topLabel}" represents the largest group (${topShare}% of distinct users), but no absolute majority exists.`;
    } else {
      cLabel = 'Divided / Contested';
      isTrueMajority = false;
      rationale = 'The thread is distributed across competing perspectives with no dominant majority.';
    }

    return {
      viewpoints,
      consensus: {
        label: cLabel,
        score: topShare,
        rationale,
        is_true_majority: isTrueMajority
      }
    };
  }

  /** Extract main discussion topics with occurrence count and sample comment IDs */
  static extractMainArguments(comments: CommentSchema[]): MainArgumentItem[] {
    const total = comments.length || 1;
    const topicCounts = new Map<string, number>();
    const topicCommentIds = new Map<string, string[]>();

    for (const c of comments) {
      for (const t of c.topics) {
        if (t === 'general') continue;
        topicCounts.set(t, (topicCounts.get(t) || 0) + 1);
        if (!topicCommentIds.has(t)) topicCommentIds.set(t, []);
        if (topicCommentIds.get(t)!.length < 5) topicCommentIds.get(t)!.push(c.id);
      }
    }

    const items: MainArgumentItem[] = [];
    const sorted = Array.from(topicCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
    for (const [topic, count] of sorted) {
      items.push({
        topic: topic.charAt(0).toUpperCase() + topic.slice(1),
        mentions_count: count,
        percentage: Math.round((count / total) * 1000) / 10,
        sample_comment_ids: topicCommentIds.get(topic) || []
      });
    }
    return items;
  }

  /**
   * Discussion temperature estimate based on multi-signal indicators (P16).
   * Factors: disagreement density, hostile vocabulary hits, and deep reply disputes.
   */
  static calculateTemperature(comments: CommentSchema[]): TemperatureResponse {
    const total = comments.length || 1;
    const hostilityWords = ['idiot', 'stupid', 'dumb', 'moron', 'shill', 'fanboy', 'garbage', 'trash', 'clueless', 'liar', 'bullshit'];

    let hostilityHits = 0;
    let disagreementHits = 0;
    let deepDisputes = 0;

    for (const c of comments) {
      const text = c.body.toLowerCase();
      if (hostilityWords.some(w => text.includes(w))) hostilityHits++;
      if (c.stance === 'against' || c.comment_type === 'counterargument') {
        disagreementHits++;
        if (c.depth >= 2) deepDisputes++;
      }
    }

    const hostilityRatio = Math.round((hostilityHits / total) * 1000) / 10;
    const disagreementRatio = Math.round((disagreementHits / total) * 1000) / 10;
    const deepDisputeRatio = Math.round((deepDisputes / total) * 1000) / 10;

    // Defensible formula: 40% hostility + 40% disagreement density + 20% deep disputes
    const rawScore = (hostilityHits / total) * 45 + (disagreementHits / total) * 35 + (deepDisputes / total) * 20;
    const score = Math.round(Math.min(rawScore, 10.0) * 10) / 10;

    let label = 'Calm';
    let explanation = 'Constructive, respectful, and cooperative discussion.';

    if (score >= 6.5) {
      label = 'Very Heated / Confrontational';
      explanation = 'High tension: elevated adversarial exchanges and sharp disagreements across multiple comment branches.';
    } else if (score >= 4.5) {
      label = 'Heated';
      explanation = 'Spirited debate with active disagreements on core discussion points.';
    } else if (score >= 2.5) {
      label = 'Constructive Debate';
      explanation = 'Polite differences of opinion backed by personal experiences.';
    }

    return {
      label,
      score,
      hostility_score: hostilityRatio,
      disagreement_density: disagreementRatio,
      explanation
    };
  }

  /** Build interactive debate map */
  static buildDebateMap(title: string, comments: CommentSchema[]): DebateMapNode {
    const safeTitle = (title || 'Thread Discussion').trim();
    const root: DebateMapNode = {
      id: 'root_post',
      label: safeTitle.slice(0, 60) + (safeTitle.length > 60 ? '...' : ''),
      count: comments.length,
      sentiment: 'neutral',
      comment_ids: comments.slice(0, 4).map(c => c.id),
      children: []
    };

    const stances: Array<{ name: Stance; label: string; sentiment: string }> = [
      { name: 'support', label: 'Support / Recommend', sentiment: 'positive' },
      { name: 'neutral', label: 'Neutral / Inquiries', sentiment: 'neutral' },
      { name: 'against', label: 'Against / Counter', sentiment: 'negative' }
    ];

    for (const st of stances) {
      const g = comments.filter(c => c.stance === st.name);
      if (g.length === 0) continue;

      const node: DebateMapNode = {
        id: `branch_${st.name}`,
        label: st.label,
        count: g.length,
        sentiment: st.sentiment,
        comment_ids: g.slice(0, 3).map(c => c.id),
        children: []
      };

      const branchTopics = new Map<string, number>();
      for (const c of g) {
        for (const t of c.topics) {
          if (t === 'general') continue;
          branchTopics.set(t, (branchTopics.get(t) || 0) + 1);
        }
      }
      const topT = Array.from(branchTopics.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
      for (const [top, count] of topT) {
        node.children.push({
          id: `branch_${st.name}_${top}`,
          label: top.charAt(0).toUpperCase() + top.slice(1),
          count,
          sentiment: st.sentiment,
          comment_ids: g.filter(c => c.topics.includes(top)).slice(0, 3).map(c => c.id),
          children: []
        });
      }
      root.children.push(node);
    }
    return root;
  }

  /** Build argument evolution chain from deepest discussion branch */
  static buildArgumentJourney(comments: CommentSchema[]): Array<{
    comment_id: string;
    author: string;
    depth: number;
    score: number;
    stance: string;
    comment_type: string;
    snippet: string;
  }> {
    const deepest = [...comments].sort((a, b) => b.depth - a.depth);
    if (deepest.length === 0) return [];

    const commentMap = new Map<string, CommentSchema>();
    for (const c of comments) commentMap.set(c.id, c);

    const chain: Array<any> = [];
    const seenJourneyIds = new Set<string>();
    let curr: CommentSchema | undefined = deepest[0];
    while (curr && !seenJourneyIds.has(curr.id) && chain.length < 50) {
      seenJourneyIds.add(curr.id);
      chain.push({
        comment_id: curr.id,
        author: curr.author,
        depth: curr.depth,
        score: curr.score,
        stance: curr.stance,
        comment_type: curr.comment_type,
        snippet: cleanSnippet(curr.body, 160),
        permalink: curr.permalink
      });
      curr = curr.parent_id ? commentMap.get(curr.parent_id) : undefined;
    }
    return chain.reverse();
  }

  /**
   * Evaluates OP question resolution with confidence score (P15).
   */
  static evaluateQuestionResolution(
    comments: CommentSchema[],
    opAuthor: string
  ): { resolution: QuestionResolutionResponse; opInteraction: OPInteractionResponse } {
    const opComments = comments.filter(c => c.is_op);
    const opAcks = opComments.filter(c =>
      ['thanks', 'thank you', 'helped', 'ordered', 'decided', 'bought', 'solved', 'appreciate'].some(w =>
        c.body.toLowerCase().includes(w)
      )
    );

    const answers = comments
      .filter(c => c.comment_type === 'recommendation' && c.score > 15 && !c.is_op)
      .slice(0, 3)
      .map(c => ({
        author: c.author,
        score: c.score,
        summary: cleanSnippet(c.body, 140),
        comment_id: c.id
      }));

    let status: 'Resolved' | 'Likely resolved' | 'Partially answered' | 'Unresolved' = 'Unresolved';
    let confidence = 0.15;
    let reason = 'Awaiting OP follow-up or direct answers.';

    if (opAcks.length > 0) {
      status = 'Resolved';
      confidence = 0.95;
      reason = 'OP explicitly acknowledged or confirmed a resolution in thread comments.';
    } else if (opComments.length > 0 && answers.length > 0) {
      status = 'Likely resolved';
      confidence = 0.65;
      reason = 'OP actively engaged with recommended solutions in the thread.';
    } else if (answers.length > 0) {
      status = 'Partially answered' as any;
      confidence = 0.40;
      reason = 'High-scoring solutions provided by community; OP confirmation pending.';
    }

    const opInteraction: OPInteractionResponse = {
      op_username: opAuthor,
      comments_made: opComments.length,
      replies_received: comments.filter(c => opComments.some(op => op.id === c.parent_id)).length,
      topics_followed: Array.from(new Set(opComments.flatMap(c => c.topics))),
      acknowledged_comments: opAcks.map(c => ({
        author: c.author,
        score: c.score,
        comment_id: c.id,
        snippet: cleanSnippet(c.body, 90)
      }))
    };

    return {
      resolution: {
        status: status as any,
        reason,
        confidence,
        major_answers: answers,
        op_acknowledged: opAcks.length > 0
      },
      opInteraction
    };
  }

  /**
   * Vertical intelligence module with confidence threshold (P17).
   */
  static extractVerticalIntelligence(
    title: string,
    selftext: string,
    comments: CommentSchema[]
  ): VerticalInsightsResponse {
    const fullText = (title + ' ' + selftext).toLowerCase();

    // Calculate vertical relevance scores
    const verticalScores: Record<string, number> = {
      PRODUCT: ['buy', 'phone', 'laptop', 'gpu', 'headphone', 'price', 'product', 'hardware', 'purchase', 'worth it'].filter(w => fullText.includes(w)).length,
      PROGRAMMING: ['code', 'python', 'rust', 'typescript', 'bug', 'developer', 'software', 'programming', 'api', 'docker'].filter(w => fullText.includes(w)).length,
      CAREER: ['job', 'salary', 'career', 'offer', 'interview', 'promotion', 'resume', 'compensation', 'recruiter'].filter(w => fullText.includes(w)).length,
      TECHNOLOGY: ['server', 'ai', 'model', 'cloud', 'architecture', 'database', 'network', 'protocol'].filter(w => fullText.includes(w)).length,
      FINANCE: ['invest', 'stock', 'etf', 'index', 'crypto', 'portfolio', 'dividend', 'market'].filter(w => fullText.includes(w)).length
    };

    let bestCategory = 'GENERAL';
    let maxHits = 0;
    for (const [cat, hits] of Object.entries(verticalScores)) {
      if (hits > maxHits) {
        maxHits = hits;
        bestCategory = cat;
      }
    }

    // Require at least 2 hits to activate specialized vertical
    const isSpecialized = maxHits >= 2;
    const finalCategory = isSpecialized ? bestCategory : 'GENERAL';
    const confidence = isSpecialized ? Math.min(maxHits / 4, 1.0) : 0.3;

    return {
      category: finalCategory,
      is_specialized: isSpecialized,
      confidence: Math.round(confidence * 10) / 10,
      recommendations: comments.filter(c => c.comment_type === 'recommendation' && c.score > 5).slice(0, 3).map(c => ({ text: cleanSnippet(c.body, 130), score: c.score, comment_id: c.id })),
      pros: comments.filter(c => c.stance === 'support' && c.score > 20).slice(0, 3).map(c => ({ text: cleanSnippet(c.body, 130), score: c.score, comment_id: c.id })),
      cons: comments.filter(c => c.stance === 'against' && c.score > 15).slice(0, 3).map(c => ({ text: cleanSnippet(c.body, 130), score: c.score, comment_id: c.id })),
      alternatives: comments.filter(c => c.body.toLowerCase().includes('alternative') || c.body.toLowerCase().includes('instead of')).slice(0, 3).map(c => ({ text: cleanSnippet(c.body, 130), score: c.score, comment_id: c.id })),
      domain_specific_data: {}
    };
  }

  /**
   * Complete thread analysis pipeline.
   * P1: Truthful error handling for AI with NO silent deterministic fallback masquerading as AI.
   */
  static async analyzeThread(
    extraction: ExtractionResult,
    onProgress?: (step: string, pct: number) => void
  ): Promise<ThreadIntelligenceEnvelope> {
    const post = extraction.post;
    const rawComments = extraction.comments;

    onProgress?.('Reading and grouping comments...', 20);
    const comments: CommentSchema[] = rawComments.map(rc => ({
      id: rc.id,
      reddit_id: rc.redditId,
      parent_id: rc.parentId,
      author: rc.author,
      body: rc.body,
      score: rc.score,
      replies_count: rc.repliesCount,
      depth: rc.depth,
      permalink: rc.permalink,
      created_utc: rc.createdUtc,
      created_relative: rc.createdRelative,
      timestamp_display: rc.timestampDisplay,
      awards_data_available: rc.awardsDataAvailable,
      awards_count: rc.awardsCount,
      awards_data: (rc.awardsData || []).map(a => ({
        name: a.name,
        count: a.count,
        icon_url: (a as any).icon_url || a.iconUrl
      })),
      is_op: rc.isOp,
      stance: 'neutral',
      comment_type: 'opinion',
      evidence_type: 'opinion',
      topics: [],
      argument: '',
      claims: [],
      usefulness_score: 0,
      support_score: 0,
      impact_score: 0,
      is_hidden_gem: false,
      is_best_supported: false,
      is_most_popular: false,
      is_most_rewarded: false,
      is_disputed: false,
      ai_confidence: 1.0
    }));

    for (const c of comments) {
      this.classifyComment(c, post.author);
    }

    onProgress?.('Finding top points and agreement...', 50);

    // Isolated Feature Calculations (Directive Section 11 & 85: No Single Feature Blocker)
    let rankings: CommentRankingsResponse;
    try {
      rankings = this.computeRankings(comments);
    } catch (e) {
      console.warn('Rankings analysis degraded:', e);
      rankings = {
        most_popular: null,
        most_rewarded: null,
        most_rewarded_reason: '',
        reward_data_available: Boolean(comments.some(c => c.awards_data_available)),
        best_supported: null,
        best_supported_reason: '',
        hidden_gem: null,
        hidden_gem_reason: '',
        questionable_suggestion: null,
        questionable_reason: '',
        most_discussed: null
      };
    }

    let viewpoints: ViewpointItem[] = [];
    let consensus: ConsensusResponse = {
      label: 'Neutral / Mixed',
      score: 0,
      rationale: 'Viewpoints analysis unavailable for this thread.',
      is_true_majority: false
    };
    try {
      const vc = this.computeViewpointsAndConsensus(comments);
      viewpoints = vc.viewpoints;
      consensus = vc.consensus;
    } catch (e) {
      console.warn('Viewpoints analysis degraded:', e);
    }

    let mainArguments: MainArgumentItem[] = [];
    try {
      mainArguments = this.extractMainArguments(comments);
    } catch (e) {
      console.warn('Main arguments degraded:', e);
    }

    let temperature: TemperatureResponse = {
      label: 'Calm',
      score: 0,
      hostility_score: 0,
      disagreement_density: 0,
      explanation: 'Discussion temperature unavailable.'
    };
    try {
      temperature = this.calculateTemperature(comments);
    } catch (e) {
      console.warn('Temperature analysis degraded:', e);
    }

    let debateMap: DebateMapNode = {
      id: 'root_post',
      label: (post.title || 'Discussion').slice(0, 60),
      count: comments.length,
      sentiment: 'neutral',
      comment_ids: [],
      children: []
    };
    try {
      debateMap = this.buildDebateMap(post.title, comments);
    } catch (e) {
      console.warn('Debate map degraded:', e);
    }

    let journey: Array<any> = [];
    try {
      journey = this.buildArgumentJourney(comments);
    } catch (e) {
      console.warn('Argument journey degraded:', e);
    }

    let resolution: QuestionResolutionResponse = {
      status: 'Unresolved',
      reason: 'OP resolution analysis unavailable.',
      confidence: 0,
      major_answers: [],
      op_acknowledged: false
    };
    let opInteraction: OPInteractionResponse = {
      op_username: post.author,
      comments_made: 0,
      replies_received: 0,
      topics_followed: [],
      acknowledged_comments: []
    };
    try {
      const ro = this.evaluateQuestionResolution(comments, post.author);
      resolution = ro.resolution;
      opInteraction = ro.opInteraction;
    } catch (e) {
      console.warn('Question resolution degraded:', e);
    }

    let vertical: VerticalInsightsResponse = {
      category: 'GENERAL',
      is_specialized: false,
      confidence: 0.1,
      recommendations: [],
      pros: [],
      cons: [],
      alternatives: [],
      domain_specific_data: {}
    };
    try {
      vertical = this.extractVerticalIntelligence(post.title, post.selftext, comments);
    } catch (e) {
      console.warn('Vertical intelligence degraded:', e);
    }

    // Health dashboard
    const distinctUsers = new Set(comments.map(c => c.author).filter(a => a !== '[deleted]')).size;
    const health: HealthDashboardResponse = {
      comments_analyzed: comments.length,
      distinct_participants: distinctUsers,
      major_viewpoints_count: viewpoints.length,
      consensus_label: consensus.label,
      unresolved_questions_count: comments.filter(c => c.comment_type === 'question').length,
      conflicting_claims_count: 0, // will be updated if contradictions are found
      useful_comments_count: comments.filter(c => c.usefulness_score >= 4.0).length,
      coverage_percentage: extraction.coverageRatio,
      total_reported_comments: extraction.totalReportedComments,
      comments_unavailable: extraction.commentsUnavailable,
      expansion_attempts: extraction.expansionAttempts,
      coverage: extraction.coverage
    };

    // 100% Local Discussion Intelligence & Contradiction Detection (Directive Section 11, 14, 18)
    onProgress?.('Summarizing discussion...', 75);
    let summary: SummaryResponse;
    let contradictions: ContradictionItem[] = [];
    let contradictionsMeta: ContradictionResponse = {
      items: [],
      is_ai_generated: false,
      ai_error: null
    };

    const [summaryResult, contradictionsResult] = await Promise.allSettled([
      Promise.resolve().then(() => LocalSummaryEngine.generateSummary(
        post.title,
        post.subreddit,
        comments,
        viewpoints.map(v => v.label)
      )),
      Promise.resolve().then(() => LocalContradictionDetector.detectContradictions(comments, post.title))
    ]);

    if (summaryResult.status === 'fulfilled') {
      summary = summaryResult.value;
    } else {
      summary = {
        overview: 'Summary calculation encountered an unexpected state.',
        key_takeaways: [],
        what_agree_on: [],
        what_disagree_on: [],
        unresolved_questions: [],
        is_ai_generated: false,
        ai_error: null,
        model_name: 'RedditDIG Local Discussion Engine'
      };
    }

    if (contradictionsResult.status === 'fulfilled') {
      contradictionsMeta = contradictionsResult.value;
      contradictions = contradictionsMeta.items;
      health.conflicting_claims_count = contradictions.length;
    } else {
      contradictionsMeta = {
        items: [],
        is_ai_generated: false,
        ai_error: null
      };
    }

    onProgress?.('Ready!', 100);

    return {
      thread_id: post.id,
      title: post.title,
      author: post.author,
      subreddit: post.subreddit,
      url: post.url,
      score: post.score,
      upvote_ratio: post.upvoteRatio,
      num_comments: comments.length,
      status: 'completed',
      progress: 100,
      step: 'Completed',
      total_analyzed: comments.length,
      unique_participants: distinctUsers,
      is_truncated: extraction.commentsUnavailable > 0,
      created_utc: post.createdUtc,
      created_relative: post.createdRelative,
      timestamp_display: post.timestampDisplay,
      vertical_category: vertical.category,
      summary,
      consensus,
      viewpoints,
      main_arguments: mainArguments,
      rankings,
      health,
      coverage: extraction.coverage,
      contradictions,
      contradictions_meta: contradictionsMeta,
      question_resolution: resolution,
      op_interaction: opInteraction,
      temperature,
      vertical_insights: vertical,
      argument_journey: journey,
      debate_map: debateMap,
      comments
    };
  }
}
