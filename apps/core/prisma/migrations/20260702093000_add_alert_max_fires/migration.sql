-- AlterTable: recurring alerts can cap their repeat count (null = unlimited)
ALTER TABLE "Alert" ADD COLUMN "maxFires" INTEGER;
