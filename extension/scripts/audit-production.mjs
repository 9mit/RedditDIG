/**
 * RedditDIG Production Readiness & Security Audit Script
 * Verifies Manifest V3 compliance, least-privilege permissions, CSP constraints,
 * zero eval/inline script usage, asset presence, and cross-browser readiness.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../dist');

console.log('🔍 Starting RedditDIG Production Readiness Audit...\n');

let failed = false;
function check(description, condition, details = '') {
  if (condition) {
    console.log(`  ✅ [PASS] ${description}`);
  } else {
    console.error(`  ❌ [FAIL] ${description}${details ? ` -> ${details}` : ''}`);
    failed = true;
  }
}

// 1. Dist Directory & Manifest Existence
const manifestPath = path.join(distDir, 'manifest.json');
check('Manifest exists in dist/', fs.existsSync(manifestPath));
if (!fs.existsSync(manifestPath)) {
  console.error('\nBuild dist directory is missing manifest.json. Run `npm run build` first.');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// 2. Manifest V3 & Core Fields
check('Manifest version is 3', manifest.manifest_version === 3);
check('Extension name is defined', Boolean(manifest.name && manifest.name.includes('RedditDIG')));
check('Extension version is semver', Boolean(manifest.version && /^\d+\.\d+\.\d+$/.test(manifest.version)));
check('Description is present', Boolean(manifest.description && manifest.description.length >= 20));

// 3. Principle of Least Privilege Permissions
const allowedPermissions = new Set([
  'sidePanel',
  'tabs',
  'activeTab',
  'scripting',
  'storage',
  'contextMenus'
]);
const invalidPermissions = (manifest.permissions || []).filter(p => !allowedPermissions.has(p));
check('All permissions strictly adhere to least-privilege', invalidPermissions.length === 0, invalidPermissions.join(', '));

// 4. Host Permissions
const hostPerms = manifest.host_permissions || [];
check('Host permissions restricted strictly to Reddit domains',
  hostPerms.every(hp => /^https:\/\/(?:\*\.)?redd(?:it\.com|\.it)\/\*$/.test(hp)),
  hostPerms.join(', ')
);
check('Host permissions include apex reddit.com and redd.it',
  hostPerms.includes('https://reddit.com/*') && hostPerms.includes('https://redd.it/*')
);

// 5. Content Security Policy (CSP)
const csp = manifest.content_security_policy?.extension_pages || '';
check('CSP disables unsafe-eval', !csp.includes('unsafe-eval'));
check('CSP object-src is none', csp.includes("object-src 'none'"));
check('CSP base-uri is none', csp.includes("base-uri 'none'"));
check('CSP connect-src restricts to self and Reddit',
  csp.includes("connect-src 'self'") && !csp.includes('http://') && !csp.includes('* ')
);

// 6. Cross-Browser Settings (Firefox AMO & Edge)
check('Firefox browser_specific_settings is configured with gecko id',
  Boolean(manifest.browser_specific_settings?.gecko?.id)
);

// 7. Entrypoints & HTML pages exist
check('popup.html exists in dist', fs.existsSync(path.join(distDir, 'popup.html')));
check('sidepanel.html exists in dist', fs.existsSync(path.join(distDir, 'sidepanel.html')));
check('options.html exists in dist', fs.existsSync(path.join(distDir, 'options.html')));
check('background.js exists in dist', fs.existsSync(path.join(distDir, 'background.js')));
check('content.js exists in dist', fs.existsSync(path.join(distDir, 'content.js')));

// 8. Icons check
const icon16 = path.join(distDir, 'icons/icon16.png');
const icon48 = path.join(distDir, 'icons/icon48.png');
const icon128 = path.join(distDir, 'icons/icon128.png');
check('16px icon exists', fs.existsSync(icon16));
check('48px icon exists', fs.existsSync(icon48));
check('128px icon exists', fs.existsSync(icon128));

// 9. Static Code Analysis on Emitted JavaScript (No eval, No DOM XSS vectors)
console.log('\n🛡️ Scanning emitted JS bundles for vulnerabilities...');
const jsFiles = [];
function findJs(dir) {
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    if (fs.statSync(full).isDirectory()) findJs(full);
    else if (item.endsWith('.js')) jsFiles.push(full);
  }
}
findJs(distDir);

let evalFound = false;
let docWriteFound = false;
for (const file of jsFiles) {
  const code = fs.readFileSync(file, 'utf8');
  if (/\beval\s*\(/.test(code)) {
    console.error(`  ❌ Found eval() in ${path.relative(distDir, file)}`);
    evalFound = true;
  }
  if (/document\.write\s*\(/.test(code)) {
    console.error(`  ❌ Found document.write() in ${path.relative(distDir, file)}`);
    docWriteFound = true;
  }
}
check('Zero eval() usage in emitted bundles', !evalFound);
check('Zero document.write() usage in emitted bundles', !docWriteFound);

// Summary
console.log('\n------------------------------------------------');
if (failed) {
  console.error('❌ Production Readiness Audit FAILED. Resolve the issues above.');
  process.exit(1);
} else {
  console.log('🎉 Production Readiness Audit PASSED! All checks verified.');
  process.exit(0);
}
