import { z } from "zod";
import { getDb } from "@/db/client";
import { people } from "@/db/schema";
import { authorize, can } from "@/lib/authz";
import { conflict, page, route } from "@/lib/http";

const create = z.strictObject({ name: z.string().min(1), email: z.email() });

export const GET = route(({ req, ability }) => {
  // P14: a member gets a list of one, themselves.
  const rows = getDb().select().from(people).all().filter((p) => can(ability, "read", "person", p));
  return page(req, rows);
});

// P3, P25: the Owner adds a person. A new person is a Member.
export const POST = route(async ({ me, ability, body }) => {
  authorize(ability, "create", "person", {});
  const values = await body(create);
  try {
    return getDb().insert(people).values({ ...values, spaceId: me.spaceId, role: "member" }).returning().get();
  } catch {
    throw conflict("A person with this email exists.");
  }
}, { status: 201 });
