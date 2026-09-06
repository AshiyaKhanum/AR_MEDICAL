-- Add physical rack/shelf location to medicines
ALTER TABLE "medicines" ADD COLUMN IF NOT EXISTS "rackNumber" TEXT;
