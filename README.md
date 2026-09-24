# Academy Work Management

A small, local-first web app for tracking academic progress across semesters, modules, chapters, past papers and assessments, with visual progress tracking. Single user, no accounts, no cloud: everything is stored on your own machine.

> Status: v1.0.0. All roadmap milestones are done. See [Roadmap](#roadmap).

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
- Tailwind CSS, shadcn/ui; charts are hand-built server-rendered SVG/HTML (no chart library)
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

### Backups

```bash
npm run db:backup
```

This writes `data/backups/app-YYYYMMDD-HHMMSS.db` using SQLite's online backup, so it is safe to run while the app is open and never overwrites an earlier backup. Do not copy `data/app.db` by hand instead: the database runs in write-ahead mode, so recent changes can still be sitting in the `app.db-wal` file and a plain copy of `app.db` can miss them. To restore, stop the app and replace `data/app.db` with a backup (delete `app.db-wal` and `app.db-shm` next to it first). Uploaded files are not part of the database; copy `data/uploads/` as well. `data/` is git-ignored, so backups are never pushed.

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
| `npm run db:backup`               | Save a safe copy of the database              |
| `npm run db:reset`                | Delete the local database (asks first)        |

## Using the app

- **Semesters** (home page): add, edit, reorder and delete semesters. On an empty database you can load the Semester 07 starter data with one click.
- **Modules** (semester page): name, code, credits, lecturers, colour, target grade, exam date and notes. Reorder with the arrow buttons.
- **Chapters** (module page): type a title and press Enter to add one, or paste a list to add several at once (one per line). Rename, reorder and delete from each row.
- **Progress**: tick Learned, Questions done, Notes made and Revised on each chapter row, or open a chapter for question counts (done / total), repeated revisions, confidence (1-5), last-reviewed date, a note and a OneNote link. Add your own activities (with a weight) under **Activities** on a module page.
- **Dashboard** (home page): a completion ring for the semester, a bar per module, and a chapter heatmap (modules by chapters). Hover or focus any square for details; click it to open the chapter. Every chart has a **Table view** with the same numbers. If you have several semesters, switch between them with the chips at the top.
- **Insights** (module page, Insights tab): progress per activity, a past-paper score trend (with your target grade as a reference line) and the assessment weight split by status.
- **Assessments** (module page, Assessments tab): one row per graded component, with weight, lecturer, due date, status, score (out of any maximum) and notes. Mark each as **Individual**, **Group** (with an optional size and members note) or **Unspecified**. A warning appears whenever a module's weights do not add up to 100%.
- **Tags**: your own labels per module (for example `*`, "online", "proctored"). Give each a description of what it means, tick tags on an assessment, or type new ones separated by commas. Filter the list by work mode and tag; the summary shows the weight per work mode.
- **Board** (sidebar): every chapter in the semester in four columns, To learn, Learning, Revising and Done. A card's column comes from what you have ticked, so it can never disagree with the chapter; each card has one button for the next step (mark learned, log a revision, mark complete). Filter by module.
- **Calendar** (sidebar): a Monday-first month view of assessment due dates and exam dates, with the same items in a list underneath (the list is all you get on a phone). Turn on **Revision reminders** to see when each learned chapter is next due back.
- **Review** (sidebar): the exam countdown, upcoming deadlines (overdue ones first), chapters due for revision with a one-click **Log revision**, and a ranked **Needs attention** list. The dashboard shows the top of both lists.
- **Grades** (module page, Grades tab): your grade so far, the average on graded work, the weight still to come, and the best you can still reach. Set a target grade on the module and it says what average you need on the rest, or that the target is already secured, out of reach, or missed. The **What if?** calculator lets you try any target and any scores on the work that is left. Nothing typed there is saved.
- **Past papers** (module page, Past papers tab): year, title, attempted or not, score, time taken, date and notes. Attach the paper and its marking scheme. Attempted papers count towards the module's readiness.
- **Files**: upload files to a semester, module or chapter (the module page has a slot for the module outline). PDFs and images open in the app; other types (docx, pptx and so on) download. Deleting a chapter, module or semester deletes its files too, and the confirmation says how many.
- **Settings**: the readiness split and the revise-after interval, with the formulas explained.
- **Deleting** always asks first and lists what else would be removed with it (for example a module's chapters and assessments).
- **Quick add** (sidebar or `N`): add chapters, an assessment or a past paper to any module from any page, without navigating there first. It starts on the module you are looking at, and errors show inline like everywhere else.
- **Theme** (sidebar or `T`): System, Light or Dark. System follows your operating system and changes with it; your choice is remembered in the browser and applied before the page paints, so there is no flash.
- **On a phone** the sidebar folds behind a Menu button and closes when you pick a page.

### Keyboard shortcuts

Shortcuts are ignored while you are typing in a field or a dialog is open, and when Ctrl, Cmd or Alt is held. Press `?` in the app to see the list.

| Keys         | Action                 |
| ------------ | ---------------------- |
| `G` then `D` | Go to the dashboard    |
| `G` then `B` | Go to the board        |
| `G` then `C` | Go to the calendar     |
| `G` then `R` | Go to review           |
| `G` then `S` | Go to settings         |
| `N`          | Quick add              |
| `T`          | Switch theme           |
| `?`          | Show the shortcut list |

The second key of a `G` pair must follow within about a second and a half.

### Accessibility

Text meets 4.5:1 contrast in light and dark. An automated scan (axe-core) of every main page in both themes finds no serious or critical problems. There is a "Skip to main content" link, every chart has a table view, and nothing depends on hover alone.

## Charts and colour

Charts follow a documented data-visualisation method, so they stay readable for everyone:

- **Colour has one job each.** Module colours identify modules (the first slots of a categorical palette). The heatmap and the assessment donut use a single-hue ramp where darker means further along. Text never takes a series colour.
- **The palette is validated, not eyeballed.** Module colours were checked for separation under protanopia and deuteranopia and for full-colour readers. The defaults are `#2a78d6`, `#eb6834`, `#1baf7a`, `#eda100`, `#e87ba4`, `#008300`, `#4a3aa7`, `#e34948`, in that order. If you pick your own module colour, keep neighbouring modules clearly different.
- **Nothing depends on colour or hover.** Every chart has a table view, a legend or colour key, and tooltips that also appear on keyboard focus.
- **Light and dark tokens** live in [src/app/globals.css](src/app/globals.css) (`--viz-*`).
- **Semester completion** is the average readiness of the semester's modules. A chapter counts as complete when it rounds to 100%.

## Files and uploads

Uploaded files live under `data/uploads/` (change with `UPLOADS_DIR`), in `<owner>/<id>/<random name>` folders. The database keeps the original name, type, size and owner. The size limit is 50 MB per file (`MAX_UPLOAD_MB`).

Uploads are served back through `/api/attachments/<id>`. A few deliberate safety choices, since you are opening files from many sources:

- **The file type is decided by the server, not the browser.** A PDF or image is shown inline only if its first bytes really match; a page renamed `.pdf` is stored as a plain download.
- **Only PDFs and PNG/JPEG/GIF/WebP images are shown inline.** Everything else, including SVG (which can contain scripts), is sent as a download.
- **Cross-site uploads are refused**, so another website open in your browser cannot push files into the app.
- Stored paths are checked to stay inside the uploads folder.

Because `data/` is git-ignored, your course files are never pushed to GitHub.

## Board, revision and attention rules

The logic is in [src/lib/study.ts](src/lib/study.ts), covered by tests.

- **Board columns** come from what is ticked. _Done_: every activity is complete. _Revising_: revised at least once, not finished. _Learning_: something is ticked or counted, not yet revised. _To learn_: nothing done.
- **Revision timing.** Only chapters you have learned come due. The interval is the "Revise after" setting (Settings, default 14 days) times a confidence factor (1 = 0.25x, 2 = 0.5x, 3 or unrated = 1x, 4 = 1.5x, 5 = 2.5x), stretched 1.5x for each revision already logged, up to three. The clock starts at the last review, else the day you learned it. Logging a revision resets it.
- **Needs attention** flags: revision overdue or due today, low confidence (1 or 2), and chapters not started in a module that is under way or has an exam within 30 days. A chapter is ranked higher the later its revision is and the lower its confidence; an exam within 30 days raises anything already flagged (within 14 days more so). An exam on its own is not a reason.
- **Deadlines.** Overdue assessments stay on the list until you mark them submitted or graded. Exams appear until the day has passed.

## Grade calculations

All of this lives in [src/lib/grades.ts](src/lib/grades.ts), tested against the Advanced ML table.

- **Points.** A component is worth its weight in points: scoring 80% on a 10% component earns 8 points. Only components with a score count as graded; the rest are outstanding.
- **Grade so far** is the points earned out of the whole module grade. **Average on graded work** is the points earned divided by the weight already graded.
- **Needed average** to reach a target is `(target points - points earned) / outstanding weight`. If that is more than 100% the target is out of reach, and the tracker shows the best case instead. If the points earned already meet the target, it is secured.
- **Weights that do not total 100%.** Weight you have not allocated to any component can never be earned, so it is shown apart and left out of what is still available. If the weights go over 100%, the grade is measured out of that total so it can never pass 100%. Either way the tracker warns you.
- **Best possible** assumes full marks on everything outstanding. **At your current pace** assumes the rest scores your current average.

## Assessment rules

- **A score means it was graded.** Entering a score on an assessment sets its status to Graded (and marking it Graded requires a score). Scores cannot exceed the maximum, which defaults to 100.
- **Group details only apply to group work.** Group size and members are kept only when the work mode is Group.
- **Weights are percentages of the module grade** (0 to 100 each). They are checked against 100% as a whole, with a tolerance for rounding, and the warning names how much is missing or over.
- **A score on a past paper means it was attempted.** A scored paper with no maximum is out of 100, and a paper that was not attempted carries no score, time or date.
- **Tags are unique per module, ignoring case.** Typing a name that already exists reuses that tag. Deleting a tag removes it from assessments but keeps the assessments.

The [Advanced ML table from the brief](src/lib/fixtures/advanced-ml.ts) is the test fixture for these rules, and `npm run seed:demo` loads it (with `*` as a tag) if you want demo data.

## How progress is calculated

All formulas are pure functions in [src/lib/progress.ts](src/lib/progress.ts), covered by tests.

- **Chapter progress** is a weighted average of the chapter's activities. Default weights: Learned 40, Questions done 30, Notes made 15, Revised 15. Weights are relative (per module, editable on the module page), so adding a custom activity simply shares the total.
  - A ticked activity counts as 100%.
  - An unticked activity that tracks counts (Questions done) earns `done / total`. Reaching the total ticks it automatically.
  - Otherwise it counts as 0%.
- **Module chapter progress** is the plain average of its chapters (0% with no chapters).
- **Past-paper progress** is `attempted / logged` (coverage) multiplied by the average score of the papers that have a score. An attempt with no score counts towards coverage only. With no papers logged it is not counted at all.
- **Module readiness** is `chapters x 70% + past papers x 30%` by default (the split is a setting). With no past papers it equals chapter progress; with no chapters it equals past-paper progress.
- **Revised** supports repeated revisions. Ticking it logs the first one; **Log revision** on the chapter page adds more. Each new revision sets the chapter's last-reviewed date to today.

## Project layout

| Path                             | Contents                                                      |
| -------------------------------- | ------------------------------------------------------------- |
| [src/app](src/app)               | Pages and layout (Next.js App Router)                         |
| [src/actions](src/actions)       | Server actions: validate input, call a service, refresh pages |
| [src/db](src/db)                 | Schema, migrations, queries and services (plain functions)    |
| [src/lib](src/lib)               | Validation schemas, defaults, formatting helpers              |
| [src/components](src/components) | UI components (shadcn/ui primitives live in `components/ui`)  |
| [scripts](scripts)               | Command-line scripts: seed, demo seed, backup, reset          |
| [tests](tests)                   | Vitest tests, run against an in-memory database               |

Services in `src/db` take the database as a parameter, so they are tested against an in-memory SQLite database without touching your real data.

## Roadmap

| Version | Milestone                                     |
| ------- | --------------------------------------------- |
| v0.1.0  | Scaffolding, tooling, README                  |
| v0.2.0  | Database schema, migrations, seed             |
| v0.3.0  | Semester / module / chapter CRUD              |
| v0.4.0  | Chapter activities and progress calculations  |
| v0.5.0  | File uploads and inline viewer                |
| v0.6.0  | Past papers and assessments                   |
| v0.7.0  | Dashboard visualisations                      |
| v0.8.0  | Grade tracker and what-if calculator          |
| v0.9.0  | Board, calendar, revision reminders           |
| v1.0.0  | Polish: dark mode, shortcuts, quick add, docs |
