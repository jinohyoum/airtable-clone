import { z } from "zod";
import { faker } from "@faker-js/faker";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { Prisma } from "../../../generated/prisma";

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

      // Update the row's values JSONB column using $executeRaw for reliability
      // This works even if Prisma client hasn't regenerated
      await ctx.db.$executeRaw`
        UPDATE "Row" 
        SET "values" = ${JSON.stringify(updatedValues)}::jsonb,
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
        cursor: z.string().optional(), // Last row ID from previous page
      }),
    )
    .query(async ({ ctx, input }) => {
      const { tableId, limit, cursor } = input;

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

      // Get cursor row's order value if cursor is provided
      let cursorRow: { order: number; id: string } | null = null;
      if (cursor) {
        cursorRow = await ctx.db.row.findUnique({
          where: { id: cursor },
          select: { order: true, id: true },
        });
      }

      // Fetch rows with cursor-based pagination
      // Using order + id for stable sorting (even if multiple rows have same order)
      const rowsData = await ctx.db.row.findMany({
        where: {
          tableId,
          // If cursor provided, fetch rows after that cursor
          ...(cursorRow
            ? {
                OR: [
                  {
                    // Rows with order greater than cursor
                    order: { gt: cursorRow.order },
                  },
                  {
                    // Rows with same order but greater ID (stable sort)
                    order: cursorRow.order,
                    id: { gt: cursorRow.id },
                  },
                ],
              }
            : {}),
        },
        orderBy: [{ order: "asc" }, { id: "asc" }],
        take: limit + 1, // Fetch one extra to determine if there's a next page
      });

      // Determine if there are more pages
      let nextCursor: string | undefined = undefined;
      let rows = rowsData;
      if (rows.length > limit) {
        const nextItem = rows.pop(); // Remove the extra item
        nextCursor = nextItem?.id;
      }

      // Get total count for virtualizer (only on first page for performance)
      // We return it on every page so the client always has the latest count
      const totalCount = await ctx.db.row.count({
        where: { tableId },
      });

      // Transform JSONB values to cells array for backward compatibility
      const rowsWithCells = rows.map((row) => {
        const values = (row.values as Record<string, string | null | undefined>) ?? {};
        const cells = table.columns.map((column) => {
          const cellValue = values[column.id];
          return {
            id: `${row.id}-${column.id}`, // Synthetic ID
            value: (cellValue !== null && cellValue !== undefined ? cellValue : "") as string,
            rowId: row.id,
            columnId: column.id,
            column: column,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          };
        });

        return {
          ...row,
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
    .input(z.object({ tableId: z.string() }))
    .query(async ({ ctx, input }) => {
      const count = await ctx.db.row.count({
        where: { tableId: input.tableId },
      });

      return { count };
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
            const result = await tx.$executeRaw`
              INSERT INTO "Row" ("id", "tableId", "order", "values", "searchText", "createdAt", "updatedAt")
              SELECT
                gen_random_uuid(),
                ${input.tableId}::text,
                ${orderStart} + s.i,
                '{}'::jsonb,
                NULL,
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
