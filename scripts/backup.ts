import path from "node:path";
import { backupDatabase } from "@/db/backup";
import { databasePath } from "@/db/config";

backupDatabase(databasePath, path.join(path.dirname(databasePath), "backups"))
  .then((file) => console.log(`Backed up to ${file}`))
  .catch((error: Error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
