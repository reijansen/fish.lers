import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
// @ts-ignore: types are .d.mts and require "moduleResolution": "nodenext" — suppress here or update tsconfig.json accordingly
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } }
});
