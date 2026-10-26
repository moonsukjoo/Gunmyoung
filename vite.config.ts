import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    root: '.',
    plugins: [react(), tailwindcss()],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        'firebase/app',
        'firebase/auth',
        'firebase/firestore',
        'lucide-react',
        'date-fns',
        'date-fns/locale',
        'sonner',
        'clsx',
        'tailwind-merge',
        'framer-motion',
        'canvas-confetti',
        'xlsx',
        'jspdf',
        'jspdf-autotable',
        'html2canvas',
        '@capacitor/core',
        '@capacitor/app',
        '@capacitor/device',
        '@capacitor/filesystem',
        '@capacitor/geolocation',
        '@capacitor/share',
      ],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
