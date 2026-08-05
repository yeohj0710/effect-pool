// 조사할 주제를 ClinicalTrials.gov 에서 기계적으로 뽑는다.
// 지어내지 않는다. 실제로 사람이 시험하고 있는 것만 올라온다.
//
//   node tools/expand-worklist.mjs                 내장 물질 목록으로 뽑기
//   node tools/expand-worklist.mjs 메트포르민 ...   물질을 직접 지정 (영문명)
//   node tools/expand-worklist.mjs --write         worklist.md 에 실제로 덧붙이기
//
// 뽑는 방법
//   1. 물질로 등록된 시험을 받는다
//   2. InterventionName 에 그 물질이 실제로 있는 건만 남긴다 (동의어 확장 방어)
//   3. 질환별로 세고, 가장 많은 하나는 버린다 — 대개 허가 적응증이다
//   4. 시험이 MIN_TRIALS 건 이상 붙은 질환만 후보로 삼는다
//   5. 이미 worklist 나 entries 에 있는 조합은 뺀다

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const WL = join(root, "data", "worklist.md");
const ENTRY_DIR = join(root, "data", "entries");

const MIN_TRIALS = 3;      // 이 이상 시험이 붙은 질환만 후보
const MIN_PAPERS = 8;      // 논문이 이만큼은 있어야 한다. 등록만 된 조합을 걸러낸다
const MAX_PER_DRUG = 4;    // 한 물질에서 최대 몇 개까지 뽑을지
const PAGE = 200;
const PAGES = 4;           // 한 물질당 최대 몇 장까지 넘겨볼지 (표본 쏠림 방지)
const MERGE = 0.5;         // 이 이상 겹치면 같은 병으로 본다

// 허가 밖 사용이 넓다고 알려진 물질들. 다 쓰면 --seed 를 늘리거나 인자로 넘겨라.
const SEED = [
  "metformin", "aspirin", "propranolol", "naltrexone", "gabapentin", "amitriptyline",
  "topiramate", "trazodone", "quetiapine", "spironolactone", "doxycycline", "colchicine",
  "dapagliflozin", "semaglutide", "ketamine", "prazosin", "thalidomide", "ivermectin",
  "hydroxychloroquine", "valacyclovir", "minoxidil", "bupropion", "sildenafil",
  "bimatoprost", "botulinum toxin", "duloxetine", "dextromethorphan", "clonidine",
  "finasteride", "melatonin", "modafinil", "baclofen", "ondansetron", "memantine",
  "lithium", "pentoxifylline", "sirolimus", "rapamycin", "montelukast", "cimetidine",
  "atorvastatin", "losartan", "verapamil", "amantadine", "acetazolamide", "dapsone",
  "methotrexate", "hydroxyurea", "tranexamic acid", "isotretinoin", "tamoxifen",
  "raloxifene", "allopurinol", "n-acetylcysteine", "creatine", "berberine",
];

const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const drugs = args.filter((a) => !a.startsWith("--"));
const targets = drugs.length ? drugs : SEED;

/* ---- 이미 있는 것 ---- */

const wl = existsSync(WL) ? readFileSync(WL, "utf8") : "";
const existing = new Set();

wl.split("\n").filter((l) => /^- \[[ x]\]/.test(l)).forEach((l) => {
  existing.add(l.replace(/^- \[[ x]\]\s*/, "").split("—")[0].trim().toLowerCase());
});
const claims = new Set(
  wl.split("\n").filter((l) => /^- \[[ x]\]/.test(l))
    .map((l) => l.replace(/^- \[[ x]\]\s*/, "").toLowerCase().replace(/\s+/g, ""))
);
if (existsSync(ENTRY_DIR)) {
  readdirSync(ENTRY_DIR).filter((f) => f.endsWith(".json")).forEach((f) => {
    const e = JSON.parse(readFileSync(join(ENTRY_DIR, f), "utf8"));
    existing.add(e.subj.toLowerCase());
    claims.add((e.subj + e.claim).toLowerCase().replace(/\s+/g, ""));
  });
}

/* ---- 조회 ---- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 질환이 아닌 것. 건강인 대상 약동학 시험 같은 게 후보로 올라오는 걸 막는다.
const NOT_A_DISEASE = /^(healthy|healthy volunteers?|healthy subjects?|volunteers?|normal|clinical pharmacology|bioequivalence|pharmacokinetics?|drug interactions?|safety|adverse (drug )?reactions?|quality of life)$/i;

// 같은 병을 가리키는 표기 차이를 지우는 말들
const NOISE = new Set(["disease", "diseases", "disorder", "disorders", "syndrome", "syndromes",
  "mellitus", "type", "i", "ii", "1", "2", "chronic", "acute", "primary", "secondary",
  "the", "of", "and", "in", "with", "adult", "adults", "pediatric", "infantile", "juvenile"]);

// 표기가 달라도 같은 병이면 같은 열쇠가 나오게
function canon(c) {
  const toks = c.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
    .filter((t) => t && !NOISE.has(t));
  return [...new Set(toks)].sort();
}
const overlap = (a, b) => {
  if (!a.length || !b.length) return 0;
  const s = new Set(b);
  return a.filter((t) => s.has(t)).length / Math.min(a.length, b.length);
};

// 표기 차이를 하나로 합치고, 허가 적응증과 겹치는 것을 걷어낸다
function collapse(ranked) {
  const groups = [];
  for (const [name, n] of ranked) {
    if (NOT_A_DISEASE.test(name.trim())) continue;
    const k = canon(name);
    if (!k.length) continue;
    const hit = groups.find((g) => overlap(g.key, k) >= MERGE);
    if (hit) { hit.n += n; if (name.length < hit.name.length) hit.name = name; }
    else groups.push({ name, key: k, n });
  }
  return groups.sort((a, b) => b.n - a.n);
}

async function conditionsFor(drug) {
  const needle = drug.toLowerCase().split(" ")[0];
  const counts = new Map();
  let kept = 0, total = 0, token = null;

  // 한 페이지만 보면 표본이 한쪽으로 쏠린다. 몇 장 넘겨서 모은다.
  for (let page = 0; page < PAGES; page++) {
    const url = "https://clinicaltrials.gov/api/v2/studies"
      + `?query.intr=${encodeURIComponent(drug)}`
      + `&pageSize=${PAGE}` + (page === 0 ? "&countTotal=true" : "")
      + (token ? `&pageToken=${encodeURIComponent(token)}` : "")
      + "&fields=NCTId,Condition,InterventionName";

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (page === 0) total = json.totalCount ?? 0;

    for (const s of json.studies ?? []) {
      const p = s.protocolSection ?? {};
      const names = (p.armsInterventionsModule?.interventions ?? [])
        .map((i) => (i.name ?? "").toLowerCase()).join(" ");
      // 물질 동일성 — 이름에 실제로 안 들어 있으면 버린다
      if (!names.includes(needle)) continue;
      kept++;
      for (const c of p.conditionsModule?.conditions ?? []) {
        const k = c.trim();
        // 약 이름이 질환 자리에 들어온 것은 버린다
        if (!k || k.toLowerCase().includes(needle)) continue;
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }
    token = json.nextPageToken;
    if (!token) break;
    await sleep(250);
  }
  return { total, kept, counts };
}

// 등록된 시험이 있다고 다 후보가 아니다. 논문이 없으면 아직 아무도 결과를 안 낸 것이고,
// 그런 조합으로 항목을 만들면 "결과가 아직 없습니다" 밖에 못 쓴다. 실제로 175건이 그랬다.
async function paperCount(drug, cond) {
  const term = encodeURIComponent(`${drug} AND ${cond}`);
  const url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
    + `?db=pubmed&term=${term}&retmode=json&retmax=0`;
  try {
    const res = await fetch(url);
    if (!res.ok) return 0;
    const j = await res.json();
    return Number(j?.esearchresult?.count ?? 0);
  } catch { return 0; }
}

/* ---- 실행 ---- */

const lines = [];
const report = [];

for (const drug of targets) {
  try {
    const { total, kept, counts } = await conditionsFor(drug);
    if (!kept) { report.push(`  ${drug.padEnd(22)} 반환 ${total} → 물질 대조 후 0건. 건너뜀`); continue; }

    const groups = collapse([...counts.entries()].sort((a, b) => b[1] - a[1]));
    if (!groups.length) { report.push(`  ${drug.padEnd(22)} 질환으로 볼 조건이 없음. 건너뜀`); continue; }

    // 가장 많은 하나는 허가 적응증으로 본다. 표기만 다른 같은 병도 같이 걷어낸다
    const onLabel = groups[0];
    const picks = groups.slice(1)
      .filter((g) => g.n >= MIN_TRIALS)
      .filter((g) => overlap(g.key, onLabel.key) < 0.4)
      .filter((g) => !claims.has((drug + g.name).toLowerCase().replace(/\s+/g, "")))
      .slice(0, MAX_PER_DRUG);

    // 논문이 있는 조합만 남긴다
    const solid = [];
    let dropped = 0;
    for (const g of picks) {
      const papers = await paperCount(drug, g.name);
      if (papers >= MIN_PAPERS) solid.push({ ...g, papers });
      else dropped++;
      await sleep(380);   // PubMed 는 키 없이 초당 3회
    }

    report.push(`  ${drug.padEnd(22)} 반환 ${String(total).padStart(4)} · 대조 통과 ${String(kept).padStart(3)}`
      + ` · 허가로 본 것 "${onLabel.name}" · 후보 ${solid.length}`
      + (dropped ? ` (논문 부족으로 ${dropped}개 뺌)` : ""));

    for (const g of solid) {
      lines.push(`- [ ] ${drug} — ${g.name}에 듣는다  <!-- 시험 ${g.n}건 · 논문 ${g.papers}편 -->`);
    }
  } catch (err) {
    report.push(`  ${drug.padEnd(22)} 실패: ${err.message}`);
  }
  await sleep(350);
}

console.log("=== 물질별 결과 ===");
report.forEach((r) => console.log(r));
console.log(`\n후보 ${lines.length}개 뽑았습니다.`);

if (!lines.length) process.exit(0);

if (WRITE) {
  const stamp = new Date;
  const header = `\n## 자동 추출 — 후보 (허가 여부는 조사할 때 확인할 것)\n\n`
    + `ClinicalTrials.gov 에서 뽑았습니다. 물질 동일성을 대조했고 표기가 다른 같은 병은 합쳤습니다.\n`
    + `주석의 숫자는 그 조합에 등록된 시험 수입니다.\n\n`
    + `**허가 적응증이 섞여 있습니다.** 시험 수로는 허가 여부를 못 가립니다 — 이미 허가된 적응증은\n`
    + `오히려 새 시험을 안 하기 때문입니다. 조사 첫 단계에서 허가사항을 확인하고, 허가 안에 있는\n`
    + `조합이면 항목을 만들지 말고 줄 끝에 \`— 허가 적응증(날짜)\` 을 붙여 넘어가라.\n\n`;
  writeFileSync(WL, readFileSync(WL, "utf8") + header + lines.join("\n") + "\n", "utf8");
  console.log(`worklist.md 에 덧붙였습니다.`);
} else {
  console.log("\n" + lines.join("\n"));
  console.log("\n--write 를 붙이면 worklist.md 에 덧붙입니다.");
}
