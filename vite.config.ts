import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri expects a fixed dev-server port and does not want Vite to clear the
// terminal, because the Rust compiler output is shown there too.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    host: "127.0.0.1",
    port: 1420,
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_ENV_"],
  build: {
    target: "es2021",
    // Vite 8 uses Oxc by default; this avoids pulling in esbuild just for
    // minification.
    minify: "oxc",
    sourcemap: false,
  },
});
