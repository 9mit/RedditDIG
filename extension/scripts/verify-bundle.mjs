// Production Unpacked Extension Bundle Integrity Verification Script
// Verifies that extension/dist contains a valid, complete Google Chrome MV3 unpacked extension.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionDir = path.resolve(__dirname, '..');
const distDir = path.join(extensionDir, 'dist');

console.log('[VERIFY-BUNDLE] Verifying Chrome MV3 unpacked extension in dist/...\n');

const errors = [];
const warnings = [];

// 1. Verify dist/ folder existence
if (!fs.existsSync(distDir)) {
  console.error('[FAIL] dist/ directory does not exist! Please run "npm run build" first.');
  process.exit(1);
}

// 2. Verify manifest.json
const manifestPath = path.join(distDir, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
  errors.push('Missing dist/manifest.json - Chrome will fail with "Could not load manifest"');
} else {
  try {
    const raw = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(raw);

    if (manifest.manifest_version !== 3) {
      errors.push(`Expected manifest_version 3, got: ${manifest.manifest_version}`);
    }

    if (!manifest.name || typeof manifest.name !== 'string') {
      errors.push('Manifest missing required "name" string');
    }

    if (!manifest.version || typeof manifest.version !== 'string') {
      errors.push('Manifest missing required "version" string');
    }

    // Verify background service worker
    if (manifest.background?.service_worker) {
      const swPath = path.join(distDir, manifest.background.service_worker);
      if (!fs.existsSync(swPath) || fs.statSync(swPath).size === 0) {
        errors.push(`Background service worker missing or empty: ${manifest.background.service_worker}`);
      }
    } else {
      warnings.push('No background service_worker declared in manifest.');
    }

    // Verify content scripts
    if (Array.isArray(manifest.content_scripts)) {
      for (const cs of manifest.content_scripts) {
        if (Array.isArray(cs.js)) {
          for (const jsFile of cs.js) {
            const jsPath = path.join(distDir, jsFile);
            if (!fs.existsSync(jsPath) || fs.statSync(jsPath).size === 0) {
              errors.push(`Content script JS missing or empty: ${jsFile}`);
            }
          }
        }
        if (Array.isArray(cs.css)) {
          for (const cssFile of cs.css) {
            const cssPath = path.join(distDir, cssFile);
            if (!fs.existsSync(cssPath) || fs.statSync(cssPath).size === 0) {
              errors.push(`Content script CSS missing or empty: ${cssFile}`);
            }
          }
        }
      }
    }

    // Verify web accessible resources
    if (Array.isArray(manifest.web_accessible_resources)) {
      for (const war of manifest.web_accessible_resources) {
        if (Array.isArray(war.resources)) {
          for (const res of war.resources) {
            if (res.endsWith('/*')) {
              const resDir = path.join(distDir, res.slice(0, -2));
              if (!fs.existsSync(resDir) || !fs.statSync(resDir).isDirectory()) {
                errors.push(`Web accessible resource directory missing: ${res}`);
              }
            } else {
              const resPath = path.join(distDir, res);
              if (!fs.existsSync(resPath) || fs.statSync(resPath).size === 0) {
                errors.push(`Web accessible resource missing or empty: ${res}`);
              }
            }
          }
        }
      }
    }

    // Verify side panel
    if (manifest.side_panel?.default_path) {
      const spPath = path.join(distDir, manifest.side_panel.default_path);
      if (!fs.existsSync(spPath) || fs.statSync(spPath).size === 0) {
        errors.push(`Side panel HTML missing or empty: ${manifest.side_panel.default_path}`);
      }
    }

    // Verify popup
    if (manifest.action?.default_popup) {
      const popupPath = path.join(distDir, manifest.action.default_popup);
      if (!fs.existsSync(popupPath) || fs.statSync(popupPath).size === 0) {
        errors.push(`Action popup HTML missing or empty: ${manifest.action.default_popup}`);
      }
    }

    // Verify icons
    const icons = { ...(manifest.icons || {}), ...(manifest.action?.default_icon || {}) };
    for (const [size, iconRelPath] of Object.entries(icons)) {
      const iconPath = path.join(distDir, iconRelPath);
      if (!fs.existsSync(iconPath) || fs.statSync(iconPath).size === 0) {
        errors.push(`Icon (${size}px) missing or empty at: ${iconRelPath}`);
      }
    }
  } catch (err) {
    errors.push(`Failed to parse manifest.json: ${err.message}`);
  }
}

// 3. Verify HTML asset links (sidepanel.html, popup.html)
const htmlFiles = ['sidepanel.html', 'popup.html'];
for (const htmlName of htmlFiles) {
  const htmlPath = path.join(distDir, htmlName);
  if (fs.existsSync(htmlPath)) {
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    // Match src="..." and href="..."
    const srcMatches = [...htmlContent.matchAll(/(?:src|href)=["']([^"']+)["']/g)];
    for (const match of srcMatches) {
      const refPath = match[1];
      // Ignore external or protocol-relative URLs
      if (refPath.startsWith('http://') || refPath.startsWith('https://') || refPath.startsWith('//')) {
        continue;
      }
      // Normalize relative paths (e.g. ./assets/...)
      const cleaned = refPath.replace(/^\.\//, '').replace(/^\//, '');
      const targetPath = path.join(distDir, cleaned);
      if (!fs.existsSync(targetPath)) {
        errors.push(`HTML file "${htmlName}" references missing asset: "${refPath}"`);
      }
    }
  }
}

// 4. Output results
if (warnings.length > 0) {
  console.log('[WARNINGS]:');
  for (const w of warnings) {
    console.log(`  - ${w}`);
  }
  console.log('');
}

if (errors.length > 0) {
  console.error(`[FAIL] Bundle integrity verification failed with ${errors.length} error(s):\n`);
  for (const e of errors) {
    console.error(`  x ${e}`);
  }
  process.exit(1);
}

console.log('[PASS] Chrome MV3 unpacked extension bundle in dist/ is verified and complete.');
console.log('       Ready to be loaded unpacked from Chrome at:');
console.log(`       ${distDir}\n`);
process.exit(0);
