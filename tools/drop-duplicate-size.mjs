// 문장에서 규모 숫자를 뺀다. 오른쪽 태그가 이미 같은 숫자를 보여준다.
//
// 조사가 "개"·"편"에 붙어 있는 경우만 건드린다. 그래야 문법이 안 깨진다.
//   "29개·11,306명을 합쳐도"  ->  "29개를 합쳐도"      안전
//   "9편 966명 메타분석에서"  ->  "9편 메타분석에서"    안전
//   "환자 121명을 무작위로"    ->  손대지 않음          "환자를" 로 바꾸면 뜻이 바뀐다
//
//   node tools/drop-duplicate-size.mjs [--write]

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "entries");
const WRITE = process.argv.includes("--write");

const RULES = [
  // "시험 29개·11,306명을" / "시험 82개 10,332명을" -> 개·편만 남긴다
  [/(\d+(?:개|편))\s*[·,]?\s*[\d,]+명/g, "$1"],
  // "29,018명 메타분석에서" -> "메타분석에서"
  [/[\d,]+명\s*(?=메타분석|네트워크 분석|통합분석|체계적 검토|코크란)/g, ""],
  // "명"(받침 있음) 뒤에 붙던 조사가 "개"(받침 없음) 뒤로 오면 안 맞는다
  [/개을(?=\s)/g, "개를"], [/개이(?=\s)/g, "개가"], [/개은(?=\s)/g, "개는"],
  [/편를(?=\s)/g, "편을"], [/편가(?=\s)/g, "편이"], [/편는(?=\s)/g, "편은"],
];

let n = 0;
const rows = [];
for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
  const p = join(dir, f);
  const e = JSON.parse(readFileSync(p, "utf8"));
  let line = e.line;
  for (const [re, to] of RULES) line = line.replace(re, to);
  line = line.replace(/\s{2,}/g, " ").trim();
  if (line === e.line) continue;

  rows.push([e.subj, e.line, line]);
  if (WRITE) { e.line = line; writeFileSync(p, JSON.stringify(e, null, 2) + "\n", "utf8"); }
  n++;
}

rows.forEach(([s, a, b]) => console.log(`  ${s}\n    전 ${a}\n    후 ${b}\n`));

const all = readdirSync(dir).filter((x) => x.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")))
  .map((e) => [...`${e.subj} — ${e.line}`].length).sort((a, b) => a - b);

console.log(`${n}건 ${WRITE ? "고쳤습니다" : "바뀔 예정입니다"}.`);
console.log(`한 줄 길이 — 중앙 ${all[all.length >> 1]}자 · 50자 초과 ${all.filter((x) => x > 50).length}건 / ${all.length}`);
if (!WRITE) console.log("--write 를 붙이면 실제로 고칩니다.");
