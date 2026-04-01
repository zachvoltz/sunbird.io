import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  // Clear existing data (order matters for foreign keys)
  await db.booking.deleteMany();
  await db.lessonCategory.deleteMany();
  await db.lessonType.deleteMany();
  await db.availabilitySlot.deleteMany();

  // ─── Lesson Types ───

  const voice = await db.lessonType.create({
    data: {
      slug: "voice",
      title: "Voice",
      subtitle: "The instrument you already own.",
      description:
        "Learn to sing the way you speak — honestly, with your whole body behind it. We'll work on breath, tone, range, and the thing no one teaches: trusting the sound that's already yours.",
      pricePerSession: 8000,
      sortOrder: 0,
    },
  });

  const songwriting = await db.lessonType.create({
    data: {
      slug: "songwriting",
      title: "Songwriting",
      subtitle: "From first line to finished thing.",
      description:
        "Melody, lyrics, structure — but also the harder stuff: starting, staying with an idea, knowing when it's done. We write in the room together. You leave with songs, not just notes about songs.",
      pricePerSession: 8000,
      sortOrder: 1,
    },
  });

  const guitar = await db.lessonType.create({
    data: {
      slug: "guitar-for-singers",
      title: "Guitar for Singers",
      subtitle: "Enough to accompany yourself.",
      description:
        "You don't need to be a guitarist. You need to be a singer who can play guitar. We'll focus on chords, strumming, and accompaniment patterns that serve the song.",
      pricePerSession: 8000,
      sortOrder: 2,
    },
  });

  // ─── Lesson Categories ───

  // Voice categories
  const voiceCategories = [
    { slug: "just-getting-started", title: "Just Getting Started", description: "For people who've always wanted to sing but don't know where to begin." },
    { slug: "tune-up", title: "Tune-up", description: "You can sing — you just want to get sharper, more consistent, more confident." },
    { slug: "breath", title: "Breath", description: "Deep dive into breath support, control, and the connection between air and sound." },
    { slug: "telling-a-story", title: "Telling a Story", description: "Singing with intention. Making every word land." },
    { slug: "performance", title: "Performance", description: "Presence, phrasing, how to hold a room without holding your breath. We work on what happens between songs, too." },
    { slug: "yoga-for-singers", title: "Yoga for Singers", description: "Breath, alignment, and release — blending yoga with vocal warm-ups to help you sing from a more open, grounded place." },
  ];

  for (let i = 0; i < voiceCategories.length; i++) {
    await db.lessonCategory.create({
      data: { ...voiceCategories[i], lessonTypeId: voice.id, sortOrder: i },
    });
  }

  // Songwriting categories
  const songwritingCategories = [
    { slug: "my-first-song", title: "My First Song", description: "You've never written a song. Let's change that." },
    { slug: "general-consult", title: "General Consult", description: "Bring what you're working on. We'll figure out what it needs." },
    { slug: "telling-a-story", title: "Telling a Story", description: "Narrative songwriting — structure, imagery, emotional arc." },
    { slug: "songwriting-habits", title: "Songwriting Habits", description: "Building a daily writing practice that actually sticks." },
    { slug: "my-first-epm", title: "My First EPM", description: "Planning and writing your first EP or collection of songs." },
    { slug: "theory", title: "Theory", description: "Chords, scales, rhythm, form — taught as tools for making, not rules for following. Understand why your favorite songs work." },
    { slug: "poetry-in-song", title: "Poetry in Song", description: "The line between a poem and a lyric is thinner than people think. For students who want their words to carry weight even without the melody." },
  ];

  for (let i = 0; i < songwritingCategories.length; i++) {
    await db.lessonCategory.create({
      data: { ...songwritingCategories[i], lessonTypeId: songwriting.id, sortOrder: i },
    });
  }

  // Guitar for Singers — single open category
  await db.lessonCategory.create({
    data: {
      slug: "open",
      title: "Open",
      description: "We'll start where you are and build from there.",
      lessonTypeId: guitar.id,
      sortOrder: 0,
    },
  });

  // ─── Availability Slots (every day, every hour) ───

  for (let day = 0; day <= 6; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const start = `${String(hour).padStart(2, "0")}:00`;
      const next = (hour + 1) % 24;
      const end = `${String(next).padStart(2, "0")}:00`;
      await db.availabilitySlot.create({
        data: { dayOfWeek: day, startTime: start, endTime: end, isActive: true },
      });
    }
  }

  // ─── Admin User ───

  await db.user.upsert({
    where: { email: "zachvoltz@gmail.com" },
    update: { role: "ADMIN" },
    create: {
      email: "zachvoltz@gmail.com",
      name: "Zach Voltz",
      role: "ADMIN",
    },
  });

  console.log("Seeded: 3 lesson types, 14 categories, 40 availability slots, 1 admin user");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
