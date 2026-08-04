// n(사람 수)과 synth(단일/종합)를 항목 파일에 실제 필드로 박는다.
// 문장에서 정규식으로 뽑는 방식은 3분의 1을 놓쳐서 못 쓴다.
// 뽑히는 것만 채우고, 못 뽑은 것은 n: null 로 남겨 Codex 가 채우게 한다.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "entries");

const META = /메타분석|메타 분석|체계적 검토|코크란|합치자|합쳐|합쳐도|모아보니|네트워크 분석|시험 \d+개|\d+편|연구 \d+개|검토에서/;

let filled = 0, blank = 0;
const todo = [];

for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
  const p = join(dir, f);
  const e = JSON.parse(readFileSync(p, "utf8"));
  const text = `${e.line} ${e.saw}`;

  const people = [...text.matchAll(/([\d,]+)\s*명/g)]
    .map((m) => Number(m[1].replace(/,/g, ""))).filter(Number.isFinite);

  const n = people.length ? Math.max(...people) : null;
  const synth = META.test(text) ? "meta" : "single";

  // 필드 순서를 유지하려고 통째로 다시 만든다
  const out = {};
  for (const [k, v] of Object.entries(e)) {
    if (k === "n" || k === "synth" || k === "thin") continue;
    out[k] = v;
    if (k === "dir") { out.n = n; out.synth = synth; }
  }
  if (!("n" in out)) { out.n = n; out.synth = synth; }

  writeFileSync(p, JSON.stringify(out, null, 2) + "\n", "utf8");
  if (n === null) { blank++; todo.push(`${e.tier.padEnd(7)}${synth.padEnd(7)}${e.subj} — ${e.line.slice(0, 40)}`); }
  else filled++;
}

console.log(`n 채움 ${filled}건 · 미상 ${blank}건`);
if (todo.length) {
  console.log(`\n사람 수를 채워야 할 항목 (원문을 보고 n 을 넣어라):`);
  todo.forEach((t) => console.log("  " + t));
}
