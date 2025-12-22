-- Ensure Row has denormalized search support (values jsonb + searchText) and is indexed for fast contains search.

-- Add missing columns (safe for existing DBs).
ALTER TABLE "Row" ADD COLUMN IF NOT EXISTS "clientRowId" TEXT;
ALTER TABLE "Row" ADD COLUMN IF NOT EXISTS "values" JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE "Row" ADD COLUMN IF NOT EXISTS "searchText" TEXT;

-- Backfill searchText from values (jsonb), normalize: lowercase + collapse whitespace.
-- This will also populate searchText for legacy rows that never had it computed.
UPDATE "Row" r
SET "searchText" = (
  SELECT
    lower(regexp_replace(trim(coalesce(string_agg(v.value, ' '), '')), '\s+', ' ', 'g'))
  FROM jsonb_each_text(r."values") AS v(key, value)
)
WHERE COALESCE(r."searchText", '') = '';

-- Enforce non-null + default (matches Prisma schema).
UPDATE "Row" SET "searchText" = '' WHERE "searchText" IS NULL;
ALTER TABLE "Row" ALTER COLUMN "searchText" SET DEFAULT '';
ALTER TABLE "Row" ALTER COLUMN "searchText" SET NOT NULL;

-- Helpful composite index for stable cursor paging (order ASC, id ASC).
CREATE INDEX IF NOT EXISTS "Row_tableId_order_id_idx" ON "Row" ("tableId", "order", "id");

-- Ensure the idempotency unique index exists (nullable clientRowId is fine).
CREATE UNIQUE INDEX IF NOT EXISTS "Row_tableId_clientRowId_key" ON "Row" ("tableId", "clientRowId");

-- Trigram extension + GIN trigram index for fast ILIKE '%q%' search at scale.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "row_search_trgm" ON "Row" USING GIN ("searchText" gin_trgm_ops);


