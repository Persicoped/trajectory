import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { people } from "@/db/schema";
import { authorize } from "@/lib/authz";
import { route } from "@/lib/http";
import { personById } from "@/lib/records";

// P24: there is one Owner, so this request cannot make a second one.
const input = z.strictObject({ role: z.enum(["member", "manager"]) });

// P25, P26: the Owner gives or removes the Manager role, never on the Owner.
export const PUT = route<{ id: string }>(async ({ ability, params, body }) => {
  const person = personById(params.id);
  authorize(ability, "read", "person", person);
  authorize(ability, "assign-role", "person", person);
  const { role } = await body(input);
  return getDb().update(people).set({ role }).where(eq(people.id, person.id)).returning().get();
});
