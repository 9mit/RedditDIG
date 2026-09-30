import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import fs from 'fs';

// Simple plugin to copy manifest.json and icons to dist
function copyExtensionAssets() {
  return {
    name: 'copy-extension-assets',
    closeBundle() {
      const distDir = resolve(__dirname, 'dist');
      if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir, { recursive: true });
      }
      // Copy manifest.json
      if (fs.existsSync(resolve(__dirname, 'manifest.json'))) {
        fs.copyFileSync(
          resolve(__dirname, 'manifest.json'),
          resolve(distDir, 'manifest.json')
        );
      }
      // Copy icons
      const iconsDist = resolve(distDir, 'icons');
      if (!fs.existsSync(iconsDist)) {
        fs.mkdirSync(iconsDist, { recursive: true });
      }
      const iconsSrc = resolve(__dirname, 'icons');
      if (fs.existsSync(iconsSrc)) {
        for (const file of fs.readdirSync(iconsSrc)) {
          fs.copyFileSync(resolve(iconsSrc, file), resolve(iconsDist, file));
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
