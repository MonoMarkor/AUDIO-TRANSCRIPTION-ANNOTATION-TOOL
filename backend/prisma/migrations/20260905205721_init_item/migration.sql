-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE', 'REJECTED');

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "audioPath" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "status" "ItemStatus" NOT NULL DEFAULT 'PENDING',
    "durationSeconds" DOUBLE PRECISION,
    "sampleRate" INTEGER,
    "channels" INTEGER,
    "bitDepth" INTEGER,
    "originalTranscript" TEXT,
    "correctedTranscript" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);
