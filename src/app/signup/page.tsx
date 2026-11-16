import { redirect } from "next/navigation";
import { Page } from "../chrome";
import { SignUpForm } from "../forms";
import * as me from "@/app/v1/me/route";
import { read } from "@/lib/web/session";

export const dynamic = "force-dynamic";

export default async function SignUp() {
  if (await read(me.GET)) redirect("/app");
  const closed = process.env.TRAJECTORY_SIGNUP === "closed";
  return (
    <Page nav={<a className="btn plain" href="/login">Sign in</a>}>
      <div className="wrap formbox">
        <h1>Create your company</h1>
        <p className="lead">You become the Owner of the new company space. You can add your people after that.</p>
        {closed ? <p className="error">Sign-up is closed on this install.</p> : <SignUpForm baseDomain={process.env.TRAJECTORY_BASE_DOMAIN ?? null} />}
        <p className="alt">
          Does your company have a space? <a href="/login">Sign in</a>
        </p>
      </div>
    </Page>
  );
}
