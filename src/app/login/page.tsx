import { redirect } from "next/navigation";
import { Page } from "../chrome";
import { SignInForm } from "../forms";
import * as me from "@/app/v1/me/route";
import { hostSlug, read } from "@/lib/web/session";

export const dynamic = "force-dynamic";

export default async function SignIn() {
  if (await read(me.GET)) redirect("/app");
  const slug = await hostSlug();
  return (
    <Page nav={<a className="btn plain" href="/signup">Create a company</a>}>
      <div className="wrap formbox">
        <h1>Sign in</h1>
        <p className="lead">{slug ? `Sign in to the ${slug} space.` : "Sign in to your company space."}</p>
        <SignInForm slug={slug} />
        <p className="alt">
          New here? <a href="/signup">Create a company</a>
        </p>
        <p className="alt">
          <a href="/login/key">Sign in with an access key</a>
        </p>
      </div>
    </Page>
  );
}
