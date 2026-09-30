import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import fs from 'fs';

// Plugin to reliably emit manifest.json and icons to dist
function copyExtensionAssets(): Plugin {
  return {
    name: 'copy-extension-assets',
    generateBundle(this: any) {
      // Emit manifest.json as a first-class Rollup asset
      const manifestPath = resolve(__dirname, 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        this.emitFile({
          type: 'asset',
          fileName: 'manifest.json',
          source: fs.readFileSync(manifestPath, 'utf8')
        });
      }
      // Emit icons
      const iconsSrc = resolve(__dirname, 'icons');
      if (fs.existsSync(iconsSrc)) {
        for (const file of fs.readdirSync(iconsSrc)) {
          const filePath = resolve(iconsSrc, file);
          if (fs.statSync(filePath).isFile()) {
            this.emitFile({
              type: 'asset',
              fileName: `icons/${file}`,
              source: fs.readFileSync(filePath)
            });
          }
        }
      }
    },
    closeBundle() {
      const distDir = resolve(__dirname, 'dist');
      if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir, { recursive: true });
      }
      // Ensure manifest.json is present on disk
      const manifestPath = resolve(__dirname, 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        fs.copyFileSync(manifestPath, resolve(distDir, 'manifest.json'));
      }
      // Ensure icons are present on disk
      const iconsDist = resolve(distDir, 'icons');
      if (!fs.existsSync(iconsDist)) {
        fs.mkdirSync(iconsDist, { recursive: true });
      }
      const iconsSrc = resolve(__dirname, 'icons');
      if (fs.existsSync(iconsSrc)) {
        for (const file of fs.readdirSync(iconsSrc)) {
          const filePath = resolve(iconsSrc, file);
          if (fs.statSync(filePath).isFile()) {
            fs.copyFileSync(filePath, resolve(iconsDist, file));
          }
        }
      }
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), copyExtensionAssets()],
  envDir: resolve(__dirname, '..'),
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, 'sidepanel.html'),
        popup: resolve(__dirname, 'popup.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
        content: resolve(__dirname, 'src/content/index.ts')
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') return 'background.js';
          if (chunkInfo.name === 'content') return 'content.js';
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  }
});
