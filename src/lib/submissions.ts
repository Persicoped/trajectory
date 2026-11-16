import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import * as t from "@/db/schema";
import { authorize } from "@/lib/authz";
import { conflict, notFound, page, route } from "@/lib/http";
import { progressById } from "@/lib/records";

// Work items and contributions have the same shape and the same rules.
const TABLES = { "work-item": t.workItems, contribution: t.contributions } as const;
export type SubmissionKind = keyof typeof TABLES;

const fields = z.strictObject({ title: z.string().min(1), link: z.string(), notes: z.string() });
const create = fields.extend({ link: z.string().default(""), notes: z.string().default("") });

export function submissionById(kind: SubmissionKind, id: string) {
  const table = TABLES[kind];
  const row = getDb().select().from(table).where(eq(table.id, id)).get();
  if (!row) throw notFound();
  return row;
}

// GET and POST /v1/progress/{id}/work-items (or contributions)
export function submissionsUnderProgress(kind: SubmissionKind) {
  const table = TABLES[kind];
  return {
    GET: route<{ id: string }>(({ req, ability, params }) => {
      const prog = progressById(params.id);
      authorize(ability, "read", "progress", prog);
      return page(req, getDb().select().from(table).where(eq(table.progressId, prog.id)).all());
    }),
    POST: route<{ id: string }>(async ({ ability, params, body }) => {
      const prog = progressById(params.id);
      authorize(ability, "read", "progress", prog);
      authorize(ability, "create", kind, { personId: prog.personId });
      if (prog.status !== "active") throw conflict("This progress record is complete.");
      const values = await body(create);
      return getDb().insert(table).values({ ...values, personId: prog.personId, progressId: prog.id }).returning().get();
    }, { status: 201 }),
  };
}

// GET and PATCH /v1/work-items/{id} (or contributions)
export function submissionItem(kind: SubmissionKind) {
  const table = TABLES[kind];
  return {
    GET: route<{ id: string }>(({ ability, params }) => {
      const row = submissionById(kind, params.id);
      authorize(ability, "read", kind, row);
      return row;
    }),
    PATCH: route<{ id: string }>(async ({ ability, params, body }) => {
      const row = submissionById(kind, params.id);
      authorize(ability, "read", kind, row);
      // P16: no change after a review passed it.
      authorize(ability, "update", kind, row);
      const values = await body(fields.partial());
      if (Object.keys(values).length === 0) return row;
      // A changed submission goes back to the reviewer.
      return getDb().update(table).set({ ...values, status: "submitted" }).where(eq(table.id, row.id)).returning().get();
    }),
  };
}
