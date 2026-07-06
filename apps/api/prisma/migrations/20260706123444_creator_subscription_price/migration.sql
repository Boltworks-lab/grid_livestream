-- AlterTable
ALTER TABLE "creator_profiles" ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "subPriceCents" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "creator_profiles_stripeCustomerId_key" ON "creator_profiles"("stripeCustomerId");

