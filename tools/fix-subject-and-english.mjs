// subj 가 질환으로 들어간 항목을 물질로 되돌리고, 문장에 남은 영문 약물명을 한글로 바꾼다.
// 자동 추출 주제가 "naltrexone — Obesity에 듣는다" 꼴이라 주어를 뒤집기 쉽다.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "entries");

// id → 올바른 물질명
const SUBJ = {
  "gabapentin-cancer": "가바펜틴",
  "gabapentin-nausea": "가바펜틴",
  "gabapentin-opioid-use-null": "가바펜틴",
  "gabapentin-drug-dependence-null": "가바펜틴",
  "naltrexone-obesity-null": "날트렉손·부프로피온",
  "naltrexone-pain-null": "저용량 날트렉손",
  "naltrexone-substance-use": "날트렉손",
  "propranolol-prostate-carcinoma-null": "프로프라놀롤",
  "propranolol-cirrhosis": "프로프라놀롤",
};

// 문장에 남은 영문 약물명
const ENG = [
  [/naltrexone[-–]bupropion/gi, "날트렉손·부프로피온"],
  [/naltrexone/gi, "날트렉손"],
  [/bupropion/gi, "부프로피온"],
  [/gabapentin/gi, "가바펜틴"],
  [/propranolol/gi, "프로프라놀롤"],
  [/metformin/gi, "메트포르민"],
  [/mebendazole/gi, "메벤다졸"],
  [/aspirin/gi, "아스피린"],
  [/ketamine/gi, "케타민"],
  [/topiramate/gi, "토피라메이트"],
];

let n = 0;
for (const [id, subj] of Object.entries(SUBJ)) {
  const p = join(dir, id + ".json");
  if (!existsSync(p)) continue;
  const e = JSON.parse(readFileSync(p, "utf8"));
  if (e.subj === subj) continue;
  console.log(`  subj  ${e.subj} → ${subj}   (${id})`);
  e.subj = subj;
  writeFileSync(p, JSON.stringify(e, null, 2) + "\n", "utf8");
  n++;
}

let m = 0;
for (const f of (await import("node:fs")).readdirSync(dir).filter((x) => x.endsWith(".json"))) {
  const p = join(dir, f);
  const e = JSON.parse(readFileSync(p, "utf8"));
  const before = e.line;
  for (const [re, ko] of ENG) e.line = e.line.replace(re, ko);
  // 문장이 subj 로 시작하게 되면 화면이 또 겹친다
  e.line = e.line.replace(new RegExp("^" + e.subj.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*[—–]?\\s*"), "");
  if (e.line !== before) {
    console.log(`  영문  ${e.subj}\n        ${before.slice(0, 56)}\n     →  ${e.line.slice(0, 56)}`);
    writeFileSync(p, JSON.stringify(e, null, 2) + "\n", "utf8");
    m++;
  }
}

console.log(`\nsubj ${n}건 · 영문 ${m}건 고쳤습니다.`);
