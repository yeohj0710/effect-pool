// 알맹이가 없는 항목을 data/parked/ 로 옮긴다. 지우지 않는다.
// 조사한 흔적(queried, refs)은 남겨두고, 나중에 결과가 나오면 되살린다.
//
// 빼는 기준 두 가지
//   1. refs 에 논문이 하나도 없다 — 등록정보(NCT)만 있으면 "아직 아무도 결과를 안 냈다"는 뜻이다
//   2. 문장에 결과가 없다 — "결과가 아직 없습니다", "시험이 있습니다" 는 읽어도 남는 게 없다
//
//   node tools/park-thin-entries.mjs [--write]

import { readFileSync, writeFileSync, readdirSync, mkdirSync, renameSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "data", "entries");
const parkDir = join(root, "data", "parked");
const WL = join(root, "data", "worklist.md");
const WRITE = process.argv.includes("--write");

export const hasPaper = (e) => (e.refs ?? []).some((r) => r.doi || r.pmid || r.pmc);
export const NO_RESULT =
  /(결과가 아직 없|결과가 아직 나오지 않|결과가 공개되지 않|효과를 평가한 (소규모 )?시험이 있|시험이 등록|시험만 있|진행 중이고 결과는|아직 보고되지 않)/;

const parked = [];
for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
  const e = JSON.parse(readFileSync(join(dir, f), "utf8"));
  const why = !hasPaper(e) ? "논문 없이 등록정보만"
            : NO_RESULT.test(e.line) ? "문장에 결과가 없음" : null;
  if (why) parked.push({ f, e, why });
}

const byWhy = {};
parked.forEach((p) => (byWhy[p.why] = (byWhy[p.why] ?? 0) + 1));

console.log(`빼둘 항목 ${parked.length}건`);
Object.entries(byWhy).forEach(([w, n]) => console.log(`  ${w} ${n}건`));
parked.slice(0, 6).forEach((p) => console.log(`    ${p.e.subj} — ${p.e.line.slice(0, 44)}`));

if (!WRITE) { console.log("\n--write 를 붙이면 실제로 옮깁니다."); process.exit(0); }

mkdirSync(parkDir, { recursive: true });
for (const p of parked) renameSync(join(dir, p.f), join(parkDir, p.f));

// worklist 에 표시해서 다시 파지 않게 한다
if (existsSync(WL)) {
  const today = process.env.TODAY || "2026-08-05";
  const subjects = new Set(parked.map((p) => p.e.subj));
  const out = readFileSync(WL, "utf8").split("\n").map((l) => {
    if (!/^- \[x\]/.test(l) || /결과 대기/.test(l)) return l;
    const head = l.replace(/^- \[x\]\s*/, "").split("—")[0].trim();
    return subjects.has(head) ? `${l}  — 결과 대기(${today})` : l;
  }).join("\n");
  writeFileSync(WL, out, "utf8");
}

console.log(`\ndata/parked/ 로 옮겼습니다. 남은 항목 ${readdirSync(dir).filter((x) => x.endsWith(".json")).length}건`);
