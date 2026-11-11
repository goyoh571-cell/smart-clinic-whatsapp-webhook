import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    // Enable SPA history fallback so /q/:clinicSlug routes resolve to index.html
    historyApiFallback: true,
  },
});
