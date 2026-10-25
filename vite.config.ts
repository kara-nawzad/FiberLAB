import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Bound to 0.0.0.0 so the sandbox preview host can reach the dev server.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
    allowedHosts: true,
  },
  build: {
    rollupOptions: {
      output: {
        /**
         * Three vendor families change on their own cadence and are cached
         * independently of the application code: React itself, the React Flow
         * canvas engine, and the icon set (which is by far the largest leaf
         * dependency after React Flow). Everything else stays in the app chunk.
         */
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('@xyflow') || id.includes('d3-')) return 'flow';
          if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('/scheduler/')) return 'react';
          if (id.includes('lucide-react')) return 'icons';
          return 'vendor';
        },
      },
    },
  },
});
