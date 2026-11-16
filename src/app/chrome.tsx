import type { ReactNode } from "react";

// The top bar and the footer that every page shares.
export function Page({ nav, children }: { nav?: ReactNode; children: ReactNode }) {
  return (
    <>
      <header className="top">
        <div className="wrap">
          <a className="brand" href="/">
            Trajectory
          </a>
          <nav className="nav">{nav}</nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="foot">
        <div className="wrap">
          Trajectory is open source. <a href="https://github.com/Persicoped/trajectory">See the code on GitHub.</a>
        </div>
      </footer>
    </>
  );
}
