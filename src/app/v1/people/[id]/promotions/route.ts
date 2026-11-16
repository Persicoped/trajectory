import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { promotions } from "@/db/schema";
import { authorize } from "@/lib/authz";
import { page, route } from "@/lib/http";
import { promote } from "@/lib/promotion";
import { levelById, personById } from "@/lib/records";

const input = z.strictObject({ toLevelId: z.string().min(1), newRateCents: z.number().int().min(0) });

export const GET = route<{ id: string }>(({ req, ability, params }) => {
  const person = personById(params.id);
  authorize(ability, "read", "person", person);
  authorize(ability, "read", "promotion", { personId: person.id });
  return page(req, getDb().select().from(promotions).where(eq(promotions.personId, person.id)).orderBy(desc(promotions.createdAt)).all());
});

// P19, P20: a manager promotes another person and sets the new pay.
// A promotion also issues the certifications for the level that ends.
export const POST = route<{ id: string }>(async ({ me, ability, params, body }) => {
  const person = personById(params.id);
  authorize(ability, "read", "person", person);
  authorize(ability, "create", "promotion", { personId: person.id });
  authorize(ability, "create", "certification", { personId: person.id });
  const values = await body(input);
  // P30: the new level must be in the same space.
  authorize(ability, "read", "level", levelById(values.toLevelId));
  return promote({ personId: person.id, promotedBy: me.personId, ...values });
}, { status: 201 });
