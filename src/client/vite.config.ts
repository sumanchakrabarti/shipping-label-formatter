import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          pdfjs: ["pdfjs-dist"],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/resize": "http://localhost:3000",
      "/manifest.json": "http://localhost:3000",
      "/static": "http://localhost:3000",
    },
  },
});
