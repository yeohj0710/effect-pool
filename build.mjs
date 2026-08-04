// data/meta.json + data/entries/*.json + src/template.html -> site/index.html
// site/ 는 생성물이다. 직접 고치지 마라.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const dataDir = join(root, "data");
const entryDir = join(dataDir, "entries");
const outDir = join(root, "site");

const meta = JSON.parse(readFileSync(join(dataDir, "meta.json"), "utf8"));

const files = readdirSync(entryDir).filter((f) => f.endsWith(".json")).sort();
const entries = [];
const errors = [];
const warnings = [];

for (const f of files) {
  try {
    entries.push(JSON.parse(readFileSync(join(entryDir, f), "utf8")));
  } catch (err) {
    errors.push(`${f} — JSON 이 깨졌습니다: ${err.message}`);
  }
}

/* ---- 규칙 검사. 하나라도 걸리면 빌드를 세운다 ---- */

const TIERS = new Set(meta.tiers.map((t) => t.id));
const STEP = Object.fromEntries(meta.tiers.map((t) => [t.id, t.step]));
const DIRS = new Set(["pos", "open", "null", "harm"]);
const REQUIRED = ["id", "subj", "claim", "line", "tier", "dir",
                  "why", "saw", "limit", "against", "use", "refs", "queried"];
const REF_IDS = ["doi", "pmid", "pmc", "nct"];

meta.tiers.forEach((t) => {
  if (!Number.isInteger(t.step) || t.step < 1 || t.step > 5) {
    errors.push(`tier ${t.id} — step 이 1~5 정수가 아닙니다`);
  }
});

const seen = new Set();
const ids = new Set();

entries.forEach((e, i) => {
  const at = `${e.id ?? files[i]}`;

  REQUIRED.forEach((k) => {
    if (e[k] === undefined || e[k] === null || e[k] === "") errors.push(`${at} — ${k} 비어 있음`);
  });
  if (!TIERS.has(e.tier)) errors.push(`${at} — tier 값이 이상함: ${e.tier}`);
  if (!DIRS.has(e.dir)) errors.push(`${at} — dir 값이 이상함: ${e.dir}`);

  // 파일명과 id 가 다르면 나중에 찾지 못한다
  if (e.id && files[i] !== `${e.id}.json`) {
    errors.push(`${at} — 파일명이 id 와 다릅니다 (${files[i]})`);
  }
  if (ids.has(e.id)) errors.push(`${at} — id 가 중복됩니다`);
  ids.add(e.id);

  // 같은 물질·주장·판정이 두 번
  const key = `${e.subj}::${e.claim}::${e.tier}::${e.dir}`;
  if (seen.has(key)) errors.push(`${at} — 같은 물질·주장·판정이 이미 있습니다`);
  seen.add(key);

  // 조회 기록이 없으면 "0건"과 "안 찾아봤음"을 구분할 수 없다
  const q = e.queried || {};
  if (!q.date) errors.push(`${at} — queried.date 없음`);
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(q.date)) errors.push(`${at} — queried.date 형식이 이상함: ${q.date}`);
  if (!q.negative) errors.push(`${at} — 반대쪽을 따로 찾은 기록이 없음`);
  if (!q.safety) errors.push(`${at} — 안전성을 따로 찾은 기록이 없음`);

  // 빈 자리 표시로 넘어가는 것을 막는다
  if (e.against === "—" || e.against === "-") {
    errors.push(`${at} — against 를 "—" 로 두지 마라. 찾아본 결과를 문장으로 적어라`);
  }

  // 읽는 사람이 원문으로 넘어갈 수 없으면 항목이 아니다
  if (!Array.isArray(e.refs) || e.refs.length === 0) {
    errors.push(`${at} — refs 가 비어 있음. 원문으로 갈 수 있어야 한다`);
  } else {
    e.refs.forEach((r, j) => {
      if (!r.label) errors.push(`${at} refs[${j}] — label 없음`);
      if (!REF_IDS.filter((k) => r[k]).length) {
        errors.push(`${at} refs[${j}] — doi·pmid·pmc·nct 중 하나는 있어야 링크가 걸린다`);
      }
      if (r.doi && !/^10\.\d{4,9}\//.test(r.doi)) errors.push(`${at} refs[${j}] — doi 형식이 이상함: ${r.doi}`);
      if (r.nct && !/^NCT\d{8}$/.test(r.nct)) errors.push(`${at} refs[${j}] — nct 형식이 이상함: ${r.nct}`);
      if (r.pmc && !/^PMC\d+$/.test(r.pmc)) errors.push(`${at} refs[${j}] — pmc 형식이 이상함: ${r.pmc}`);
      if (r.pmid && !/^\d+$/.test(r.pmid)) errors.push(`${at} refs[${j}] — pmid 형식이 이상함: ${r.pmid}`);
    });
  }

  // 화면이 subj 를 따로 붙인다. line 이 또 그걸로 시작하면 "침 — 침 — ..." 이 된다
  if (e.subj && e.line) {
    const esc = e.subj.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp("^" + esc + "\\s*[—–]").test(e.line)) {
      errors.push(`${at} — line 이 물질명으로 시작합니다. 화면이 이미 붙이니 빼세요`);
    } else if (/^[^—–]{1,25}\s*[—–]\s/.test(e.line)) {
      warnings.push(`${at} — line 앞에 "…—" 토막이 붙어 있습니다: ${e.line.slice(0, 24)}`);
    }
  }

  // 번역투·수동형 걸러내기
  const BAD = ["확인됐", "보고됐", "나타났습니다", "현재 존재하는", "시사합니다", "시사했",
               "근거를 제공합니다", "가능성이 제기", "주목할 만한", "되어집", "지고 있습니다",
               "연관됐", "제시했습니다", "관련됐", "확정하지 못", "정하지 못했"];
  const hit = BAD.filter((w) => (e.line || "").includes(w));
  if (hit.length) warnings.push(`${at} — 한 줄에 번역투: ${hit.join(", ")}`);

  // 근거의 무게 — 설계만 보면 36명 시험과 6만 명 메타분석이 같은 칸에 온다.
  // 문장에서 정규식으로 뽑으면 3분의 1을 놓친다. 그래서 필드로 받는다.
  // 눈금은 안 깎는다. 깎으면 "얇은 5칸"과 "제대로 된 4칸"이 구분되지 않는다.
  if (!("n" in e)) errors.push(`${at} — n 필드가 없습니다. 사람 수를 적으세요 (모르면 null)`);
  if (e.n !== null && e.n !== undefined && !(Number.isInteger(e.n) && e.n > 0)) {
    errors.push(`${at} — n 은 양의 정수이거나 null 이어야 합니다: ${e.n}`);
  }
  if (!["single", "meta"].includes(e.synth)) {
    errors.push(`${at} — synth 는 "single"(단일 연구) 또는 "meta"(여러 연구 합침) 여야 합니다`);
  }

  e.thin = e.synth === "single" && Number.isInteger(e.n) && e.n < 50;
  if (e.tier === "trial" && e.thin) {
    warnings.push(`${at} — 사람 ${e.n}명짜리 단일 연구 하나로 맨 위 칸입니다. 근거가 얇습니다`);
  }
  if (e.tier === "trial" && e.n === null) {
    warnings.push(`${at} — 사람 수 미상. 원문을 보고 n 을 채우세요`);
  }
});

// 반대·해로운 쪽 비중
const off = entries.filter((e) => e.dir === "null" || e.dir === "harm").length;
const ratio = entries.length ? off / entries.length : 0;
if (entries.length >= 6 && ratio < 1 / 3) {
  warnings.push(
    `효과 없음·해로운 쪽이 ${off}/${entries.length} (${Math.round(ratio * 100)}%). ` +
    `한쪽만 보고 있다는 뜻입니다. 반대쪽과 안전성 검색을 다시 돌리세요.`
  );
}

warnings.forEach((w) => console.warn("주의  " + w));
if (errors.length) {
  errors.forEach((e) => console.error("오류  " + e));
  console.error(`\n${errors.length}건 걸려서 빌드를 세웁니다.`);
  process.exit(1);
}

/* ---- 출력 ---- */

// 사람에게 가까운 칸부터, 같은 칸 안에서는 파일명 순
entries.sort((a, b) => (STEP[b.tier] - STEP[a.tier]) || a.id.localeCompare(b.id));

const updated = entries.map((e) => e.queried.date).sort().at(-1) ?? "";
const data = { updated, tiers: meta.tiers, entries };

const tpl = readFileSync(join(root, "src", "template.html"), "utf8");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "index.html"), tpl.replace("__ENTRIES__", JSON.stringify(data)), "utf8");

/* ---- 진행 상황 ---- */

const byTier = meta.tiers
  .map((t) => `${t.id} ${entries.filter((e) => e.tier === t.id).length}`)
  .join(" · ");
const refCount = entries.reduce((a, e) => a + e.refs.length, 0);

console.log(`site/index.html 만들었습니다 — ${entries.length}건 (${byTier})`);
console.log(`효과 없음·해로운 쪽 ${off}건 (${Math.round(ratio * 100)}%) · 연결된 근거 자료 ${refCount}건`);

const wl = join(dataDir, "worklist.md");
if (existsSync(wl)) {
  const md = readFileSync(wl, "utf8");
  const done = (md.match(/^- \[x\]/gim) || []).length;
  const todo = (md.match(/^- \[ \]/gim) || []).length;
  console.log(`조사 목록 ${done}/${done + todo} 끝냄 · ${todo}개 남음`);
}
