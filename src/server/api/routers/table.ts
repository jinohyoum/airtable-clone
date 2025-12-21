import { z } from "zod";
import { faker } from "@faker-js/faker";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

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

      // Generate ~200 rows with faker data, then create empty rows for the rest
      // For now, create 3 rows: first with faker data, rest empty
      const statusChoices = ["Todo", "In Progress", "Done"];
      const numRowsWithFaker = 1;
      const totalRows = 3;
      
      for (let i = 0; i < totalRows; i++) {
        // Build values JSONB object keyed by columnId
        const values: Record<string, string> = {};
        
        // Only first row(s) get faker data
        if (i < numRowsWithFaker) {
          for (const column of table.columns) {
            switch (column.name) {
              case "Name":
                values[column.id] = faker.person.fullName();
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

  // Bulk insert rows - optimized for 100k+ rows
  bulkInsertRows: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        count: z.number().min(1).max(1000000).default(100000),
        startOrderOffset: z.number().optional(), // Optional offset for sequential calls
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Get table with columns
        const table = await ctx.db.table.findUnique({
          where: { id: input.tableId },
          include: {
            columns: {
              orderBy: { order: "asc" },
            },
          },
        });

        if (!table) throw new Error("Table not found");

        // Get current max order (only if not provided as offset)
        let startOrder: number;
        if (input.startOrderOffset !== undefined) {
          // Use provided offset (for sequential client-side calls)
          const lastRow = await ctx.db.row.findFirst({
            where: { tableId: input.tableId },
            orderBy: { order: "desc" },
            select: { order: true },
          });
          startOrder = (lastRow?.order ?? -1) + 1 + input.startOrderOffset;
        } else {
          // Calculate from scratch (standalone call)
          const lastRow = await ctx.db.row.findFirst({
            where: { tableId: input.tableId },
            orderBy: { order: "desc" },
            select: { order: true },
          });
          startOrder = (lastRow?.order ?? -1) + 1;
        }

        // Find columns for faker data
        const nameColumn = table.columns.find((c) => c.name === "Name");
        const assigneeColumn = table.columns.find((c) => c.name === "Assignee");
        const statusColumn = table.columns.find((c) => c.name === "Status");
        const statusChoices = ["Todo", "In Progress", "Done"];

        // Generate rows in chunks to avoid timeouts
        const chunkSize = 5000; // Chunk size for inserts
        const numRowsWithFaker = 200; // Only first 200 rows get faker data
        const totalRows = input.count;
        let totalInserted = 0;

        // Process in chunks
        for (let chunkStart = 0; chunkStart < totalRows; chunkStart += chunkSize) {
          const chunkEnd = Math.min(chunkStart + chunkSize, totalRows);
          const chunkRows = [];

          for (let i = chunkStart; i < chunkEnd; i++) {
            const values: Record<string, string> = {};
            
            // Calculate global index across all batches for faker data
            // Only first 200 rows globally (across all mutation calls) should have faker data
            const globalRowIndex = (input.startOrderOffset ?? 0) + i;

            // Only first 200 rows globally get faker data
            if (globalRowIndex < numRowsWithFaker) {
              if (nameColumn) {
                values[nameColumn.id] = faker.person.fullName();
              }
              if (assigneeColumn) {
                values[assigneeColumn.id] = faker.person.firstName();
              }
              if (statusColumn) {
                values[statusColumn.id] = faker.helpers.arrayElement(statusChoices);
              }

              // Initialize empty values for other columns
              for (const column of table.columns) {
                if (!values[column.id]) {
                  values[column.id] = "";
                }
              }
            } else {
              // Empty values for remaining rows
              for (const column of table.columns) {
                values[column.id] = "";
              }
            }

            chunkRows.push({
              tableId: input.tableId,
              order: startOrder + i,
              values: values,
            });
          }

          // Bulk insert chunk
          const result = await ctx.db.row.createMany({
            data: chunkRows,
            skipDuplicates: true, // Skip if there are any duplicates
          });
          
          totalInserted += result.count;
        }

        return {
          success: true,
          inserted: totalInserted,
          expected: totalRows,
        };
      } catch (error) {
        console.error("Bulk insert error:", error);
        throw new Error(`Failed to insert rows: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }),
});
