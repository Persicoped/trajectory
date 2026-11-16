import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import * as t from "@/db/schema";
import { authorize } from "@/lib/authz";
import { notFound, route } from "@/lib/http";
import { submissionById } from "@/lib/submissions";

const input = z.strictObject({ decision: z.enum(["passed", "not_yet"]), notes: z.string().default("") });
type Subject = "test-result" | "work-item" | "contribution";

function subjectRow(type: Subject, id: string) {
  if (type !== "test-result") return submissionById(type, id);
  const row = getDb().select().from(t.testResults).where(eq(t.testResults.id, id)).get();
  if (!row) throw notFound();
  return row;
}

// POST /v1/{work-items|contributions|test-results}/{id}/reviews
export function reviewRoute(type: Subject) {
  return route<{ id: string }>(async ({ me, ability, params, body }) => {
    const target = subjectRow(type, params.id);
    authorize(ability, "read", type, target);
    // P18, P20: a manager reviews other people, never their own record.
    authorize(ability, "create", "review", { personId: target.personId });
    const { decision, notes } = await body(input);
    return getDb().transaction((tx) => {
      if (type === "work-item") tx.update(t.workItems).set({ status: decision }).where(eq(t.workItems.id, target.id)).run();
      if (type === "contribution") tx.update(t.contributions).set({ status: decision }).where(eq(t.contributions.id, target.id)).run();
      return tx
        .insert(t.reviews)
        .values({ personId: target.personId, reviewerId: me.personId, subjectType: type, subjectId: target.id, decision, notes })
        .returning()
        .get();
    });
  }, { status: 201 });
}
