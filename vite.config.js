import { defineConfig } from 'vite';

export default defineConfig({
  // ── Dev server ──────────────────────────────────────────────────────────
  server: {
    port: 5173,
    open: true,
  },

  // ── Build ────────────────────────────────────────────────────────────────
  build: {
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 800,

    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@supabase'))  return 'vendor-supabase';
            if (id.includes('katex'))      return 'vendor-katex';
            if (id.includes('dompurify'))  return 'vendor-dompurify';
            return 'vendor';
          }
          if (id.includes('/src/lib/api.js') || id.includes('/src/lib/supabase.js') || id.includes('/src/lib/auth.js') || id.includes('/src/lib/chunksDb.js')) return 'lib-core';
          if (id.includes('/src/lib/flashcardDb.js')) return 'lib-features';
          if (id.includes('/src/utils/')) return 'utils';
          if (id.includes('/src/state/')) return 'state';
          if (id.includes('/src/components/')) return 'components';
          if (id.includes('/src/screens/HomeScreen.js'))      return 'screen-home';
          if (id.includes('/src/screens/WorkspaceScreen.js')) return 'screen-workspace';
          if (id.includes('/src/screens/FlashScreen.js'))     return 'screen-flash';
          if (id.includes('/src/screens/ResearchScreen.js'))  return 'screen-research';
          if (id.includes('/src/screens/ExamScreen.js'))      return 'screen-exam';
          if (id.includes('/src/screens/StudyPlanScreen.js')) return 'screen-studyplan';
        },
        chunkFileNames:  'assets/[name]-[hash].js',
        entryFileNames:  'assets/[name]-[hash].js',
        assetFileNames:  'assets/[name]-[hash][extname]',
      },
    },
  },

  // ── CSS ──────────────────────────────────────────────────────────────────
  css: {
    devSourcemap: true,
  },
});