/*
  Warnings:

  - A unique constraint covering the columns `[originalFileName]` on the table `Item` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Item_originalFileName_key" ON "Item"("originalFileName");
