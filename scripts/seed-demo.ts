import { createDatabase } from "@/db";
import { seedDemo } from "@/db/seed-demo";

const result = seedDemo(createDatabase());
console.log(result.seeded ? "Added demo Advanced ML assessments." : `Skipped: ${result.reason}`);
