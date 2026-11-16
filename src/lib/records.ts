import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as t from "@/db/schema";
import { notFound } from "@/lib/http";

// Small lookups that throw 404 when the row is missing.
const db = () => getDb();

export function personById(id: string) {
  const row = db().select().from(t.people).where(eq(t.people.id, id)).get();
  if (!row) throw notFound();
  return row;
}
export function progressById(id: string) {
  const row = db().select().from(t.progress).where(eq(t.progress.id, id)).get();
  if (!row) throw notFound();
  return row;
}
export function activeProgressOf(personId: string) {
  return db()
    .select()
    .from(t.progress)
    .where(and(eq(t.progress.personId, personId), eq(t.progress.status, "active")))
    .orderBy(desc(t.progress.startedAt))
    .get();
}
export function levelById(id: string) {
  const row = db().select().from(t.levels).where(eq(t.levels.id, id)).get();
  if (!row) throw notFound();
  return row;
}
export function payBandById(id: string) {
  const row = db().select().from(t.payBands).where(eq(t.payBands.id, id)).get();
  if (!row) throw notFound();
  return row;
}
