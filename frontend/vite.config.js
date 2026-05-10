import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './apps/command-bridge')
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
        changeOrigin: true,
        secure: false
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
        changeOrigin: true,
        secure: false
      },
      '/health': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      },
      '/api/terminal': {
        target: 'http://localhost:4200',
        changeOrigin: true,
        secure: false
      },
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      }
    }
  },
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // This shell intentionally bundles several heavy workspace panels. Keep the
    // warning threshold above the current baseline so future growth still shows.
    chunkSizeWarningLimit: 4096,
    rollupOptions: {
      input: {
        main:  path.resolve(__dirname, 'index.html'),
        nexus: path.resolve(__dirname, 'nexus.html'),
        tie:   path.resolve(__dirname, 'tie.html'),
      },
      output: {
        manualChunks(id) {
          // Keep package internals together. Recharts in particular has re-export
          // edges that Rollup can split into circular chunks when left automatic.
          if (id.includes('node_modules')) return 'vendor'
          return undefined
        }
      }
    }
  }
})
