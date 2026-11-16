import "server-only";
import { eq } from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import type { ZodType } from "zod";
import { getDb } from "@/db/client";
import { levels, topics } from "@/db/schema";
import { authorize, can, type AppAbility, type Row, type SubjectName } from "@/lib/authz";
import { conflict, notFound, page, route } from "@/lib/http";

type AnyRow = Record<string, unknown> & { id: string };
type Table = SQLiteTable & { id: SQLiteColumn };

export type Kind = {
  subject: SubjectName;
  table: Table;
  // The column that points at the parent, and the parent's kind.
  parent?: { key: string; column: SQLiteColumn; kind: Kind };
  // A top-level object. A new row gets the space of the person who makes it.
  inSpace?: boolean;
  create: ZodType<Record<string, unknown>>;
  update: ZodType<Record<string, unknown>>;
  // Fields that a rule tests but the row does not carry.
  facts?: (row: AnyRow) => Row;
  // What the caller may see of the row.
  view?: (row: AnyRow, ability: AppAbility, facts: Row) => Record<string, unknown>;
};

const factsOf = (kind: Kind, row: AnyRow): Row => ({ ...row, ...(kind.facts?.(row) ?? {}) }) as Row;
const viewOf = (kind: Kind, row: AnyRow, ability: AppAbility) =>
  kind.view ? kind.view(row, ability, factsOf(kind, row)) : row;

function find(kind: Kind, id: string): AnyRow {
  const row = getDb().select().from(kind.table).where(eq(kind.table.id, id)).get() as AnyRow | undefined;
  if (!row) throw notFound();
  return row;
}

// GET and POST on a top-level list, such as /v1/ladders.
export function collection(kind: Kind) {
  return {
    GET: route(({ req, ability }) => {
      const rows = (getDb().select().from(kind.table).all() as AnyRow[]).filter((r) =>
        can(ability, "read", kind.subject, factsOf(kind, r)),
      );
      return page(req, rows.map((r) => viewOf(kind, r, ability)));
    }),
    POST: route(async ({ me, ability, body }) => {
      authorize(ability, "create", kind.subject, {});
      const values = { ...(await body(kind.create)), ...(kind.inSpace ? { spaceId: me.spaceId } : {}) };
      const row = getDb().insert(kind.table).values(values).returning().get() as AnyRow;
      return viewOf(kind, row, ability);
    }, { status: 201 }),
  };
}

// GET and POST on a list under a parent, such as /v1/ladders/{id}/pay-bands.
export function children(kind: Kind) {
  const parent = kind.parent!;
  return {
    GET: route<{ id: string }>(({ req, ability, params }) => {
      const owner = find(parent.kind, params.id);
      authorize(ability, "read", parent.kind.subject, factsOf(parent.kind, owner));
      const rows = (
        getDb().select().from(kind.table).where(eq(parent.column, params.id)).all() as AnyRow[]
      ).filter((r) => can(ability, "read", kind.subject, factsOf(kind, r)));
      return page(req, rows.map((r) => viewOf(kind, r, ability)));
    }),
    POST: route<{ id: string }>(async ({ ability, params, body }) => {
      const owner = find(parent.kind, params.id);
      authorize(ability, "read", parent.kind.subject, factsOf(parent.kind, owner));
      authorize(ability, "create", kind.subject, {});
      const values = { ...(await body(kind.create)), [parent.key]: params.id };
      const row = getDb().insert(kind.table).values(values).returning().get() as AnyRow;
      return viewOf(kind, row, ability);
    }, { status: 201 }),
  };
}

// GET, PATCH and DELETE on one object, such as /v1/levels/{id}.
export function item(kind: Kind) {
  return {
    GET: route<{ id: string }>(({ ability, params }) => {
      const row = find(kind, params.id);
      authorize(ability, "read", kind.subject, factsOf(kind, row));
      return viewOf(kind, row, ability);
    }),
    PATCH: route<{ id: string }>(async ({ ability, params, body }) => {
      const row = find(kind, params.id);
      authorize(ability, "read", kind.subject, factsOf(kind, row));
      authorize(ability, "update", kind.subject, factsOf(kind, row));
      const values = await body(kind.update);
      if (Object.keys(values).length === 0) return viewOf(kind, row, ability);
      const next = getDb().update(kind.table).set(values).where(eq(kind.table.id, params.id)).returning().get() as AnyRow;
      return viewOf(kind, next, ability);
    }),
    DELETE: route<{ id: string }>(({ ability, params }) => {
      const row = find(kind, params.id);
      authorize(ability, "read", kind.subject, factsOf(kind, row));
      authorize(ability, "delete", kind.subject, factsOf(kind, row));
      try {
        getDb().delete(kind.table).where(eq(kind.table.id, params.id)).run();
      } catch {
        throw conflict("This object is in use. Set its status to retired, or remove what points at it.");
      }
      return new Response(null, { status: 204 });
    }),
  };
}

// The level that a topic belongs to. A test rule needs it.
export function levelIdOfTopic(topicId: string): string | null {
  return getDb().select().from(topics).where(eq(topics.id, topicId)).get()?.levelId ?? null;
}
export function payBandIdOfLevel(levelId: string): string | null {
  return getDb().select().from(levels).where(eq(levels.id, levelId)).get()?.payBandId ?? null;
}
