import { Page } from "./chrome";
import * as me from "@/app/v1/me/route";
import { read } from "@/lib/web/session";

export const dynamic = "force-dynamic";

const STEPS = [
  ["1. LEARN", "Learn", "Each level has a small set of topics."],
  ["2. PROVE IT", "Prove it", "The person passes a test, then delivers real work."],
  ["3. GIVE BACK", "Give back", "The person improves the team's shared AI agents and skills."],
  ["4. GET CERTIFIED", "Get certified", "The company certifies the new skill. A new title, a badge and a pay step follow."],
];

const DRIVES = [
  ["Mastery", "Short levels, clear tests, certified skills."],
  ["Autonomy", "People choose topics and set their own pace above a minimum time."],
  ["Purpose", "Real work that ships, and tools that help the whole team."],
];

export default async function Home() {
  const signedIn = Boolean(await read(me.GET));
  const nav = signedIn ? (
    <a className="btn" href="/app">Open your company</a>
  ) : (
    <>
      <a className="btn plain" href="/login">Sign in</a>
      <a className="btn" href="/signup">Create a company</a>
    </>
  );
  return (
    <Page nav={nav}>
      <section className="hero">
        <div className="wrap">
          <h1>How humans accelerate their growth in the AI workplace.</h1>
          <p>
            Trajectory is a career ladder for teams that build with AI. It gives every new hire a clear path from day one: small levels, fast
            promotions, fair pay steps, and skills that the company certifies.
          </p>
          <div className="row">
            {signedIn ? (
              <a className="btn" href="/app">Open your company</a>
            ) : (
              <>
                <a className="btn" href="/signup">Create your company</a>
                <a className="btn plain" href="/login">Sign in</a>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <h2>Why it exists</h2>
          <div className="grid">
            <div className="card">
              <h3>For the person</h3>
              <p>A visible path. Each month there is a new level to reach, a new skill to prove, and a reward for reaching it.</p>
            </div>
            <div className="card">
              <h3>For the company</h3>
              <p>A team that grows in skill on a schedule you can see, with pay tied to proven results.</p>
            </div>
            <div className="card">
              <h3>For both</h3>
              <p>Every level ends in real work that ships, so growth for the person is value for the company.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <h2>How a level works</h2>
          <div className="grid">
            {STEPS.map(([step, title, body]) => (
              <div className="card" key={step}>
                <div className="step">{step}</div>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <h2>Built on the science of motivation</h2>
          <div className="grid">
            {DRIVES.map(([title, body]) => (
              <div className="card" key={title}>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <h2>Run it from your AI tools</h2>
          <p className="muted" style={{ maxWidth: 640 }}>
            Trajectory is headless. Your team builds the ladder, takes tests, reviews work and promotes people from the AI tools they use each day,
            through an API and an MCP server. This website lets you create your company and read where everyone stands.
          </p>
          <div className="row" style={{ marginTop: 20 }}>
            {!signedIn && <a className="btn" href="/signup">Create your company</a>}
            <a className="btn plain" href="https://github.com/Persicoped/trajectory">Read the docs</a>
          </div>
        </div>
      </section>
    </Page>
  );
}
