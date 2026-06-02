-- A coach's invitation of a student by email — the first explicit coach→student
-- link (the sidebar student list is otherwise derived from bookings). A PENDING
-- invite renders as a gray entry in the coach's sidebar and flips to ACCEPTED
-- (gaining a studentId) once the invited person logs in with that email. An
-- invite for an email that already has an account is created ACCEPTED directly.
CREATE TABLE "StudentInvite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "coachId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "token" TEXT NOT NULL,
    "studentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" DATETIME,
    CONSTRAINT "StudentInvite_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentInvite_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "StudentInvite_token_key" ON "StudentInvite"("token");
CREATE UNIQUE INDEX "StudentInvite_coachId_email_key" ON "StudentInvite"("coachId", "email");
CREATE INDEX "StudentInvite_coachId_status_idx" ON "StudentInvite"("coachId", "status");
CREATE INDEX "StudentInvite_email_status_idx" ON "StudentInvite"("email", "status");
