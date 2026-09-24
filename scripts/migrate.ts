import { createDatabase } from "@/db";
import { databasePath } from "@/db/config";

createDatabase();
console.log(`Database ready at ${databasePath}`);
