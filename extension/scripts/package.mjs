import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionRoot = path.resolve(__dirname, '..');
const distDir = path.resolve(extensionRoot, 'dist');
const manifest = JSON.parse(fs.readFileSync(path.join(extensionRoot, 'manifest.json'), 'utf8'));
const zipFile = path.resolve(extensionRoot, `redditdig-v${manifest.version}.zip`);

if (!fs.existsSync(distDir)) {
  console.error('Error: dist directory does not exist. Run "npm run build" first.');
  process.exit(1);
}

console.log(`Packaging extension from ${distDir} into ${zipFile}...`);

try {
  if (process.platform === 'win32') {
    execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${distDir}\\*' -DestinationPath '${zipFile}' -Force"`, {
      stdio: 'inherit'
    });
  } else {
    execSync(`cd "${distDir}" && zip -r "${zipFile}" .`, {
      stdio: 'inherit'
    });
  }

  const stats = fs.statSync(zipFile);
  console.log(`Successfully created ${zipFile} (${(stats.size / 1024).toFixed(1)} KB)`);
} catch (err) {
  console.error('Failed to create package zip:', err);
  process.exit(1);
}
