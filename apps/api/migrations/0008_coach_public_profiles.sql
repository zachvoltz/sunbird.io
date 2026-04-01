-- Coach public profile fields
ALTER TABLE "User" ADD COLUMN "slug" TEXT;
ALTER TABLE "User" ADD COLUMN "headline" TEXT;
ALTER TABLE "User" ADD COLUMN "longBio" TEXT;
ALTER TABLE "User" ADD COLUMN "coverImageUrl" TEXT;
ALTER TABLE "User" ADD COLUMN "credentials" TEXT;
ALTER TABLE "User" ADD COLUMN "socialLinks" TEXT;
ALTER TABLE "User" ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "User_slug_key" ON "User"("slug");
