-- CreateEnum
CREATE TYPE "SpanType" AS ENUM ('NUMBER', 'FORMATTING_COMMAND', 'SPELLED_OUT', 'NAMED_ENTITY', 'MEDICAL_TERM', 'MEASUREMENT');

-- CreateTable
CREATE TABLE "AnnotationSpan" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "type" "SpanType" NOT NULL,
    "startOffset" INTEGER NOT NULL,
    "endOffset" INTEGER NOT NULL,
    "attributes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnnotationSpan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnnotationSpan_itemId_idx" ON "AnnotationSpan"("itemId");

-- AddForeignKey
ALTER TABLE "AnnotationSpan" ADD CONSTRAINT "AnnotationSpan_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
