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

### Scripts

| Script                            | What it does                |
| --------------------------------- | --------------------------- |
| `npm run dev`                     | Start the dev server        |
| `npm run build` / `npm start`     | Production build and server |
| `npm run lint`                    | ESLint                      |
| `npm run typecheck`               | TypeScript check            |
| `npm test`                        | Run the Vitest suite        |
| `npm run format` / `format:check` | Prettier write / check      |

Database and seed scripts will be added in the next milestone.

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
