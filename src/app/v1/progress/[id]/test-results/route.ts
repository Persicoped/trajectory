import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { testResults, tests } from "@/db/schema";
import { authorize } from "@/lib/authz";
import { conflict, notFound, page, route } from "@/lib/http";
import { levelIdOfTopic } from "@/lib/ladder-crud";
import { progressById } from "@/lib/records";

const input = z.strictObject({ testId: z.string().min(1), answers: z.record(z.string(), z.number().int().min(0)) });

export const GET = route<{ id: string }>(({ req, ability, params }) => {
  const prog = progressById(params.id);
  authorize(ability, "read", "progress", prog);
  authorize(ability, "read", "test-result", { personId: prog.personId });
  return page(req, getDb().select().from(testResults).where(eq(testResults.progressId, prog.id)).all());
});

// P12: a member takes a test for their own current level. The system scores
// it. P11: the reply never holds the answer key.
export const POST = route<{ id: string }>(async ({ ability, params, body }) => {
  const prog = progressById(params.id);
  authorize(ability, "read", "progress", prog);
  const { testId, answers } = await body(input);
  const test = getDb().select().from(tests).where(eq(tests.id, testId)).get();
  if (!test) throw notFound();
  const levelId = levelIdOfTopic(test.topicId);
  authorize(ability, "read", "test", { levelId });
  authorize(ability, "create", "test-result", { personId: prog.personId, levelId });
  if (prog.status !== "active" || levelId !== prog.levelId) throw conflict("This test is not for the current level.");

  const right = test.questions.filter((q) => answers[q.id] === test.answerKey[q.id]).length;
  const score = Math.round((right / test.questions.length) * 100);
  return getDb()
    .insert(testResults)
    .values({ personId: prog.personId, progressId: prog.id, testId: test.id, answers, score, passed: score >= test.passMark })
    .returning()
    .get();
}, { status: 201 });
