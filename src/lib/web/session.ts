import "server-only";
import { cookies, headers } from "next/headers";
import { spaceSlugOfHost } from "@/lib/authz/actor";

// The web pages keep the session token in a cookie that scripts cannot read.
// The pages send it to the API as a bearer token, on the server. The API
// itself never reads a cookie, so a foreign site cannot make a signed-in
// browser change anything.
const COOKIE = "trj_session";
const MONTH = 60 * 60 * 24 * 30;

export async function sessionToken(): Promise<string | null> {
  return (await cookies()).get(COOKIE)?.value ?? null;
}

export async function startSession(token: string): Promise<void> {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MONTH,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

async function hostHeader(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-host") ?? h.get("host") ?? "";
}

// The space name in the address, such as "acme" in acme.trajectory.example.
export async function hostSlug(): Promise<string | null> {
  return spaceSlugOfHost(new Request("http://internal/", { headers: { "x-forwarded-host": await hostHeader() } }));
}

type Handler = (req: Request, ctx: { params: Promise<any> }) => Promise<Response>;

// Read from the API as the signed-in person. The pages call the same handlers
// that serve /v1, so the same access rules apply. Null means "not allowed" or
// "not signed in".
export async function read<T = any>(handler: Handler, params: Record<string, string> = {}): Promise<T | null> {
  const token = await sessionToken();
  if (!token) return null;
  const req = new Request("http://internal/v1?limit=200", {
    headers: { authorization: "Bearer " + token, "x-forwarded-host": await hostHeader() },
  });
  const res = await handler(req, { params: Promise.resolve(params) });
  return res.ok ? ((await res.json()) as T) : null;
}
