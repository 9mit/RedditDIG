# Privacy Policy & Legal Documentation for RedditDIG

**Last Updated:** September 29, 2026  
**Effective Date:** September 29, 2026  

---

## 1. Executive Summary & Privacy-First Architecture

**RedditDIG** ("we", "our", or "the extension") is a developer-focused, open-source Chrome Extension designed to extract structured qualitative intelligence from Reddit discussions. We adhere strictly to the principle of **privacy by design** and **radical data minimization**:

1. **100% Local Processing:** Every computation, extractive summarization, statistical calculation, and vector search query runs entirely inside your browser's local sandbox.
2. **Zero Remote Egress:** RedditDIG sends **zero bytes** of thread data, user queries, or metadata to external servers, cloud databases, or third-party LLMs.
3. **Zero Tracking & Telemetry:** We do not embed analytics SDKs (no PostHog, Google Analytics, Mixpanel, Amplitude, or Sentry).
4. **Zero Account Required:** RedditDIG requires no user registration, email, or credentials.

---

## 2. What Data We Access

RedditDIG accesses page content **only upon explicit user action** (opening the Side Panel or clicking "Dig Into Thread"):

- **Public Discussion Content Rendered in the Active Tab:**
  - Post metadata: title, author username, selftext, subreddit name, and post URL.
  - Rendered comments: author username, comment body text, upvote score, timestamp, and permalink.
- **Data We NEVER Access or Collect:**
  - Reddit passwords, account credentials, or login tokens.
  - Private messages, chat logs, or account settings.
  - Browsing history, bookmarks, or cookies.
  - Content from any other browser tab or domain.
  - Personal Identifiable Information (PII) such as IP addresses, real names, emails, or location.

---

## 3. Cookie Usage & Tracking Disclosure

- **Zero Cookies:** RedditDIG does **not** create, read, store, or transmit any HTTP cookies, tracking pixels, local storage tracking identifiers, or browser fingerprints.
- **Zero Third-Party Advertising:** RedditDIG contains no advertisements and does not share any data with advertising networks or data brokers.

---

## 4. Data Storage & Retention Policy

RedditDIG utilizes a strictly volatile, database-free architecture:

| Data Type | Storage Location | Retention Lifetime | Purpose |
| :--- | :--- | :--- | :--- |
| **Thread Comments & Analysis** | Volatile JavaScript memory (React state) | Session only (wiped immediately when tab or panel is closed) | Real-time analysis and visualization |
| **User UI Preferences** | `chrome.storage.local` (Client device only) | Persistent until cleared by user | Saves harmless settings: UI theme, max comment expansion limit, auto-analysis toggle |
| **Search Queries & Q&A** | Volatile in-memory vector cache | Ephemeral (wiped on reload) | In-memory similarity matching |

Users can instantly reset all preferences and purge local extension storage at any time via the **Settings Modal → Reset All Settings**.

---

## 5. Third-Party Services Disclosure

RedditDIG operates completely offline and maintains **zero connections** to third-party services:
- **No Cloud AI APIs:** No connections to OpenAI, Anthropic, Groq, or AWS.
- **No Remote Proxies or Gateways:** No connection to external hosting gateways (e.g. Vercel, Netlify).
- **No Remote Font or Style CDNs:** Fonts and assets are bundled locally into the extension package to comply with strict Content Security Policy (CSP) guidelines.

---

## 6. Regulatory Compliance (GDPR, CCPA / CPRA)

### 6.1 General Data Protection Regulation (GDPR)
Under the European Union General Data Protection Regulation (GDPR):
- **Data Minimization (Article 5(1)(c)):** RedditDIG processes only the data strictly necessary to render discussion summaries locally.
- **Right to Erasure & Right of Access (Articles 15 & 17):** Because we collect, store, and transmit zero personal data to any server, there is no remote data repository to access or erase. All in-browser data is erased instantly upon closing the browsing session.

### 6.2 California Consumer Privacy Act (CCPA / CPRA)
Under the California Consumer Privacy Act:
- **No Sale of Personal Information:** RedditDIG does not sell, rent, release, disclose, disseminate, make available, or transfer personal information to third parties for monetary or other valuable consideration.
- **Right to Opt-Out:** Because zero personal information is collected or shared, users enjoy complete privacy by default.

---

## 7. Chrome Extension Manifest V3 Permissions Justification

In accordance with Google Chrome Web Store Single-Purpose and Data Minimization policies, RedditDIG requests only the minimal necessary permissions:

| Permission | Purpose & Scope |
| :--- | :--- |
| `activeTab` | Grants temporary access to read rendered comment elements on the active Reddit tab only when invoked by the user. |
| `sidePanel` | Allows displaying the intelligence interface directly adjacent to the Reddit discussion without obstructing page reading. |
| `storage` | Enables `chrome.storage.local` to remember user configuration preferences (theme, comment expansion limits) on the local device. |
| `scripting` | Executes the content script adapter to extract rendered DOM nodes and scroll to highlighted source comments when clicked. |
| `tabs` | Listens for tab activation and URL changes to determine if the active tab is a Reddit discussion thread. |

---

## 8. Children's Online Privacy Protection (COPPA)

RedditDIG does not knowingly collect or solicit any personal information from children under the age of 13. The extension functions purely as an in-browser analysis tool for publicly visible Reddit posts.

---

## 9. Contact & Inquiries

For questions, security disclosures, or legal inquiries regarding RedditDIG's data practices, please contact the maintainers or open an issue:

- **GitHub Issues:** [https://github.com/9mit/RedditDIG/issues](https://github.com/9mit/RedditDIG/issues)  
- **Maintainer:** Naumit Agarwal (`naumit.agarwal@gmail.com`)  
- **Project Repository:** [https://github.com/9mit/RedditDIG](https://github.com/9mit/RedditDIG)  
