import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "libs/**/tests/**/*.test.ts",
      "applications/**/tests/**/*.test.ts",
    ],
    clearMocks: true,
    restoreMocks: true,
  },
});
