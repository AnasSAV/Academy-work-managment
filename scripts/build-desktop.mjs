// Builds the desktop app.
//
//   node scripts/build-desktop.mjs run    build, then open it in a window (a quick trial)
//   node scripts/build-desktop.mjs dir    build an unpacked app in release/win-unpacked
//   node scripts/build-desktop.mjs dist   build the Windows installer in release/
//
// Layout it creates (all git-ignored):
//   desktop-build/server   the Next.js server, self-contained (no node_modules install needed)
//   desktop-build/app      the Electron shell (main process, splash, icon)
//   release/               installer and unpacked app
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const at = (...p) => path.join(root, ...p);
const mode = process.argv[2] ?? "dist";
if (!["run", "dir", "dist"].includes(mode)) {
  console.error("Usage: node scripts/build-desktop.mjs run|dir|dist");
  process.exit(1);
}

function run(command, args, env = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) {
    console.error(`\nFailed: ${command} ${args.join(" ")}`);
    process.exit(result.status ?? 1);
  }
}
const node = (script, args = [], env) => run(process.execPath, [script, ...args], env);

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const pkg = JSON.parse(fs.readFileSync(at("package.json"), "utf8"));

// 1. Build the web app as a standalone server.
console.log("\n> Building the app");
node(at("node_modules/next/dist/bin/next"), ["build"], { DESKTOP_BUILD: "1" });

// 2. Assemble the server folder.
console.log("\n> Assembling the server");
const server = at("desktop-build/server");
fs.rmSync(at("desktop-build"), { recursive: true, force: true });
fs.cpSync(at(".next/standalone"), server, { recursive: true });
fs.cpSync(at(".next/static"), path.join(server, ".next/static"), { recursive: true });
if (fs.existsSync(at("public")))
  fs.cpSync(at("public"), path.join(server, "public"), { recursive: true });
// The database code reads its migrations from disk at start-up.
fs.cpSync(at("src/db/migrations"), path.join(server, "src/db/migrations"), { recursive: true });

// The start-up file that rejects requests meant for another site (see desktop/server-guard.cjs).
fs.copyFileSync(at("desktop/server-guard.cjs"), path.join(server, "desktop-entry.cjs"));

// better-sqlite3 ships one binary per platform. Keep only this one, so the installer is smaller.
const prebuilds = path.join(server, "node_modules/better-sqlite3/prebuilds");
const keep = `${process.platform}-${process.arch}.node`;
for (const file of fs.readdirSync(prebuilds)) {
  if (file !== keep) fs.rmSync(path.join(prebuilds, file));
}
if (!fs.existsSync(path.join(prebuilds, keep))) {
  console.error(`No better-sqlite3 binary for ${keep}.`);
  process.exit(1);
}

// 3. Refuse to ship anything private. The installer must never contain a database, uploads
// or environment file, whatever is lying around in this folder.
const forbidden = [];
for (const file of walk(server)) {
  const rel = path.relative(server, file).replaceAll("\\", "/");
  if (/\.(db|sqlite3?|db-wal|db-shm|db-journal)$/i.test(rel)) forbidden.push(rel);
  if (/(^|\/)\.env(\.|$)/.test(rel) && !rel.endsWith(".env.example")) forbidden.push(rel);
  if (/(^|\/)(data|uploads|\.claude)\//.test(rel)) forbidden.push(rel);
}
if (forbidden.length > 0) {
  console.error("Refusing to build: private files ended up in the server folder:");
  for (const f of forbidden.slice(0, 20)) console.error("  " + f);
  process.exit(1);
}
if (!fs.existsSync(path.join(server, "server.js"))) {
  console.error("The standalone build has no server.js.");
  process.exit(1);
}
if (!fs.existsSync(path.join(server, "src/db/migrations/meta/_journal.json"))) {
  console.error("The migrations were not copied.");
  process.exit(1);
}

// 4. Assemble the Electron app. It has its own package.json so that electron-builder packs
// only the shell here, not all of the web app's dependencies.
console.log("\n> Assembling the desktop shell");
const app = at("desktop-build/app");
fs.mkdirSync(app, { recursive: true });
for (const file of ["main.cjs", "data-import.cjs", "splash.html"]) {
  fs.copyFileSync(at("desktop", file), path.join(app, file));
}
fs.copyFileSync(at("desktop/build/icon.png"), path.join(app, "icon.png"));
fs.writeFileSync(
  path.join(app, "package.json"),
  JSON.stringify(
    {
      name: "academy-work-management",
      productName: "Academy Work Management",
      version: pkg.version,
      description: "A local-first tracker for academic progress",
      author: "AnasSAV",
      main: "main.cjs",
    },
    null,
    2,
  ),
);

if (mode === "run") {
  console.log("\n> Opening the app");
  // npm may skip Electron's own download step (recent npm versions block install scripts).
  if (!fs.existsSync(at("node_modules/electron/dist")))
    node(at("node_modules/electron/install.js"));
  const electron =
    (await import("electron")).default ?? at("node_modules/electron/dist/electron.exe");
  run(String(electron), [app]);
} else {
  console.log(`\n> Packaging (${mode})`);
  const builder = at("node_modules/electron-builder/cli.js");
  node(builder, [
    "--win",
    "--x64",
    mode === "dir" ? "--dir" : "--publish=never",
    "--config",
    "electron-builder.yml",
  ]);
  console.log("\nDone. Output is in the release folder.");
}
