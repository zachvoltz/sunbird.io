import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";

type MeEnv = {
  Variables: {
    user: { id: string; email: string; name: string; avatarUrl: string | null; bio: string | null; role: string } | null;
    sessionId: string | null;
  };
};

const me = new Hono<MeEnv>();

me.get("/", requireAuth, (c) => {
  const user = c.get("user")!;
  return c.json({
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      role: user.role,
    },
  });
});

export { me as meRoutes };
