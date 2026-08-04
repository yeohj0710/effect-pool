// refs 에 걸린 PubMed 논문이 철회됐는지 확인한다.
// PubMed 는 철회 논문에 "Retracted Publication" 을 붙인다. 기계로 잡을 수 있다.
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "entries");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const byPmid = new Map();
for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
  const e = JSON.parse(readFileSync(join(dir, f), "utf8"));
  for (const r of e.refs ?? []) if (r.pmid) {
    if (!byPmid.has(r.pmid)) byPmid.set(r.pmid, []);
    byPmid.get(r.pmid).push(`${e.subj} — ${r.label}`);
  }
}

const pmids = [...byPmid.keys()];
console.log(`PubMed 논문 ${pmids.length}건 확인합니다.\n`);

const FLAGS = ["Retracted Publication", "Retraction of Publication",
               "Expression of Concern", "Corrected and Republished Article"];
const hits = [];
let checked = 0;

for (let i = 0; i < pmids.length; i += 100) {
  const chunk = pmids.slice(i, i + 100);
  const url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"
    + `?db=pubmed&id=${chunk.join(",")}&retmode=json`;
  const res = await fetch(url);
  if (!res.ok) { console.error(`HTTP ${res.status}`); continue; }
  const json = await res.json();
  const r = json.result ?? {};
  for (const id of r.uids ?? []) {
    checked++;
    const types = r[id]?.pubtype ?? [];
    const flag = types.find((t) => FLAGS.includes(t));
    if (flag) hits.push({ id, flag, where: byPmid.get(id), title: r[id]?.title ?? "" });
  }
  await sleep(400);
}

console.log(`확인 ${checked}건`);
if (!hits.length) {
  console.log("철회·우려표명 논문 없음");
} else {
  console.log(`\n걸린 것 ${hits.length}건:`);
  for (const h of hits) {
    console.log(`\n  [${h.flag}] PMID ${h.id}`);
    console.log(`  ${h.title.slice(0, 90)}`);
    h.where.forEach((w) => console.log(`  → ${w}`));
  }
  process.exit(1);
}
