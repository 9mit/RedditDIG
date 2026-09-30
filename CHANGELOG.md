# Changelog

All notable changes to **RedditDIG** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.1] - 2026-09-30

### Fixed & Enhanced
- **Most Awarded Comment Localization & Navigation:**
  - Robust award extraction supporting single-award buttons without count digits, shadow root action rows, and kebab-case `thing-id` comment elements.
  - Multi-phase layout-shift compensation and shadow root host piercing in `scrollToAndHighlight`, automatically expanding collapsed Lit elements and scrolling target into view.
  - Canonical permalink fallback ensuring comments inside deeply truncated sub-trees load cleanly.
- **Direct Disagreements & Contradiction Detection Engine:**
  - Dynamic entity clash detection across general threads, gaming, programming, camera, keyboard, and audio domains.
  - Comprehensive natural rebuttal pattern matching (standalone pushbacks, dead-wrong rebuttals, contrastive rebuttal markers).
  - General thread debate clustering fallback surfacing opposing viewpoints even when predefined hardware topics are absent.
  - Expanded test coverage to 120 automated test cases with 100% pass rate.

## [1.0.0] - 2026-09-29

### Added
- **Discussion Vibe (Conversational Temperature) Rating:**
  - Deterministic 0.0–10.0 scale quantifying thread emotional climate and tension.
  - Multi-signal calculation: 40% hostility markers, 40% disagreement density, 20% deep reply disputes.
  - Interactive user-facing Vibe Guide in Quick Stats and Discussion Breakdown explaining the 4 tiers (Calm, Constructive Debate, Heated, Confrontational).
- **Comprehensive Discussion Text Sanitizer (`sanitizer.ts`):**
  - Multi-pass sanitization stripping markdown image/GIF tokens (`![gif](...)`, `![img](...)`), raw preview URLs (`preview.redd.it`, `i.redd.it`), and trailing link artifacts.
  - Substantive sentence filtering ensuring only genuine human prose is selected for takeaways and overviews.
  - Word-boundary-aware snippet generator (`cleanSnippet`).
- **Card Overflow & Layout Frame Bounds:**
  - Implemented `word-break: break-word`, `overflow-wrap: anywhere`, and `min-width: 0` across cards, card headers, and summary containers to prevent out-of-frame text leaks.
- **Hidden Gem Discovery Intelligence:**
  - Discovers high-effort, well-reasoned comments buried deep in comment hierarchies (depth ≥ 2) with positive scores.
- **Statistical Consensus & Verdict Engine:**
  - Distinguishes between true majority (>50% user share) and plurality viewpoints.
  - Analyzes user share vs. comment share to detect astroturfing.
- **Citation-Grounded "Ask This Thread" Q&A:**
  - Subword n-gram vector embeddings and keyword matching for fast, local in-memory question answering.
- **Zero-Trust Security Verification:**
  - Pre-commit static audit (`audit-production.mjs`) scanning for embedded API keys, mock data, and remote URLs.
  - Comprehensive 77-test Vitest suite covering edge cases, large-thread scalability (1,000+ comments), and failure isolation.
- **Open-Source Professionalization:**
  - Added `ARCHITECTURE.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, and updated `PRIVACY.md` with GDPR/CCPA disclosures.
- **GitHub Actions CI/CD Release Pipeline (`.github/workflows/ci.yml`):**
  - Fully automated release gate running clean npm install, TypeScript compilation (`tsc --noEmit`), Vitest suite (77 tests), zero-trust security audit, production Vite build, bundle integrity validation, and release artifact generation.
- **Cross-Platform Extension Packager (`package-extension.mjs`):**
  - OS-agnostic packaging script producing `redditdig-extension.zip` seamlessly across Windows, macOS, and Linux runners.

### Changed
- Refactored `LocalSummaryEngine`, `LocalContradictionDetector`, `LocalAskThreadEngine`, and `DiscussionAnalyzer` to use centralized `sanitizer.ts`.
- Enhanced Sidepanel Quick Stats bar with interactive Vibe cell, dynamic color coding, and quick-toggle breakdown.
- Polished Design System with crisp dark slate borders, Royal Blue accents, and high-contrast typography.

### Removed
- Removed unused dead-code service `local_model.ts`.
- Removed unused dependencies `clsx` and `puppeteer-core` from `package.json`.
- Removed redundant, duplicate text cleaning logic across services.
