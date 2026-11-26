/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Em desenvolvimento, o Vite reencaminha /api, /uploads e /socket.io para o back-end.
// Assim, um telemóvel na mesma rede Wi-Fi consegue abrir http://<IP-do-PC>:5180/mesa/... e tudo funciona.
// Se o back-end correr noutra porta: API_PROXY=http://localhost:4001 npm run dev
const API = process.env.API_PROXY ?? 'http://localhost:4000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5180,
    proxy: {
      '/api': API,
      '/uploads': API,
      '/socket.io': { target: API, ws: true },
    },
  },
  // Testes do front-end (`npm test` dentro de client/): Vitest + Testing Library num DOM simulado
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/testes-setup.ts'],
  },
});
