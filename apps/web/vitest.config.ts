import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@\/(.*)$/,
        replacement: path.resolve(__dirname, "./$1"),
      },
      {
        find: /^@repo\/shared\/(.*)$/,
        replacement: path.resolve(__dirname, "../../packages/shared/$1"),
      },
      {
        find: "@repo/shared",
        replacement: path.resolve(__dirname, "../../packages/shared/types/index.ts"),
      },
    ],
  },
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
  },
});
