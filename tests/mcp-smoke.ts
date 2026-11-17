// A live check of the MCP server. It needs a running API and two tokens.
// Usage: TRAJECTORY_URL=... OWNER_TOKEN=... MEMBER_TOKEN=... tsx tests/mcp-smoke.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function connect(token: string) {
  const client = new Client({ name: "smoke", version: "0" });
  await client.connect(
    new StdioClientTransport({
      command: "node_modules/.bin/tsx",
      args: ["mcp/server.ts"],
      env: { ...process.env, TRAJECTORY_TOKEN: token } as Record<string, string>,
    }),
  );
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const res: any = await client.callTool({ name, arguments: args });
    const text = res.content[0].text as string;
    return { error: Boolean(res.isError), text, json: res.isError ? null : JSON.parse(text) };
  };
  return { client, call };
}

let failed = 0;
const check = (label: string, ok: boolean, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : "  " + detail}`);
};

async function main() {
  const owner = await connect(process.env.OWNER_TOKEN!);
  const member = await connect(process.env.MEMBER_TOKEN!);

  const tools = await owner.client.listTools();
  check("the server lists its tools", tools.tools.length === 23, `got ${tools.tools.length}`);

  const me = await owner.call("my_status");
  check("owner: my_status", me.json?.role === "owner", me.text);

  const space = await owner.call("my_space");
  check("owner: my_space", space.json?.slug === "acme", space.text);

  const ladders = await owner.call("list_ladders");
  const ladder = await owner.call("show_ladder", { ladder_id: ladders.json[0].id });
  const first = ladder.json.pay_bands[0].levels[0];
  const next = ladder.json.pay_bands[1].levels[0];
  check("owner: show_ladder gives bands and levels with pay", ladder.json.pay_bands.length === 2 && next.recommended_rate_cents === 1500, ladder.text);

  const topic = await owner.call("build_topic", { level_id: first.id, name: "Prompt basics" });
  check("owner: build_topic", !topic.error, topic.text);
  const test = await owner.call("build_test", {
    topic_id: topic.json.id,
    title: "Prompt quiz",
    questions: [{ id: "q1", prompt: "Pick the first.", choices: ["a", "b"] }],
    answer_key: { q1: 0 },
  });
  check("owner: build_test", !test.error, test.text);

  const people = await owner.call("list_people");
  const bob = people.json.find((p: any) => p.role === "member");
  const place = await owner.call("promote", { person_id: bob.id, to_level_id: first.id, new_rate_cents: 1200 });
  check("owner: promote puts a new person on the first level", !place.error, place.text);

  const mine = await member.call("my_status");
  check("member: my_status shows the level", mine.json?.current_level_id === first.id, mine.text);
  const seen = await member.call("show_ladder", { ladder_id: ladders.json[0].id });
  check("member: pay of another band is hidden", seen.json.pay_bands[1].min_rate_cents === undefined, seen.text);
  const level = await member.call("show_level", { level_id: first.id });
  check("member: show_level gives the test with no answer key", level.json.topics[0].tests[0] && level.json.topics[0].tests[0].answer_key === undefined, level.text);

  check("member: mark_topic_learned", !(await member.call("mark_topic_learned", { topic_id: topic.json.id })).error);
  const result = await member.call("submit_test", { test_id: test.json.id, answers: { q1: 0 } });
  check("member: submit_test passes", result.json?.passed === true, result.text);
  const work = await member.call("submit_work", { title: "Side project page" });
  const gift = await member.call("submit_contribution", { title: "Fix a skill" });
  check("member: submit_work and submit_contribution", !work.error && !gift.error, work.text + gift.text);

  const self = await member.call("review", { kind: "work_item", id: work.json.id, decision: "passed" });
  check("member: cannot review", self.error && self.text.startsWith("403"), self.text);
  const noAdd = await member.call("add_person", { name: "X", email: "x@example.com" });
  check("member: cannot add a person", noAdd.error && noAdd.text.startsWith("403"), noAdd.text);
  const early = await owner.call("promote", { person_id: bob.id, to_level_id: next.id, new_rate_cents: 1500 });
  check("owner: promote is refused before the reviews", early.error, early.text);
  console.log("      reason: " + early.text.replace(/\n/g, " "));

  for (const [kind, target] of [["work_item", work.json.id], ["contribution", gift.json.id], ["test_result", result.json.id]]) {
    const r = await owner.call("review", { kind, id: target, decision: "passed" });
    check(`owner: review ${kind}`, !r.error, r.text);
  }
  const person = await owner.call("show_person", { person_id: bob.id });
  check("owner: show_person gives the current progress", person.json?.current_progress?.work_items.length === 1, person.text);

  await owner.client.close();
  await member.client.close();
  console.log(failed ? `${failed} FAILED` : "ALL PASS");
  process.exit(failed ? 1 : 0);
}

void main();
