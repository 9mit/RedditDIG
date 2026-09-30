// Production Security & Real-Data Static Audit Script (P27)
// Scans runtime source code (src/) and production bundle (dist/) for:
// - Embedded API keys or secrets (gsk_...)
// - Runtime mock/fake/demo data
// - Unsafe console.log of secrets

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const srcDir = path.resolve(rootDir, 'src');
const distDir = path.resolve(rootDir, 'dist');

console.log('[AUDIT] Starting RedditDIG Production Security & Real-Data Static Audit...\n');

let violations = [];

// Prohibited runtime patterns (Directive Section 51 & 52 Zero-Trust Audit)
const FORBIDDEN_RUNTIME_PATTERNS = [
  { pattern: /gsk_[a-zA-Z0-9]{20,}/g, name: 'Developer Groq API Key embedded' },
  { pattern: /\bDEMO_MODE\b/g, name: 'DEMO_MODE flag in runtime code' },
  { pattern: /\bfakeData\b/g, name: 'fakeData object in runtime code' },
  { pattern: /\bmockData\b/g, name: 'mockData object in runtime code' },
  { pattern: /\bsampleComments\b/g, name: 'sampleComments fixture in runtime code' },
  { pattern: /console\.log\(.*(key|secret|password|token|gsk_).*\)/gi, name: 'console.log printing secrets' },
  { pattern: /https?:\/\/.*:[0-9]+@/g, name: 'URL with embedded credentials' },
  { pattern: /https?:\/\/[a-zA-Z0-9_.-]*vercel\.app/gi, name: 'Prohibited remote Vercel gateway URL' },
  { pattern: /https?:\/\/api\.groq\.com/gi, name: 'Prohibited remote Groq API URL' },
  { pattern: /https?:\/\/api\.openai\.com/gi, name: 'Prohibited remote OpenAI URL' },
  { pattern: /https?:\/\/fonts\.(googleapis|gstatic)\.com/gi, name: 'Prohibited remote font network dependency' },
  { pattern: /@import\s+url\(['"]?https?:/gi, name: 'Prohibited remote CSS import' },
  { pattern: /\b(posthog|mixpanel|sentry\.io|amplitude\.com)\b/gi, name: 'Prohibited third-party telemetry SDK' }
];

function scanDirectory(dir, isRuntime) {
  if (!fs.existsSync(dir)) return;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip test directories during runtime scan
      if (entry.name === 'test' || entry.name === '__tests__' || entry.name === 'node_modules') {
        continue;
      }
      scanDirectory(fullPath, isRuntime);
    } else if (entry.isFile()) {
      // Skip test files
      if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx') || entry.name.endsWith('.spec.ts')) {
        continue;
      }

      // Check extensions
      if (!/\.(ts|tsx|js|mjs|html|json|css)$/.test(entry.name)) {
        continue;
      }

      const content = fs.readFileSync(fullPath, 'utf8');

      for (const rule of FORBIDDEN_RUNTIME_PATTERNS) {
        rule.pattern.lastIndex = 0;
        const match = rule.pattern.exec(content);
        if (match) {
          const lines = content.slice(0, match.index).split('\n');
          const lineNum = lines.length;
          violations.push({
            file: path.relative(rootDir, fullPath),
            line: lineNum,
            rule: rule.name,
            snippet: match[0].slice(0, 40)
          });
        }
      }
    }
  }
}

// 1. Scan src/
scanDirectory(srcDir, true);

// 2. Scan dist/ if present
if (fs.existsSync(distDir)) {
  console.log('[SCAN] Scanning production dist/ bundle...');
  scanDirectory(distDir, false);
}

// Results
if (violations.length > 0) {
  console.error(`\n[FAIL] AUDIT FAILED: Found ${violations.length} prohibited pattern(s):\n`);
  for (const v of violations) {
    console.error(`  - [${v.rule}] in ${v.file}:${v.line} -> "${v.snippet}"`);
  }
  console.error('\nPlease remove all hardcoded keys, fake data, or unsafe logs before building for production.');
  process.exit(1);
} else {
  console.log('[PASS] AUDIT PASSED: Zero embedded API keys, zero runtime fake data, zero secret leaks detected.');
  process.exit(0);
}
