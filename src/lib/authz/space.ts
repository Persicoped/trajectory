import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as t from "@/db/schema";
import type { Row, SubjectName } from "./ability";

// Thrown when a row belongs to another company space. The reply is 404, so a
// person cannot learn that the row exists.
export class OutsideSpace extends Error {}

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const db = () => getDb();

const ofLadder = (id: string) => db().select().from(t.ladders).where(eq(t.ladders.id, id)).get()?.spaceId ?? null;
const ofBand = (id: string) => {
  const row = db().select().from(t.payBands).where(eq(t.payBands.id, id)).get();
  return row ? ofLadder(row.ladderId) : null;
};
const ofLevel = (id: string) => {
  const row = db().select().from(t.levels).where(eq(t.levels.id, id)).get();
  return row ? ofBand(row.payBandId) : null;
};
const ofTopic = (id: string) => {
  const row = db().select().from(t.topics).where(eq(t.topics.id, id)).get();
  return row ? ofLevel(row.levelId) : null;
};
const ofPerson = (id: string) => db().select().from(t.people).where(eq(t.people.id, id)).get()?.spaceId ?? null;

// The space that a row belongs to. `undefined` means the row names nothing
// that exists yet (a new top-level object), so there is nothing to compare.
// `null` means the row points at something that is not there: refuse it.
export function spaceOfRow(type: SubjectName, row: Row): string | null | undefined {
  const r = row as Record<string, unknown>;
  if (type === "space") return str(r.id) ?? undefined;
  if (str(r.spaceId)) return str(r.spaceId);
  if (type === "person" && str(r.id)) return ofPerson(str(r.id)!);
  if (str(r.personId)) return ofPerson(str(r.personId)!);
  if (str(r.ladderId)) return ofLadder(str(r.ladderId)!);
  if (str(r.payBandId)) return ofBand(str(r.payBandId)!);
  if (str(r.levelId)) return ofLevel(str(r.levelId)!);
  if (str(r.topicId)) return ofTopic(str(r.topicId)!);
  return undefined;
}
