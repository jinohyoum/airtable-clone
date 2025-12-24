-- Add GIN index on Row.values for better JSONB query performance
CREATE INDEX IF NOT EXISTS "Row_values_gin_idx" ON "Row" USING gin ("values");

-- Add GIN index with jsonb_path_ops for specific key lookups (more efficient for containment queries)
CREATE INDEX IF NOT EXISTS "Row_values_path_ops_idx" ON "Row" USING gin ("values" jsonb_path_ops);
