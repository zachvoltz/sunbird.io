import { Hono } from "hono";
import { getDb } from "../lib/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { updateCoachSettingsSchema, updateCoachAvailabilitySchema, updateCoachProfileSchema } from "@sunbird/shared";

export const coachSettingsRoutes = new Hono();

// GET /api/coach-settings — get coach settings
coachSettingsRoutes.get("/", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const db = getDb();

  const availability = await db.coachAvailability.findMany({
    where: { coachId: user.id },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  const coachCats = await db.coachCategory.findMany({
    where: { coachId: user.id },
  });

  const allCategories = await db.category.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, title: true, slug: true },
  });

  // Fetch full user for profile fields
  const fullUser = await db.user.findUnique({ where: { id: user.id } }) as any;

  return c.json({
    data: {
      slug: fullUser?.slug ?? null,
      headline: fullUser?.headline ?? null,
      longBio: fullUser?.longBio ?? null,
      coverImageUrl: fullUser?.coverImageUrl ?? null,
      credentials: fullUser?.credentials ?? null,
      socialLinks: fullUser?.socialLinks ?? null,
      isPublished: fullUser?.isPublished ?? false,
      sessionAddress: fullUser?.sessionAddress ?? null,
      availability: availability.map((a: any) => ({
        id: a.id,
        dayOfWeek: a.dayOfWeek,
        startTime: a.startTime,
        endTime: a.endTime,
        isActive: a.isActive,
      })),
      categoryIds: coachCats.map((cc: any) => cc.categoryId),
      allCategories,
    },
  });
});

// PATCH /api/coach-settings — update session address
coachSettingsRoutes.patch("/", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const body = await c.req.json();
  const parsed = updateCoachSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, 400);
  }

  const db = getDb();
  await db.user.update({
    where: { id: user.id },
    data: { sessionAddress: parsed.data.sessionAddress ?? null },
  });

  return c.json({ data: { ok: true } });
});

// PATCH /api/coach-settings/profile — update public profile fields
coachSettingsRoutes.patch("/profile", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const body = await c.req.json();
  const parsed = updateCoachProfileSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, 400);
  }

  const db = getDb();

  // Validate slug uniqueness if provided
  if (parsed.data.slug) {
    const existing = await db.user.findFirst({
      where: { slug: parsed.data.slug, id: { not: user.id } },
    });
    if (existing) {
      return c.json({ error: "This URL slug is already taken" }, 409);
    }
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      slug: parsed.data.slug ?? undefined,
      headline: parsed.data.headline ?? undefined,
      longBio: parsed.data.longBio ?? undefined,
      coverImageUrl: parsed.data.coverImageUrl || null,
      credentials: parsed.data.credentials ?? undefined,
      socialLinks: parsed.data.socialLinks ?? undefined,
    },
  });

  return c.json({ data: { ok: true } });
});

const COVER_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_COVER_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB

// POST /api/coach-settings/cover-image — multipart upload (single "file" field)
// of the coach's public-profile cover image. Stores in R2 and stamps
// coverImageUrl. Mirrors the takes-audio upload pattern.
coachSettingsRoutes.post("/cover-image", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const bucket = (c.env as any)?.MEDIA_BUCKET as R2Bucket | undefined;
  if (!bucket) {
    return c.json({ error: "Image uploads aren't available yet — the R2 bucket isn't bound." }, 501);
  }

  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    return c.json({ error: "Expected multipart/form-data" }, 400);
  }
  const entry = form.get("file");
  if (!entry || typeof entry === "string") {
    return c.json({ error: "Missing `file` field" }, 400);
  }
  const file = entry as Blob & { name?: string };
  const baseType = (file.type || "").split(";")[0].trim().toLowerCase();
  if (!COVER_IMAGE_TYPES.has(baseType)) {
    return c.json({ error: `Unsupported image type: ${file.type || "unknown"}` }, 415);
  }
  if (file.size > MAX_COVER_IMAGE_BYTES) {
    return c.json({ error: `Image too large (${(file.size / 1024 / 1024).toFixed(1)} MB; max 8 MB)` }, 413);
  }

  const db = getDb();
  // Replace any prior cover we own so re-uploads don't orphan objects (skip
  // external URLs the coach may have pasted previously).
  const prev = await db.user.findUnique({ where: { id: user.id }, select: { coverImageUrl: true } });
  const marker = "/api/coach-settings/cover/";
  if (prev?.coverImageUrl) {
    const idx = prev.coverImageUrl.indexOf(marker);
    if (idx >= 0) {
      try { await bucket.delete(decodeURIComponent(prev.coverImageUrl.slice(idx + marker.length))); } catch { /* ignore */ }
    }
  }

  const safeName = (file.name ?? "cover").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  const key = `covers/${user.id}/${Date.now()}-${safeName}`;
  await bucket.put(key, file.stream(), {
    httpMetadata: { contentType: baseType || "application/octet-stream" },
  });

  const coverImageUrl = `${marker}${encodeURIComponent(key)}`;
  await db.user.update({ where: { id: user.id }, data: { coverImageUrl } });
  return c.json({ data: { coverImageUrl } });
});

// GET /api/coach-settings/cover/* — stream a cover image from R2.
// Unauthenticated (cover images are public, shown on the public profile); keys
// are scoped to the covers/ prefix.
coachSettingsRoutes.get("/cover/*", async (c) => {
  const bucket = (c.env as any)?.MEDIA_BUCKET as R2Bucket | undefined;
  if (!bucket) return c.text("Image storage not configured", 501);
  const fullPath = new URL(c.req.url).pathname;
  const prefix = "/api/coach-settings/cover/";
  if (!fullPath.startsWith(prefix)) return c.text("Bad path", 400);
  const key = decodeURIComponent(fullPath.slice(prefix.length));
  if (!key.startsWith("covers/")) return c.text("Forbidden key", 403);

  const obj = await bucket.get(key);
  if (!obj) return c.text("Not found", 404);
  return new Response(obj.body, {
    headers: {
      "content-type": obj.httpMetadata?.contentType ?? "image/jpeg",
      "content-length": String(obj.size),
      "cache-control": "public, max-age=3600",
    },
  });
});

// POST /api/coach-settings/publish — publish public page
coachSettingsRoutes.post("/publish", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const db = getDb();

  // Must have at least one category assigned
  const categoryCount = await db.coachCategory.count({ where: { coachId: user.id } });
  if (categoryCount === 0) {
    return c.json({ error: "You need at least one category before publishing your profile" }, 400);
  }

  // Must have a slug
  const coach = await db.user.findUnique({ where: { id: user.id } });
  if (!(coach as any)?.slug) {
    return c.json({ error: "Set a URL slug in your profile before publishing" }, 400);
  }

  await db.user.update({ where: { id: user.id }, data: { isPublished: true } });
  return c.json({ data: { ok: true } });
});

// POST /api/coach-settings/unpublish — unpublish public page
coachSettingsRoutes.post("/unpublish", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const db = getDb();
  await db.user.update({ where: { id: user.id }, data: { isPublished: false } });
  return c.json({ data: { ok: true } });
});

// PUT /api/coach-settings/availability — bulk replace weekly schedule
coachSettingsRoutes.put("/availability", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const body = await c.req.json();
  const parsed = updateCoachAvailabilitySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, 400);
  }

  const db = getDb();

  // Delete existing and re-create
  await db.coachAvailability.deleteMany({ where: { coachId: user.id } });

  for (const slot of parsed.data.slots) {
    await db.coachAvailability.create({
      data: {
        coachId: user.id,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        isActive: true,
      },
    });
  }

  return c.json({ data: { ok: true } });
});

// PUT /api/coach-settings/categories — bulk replace category assignments
coachSettingsRoutes.put("/categories", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const body = await c.req.json();
  const { updateCoachCategoriesSchema } = await import("@sunbird/shared");
  const parsed = updateCoachCategoriesSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, 400);
  }

  const db = getDb();
  await db.coachCategory.deleteMany({ where: { coachId: user.id } });

  for (const categoryId of parsed.data.categoryIds) {
    await db.coachCategory.create({
      data: { coachId: user.id, categoryId },
    });
  }

  return c.json({ data: { ok: true } });
});

// ─── Coach Resource Library ───

// GET /api/coach-settings/resources?q=search — search coach's resource library
coachSettingsRoutes.get("/resources", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const q = c.req.query("q") ?? "";
  const db = getDb();

  const where: any = { coachId: user.id };
  if (q) {
    where.title = { contains: q };
  }

  const resources = await db.coachResource.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return c.json({
    data: resources.map((r: any) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      url: r.url,
      createdAt: r.createdAt.toISOString(),
    })),
  });
});

// POST /api/coach-settings/resources — create a resource in the library
coachSettingsRoutes.post("/resources", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const body = await c.req.json();
  const { createNodeResourceSchema } = await import("@sunbird/shared");
  const parsed = createNodeResourceSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, 400);
  }

  const db = getDb();
  const resource = await db.coachResource.create({
    data: {
      coachId: user.id,
      type: parsed.data.type,
      title: parsed.data.title,
      url: parsed.data.url,
    },
  });

  return c.json({
    data: { id: resource.id, type: resource.type, title: resource.title, url: resource.url, createdAt: resource.createdAt.toISOString() },
  }, 201);
});

// DELETE /api/coach-settings/resources/:id — delete from library
coachSettingsRoutes.delete("/resources/:id", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const { id } = c.req.param();
  const db = getDb();

  const resource = await db.coachResource.findFirst({ where: { id, coachId: user.id } });
  if (!resource) return c.json({ error: "Resource not found" }, 404);

  await db.coachResource.delete({ where: { id } });
  return c.json({ data: { ok: true } });
});

