// The Trajectory MCP server. It talks on standard input and output.
// Settings: TRAJECTORY_URL (default http://localhost:4700) and
// TRAJECTORY_TOKEN. It reads them from the environment, or from .env.local in
// the project folder.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildServer, makeApi } from "./tools";

const envFile = join(__dirname, "..", ".env.local");
if (!process.env.TRAJECTORY_TOKEN && existsSync(envFile)) process.loadEnvFile(envFile);

const token = process.env.TRAJECTORY_TOKEN;
if (!token) {
  console.error("TRAJECTORY_TOKEN is not set. Put it in the environment or in .env.local.");
  process.exit(1);
}

const baseUrl = (process.env.TRAJECTORY_URL ?? "http://localhost:4700").replace(/\/$/, "");
void buildServer(makeApi(baseUrl, token)).connect(new StdioServerTransport());
