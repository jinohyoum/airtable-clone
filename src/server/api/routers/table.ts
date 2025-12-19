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

      // Generate 10 rows with faker data
      const statusChoices = ["Todo", "In Progress", "Done"];
      
      for (let i = 0; i < 10; i++) {
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

          // Generate appropriate faker data based on column type
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
              cellValue = ""; // Empty for now
              break;
            default:
              cellValue = "";
          }

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
});
