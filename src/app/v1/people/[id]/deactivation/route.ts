import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { people } from "@/db/schema";
import { authorize } from "@/lib/authz";
import { route } from "@/lib/http";
import { personById } from "@/lib/records";

// P25, P26, P27: the Owner stops a person's access. The records stay.
export const POST = route<{ id: string }>(({ ability, params }) => {
  const person = personById(params.id);
  authorize(ability, "read", "person", person);
  authorize(ability, "deactivate", "person", person);
  return getDb().update(people).set({ active: false }).where(eq(people.id, person.id)).returning().get();
});
