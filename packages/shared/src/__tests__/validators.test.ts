import { describe, it, expect } from "vitest";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
  contactSchema,
  createBookingSchema,
  cancelBookingSchema,
  practiceNotesSchema,
  createAvailabilitySchema,
  createSongSchema,
  createCommentSchema,
  createSessionMessageSchema,
  createSessionResourceSchema,
  eventRsvpSchema,
} from "../validators";

// ─── registerSchema ───

describe("registerSchema", () => {
  const valid = { name: "Jane", email: "jane@example.com", password: "securepass" };

  it("accepts valid input", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts optional referralSource", () => {
    expect(registerSchema.safeParse({ ...valid, referralSource: "google" }).success).toBe(true);
  });

  it("rejects missing name", () => {
    expect(registerSchema.safeParse({ ...valid, name: "" }).success).toBe(false);
  });

  it("rejects invalid email", () => {
    expect(registerSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
  });

  it("rejects short password", () => {
    expect(registerSchema.safeParse({ ...valid, password: "short" }).success).toBe(false);
  });

  it("rejects password over 128 chars", () => {
    expect(registerSchema.safeParse({ ...valid, password: "a".repeat(129) }).success).toBe(false);
  });
});

// ─── loginSchema ───

describe("loginSchema", () => {
  it("accepts valid input", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "x" }).success).toBe(true);
  });

  it("rejects missing password", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "" }).success).toBe(false);
  });

  it("rejects invalid email", () => {
    expect(loginSchema.safeParse({ email: "bad", password: "x" }).success).toBe(false);
  });
});

// ─── forgotPasswordSchema ───

describe("forgotPasswordSchema", () => {
  it("accepts valid email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "a@b.com" }).success).toBe(true);
  });

  it("rejects invalid email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "nope" }).success).toBe(false);
  });
});

// ─── resetPasswordSchema ───

describe("resetPasswordSchema", () => {
  it("accepts valid input", () => {
    expect(resetPasswordSchema.safeParse({ token: "abc123", password: "newpass88" }).success).toBe(true);
  });

  it("rejects empty token", () => {
    expect(resetPasswordSchema.safeParse({ token: "", password: "newpass88" }).success).toBe(false);
  });

  it("rejects short password", () => {
    expect(resetPasswordSchema.safeParse({ token: "abc", password: "short" }).success).toBe(false);
  });
});

// ─── updateProfileSchema ───

describe("updateProfileSchema", () => {
  it("accepts empty object (all optional)", () => {
    expect(updateProfileSchema.safeParse({}).success).toBe(true);
  });

  it("accepts valid name", () => {
    expect(updateProfileSchema.safeParse({ name: "Jane" }).success).toBe(true);
  });

  it("rejects invalid avatarUrl", () => {
    expect(updateProfileSchema.safeParse({ avatarUrl: "not-a-url" }).success).toBe(false);
  });

  it("rejects bio over 500 chars", () => {
    expect(updateProfileSchema.safeParse({ bio: "a".repeat(501) }).success).toBe(false);
  });
});

// ─── contactSchema ───

describe("contactSchema", () => {
  const valid = { name: "Jane", email: "j@b.com", subject: "lessons" as const, message: "Hello, I want to learn!" };

  it("accepts valid input", () => {
    expect(contactSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts all subject types", () => {
    for (const s of ["lessons", "workshops", "collaboration", "general", "other"]) {
      expect(contactSchema.safeParse({ ...valid, subject: s }).success).toBe(true);
    }
  });

  it("rejects invalid subject", () => {
    expect(contactSchema.safeParse({ ...valid, subject: "invalid" }).success).toBe(false);
  });

  it("rejects message under 10 chars", () => {
    expect(contactSchema.safeParse({ ...valid, message: "short" }).success).toBe(false);
  });

  it("rejects message over 5000 chars", () => {
    expect(contactSchema.safeParse({ ...valid, message: "a".repeat(5001) }).success).toBe(false);
  });
});

// ─── createBookingSchema ───

describe("createBookingSchema", () => {
  const valid = { lessonTypeId: "lt_1", startsAt: "2026-04-01T10:00:00Z" };

  it("accepts valid input", () => {
    expect(createBookingSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts optional fields", () => {
    expect(createBookingSchema.safeParse({
      ...valid,
      lessonCategoryId: "cat_1",
      coachId: "coach_1",
      studentNote: "I want to work on breathing",
    }).success).toBe(true);
  });

  it("rejects missing lessonTypeId", () => {
    expect(createBookingSchema.safeParse({ startsAt: "2026-04-01T10:00:00Z" }).success).toBe(false);
  });

  it("rejects invalid datetime format", () => {
    expect(createBookingSchema.safeParse({ ...valid, startsAt: "not-a-date" }).success).toBe(false);
  });

  it("rejects studentNote over 500 chars", () => {
    expect(createBookingSchema.safeParse({ ...valid, studentNote: "a".repeat(501) }).success).toBe(false);
  });
});

// ─── cancelBookingSchema ───

describe("cancelBookingSchema", () => {
  it("accepts empty object", () => {
    expect(cancelBookingSchema.safeParse({}).success).toBe(true);
  });

  it("accepts optional reason", () => {
    expect(cancelBookingSchema.safeParse({ reason: "schedule conflict" }).success).toBe(true);
  });

  it("rejects reason over 500 chars", () => {
    expect(cancelBookingSchema.safeParse({ reason: "a".repeat(501) }).success).toBe(false);
  });
});

// ─── practiceNotesSchema ───

describe("practiceNotesSchema", () => {
  it("accepts valid notes", () => {
    expect(practiceNotesSchema.safeParse({ practiceNotes: "Work on breath control" }).success).toBe(true);
  });

  it("rejects empty notes", () => {
    expect(practiceNotesSchema.safeParse({ practiceNotes: "" }).success).toBe(false);
  });

  it("rejects notes over 5000 chars", () => {
    expect(practiceNotesSchema.safeParse({ practiceNotes: "a".repeat(5001) }).success).toBe(false);
  });
});

// ─── createAvailabilitySchema ───

describe("createAvailabilitySchema", () => {
  const valid = { dayOfWeek: 1, startTime: "09:00", endTime: "10:00" };

  it("accepts valid input", () => {
    expect(createAvailabilitySchema.safeParse(valid).success).toBe(true);
  });

  it("accepts dayOfWeek 0 (Sunday) through 6 (Saturday)", () => {
    for (let d = 0; d <= 6; d++) {
      expect(createAvailabilitySchema.safeParse({ ...valid, dayOfWeek: d }).success).toBe(true);
    }
  });

  it("rejects dayOfWeek out of range", () => {
    expect(createAvailabilitySchema.safeParse({ ...valid, dayOfWeek: 7 }).success).toBe(false);
    expect(createAvailabilitySchema.safeParse({ ...valid, dayOfWeek: -1 }).success).toBe(false);
  });

  it("rejects invalid time format", () => {
    expect(createAvailabilitySchema.safeParse({ ...valid, startTime: "9:00" }).success).toBe(false);
    expect(createAvailabilitySchema.safeParse({ ...valid, startTime: "09:0" }).success).toBe(false);
    expect(createAvailabilitySchema.safeParse({ ...valid, endTime: "abc" }).success).toBe(false);
  });

  it("defaults isActive to true", () => {
    const result = createAvailabilitySchema.safeParse(valid);
    expect(result.success && result.data.isActive).toBe(true);
  });
});

// ─── createSongSchema ───

describe("createSongSchema", () => {
  it("accepts valid input", () => {
    expect(createSongSchema.safeParse({ title: "My Song" }).success).toBe(true);
  });

  it("accepts optional fields", () => {
    expect(createSongSchema.safeParse({
      title: "My Song",
      description: "A ballad",
      audioUrl: "https://example.com/song.mp3",
      externalUrl: "https://soundcloud.com/song",
      tags: "folk, acoustic",
    }).success).toBe(true);
  });

  it("rejects empty title", () => {
    expect(createSongSchema.safeParse({ title: "" }).success).toBe(false);
  });

  it("rejects invalid URLs", () => {
    expect(createSongSchema.safeParse({ title: "Song", audioUrl: "not-url" }).success).toBe(false);
  });
});

// ─── createCommentSchema ───

describe("createCommentSchema", () => {
  it("accepts valid content", () => {
    expect(createCommentSchema.safeParse({ content: "Great work!" }).success).toBe(true);
  });

  it("rejects empty content", () => {
    expect(createCommentSchema.safeParse({ content: "" }).success).toBe(false);
  });

  it("rejects content over 2000 chars", () => {
    expect(createCommentSchema.safeParse({ content: "a".repeat(2001) }).success).toBe(false);
  });
});

// ─── createSessionMessageSchema ───

describe("createSessionMessageSchema", () => {
  it("accepts valid message", () => {
    expect(createSessionMessageSchema.safeParse({ content: "Hello!" }).success).toBe(true);
  });

  it("rejects empty message", () => {
    expect(createSessionMessageSchema.safeParse({ content: "" }).success).toBe(false);
  });

  it("rejects message over 5000 chars", () => {
    expect(createSessionMessageSchema.safeParse({ content: "a".repeat(5001) }).success).toBe(false);
  });
});

// ─── createSessionResourceSchema ───

describe("createSessionResourceSchema", () => {
  const valid = { type: "LINK" as const, title: "Sheet Music", url: "https://example.com/sheet.pdf" };

  it("accepts valid input", () => {
    expect(createSessionResourceSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts all resource types", () => {
    for (const t of ["LINK", "PDF", "AUDIO"]) {
      expect(createSessionResourceSchema.safeParse({ ...valid, type: t }).success).toBe(true);
    }
  });

  it("rejects invalid type", () => {
    expect(createSessionResourceSchema.safeParse({ ...valid, type: "VIDEO" }).success).toBe(false);
  });

  it("rejects invalid URL", () => {
    expect(createSessionResourceSchema.safeParse({ ...valid, url: "not-a-url" }).success).toBe(false);
  });

  it("rejects empty title", () => {
    expect(createSessionResourceSchema.safeParse({ ...valid, title: "" }).success).toBe(false);
  });
});

// ─── eventRsvpSchema ───

describe("eventRsvpSchema", () => {
  it("accepts valid input", () => {
    expect(eventRsvpSchema.safeParse({ name: "Jane", email: "j@b.com" }).success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(eventRsvpSchema.safeParse({ name: "", email: "j@b.com" }).success).toBe(false);
  });

  it("rejects invalid email", () => {
    expect(eventRsvpSchema.safeParse({ name: "Jane", email: "bad" }).success).toBe(false);
  });
});
