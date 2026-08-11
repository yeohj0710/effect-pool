// 주어 이름을 바꾼다. 영문으로 들어온 이름을 읽는 사람이 쓰는 말로 옮길 때 쓴다.
//
//   node tools/rename-subject.mjs "myofascial release" "근막이완"
//   node tools/rename-subject.mjs --file rename.tsv     한 줄에 "옛 이름<탭>새 이름"
//
// 손으로 고치면 두 군데가 어긋난다 — 항목의 subj 와 data/kinds.json 의 열쇠다.
// 하나만 바꾸면 빌드가 "갈래를 모릅니다" 로 선다. 그래서 도구로 묶어둔다.
//
// id 와 파일명은 건드리지 않는다. 주소로 쓰이는 값이라 바꾸면 걸어둔 링크가 죽는다.

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENTRY_DIR = join(root, "data", "entries");
const KINDS = join(root, "data", "kinds.json");

const args = process.argv.slice(2);
let pairs = [];
if (args[0] === "--file") {
  if (!existsSync(args[1])) { console.error(`${args[1]} 이 없습니다`); process.exit(1); }
  pairs = readFileSync(args[1], "utf8").split("\n")
    .map((l) => l.trim()).filter(Boolean).filter((l) => !l.startsWith("#"))
    .map((l) => l.split("\t").map((x) => x.trim()));
} else if (args.length >= 2) {
  pairs = [[args[0], args[1]]];
} else {
  console.error('쓰는 법: node tools/rename-subject.mjs "old name" "새 이름"');
  process.exit(1);
}

const bad = pairs.filter(([a, b]) => !a || !b || a === b);
if (bad.length) { console.error(`짝이 안 맞는 줄 ${bad.length}개`); process.exit(1); }
if (pairs.some(([, b]) => /[a-z][a-z-]{3,}/.test(b))) {
  console.error("새 이름에 영문이 남아 있습니다. 옮길 말이 없으면 그냥 두세요");
  process.exit(1);
}

const kinds = JSON.parse(readFileSync(KINDS, "utf8"));
const files = readdirSync(ENTRY_DIR).filter((f) => f.endsWith(".json"));
const map = new Map(pairs);
let touched = 0;
const hitNames = new Set();

for (const f of files) {
  const p = join(ENTRY_DIR, f);
  const e = JSON.parse(readFileSync(p, "utf8"));
  const next = map.get(e.subj);
  if (!next) continue;
  hitNames.add(e.subj);
  e.subj = next;
  writeFileSync(p, JSON.stringify(e, null, 1) + "\n", "utf8");
  touched++;
}

for (const [from, to] of pairs) {
  if (!(from in kinds)) { console.warn(`kinds.json 에 "${from}" 이 없습니다`); continue; }
  // 이미 그 이름으로 다른 갈래가 잡혀 있으면 사람이 봐야 한다
  if (to in kinds && kinds[to] !== kinds[from]) {
    console.error(`"${to}" 가 이미 ${kinds[to]} 로 있는데 "${from}" 은 ${kinds[from]} 입니다. 먼저 정하세요`);
    process.exit(1);
  }
  kinds[to] = kinds[from];
  delete kinds[from];
}

const sorted = Object.fromEntries(Object.keys(kinds).sort((a, b) => a.localeCompare(b, "ko")).map((k) => [k, kinds[k]]));
writeFileSync(KINDS, JSON.stringify(sorted, null, 1) + "\n", "utf8");

const missed = pairs.map(([a]) => a).filter((a) => !hitNames.has(a));
console.log(`주어 ${hitNames.size}종을 옮겼습니다 · 항목 ${touched}건 · kinds.json 갱신`);
if (missed.length) console.warn(`항목에서 못 찾은 이름: ${missed.join(", ")}`);
console.log("node build.mjs 로 확인하세요");
