import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: mode === 'mobile' ? '/' : '/flashshare/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      rollupOptions: {
        output: {
          // More aggressive manual chunk splitting
          manualChunks: (id) => {
            // Split node_modules
            if (id.includes('node_modules')) {
              // React ecosystem
              if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) {
                return 'vendor-react';
              }

              // Router
              if (id.includes('react-router') || id.includes('react-router-dom')) {
                return 'vendor-router';
              }

              // State management (if you use redux, zustand, etc.)
              if (id.includes('redux') || id.includes('zustand') || id.includes('mobx')) {
                return 'vendor-state';
              }

              // UI libraries
              if (id.includes('@mui') || id.includes('material-ui') ||
                id.includes('antd') || id.includes('bootstrap') ||
                id.includes('@chakra') || id.includes('@radix')) {
                return 'vendor-ui';
              }

              // Icons libraries
              if (id.includes('@heroicons') || id.includes('@mui/icons-material') ||
                id.includes('react-icons') || id.includes('lucide-react')) {
                return 'vendor-icons';
              }

              // Utility libraries
              if (id.includes('lodash') || id.includes('date-fns') ||
                id.includes('moment') || id.includes('axios') ||
                id.includes('query') || id.includes('@tanstack')) {
                return 'vendor-utils';
              }

              // Everything else from node_modules
              return 'vendor-other';
            }

            // Optional: Split your own code by features/folders
            // if (id.includes('/src/components/')) {
            //   return 'components';
            // }
            // if (id.includes('/src/pages/')) {
            //   return 'pages';
            // }

            return null;
          },
          // Add chunk size strategy
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: 'assets/[ext]/[name]-[hash].[ext]'
        }
      },
      // Increase limit further
      chunkSizeWarningLimit: 800,

      // Enable source maps only in development
      sourcemap: mode === 'development',

      // Minification options
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true
        }
      },

      // Split chunks more aggressively
      splitChunks: {
        chunks: 'all',
        maxSize: 300000 // 300kB target size
      }
    }
  };
});