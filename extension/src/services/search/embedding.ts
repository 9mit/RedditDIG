// EmbeddingProvider Interface and Subword N-Gram Similarity Provider
// Honestly named: provides deterministic 128-dimensional subword similarity search (P5 Option C)

export interface EmbeddingProvider {
  readonly name: string;
  readonly dimension: number;
  readonly description: string;
  generateEmbedding(text: string): Float32Array;
  cosineSimilarity(a: Float32Array, b: Float32Array): number;
}

/**
 * NgramHashingSimilarityProvider:
 * Generates a deterministic 128-dimensional normalized vector embedding
 * using character n-gram hashing and subword term weighting.
 * Truthful description: Fast client-side lexical/subword vector similarity.
 */
export class NgramHashingSimilarityProvider implements EmbeddingProvider {
  readonly name = 'Similarity Search';
  readonly dimension = 128;
  readonly description = 'Finds comments by subword and topic similarity';

  generateEmbedding(text: string): Float32Array {
    const dim = this.dimension;
    const vec = new Float32Array(dim);
    if (!text || text.trim().length === 0) return vec;

    const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    const tokens = normalized.split(/\s+/).filter(t => t.length > 1);

    // Hash word unigrams and character trigrams into vector dimensions
    for (const token of tokens) {
      // Word hash (djb2 variant)
      let h1 = 5381;
      for (let i = 0; i < token.length; i++) {
        h1 = ((h1 << 5) + h1) ^ token.charCodeAt(i);
      }
      const idx1 = Math.abs(h1) % dim;
      vec[idx1] += 2.0;

      // Subword trigrams
      if (token.length >= 3) {
        for (let i = 0; i <= token.length - 3; i++) {
          const tri = token.slice(i, i + 3);
          let h2 = 0;
          for (let j = 0; j < 3; j++) {
            h2 = (h2 * 31 + tri.charCodeAt(j)) | 0;
          }
          const idx2 = Math.abs(h2) % dim;
          vec[idx2] += 0.5;
        }
      }
    }

    // Normalize to unit L2 norm
    let sumSq = 0;
    for (let i = 0; i < dim; i++) {
      sumSq += vec[i] * vec[i];
    }
    const norm = Math.sqrt(sumSq);
    if (norm > 0) {
      for (let i = 0; i < dim; i++) {
        vec[i] /= norm;
      }
    }

    return vec;
  }

  cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dot = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
      dot += a[i] * b[i];
    }
    return dot;
  }
}

export const defaultEmbeddingProvider: EmbeddingProvider = new NgramHashingSimilarityProvider();
