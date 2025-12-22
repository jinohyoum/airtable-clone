import { PrismaClient } from "../generated/prisma/index.js";

const db = new PrismaClient();

try {
  const table = await db.table.findFirst({
    select: { id: true, name: true, baseId: true },
    orderBy: { createdAt: "asc" },
  });

  console.log("table", table);

  if (table) {
    const rowCount = await db.row.count({ where: { tableId: table.id } });
    console.log("rowCount", rowCount);

    const rows = await db.row.findMany({
      where: { tableId: table.id },
      take: 3,
      orderBy: [{ order: "asc" }, { id: "asc" }],
    });
    console.log(
      "rows",
      rows.map((x) => ({
        id: x.id,
        order: x.order,
        searchText: x.searchText,
        values: x.values,
      })),
    );
  }
} finally {
  await db.$disconnect();
}


