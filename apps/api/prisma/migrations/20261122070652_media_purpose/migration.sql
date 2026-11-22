-- CreateEnum
CREATE TYPE "MediaPurpose" AS ENUM ('AVATAR', 'COVER', 'POST', 'REEL', 'STORY', 'MESSAGE', 'COMMUNITY', 'AI');

-- AlterTable
ALTER TABLE "media_assets" ADD COLUMN     "purpose" "MediaPurpose" NOT NULL DEFAULT 'POST';
