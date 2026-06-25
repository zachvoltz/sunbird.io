import { Hono } from "hono";
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from "@sunbird/shared";
import { getDb } from "../lib/db";
import { hashPassword, verifyPassword } from "../lib/password";
import { createSession, invalidateSession, clearSessionCookie, parseSessionCookie } from "../lib/session";
import { generateToken, hashToken } from "../lib/token";
import { createGoogleClient } from "../lib/oauth";
import { createEmailService } from "../services/email.service";
import { claimStudentInvites } from "../lib/invites";
import { requireAuth } from "../middleware/auth";
import { getEnv } from "../lib/env";
import { generateState, generateCodeVerifier } from "arctic";

type AuthEnv = {
  Bindings: {
    SESSION_SECRET: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    GOOGLE_REDIRECT_URI: string;
    EMAIL?: SendEmail;
    EMAIL_FROM: string;
  };
  Variables: {
    user: { id: string; email: string; name: string; role: string } | null;
    sessionId: string | null;
  };
};

const auth = new Hono<AuthEnv>();

// Only allow same-origin relative paths as an OAuth return target, so the
// ?redirect param can't be used as an open redirect. Returns "" if unsafe.
function sanitizeReturnPath(raw: string | undefined): string {
  if (!raw) return "";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "";
  if (raw.includes("://") || raw.includes("\\")) return "";
  return raw;
}

// ─── Register ───

auth.post("/register", async (c) => {
  const body = await c.req.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, 400);
  }

  const { name, email, password, referralSource } = parsed.data;
  const db = getDb();

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return c.json({ error: "An account with this email already exists" }, 409);
  }

  const passwordHash = hashPassword(password);
  const user = await db.user.create({
    data: { name, email, passwordHash, referralSource },
  });

  // Claim any pending coach invites for this email — flips them to an active
  // student in the inviting coach's list.
  await claimStudentInvites(db, user);

  const { cookie } = await createSession(db, user.id);
  c.header("Set-Cookie", cookie);

  // Send welcome email (fire and forget)
  const emailService = createEmailService((c.env as any)?.EMAIL, getEnv(c, "EMAIL_FROM"));
  emailService.sendWelcomeEmail(email, name).catch((err) => {
    console.error("Failed to send welcome email:", err);
  });

  return c.json({
    data: { id: user.id, email: user.email, name: user.name, role: user.role, roleChosen: user.roleChosen },
  }, 201);
});

// ─── Login ───

auth.post("/login", async (c) => {
  const body = await c.req.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, 400);
  }

  const { email, password } = parsed.data;
  const db = getDb();

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  if (!verifyPassword(password, user.passwordHash)) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  // Safety net: claim any still-pending invites for this email.
  await claimStudentInvites(db, user);

  const { cookie } = await createSession(db, user.id);
  c.header("Set-Cookie", cookie);

  return c.json({
    data: { id: user.id, email: user.email, name: user.name, role: user.role, roleChosen: user.roleChosen },
  });
});

// ─── Logout ───

auth.post("/logout", requireAuth, async (c) => {
  const sessionId = c.get("sessionId");
  if (sessionId) {
    const db = getDb();
    await invalidateSession(db, sessionId);
  }
  c.header("Set-Cookie", clearSessionCookie());
  return c.json({ data: { message: "Logged out" } });
});

// ─── Forgot Password ───

auth.post("/forgot-password", async (c) => {
  const body = await c.req.json();
  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, 400);
  }

  const { email } = parsed.data;
  const db = getDb();
  const user = await db.user.findUnique({ where: { email } });

  // Always return success to prevent email enumeration
  if (!user) {
    return c.json({ data: { message: "If an account exists with that email, a reset link has been sent." } });
  }

  // Delete any existing tokens for this user
  await db.passwordResetToken.deleteMany({ where: { userId: user.id } });

  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  const resetUrl = `${c.req.header("Origin") || "http://localhost:5173"}/reset-password?token=${rawToken}`;
  const emailService = createEmailService((c.env as any)?.EMAIL, getEnv(c, "EMAIL_FROM"));
  emailService.sendPasswordResetEmail(email, resetUrl).catch((err) => {
    console.error("Failed to send reset email:", err);
  });

  return c.json({ data: { message: "If an account exists with that email, a reset link has been sent." } });
});

// ─── Reset Password ───

auth.post("/reset-password", async (c) => {
  const body = await c.req.json();
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, 400);
  }

  const { token, password } = parsed.data;
  const db = getDb();
  const tokenHash = hashToken(token);

  const resetToken = await db.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!resetToken || resetToken.expiresAt < new Date()) {
    if (resetToken) {
      await db.passwordResetToken.delete({ where: { id: resetToken.id } });
    }
    return c.json({ error: "Invalid or expired reset token" }, 400);
  }

  const passwordHash = hashPassword(password);
  await db.user.update({
    where: { id: resetToken.userId },
    data: { passwordHash },
  });

  // Delete the used token
  await db.passwordResetToken.delete({ where: { id: resetToken.id } });

  // Invalidate all existing sessions for security
  await db.session.deleteMany({ where: { userId: resetToken.userId } });

  return c.json({ data: { message: "Password has been reset. Please log in." } });
});

// ─── Google OAuth: Start ───

auth.get("/oauth/google", async (c) => {
  const clientId = getEnv(c, "GOOGLE_CLIENT_ID");
  const clientSecret = getEnv(c, "GOOGLE_CLIENT_SECRET");
  const redirectUri = getEnv(c, "GOOGLE_REDIRECT_URI");

  // The button is a full-page navigation, so when Google isn't configured we
  // bounce back to /login with a flag (rather than redirecting to Google with
  // empty creds, which dead-ends on Google's own error page).
  if (!clientId || !clientSecret || !redirectUri) {
    return c.redirect("/login?oauth=unconfigured");
  }

  const google = createGoogleClient(clientId, clientSecret, redirectUri);

  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const scopes = ["openid", "email", "profile"];
  const url = google.createAuthorizationURL(state, codeVerifier, scopes);

  // Optional return-to path (e.g. the booking flow) and role to assign to a
  // brand-new account. Both are carried through the redirect via cookies and
  // honored in the callback. The redirect is sanitized to a same-origin path to
  // avoid an open redirect.
  const redirectTo = sanitizeReturnPath(c.req.query("redirect"));
  const role = c.req.query("role");
  const intendedRole = role === "STUDENT" || role === "COACH" ? role : "";

  // Store state and verifier in cookies
  const cookieOpts = "HttpOnly; SameSite=Lax; Path=/; Max-Age=600";
  c.header("Set-Cookie", `google_oauth_state=${state}; ${cookieOpts}`);
  c.header("Set-Cookie", `google_oauth_verifier=${codeVerifier}; ${cookieOpts}`, { append: true });
  if (redirectTo) {
    c.header("Set-Cookie", `google_oauth_redirect=${encodeURIComponent(redirectTo)}; ${cookieOpts}`, { append: true });
  }
  if (intendedRole) {
    c.header("Set-Cookie", `google_oauth_role=${intendedRole}; ${cookieOpts}`, { append: true });
  }

  return c.redirect(url.toString());
});

// ─── Google OAuth: Callback ───

auth.get("/oauth/google/cb", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const cookieHeader = c.req.header("Cookie") || "";

  const storedState = cookieHeader.match(/google_oauth_state=([^;]+)/)?.[1];
  const storedVerifier = cookieHeader.match(/google_oauth_verifier=([^;]+)/)?.[1];
  const returnTo = sanitizeReturnPath(
    decodeURIComponent(cookieHeader.match(/google_oauth_redirect=([^;]+)/)?.[1] ?? ""),
  );
  const storedRole = cookieHeader.match(/google_oauth_role=([^;]+)/)?.[1];
  const intendedRole = storedRole === "STUDENT" || storedRole === "COACH" ? storedRole : null;

  if (!code || !state || !storedState || !storedVerifier || state !== storedState) {
    return c.json({ error: "Invalid OAuth state" }, 400);
  }

  const google = createGoogleClient(
    getEnv(c, "GOOGLE_CLIENT_ID"),
    getEnv(c, "GOOGLE_CLIENT_SECRET"),
    getEnv(c, "GOOGLE_REDIRECT_URI"),
  );

  let tokens;
  try {
    tokens = await google.validateAuthorizationCode(code, storedVerifier);
  } catch {
    return c.json({ error: "Failed to exchange authorization code" }, 400);
  }

  // Decode the ID token to get user info
  const idToken = tokens.idToken();
  const payload = JSON.parse(atob(idToken.split(".")[1]));
  const { sub: providerId, email, name, picture } = payload;

  if (!email) {
    return c.json({ error: "Email not provided by Google" }, 400);
  }

  const db = getDb();

  // Check if OAuth account exists
  let oauthAccount = await db.oAuthAccount.findUnique({
    where: { provider_providerId: { provider: "google", providerId } },
    include: { user: true },
  });

  let user;
  let isNewUser = false;
  if (oauthAccount) {
    user = oauthAccount.user;
  } else {
    // Check if user with this email exists (link accounts)
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      await db.oAuthAccount.create({
        data: { provider: "google", providerId, userId: existingUser.id },
      });
      user = existingUser;
    } else {
      // Create new user + OAuth account. When the sign-in carried an intended
      // role (e.g. a student starting from the booking flow), lock it in so they
      // skip the role picker; otherwise roleChosen stays false and the redirect
      // below sends them to the picker.
      isNewUser = true;
      user = await db.user.create({
        data: {
          email,
          name: name || email.split("@")[0],
          avatarUrl: picture || null,
          ...(intendedRole ? { role: intendedRole, roleChosen: true } : {}),
          oauthAccounts: {
            create: { provider: "google", providerId },
          },
        },
      });

      // Send welcome email for new users
      const emailService = createEmailService((c.env as any)?.EMAIL, getEnv(c, "EMAIL_FROM"));
      emailService.sendWelcomeEmail(email, user.name).catch((err) => {
        console.error("Failed to send welcome email:", err);
      });
    }
  }

  // Claim any pending coach invites for this email (covers both brand-new and
  // account-linking sign-ins).
  await claimStudentInvites(db, user);

  const { cookie } = await createSession(db, user.id);

  // Clear OAuth cookies and set session cookie
  const clearOpts = "HttpOnly; SameSite=Lax; Path=/; Max-Age=0";
  c.header("Set-Cookie", cookie);
  c.header("Set-Cookie", `google_oauth_state=; ${clearOpts}`, { append: true });
  c.header("Set-Cookie", `google_oauth_verifier=; ${clearOpts}`, { append: true });
  c.header("Set-Cookie", `google_oauth_redirect=; ${clearOpts}`, { append: true });
  c.header("Set-Cookie", `google_oauth_role=; ${clearOpts}`, { append: true });

  // Redirect to frontend. A first-time Google user who still hasn't picked a
  // role goes to the onboarding picker (carrying any return path so they land
  // where they started afterward). Everyone else — including new users whose
  // role was set from the sign-in (e.g. students from the booking flow) — goes
  // straight to the return path, or home.
  if (isNewUser && !user.roleChosen) {
    const dest = returnTo ? `/onboarding/role?redirect=${encodeURIComponent(returnTo)}` : "/onboarding/role";
    return c.redirect(dest);
  }
  return c.redirect(returnTo || "/");
});

export { auth as authRoutes };
