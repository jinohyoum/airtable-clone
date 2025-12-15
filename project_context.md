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

Day 1 — Scaffold + Auth + Deploy + Core routes

Scaffold with npm create t3-app@latest (Next.js + TS + Tailwind + tRPC + Prisma + NextAuth). 
GitHub
+1

Google OAuth (NextAuth) + protected routes; verify callback URLs. 
Create T3 App
+1

Postgres + Prisma schema (Base/Table/Column/Row/Cell/View).

Routes live:

/ list Bases

/base/[baseId] list Tables

/base/[baseId]/table/[tableId] grid page shell

Deliverable: Vercel deploy works; login → create base → create table → land on empty grid page.

Slack update: “Day 1 (YYYY-MM-DD HH:MM AEDT)” + Loom link.

Day 2 — Data model wired + Create table defaults (faker) + Basic grid render

tRPC routers: base/table CRUD, column add, row/page fetch, cell upsert.

“Create table” generates default columns + default rows using faker.

Render a basic TanStack Table grid (no virtualization yet) with editable cell UI.

Deliverable: Create table → see rows/columns filled with faker data; editing a cell persists.

Day 3 — Spreadsheet UX (editing + keyboard navigation)

Single-cell editing behavior (enter to edit, esc cancel, blur commit).

Arrow keys + Tab/Shift+Tab move active cell; keep selection visible (scrollIntoView).

Optimistic update for cell edits + loading state for saves.

Deliverable: Grid feels spreadsheet-like (fast navigation + edits).

Day 4 — Virtualized infinite scroll + “+100k rows” button

Implement useInfiniteQuery on tRPC for row paging. 
trpc.io
+1

Row virtualization with TanStack Virtual (useVirtualizer). 
TanStack
+1

Add “+100k rows” button (server-side chunked inserts) + progress/loading UI.

Deliverable: 100k rows scroll smoothly; fetching pages is seamless; loading skeleton shows.

Day 5 — DB-level global search (filters rows)

Search box filters rows at the DB level (not client filtering).

Implement a scalable approach (recommended: Row.searchText denormalized + indexed) so 100k→1m stays viable.

Deliverable: Search instantly narrows rows while keeping virtualization + infinite query.

Day 6 — Views (save config) + DB-level filter/sort + hide/show columns

View CRUD + config JSON persisted.

Column hide/show per view.

DB-level filters:

Text: is empty / not empty / contains / not contains / equals

Number: > / < / equals

DB-level sorting:

Text A→Z / Z→A

Number ↑ / ↓

Deliverable: Switch views and see saved search/filter/sort/hidden columns applied.

Day 7 — Airtable 1:1 polish + performance hardening

UI polish to match Airtable layout (top bar, tabs, view selector, search placement, grid styling).

Add/verify indexes; stress test to “1m rows” workflow (paging + search + filter + sort).

Improve loading states, empty states, error toasts.

Deliverable: “Demo day” Loom: create base/table → +100k → scroll → edit → search → view configs.