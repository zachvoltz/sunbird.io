import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  // Clear existing lesson data
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

  const yoga = await db.lessonType.create({
    data: {
      slug: "yoga-for-singers",
      title: "Yoga for Singers",
      subtitle: "Body and voice together.",
      description:
        "Breath, alignment, and release — specifically for people who use their voice. Each session blends yoga with vocal warm-ups to help you sing from a more open, grounded place.",
      pricePerSession: 8000,
      sortOrder: 2,
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
      sortOrder: 3,
    },
  });

  // ─── Lesson Categories ───

  // Voice categories
  const voiceCategories = [
    { slug: "just-getting-started", title: "Just Getting Started", description: "For people who've always wanted to sing but don't know where to begin." },
    { slug: "tune-up", title: "Tune-up", description: "You can sing — you just want to get sharper, more consistent, more confident." },
    { slug: "breath", title: "Breath", description: "Deep dive into breath support, control, and the connection between air and sound." },
    { slug: "telling-a-story", title: "Telling a Story", description: "Singing with intention. Making every word land." },
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
  ];

  for (let i = 0; i < songwritingCategories.length; i++) {
    await db.lessonCategory.create({
      data: { ...songwritingCategories[i], lessonTypeId: songwriting.id, sortOrder: i },
    });
  }

  // Yoga for Singers — single open category
  await db.lessonCategory.create({
    data: {
      slug: "open",
      title: "Open",
      description: "We'll tailor the session to what your body and voice need that day.",
      lessonTypeId: yoga.id,
      sortOrder: 0,
    },
  });

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

  // ─── Availability Slots (weekdays 9am-5pm, 1-hour blocks) ───

  for (let day = 1; day <= 5; day++) {
    for (let hour = 9; hour < 17; hour++) {
      const start = `${String(hour).padStart(2, "0")}:00`;
      const end = `${String(hour + 1).padStart(2, "0")}:00`;
      await db.availabilitySlot.create({
        data: { dayOfWeek: day, startTime: start, endTime: end, isActive: true },
      });
    }
  }

  console.log("Seeded: 4 lesson types, 11 categories, 40 availability slots");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
