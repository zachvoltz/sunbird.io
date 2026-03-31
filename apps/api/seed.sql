-- Seed data for Sunbird D1 database

-- Clear existing data
DELETE FROM "Booking";
DELETE FROM "SessionMessage";
DELETE FROM "SessionResource";
DELETE FROM "LessonCategory";
DELETE FROM "LessonType";
DELETE FROM "AvailabilitySlot";

-- Lesson Types
INSERT INTO "LessonType" ("id", "slug", "title", "subtitle", "description", "pricePerSession", "sortOrder", "createdAt")
VALUES
  ('lt_voice', 'voice', 'Voice', 'The instrument you already own.', 'Learn to sing the way you speak — honestly, with your whole body behind it. We''ll work on breath, tone, range, and the thing no one teaches: trusting the sound that''s already yours.', 8000, 0, datetime('now')),
  ('lt_songwriting', 'songwriting', 'Songwriting', 'From first line to finished thing.', 'Melody, lyrics, structure — but also the harder stuff: starting, staying with an idea, knowing when it''s done. We write in the room together. You leave with songs, not just notes about songs.', 8000, 1, datetime('now')),
  ('lt_guitar', 'guitar-for-singers', 'Guitar for Singers', 'Enough to accompany yourself.', 'You don''t need to be a guitarist. You need to be a singer who can play guitar. We''ll focus on chords, strumming, and accompaniment patterns that serve the song.', 8000, 2, datetime('now'));

-- Voice categories
INSERT INTO "LessonCategory" ("id", "lessonTypeId", "slug", "title", "description", "sortOrder")
VALUES
  ('cat_v1', 'lt_voice', 'just-getting-started', 'Just Getting Started', 'For people who''ve always wanted to sing but don''t know where to begin.', 0),
  ('cat_v2', 'lt_voice', 'tune-up', 'Tune-up', 'You can sing — you just want to get sharper, more consistent, more confident.', 1),
  ('cat_v3', 'lt_voice', 'breath', 'Breath', 'Deep dive into breath support, control, and the connection between air and sound.', 2),
  ('cat_v4', 'lt_voice', 'telling-a-story', 'Telling a Story', 'Singing with intention. Making every word land.', 3),
  ('cat_v5', 'lt_voice', 'performance', 'Performance', 'Presence, phrasing, how to hold a room without holding your breath. We work on what happens between songs, too.', 4),
  ('cat_v6', 'lt_voice', 'yoga-for-singers', 'Yoga for Singers', 'Breath, alignment, and release — blending yoga with vocal warm-ups to help you sing from a more open, grounded place.', 5);

-- Songwriting categories
INSERT INTO "LessonCategory" ("id", "lessonTypeId", "slug", "title", "description", "sortOrder")
VALUES
  ('cat_s1', 'lt_songwriting', 'my-first-song', 'My First Song', 'You''ve never written a song. Let''s change that.', 0),
  ('cat_s2', 'lt_songwriting', 'general-consult', 'General Consult', 'Bring what you''re working on. We''ll figure out what it needs.', 1),
  ('cat_s3', 'lt_songwriting', 'telling-a-story', 'Telling a Story', 'Narrative songwriting — structure, imagery, emotional arc.', 2),
  ('cat_s4', 'lt_songwriting', 'songwriting-habits', 'Songwriting Habits', 'Building a daily writing practice that actually sticks.', 3),
  ('cat_s5', 'lt_songwriting', 'my-first-epm', 'My First EPM', 'Planning and writing your first EP or collection of songs.', 4),
  ('cat_s6', 'lt_songwriting', 'theory', 'Theory', 'Chords, scales, rhythm, form — taught as tools for making, not rules for following. Understand why your favorite songs work.', 5),
  ('cat_s7', 'lt_songwriting', 'poetry-in-song', 'Poetry in Song', 'The line between a poem and a lyric is thinner than people think. For students who want their words to carry weight even without the melody.', 6);

-- Guitar for Singers — single open category
INSERT INTO "LessonCategory" ("id", "lessonTypeId", "slug", "title", "description", "sortOrder")
VALUES
  ('cat_g1', 'lt_guitar', 'open', 'Open', 'We''ll start where you are and build from there.', 0);

-- Availability Slots (weekdays 9am-5pm, 1-hour blocks)
INSERT INTO "AvailabilitySlot" ("id", "dayOfWeek", "startTime", "endTime", "isActive")
VALUES
  ('as_1_09', 1, '09:00', '10:00', 1),
  ('as_1_10', 1, '10:00', '11:00', 1),
  ('as_1_11', 1, '11:00', '12:00', 1),
  ('as_1_12', 1, '12:00', '13:00', 1),
  ('as_1_13', 1, '13:00', '14:00', 1),
  ('as_1_14', 1, '14:00', '15:00', 1),
  ('as_1_15', 1, '15:00', '16:00', 1),
  ('as_1_16', 1, '16:00', '17:00', 1),
  ('as_2_09', 2, '09:00', '10:00', 1),
  ('as_2_10', 2, '10:00', '11:00', 1),
  ('as_2_11', 2, '11:00', '12:00', 1),
  ('as_2_12', 2, '12:00', '13:00', 1),
  ('as_2_13', 2, '13:00', '14:00', 1),
  ('as_2_14', 2, '14:00', '15:00', 1),
  ('as_2_15', 2, '15:00', '16:00', 1),
  ('as_2_16', 2, '16:00', '17:00', 1),
  ('as_3_09', 3, '09:00', '10:00', 1),
  ('as_3_10', 3, '10:00', '11:00', 1),
  ('as_3_11', 3, '11:00', '12:00', 1),
  ('as_3_12', 3, '12:00', '13:00', 1),
  ('as_3_13', 3, '13:00', '14:00', 1),
  ('as_3_14', 3, '14:00', '15:00', 1),
  ('as_3_15', 3, '15:00', '16:00', 1),
  ('as_3_16', 3, '16:00', '17:00', 1),
  ('as_4_09', 4, '09:00', '10:00', 1),
  ('as_4_10', 4, '10:00', '11:00', 1),
  ('as_4_11', 4, '11:00', '12:00', 1),
  ('as_4_12', 4, '12:00', '13:00', 1),
  ('as_4_13', 4, '13:00', '14:00', 1),
  ('as_4_14', 4, '14:00', '15:00', 1),
  ('as_4_15', 4, '15:00', '16:00', 1),
  ('as_4_16', 4, '16:00', '17:00', 1),
  ('as_5_09', 5, '09:00', '10:00', 1),
  ('as_5_10', 5, '10:00', '11:00', 1),
  ('as_5_11', 5, '11:00', '12:00', 1),
  ('as_5_12', 5, '12:00', '13:00', 1),
  ('as_5_13', 5, '13:00', '14:00', 1),
  ('as_5_14', 5, '14:00', '15:00', 1),
  ('as_5_15', 5, '15:00', '16:00', 1),
  ('as_5_16', 5, '16:00', '17:00', 1);

-- Admin User
INSERT OR IGNORE INTO "User" ("id", "email", "name", "role", "createdAt", "updatedAt")
VALUES ('user_admin', 'zachvoltz@gmail.com', 'Zach Voltz', 'ADMIN', datetime('now'), datetime('now'));
