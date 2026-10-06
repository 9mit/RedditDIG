// Discussion Text Sanitization & Extractive Normalization Engine
// Strips raw media URLs, markdown image/GIF tags, script/style injections,
// and ensures only clean, substantive human thoughts are highlighted and summarized.

/**
 * Strips raw media links, markdown artifacts, HTML, and trailing URLs from discussion text.
 */
export function sanitizeDiscussionText(str: string): string {
  if (!str) return '';

  return str
    // Remove script and style elements with their contents
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    // Remove remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Remove javascript: pseudo-protocols
    .replace(/javascript:/gi, '')
    // Decode common HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Remove markdown image / GIF tokens (including multiline): ![gif](url), ![img](url), etc.
    .replace(/!\[[\s\S]*?\]\([\s\S]*?\)/g, '')
    // Replace or strip markdown links [title](url):
    // If title is a URL, domain, or generic placeholder (image, gif, pic, link), strip the whole thing.
    // Otherwise keep the substantive title text.
    .replace(/\[([\s\S]*?)\]\((?:[^\s)]+)?\)/g, (_, linkText) => {
      const trimmed = linkText.trim();
      if (!trimmed) return '';
      if (/^(?:https?:\/\/|www\.|\S+\.(?:com|org|net|io|it|me|co))\b/i.test(trimmed)) return '';
      if (/(?:preview|i|v)\.redd\.it/i.test(trimmed)) return '';
      if (/\.(?:jpe?g|png|gif|webp|bmp|svg|mp4|webm)\b/i.test(trimmed)) return '';
      if (/^(?:image|img|gif|pic|photo|picture|video|link|source|here|click here)$/i.test(trimmed)) return '';
      return trimmed;
    })
    // Remove Reddit emote and giphy tokens: giphy|id, :snoo_*: , :emote_*:
    .replace(/\b(?:giphy|emote)\|[a-zA-Z0-9_|]+/gi, '')
    .replace(/:[a-zA-Z0-9_]{2,25}:/g, '')
    // Remove raw media URLs (with or without protocol)
    .replace(/(?:https?:\/\/)?(?:preview|i|v)\.redd\.it\/\S+/gi, '')
    .replace(/(?:https?:\/\/)?(?:media\d*\.giphy\.com|giphy\.com|i\.imgur\.com|imgur\.com)\/\S+/gi, '')
    // Remove standalone web URLs
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\bwww\.[a-zA-Z0-9_\-\.]+\.[a-zA-Z]{2,}\/\S*/gi, '')
    // Remove Reddit blockquotes (lines starting with >)
    .replace(/^>+\s*/gm, '')
    // Remove spoiler markdown markers >! and !<
    .replace(/>!|!</g, '')
    // Remove markdown headers
    .replace(/^#+\s+/gm, '')
    // Remove markdown formatting characters (*, _, ~, `)
    .replace(/[*_~`]/g, '')
    // Normalize newlines between sentences/paragraphs into period + space if missing punctuation
    .replace(/([a-zA-Z0-9])\n+([a-zA-Z0-9])/g, '$1. $2')
    // Normalize extra spaces and tabs
    .replace(/\s+/g, ' ')
    // Fix dangling colons, dashes, or semicolons at end of text (e.g. from stripped trailing media URLs)
    .replace(/\s*[:;\-–—]\s*$/g, '.')
    .trim();
}

/**
 * Checks if a string contains substantive human prose (at least minWords real words).
 */
export function isSubstantiveSentence(text: string, minWords = 3, minLen = 15): boolean {
  if (!text || text.length < minLen) return false;
  // Skip trivial social filler
  if (/^(thanks|thank you|upvoted|this|lol|haha|came here to say this|agreed|same)\b/i.test(text.trim())) {
    return false;
  }
  const words = text.toLowerCase().match(/[a-z]{2,}/g) || [];
  return words.length >= minWords;
}

/**
 * Splits text into clean, substantive sentences suitable for NLP summary & claims.
 */
export function extractCleanSentences(body: string, minLen = 15, maxLen = 400): string[] {
  const cleaned = sanitizeDiscussionText(body);
  if (!cleaned || cleaned.length < minLen) return [];

  // Split on punctuation followed by space
  const rawSentences = cleaned
    .split(/(?<=[.?!])\s+/)
    .map(s => s.trim())
    .filter(s => s.length >= minLen && s.length <= maxLen && isSubstantiveSentence(s));

  // If no punctuation split produced valid sentences but cleaned text itself is substantive and within bounds
  if (rawSentences.length === 0 && cleaned.length >= minLen && isSubstantiveSentence(cleaned)) {
    return [cleanSnippet(cleaned, maxLen)];
  }

  return rawSentences;
}

/**
 * Produces a clean, bounded snippet without breaking words or leaving trailing punctuation.
 */
export function cleanSnippet(text: string, maxLen = 140): string {
  const cleaned = sanitizeDiscussionText(text);
  if (!cleaned) return '';
  if (cleaned.length <= maxLen) return cleaned;

  // Trim to last word boundary before maxLen
  const truncated = cleaned.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(' ');
  const result = lastSpace > maxLen * 0.6 ? truncated.slice(0, lastSpace) : truncated;
  return `${result.replace(/[,;:\-\s–—\.]+\.?$/, '')}...`;
}
