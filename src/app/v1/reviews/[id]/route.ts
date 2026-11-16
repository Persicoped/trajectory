import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { reviews } from "@/db/schema";
import { authorize } from "@/lib/authz";
import { notFound, route } from "@/lib/http";

export const GET = route<{ id: string }>(({ ability, params }) => {
  const row = getDb().select().from(reviews).where(eq(reviews.id, params.id)).get();
  if (!row) throw notFound();
  authorize(ability, "read", "review", row);
  return row;
});
