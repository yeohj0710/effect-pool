// data/meta.json + data/entries/*.json + src/template.html -> site/index.html
// site/ 는 생성물이다. 직접 고치지 마라.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, copyFileSync } from "node:fs";
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

  // 등록정보(NCT)만 있으면 아직 아무도 결과를 안 낸 것이다. 그건 항목이 아니다.
  if (Array.isArray(e.refs) && e.refs.length && !e.refs.some((r) => r.doi || r.pmid || r.pmc)) {
    errors.push(`${at} — 논문 없이 등록정보만 있습니다. 결과가 나온 뒤에 만드세요`);
  }
  // "결과가 아직 없습니다" 는 읽어도 남는 게 없다
  if (/(결과가 아직 없|결과가 아직 나오지 않|결과가 공개되지 않|효과를 평가한 (소규모 )?시험이 있|시험이 등록|시험만 있|아직 보고되지 않)/.test(e.line || "")) {
    errors.push(`${at} — 문장에 결과가 없습니다. 등록만 된 조합은 항목으로 만들지 마세요`);
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

  // subj 는 worklist 줄의 "—" 앞과 같아야 한다. 대개 물질이지만 통념 항목은 주제 자체다
  // ("근육통 — 젖산 때문에 생긴다"). 자동 추출 주제가 "naltrexone — Obesity에 듣는다" 꼴이라
  // 물질 대신 질환을 주어로 잡기 쉬워서 걸러둔다.
  if (/(증|염|병|암|통|장애|비만|오심|불면|우울|불안|감염|골절|치매|손상|결핍|부전|경련|출혈)$/.test(e.subj)
      && !/^(우울증 자체|고용량|저용량|근육통|관절)/.test(e.subj)) {
    warnings.push(`${at} — subj "${e.subj}" 가 질환입니다. 물질을 다루는 항목이면 주어를 바꾸세요`);
  }

  // 한국어 목록에 영문 약물명이 그대로 남으면 읽는 흐름이 끊긴다
  const eng = (e.line || "").match(/[a-z][a-z-]{4,}/g);
  if (eng) warnings.push(`${at} — 한 줄에 영문이 남아 있습니다: ${eng.join(", ")}`);

  // 규모는 오른쪽 태그가 이미 보여준다. 문장에 또 쓰면 길어지기만 한다
  if (e.n && (e.line || "").includes(e.n.toLocaleString("ko-KR"))) {
    warnings.push(`${at} — 규모 숫자가 태그와 겹칩니다. 문장에서는 빼세요`);
  }

  // 목록에서 제일 궁금한 건 "얼마나" 다. 효과 크기가 없으면 읽어도 남는 게 없다.
  const NUM = /\d+(\.\d+)?\s*(%|배|점|일|주|개월|년|mm|mg|시간|분|포인트|명)|\d\s*→|→\s*\d/;
  if (!e.effect && ["pos", "harm"].includes(e.dir) && !NUM.test(e.line)) {
    warnings.push(`${at} — 무엇이 얼마나 달라졌는지가 없습니다. effect 를 채우세요`);
  }
  if (e.effect && [...e.effect].length > 26) {
    warnings.push(`${at} — effect 가 ${[...e.effect].length}자입니다. 26자 안쪽 한 조각으로`);
  }

  // 뜻이 사라질 만큼 줄이지는 마라. 효과 숫자를 넣느라 길어지는 건 괜찮다.
  const shown = [...`${e.subj} — ${e.line}`].length;
  if (shown > 64) warnings.push(`${at} — 한 줄이 ${shown}자입니다. 64자 안쪽으로`);

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

// 눈여겨볼 것부터 위로. 473줄을 위에서부터 읽는 사람은 없다.
//   해로운 쪽   사람이 다칠 수 있는 얘기가 먼저다
//   효과 크기   "얼마나" 가 적혀 있으면 읽을 값어치가 있다
//   근거 무게   여러 연구를 합쳤나, 사람이 몇 명이나
const NUMRE = /\d+(\.\d+)?\s*(%|배|점|일|주|개월|년|mm|mg|시간|분|포인트)|\d\s*→|→\s*\d/;
function interest(e) {
  let s = 0;
  if (e.dir === "harm") s += 40;
  else if (e.dir === "pos") s += 20;
  else if (e.dir === "null") s += 12;        // 통념이 깨지는 것도 읽을 값어치가 있다
  if (e.effect) s += 25;
  else if (NUMRE.test(e.line)) s += 15;
  if (e.synth === "meta") s += 10;
  s += Math.min(12, Math.log10(Math.max(e.n ?? 1, 1)) * 3);
  if (STEP[e.tier] >= 4) s += 6;             // 사람에게서 나온 것
  return Math.round(s * 10) / 10;
}
entries.forEach((e) => { e.score = interest(e); });
entries.sort((a, b) => (b.score - a.score) || ((b.n ?? -1) - (a.n ?? -1)) || a.id.localeCompare(b.id));

const updated = entries.map((e) => e.queried.date).sort().at(-1) ?? "";

// 목록에 필요한 것만 HTML 에 넣는다. 펼쳤을 때 쓰는 긴 글은 따로 뺀다.
// 473건이면 상세까지 인라인할 때 950KB 인데, 그중 대부분은 아무도 안 펼치는 글이다.
const LIST = ["id", "subj", "claim", "line", "effect", "tier", "dir", "n", "synth", "score"];
const DETAIL = ["why", "saw", "limit", "against", "use", "refs", "queried"];

const list = entries.map((e) => Object.fromEntries(LIST.filter((k) => e[k] != null).map((k) => [k, e[k]])));
const details = Object.fromEntries(entries.map((e) =>
  [e.id, Object.fromEntries(DETAIL.map((k) => [k, e[k]]))]));

const tpl = readFileSync(join(root, "src", "template.html"), "utf8");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "index.html"),
  tpl.replace("__ENTRIES__", JSON.stringify({ updated, tiers: meta.tiers, entries: list })), "utf8");
writeFileSync(join(outDir, "details.json"), JSON.stringify(details), "utf8");

// 로고·파비콘 같은 정적 파일을 그대로 옮긴다
const assetDir = join(root, "src", "assets");
if (existsSync(assetDir)) {
  for (const f of readdirSync(assetDir)) copyFileSync(join(assetDir, f), join(outDir, f));
}

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
