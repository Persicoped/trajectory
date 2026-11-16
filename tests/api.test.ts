import { beforeAll, describe, expect, it } from "vitest";

process.env.TRAJECTORY_DB = ":memory:";

import { runMigrations } from "@/db/client";
import { createSpace } from "@/lib/spaces";
import { createToken } from "@/lib/tokens";
import * as ladders from "@/app/v1/ladders/route";
import * as ladderItem from "@/app/v1/ladders/[id]/route";
import * as bands from "@/app/v1/ladders/[id]/pay-bands/route";
import * as bandItem from "@/app/v1/pay-bands/[id]/route";
import * as levels from "@/app/v1/pay-bands/[id]/levels/route";
import * as levelItem from "@/app/v1/levels/[id]/route";
import * as topics from "@/app/v1/levels/[id]/topics/route";
import * as tests from "@/app/v1/topics/[id]/tests/route";
import * as testItem from "@/app/v1/tests/[id]/route";
import * as meRoute from "@/app/v1/me/route";
import * as peopleRoute from "@/app/v1/people/route";
import * as personItem from "@/app/v1/people/[id]/route";
import * as roleRoute from "@/app/v1/people/[id]/role/route";
import * as deactivation from "@/app/v1/people/[id]/deactivation/route";
import * as promotionsRoute from "@/app/v1/people/[id]/promotions/route";
import * as certs from "@/app/v1/people/[id]/certifications/route";
import * as revocation from "@/app/v1/certifications/[id]/revocation/route";
import * as progressItem from "@/app/v1/progress/[id]/route";
import * as completion from "@/app/v1/progress/[id]/topics/[topicId]/completion/route";
import * as results from "@/app/v1/progress/[id]/test-results/route";
import * as work from "@/app/v1/progress/[id]/work-items/route";
import * as workItem from "@/app/v1/work-items/[id]/route";
import * as workReview from "@/app/v1/work-items/[id]/reviews/route";
import * as gifts from "@/app/v1/progress/[id]/contributions/route";
import * as giftReview from "@/app/v1/contributions/[id]/reviews/route";
import * as resultReview from "@/app/v1/test-results/[id]/reviews/route";
import * as spacesRoute from "@/app/v1/spaces/route";
import * as spaceRoute from "@/app/v1/space/route";

type Handler = (req: Request, ctx: { params: Promise<any> }) => Promise<Response>;

async function call(handler: Handler, token: string | null, params: Record<string, string> = {}, body?: unknown, method = "GET", host?: string) {
  const req = new Request("http://test.local/v1", {
    method: body === undefined ? method : method === "GET" ? "POST" : method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(host ? { "x-forwarded-host": host } : {}), "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const res = await handler(req, { params: Promise.resolve(params) });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

const T: Record<string, string> = {};
const ID: Record<string, string> = {};

beforeAll(async () => {
  runMigrations();
  const made = createSpace({ name: "Acme", slug: "acme", ownerName: "Olive Owner", ownerEmail: "owner@example.com" });
  ID.owner = made.owner.id;
  ID.space = made.space.id;
  T.owner = made.token;
  for (const who of ["manager", "alice", "bob"]) {
    const res = await call(peopleRoute.POST, T.owner, {}, { name: who, email: `${who}@example.com` });
    expect(res.status).toBe(201);
    ID[who] = res.json.id;
    T[who] = createToken(res.json.id, "test");
  }
  const role = await call(roleRoute.PUT, T.owner, { id: ID.manager }, { role: "manager" }, "PUT");
  expect(role.json.role).toBe("manager");
});

describe("building the ladder", () => {
  it("D1: refuses a request with no token", async () => {
    expect((await call(ladders.GET, null)).status).toBe(401);
    expect((await call(ladders.GET, "trj_wrong")).status).toBe(401);
  });

  it("D19: refuses a member who tries to build", async () => {
    expect((await call(ladders.POST, T.alice, {}, { name: "Mine" })).status).toBe(403);
  });

  it("lets a manager build a ladder, bands, levels, a topic and a test", async () => {
    const ladder = await call(ladders.POST, T.manager, {}, { name: "AI Developer", description: "Sample" });
    expect(ladder.status).toBe(201);
    ID.ladder = ladder.json.id;
    const band = await call(bands.POST, T.manager, { id: ID.ladder }, { name: "Apprentice", position: 1, min_rate_cents: 1500, max_rate_cents: 1700 });
    expect(band.status).toBe(201);
    ID.band = band.json.id;
    const band2 = await call(bands.POST, T.manager, { id: ID.ladder }, { name: "Junior", position: 2, min_rate_cents: 1900, max_rate_cents: 2100 });
    ID.band2 = band2.json.id;
    for (const [key, title, rate, parent] of [["l1", "Apprentice 1", 1500, ID.band], ["l2", "Apprentice 2", 1600, ID.band], ["l3", "Junior 1", 1900, ID.band2]] as const) {
      const level = await call(levels.POST, T.manager, { id: parent }, { title, position: 1, recommended_rate_cents: rate });
      expect(level.status).toBe(201);
      ID[key] = level.json.id;
    }
    const topic = await call(topics.POST, T.manager, { id: ID.l1 }, { name: "Prompt basics" });
    ID.topic = topic.json.id;
    const test = await call(tests.POST, T.manager, { id: ID.topic }, {
      title: "Prompt quiz",
      questions: [{ id: "q_1", prompt: "Pick A", choices: ["A", "B"] }, { id: "q_2", prompt: "Pick B", choices: ["A", "B"] }],
      answer_key: { q_1: 0, q_2: 1 },
      pass_mark: 100,
    });
    expect(test.status).toBe(201);
    expect(test.json.answer_key).toEqual({ q_1: 0, q_2: 1 });
    ID.test = test.json.id;
  });

  it("rejects a pay band with max below min, and unknown fields", async () => {
    expect((await call(bands.POST, T.manager, { id: ID.ladder }, { name: "Bad", position: 9, min_rate_cents: 500, max_rate_cents: 100 })).status).toBe(400);
    expect((await call(ladders.POST, T.manager, {}, { name: "X", role: "owner" })).status).toBe(400);
  });

  it("a PATCH changes only the fields it names", async () => {
    const res = await call(ladderItem.PATCH, T.manager, { id: ID.ladder }, { name: "AI Developer Ladder" }, "PATCH");
    expect(res.json.name).toBe("AI Developer Ladder");
    expect(res.json.description).toBe("Sample");
  });

  it("refuses to delete a ladder object that is in use", async () => {
    expect((await call(bandItem.DELETE, T.manager, { id: ID.band }, undefined, "DELETE")).status).toBe(409);
    expect((await call(bandItem.DELETE, T.alice, { id: ID.band }, undefined, "DELETE")).status).toBe(403);
  });
});

describe("people", () => {
  it("D23: a manager cannot add people or give roles", async () => {
    expect((await call(peopleRoute.POST, T.manager, {}, { name: "x", email: "x@example.com" })).status).toBe(403);
    expect((await call(roleRoute.PUT, T.manager, { id: ID.alice }, { role: "manager" }, "PUT")).status).toBe(403);
  });

  it("P24: nobody can be made a second owner", async () => {
    expect((await call(roleRoute.PUT, T.owner, { id: ID.alice }, { role: "owner" }, "PUT")).status).toBe(400);
  });

  it("D25: the owner cannot deactivate or change the owner", async () => {
    expect((await call(deactivation.POST, T.owner, { id: ID.owner }, {})).status).toBe(403);
    expect((await call(roleRoute.PUT, T.owner, { id: ID.owner }, { role: "member" }, "PUT")).status).toBe(403);
  });

  it("D8: a member sees only their own person record", async () => {
    expect((await call(personItem.GET, T.bob, { id: ID.alice })).status).toBe(404);
    const list = await call(peopleRoute.GET, T.bob);
    expect(list.json.data.map((p: { id: string }) => p.id)).toEqual([ID.bob]);
    expect((await call(peopleRoute.GET, T.manager)).json.data.length).toBe(4);
  });

  it("D20: a person's level and pay cannot be set with a PATCH", async () => {
    expect((await call(personItem.PATCH, T.owner, { id: ID.alice }, { current_rate_cents: 9999 }, "PATCH")).status).toBe(400);
    expect((await call(personItem.PATCH, T.alice, { id: ID.alice }, { name: "Alice" }, "PATCH")).status).toBe(403);
  });
});

describe("one climb, start to finish", () => {
  it("a manager starts a person at a first level, inside the pay band", async () => {
    expect((await call(promotionsRoute.POST, T.manager, { id: ID.alice }, { to_level_id: ID.l1, new_rate_cents: 9900 })).status).toBe(422);
    const first = await call(promotionsRoute.POST, T.manager, { id: ID.alice }, { to_level_id: ID.l1, new_rate_cents: 1500 });
    expect(first.status).toBe(201);
    expect(first.json.from_level_id).toBeNull();
    const me = await call(meRoute.GET, T.alice);
    expect(me.json.current_level_id).toBe(ID.l1);
    expect(me.json.current_rate_cents).toBe(1500);
    ID.prog = me.json.progress.id;
  });

  it("D11, D13: nobody promotes themselves", async () => {
    expect((await call(promotionsRoute.POST, T.alice, { id: ID.alice }, { to_level_id: ID.l2, new_rate_cents: 1600 })).status).toBe(403);
    expect((await call(promotionsRoute.POST, T.manager, { id: ID.manager }, { to_level_id: ID.l1, new_rate_cents: 1500 })).status).toBe(403);
    expect((await call(promotionsRoute.POST, T.owner, { id: ID.owner }, { to_level_id: ID.l1, new_rate_cents: 1500 })).status).toBe(403);
  });

  it("D15, D16: a member sees pay for their own band and level only", async () => {
    expect((await call(levelItem.GET, T.alice, { id: ID.l1 })).json.recommended_rate_cents).toBe(1500);
    const next = await call(levelItem.GET, T.alice, { id: ID.l2 });
    expect(next.status).toBe(200);
    expect(next.json).not.toHaveProperty("recommended_rate_cents");
    expect((await call(bandItem.GET, T.alice, { id: ID.band })).json.max_rate_cents).toBe(1700);
    const other = await call(bandItem.GET, T.alice, { id: ID.band2 });
    expect(other.json).not.toHaveProperty("min_rate_cents");
    expect(other.json).not.toHaveProperty("max_rate_cents");
    const list = await call(levels.GET, T.alice, { id: ID.band });
    const l2 = list.json.data.find((l: { id: string }) => l.id === ID.l2);
    expect(l2).not.toHaveProperty("recommended_rate_cents");
    expect((await call(levelItem.GET, T.manager, { id: ID.l2 })).json.recommended_rate_cents).toBe(1600);
  });

  it("D17, D18: a member never gets the answer key, or another level's test", async () => {
    const mine = await call(testItem.GET, T.alice, { id: ID.test });
    expect(mine.status).toBe(200);
    expect(mine.json).not.toHaveProperty("answer_key");
    expect(mine.json.questions.length).toBe(2);
    expect((await call(testItem.GET, T.bob, { id: ID.test })).status).toBe(404);
    expect((await call(tests.GET, T.bob, { id: ID.topic })).json.data).toEqual([]);
    expect((await call(testItem.GET, T.manager, { id: ID.test })).json.answer_key).toBeDefined();
  });

  it("D3, D22: a member cannot read or write another person's progress", async () => {
    expect((await call(progressItem.GET, T.bob, { id: ID.prog })).status).toBe(404);
    expect((await call(work.POST, T.bob, { id: ID.prog }, { title: "Sneaky" })).status).toBe(404);
    expect((await call(results.GET, T.bob, { id: ID.prog })).status).toBe(404);
    expect((await call(completion.POST, T.bob, { id: ID.prog, topicId: ID.topic }, {})).status).toBe(404);
    expect((await call(certs.GET, T.bob, { id: ID.alice })).status).toBe(404);
    expect((await call(promotionsRoute.GET, T.bob, { id: ID.alice })).status).toBe(404);
  });

  it("the member learns, takes the test and submits work", async () => {
    expect((await call(completion.POST, T.alice, { id: ID.prog, topicId: ID.topic }, {})).status).toBe(201);
    const fail = await call(results.POST, T.alice, { id: ID.prog }, { test_id: ID.test, answers: { q_1: 1, q_2: 1 } });
    expect(fail.json.passed).toBe(false);
    expect(fail.json.score).toBe(50);
    const pass = await call(results.POST, T.alice, { id: ID.prog }, { test_id: ID.test, answers: { q_1: 0, q_2: 1 } });
    expect(pass.status).toBe(201);
    expect(pass.json.passed).toBe(true);
    expect(pass.json).not.toHaveProperty("answer_key");
    ID.result = pass.json.id;
    const item = await call(work.POST, T.alice, { id: ID.prog }, { title: "Side project", link: "https://example.com/pr/1" });
    expect(item.status).toBe(201);
    ID.work = item.json.id;
    const gift = await call(gifts.POST, T.alice, { id: ID.prog }, { title: "Better commit skill" });
    ID.gift = gift.json.id;
  });

  it("a promotion is refused until every check passes", async () => {
    const res = await call(promotionsRoute.POST, T.manager, { id: ID.alice }, { to_level_id: ID.l2, new_rate_cents: 1600 });
    expect(res.status).toBe(422);
    expect(res.json.detail).toContain("Prompt quiz");
    expect(res.json.detail).toContain("No work item is approved.");
    expect(res.json.detail).toContain("No contribution is approved.");
    expect((await call(meRoute.GET, T.alice)).json.current_level_id).toBe(ID.l1);
  });

  it("D9, D10: a member cannot review their own work or anyone's", async () => {
    expect((await call(workReview.POST, T.alice, { id: ID.work }, { decision: "passed" })).status).toBe(403);
    expect((await call(workReview.POST, T.bob, { id: ID.work }, { decision: "passed" })).status).toBe(404);
  });

  it("a manager reviews, and D21: passed work cannot be changed", async () => {
    const notYet = await call(workReview.POST, T.manager, { id: ID.work }, { decision: "not_yet", notes: "Add tests" });
    expect(notYet.status).toBe(201);
    const fixed = await call(workItem.PATCH, T.alice, { id: ID.work }, { notes: "Tests added" }, "PATCH");
    expect(fixed.json.status).toBe("submitted");
    expect((await call(workReview.POST, T.manager, { id: ID.work }, { decision: "passed" })).status).toBe(201);
    expect((await call(workItem.PATCH, T.alice, { id: ID.work }, { title: "Changed" }, "PATCH")).status).toBe(403);
    expect((await call(giftReview.POST, T.manager, { id: ID.gift }, { decision: "passed" })).status).toBe(201);
    expect((await call(resultReview.POST, T.manager, { id: ID.result }, { decision: "passed" })).status).toBe(201);
  });

  it("the promotion works, gives the pay step and issues the certification", async () => {
    const ready = await call(progressItem.GET, T.alice, { id: ID.prog });
    expect(ready.json.missing_for_promotion).toEqual([]);
    const res = await call(promotionsRoute.POST, T.manager, { id: ID.alice }, { to_level_id: ID.l2, new_rate_cents: 1600 });
    expect(res.status).toBe(201);
    expect(res.json.from_level_id).toBe(ID.l1);
    const me = await call(meRoute.GET, T.alice);
    expect(me.json.current_level_id).toBe(ID.l2);
    expect(me.json.current_rate_cents).toBe(1600);
    expect(me.json.progress.id).not.toBe(ID.prog);
    const list = await call(certs.GET, T.alice, { id: ID.alice });
    expect(list.json.data.map((c: { skill: string }) => c.skill)).toEqual(["Prompt basics"]);
    ID.cert = list.json.data[0].id;
    expect((await call(progressItem.GET, T.alice, { id: ID.prog })).json.status).toBe("completed");
  });

  it("the old test is closed to the member after the promotion", async () => {
    expect((await call(testItem.GET, T.alice, { id: ID.test })).status).toBe(404);
  });

  it("only a manager revokes a certification, and never their own", async () => {
    expect((await call(revocation.POST, T.alice, { id: ID.cert }, {})).status).toBe(403);
    const res = await call(revocation.POST, T.manager, { id: ID.cert }, {});
    expect(res.status).toBe(200);
    expect(res.json.revoked_by).toBe(ID.manager);
  });

  it("D26: a deactivated person is refused", async () => {
    expect((await call(deactivation.POST, T.manager, { id: ID.bob }, {})).status).toBe(403);
    expect((await call(deactivation.POST, T.owner, { id: ID.bob }, {})).status).toBe(200);
    expect((await call(meRoute.GET, T.bob)).status).toBe(401);
  });
});

describe("company spaces", () => {
  const signUp = { name: "Globex", slug: "globex", owner_name: "Greta", owner_email: "owner@example.com" };

  it("a new user makes a space and becomes its owner, with no token", async () => {
    const res = await call(spacesRoute.POST, null, {}, signUp);
    expect(res.status).toBe(201);
    expect(res.json.owner.role).toBe("owner");
    expect(res.json.space.slug).toBe("globex");
    expect(res.json.token).toMatch(/^trj_/);
    T.greta = res.json.token;
    ID.greta = res.json.owner.id;
    ID.globex = res.json.space.id;
    // The same email is fine in two spaces.
    expect(res.json.owner.email).toBe("owner@example.com");
  });

  it("refuses a taken, reserved or badly formed space name", async () => {
    expect((await call(spacesRoute.POST, null, {}, signUp)).status).toBe(409);
    expect((await call(spacesRoute.POST, null, {}, { ...signUp, slug: "admin" })).status).toBe(400);
    expect((await call(spacesRoute.POST, null, {}, { ...signUp, slug: "No Good" })).status).toBe(400);
  });

  it("sign-up can be closed", async () => {
    process.env.TRAJECTORY_SIGNUP = "closed";
    expect((await call(spacesRoute.POST, null, {}, { ...signUp, slug: "initech" })).status).toBe(403);
    delete process.env.TRAJECTORY_SIGNUP;
  });

  it("P32, P33: each person reads their own space, and only the owner renames it", async () => {
    expect((await call(spaceRoute.GET, T.greta)).json.slug).toBe("globex");
    expect((await call(spaceRoute.GET, T.alice)).json.slug).toBe("acme");
    expect((await call(spaceRoute.PATCH, T.manager, {}, { name: "X" }, "PATCH")).status).toBe(403);
    expect((await call(spaceRoute.PATCH, T.greta, {}, { name: "Globex Corp" }, "PATCH")).json.name).toBe("Globex Corp");
    expect((await call(spaceRoute.GET, T.owner)).json.name).toBe("Acme");
  });

  it("P30: a new space starts empty and sees nothing of another space", async () => {
    expect((await call(ladders.GET, T.greta)).json.data).toEqual([]);
    const seen = await call(peopleRoute.GET, T.greta);
    expect(seen.json.data.map((p: any) => p.id)).toEqual([ID.greta]);
  });

  it("P30: an owner cannot read any object of another space", async () => {
    expect((await call(ladderItem.GET, T.greta, { id: ID.ladder })).status).toBe(404);
    expect((await call(bands.GET, T.greta, { id: ID.ladder })).status).toBe(404);
    expect((await call(bandItem.GET, T.greta, { id: ID.band })).status).toBe(404);
    expect((await call(levelItem.GET, T.greta, { id: ID.l1 })).status).toBe(404);
    expect((await call(topics.GET, T.greta, { id: ID.l1 })).status).toBe(404);
    expect((await call(testItem.GET, T.greta, { id: ID.test })).status).toBe(404);
    expect((await call(personItem.GET, T.greta, { id: ID.alice })).status).toBe(404);
    expect((await call(progressItem.GET, T.greta, { id: ID.prog })).status).toBe(404);
    expect((await call(certs.GET, T.greta, { id: ID.alice })).status).toBe(404);
    expect((await call(promotionsRoute.GET, T.greta, { id: ID.alice })).status).toBe(404);
  });

  it("P30: an owner cannot change any object of another space", async () => {
    expect((await call(ladderItem.PATCH, T.greta, { id: ID.ladder }, { name: "Taken" }, "PATCH")).status).toBe(404);
    expect((await call(bands.POST, T.greta, { id: ID.ladder }, { name: "Mine", position: 9, min_rate_cents: 1, max_rate_cents: 2 })).status).toBe(404);
    expect((await call(levels.POST, T.greta, { id: ID.band }, { title: "Mine", position: 9, recommended_rate_cents: 1 })).status).toBe(404);
    expect((await call(bandItem.DELETE, T.greta, { id: ID.band }, undefined, "DELETE")).status).toBe(404);
    expect((await call(roleRoute.PUT, T.greta, { id: ID.alice }, { role: "manager" }, "PUT")).status).toBe(404);
    expect((await call(deactivation.POST, T.greta, { id: ID.alice }, {})).status).toBe(404);
    expect((await call(ladderItem.GET, T.owner, { id: ID.ladder })).json.name).toBe("AI Developer Ladder");
  });

  it("P30: a person cannot be promoted to a level of another space", async () => {
    const added = await call(peopleRoute.POST, T.greta, {}, { name: "Gil", email: "gil@example.com" });
    expect(added.status).toBe(201);
    const res = await call(promotionsRoute.POST, T.greta, { id: added.json.id }, { to_level_id: ID.l1, new_rate_cents: 1500 });
    expect(res.status).toBe(404);
    // A person of another space cannot be promoted from here.
    expect((await call(promotionsRoute.POST, T.greta, { id: ID.bob }, { to_level_id: ID.l1, new_rate_cents: 1500 })).status).toBe(404);
  });

  it("P31: on a space subdomain, only the people of that space sign in", async () => {
    process.env.TRAJECTORY_BASE_DOMAIN = "trajectory.test";
    expect((await call(meRoute.GET, T.greta, {}, undefined, "GET", "globex.trajectory.test")).status).toBe(200);
    expect((await call(meRoute.GET, T.greta, {}, undefined, "GET", "globex.trajectory.test:4700")).status).toBe(200);
    expect((await call(meRoute.GET, T.greta, {}, undefined, "GET", "acme.trajectory.test")).status).toBe(401);
    expect((await call(meRoute.GET, T.alice, {}, undefined, "GET", "globex.trajectory.test")).status).toBe(401);
    // The base domain itself has no space, so the token decides.
    expect((await call(meRoute.GET, T.greta, {}, undefined, "GET", "trajectory.test")).status).toBe(200);
    expect((await call(spaceRoute.GET, T.greta, {}, undefined, "GET", "globex.trajectory.test")).json.url).toBe("https://globex.trajectory.test");
    delete process.env.TRAJECTORY_BASE_DOMAIN;
  });
});
