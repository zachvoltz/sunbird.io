import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: ["src/__tests__/**/*.test.ts"],
    // Each test file spins up its own SQLite DB via createTestDb(), which shells
    // out to `prisma db push`. Running files in parallel launches one prisma
    // process per file at once and the beforeAll hooks time out under the load.
    // Run files sequentially so setup stays fast and reliable.
    fileParallelism: false,
    // db push can be slow on a cold cache — give setup/teardown headroom.
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
