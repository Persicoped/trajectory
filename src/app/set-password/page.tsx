import type { Metadata } from "next";
import { Page } from "../chrome";
import { LinkPasswordForm } from "../forms";
import { passwordLinkOwner } from "@/lib/password-links";

export const dynamic = "force-dynamic";
// The address of this page holds the link's secret. Do not pass it to other sites.
export const metadata: Metadata = { referrer: "no-referrer", robots: { index: false } };

export default async function SetPassword({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const owner = token ? passwordLinkOwner(token) : null;
  return (
    <Page nav={<a className="btn plain" href="/login">Sign in</a>}>
      <div className="wrap formbox">
        {owner && token ? (
          <>
            <h1>Choose your password</h1>
            <p className="lead">
              For {owner.name}. You sign in with the email {owner.email} and this password.
            </p>
            <LinkPasswordForm token={token} />
          </>
        ) : (
          <>
            <h1>This link does not work</h1>
            <p className="lead">The link was used before, or it is too old. Ask the Owner of your company for a new one.</p>
          </>
        )}
      </div>
    </Page>
  );
}
