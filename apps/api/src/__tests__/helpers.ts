import { execSync } from "child_process";
import { resolve } from "path";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const SCHEMA_PATH = resolve(__dirname, "../../../../packages/db/prisma/schema.prisma");

export function createTestDb() {
  const dir = mkdtempSync(join(tmpdir(), "sunbird-test-"));
  const dbPath = join(dir, "test.db");
  const dbUrl = `file:${dbPath}`;

  // Push schema to fresh SQLite file (no migrations needed)
  execSync(`pnpm --filter @sunbird/db exec prisma db push --schema=${SCHEMA_PATH}`, {
    env: { ...process.env, DATABASE_URL: dbUrl },
    cwd: resolve(__dirname, "../../../.."),
    stdio: "ignore",
  });

  // Set the DATABASE_URL so the app picks it up
  process.env.DATABASE_URL = dbUrl;

  return {
    dbUrl,
    cleanup() {
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** Make a JSON request to the Hono app */
export function jsonRequest(
  app: { request: (req: Request) => Promise<Response> },
  path: string,
  options: { method?: string; body?: Record<string, unknown>; cookie?: string } = {},
) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.cookie) headers["Cookie"] = options.cookie;

  return app.request(
    new Request(`http://localhost${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    }),
  );
}

/** Extract Set-Cookie session value from response */
export function getSessionCookie(res: Response): string | null {
  const setCookie = res.headers.get("Set-Cookie");
  if (!setCookie) return null;
  const match = setCookie.match(/session=([^;]+)/);
  return match ? `session=${match[1]}` : null;
}
