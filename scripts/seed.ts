import { createDatabase } from "@/db";
import { seedDatabase } from "@/db/seed";

const { seeded } = seedDatabase(createDatabase());
console.log(
  seeded
    ? "Seeded Semester 07 (6 modules, 10 chapters)."
    : "Semester 07 already exists; nothing to do.",
);
