import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  envDir: "../..",
  plugins: [reactRouter(), tsconfigPaths()],
  ssr: {
    // Share engine modules and error classes with the native Node entrypoint.
    external: ["@url-shortener/engine"],
  },
});
