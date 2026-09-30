// Cross-platform packaging script for RedditDIG Chrome Extension (MV3)
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionDir = path.resolve(__dirname, '..');
const distDir = path.join(extensionDir, 'dist');
const zipFile = path.join(extensionDir, 'redditdig-extension.zip');

if (!fs.existsSync(distDir)) {
  console.error('[PACKAGE ERROR] dist/ directory not found. Run npm run build first.');
  process.exit(1);
}

if (fs.existsSync(zipFile)) {
  try {
    fs.unlinkSync(zipFile);
  } catch {
    // ignore
  }
}

console.log('[PACKAGE] Packaging extension from dist/ to redditdig-extension.zip...');

try {
  if (process.platform === 'win32') {
    // Windows PowerShell Compress-Archive
    execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${distDir}/*' -DestinationPath '${zipFile}' -Force"`, {
      stdio: 'inherit'
    });
  } else {
    // Linux / macOS zip
    execSync(`cd "${distDir}" && zip -r "${zipFile}" ./*`, {
      stdio: 'inherit'
    });
  }

  if (fs.existsSync(zipFile)) {
    const stats = fs.statSync(zipFile);
    console.log(`[PASS] Extension packaged successfully: ${zipFile} (${(stats.size / 1024).toFixed(1)} KB)`);
  } else {
    throw new Error('Zip file was not created');
  }
} catch (err) {
  console.error('[FAIL] Packaging failed:', err.message);
  process.exit(1);
}
