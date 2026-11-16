import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as t from "@/db/schema";
import { HttpError } from "@/lib/http";
import { activeProgressOf, levelById, payBandById, personById } from "@/lib/records";

const DAY = 24 * 60 * 60 * 1000;

// What is still missing before a person can leave their current level.
// An empty list means the person is ready.
export function missingForPromotion(personId: string, now = new Date()): string[] {
  const db = getDb();
  const prog = activeProgressOf(personId);
  if (!prog) return [];
  const level = levelById(prog.levelId);
  const missing: string[] = [];

  const required = db.select().from(t.topics).where(and(eq(t.topics.levelId, level.id), eq(t.topics.required, true))).all();
  const topicIds = required.map((x) => x.id);
  const levelTests = topicIds.length ? db.select().from(t.tests).where(inArray(t.tests.topicId, topicIds)).all() : [];
  const results = db.select().from(t.testResults).where(eq(t.testResults.progressId, prog.id)).all();
  const passedReviews = new Set(
    db
      .select()
      .from(t.reviews)
      .where(and(eq(t.reviews.personId, personId), eq(t.reviews.subjectType, "test-result"), eq(t.reviews.decision, "passed")))
      .all()
      .map((r) => r.subjectId),
  );
  for (const test of levelTests) {
    const ok = results.some((r) => r.testId === test.id && r.passed && passedReviews.has(r.id));
    if (!ok) missing.push(`Test "${test.title}" is not passed and reviewed.`);
  }

  const work = db.select().from(t.workItems).where(eq(t.workItems.progressId, prog.id)).all();
  if (!work.some((w) => w.status === "passed")) missing.push("No work item is approved.");
  if (work.some((w) => w.status !== "passed")) missing.push("A work item still waits for approval.");

  const gifts = db.select().from(t.contributions).where(eq(t.contributions.progressId, prog.id)).all();
  if (!gifts.some((c) => c.status === "passed")) missing.push("No contribution is approved.");

  const days = Math.floor((now.getTime() - new Date(prog.startedAt).getTime()) / DAY);
  if (days < level.minDurationDays) {
    missing.push(`The minimum time is ${level.minDurationDays} days. ${days} days are done.`);
  }
  return missing;
}

// Promote a person. One transaction: complete the current progress, issue the
// certifications, record the promotion, set the new level and pay, and start
// the next progress. If a check fails, nothing changes.
export function promote(input: { personId: string; toLevelId: string; newRateCents: number; promotedBy: string }) {
  const db = getDb();
  const person = personById(input.personId);
  if (!person.active) throw new HttpError(409, "Conflict", "This person is deactivated.");
  const toLevel = levelById(input.toLevelId);
  const band = payBandById(toLevel.payBandId);
  if (toLevel.status !== "active") throw new HttpError(422, "Not ready", "The new level is retired.");
  if (person.currentLevelId === toLevel.id) throw new HttpError(422, "Not ready", "The person is already at this level.");

  const missing = missingForPromotion(person.id);
  // P22 and rule 5 of the objects page: the new pay must be inside the band.
  if (input.newRateCents < band.minRateCents || input.newRateCents > band.maxRateCents) {
    missing.push(`The new rate must be from ${band.minRateCents} to ${band.maxRateCents} cents.`);
  }
  if (missing.length) throw new HttpError(422, "Not ready", missing.join(" "));

  return db.transaction((tx) => {
    const current = activeProgressOf(person.id);
    if (current) {
      tx.update(t.progress).set({ status: "completed", completedAt: new Date().toISOString() }).where(eq(t.progress.id, current.id)).run();
      const skills = tx.select().from(t.topics).where(and(eq(t.topics.levelId, current.levelId), eq(t.topics.required, true))).all();
      for (const skill of skills) {
        tx.insert(t.certifications).values({ personId: person.id, levelId: current.levelId, skill: skill.name, issuedBy: input.promotedBy }).run();
      }
    }
    const promotion = tx
      .insert(t.promotions)
      .values({ personId: person.id, fromLevelId: person.currentLevelId, toLevelId: toLevel.id, newRateCents: input.newRateCents, promotedBy: input.promotedBy })
      .returning()
      .get();
    tx.update(t.people).set({ currentLevelId: toLevel.id, currentRateCents: input.newRateCents }).where(eq(t.people.id, person.id)).run();
    tx.insert(t.progress).values({ personId: person.id, levelId: toLevel.id }).run();
    return promotion;
  });
}
