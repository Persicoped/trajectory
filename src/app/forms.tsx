"use client";

import { useActionState } from "react";
import { keySignInAction, setPasswordAction, signInAction, signUpAction, type FormState } from "./actions";

const start: FormState = { error: null, values: {} };

export function SignUpForm({ baseDomain }: { baseDomain: string | null }) {
  const [state, action, busy] = useActionState(signUpAction, start);
  const v = state.values;
  return (
    <form action={action}>
      {state.error && <p className="error" role="alert">{state.error}</p>}
      <label htmlFor="name">Company name</label>
      <input id="name" name="name" defaultValue={v.name} required autoComplete="organization" />
      <label htmlFor="slug">Web address</label>
      <div className="addr">
        <input id="slug" name="slug" defaultValue={v.slug} required pattern="[a-z][a-z0-9\-]{1,30}[a-z0-9]" placeholder="acme" autoCapitalize="none" spellCheck={false} />
        {baseDomain && <span>.{baseDomain}</span>}
      </div>
      <div className="hint">3 to 32 lowercase letters, digits or hyphens. You cannot change it later.</div>
      <label htmlFor="ownerName">Your name</label>
      <input id="ownerName" name="ownerName" defaultValue={v.ownerName} required autoComplete="name" />
      <label htmlFor="ownerEmail">Email</label>
      <input id="ownerEmail" name="ownerEmail" type="email" defaultValue={v.ownerEmail} required autoComplete="email" />
      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" required minLength={10} autoComplete="new-password" />
      <div className="hint">10 characters or more.</div>
      <button className="btn" type="submit" disabled={busy}>
        {busy ? "Creating..." : "Create company"}
      </button>
    </form>
  );
}

export function SignInForm({ slug }: { slug: string | null }) {
  const [state, action, busy] = useActionState(signInAction, start);
  const v = state.values;
  return (
    <form action={action}>
      {state.error && <p className="error" role="alert">{state.error}</p>}
      {!slug && (
        <>
          <label htmlFor="slug">Company web address</label>
          <input id="slug" name="slug" defaultValue={v.slug} required placeholder="acme" autoCapitalize="none" spellCheck={false} />
        </>
      )}
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" defaultValue={v.email} required autoComplete="email" />
      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" required autoComplete="current-password" />
      <button className="btn" type="submit" disabled={busy}>
        {busy ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}

export function KeySignInForm() {
  const [state, action, busy] = useActionState(keySignInAction, start);
  return (
    <form action={action}>
      {state.error && <p className="error" role="alert">{state.error}</p>}
      <label htmlFor="key">Access key</label>
      <input id="key" name="key" type="password" required autoComplete="off" spellCheck={false} />
      <div className="hint">The key starts with trj_. After you sign in, set a password on your company page.</div>
      <button className="btn" type="submit" disabled={busy}>
        {busy ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}

export function SetPasswordForm() {
  const [state, action, busy] = useActionState(setPasswordAction, start);
  return (
    <form action={action} style={{ maxWidth: 360 }}>
      {state.error && <p className="error" role="alert">{state.error}</p>}
      {state.values.done && <p role="status"><strong>Saved.</strong> Use this password the next time you sign in.</p>}
      <label htmlFor="newPassword">New password</label>
      <input id="newPassword" name="password" type="password" required minLength={10} autoComplete="new-password" />
      <div className="hint">10 characters or more.</div>
      <button className="btn plain" type="submit" disabled={busy} style={{ marginTop: 12 }}>
        {busy ? "Saving..." : "Save password"}
      </button>
    </form>
  );
}
