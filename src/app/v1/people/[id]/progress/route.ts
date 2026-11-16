import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { progress } from "@/db/schema";
import { authorize } from "@/lib/authz";
import { page, route } from "@/lib/http";
import { personById } from "@/lib/records";

export const GET = route<{ id: string }>(({ req, ability, params }) => {
  const person = personById(params.id);
  authorize(ability, "read", "person", person);
  authorize(ability, "read", "progress", { personId: person.id });
  return page(req, getDb().select().from(progress).where(eq(progress.personId, person.id)).orderBy(desc(progress.startedAt)).all());
});
