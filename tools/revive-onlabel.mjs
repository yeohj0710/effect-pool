// 옛 규칙이 "허가 적응증"이라고 버린 줄을 되살린다. 한 번만 쓰는 도구다.
//
//   node tools/revive-onlabel.mjs          몇 줄이 되살아나는지만 보여준다
//   node tools/revive-onlabel.mjs --write  실제로 [ ] 로 되돌린다
//
// 왜 되살리나
//   옛 규칙은 허가 적응증이면 조사를 멈추라고 했다. 오프라벨만 모으는 목록이었기 때문이다.
//   지금은 "얼마나 달라지나"를 묻는 목록이라 허가받은 용도도 답이 된다.
//   버려진 줄은 이미 시험 수와 논문 수를 확인해둔 것들이라 새로 뽑는 것보다 낫다.
//
// 되살리지 않는 것
//   — 근거 없음   진짜로 아무것도 안 나온 것. 다시 찾아도 안 나온다
//   — 중복        같은 조합이 이미 있다
//   — 조회 실패   API 가 죽었던 것. 이건 되살린다

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const WL = join(root, "data", "worklist.md");
const WRITE = process.argv.includes("--write");

const src = readFileSync(WL, "utf8");
const eol = src.includes("\r\n") ? "\r\n" : "\n";
const lines = src.split(/\r?\n/);

let revived = 0;
const out = lines.map((l) => {
  if (!/^- \[x\]/.test(l)) return l;
  if (!/— 허가 적응증\(/.test(l)) return l;
  if (/— (근거 없음|중복)/.test(l)) return l;
  revived++;
  // 표시를 지우지 않고 옮겨 적는다. 왜 한 번 버려졌던 줄인지 남겨둬야 한다.
  return l.replace(/^- \[x\]/, "- [ ]")
          .replace(/— 허가 적응증\((\d{4}-\d{2}-\d{2})\)/, "<!-- 옛 규칙이 허가 적응증이라고 뺐던 줄 $1 -->");
});

console.log(`허가 적응증으로 버려진 줄 ${revived}개를 되살립니다`);
if (!WRITE) { console.log("--write 를 붙이면 실제로 바꿉니다."); process.exit(0); }

writeFileSync(WL, out.join(eol), "utf8");
const now = readFileSync(WL, "utf8");
console.log(`남은 일감 ${(now.match(/^- \[ \]/gm) || []).length}개`);
