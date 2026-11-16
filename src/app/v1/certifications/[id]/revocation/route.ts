import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { certifications } from "@/db/schema";
import { authorize } from "@/lib/authz";
import { notFound, route } from "@/lib/http";

// P19, P20, P23: revoke marks the certification. It does not delete it.
export const POST = route<{ id: string }>(({ me, ability, params }) => {
  const row = getDb().select().from(certifications).where(eq(certifications.id, params.id)).get();
  if (!row) throw notFound();
  authorize(ability, "read", "certification", row);
  authorize(ability, "revoke", "certification", row);
  if (row.revokedAt) return row;
  return getDb()
    .update(certifications)
    .set({ revokedAt: new Date().toISOString(), revokedBy: me.personId })
    .where(eq(certifications.id, row.id))
    .returning()
    .get();
});
