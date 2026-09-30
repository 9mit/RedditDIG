# Security Policy for RedditDIG

The RedditDIG maintainers take the security and privacy of our software seriously. Because RedditDIG is designed as a **100% local-first, privacy-by-design extension**, our security model is engineered defensively to protect users against data exfiltration, cross-site scripting (XSS), and malicious page injections.

---

## 🛡️ Supported Versions

Only the latest release on the `main` branch is actively supported with security updates.

| Version | Supported |
| :--- | :--- |
| `1.0.x` | ✅ Yes |
| `< 1.0.0` | ❌ No |

---

## 🔒 Security Architecture Model

1. **Zero Remote Egress:**
   RedditDIG contains no backend server, no proxy gateways, and zero network calls to external APIs. Analysis is performed purely in volatile browser memory.
2. **Strict Content Security Policy (CSP):**
   Our Chrome Extension Manifest V3 configuration enforces:
   ```json
   "content_security_policy": {
     "extension_pages": "script-src 'self'; object-src 'self'; connect-src 'self' https://*.reddit.com https://reddit.com;"
   }
   ```
   This prevents the execution of remote scripts, eval, or connections to unauthorized remote hosts.
3. **Rigorous Input Sanitization (`sanitizer.ts`):**
   All Reddit comment text extracted from the DOM is processed through a multi-pass sanitizer that strips:
   - `<script>`, `<style>`, and HTML markup
   - `javascript:` pseudo-protocols
   - Markdown image/GIF embeds and raw media URLs (`![gif](...)`, `preview.redd.it`)
   - Unsafe prompt injection artifacts
4. **Automated Static Security Audit (`audit-production.mjs`):**
   Prior to packaging, our automated verification pipeline scans all source files and compiled bundles to ensure:
   - Zero hardcoded API keys or secrets (`gsk_...`, OpenAI keys, AWS keys)
   - Zero remote AI URLs or third-party telemetry endpoints
   - Zero insecure `console.log` statements leaking private variables

---

## 🚨 Reporting a Vulnerability

If you discover a security vulnerability in RedditDIG, please report it privately:

1. **Do NOT report security vulnerabilities via public GitHub issues.**
2. Send an email to **Naumit Agarwal** at `naumit.agarwal@gmail.com` with:
   - A description of the issue and potential impact
   - Detailed reproduction steps or proof-of-concept
   - Affected browser version and operating system
3. You will receive an initial response within **48 hours** confirming receipt of your report.
4. We will coordinate a remediation timeline and release a patch via a standard semantic version update.
