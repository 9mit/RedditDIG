// Client-Side In-Memory Search Engine for RedditDIG
// Provides Exact Phrase Matching, Case-Insensitive Username Search, Subword Similarity Retrieval, and Multi-Filter Facets.

import { CommentSchema, SearchRequest, SearchResponse } from '../types';
import { EmbeddingProvider, defaultEmbeddingProvider } from './search/embedding';

export class ClientSearchEngine {
  private static embeddingProvider: EmbeddingProvider = defaultEmbeddingProvider;

  /** Set custom embedding provider if desired in the future */
  static setEmbeddingProvider(provider: EmbeddingProvider) {
    this.embeddingProvider = provider;
  }

  /** Normalizes a username for resilient matching */
  static normalizeUsername(username: string): string {
    return username.trim().replace(/^u\//i, '').replace(/^@/, '').toLowerCase();
  }

  /**
   * Execute real in-memory search over comments with full facet filtering (P6)
   */
  static search(comments: CommentSchema[], req: SearchRequest): SearchResponse {
    let filtered = [...comments];

    // Filter out deleted/removed comments from search results
    filtered = filtered.filter(
      c => c.body && c.body !== '[deleted]' && c.body !== '[removed]'
    );

    // 1. Author / Username filter (supports username, u/username, case-insensitive)
    if (req.username && req.username.trim()) {
      const cleanUser = this.normalizeUsername(req.username);
      filtered = filtered.filter(c => {
        const commentAuthor = c.author.toLowerCase();
        return commentAuthor === cleanUser || this.normalizeUsername(c.author) === cleanUser;
      });
    }

    // 2. Minimum score
    if (req.min_score !== undefined && req.min_score !== null) {
      filtered = filtered.filter(c => c.score >= (req.min_score || 0));
    }

    // 3. Minimum replies
    if (req.min_replies !== undefined && req.min_replies !== null) {
      filtered = filtered.filter(c => c.replies_count >= (req.min_replies || 0));
    }

    // 4. Stance filter
    if (req.stance && req.stance !== 'all') {
      filtered = filtered.filter(c => c.stance === req.stance);
    }

    // 5. Comment Type
    if (req.comment_type && req.comment_type !== 'all') {
      filtered = filtered.filter(c => c.comment_type === req.comment_type);
    }

    // 6. Evidence Type
    if (req.evidence_type && req.evidence_type !== 'all') {
      filtered = filtered.filter(c => c.evidence_type === req.evidence_type);
    }

    // 7. Topic Filter
    if (req.topic && req.topic !== 'all') {
      filtered = filtered.filter(c => c.topics && c.topics.includes(req.topic!));
    }

    // 8. Top-level only
    if (req.top_level_only) {
      filtered = filtered.filter(c => c.depth === 0);
    }

    const rawQuery = (req.query || '').trim();

    // If query is empty, sort filtered results by requested order
    if (!rawQuery) {
      filtered = this.sortComments(filtered, req.sort_by || 'relevance');
      const uniqueUsers = new Set(filtered.map(c => c.author).filter(a => a !== '[deleted]')).size;
      const offset = req.offset || 0;
      const limit = req.limit || 30;

      return {
        total_matches: filtered.length,
        unique_users: uniqueUsers,
        query_mode: req.mode || 'exact',
        ranking_explanation: 'Facet filters applied. Sorted by ' + (req.sort_by || 'relevance') + '.',
        results: filtered.slice(offset, offset + limit)
      };
    }

    const mode = req.mode || 'hybrid';

    // Check for explicit double-quoted exact phrase e.g. "battery life"
    const phraseMatch = rawQuery.match(/^"([^"]+)"$/);
    const isExplicitPhrase = Boolean(phraseMatch);
    const targetQuery = isExplicitPhrase ? phraseMatch![1].toLowerCase() : rawQuery.toLowerCase();

    interface ScoredComment {
      comment: CommentSchema;
      exactScore: number;
      similarityScore: number;
      combinedScore: number;
    }

    const scoredList: ScoredComment[] = [];

    // Pre-calculate query embedding for similarity / hybrid modes
    let queryEmbedding: Float32Array | null = null;
    if (mode === 'similarity' || mode === 'hybrid') {
      queryEmbedding = this.embeddingProvider.generateEmbedding(targetQuery);
    }

    for (const c of filtered) {
      const text = c.body.toLowerCase();
      let exactScore = 0;

      if (isExplicitPhrase) {
        if (text.includes(targetQuery)) {
          exactScore = 1.0;
        }
      } else {
        const queryTerms = targetQuery.split(/\s+/).filter(t => t.length > 0);
        let matchCount = 0;
        for (const term of queryTerms) {
          if (text.includes(term)) {
            matchCount++;
          }
        }
        if (matchCount > 0) {
          exactScore = matchCount / queryTerms.length;
          // Boost if exact sequence is present
          if (text.includes(targetQuery)) {
            exactScore += 0.5;
          }
        }
      }

      let similarityScore = 0;
      if (queryEmbedding) {
        const commentVec = this.embeddingProvider.generateEmbedding(c.body);
        similarityScore = this.embeddingProvider.cosineSimilarity(queryEmbedding, commentVec);
      }

      let combinedScore = 0;
      if (mode === 'exact') {
        combinedScore = exactScore;
      } else if (mode === 'similarity') {
        combinedScore = similarityScore;
      } else if (mode === 'fuzzy') {
        combinedScore = exactScore > 0 ? exactScore : similarityScore * 0.4;
      } else {
        // Hybrid: reciprocal rank weighting of keyword occurrence + subword similarity
        combinedScore = exactScore * 0.65 + Math.max(0, similarityScore) * 0.35;
      }

      // Filter non-matching results
      if (isExplicitPhrase && exactScore === 0) continue;
      if (mode === 'exact' && exactScore === 0) continue;
      if (mode === 'similarity' && similarityScore < 0.22) continue;
      if (mode === 'hybrid' && combinedScore < 0.12 && exactScore === 0) continue;

      scoredList.push({
        comment: c,
        exactScore,
        similarityScore,
        combinedScore
      });
    }

    // Sort scored comments
    scoredList.sort((a, b) => {
      if (req.sort_by === 'score') {
        return b.comment.score - a.comment.score;
      }
      if (req.sort_by === 'date') {
        const aDate = a.comment.created_utc || 0;
        const bDate = b.comment.created_utc || 0;
        return bDate - aDate;
      }
      if (req.sort_by === 'replies') {
        return b.comment.replies_count - a.comment.replies_count;
      }
      // Default relevance: combined score, then score tie-breaker
      if (Math.abs(b.combinedScore - a.combinedScore) > 0.05) {
        return b.combinedScore - a.combinedScore;
      }
      return b.comment.score - a.comment.score;
    });

    let rankingExplanation: string;
    if (mode === 'exact') {
      rankingExplanation = isExplicitPhrase
        ? `Exact phrase match: searching specifically for "${targetQuery}".`
        : `Exact keyword matching: filtered by term occurrence, ranked by match density.`;
    } else if (mode === 'similarity') {
      rankingExplanation = `Similarity search: ranked by ${this.embeddingProvider.name} cosine similarity (min threshold 0.22).`;
    } else {
      rankingExplanation = `Hybrid search: reciprocal fusion of keyword frequency (65%) and vector similarity (35%).`;
    }

    const results = scoredList.map(s => s.comment);
    const uniqueUsers = new Set(results.map(c => c.author).filter(a => a !== '[deleted]')).size;
    const offset = req.offset || 0;
    const limit = req.limit || 30;

    return {
      total_matches: results.length,
      unique_users: uniqueUsers,
      query_mode: mode,
      ranking_explanation: rankingExplanation,
      results: results.slice(offset, offset + limit)
    };
  }

  private static sortComments(
    comments: CommentSchema[],
    sortBy: 'relevance' | 'score' | 'date' | 'replies'
  ): CommentSchema[] {
    return [...comments].sort((a, b) => {
      if (sortBy === 'score') return b.score - a.score;
      if (sortBy === 'date') {
        const aDate = a.created_utc || 0;
        const bDate = b.created_utc || 0;
        return bDate - aDate;
      }
      if (sortBy === 'replies') return b.replies_count - a.replies_count;
      // Relevance defaults to upvotes + usefulness score
      return (b.score + b.usefulness_score * 40) - (a.score + a.usefulness_score * 40);
    });
  }
}
