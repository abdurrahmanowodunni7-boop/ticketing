/*
  Warnings:

  - You are about to drop the column `platformFeeKobo` on the `Order` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "FeeMethod" AS ENUM ('PERCENTAGE', 'FIXED_TIERS');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "feeMethod" "FeeMethod" NOT NULL DEFAULT 'PERCENTAGE';

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "platformFeeKobo",
ADD COLUMN     "serviceFeeKobo" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "subtotalKobo" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "FeeSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "percent" DOUBLE PRECISION NOT NULL DEFAULT 5,

    CONSTRAINT "FeeSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeTier" (
    "id" TEXT NOT NULL,
    "upToKobo" INTEGER NOT NULL,
    "feeKobo" INTEGER NOT NULL,

    CONSTRAINT "FeeTier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeeTier_upToKobo_key" ON "FeeTier"("upToKobo");
