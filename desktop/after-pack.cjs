"use strict";
/**
 * electron-builder's own copier drops every node_modules folder, and the server needs its own.
 * So the server folder is copied into the packaged app here, after packing and before the
 * installer is built.
 */
const fs = require("node:fs");
const path = require("node:path");

exports.default = async function afterPack(context) {
  const from = path.resolve(__dirname, "..", "desktop-build", "server");
  const to = path.join(context.appOutDir, "resources", "server");
  if (!fs.existsSync(path.join(from, "server.js"))) {
    throw new Error(`The server has not been built: ${from} is missing. Run npm run dist.`);
  }
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true });
  if (!fs.existsSync(path.join(to, "node_modules", "better-sqlite3"))) {
    throw new Error("The server was copied without its node_modules.");
  }
};
