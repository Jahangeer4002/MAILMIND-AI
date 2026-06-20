import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": srcDir,
    },
  },
  server: {
    port: 5183,
    proxy: {
      "/api": {
        target: "http://localhost:5020",
        changeOrigin: true,
      },
    },
  },
});
