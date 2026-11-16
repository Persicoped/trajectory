import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { people } from "@/db/schema";
import { authorize } from "@/lib/authz";
import { route } from "@/lib/http";
import { personById } from "@/lib/records";

// P22: level and pay are not here. They change only through a promotion.
const update = z.strictObject({ name: z.string().min(1), email: z.email() }).partial();

export const GET = route<{ id: string }>(({ ability, params }) => {
  const person = personById(params.id);
  authorize(ability, "read", "person", person);
  return person;
});

export const PATCH = route<{ id: string }>(async ({ ability, params, body }) => {
  const person = personById(params.id);
  authorize(ability, "read", "person", person);
  authorize(ability, "update", "person", person);
  const values = await body(update);
  if (Object.keys(values).length === 0) return person;
  return getDb().update(people).set(values).where(eq(people.id, person.id)).returning().get();
});
