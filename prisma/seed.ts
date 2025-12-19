import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Get the first user (you need to be logged in first)
  const user = await prisma.user.findFirst();
  
  if (!user) {
    console.error('❌ No user found. Please sign in first, then run the seed again.');
    process.exit(1);
  }

  console.log(`✅ Found user: ${user.email}`);

  // Create a test base
  const base = await prisma.base.create({
    data: {
      name: 'My Test Base',
      userId: user.id,
    },
  });

  console.log(`✅ Created base: ${base.name} (ID: ${base.id})`);

  // Create a test table with default columns
  const table = await prisma.table.create({
    data: {
      name: 'Projects',
      baseId: base.id,
      columns: {
        create: [
          {
            name: 'Name',
            type: 'singleLineText',
            order: 0,
            options: null,
          },
          {
            name: 'Notes',
            type: 'longText',
            order: 1,
            options: null,
          },
          {
            name: 'Assignee',
            type: 'user',
            order: 2,
            options: null,
          },
          {
            name: 'Status',
            type: 'singleSelect',
            order: 3,
            options: JSON.stringify({
              choices: [
                { id: 'todo', name: 'Todo', color: 'gray' },
                { id: 'in-progress', name: 'In Progress', color: 'blue' },
                { id: 'done', name: 'Done', color: 'green' },
              ],
            }),
          },
          {
            name: 'Attachments',
            type: 'attachment',
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

  console.log(`✅ Created table: ${table.name} with ${table.columns.length} columns`);
  console.log('\n🎉 Seeding complete!');
  console.log(`\n🔗 Visit: http://localhost:3000/base/${base.id}/table/${table.id}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
