# Academy Work Management

A small, local-first web app for tracking academic progress across semesters, modules, chapters, past papers and assessments, with visual progress tracking. Single user, no accounts, no cloud: everything is stored on your own machine.

> Status: early development. See [Roadmap](#roadmap).

## Concept

```
Semester -> Module -> Chapter -> Study activities
                 \-> Past papers, assessments, files
```

- **Chapters** are tracked with checklist-style activities (learned, notes made, questions done, revised, plus custom ones), a confidence rating, a last-reviewed date and a note.
- **Modules** hold past papers, assessments (with weight, work mode and custom tags), and uploaded files such as the module outline.
- **Dashboards** show semester and module progress, a chapter heatmap, past-paper trends, assessment weights, grade projections, deadlines and a "needs attention" list.

## Tech stack

- Next.js (App Router) and TypeScript
- Tailwind CSS, shadcn/ui, Recharts
- SQLite through Drizzle ORM (migrations are checked in)
- Zod for validation, Vitest for tests, ESLint and Prettier for code quality

## Privacy

Your database and uploaded files live under `data/`, which is git-ignored. Course materials and grades are never committed. Do not remove `data/` from `.gitignore`.

## Getting started

Requires Node.js 20.19 or newer.

```bash
git clone https://github.com/AnasSAV/Academy-work-managment.git
cd Academy-work-managment
npm install
npm run dev
```

Then open http://localhost:3000.

### Configuration

Copy `.env.example` to `.env` only if you want to change the defaults (database path, uploads directory, upload size limit). Everything works without it.

### Database

Data lives in a local SQLite file, `data/app.db` by default. It is created and migrated automatically the first time the app (or any `db:*` script) opens it, so `npm run dev` needs no setup step. To load the starting data:

```bash
npm run db:seed
```

This creates **Semester 07** with your six modules (each with its own colour) and the ten Computer Networks and Security chapters. It creates no assessments, past papers or files, and it is safe to run twice. Everything it creates can be renamed in the UI.

Optional demo data (Advanced ML assessment table, with the `*` marker as a tag) is separate and only added if you ask for it:

```bash
npm run seed:demo
```

The schema is defined in [src/db/schema.ts](src/db/schema.ts). Migrations are generated with Drizzle and checked in under [src/db/migrations](src/db/migrations). After changing the schema, run `npm run db:generate` and commit the new migration.

### Scripts

| Script                            | What it does                                  |
| --------------------------------- | --------------------------------------------- |
| `npm run dev`                     | Start the dev server                          |
| `npm run build` / `npm start`     | Production build and server                   |
| `npm run lint`                    | ESLint                                        |
| `npm run typecheck`               | TypeScript check                              |
| `npm test`                        | Run the Vitest suite                          |
| `npm run format` / `format:check` | Prettier write / check                        |
| `npm run db:migrate`              | Create or upgrade the database                |
| `npm run db:seed`                 | Load Semester 07, modules and CN&S chapters   |
| `npm run seed:demo`               | Optional: add demo Advanced ML assessments    |
| `npm run db:generate`             | Generate a migration after editing the schema |
| `npm run db:reset`                | Delete the local database (asks first)        |

## Using the app

- **Semesters** (home page): add, edit, reorder and delete semesters. On an empty database you can load the Semester 07 starter data with one click.
- **Modules** (semester page): name, code, credits, lecturers, colour, target grade, exam date and notes. Reorder with the arrow buttons.
- **Chapters** (module page): type a title and press Enter to add one, or paste a list to add several at once (one per line). Rename, reorder and delete from each row.
- **Deleting** always asks first and lists what else would be removed with it (for example a module's chapters and assessments).

## Project layout

| Path                             | Contents                                                      |
| -------------------------------- | ------------------------------------------------------------- |
| [src/app](src/app)               | Pages and layout (Next.js App Router)                         |
| [src/actions](src/actions)       | Server actions: validate input, call a service, refresh pages |
| [src/db](src/db)                 | Schema, migrations, queries and services (plain functions)    |
| [src/lib](src/lib)               | Validation schemas, defaults, formatting helpers              |
| [src/components](src/components) | UI components (shadcn/ui primitives live in `components/ui`)  |
| [tests](tests)                   | Vitest tests, run against an in-memory database               |

Services in `src/db` take the database as a parameter, so they are tested against an in-memory SQLite database without touching your real data.

## Roadmap

| Version | Milestone                                    |
| ------- | -------------------------------------------- |
| v0.1.0  | Scaffolding, tooling, README                 |
| v0.2.0  | Database schema, migrations, seed            |
| v0.3.0  | Semester / module / chapter CRUD             |
| v0.4.0  | Chapter activities and progress calculations |
| v0.5.0  | File uploads and inline viewer               |
| v0.6.0  | Past papers and assessments                  |
| v0.7.0  | Dashboard visualisations                     |
| v0.8.0  | Grade tracker and what-if calculator         |
| v0.9.0  | Board, calendar, revision reminders          |
| v1.0.0  | Polish: dark mode, empty states, docs        |
