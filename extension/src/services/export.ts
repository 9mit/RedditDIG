// RedditDIG - Thread Intelligence Export Service
// Supports exporting thread analysis as publication-ready Markdown, structured JSON,
// file downloads via DOM Blob URLs, and reliable clipboard copy.

import { ThreadIntelligenceEnvelope } from '../types';

/**
 * Converts a ThreadIntelligenceEnvelope into a clean, human-readable Markdown report.
 */
export function exportThreadAsMarkdown(thread: ThreadIntelligenceEnvelope): string {
  const lines: string[] = [];

  // Header & Metadata
  lines.push(`# RedditDIG Report: ${thread.title}`);
  lines.push('');
  lines.push(`- **Subreddit:** r/${thread.subreddit}`);
  lines.push(`- **Thread URL:** ${thread.url}`);
  lines.push(`- **Original Poster (OP):** u/${thread.author}`);
  lines.push(`- **Post Score:** ${thread.score > 0 ? `+${thread.score}` : thread.score} (${Math.round(thread.upvote_ratio * 100)}% upvoted)`);
  lines.push(`- **Comments Analyzed:** ${thread.total_analyzed.toLocaleString()} from ${thread.unique_participants.toLocaleString()} unique participants`);
  if (thread.coverage) {
    lines.push(`- **Coverage:** ${thread.coverage.coverage_percentage}% (${thread.coverage.explanation})`);
  }
  lines.push(`- **Discussion Vibe:** ${thread.temperature.score}/10 (${thread.temperature.label})`);
  lines.push(`- **Verdict / Consensus:** ${thread.consensus.label}`);
  lines.push('');

  // 1. Executive Summary
  if (thread.summary && thread.summary.overview) {
    lines.push('## Executive Summary');
    lines.push('');
    lines.push(thread.summary.overview);
    lines.push('');

    if (thread.summary.key_takeaways?.length > 0) {
      lines.push('### Key Takeaways');
      lines.push('');
      for (const t of thread.summary.key_takeaways) {
        lines.push(`- ${t.text}`);
      }
      lines.push('');
    }

    if (thread.summary.what_agree_on?.length > 0) {
      lines.push('### What the Community Agrees On');
      lines.push('');
      for (const a of thread.summary.what_agree_on) {
        lines.push(`- ${a.text}`);
      }
      lines.push('');
    }

    if (thread.summary.what_disagree_on?.length > 0) {
      lines.push('### Points of Friction & Disagreement');
      lines.push('');
      for (const d of thread.summary.what_disagree_on) {
        lines.push(`- ${d.text}`);
      }
      lines.push('');
    }

    if (thread.summary.unresolved_questions?.length > 0) {
      lines.push('### Unanswered Community Questions');
      lines.push('');
      for (const q of thread.summary.unresolved_questions) {
        lines.push(`- ${q.text}`);
      }
      lines.push('');
    }
  }

  // 2. Community Viewpoints & Breakdown
  if (thread.viewpoints?.length > 0) {
    lines.push('## Community Viewpoints Breakdown');
    lines.push('');
    lines.push(`> ${thread.consensus.rationale}`);
    lines.push('');
    for (const vp of thread.viewpoints) {
      const tag = vp.is_majority ? ' [Clear Majority]' : vp.is_plurality ? ' [Top Pick]' : '';
      lines.push(`### ${vp.label}${tag}`);
      lines.push(`- **Share of Participants:** ${vp.user_share}% (${vp.unique_users} people)`);
      lines.push(`- **Comments Volume:** ${vp.comments_count} comments (${vp.comment_share}% of thread)`);
      lines.push(`- **Average Score:** ${vp.median_score > 0 ? `+${vp.median_score}` : vp.median_score}`);
      if (vp.strongest_supporting_arg) {
        lines.push(`- **Strongest Point:** "${vp.strongest_supporting_arg}"`);
      }
      lines.push('');
    }
  }

  // 3. Vertical Insights & Recommendations
  if (thread.vertical_insights?.is_specialized) {
    const vi = thread.vertical_insights;
    lines.push(`## ${vi.category} Intelligence`);
    lines.push('');
    if (vi.recommendations?.length > 0) {
      lines.push('### Top Recommendations');
      for (const r of vi.recommendations) {
        lines.push(`- **${r.text}** (Score: ${r.score > 0 ? `+${r.score}` : r.score})`);
      }
      lines.push('');
    }
    if (vi.pros?.length > 0) {
      lines.push('### Community Pros');
      for (const p of vi.pros) lines.push(`- ${p.text}`);
      lines.push('');
    }
    if (vi.cons?.length > 0) {
      lines.push('### Community Cons / Drawbacks');
      for (const c of vi.cons) lines.push(`- ${c.text}`);
      lines.push('');
    }
    if (vi.alternatives?.length > 0) {
      lines.push('### Alternatives Mentioned');
      for (const alt of vi.alternatives) lines.push(`- ${alt.text}`);
      lines.push('');
    }
  }

  // 4. Direct Disagreements / Contradictions
  if (thread.contradictions?.length > 0) {
    lines.push('## Direct Disagreements');
    lines.push('');
    for (const c of thread.contradictions) {
      lines.push(`### Topic: ${c.topic}`);
      lines.push(`- **Side A:** ${c.claim_a}`);
      lines.push(`- **Side B:** ${c.claim_b}`);
      lines.push('');
    }
  }

  // 5. Curated Comment Highlights
  if (thread.rankings) {
    const r = thread.rankings;
    lines.push('## Curated Highlights');
    lines.push('');
    if (r.most_popular) {
      lines.push(`- **Most Upvoted Comment:** u/${r.most_popular.author} (+${r.most_popular.score}): "${r.most_popular.body.slice(0, 150)}..."`);
    }
    if (r.best_supported) {
      lines.push(`- **Best Proof / Evidence:** u/${r.best_supported.author} (+${r.best_supported.score}): "${r.best_supported.body.slice(0, 150)}..." (${r.best_supported_reason})`);
    }
    if (r.hidden_gem) {
      lines.push(`- **Hidden Gem (Buried in replies):** u/${r.hidden_gem.author} (+${r.hidden_gem.score}): "${r.hidden_gem.body.slice(0, 150)}..." (${r.hidden_gem_reason})`);
    }
    if (r.questionable_suggestion) {
      lines.push(`- **Heavily Disputed:** u/${r.questionable_suggestion.author} (${r.questionable_suggestion.score}): "${r.questionable_suggestion.body.slice(0, 150)}..." (${r.questionable_reason})`);
    }
    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push('*Generated 100% locally by [RedditDIG](https://github.com/9mit/RedditDIG) — Zero cloud egress, zero saved data.*');

  return lines.join('\n');
}

/**
 * Converts a ThreadIntelligenceEnvelope into formatted JSON string.
 */
export function exportThreadAsJson(thread: ThreadIntelligenceEnvelope): string {
  return JSON.stringify(thread, null, 2);
}

/**
 * Initiates an in-browser download of text content as a file without requiring extra extension permissions.
 */
export function downloadFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  setTimeout(() => {
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, 200);
}

/**
 * Copies text to clipboard using navigator.clipboard with fallback for restricted contexts.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below
    }
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch {
    return false;
  }
}
