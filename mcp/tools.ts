// The MCP tools for Trajectory. Each tool calls the REST API with the caller's
// own token, so the API applies the same access rules. No tool reads the
// database.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

type Json = Record<string, any>;
export type Api = (method: string, path: string, body?: unknown) => Promise<any>;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// Make the function that calls the API.
export function makeApi(baseUrl: string, token: string): Api {
  return async (method, path, body) => {
    let res: Response;
    try {
      res = await fetch(baseUrl + path, {
        method,
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError(0, `The Trajectory API does not answer at ${baseUrl}. Start it with "pnpm dev".`);
    }
    const text = await res.text();
    let json: Json | null = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // The reply was not JSON. The status line below tells the caller.
    }
    if (!res.ok) {
      const why = json ? [json.title, json.detail].filter(Boolean).join(": ") : res.statusText;
      throw new ApiError(res.status, `${res.status} ${why}`);
    }
    return json;
  };
}

const id = z.string().min(1);
const cents = z.number().int().min(0);

export function buildServer(api: Api): McpServer {
  const server = new McpServer({ name: "trajectory", version: "0.1.0" });

  // Read all pages of a list.
  const list = async (path: string): Promise<Json[]> => {
    const rows: Json[] = [];
    let cursor: string | null = null;
    do {
      const sep = path.includes("?") ? "&" : "?";
      const reply = await api("GET", cursor ? `${path}${sep}cursor=${encodeURIComponent(cursor)}` : path);
      rows.push(...reply.data);
      cursor = reply.next_cursor ?? null;
    } while (cursor);
    return rows;
  };

  // A list that the caller may not be allowed to read gives an empty list.
  const listIfAllowed = async (path: string) => {
    try {
      return await list(path);
    } catch (error) {
      if (error instanceof ApiError && (error.status === 404 || error.status === 403)) return [];
      throw error;
    }
  };

  const myProgressId = async (): Promise<string> => {
    const me = await api("GET", "/v1/me");
    if (!me.progress) throw new ApiError(409, "You are not on a level yet. A manager must put you on the first level.");
    return me.progress.id;
  };

  const tool = <S extends z.ZodRawShape>(
    name: string,
    description: string,
    shape: S,
    run: (args: z.infer<z.ZodObject<S>>) => Promise<unknown>,
    readOnly = false,
  ) => {
    server.registerTool(
      name,
      { description, inputSchema: shape, annotations: { readOnlyHint: readOnly } },
      (async (args: z.infer<z.ZodObject<S>>) => {
        try {
          return { content: [{ type: "text" as const, text: JSON.stringify(await run(args), null, 2) }] };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return { isError: true, content: [{ type: "text" as const, text: message }] };
        }
      }) as any,
    );
  };

  // ---- Your own record ----

  tool("my_status", "Show your own record: role, level, pay, current progress, and what is left before a promotion.", {}, () => api("GET", "/v1/me"), true);

  tool("my_space", "Show your company space: its name, its subdomain name and its web address.", {}, () => api("GET", "/v1/space"), true);

  tool("rename_space", "Change the name of your company space. Only the Owner can do this.", { name: z.string().min(1) }, (body) => api("PATCH", "/v1/space", body));

  tool("list_ladders", "List the career ladders.", {}, () => list("/v1/ladders"), true);

  tool(
    "show_ladder",
    "Show one ladder with its pay bands and the levels in each band. Money is in cents.",
    { ladder_id: id },
    async ({ ladder_id }) => {
      const ladder = await api("GET", `/v1/ladders/${ladder_id}`);
      const bands = await list(`/v1/ladders/${ladder_id}/pay-bands`);
      const pay_bands = await Promise.all(bands.map(async (band) => ({ ...band, levels: await list(`/v1/pay-bands/${band.id}/levels`) })));
      return { ...ladder, pay_bands };
    },
    true,
  );

  tool(
    "show_level",
    "Show one level with its topics and the tests for each topic.",
    { level_id: id },
    async ({ level_id }) => {
      const level = await api("GET", `/v1/levels/${level_id}`);
      const topics = await list(`/v1/levels/${level_id}/topics`);
      const withTests = await Promise.all(topics.map(async (topic) => ({ ...topic, tests: await listIfAllowed(`/v1/topics/${topic.id}/tests`) })));
      return { ...level, topics: withTests };
    },
    true,
  );

  tool("mark_topic_learned", "Mark a topic of your current level as learned.", { topic_id: id }, async ({ topic_id }) =>
    api("POST", `/v1/progress/${await myProgressId()}/topics/${topic_id}/completion`),
  );

  tool("get_test", "Read a test and its questions. Use this before submit_test.", { test_id: id }, ({ test_id }) => api("GET", `/v1/tests/${test_id}`), true);

  tool(
    "submit_test",
    "Submit your answers to a test of your current level. The system gives the score. In answers, each key is a question id and each value is the number of the chosen answer, where the first choice is 0.",
    { test_id: id, answers: z.record(z.string(), z.number().int().min(0)) },
    async ({ test_id, answers }) => api("POST", `/v1/progress/${await myProgressId()}/test-results`, { test_id, answers }),
  );

  const submission = { title: z.string().min(1), link: z.string().optional(), notes: z.string().optional() };
  tool("submit_work", "Submit a piece of real work for your current level. A manager reviews it.", submission, async (body) =>
    api("POST", `/v1/progress/${await myProgressId()}/work-items`, body),
  );
  tool("submit_contribution", "Submit a contribution to the team's shared agents and skills for your current level. A manager reviews it.", submission, async (body) =>
    api("POST", `/v1/progress/${await myProgressId()}/contributions`, body),
  );

  // ---- People ----

  tool("list_people", "List the people you are allowed to see. A member sees only their own record.", {}, () => list("/v1/people"), true);

  tool(
    "show_person",
    "Show one person: their record, their progress on the current level, the items that wait for a review, their certifications and their promotions.",
    { person_id: id },
    async ({ person_id }) => {
      const person = await api("GET", `/v1/people/${person_id}`);
      const progress = await list(`/v1/people/${person_id}/progress`);
      const active = progress.find((p) => p.status === "active");
      const current = active
        ? {
            ...(await api("GET", `/v1/progress/${active.id}`)),
            test_results: await list(`/v1/progress/${active.id}/test-results`),
            work_items: await list(`/v1/progress/${active.id}/work-items`),
            contributions: await list(`/v1/progress/${active.id}/contributions`),
          }
        : null;
      return {
        ...person,
        current_progress: current,
        past_progress: progress.filter((p) => p.status !== "active"),
        certifications: await list(`/v1/people/${person_id}/certifications`),
        promotions: await list(`/v1/people/${person_id}/promotions`),
      };
    },
    true,
  );

  tool("add_person", "Add a person. The new person is a Member. Only the Owner can do this.", { name: z.string().min(1), email: z.string().email() }, (body) =>
    api("POST", "/v1/people", body),
  );

  tool("set_role", "Give or remove the Manager role. Only the Owner can do this.", { person_id: id, role: z.enum(["member", "manager"]) }, ({ person_id, role }) =>
    api("PUT", `/v1/people/${person_id}/role`, { role }),
  );

  // ---- Reviews and promotions ----

  const reviewPath = { work_item: "work-items", contribution: "contributions", test_result: "test-results" } as const;
  tool(
    "review",
    "Decide on a work item, a contribution, or the talk-through review of a test result. A manager does this for other people, never for their own record.",
    { kind: z.enum(["work_item", "contribution", "test_result"]), id, decision: z.enum(["passed", "not_yet"]), notes: z.string().optional() },
    ({ kind, id: target, decision, notes }) => api("POST", `/v1/${reviewPath[kind]}/${target}/reviews`, { decision, notes }),
  );

  tool(
    "promote",
    "Move a person to a level and set the new hourly rate in cents. Use it also to put a new person on their first level. The system refuses if a check fails and says which one.",
    { person_id: id, to_level_id: id, new_rate_cents: cents },
    ({ person_id, ...body }) => api("POST", `/v1/people/${person_id}/promotions`, body),
  );

  // ---- Build the ladder ----

  tool("build_ladder", "Create a ladder.", { name: z.string().min(1), description: z.string().optional() }, (body) => api("POST", "/v1/ladders", body));

  tool(
    "build_pay_band",
    "Create a pay band in a ladder. Rates are hourly, in cents. Position 1 is the lowest band.",
    {
      ladder_id: id,
      name: z.string().min(1),
      position: z.number().int().min(1),
      min_rate_cents: cents,
      max_rate_cents: cents,
      min_duration_days: z.number().int().min(0).optional(),
    },
    ({ ladder_id, ...body }) => api("POST", `/v1/ladders/${ladder_id}/pay-bands`, body),
  );

  tool(
    "build_level",
    "Create a level in a pay band. The recommended rate is hourly, in cents. Position 1 is the lowest level in the band.",
    {
      pay_band_id: id,
      title: z.string().min(1),
      position: z.number().int().min(1),
      recommended_rate_cents: cents,
      min_duration_days: z.number().int().min(0).optional(),
    },
    ({ pay_band_id, ...body }) => api("POST", `/v1/pay-bands/${pay_band_id}/levels`, body),
  );

  tool(
    "build_topic",
    "Create a topic in a level. A required topic gives a certification when the person is promoted.",
    { level_id: id, name: z.string().min(1), description: z.string().optional(), required: z.boolean().optional() },
    ({ level_id, ...body }) => api("POST", `/v1/levels/${level_id}/topics`, body),
  );

  tool(
    "build_test",
    "Create a test for a topic. Each question has an id, a prompt and two or more choices. In answer_key, each key is a question id and each value is the number of the correct choice, where the first choice is 0. The pass mark is a percent.",
    {
      topic_id: id,
      title: z.string().min(1),
      questions: z.array(z.object({ id: z.string().min(1), prompt: z.string().min(1), choices: z.array(z.string()).min(2) })).min(1),
      answer_key: z.record(z.string(), z.number().int().min(0)),
      pass_mark: z.number().int().min(1).max(100).optional(),
    },
    ({ topic_id, ...body }) => api("POST", `/v1/topics/${topic_id}/tests`, body),
  );

  return server;
}
