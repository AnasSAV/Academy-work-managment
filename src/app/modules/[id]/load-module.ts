import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { getModule } from "@/db/queries";

/** Load the module (and its semester) named by the route, or show the 404 page. */
export async function loadModuleOr404(params: Promise<{ id: string }>) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const found = getModule(getDb(), id);
  if (!found) notFound();
  return found;
}
