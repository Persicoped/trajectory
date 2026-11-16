import { Page } from "../../chrome";
import { KeySignInForm } from "../../forms";

export const dynamic = "force-dynamic";

export default function KeySignIn() {
  return (
    <Page nav={<a className="btn plain" href="/login">Sign in with a password</a>}>
      <div className="wrap formbox">
        <h1>Sign in with an access key</h1>
        <p className="lead">Use this if you have an access key and no password yet.</p>
        <KeySignInForm />
      </div>
    </Page>
  );
}
