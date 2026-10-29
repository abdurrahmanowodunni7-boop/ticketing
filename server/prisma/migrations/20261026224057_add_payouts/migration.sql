-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "platformFeeKobo" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accountLast4" TEXT,
ADD COLUMN     "accountName" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "subaccountCode" TEXT;
