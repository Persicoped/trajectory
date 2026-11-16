# Trajectory

**How humans accelerate their growth in the AI workplace.**

Trajectory is an open source, headless career ladder. It gives every new hire a clear path from day one: small levels, fast promotions, fair pay steps, and skills the company certifies.

## Why it exists

Early-career people leave when they cannot see a future. Companies lose them right after they train them. Trajectory fixes both sides of that problem.

- **For the person:** a visible path. Each month there is a new level to reach, a new skill to prove, and a reward for reaching it.
- **For the company:** a team that grows in skill on a schedule you can see, with pay tied to proven results.
- **For both:** every level ends in real work that ships, so growth for the person is value for the company.

## How it works

1. **Learn.** Each level has a small set of topics.
2. **Prove it.** The person passes a test, then delivers real work.
3. **Give back.** The person improves the team's shared AI agents and skills.
4. **Get certified.** The company certifies the new skill. A new title, a badge, and a pay step follow.

## Built on the science of motivation

The design follows three ideas from research on what motivates people:

- **Mastery:** short levels, clear tests, certified skills.
- **Autonomy:** people choose topics and set their own pace above a minimum time.
- **Purpose:** real work that ships, and tools that help the whole team.

## Headless by design

Trajectory has no screen of its own. It is a REST API with an MCP server on top, so you can run it from the AI tools your team already uses.

- Build your own pay bands and levels.
- Use the ready-made AI developer ladder, or write a ladder for any job.
- Role-based access: the Owner runs the company space, managers build and approve, members see and act on their own record only.

## Run it

You need Node 22 and pnpm.

```bash
pnpm install
pnpm db:seed "Your Name" you@example.com "Your Company" your-company
pnpm dev
```

The seed command makes the database, your company space, you as its Owner, and a sample ladder. It prints a token one time. Send the token with each request:

```bash
curl -H "Authorization: Bearer <token>" http://localhost:4700/v1/me
```

## Company spaces

One install serves many companies. Each company has its own space and its own subdomain, and no company can see another.

A new user signs up with one request, and becomes the Owner of the new space:

```bash
curl -X POST http://localhost:4700/v1/spaces -H "content-type: application/json" -d '{"name":"Acme","slug":"acme","owner_name":"Ann","owner_email":"ann@acme.example"}'
```

Set `TRAJECTORY_BASE_DOMAIN` (for example `trajectory.example`) and each space answers on `<slug>.trajectory.example`. Set `TRAJECTORY_SIGNUP=closed` to stop sign-up.

## Talk to it

The MCP server lets an AI tool work with Trajectory for you. It calls the REST API with your token, so it can do only what you are allowed to do.

1. Start the API: `pnpm dev`.
2. Put your token in `.env.local`:

```bash
TRAJECTORY_TOKEN=<token>
```

3. Add the server to your MCP client. The project folder is the working directory:

```json
{
  "mcpServers": {
    "trajectory": {
      "command": "node_modules/.bin/tsx",
      "args": ["mcp/server.ts"]
    }
  }
}
```

Then ask in plain words: "show my status", "show the ladder", "add a person", "promote this person".

To make a token for a person you added:

```bash
pnpm db:token your-company person@example.com "laptop"
```

## Docs

- [Objects](docs/objects.md)
- [Access policy](docs/access-policy.md)
- [API design](docs/api-design.md)
- [Technology stack](docs/tech-stack.md)

## Status

Early build. The REST API and the MCP server work with token sign-in. Sign-in through an identity provider is not built yet.
