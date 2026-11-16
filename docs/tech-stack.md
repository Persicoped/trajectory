# Technology stack

These are the choices for Trajectory.

| Part | Choice | Why |
|---|---|---|
| App | Next.js, API routes only, no screens | The API and the MCP server live in one app |
| Access rules | CASL, in one decision point | One Next.js app uses CASL. The rules are in [access-policy.md](access-policy.md) |
| Database tool | Drizzle ORM | Light, and a good fit for SQLite |
| Database | SQLite | No database server to set up. One company's ladder is a small amount of data |
| Hosting | One small server or a container | SQLite is a file on a disk, so the app needs a disk that stays |

## Limits

- The app cannot run on a serverless host with no lasting disk.
- Migrations, drift checks and seed data for Drizzle are done by hand in this project.
