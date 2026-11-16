import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { spaces } from "@/db/schema";
import { authorize } from "@/lib/authz";
import { notFound, route } from "@/lib/http";
import { spaceUrl } from "@/lib/spaces";

const mySpace = (id: string) => {
  const row = getDb().select().from(spaces).where(eq(spaces.id, id)).get();
  if (!row) throw notFound();
  return row;
};

// P32: your own company space.
export const GET = route(({ me, ability }) => {
  const space = mySpace(me.spaceId);
  authorize(ability, "read", "space", space);
  return { ...space, url: spaceUrl(space.slug) };
});

// P31: the Owner changes the name. The slug does not change.
export const PATCH = route(async ({ me, ability, body }) => {
  const space = mySpace(me.spaceId);
  authorize(ability, "read", "space", space);
  authorize(ability, "update", "space", space);
  const { name } = await body(z.strictObject({ name: z.string().min(1) }));
  const next = getDb().update(spaces).set({ name }).where(eq(spaces.id, space.id)).returning().get();
  return { ...next, url: spaceUrl(next.slug) };
});
