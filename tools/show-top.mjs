// 지금 목록 맨 위에 뭐가 오는지 본다.  node tools/show-top.mjs [개수]
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "site", "index.html"), "utf8");

const key = "const DATA = ";
const start = html.indexOf(key) + key.length;
const raw = html.slice(start, html.indexOf("\n", start)).trim().replace(/;$/, "");
const { entries } = JSON.parse(raw);

const n = Number(process.argv[2] ?? 14);
const pad = (v, w) => String(v).padStart(w);

console.log(`=== 상위 ${n} ===`);
entries.slice(0, n).forEach((e, i) =>
  console.log(` ${pad(i + 1, 2)} ${pad(e.score, 5)}  ${e.dir.padEnd(5)}${e.subj.padEnd(14)}${String(e.effect ?? e.line).slice(0, 34)}`));

const top = entries.slice(0, 20);
const c = (d) => top.filter((e) => e.dir === d).length;
console.log(`\n상위 20 — 확인함 ${c("pos")} · 해로운 쪽 ${c("harm")} · 효과 없음 ${c("null")} · 진행 중 ${c("open")}`);
console.log(`effect 채워짐 ${entries.filter((e) => e.effect).length}/${entries.length}`);
