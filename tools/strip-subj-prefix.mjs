// line 이 subj 로 시작하면 지운다. 화면이 subj 를 따로 붙이므로 "침 — 침 — ..." 이 된다.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "entries");
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

let fixed = 0;
for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
  const p = join(dir, f);
  const e = JSON.parse(readFileSync(p, "utf8"));
  const before = e.line;

  // 1) line 이 subj 로 그대로 시작하는 경우
  e.line = e.line.replace(new RegExp("^" + esc(e.subj) + "\\s*[—–]\\s*"), "");

  // 2) "클로니딘 패치 — ", "영유아기 항생제 — " 처럼 살을 붙인 경우.
  //    앞토막이 짧고 subj 를 품고 있으면 그것도 접두어다.
  const m = e.line.match(/^([^—–]{1,25})\s*[—–]\s*/);
  if (m && m[1].includes(e.subj)) e.line = e.line.slice(m[0].length);

  e.line = e.line.trim();
  if (e.line !== before) {
    writeFileSync(p, JSON.stringify(e, null, 2) + "\n", "utf8");
    fixed++;
  }
}
console.log(`물질명 중복 제거 ${fixed}건`);
