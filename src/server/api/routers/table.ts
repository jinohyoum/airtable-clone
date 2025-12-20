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

      // Generate 3 rows: 1 with faker data, 2 empty
      const statusChoices = ["Todo", "In Progress", "Done"];
      
      for (let i = 0; i < 3; i++) {
        // Create row
        const row = await ctx.db.row.create({
          data: {
            tableId: table.id,
            order: i,
          },
        });

        // Create cells for each column
        for (const column of table.columns) {
          let cellValue = "";

          // Only first row gets faker data
          if (i === 0) {
            switch (column.name) {
              case "Name":
                cellValue = faker.person.fullName();
                break;
              case "Notes":
                cellValue = faker.lorem.sentence();
                break;
              case "Assignee":
                cellValue = faker.person.firstName();
                break;
              case "Status":
                cellValue = faker.helpers.arrayElement(statusChoices);
                break;
              case "Attachments":
                cellValue = "";
                break;
              default:
                cellValue = "";
            }
          }
          // Rows 2 and 3 are empty (cellValue stays "")

          // Create cell
          await ctx.db.cell.create({
            data: {
              rowId: row.id,
              columnId: column.id,
              value: cellValue,
            },
          });
        }
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

      // Create row with next order number and clientRowId
      const nextOrder = (table.rows[0]?.order ?? -1) + 1;
      const row = await ctx.db.row.create({
        data: {
          tableId: input.tableId,
          order: nextOrder,
          clientRowId: input.clientRowId,
        },
      });

      // Create empty cells for each column
      const cells = [];
      for (const column of table.columns) {
        const cell = await ctx.db.cell.create({
          data: {
            rowId: row.id,
            columnId: column.id,
            value: "", // Empty cells for new rows
          },
          include: {
            column: true,
          },
        });
        cells.push(cell);
      }

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
      // Upsert: update if cell exists, create if it doesn't
      return ctx.db.cell.upsert({
        where: {
          rowId_columnId: {
            rowId: input.rowId,
            columnId: input.columnId,
          },
        },
        update: {
          value: input.value,
        },
        create: {
          rowId: input.rowId,
          columnId: input.columnId,
          value: input.value,
        },
      });
    }),
});
