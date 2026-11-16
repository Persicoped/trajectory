import { redirect } from "next/navigation";
import { signOutAction } from "../actions";
import { SetPasswordForm } from "../forms";
import { Page } from "../chrome";
import * as ladderBands from "@/app/v1/ladders/[id]/pay-bands/route";
import * as ladders from "@/app/v1/ladders/route";
import * as me from "@/app/v1/me/route";
import * as bandLevels from "@/app/v1/pay-bands/[id]/levels/route";
import * as people from "@/app/v1/people/route";
import * as space from "@/app/v1/space/route";
import { read } from "@/lib/web/session";

export const dynamic = "force-dynamic";

type Row = Record<string, any>;

const money = (cents: unknown) => (typeof cents === "number" ? `$${(cents / 100).toFixed(2)} / hr` : "not shown");
const days = (n: unknown) => (typeof n === "number" && n > 0 ? `${n} days` : "none");
const ROLE: Record<string, string> = { owner: "Owner", manager: "Manager", member: "Member" };

export default async function Company() {
  const person = await read<Row>(me.GET);
  if (!person) redirect("/login");
  const mySpace = (await read<Row>(space.GET)) ?? {};
  const ladderList = (await read<{ data: Row[] }>(ladders.GET))?.data ?? [];
  const full: Row[] = await Promise.all(
    ladderList.map(async (ladder) => {
      const bands = (await read<{ data: Row[] }>(ladderBands.GET, { id: ladder.id }))?.data ?? [];
      bands.sort((a, b) => a.position - b.position);
      const withLevels = await Promise.all(
        bands.map(async (band) => {
          const levels = (await read<{ data: Row[] }>(bandLevels.GET, { id: band.id }))?.data ?? [];
          levels.sort((a, b) => a.position - b.position);
          return { ...band, levels };
        }),
      );
      return { ...ladder, bands: withLevels };
    }),
  );
  const levelTitle = new Map<string, string>();
  for (const ladder of full) for (const band of ladder.bands) for (const level of band.levels) levelTitle.set(level.id, level.title);
  const team = (await read<{ data: Row[] }>(people.GET))?.data ?? [];
  const todo: string[] = person.missing_for_promotion ?? [];

  return (
    <Page
      nav={
        <form action={signOutAction}>
          <button className="btn plain" type="submit">Sign out</button>
        </form>
      }
    >
      <section className="section">
        <div className="wrap">
          <h2>{mySpace.name ?? "Your company"}</h2>
          <div className="facts">
            <div className="fact">
              <div className="k">Signed in as</div>
              <div className="v">{person.name}</div>
            </div>
            <div className="fact">
              <div className="k">Role</div>
              <div className="v">{ROLE[person.role] ?? person.role}</div>
            </div>
            <div className="fact">
              <div className="k">Your level</div>
              <div className="v">{levelTitle.get(person.current_level_id) ?? "Not on a level yet"}</div>
            </div>
            <div className="fact">
              <div className="k">Your rate</div>
              <div className="v">{person.current_level_id ? money(person.current_rate_cents) : "None yet"}</div>
            </div>
          </div>
          {mySpace.url && (
            <p className="muted">
              Your company address: <a href={mySpace.url}>{mySpace.url}</a>
            </p>
          )}
          {person.progress && (
            <div className="card" style={{ marginTop: 16 }}>
              <h3>{todo.length ? "Before your next promotion" : "You are ready for your next promotion"}</h3>
              {todo.length > 0 && (
                <ul className="todo">
                  {todo.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <h2>The ladder</h2>
          {full.length === 0 && <p className="muted">No ladder exists yet. A manager builds it through the API or the MCP server.</p>}
          {full.map((ladder) => (
            <div className="card" key={ladder.id} style={{ marginBottom: 16, overflowX: "auto" }}>
              <h3>{ladder.name}</h3>
              {ladder.description && <p style={{ marginBottom: 12 }}>{ladder.description}</p>}
              <table>
                <thead>
                  <tr>
                    <th>Pay band</th>
                    <th>Level</th>
                    <th>Recommended rate</th>
                    <th>Minimum time</th>
                  </tr>
                </thead>
                <tbody>
                  {ladder.bands.flatMap((band: Row) =>
                    band.levels.map((level: Row, i: number) => (
                      <tr key={level.id}>
                        <td className="bandname">{i === 0 ? band.name : ""}</td>
                        <td>
                          {level.title}
                          {level.id === person.current_level_id ? " (you are here)" : ""}
                        </td>
                        <td>{money(level.recommended_rate_cents)}</td>
                        <td>{days(level.min_duration_days)}</td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <h2>People</h2>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Level</th>
                  <th>Rate</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {team.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.email}</td>
                    <td>{ROLE[p.role] ?? p.role}</td>
                    <td>{levelTitle.get(p.current_level_id) ?? "Not on a level yet"}</td>
                    <td>{p.current_level_id ? money(p.current_rate_cents) : "None yet"}</td>
                    <td>{p.active ? "Active" : "Deactivated"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ marginTop: 16 }}>
            This website is for reading. To build the ladder, add people, review work or promote someone, use the API or the MCP server from your AI
            tools.
          </p>
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <h2>Your password</h2>
          <SetPasswordForm />
        </div>
      </section>
    </Page>
  );
}
