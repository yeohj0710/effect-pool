// data/entries.json + src/template.html -> site/index.html
// site/ 는 생성물이다. 직접 고치지 마라.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const dataPath = join(root, "data", "entries.json");
const tplPath = join(root, "src", "template.html");
const outDir = join(root, "site");

const raw = readFileSync(dataPath, "utf8");
const data = JSON.parse(raw);

/* ---- 규칙 검사. 하나라도 걸리면 빌드를 세운다 ---- */

const TIERS = new Set(data.tiers.map((t) => t.id));
const DIRS = new Set(["pos", "open", "null", "harm"]);
const REQUIRED = ["id", "subj", "claim", "line", "tier", "dir",
                  "why", "saw", "limit", "against", "use", "src", "queried"];

const errors = [];
const warnings = [];
const seen = new Set();

data.entries.forEach((e, i) => {
  const at = `[${i}] ${e.subj ?? "?"}`;

  REQUIRED.forEach((k) => {
    if (e[k] === undefined || e[k] === null || e[k] === "") errors.push(`${at} — ${k} 비어 있음`);
  });
  if (!TIERS.has(e.tier)) errors.push(`${at} — tier 값이 이상함: ${e.tier}`);
  if (!DIRS.has(e.dir)) errors.push(`${at} — dir 값이 이상함: ${e.dir}`);

  // 중복: 물질 + 주장 조합
  const key = `${e.subj}::${e.claim}::${e.tier}::${e.dir}`;
  if (seen.has(key)) errors.push(`${at} — 같은 물질·주장·판정이 이미 있음`);
  seen.add(key);

  // 조회 기록이 없으면 "0건"과 "안 찾아봤음"을 구분할 수 없다
  const q = e.queried || {};
  if (!q.date) errors.push(`${at} — queried.date 없음`);
  if (!q.negative) errors.push(`${at} — 반대쪽을 따로 찾은 기록이 없음`);
  if (!q.safety) errors.push(`${at} — 안전성을 따로 찾은 기록이 없음`);

  // 빈 자리 표시로 넘어가는 것을 막는다
  if (e.against === "—" || e.against === "-") {
    errors.push(`${at} — against 를 "—" 로 두지 마라. 찾아본 결과를 문장으로 적어라`);
  }

  // 번역투·수동형 걸러내기
  const BAD = ["확인됐", "보고됐", "나타났습니다", "현재 존재하는", "시사합니다",
               "근거를 제공합니다", "가능성이 제기", "주목할 만한", "되어집", "지고 있습니다"];
  const hit = BAD.filter((w) => e.line.includes(w));
  if (hit.length) warnings.push(`${at} — 한 줄에 번역투: ${hit.join(", ")}`);
});

// 반대·해로운 쪽 비중
const off = data.entries.filter((e) => e.dir === "null" || e.dir === "harm").length;
const ratio = off / data.entries.length;
if (ratio < 1 / 3) {
  warnings.push(
    `효과 없음·해로운 쪽이 ${off}/${data.entries.length} (${Math.round(ratio * 100)}%). ` +
    `한쪽만 보고 있다는 뜻이다. 반대쪽과 안전성 검색을 다시 돌려라.`
  );
}

warnings.forEach((w) => console.warn("주의  " + w));
if (errors.length) {
  errors.forEach((e) => console.error("오류  " + e));
  console.error(`\n${errors.length}건 걸려서 빌드를 세웁니다.`);
  process.exit(1);
}

/* ---- 출력 ---- */

const tpl = readFileSync(tplPath, "utf8");
const html = tpl.replace("__ENTRIES__", JSON.stringify(data));

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "index.html"), html, "utf8");

const byTier = data.tiers
  .map((t) => `${t.id} ${data.entries.filter((e) => e.tier === t.id).length}`)
  .join(" · ");

console.log(`site/index.html 만들었습니다 — ${data.entries.length}건 (${byTier})`);
console.log(`효과 없음·해로운 쪽 ${off}건 (${Math.round(ratio * 100)}%)`);
