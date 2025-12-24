import { z } from "zod";
import { faker } from "@faker-js/faker";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { Prisma } from "../../../../generated/prisma";

function computeSearchText(values: Record<string, unknown>) {
  const toSearchString = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    if (typeof v === "string") return v;
    if (typeof v === "number" || typeof v === "boolean" || typeof v === "bigint")
      return String(v);
    if (v instanceof Date) return v.toISOString();
    if (Array.isArray(v)) return v.map(toSearchString).filter(Boolean).join(" ");
    if (typeof v === "object") {
      try {
        return JSON.stringify(v);
      } catch {
        return "";
      }
    }
    return "";
  };

  const parts: string[] = [];
  for (const v of Object.values(values)) {
    const s = toSearchString(v);
    if (!s) continue;
    parts.push(s);
  }
  return parts.join(" ").toLowerCase().replace(/\s+/g, " ").trim();
}

export const tableRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ baseId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.table.findMany({
        where: { baseId: input.baseId },
        orderBy: { createdAt: "asc" }, // Oldest first, so new tables appear on the right
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        baseId: z.string(),
        name: z.string().min(1),
        recordTerm: z.string().optional().default("Record"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Define columns to create
      const columnsToCreate = [
        { name: "Name", type: "singleLineText", order: 0, options: null },
        { name: "Notes", type: "longText", order: 1, options: null },
        { name: "Assignee", type: "user", order: 2, options: null },
        {
          name: "Status",
          type: "singleSelect",
          order: 3,
          options: JSON.stringify({
            choices: [
              { id: "todo", name: "Todo", color: "gray" },
              { id: "in-progress", name: "In Progress", color: "blue" },
              { id: "done", name: "Done", color: "green" },
            ],
          }),
        },
        { name: "Attachments", type: "attachment", order: 4, options: null },
      ];

      // Create table with columns
      const table = await ctx.db.table.create({
        data: {
          baseId: input.baseId,
          name: input.name,
          columns: {
            create: columnsToCreate,
          },
        },
        include: {
          columns: {
            orderBy: { order: "asc" },
          },
        },
      });

      // Generate 3 rows with faker data for initial table creation
      const statusChoices = ["Todo", "In Progress", "Done"];
      const totalRows = 3;
      
      for (let i = 0; i < totalRows; i++) {
        // Build values JSONB object keyed by columnId
        const values: Record<string, string> = {};
        
        // All rows get faker data
        for (const column of table.columns) {
          switch (column.name) {
            case "Name":
              values[column.id] = faker.person.fullName();
              break;
            case "Notes":
              values[column.id] = faker.lorem.sentence();
              break;
            case "Assignee":
              values[column.id] = faker.person.firstName();
              break;
            case "Status":
              values[column.id] = faker.helpers.arrayElement(statusChoices);
              break;
            default:
              values[column.id] = "";
          }
        }

        // Create row with JSONB values
        await ctx.db.row.create({
          data: {
            tableId: table.id,
            order: i,
            values: values,
            searchText: computeSearchText(values),
          },
        });
      }

      return table;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      
      return ctx.db.table.update({
        where: { id },
        data,
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Ensure it exists (gives a nicer error than a generic Prisma error)
      const table = await ctx.db.table.findUnique({
        where: { id: input.id },
        select: { id: true },
      });

      if (!table) {
        throw new Error("Table not found");
      }

      // Relations are configured with onDelete: Cascade in Prisma schema,
      // so columns/rows/cells/views are removed automatically.
      await ctx.db.table.delete({
        where: { id: input.id },
      });

      return { id: input.id };
    }),

  getData: protectedProcedure
    .input(z.object({ tableId: z.string() }))
    .query(async ({ ctx, input }) => {
      const table = await ctx.db.table.findUnique({
        where: { id: input.tableId },
        include: {
          columns: {
            orderBy: { order: "asc" },
          },
          rows: {
            orderBy: { order: "asc" },
            include: {
              cells: {
                include: {
                  column: true,
                },
              },
            },
          },
        },
      });

      if (!table) throw new Error("Table not found");

      return table;
    }),

  createRow: protectedProcedure
    .input(z.object({ 
      tableId: z.string(),
      clientRowId: z.string(), // Client-generated UUID for idempotency
      afterRowId: z.string().optional(), // Insert after this row (Shift+Enter behavior)
    }))
    .mutation(async ({ ctx, input }) => {
      // Check if this row already exists (idempotency)
      const existingRow = await ctx.db.row.findUnique({
        where: {
          tableId_clientRowId: {
            tableId: input.tableId,
            clientRowId: input.clientRowId,
          },
        },
        include: {
          cells: {
            include: {
              column: true,
            },
          },
        },
      });

      // If row already exists, return it (idempotent)
      if (existingRow) {
        return existingRow;
      }

      // Get table with columns and last row for ordering
      const table = await ctx.db.table.findUnique({
        where: { id: input.tableId },
        include: {
          columns: { orderBy: { order: "asc" } },
          rows: { orderBy: { order: "desc" }, take: 1 },
        },
      });

      if (!table) throw new Error("Table not found");

      // Create row either appended (default) or inserted after a specific row.
      // Order is an Int, so insertion requires shifting subsequent rows.
      const row = await ctx.db.$transaction(async (tx) => {
        let orderToUse: number;

        if (input.afterRowId) {
          const after = await tx.row.findFirst({
            where: { id: input.afterRowId, tableId: input.tableId },
            select: { order: true },
          });

          if (!after) {
            // Fallback: if the target row doesn't exist, append.
            orderToUse = (table.rows[0]?.order ?? -1) + 1;
          } else {
            orderToUse = after.order + 1;

            // Shift rows at/after the insert point down by 1.
            await tx.row.updateMany({
              where: { tableId: input.tableId, order: { gte: orderToUse } },
              data: { order: { increment: 1 } },
            });
          }
        } else {
          // Append at end.
          orderToUse = (table.rows[0]?.order ?? -1) + 1;
        }

        // Initialize empty values JSONB for all columns
        const values: Record<string, string> = {};
        for (const column of table.columns) {
          values[column.id] = "";
        }

        return tx.row.create({
          data: {
            tableId: input.tableId,
            order: orderToUse,
            clientRowId: input.clientRowId,
            values: values,
            searchText: computeSearchText(values),
          },
        });
      });

      // Transform JSONB values to cells array for backward compatibility with frontend
      const cells = table.columns.map((column) => ({
        id: `${row.id}-${column.id}`, // Generate synthetic ID
        value: (row.values as Record<string, string>)[column.id] ?? "",
        rowId: row.id,
        columnId: column.id,
        column: column,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }));

      return {
        ...row,
        cells,
      };
    }),

  deleteRow: protectedProcedure
    .input(
      z.object({
        rowId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Find the row so we can return minimal info (and validate it exists)
      const row = await ctx.db.row.findUnique({
        where: { id: input.rowId },
        select: {
          id: true,
          tableId: true,
        },
      });

      if (!row) {
        throw new Error("Row not found");
      }

      await ctx.db.row.delete({
        where: { id: input.rowId },
      });

      return {
        id: row.id,
        tableId: row.tableId,
      };
    }),

  updateCell: protectedProcedure
    .input(
      z.object({
        rowId: z.string(),
        columnId: z.string(),
        value: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Get current row - fetch without select to get all fields including values
      // (workaround until Prisma client is regenerated)
      const row = await ctx.db.row.findUnique({
        where: { id: input.rowId },
      });

      if (!row) throw new Error("Row not found");

      // Access values - use type assertion since Prisma client may not have regenerated
      const currentValues = ((row as { values?: unknown }).values as Record<string, string>) ?? {};
      const updatedValues = {
        ...currentValues,
        [input.columnId]: input.value,
      };

      const searchText = computeSearchText(updatedValues);

      // Update the row's values JSONB column using $executeRaw for reliability
      // This works even if Prisma client hasn't regenerated
      await ctx.db.$executeRaw`
        UPDATE "Row" 
        SET "values" = ${JSON.stringify(updatedValues)}::jsonb,
            "searchText" = ${searchText},
            "updatedAt" = NOW()
        WHERE "id" = ${input.rowId}
      `;

      return {
        id: row.id,
        rowId: input.rowId,
        columnId: input.columnId,
        value: input.value,
      };
    }),

  // Cursor-based paging for rows (infinite scroll)
  getRows: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        limit: z.number().min(1).max(500).default(200),
        cursor: z
          .discriminatedUnion("mode", [
            z.object({
              mode: z.literal("order"),
              order: z.number(),
              id: z.string(),
            }),
            z.object({
              mode: z.literal("sort"),
              keys: z.array(
                z.object({
                  isBlank: z.boolean(),
                  sortKey: z.string(),
                }),
              ),
              id: z.string(),
            }),
          ])
          .optional(), // Last row from previous page (stable cursor)
        search: z.string().optional(),
        sortRules: z
          .array(
            z.object({
              columnId: z.string(),
              direction: z.enum(["asc", "desc"]),
            }),
          )
          .optional(),
        sortBy: z.string().optional(),
        sortDir: z.enum(["asc", "desc"]).optional(),
        filters: z
          .array(
            z.object({
              columnId: z.string(),
              operator: z.enum([
                "isEmpty",
                "isNotEmpty",
                "contains",
                "notContains",
                "equals",
                "greaterThan",
                "lessThan",
              ]),
              value: z.string().optional(),
            }),
          )
          .optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { tableId, limit } = input;
      const q = input.search?.trim();
      const search = q && q.length > 0 ? q : undefined;

      // Get columns to transform JSONB values to cells
      const table = await ctx.db.table.findUnique({
        where: { id: tableId },
        include: {
          columns: {
            orderBy: { order: "asc" },
          },
        },
      });

      if (!table) throw new Error("Table not found");

      const requestedRules =
        input.sortRules && input.sortRules.length > 0
          ? input.sortRules
          : input.sortBy && input.sortDir
            ? [{ columnId: input.sortBy, direction: input.sortDir }]
            : [];

      const validRules = requestedRules.filter((r) =>
        table.columns.some((c) => c.id === r.columnId),
      );
      const useSort = validRules.length > 0;

      const cursor = input.cursor;

      // Build filter SQL conditions
      // Each filter is AND-ed together (flat conditions)
      const filterConditions: Prisma.Sql[] = [];
      
      if (input.filters && input.filters.length > 0) {
        for (const filter of input.filters) {
          const { columnId, operator, value } = filter;
          const columnExists = table.columns.some((c) => c.id === columnId);
          if (!columnExists) continue; // Skip invalid column IDs

          // Get the JSONB value for this column
          const valueExpr = Prisma.sql`(r."values"->>${columnId})`;
          const trimmedExpr = Prisma.sql`btrim(COALESCE(${valueExpr}, ''))`;

          switch (operator) {
            case "isEmpty": {
              // Empty means: NULL or blank string
              filterConditions.push(
                Prisma.sql`(NULLIF(${trimmedExpr}, '') IS NULL)`,
              );
              break;
            }
            case "isNotEmpty": {
              // Not empty means: has a value that's not blank
              filterConditions.push(
                Prisma.sql`(NULLIF(${trimmedExpr}, '') IS NOT NULL)`,
              );
              break;
            }
            case "contains": {
              // Case-insensitive contains
              if (value !== undefined && value !== null) {
                filterConditions.push(
                  Prisma.sql`(${valueExpr} ILIKE '%' || ${value} || '%')`,
                );
              }
              break;
            }
            case "notContains": {
              // Does not contain (or is empty)
              if (value !== undefined && value !== null) {
                filterConditions.push(
                  Prisma.sql`(${valueExpr} IS NULL OR ${valueExpr} NOT ILIKE '%' || ${value} || '%')`,
                );
              }
              break;
            }
            case "equals": {
              // Exact match (case-insensitive for text, or numeric equality for numbers)
              if (value !== undefined && value !== null) {
                filterConditions.push(
                  Prisma.sql`(lower(${trimmedExpr}) = lower(${value}))`,
                );
              }
              break;
            }
            case "greaterThan": {
              // Number comparison: treat non-numeric as NULL/invalid
              if (value !== undefined && value !== null) {
                const numValue = parseFloat(value);
                if (!isNaN(numValue)) {
                  // Check if the cell value is numeric and greater than the filter value
                  filterConditions.push(
                    Prisma.sql`(
                      ${trimmedExpr} ~ '^-?[0-9]+(\\.[0-9]+)?$'
                      AND (${trimmedExpr})::numeric > ${numValue}
                    )`,
                  );
                }
              }
              break;
            }
            case "lessThan": {
              // Number comparison: treat non-numeric as NULL/invalid
              if (value !== undefined && value !== null) {
                const numValue = parseFloat(value);
                if (!isNaN(numValue)) {
                  // Check if the cell value is numeric and less than the filter value
                  filterConditions.push(
                    Prisma.sql`(
                      ${trimmedExpr} ~ '^-?[0-9]+(\\.[0-9]+)?$'
                      AND (${trimmedExpr})::numeric < ${numValue}
                    )`,
                  );
                }
              }
              break;
            }
          }
        }
      }

      const filterSql =
        filterConditions.length > 0
          ? Prisma.sql`AND (${Prisma.join(filterConditions, " AND ")})`
          : Prisma.empty;

      // Search behavior (take-home spec): case-insensitive "contains" across ALL cell values.
      // We do this directly against the JSONB `values` column so search works even if `searchText`
      // is stale/empty for older data.
      const searchSql = search
        ? Prisma.sql`AND EXISTS (
            SELECT 1
            FROM jsonb_each_text(r."values") AS kv(key, value)
            WHERE kv.value ILIKE '%' || ${search} || '%'
          )`
        : Prisma.empty;

      const baseSelect = Prisma.sql`
        SELECT r."id", r."order", r."createdAt", r."updatedAt", r."tableId", r."clientRowId", r."searchText", r."values"
      `;

      // Fetch rows with cursor-based pagination.
      // Note: we use raw SQL here for JSONB searching + sorting.
      let rowsData:
        | Array<{
            id: string;
            order: number;
            createdAt: Date;
            updatedAt: Date;
            tableId: string;
            clientRowId: string | null;
            searchText: string;
            values: unknown;
          }>
        | Array<{
            id: string;
            order: number;
            createdAt: Date;
            updatedAt: Date;
            tableId: string;
            clientRowId: string | null;
            searchText: string;
            values: unknown;
            __sortKeys: unknown;
          }>;

      if (!useSort) {
        const cursorSql =
          cursor?.mode === "order"
            ? Prisma.sql`AND (r."order" > ${cursor.order} OR (r."order" = ${cursor.order} AND r."id" > ${cursor.id}))`
            : Prisma.empty;

        const rowsQuery = Prisma.sql`
          ${baseSelect}
          FROM "Row" r
          WHERE r."tableId" = ${tableId}
          ${filterSql}
          ${searchSql}
          ${cursorSql}
          ORDER BY r."order" ASC, r."id" ASC
          LIMIT ${limit + 1}
        `;

        rowsData = await ctx.db.$queryRaw<
          Array<{
            id: string;
            order: number;
            createdAt: Date;
            updatedAt: Date;
            tableId: string;
            clientRowId: string | null;
            searchText: string;
            values: unknown;
          }>
        >(rowsQuery);
      } else {
        // Build per-rule sort expressions (JSONB text, trimmed, blank grouping, lowercase key)
        const sortExprs = validRules.map((r) => {
          const valueExpr = Prisma.sql`(r."values"->>${r.columnId})`;
          const trimmedExpr = Prisma.sql`btrim(COALESCE(${valueExpr}, ''))`;
          const isBlankExpr = Prisma.sql`(NULLIF(${trimmedExpr}, '') IS NULL)`;
          const sortKeyExpr = Prisma.sql`lower(COALESCE(NULLIF(${trimmedExpr}, ''), ''))`;
          return { isBlankExpr, sortKeyExpr, direction: r.direction as "asc" | "desc" };
        });

        // Cursor must match rule count; otherwise ignore it (prevents mismatched pagination when rules change).
        const cursorOk =
          cursor?.mode === "sort" &&
          Array.isArray(cursor.keys) &&
          cursor.keys.length === sortExprs.length;

        // Build lexicographic keyset predicate for (isBlank1, sortKey1, isBlank2, sortKey2, ..., id)
        const cursorSql = (() => {
          if (!cursorOk) return Prisma.empty;

          const orParts: Prisma.Sql[] = [];
          const eqParts: Prisma.Sql[] = [];

          const pushCmp = (expr: Prisma.Sql, dir: "asc" | "desc", val: unknown) => {
            const op = dir === "desc" ? Prisma.sql`<` : Prisma.sql`>`;
            orParts.push(
              Prisma.sql`(${Prisma.join(eqParts, " AND ")}${eqParts.length ? Prisma.sql` AND ` : Prisma.empty}${expr} ${op} ${val})`,
            );
            eqParts.push(Prisma.sql`${expr} = ${val}`);
          };

          for (let i = 0; i < sortExprs.length; i++) {
            const k = cursor!.keys[i]!;
            // isBlank is always ASC (false first, true last)
            pushCmp(sortExprs[i]!.isBlankExpr, "asc", k.isBlank);
            // sortKey follows the rule direction
            pushCmp(sortExprs[i]!.sortKeyExpr, sortExprs[i]!.direction, k.sortKey);
          }

          // Stable tie-breaker: id ASC
          pushCmp(Prisma.sql`r."id"`, "asc", cursor!.id);

          return Prisma.sql`AND (${Prisma.join(orParts, " OR ")})`;
        })();

        // JSON array of per-rule key tuples so we can build nextCursor without relying on dynamic column names.
        const sortKeysJson = Prisma.sql`jsonb_build_array(${Prisma.join(
          sortExprs.map(
            (e) =>
              Prisma.sql`jsonb_build_object('isBlank', ${e.isBlankExpr}, 'sortKey', ${e.sortKeyExpr})`,
          ),
          ", ",
        )})`;

        const orderByParts: Prisma.Sql[] = [];
        for (const e of sortExprs) {
          orderByParts.push(Prisma.sql`${e.isBlankExpr} ASC`);
          orderByParts.push(
            Prisma.sql`${e.sortKeyExpr} ${e.direction === "desc" ? Prisma.sql`DESC` : Prisma.sql`ASC`}`,
          );
        }
        orderByParts.push(Prisma.sql`r."id" ASC`);

        const rowsQuery = Prisma.sql`
          ${baseSelect},
            ${sortKeysJson} AS "__sortKeys"
          FROM "Row" r
          WHERE r."tableId" = ${tableId}
          ${filterSql}
          ${searchSql}
          ${cursorSql}
          ORDER BY ${Prisma.join(orderByParts, ", ")}
          LIMIT ${limit + 1}
        `;

        rowsData = await ctx.db.$queryRaw<
          Array<{
            id: string;
            order: number;
            createdAt: Date;
            updatedAt: Date;
            tableId: string;
            clientRowId: string | null;
            searchText: string;
            values: unknown;
            __sortKeys: unknown;
          }>
        >(rowsQuery);
      }

      // Determine if there are more pages
      const hasMore = rowsData.length > limit;
      const rows = rowsData.slice(0, limit);

      let nextCursor:
        | { mode: "order"; order: number; id: string }
        | { mode: "sort"; keys: Array<{ isBlank: boolean; sortKey: string }>; id: string }
        | undefined = undefined;

      if (hasMore && rows.length > 0) {
        const last = rows[rows.length - 1] as
          | {
              id: string;
              order: number;
            }
          | {
              id: string;
              order: number;
              __isBlank: boolean;
              __sortKey: string;
            };

        if (useSort) {
          const keys = Array.isArray((last as { __sortKeys?: unknown }).__sortKeys)
            ? ((last as { __sortKeys?: unknown }).__sortKeys as Array<{
                isBlank?: unknown;
                sortKey?: unknown;
              }>).map((k) => ({
                isBlank: Boolean(k?.isBlank),
                sortKey: String(k?.sortKey ?? ""),
              }))
            : [];

          nextCursor = {
            mode: "sort",
            keys,
            id: last.id,
          };
        } else {
          nextCursor = { mode: "order", order: last.order, id: last.id };
        }
      }

      // Total count for the virtualizer should ignore the cursor (it represents total matching rows).
      // We return it on every page so the client always has the latest count.
      const countQuery = Prisma.sql`
        SELECT COUNT(*) AS count
        FROM "Row" r
        WHERE r."tableId" = ${tableId}
        ${filterSql}
        ${searchSql}
      `;
      const totalCountResult = await ctx.db.$queryRaw<Array<{ count: bigint }>>(
        countQuery,
      );
      const totalCount = Number(totalCountResult?.[0]?.count ?? 0n);

      // Transform JSONB values to cells array for backward compatibility
      const rowsWithCells = rows.map((row) => {
        const values = (row.values as Record<string, string | null | undefined>) ?? {};
        const cells = table.columns.map((column) => {
          const cellValue = values[column.id];
          return {
            id: `${row.id}-${column.id}`, // Synthetic ID
            value: cellValue ?? "",
            rowId: row.id,
            columnId: column.id,
            column,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          };
        });

        return {
          id: row.id,
          order: row.order,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          tableId: row.tableId,
          clientRowId: row.clientRowId,
          searchText: row.searchText,
          values: row.values,
          cells,
        };
      });

      return {
        rows: rowsWithCells,
        nextCursor,
        totalCount,
      };
    }),

  // Get table metadata (columns only, for use with getRows)
  getTableMeta: protectedProcedure
    .input(z.object({ tableId: z.string() }))
    .query(async ({ ctx, input }) => {
      const table = await ctx.db.table.findUnique({
        where: { id: input.tableId },
        include: {
          columns: {
            orderBy: { order: "asc" },
          },
        },
      });

      if (!table) throw new Error("Table not found");

      return table;
    }),

  // Get total row count for a table
  getRowCount: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        search: z.string().optional(),
        filters: z
          .array(
            z.object({
              columnId: z.string(),
              operator: z.enum([
                "isEmpty",
                "isNotEmpty",
                "contains",
                "notContains",
                "equals",
                "greaterThan",
                "lessThan",
              ]),
              value: z.string().optional(),
            }),
          )
          .optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const q = input.search?.trim();
      const search = q && q.length > 0 ? q : undefined;

      // Build filter SQL (same logic as getRows)
      const filterConditions: Prisma.Sql[] = [];
      
      if (input.filters && input.filters.length > 0) {
        for (const filter of input.filters) {
          const { columnId, operator, value } = filter;
          
          const valueExpr = Prisma.sql`(r."values"->>${columnId})`;
          const trimmedExpr = Prisma.sql`btrim(COALESCE(${valueExpr}, ''))`;

          switch (operator) {
            case "isEmpty":
              filterConditions.push(
                Prisma.sql`(NULLIF(${trimmedExpr}, '') IS NULL)`,
              );
              break;
            case "isNotEmpty":
              filterConditions.push(
                Prisma.sql`(NULLIF(${trimmedExpr}, '') IS NOT NULL)`,
              );
              break;
            case "contains":
              if (value !== undefined && value !== null) {
                filterConditions.push(
                  Prisma.sql`(${valueExpr} ILIKE '%' || ${value} || '%')`,
                );
              }
              break;
            case "notContains":
              if (value !== undefined && value !== null) {
                filterConditions.push(
                  Prisma.sql`(${valueExpr} IS NULL OR ${valueExpr} NOT ILIKE '%' || ${value} || '%')`,
                );
              }
              break;
            case "equals":
              if (value !== undefined && value !== null) {
                filterConditions.push(
                  Prisma.sql`(lower(${trimmedExpr}) = lower(${value}))`,
                );
              }
              break;
            case "greaterThan":
              if (value !== undefined && value !== null) {
                const numValue = parseFloat(value);
                if (!isNaN(numValue)) {
                  filterConditions.push(
                    Prisma.sql`(
                      ${trimmedExpr} ~ '^-?[0-9]+(\\.[0-9]+)?$'
                      AND (${trimmedExpr})::numeric > ${numValue}
                    )`,
                  );
                }
              }
              break;
            case "lessThan":
              if (value !== undefined && value !== null) {
                const numValue = parseFloat(value);
                if (!isNaN(numValue)) {
                  filterConditions.push(
                    Prisma.sql`(
                      ${trimmedExpr} ~ '^-?[0-9]+(\\.[0-9]+)?$'
                      AND (${trimmedExpr})::numeric < ${numValue}
                    )`,
                  );
                }
              }
              break;
          }
        }
      }

      const filterSql =
        filterConditions.length > 0
          ? Prisma.sql`AND (${Prisma.join(filterConditions, " AND ")})`
          : Prisma.empty;

      const searchSql = search
        ? Prisma.sql`AND EXISTS (
            SELECT 1
            FROM jsonb_each_text(r."values") AS kv(key, value)
            WHERE kv.value ILIKE '%' || ${search} || '%'
          )`
        : Prisma.empty;

      const countQuery = Prisma.sql`
        SELECT COUNT(*) AS count
        FROM "Row" r
        WHERE r."tableId" = ${input.tableId}
        ${filterSql}
        ${searchSql}
      `;
      const result = await ctx.db.$queryRaw<Array<{ count: bigint }>>(countQuery);

      return { count: Number(result?.[0]?.count ?? 0n) };
    }),

  // Bulk insert rows - OPTIMIZED for 100k+ rows using DB-side generation
  bulkInsertRows: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        count: z.number().min(1).max(1000000).default(100000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const startTime = Date.now();
      
      try {
        // Wrap everything in a transaction for atomicity
        return await ctx.db.$transaction(async (tx) => {
          // Get table with columns
          const table = await tx.table.findUnique({
            where: { id: input.tableId },
            include: {
              columns: {
                orderBy: { order: "asc" },
              },
            },
          });

          if (!table) throw new Error("Table not found");

          // Use advisory lock to prevent race conditions on order calculation
          // This ensures concurrent bulk inserts don't collide on order values
          await tx.$executeRaw`
            SELECT pg_advisory_xact_lock(hashtext(${input.tableId}))
          `;

          // Use aggregate _max for faster order calculation
          const maxOrder = await tx.row.aggregate({
            where: { tableId: input.tableId },
            _max: { order: true },
          });
          const startOrder = (maxOrder._max.order ?? -1) + 1;

          // Find columns for faker data
          const nameColumn = table.columns.find((c) => c.name === "Name");
          const notesColumn = table.columns.find((c) => c.name === "Notes");
          const assigneeColumn = table.columns.find((c) => c.name === "Assignee");
          const statusColumn = table.columns.find((c) => c.name === "Status");
          const statusChoices = ["Todo", "In Progress", "Done"];

          const numRowsWithFaker = 1000; // First 1000 rows get faker data
          const totalRows = input.count;
          let totalInserted = 0;

          // PHASE 1: Insert first 1000 rows with faker data via createMany
          // Only include populated fields in JSONB (no empty strings)
          if (totalRows > 0 && numRowsWithFaker > 0) {
            const fakerRows = [];
            const fakerCount = Math.min(numRowsWithFaker, totalRows);

            for (let i = 0; i < fakerCount; i++) {
              const values: Record<string, string> = {};
              
              // Only include populated fields (no empty strings for other columns)
              if (nameColumn) {
                values[nameColumn.id] = faker.person.fullName();
              }
              if (notesColumn) {
                values[notesColumn.id] = faker.lorem.sentence();
              }
              if (assigneeColumn) {
                values[assigneeColumn.id] = faker.person.firstName();
              }
              if (statusColumn) {
                values[statusColumn.id] = faker.helpers.arrayElement(statusChoices);
              }

              fakerRows.push({
                tableId: input.tableId,
                order: startOrder + i,
                values: values, // Only populated fields, empty object {} for other columns
                searchText: computeSearchText(values),
              });
            }

            if (fakerRows.length > 0) {
              const result = await tx.row.createMany({
                data: fakerRows,
              });
              totalInserted += result.count;
            }
          }

          // PHASE 2: Insert remaining empty rows using generate_series (DB-side generation)
          // This is MUCH faster than building VALUES clauses or generating IDs in JS
          const emptyRowCount = totalRows - numRowsWithFaker;
          if (emptyRowCount > 0) {
            // Use generate_series to let PostgreSQL generate rows internally
            // This avoids:
            // - Generating 99k IDs in Node.js
            // - Building giant VALUES clauses
            // - Large payloads over DB connection
            // gen_random_uuid() is built-in PostgreSQL function (no extension needed)
            const orderStart = startOrder + numRowsWithFaker;
            
            // Use Prisma.sql for proper parameterization (safe from SQL injection)
            await tx.$executeRaw`
              INSERT INTO "Row" ("id", "tableId", "order", "values", "searchText", "createdAt", "updatedAt")
              SELECT
                gen_random_uuid(),
                ${input.tableId}::text,
                ${orderStart} + s.i,
                '{}'::jsonb,
                '',
                NOW(),
                NOW()
              FROM generate_series(0, ${emptyRowCount - 1}) AS s(i)
            `;
            
            totalInserted += emptyRowCount;
          }

          const duration = Date.now() - startTime;

          return {
            success: true,
            inserted: totalInserted,
            expected: totalRows,
            durationMs: duration,
          };
        }, {
          timeout: 60000, // 60 seconds - enough for 100k+ row inserts
        });
      } catch (error) {
        console.error("Bulk insert error:", error);
        throw new Error(`Failed to insert rows: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }),
});
