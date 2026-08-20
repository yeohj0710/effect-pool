import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const repo = dirname(root);
const output = join(repo, "site");
const state = join(repo, "etc", "codex-deploy-state", "effect-pool.sha256");
const checkOnly = process.argv.includes("--check");

function filesUnder(dir) {
  if (!existsSync(dir)) return [];
  const files = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files.push(...filesUnder(path));
    else files.push(path);
  }
  return files;
}

function payloadHash() {
  const paths = [
    ...filesUnder(output),
    join(repo, "vercel.json"),
    join(repo, ".vercelignore"),
    join(repo, ".vercel", "project.json"),
  ].filter(existsSync).sort();
  const hash = createHash("sha256");
  for (const path of paths) {
    hash.update(relative(repo, path).replaceAll("\\", "/"));
    hash.update("\0");
    hash.update(readFileSync(path));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function cleanGeneratedDeploymentArtifacts() {
  // `vercel build` writes its output under the repo-level `.vercel` directory.
  // Never copy that directory into `site`: timestamps and diagnostics would
  // make an unchanged public payload look new on every check.
  rmSync(join(output, ".vercel"), { recursive: true, force: true });
  rmSync(join(output, "vercel.json"), { force: true });
}

if (!existsSync(join(output, "index.html"))) {
  console.error("site/index.html 이 없다. npm run build 를 먼저 한다.");
  process.exit(1);
}

// Deploy the already-built static payload directly to avoid a duplicate remote build.
cleanGeneratedDeploymentArtifacts();

const current = payloadHash();
const previous = existsSync(state) ? readFileSync(state, "utf8").trim() : "";
if (current === previous) {
  console.log("배포할 변경 없음 — Vercel 배포를 건너뛴다.");
  process.exit(0);
}
if (checkOnly) {
  console.log("배포 산출물이 바뀌었다 — 실제 배포는 실행하지 않았다.");
  process.exit(0);
}

if (process.platform === "win32") {
  const shell = process.env.ComSpec ?? "cmd.exe";
  execFileSync(shell, ["/d", "/s", "/c", "npx vercel build --prod --yes"], { cwd: repo, stdio: "inherit" });
  execFileSync(shell, ["/d", "/s", "/c", "npx vercel deploy --prebuilt --prod --yes"], { cwd: repo, stdio: "inherit" });
} else {
  execFileSync("npx", ["vercel", "build", "--prod", "--yes"], { cwd: repo, stdio: "inherit" });
  execFileSync("npx", ["vercel", "deploy", "--prebuilt", "--prod", "--yes"], { cwd: repo, stdio: "inherit" });
}
mkdirSync(dirname(state), { recursive: true });
writeFileSync(state, `${current}\n`, "utf8");
