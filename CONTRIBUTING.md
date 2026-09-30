# Contributing to RedditDIG

Thank you for your interest in contributing to **RedditDIG**! As an open-source, privacy-first project, we value contributions from developers of all skill levels.

---

## 📜 Code of Conduct

All contributors and participants are expected to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md). Please keep discussions constructive, respectful, and focused on building great software.

---

## 🛠️ Development Setup

### 1. Prerequisites
- **Node.js**: v18.0.0+
- **npm**: v9.0.0+
- **Google Chrome** (or Chromium-based browser)

### 2. Getting the Code
```bash
git clone https://github.com/9mit/RedditDIG.git
cd RedditDIG/extension
npm install
```

### 3. Local Commands
Inside the `extension/` directory:
- `npm run dev`: Build with watch mode for active iteration.
- `npm run build`: Compile TypeScript and build production bundle into `dist/`.
- `npm run typecheck`: Run strict TypeScript validation (`tsc --noEmit`).
- `npm test`: Run the zero-trust static security audit.
- `npm run audit`: Run the zero-trust static security audit.
- `npm run verify`: Run the complete pre-commit verification pipeline (`typecheck && audit && build`).
- `npm run package`: Build and package the extension into `redditdig-extension.zip`.

### 4. Loading the Extension in Chrome
1. Navigate to `chrome://extensions/`.
2. Toggle on **Developer mode** in the upper right.
3. Click **Load unpacked** and select `RedditDIG/extension/dist/`.
4. After making changes, run `npm run build` and click the reload icon on the extension card in `chrome://extensions/`.

---

## 📐 Engineering Principles

1. **Zero Remote Egress:** Core analysis algorithms must run 100% locally. Never add external network requests, remote analytics SDKs, or cloud LLM dependencies.
2. **Defensive Input Sanitization:** Never assume Reddit comment HTML or markdown is safe. Always pass discussion text through `sanitizeDiscussionText` to prevent script injections and layout overflows.
3. **Citation Grounding:** Any extractive summary, answer, or insight must link to the originating Reddit comment ID for verification.
4. **Resilient DOM Adapters:** Reddit frequently tests new web component layouts. Test DOM extraction changes against modern Reddit (`shreddit-comment`), new Reddit, and `old.reddit.com`.
5. **Layout Bounds:** Keep UI components bounded (`min-width: 0`, `overflow-wrap: anywhere`, `word-break: break-word`) to prevent text from overflowing card frames.

---

## 🛡️ Verification Guidelines

- All PRs must pass the full verification gate:
  ```bash
  npm run verify
  ```
- All code must pass zero-trust static security audit and strict TypeScript compilation with zero errors.

---

## 🔀 Pull Request Process

1. Fork the repository and create your feature branch:
   ```bash
   git checkout -b feature/my-new-feature
   ```
2. Commit your changes following Conventional Commits format:
   ```bash
   git commit -m "feat(insights): add multi-tier vibe rating explanation"
   ```
3. Run verification to ensure zero lint or test failures:
   ```bash
   npm run verify
   ```
4. Push your branch and open a Pull Request against the `main` branch. GitHub Actions CI will automatically run typechecking, all 77 tests, the static security audit, Vite build, and package verification.
5. In your PR description, explain:
   - The motivation behind the change.
   - Any edge cases tested.
   - Verification steps taken (with screenshots if UI changes were made).

---

## 📬 Questions or Feedback?

Feel free to open an issue on GitHub or reach out to maintainers via GitHub Discussions!
