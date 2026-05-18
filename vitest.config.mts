import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    include: ["components/**/*.test.ts?(x)", "app/**/*.test.ts?(x)", "tests/**/*.test.ts?(x)"],
    coverage: {
      reporter: ["text", "lcov"],
      include: ["components/admin/mobile-menu.tsx", "components/admin/admin-header.tsx"],
    },
  },
});

