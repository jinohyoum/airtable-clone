import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const tableRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ baseId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.table.findMany({
        where: { baseId: input.baseId },
        orderBy: { createdAt: "desc" },
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
      // Create table with default columns
      return ctx.db.table.create({
        data: {
          baseId: input.baseId,
          name: input.name,
          columns: {
            create: [
              {
                name: "Name",
                type: "singleLineText",
                order: 0,
                options: null,
              },
              {
                name: "Notes",
                type: "longText",
                order: 1,
                options: null,
              },
              {
                name: "Assignee",
                type: "user",
                order: 2,
                options: null,
              },
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
              {
                name: "Attachments",
                type: "attachment",
                order: 4,
                options: null,
              },
            ],
          },
        },
        include: {
          columns: true,
        },
      });
    }),
});
