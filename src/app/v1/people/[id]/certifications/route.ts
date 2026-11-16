import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { certifications } from "@/db/schema";
import { authorize } from "@/lib/authz";
import { page, route } from "@/lib/http";
import { personById } from "@/lib/records";

// P28: a certification is private.
export const GET = route<{ id: string }>(({ req, ability, params }) => {
  const person = personById(params.id);
  authorize(ability, "read", "person", person);
  authorize(ability, "read", "certification", { personId: person.id });
  return page(req, getDb().select().from(certifications).where(eq(certifications.personId, person.id)).all());
});
