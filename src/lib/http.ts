import "server-only";
import { ZodError, type ZodType } from "zod";
import { defineAbilityFor, ForbiddenError, getActor, OutsideSpace, type Actor, type AppAbility } from "@/lib/authz";
import { toCamel, toSnake } from "./case";

export class HttpError extends Error {
  constructor(
    public status: number,
    public title: string,
    public detail?: string,
  ) {
    super(title);
  }
}

export const notFound = () => new HttpError(404, "Not found");
export const conflict = (detail: string) => new HttpError(409, "Conflict", detail);

export function problem(status: number, title: string, detail?: string): Response {
  return new Response(JSON.stringify({ type: "about:blank", title, status, detail }), {
    status,
    headers: { "content-type": "application/problem+json" },
  });
}

export type Ctx<P> = {
  req: Request;
  me: NonNullable<Actor>;
  ability: AppAbility;
  params: P;
  // Read the JSON body and check it against a schema.
  body: <T>(schema: ZodType<T>) => Promise<T>;
};

// Wrap a route handler. It finds who is asking, builds the ability once, and
// turns errors into problem replies.
export function route<P = Record<string, string>>(
  fn: (ctx: Ctx<P>) => unknown | Promise<unknown>,
  options: { status?: number } = {},
) {
  return async (req: Request, context: { params: Promise<P> }): Promise<Response> => {
    try {
      const me = await getActor(req);
      // P2: a request with no known person is refused.
      if (!me) return problem(401, "Sign-in needed", "Send a valid bearer token.");
      const ability = defineAbilityFor(me);
      const body = <T>(schema: ZodType<T>) => readBody(req, schema);
      const result = await fn({ req, me, ability, params: await context.params, body });
      if (result instanceof Response) return result;
      return Response.json(toSnake(result), { status: options.status ?? 200 });
    } catch (error) {
      return failure(error);
    }
  };
}

// Read a JSON body and check it against a schema.
async function readBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, "Bad request", "The body is not valid JSON.");
  }
  return schema.parse(toCamel(raw));
}

// Turn an error into a problem reply.
function failure(error: unknown): Response {
  if (error instanceof HttpError) return problem(error.status, error.title, error.detail);
  // P30: a row of another space does not exist for this person.
  if (error instanceof OutsideSpace) return problem(404, "Not found");
  if (error instanceof ForbiddenError) {
    // Do not reveal that an object exists to a person who may not read it.
    const action = String(error.action);
    return action.startsWith("read") ? problem(404, "Not found") : problem(403, "Not allowed");
  }
  if (error instanceof ZodError) {
    const detail = error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    return problem(400, "Bad request", detail);
  }
  console.error(error);
  return problem(500, "Server error");
}

// A route that needs no sign-in. Only sign-up uses it.
export function publicRoute(
  fn: (ctx: { req: Request; body: <T>(schema: ZodType<T>) => Promise<T> }) => unknown | Promise<unknown>,
  options: { status?: number } = {},
) {
  return async (req: Request): Promise<Response> => {
    try {
      const result = await fn({ req, body: (schema) => readBody(req, schema) });
      return Response.json(toSnake(result), { status: options.status ?? 200 });
    } catch (error) {
      return failure(error);
    }
  };
}

// A page of a list. The cursor is the offset of the next page.
export function page<T>(req: Request, rows: T[]): { data: T[]; nextCursor: string | null } {
  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 200);
  const offset = Math.max(Number(url.searchParams.get("cursor")) || 0, 0);
  const data = rows.slice(offset, offset + limit);
  return { data, nextCursor: offset + limit < rows.length ? String(offset + limit) : null };
}
