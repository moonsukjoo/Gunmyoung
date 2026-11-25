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
      'import.meta.env.VITE_APP_BUILD_AT': JSON.stringify(new Date().toISOString()),
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
        'react-dom/client',
        'react-router-dom',
        'firebase/app',
        'firebase/auth',
        'firebase/firestore',
        'firebase/messaging',
        'lucide-react',
        'date-fns',
        'date-fns/locale',
        'sonner',
        'clsx',
        'tailwind-merge',
        'class-variance-authority',
        'framer-motion',
        'motion/react',
        'canvas-confetti',
        'xlsx',
        'jspdf',
        'jspdf-autotable',
        'html2canvas',
        'react-day-picker',
        'react-markdown',
        'react-signature-canvas',
        'recharts',
        '@google/genai',
        '@capacitor/core',
        '@capacitor/app',
        '@capacitor/device',
        '@capacitor/filesystem',
        '@capacitor/geolocation',
        '@capacitor/local-notifications',
        '@capacitor/motion',
        '@capacitor/share',
        '@base-ui/react/button',
        '@base-ui/react/checkbox',
        '@base-ui/react/dialog',
        '@base-ui/react/input',
        '@base-ui/react/menu',
        '@base-ui/react/merge-props',
        '@base-ui/react/popover',
        '@base-ui/react/progress',
        '@base-ui/react/scroll-area',
        '@base-ui/react/select',
        '@base-ui/react/separator',
        '@base-ui/react/switch',
        '@base-ui/react/tabs',
        '@base-ui/react/tooltip',
        '@base-ui/react/use-render',
      ],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      allowedHosts: true,
    },
  };
});
