"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { password } from "@/lib/passwords";
import { getActor } from "@/lib/authz/actor";
import { redeemPasswordLink } from "@/lib/password-links";
import { setPassword, signIn, signOut } from "@/lib/signin";
import { createToken } from "@/lib/tokens";
import { createSpace, signUp, SlugTaken } from "@/lib/spaces";
import { endSession, hostSlug, sessionToken, startSession } from "@/lib/web/session";

export type FormState = { error: string | null; values: Record<string, string> };

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

// Create a company space. The person who creates it is its Owner.
export async function signUpAction(_: FormState, form: FormData): Promise<FormState> {
  const values = {
    name: text(form, "name"),
    slug: text(form, "slug").toLowerCase(),
    ownerName: text(form, "ownerName"),
    ownerEmail: text(form, "ownerEmail"),
  };
  if (process.env.TRAJECTORY_SIGNUP === "closed") return { error: "Sign-up is closed on this install.", values };
  const input = signUp.extend({ ownerPassword: password }).safeParse({ ...values, ownerPassword: String(form.get("password") ?? "") });
  if (!input.success) {
    const issue = input.error.issues[0];
    const field: Record<string, string> = { name: "Company name", slug: "Web address", ownerName: "Your name", ownerEmail: "Email", ownerPassword: "Password" };
    return { error: `${field[String(issue.path[0])] ?? "Form"}: ${issue.message}`, values };
  }
  let token: string;
  try {
    token = createSpace(input.data).token;
  } catch (error) {
    if (error instanceof SlugTaken) return { error: "This web address is taken. Choose another one.", values };
    throw error;
  }
  await startSession(token);
  redirect("/app");
}

const signInInput = z.object({ slug: z.string().min(1), email: z.string().min(1), password: z.string().min(1) });

export async function signInAction(_: FormState, form: FormData): Promise<FormState> {
  const values = { slug: ((await hostSlug()) ?? text(form, "slug")).toLowerCase(), email: text(form, "email") };
  const input = signInInput.safeParse({ ...values, password: String(form.get("password") ?? "") });
  const token = input.success ? signIn(input.data.slug, input.data.email, input.data.password) : null;
  if (!token) return { error: "The company, email or password is not right.", values };
  await startSession(token);
  redirect("/app");
}

async function actorOf(token: string) {
  return getActor(new Request("http://internal/", { headers: { authorization: "Bearer " + token } }));
}

// Sign in with a personal access key. This is for a person who has a key and
// no password yet. The web session gets its own token, so sign-out does not
// stop the key.
export async function keySignInAction(_: FormState, form: FormData): Promise<FormState> {
  const actor = await actorOf(String(form.get("key") ?? "").trim());
  if (!actor) return { error: "This access key is not right.", values: {} };
  await startSession(createToken(actor.personId, "web session"));
  redirect("/app");
}

// Set or change your own password.
export async function setPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const token = await sessionToken();
  const actor = token ? await actorOf(token) : null;
  if (!actor) redirect("/login");
  const input = password.safeParse(String(form.get("password") ?? ""));
  if (!input.success) return { error: "Password: " + input.error.issues[0].message, values: {} };
  setPassword(actor.personId, input.data);
  return { error: null, values: { done: "yes" } };
}

// Choose a password with a one-time link, then go to the company page.
export async function linkPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const input = password.safeParse(String(form.get("password") ?? ""));
  if (!input.success) return { error: "Password: " + input.error.issues[0].message, values: {} };
  const token = redeemPasswordLink(text(form, "token"), input.data);
  if (!token) return { error: "This link was used before, or it is too old. Ask for a new one.", values: {} };
  await startSession(token);
  redirect("/app");
}

export async function signOutAction(): Promise<void> {
  const token = await sessionToken();
  if (token) signOut(token);
  await endSession();
  redirect("/");
}
