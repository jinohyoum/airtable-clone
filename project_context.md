For ur task, I want u to do an Airtable clone. Use https://create.t3.gg/, deploy on Vercel.
Use the TanStack table library for the table UIs.
Use PostgreSQL for DB.
Just focus on the main page with tables, columns, and cells.
UI needs to match 1:1 with Airtable
You don’t have to implement all functionalities.
Be able to log in via Google and create bases. In each base, I can create tables.
Be able to dynamically add columns.
Text and Number type columns are fine for now
Editing cells, and the arrow keys + tab key should move me across the table smoothly
Creating a new table will show default rows and columns. User fakerjs for data
I want to see a table w/ 100k rows and scroll down without lag
Add a button I can click that will add 100k rows to my table.
Implement virtualized infinite scroll using TRPC’s hooks and TanStack virtualizer
I want to be able to search across all the cells. Make this act as a filter for the rows.
I want to be able to create a 'view' of a table and save the following configurations
Filters on columns: for both numbers (greater than, smaller than) and text (is not empty, is empty, contains, not contains, equal to)
Simple sorting on columns: for text A→Z, Z→A, for numbers, do decreasing or increasing
Search, filter, and sort have to be done at the database level
Can search through and hide/show columns.
Make sure there's a loading state
The ultimate goal - if there are 1m rows, it can still load without an issue!
Please send daily updates to the Slack channel and timestamp it with day 1, day 2, day 3 etc.
Disclaimer: Lyra will not be using your take home project for any commercial purposes.
7-day plan (ship something usable every day)

7-day plan (ship something usable every day)

Goal: An Airtable-style base/table editor focused on the main grid page (tables, columns, cells) with Google login, dynamic columns (Text/Number), spreadsheet UX, and DB-level search/filter/sort that stays fast at 100k now and 1m later via tRPC + virtualization + infinite paging.

Daily ritual (every day):

Ship a working increment to prod (Vercel).

Record a 1–2 min Loom walking through exactly what changed.

Slack message format: “Day X (YYYY-MM-DD HH:MM AEDT)” + 2–4 bullets + Loom link.

Goal: Airtable-style base/table grid with Google login, bases/tables, dynamic Text/Number columns, spreadsheet editing + keyboard nav, virtualized infinite scroll for 100k, DB-level search/filter/sort, saved views, hide/show columns, and loading states, with a path to 1m rows.

Day 1 — Scaffold + Auth + Deploy + Core routes + grid page shell
Build:

T3 scaffold (Next.js + TS + Tailwind + tRPC + Prisma + NextAuth)

Postgres (Neon) + Prisma schema (Base/Table/Column/Row/Cell/View)

Google OAuth + protected routes

Routes:
• / list Bases
• /base/[baseId] list Tables
• /base/[baseId]/table/[tableId] grid page shell

Deliverable:

Deployed and protected, login works, you can navigate to a grid shell page.

Day 2 — Airtable 1:1 UI (time-boxed) + create table defaults + basic grid render
UI:

Replicate Airtable layout/styling on the grid page (top bar, tabs, view bar, grid styling, active cell highlight, hover states).
Data:

“Create table” generates default columns + default rows using faker.

Render TanStack Table with this data (no virtualization yet).

Deliverable:

Create table → immediately see a grid that looks like Airtable with real-looking data.

Day 3 — Real CRUD + editable cells + loading states everywhere
Build:

tRPC + Prisma CRUD for bases/tables/columns/rows page fetch/cell upsert

Editable cells (click edit, blur/enter commit, esc cancel)

Loading states: initial load, creating table, saving cell, paging placeholder (even if paging comes later)

Deliverable:

Edit a cell → persists after refresh, with clear saving/loading feedback.

Day 4 — Spreadsheet UX (keyboard navigation + selection)
Build:

Arrow keys + Tab/Shift+Tab moves active cell

Keep active cell visible while navigating

Optimistic updates for edits

Deliverable:

Grid feels spreadsheet-fast for navigation + editing.

Day 5 — Virtualized infinite scroll + “+100k rows” button
Build:

tRPC useInfiniteQuery for rows paging

TanStack Virtual row virtualization

“+100k rows” server-side chunked inserts + progress/loading UI

Deliverable:

100k rows scroll smoothly without lag, paging is seamless, +100k doesn’t freeze UI.

Day 6 — DB-level global search + DB-level sorting
Build:

Global search across all cells at DB level (recommended: denormalized Row.searchText + indexes)

DB-level sorting:
• Text A→Z / Z→A
• Number ↑ / ↓

Ensure search + sort work with infinite query + virtualization

Deliverable:

Search filters rows instantly and stays smooth, sort works without client filtering.

Day 7 — Views + DB-level filters + hide/show columns + 1m-readiness hardening
Build:

View CRUD + config JSON persisted

Hide/show columns per view

DB-level filters:
• Text: is empty / not empty / contains / not contains / equals
• Number: > / < / equals

Hardening for 1m path:
• confirm indexes for paging/search/filter/sort
• stress test query patterns (EXPLAIN on worst-case)
• tighten loading/error/empty states + toasts

Deliverable:

Demo Loom: login → create base/table → +100k → scroll → edit → search → sort → filter → switch views → hide/show columns.

Scope fences (do not add):
• No attachments, formulas, collaborators, multi-select, comments, permissions, row reordering, or fancy Airtable automations.
• Only Text + Number columns.
• Search/filter/sort must be DB-level (never client filtering).