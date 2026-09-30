# RedditDIG

<p align="center">
  <strong>Dig deeper into any Reddit thread.</strong><br>
  A production-ready Chrome Extension (MV3) for instant, local-first Reddit discussion intelligence, statistical consensus, vector similarity search, and citation-backed insights.
</p>

<p align="center">
  <a href="https://github.com/9mit/RedditDIG/actions/workflows/ci.yml"><img src="https://github.com/9mit/RedditDIG/actions/workflows/ci.yml/badge.svg" alt="CI Status" /></a>
  <img src="https://img.shields.io/badge/Manifest-V3-1d4ed8?style=flat-square&logo=googlechrome&logoColor=white" alt="Chrome MV3" />
  <img src="https://img.shields.io/badge/React-18.3-61dafb?style=flat-square&logo=react&logoColor=black" alt="React 18" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178c6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-6.1-646cff?style=flat-square&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Security-Audit%20Passed-15803d?style=flat-square&logo=shield&logoColor=white" alt="Security Audit Passed" />
  <img src="https://img.shields.io/badge/License-MIT-0f172a?style=flat-square" alt="License" />
</p>

---

## 💡 Overview

Long Reddit discussions often contain the most valuable real-world advice, product experiences, and troubleshooting fixes on the web—but extracting signal from hundreds of comments is painful.

**RedditDIG** solves this by analyzing the live DOM of any Reddit thread directly in your browser. It deterministically computes statistical consensus, extracts cited takeaways, classifies discussion heat, and unearths high-value "hidden gems" buried deep in reply branches.

### Why RedditDIG?
- 🔒 **100% Local & Private:** Runs entirely inside your browser's local sandbox. No data leaves your machine.
- ⚡ **Zero Cloud Costs or Rate Limits:** Powered by deterministic NLP and in-memory subword vector hashing.
- 🎯 **Never Hallucinates:** Every single claim and key takeaway cites the exact source comment and provides one-click jump-and-highlight navigation.
- 🛡️ **Zero API Keys Required:** Works out of the box on any Reddit post without requiring Reddit API keys or external LLM tokens.

---

## ✨ Core Features

### 1. Discussion Vibe (Conversational Temperature)
Quantifies the emotional climate of any thread on a **0.0 to 10.0 scale**, computed deterministically from multi-signal indicators (disagreement density, hostile vocabulary hits, and deep reply disputes):
- 🟢 **0.0 – 2.4 Calm:** Peaceful, friendly, and cooperative discussion.
- 🟡 **2.5 – 4.4 Constructive Debate:** Civil differences of opinion supported by personal experience or citations.
- 🟠 **4.5 – 6.4 Heated:** Spirited debate with sharp disagreements and polarizing points of view.
- 🔴 **6.5 – 10.0 Confrontational:** Elevated tension, adversarial exchanges, or hostile language.

### 2. True Statistical Consensus vs Plurality
Distinguishes between a true majority (>50% of distinct participants) and a loud minority by calculating:
- **User Share (%)** vs. **Comment Share (%)** to detect astroturfing or repetitive commenters.
- Net upvote-to-comment ratio signals.
- Direct factual contradiction detection pairing opposing claims.

### 3. Curated Comment Rankings & "Hidden Gems"
Filters through noise to identify:
- 💎 **Hidden Gems:** High-effort, substantive comments with positive scores buried deep in sub-branches (depth ≥ 2).
- 💡 **Best Proof:** Comments backed by personal experience, real-world benchmarks, or external references.
- ⚠️ **Heavily Disputed:** Highly contested suggestions where the community actively pushed back.
- 🔥 **Most Upvoted & Most Discussed:** Top community focal points.

### 4. Grounded "Ask This Thread" & Hybrid Search
- Ask natural language questions (*"What do people recommend?"*, *"What are the biggest complaints?"*).
- Sub-millisecond vector similarity and exact phrase search.
- Instant jump-to-comment navigation with temporary pulse highlighting in the active Reddit tab.

### 5. Participant Analytics & OP Tracker
- Tracks Original Poster (OP) engagement, answers acknowledged, and question resolution status (*Resolved*, *Likely resolved*, *Partially answered*, *Unresolved*).

---

## 🛠️ Tech Stack

- **Frontend & UI:** React 18, TypeScript, Lucide Icons, Custom CSS Design System (Royal Blue / Dark Slate / Pure White).
- **Extension Platform:** Chrome Extensions Manifest V3 (`sidePanel`, `activeTab`, `scripting`, `storage`).
- **Build Toolchain:** Vite 6, TypeScript Compiler (`tsc`).
- **Zero-Trust Security:** Custom static analysis security audit (`scripts/audit-production.mjs`).

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18.0.0 or higher
- npm 9.0.0 or higher
- Google Chrome (or any Chromium-based browser like Brave, Edge, Arc)

### Local Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/9mit/RedditDIG.git
   cd RedditDIG/extension
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the extension bundle:
   ```bash
   npm run build
   ```

### Loading the Extension in Chrome
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** using the toggle in the top-right corner.
3. Click **Load unpacked** in the top-left corner.
4. Select the `RedditDIG/extension/dist/` directory.
5. Navigate to any Reddit discussion (e.g. `https://www.reddit.com/r/technology/comments/...`).
6. Click the RedditDIG extension icon or press `Ctrl+Shift+L` (`Cmd+Shift+L` on macOS) to open the Side Panel!

---

## 🧪 Development Workflow

All development commands are executed inside the `extension/` directory:

| Command | Action |
| :--- | :--- |
| `npm run dev` | Starts Vite build in watch mode for development |
| `npm run build` | Runs TypeScript checks (`tsc`) and compiles the production bundle into `dist/` |
| `npm run typecheck` | Validates TypeScript types across the entire project (`tsc --noEmit`) |
| `npm test` | Runs the zero-trust production security audit |
| `npm run audit` | Runs the zero-trust security audit script scanning for keys, leaks, and remote URLs |
| `npm run verify` | Full verification pipeline: typecheck + security audit + production build |
| `npm run package` | Verifies and packages the extension into `redditdig-extension.zip` for Web Store release |

### 🤖 Continuous Integration (GitHub Actions)
All pull requests and commits to `main` are automatically validated by our [GitHub Actions CI Pipeline](.github/workflows/ci.yml) running on Node 20 LTS:
- Strict TypeScript compile check (`tsc --noEmit`)
- Production bundle build (`tsc && vite build`)
- Zero-trust security & secret leak audit (`audit-production.mjs`)
- Bundle integrity verification and automated `.zip` release artifact generation

---

## 📁 Repository Structure

```text
RedditDIG/
├── .github/
│   └── workflows/
│       └── ci.yml                 # Production CI/CD release gate workflow
├── .gitignore                     # Git ignore rules for MV3 & Vite
├── .env.example                   # Environment configuration template
├── ARCHITECTURE.md                # In-depth architectural & data-flow specification
├── CHANGELOG.md                   # Version release notes & history
├── CODE_OF_CONDUCT.md             # Contributor Covenant Code of Conduct
├── CONTRIBUTING.md                # Contribution guidelines and testing instructions
├── LICENSE                        # MIT Open Source License
├── PRIVACY.md                     # Privacy Policy and GDPR/CCPA statement
├── README.md                      # Primary project documentation
└── extension/                     # Chrome Extension Source
    ├── manifest.json              # Chrome MV3 manifest
    ├── package.json               # Package specification
    ├── sidepanel.html             # Extension side panel entry
    ├── popup.html                 # Extension icon popup entry
    ├── vite.config.ts             # Vite multi-bundle configuration
    ├── scripts/                   # Security audit scripts
    └── src/
        ├── background/            # MV3 service worker
        ├── components/            # React UI components
        ├── content/               # Reddit DOM adapters
        ├── services/              # Offline NLP, search, and statistical algorithms
        └── sidepanel/             # Side panel application
```

---

## 🔒 Security & Privacy

RedditDIG is designed from the ground up for strict privacy:
- **Zero Network Egress:** Analysis code never calls `fetch()`, `XMLHttpRequest`, or `WebSocket` to any external endpoint.
- **Zero Tracking or Telemetry:** No analytics scripts (PostHog, Google Analytics, Mixpanel, Sentry) are bundled.
- **Zero Stored Comments:** Reddit thread content is held only in volatile memory during the active session and is completely purged when the side panel is closed.
- **Strict Content Security Policy (CSP):** Prohibits `eval()`, inline scripts, and external font/script CDNs.

For full details, review [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md).

---

## 🗺️ Roadmap

- [x] Resilient multi-generation Reddit DOM extraction (`shreddit-comment`, new, old)
- [x] True statistical consensus & majority vs. plurality analysis
- [x] Discussion Vibe rating scale (0–10) with interactive explanation
- [x] Hidden Gem, Best Proof, and Heavily Disputed comment discovery
- [x] Sub-millisecond subword vector search & "Ask This Thread" Q&A
- [x] Dynamic text sanitization & out-of-frame overflow prevention
- [ ] Support for exporting discussion briefs as Markdown or PDF
- [ ] Optional local WebAssembly embedding model integration (ONNX / WebGPU)
- [ ] Multi-thread comparison mode

---

## 🤝 Contributing

Contributions are welcome! Please review [CONTRIBUTING.md](CONTRIBUTING.md) for local testing instructions, coding standards, and our pull request checklist.

---

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.
