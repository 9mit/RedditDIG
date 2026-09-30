// LocalContradictionDetector: Grounded local contradiction & disagreement engine.
// Fulfills Directive Section 18: Distinguishes direct contradiction from preference disagreement.
// Extracts opposing claims, subject/property polarity inversions, reply chain pushbacks, and links source comment IDs.

import { CommentSchema, ContradictionItem, ContradictionResponse } from '../../types';
import { extractCleanSentences, cleanSnippet } from './sanitizer';

interface ClaimCandidate {
  commentId: string;
  author: string;
  body: string;
  topic: string;
  subject: string;
  property: string;
  isNegative: boolean;
  isPreference: boolean;
  score: number;
}

const COMMON_STOP_WORDS = new Set([
  'about', 'above', 'after', 'again', 'against', 'almost', 'also', 'although', 'always', 'another',
  'anyone', 'anything', 'around', 'because', 'before', 'being', 'between', 'both', 'could', 'every',
  'everyone', 'first', 'from', 'have', 'having', 'here', 'into', 'just', 'like', 'many', 'maybe',
  'more', 'most', 'much', 'myself', 'never', 'only', 'other', 'people', 'really', 'same', 'should',
  'since', 'some', 'someone', 'something', 'still', 'such', 'than', 'that', 'their', 'them', 'then',
  'there', 'these', 'they', 'thing', 'things', 'think', 'this', 'those', 'through', 'under', 'very',
  'well', 'what', 'when', 'where', 'which', 'while', 'with', 'would', 'your', 'general', 'reddit'
]);

export class LocalContradictionDetector {
  /**
   * Detects real contradictions and disagreements locally with source comment links.
   * Identifies reply chain pushbacks, opposing claims on shared entities/topics,
   * counterarguments, and factual vs preference polarity inversions.
   */
  static detectContradictions(comments: CommentSchema[], postTitle?: string): ContradictionResponse {
    const valid = comments.filter(
      c => c.body && c.body.trim().length > 10 && c.author !== '[deleted]' && c.author !== '[removed]'
    );

    if (valid.length < 2) {
      return {
        items: [],
        is_ai_generated: false,
        ai_error: null
      };
    }

    const items: ContradictionItem[] = [];
    const pairedCommentKeys = new Set<string>();

    const recordPair = (idA: string, idB: string): boolean => {
      const pairKey = [idA, idB].sort().join(':');
      if (pairedCommentKeys.has(pairKey)) return false;
      pairedCommentKeys.add(pairKey);
      return true;
    };

    // Fast comment lookup map by ID and clean ID
    const commentMap = new Map<string, CommentSchema>();
    for (const c of valid) {
      commentMap.set(c.id, c);
      const clean = c.id.replace(/^t1_/, '');
      if (clean) commentMap.set(clean, c);
      if (c.reddit_id) commentMap.set(c.reddit_id, c);
    }

    // 1. Reply Chain Pushbacks & Direct Parent-Child Disagreements
    const pushbackRegex = /\b(i\s+(?:strongly\s+|completely\s+|totally\s+|hard\s+|respectfully\s+)?disagree(?:s|d)?(?:\s+with\s+(?:this|you|that))?|hard\s+disagree|strongly\s+disagree|couldn'?t\s+disagree\s+more|beg\s+to\s+differ|hard\s+no|definitely\s+not|absolutely\s+not|not\s+at\s+all|not\s+(?:true|accurate|correct|the\s+case)|(?:that'?s|this\s+is|it'?s|it\s+is)\s+(?:simply\s+|completely\s+|totally\s+|just\s+|plain\s+|obviously\s+|clearly\s+|factually\s+)?(?:not\s+true|false|incorrect|wrong|untrue|misleading|bs|bullshit|nonsense|inaccurate|bogus|garbage|a\s+myth|dead\s+wrong)|you(?:'re|\s+are)\s+(?:simply\s+|completely\s+|totally\s+|just\s+|dead\s+|clearly\s+|obviously\s+)?(?:wrong|mistaken|misinformed|misleading)|^(?:wrong|false|incorrect|untrue|nope|nah|bullshit|nonsense)\b|\b(?:wrong|false|incorrect)\b\.|no\s+it\s+(?:isn'?t|doesn'?t|can'?t|won'?t)|no\s+they\s+don'?t|no\s+you\s+(?:can'?t|don'?t)|actually,?\s+(?:no|not|that'?s\s+not|it\s+doesn'?t|this\s+is\s+not|it\s+isn'?t|there\s+is\s+no|you\s+can'?t|it\s+won'?t)|on\s+the\s+contrary|the\s+opposite\s+is\s+true|except\s+(?:that|it\s+isn'?t|you\s+forgot|they\s+don'?t)|citation\s+needed|zero\s+(?:evidence|proof)|no\s+(?:evidence|proof|basis)|where\s+did\s+you\s+get\s+that|stop\s+spreading\s+misinformation|total\s+myth|this\s+myth\s+needs\s+to\s+die|that\s+makes\s+no\s+sense|makes\s+no\s+sense|complete\s+(?:nonsense|garbage|bs)|total\s+(?:nonsense|garbage|bs)|you\s+missed\s+the\s+point|misses\s+the\s+point|not\s+how\s+(?:it|that)\s+works|doesn'?t\s+work\s+(?:that\s+way|like\s+that|at\s+all)|don'?t\s+do\s+this|terrible\s+advice|horrible\s+advice|bad\s+advice|worst\s+advice|steer\s+clear|avoid\s+this\s+at\s+all\s+costs)\b/i;

    const contrastiveRegex = /\b(however|on\s+the\s+other\s+hand|in\s+reality|in\s+contrast|except\s+that|on\s+the\s+contrary|unlike\s+what\s+you\s+said)\b/i;

    for (const child of valid) {
      if (!child.parent_id) continue;
      const parent = commentMap.get(child.parent_id) || commentMap.get(child.parent_id.replace(/^t1_/, ''));
      if (!parent || parent.author.toLowerCase() === child.author.toLowerCase()) continue;

      const childText = child.body;
      const hasPushbackPhrase = pushbackRegex.test(childText);
      const isCounterArg = child.comment_type === 'counterargument';
      const isOpposingStance = (parent.stance === 'support' && child.stance === 'against') ||
        (parent.stance === 'against' && child.stance === 'support');
      const isContrastive = contrastiveRegex.test(childText) && (parent.stance !== 'neutral' || child.stance !== 'neutral' || child.depth > 0);

      if (hasPushbackPhrase || isCounterArg || (isOpposingStance && child.depth > 0) || isContrastive) {
        if (!recordPair(parent.id, child.id)) continue;

        // Extract raw sentences directly to avoid dropping short punchy openers like "I completely disagree."
        const rawParentSents = parent.body.split(/(?<=[.?!])\s+/).map(s => s.trim()).filter(s => s.length >= 8);
        const rawChildSents = child.body.split(/(?<=[.?!])\s+/).map(s => s.trim()).filter(s => s.length >= 8);

        // Find the pushback sentence in the child
        let pushbackSent = rawChildSents.find(s => pushbackRegex.test(s)) ||
          rawChildSents.find(s => contrastiveRegex.test(s)) ||
          rawChildSents.find(s => /\b(however|but|actually|wrong|disagree|incorrect|false)\b/i.test(s)) ||
          rawChildSents[0] ||
          child.body;

        // If the pushback sentence is a brief opener (< 40 chars) and there is a subsequent sentence, combine them
        const pushbackIdx = rawChildSents.indexOf(pushbackSent);
        if (pushbackSent.length < 40 && pushbackIdx >= 0 && pushbackIdx + 1 < rawChildSents.length) {
          pushbackSent = `${pushbackSent} ${rawChildSents[pushbackIdx + 1]}`;
        }

        // Find primary claim in parent
        const parentClaim = rawParentSents.find(s => s.length > 20) || rawParentSents[0] || parent.body;

        // Determine topic: shared topic, or shared significant word, or parent/child topic
        const sharedTopic = parent.topics.find(t => t !== 'general' && child.topics.includes(t));
        let topicLabel = sharedTopic;
        if (!topicLabel) {
          const parentWords = parent.body.toLowerCase().match(/[a-z]{4,}/g) || [];
          const childWords = new Set(child.body.toLowerCase().match(/[a-z]{4,}/g) || []);
          const common = parentWords.find(w => childWords.has(w) && !COMMON_STOP_WORDS.has(w));
          if (common) {
            topicLabel = common.toUpperCase();
          } else if (parent.topics[0] && parent.topics[0] !== 'general') {
            topicLabel = parent.topics[0].toUpperCase();
          } else if (child.topics[0] && child.topics[0] !== 'general') {
            topicLabel = child.topics[0].toUpperCase();
          } else {
            topicLabel = 'DIRECT REBUTTAL';
          }
        }

        items.push({
          topic: topicLabel.toUpperCase(),
          claim_a: cleanSnippet(parentClaim, 160),
          claim_b: cleanSnippet(pushbackSent, 160),
          support_a_count: Math.max(parent.score, 1),
          support_b_count: Math.max(child.score, 1),
          sample_a_ids: [parent.id],
          sample_b_ids: [child.id],
          is_direct_contradiction: true
        });

        if (items.length >= 6) break;
      }
    }

    // 2. Comprehensive Multi-Domain Properties & Entity Disagreements
    const propertyPatterns = [
      // Tech hardware & gadgets
      { name: 'battery life', regex: /\b(battery|battery life|sot|drain|runtime|charging)\b/i },
      { name: 'performance', regex: /\b(performance|speed|fast|slow|fps|lag|throttle|throttling|latency|benchmarks?|cpu|gpu|ram)\b/i },
      { name: 'camera / imaging', regex: /\b(camera|lens|sensor|photos?|pictures?|portrait|night mode|zoom|video quality|low light|megapixels?)\b/i },
      { name: 'display / screen', regex: /\b(screen|display|oled|amoled|refresh rate|120hz|brightness|nits|resolution|color accuracy)\b/i },
      { name: 'audio / sound', regex: /\b(audio|sound|speakers?|headphones?|bass|volume|microphone|mic|anc|noise cancel(?:lation|ing))\b/i },
      { name: 'keyboard / typing', regex: /\b(keyboard|keys|typing|key travel|trackpad|mouse|switches|clicks?)\b/i },
      { name: 'price / value', regex: /\b(price|cost|expensive|cheap|worth it|overpriced|waste of money|value|subscription|affordable|msrp|budget)\b/i },
      { name: 'reliability', regex: /\b(reliable|reliability|crash|buggy|defect|breaks|failure|stable|stability|glitch|freeze)\b/i },
      { name: 'build quality', regex: /\b(build quality|hinge|chassis|materials|durability|durable|flimsy|scratch|premium feel)\b/i },
      { name: 'thermals / fan', regex: /\b(thermals?|heat|cooling|fan|fan noise|overheat|hot|warm)\b/i },
      { name: 'support / updates', regex: /\b(support|update|compatibility|compatible|works with|customer service|warranty)\b/i },
      { name: 'software / os', regex: /\b(software|os|macos|windows|linux|ios|android|firmware|ecosystem|drivers?|bloatware)\b/i },
      { name: 'ease of use', regex: /\b(easy|hard|difficult|intuitive|learning curve|user friendly|confusing|complex|setup)\b/i },
      { name: 'design / aesthetics', regex: /\b(design|aesthetic|theme|look|looks|ugly|beautiful|clean|minimal|dark mode|light mode|dark theme|light theme)\b/i },

      // Media, gaming & entertainment
      { name: 'story / ending', regex: /\b(ending|story|plot|writing|dialogue|finale|character development|season|lore|twist)\b/i },
      { name: 'gameplay / mechanics', regex: /\b(gameplay|mechanics|difficulty|combat|balance|multiplayer|graphics|game feel|bosses?|controls)\b/i },
      { name: 'soundtrack / music', regex: /\b(soundtrack|score|music|ost|composer|audio design|songs?)\b/i },
      { name: 'acting / performance', regex: /\b(acting|cast|actor|actress|performance|casting)\b/i },

      // Workplace & career
      { name: 'workplace / compensation', regex: /\b(salary|pay|compensation|wfh|remote work|office|rto|hybrid|management|work-life balance|culture|boss)\b/i },

      // Health, science & lifestyle
      { name: 'effectiveness / safety', regex: /\b(effective|efficacy|safety|safe|dangerous|side effects|healthy|harmful|benefit|cure|treatment)\b/i },
      { name: 'ethics / fairness', regex: /\b(ethical|ethics|fair|unfair|scam|fraud|honest|dishonest|policy|regulation|monopoly)\b/i },
    ];

    const negationMarkers = /\b(not|never|doesn'?t|does not|cannot|can'?t|won'?t|isn'?t|aren'?t|no|barely|hardly|unusable|false|wrong|horrible|terrible|awful|garbage|trash|broken|fails|failed|worst|poor|bad|not worth|disaster|ugly|cluttered|mess|clunky|bloated|painful|unpleasant|annoying|unacceptable|useless|joke|overrated|mediocre|disappointing|disappointment|waste of money|waste of time|nightmare|catastrophe|flawed|avoid)\b/i;

    const affirmativeMarkers = /\b(great|excellent|smooth|flawless|always|easily|definitely|fast|solid|works perfectly|confirmed|amazing|fantastic|love|best|superior|impressive|worth it|well made|high quality|reliable|masterpiece|brilliant|beautiful|clean|minimal|good|nice|pretty|intuitive|sharp|gorgeous|perfect|pleasure|enjoyable|convenient|incredible|unmatched|recommend|top tier|stellar|superb|delightful|game changer)\b/i;

    const preferenceMarkers = /\b(i prefer|my preference|personally i like|i just like|in my taste|for me|my favorite|i personally enjoy|to each their own|personal taste|personally prefer)\b/i;

    // Extract property and dynamic entity candidates
    const candidates: ClaimCandidate[] = [];

    // Pre-extract thread context keywords from post title or comment vocabulary
    const threadSalientKeywords = new Set<string>();
    if (postTitle) {
      const titleTokens = postTitle.toLowerCase().match(/[a-z]{4,}/g) || [];
      for (const tok of titleTokens) {
        if (!COMMON_STOP_WORDS.has(tok)) threadSalientKeywords.add(tok);
      }
    }

    for (const c of valid) {
      const sentences = extractCleanSentences(c.body, 12, 300);
      for (const sent of sentences) {
        let matched = false;

        // Check defined properties
        for (const prop of propertyPatterns) {
          if (prop.regex.test(sent)) {
            const hasNeg = negationMarkers.test(sent);
            const hasAff = affirmativeMarkers.test(sent);
            const isPref = preferenceMarkers.test(sent);

            if (hasNeg || hasAff || isPref) {
              candidates.push({
                commentId: c.id,
                author: c.author,
                body: sent.trim(),
                topic: prop.name,
                subject: prop.name,
                property: prop.name,
                isNegative: hasNeg && !hasAff,
                isPreference: isPref,
                score: c.score
              });
              matched = true;
              break;
            }
          }
        }

        // Check dynamic keywords (either from comment topics or salient thread entities)
        if (!matched) {
          const isPref = preferenceMarkers.test(sent);
          const hasNeg = negationMarkers.test(sent);
          const hasAff = affirmativeMarkers.test(sent);

          if (hasNeg || hasAff || isPref) {
            let entity = c.topics[0] && c.topics[0] !== 'general' ? c.topics[0] : null;

            if (!entity) {
              const sentWords = sent.toLowerCase().match(/[a-z]{4,}/g) || [];
              const foundWord = sentWords.find(w => threadSalientKeywords.has(w) && !COMMON_STOP_WORDS.has(w)) ||
                sentWords.find(w => !COMMON_STOP_WORDS.has(w));
              if (foundWord) {
                entity = foundWord;
              }
            }

            if (entity) {
              candidates.push({
                commentId: c.id,
                author: c.author,
                body: sent.trim(),
                topic: entity,
                subject: entity,
                property: entity,
                isNegative: hasNeg && !hasAff,
                isPreference: isPref,
                score: c.score
              });
            }
          }
        }
      }
    }

    // Compare pairs with different authors on same subject
    for (let i = 0; i < candidates.length; i++) {
      if (items.length >= 6) break;
      for (let j = i + 1; j < candidates.length; j++) {
        if (items.length >= 6) break;
        const a = candidates[i];
        const b = candidates[j];

        if (a.author.toLowerCase() === b.author.toLowerCase()) continue;
        if (a.subject !== b.subject) continue;

        // Check opposing polarities or opposing preference statements on the same subject
        const isPolarityClash = a.isNegative !== b.isNegative;
        const isPreferenceDifference = a.isPreference && b.isPreference;

        if (isPolarityClash || isPreferenceDifference) {
          if (!recordPair(a.commentId, b.commentId)) continue;

          const isDirect = !a.isPreference && !b.isPreference;
          const topicLabel = a.topic.toUpperCase();

          items.push({
            topic: topicLabel,
            claim_a: cleanSnippet(a.body, 160),
            claim_b: cleanSnippet(b.body, 160),
            support_a_count: Math.max(a.score, 1),
            support_b_count: Math.max(b.score, 1),
            sample_a_ids: [a.commentId],
            sample_b_ids: [b.commentId],
            is_direct_contradiction: isDirect
          });
        }
      }
    }

    // 3. Stance Inversion on Shared Topics & Cross-Comment Discourse (Classifier Level Fallback)
    if (items.length < 3) {
      const topicGroups = new Map<string, { support: CommentSchema[]; against: CommentSchema[] }>();

      // Collect topic words from comments
      const wordFrequency = new Map<string, number>();
      for (const c of valid) {
        const words = new Set((c.body.toLowerCase().match(/[a-z]{4,}/g) || []).filter(w => !COMMON_STOP_WORDS.has(w)));
        for (const w of words) {
          wordFrequency.set(w, (wordFrequency.get(w) || 0) + 1);
        }
      }

      // Filter words mentioned in at least 2 distinct comments
      const frequentWords = Array.from(wordFrequency.entries())
        .filter(([, count]) => count >= 2)
        .sort((a, b) => b[1] - a[1])
        .map(([w]) => w)
        .slice(0, 10);

      for (const c of valid) {
        const cText = c.body.toLowerCase();
        const activeTopics = new Set<string>();

        for (const t of c.topics) {
          if (t !== 'general') activeTopics.add(t);
        }

        for (const w of frequentWords) {
          if (cText.includes(w)) activeTopics.add(w);
        }

        if (activeTopics.size === 0 && postTitle) {
          activeTopics.add('DISCUSSION');
        }

        for (const t of activeTopics) {
          if (!topicGroups.has(t)) topicGroups.set(t, { support: [], against: [] });
          const isAgainst = c.stance === 'against' || c.comment_type === 'counterargument' || negationMarkers.test(c.body);
          const isSupport = c.stance === 'support' || affirmativeMarkers.test(c.body);

          if (isSupport && !isAgainst) {
            topicGroups.get(t)!.support.push(c);
          } else if (isAgainst) {
            topicGroups.get(t)!.against.push(c);
          }
        }
      }

      for (const [topic, group] of topicGroups.entries()) {
        if (items.length >= 6) break;
        if (group.support.length > 0 && group.against.length > 0) {
          const topA = [...group.support].sort((x, y) => y.score - x.score)[0];
          const topB = [...group.against].sort((x, y) => y.score - x.score)[0];

          if (topA && topB && topA.author.toLowerCase() !== topB.author.toLowerCase()) {
            if (!recordPair(topA.id, topB.id)) continue;

            const sentsA = extractCleanSentences(topA.body, 12, 300);
            const sentsB = extractCleanSentences(topB.body, 12, 300);

            const sentA = sentsA.find(s => affirmativeMarkers.test(s)) || sentsA[0] || topA.body;
            const sentB = sentsB.find(s => negationMarkers.test(s) || pushbackRegex.test(s)) || sentsB[0] || topB.body;

            items.push({
              topic: topic.toUpperCase(),
              claim_a: cleanSnippet(sentA, 160),
              claim_b: cleanSnippet(sentB, 160),
              support_a_count: Math.max(topA.score, 1),
              support_b_count: Math.max(topB.score, 1),
              sample_a_ids: [topA.id],
              sample_b_ids: [topB.id],
              is_direct_contradiction: true
            });
          }
        }
      }
    }

    return {
      items,
      is_ai_generated: false,
      ai_error: null
    };
  }
}
