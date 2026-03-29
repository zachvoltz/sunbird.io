import { config } from "dotenv";
import { resolve } from "path";

// Load .dev.vars before any other imports that might need env vars
config({ path: resolve(process.cwd(), ".dev.vars") });

import { serve } from "@hono/node-server";
import app from "./index";

const port = 8787;
console.log(`Sunbird API running at http://localhost:${port}`);
serve({ fetch: app.fetch, port });
