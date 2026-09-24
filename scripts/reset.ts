import fs from "node:fs";
import readline from "node:readline/promises";
import { databasePath } from "@/db/config";

async function main() {
  if (!process.argv.includes("--yes")) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(
      `This deletes ${databasePath} and all its data. Type "reset" to continue: `,
    );
    rl.close();
    if (answer.trim() !== "reset") {
      console.log("Cancelled.");
      return;
    }
  }
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    fs.rmSync(databasePath + suffix, { force: true });
  }
  console.log("Database deleted. Run `npm run db:migrate && npm run db:seed` to recreate it.");
}

void main();
