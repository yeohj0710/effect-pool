// 엔트리의 허가 여부 판정을 식약처 허가원문과 대조한다.
//
// AGENTS.md 규칙 3.6 이 "허가 여부는 제일 먼저 갈라야 하는 것"이라고 못박고
// 있는데, known/knownWhy 는 허가원문 없이 적혀 있었다. 이 도구는 원문을 옆에
// 놓고 어긋나 보이는 건을 골라낸다. 판정을 바꾸지는 않는다 — 바꾸는 것은
// 사람이 한다. build.mjs 가 이 결과를 경고로 띄운다.
//
// 엔트리는 다른 루프가 계속 늘리므로 대조본은 금방 뒤처진다. 그때는 이
// 명령을 다시 돌리면 된다.
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const entryDir = join(root, "data", "entries");
const outPath = join(root, "data", "permit-crosscheck.json");

const entries = new Map();
for (const file of readdirSync(entryDir).filter((n) => n.endsWith(".json"))) {
  const entry = JSON.parse(readFileSync(join(entryDir, file), "utf8"));
  if (entry?.id) entries.set(entry.id, entry);
}

// 주장에서 뽑아낸 낱말이 허가 효능효과 원문에 나오면 "허가된 용도일 수
// 있다"는 신호다. 조사·어미는 빼고 두 글자 이상만 본다. 이건 판정이 아니라
// 사람이 볼 후보를 좁히는 장치다.
const claimTerms = (entry) => {
  const text = `${entry.claim ?? ""} ${entry.line ?? ""}`;
  return [
    ...new Set(
      text
        .replace(/[^가-힣A-Za-z\s]/gu, " ")
        .split(/\s+/u)
        .map((word) => word.replace(/(에|을|를|의|은|는|이|가|으로|로|와|과|에서|에게)$/u, ""))
        .filter((word) => word.length >= 2),
    ),
  ];
};

const stripDoc = (value) =>
  String(value ?? "")
    .replace(/<[^>]*>/gu, " ")
    .replace(/&#x[0-9a-fA-F]+;|&[a-z]+;/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

const child = spawn(
  process.execPath,
  [join(root, "tools", "permit-lookup.mjs")],
  { cwd: root, stdio: ["ignore", "pipe", "inherit"] },
);

const results = [];
const counts = { 일치: 0, 불일치: 0, 근거없음: 0 };
const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
for await (const line of lines) {
  if (!line.trim()) continue;
  let row;
  try {
    row = JSON.parse(line);
  } catch {
    continue;
  }
  const entry = entries.get(row.id);
  if (!entry) continue;
  const matches = row.matches ?? [];
  const terms = claimTerms(entry);

  const excerpts = matches.slice(0, 5).map((match) => {
    const text = stripDoc(match.fields?.EE_DOC_DATA);
    return {
      itemSeq: match.itemSeq,
      productName: match.productName,
      manufacturer: match.manufacturer,
      matchedBy: match.matchedBy,
      matchedName: match.matchedName,
      matchedTerms: terms.filter((term) => text.includes(term)),
      text: text.slice(0, 1200),
    };
  });

  const covered = excerpts.some((item) => item.matchedTerms.length >= 2);
  let verdict;
  let reason;
  if (matches.length === 0) {
    verdict = "근거없음";
    reason = "허가 카탈로그에서 이 약물을 찾지 못했습니다. 국내 미허가이거나 표기가 다릅니다.";
  } else if (entry.known === "off" && covered) {
    verdict = "일치";
    const hit = excerpts.find((item) => item.matchedTerms.length >= 2);
    reason = `known=off인데 허가원문 발췌에서 주장 핵심어 ${hit.matchedTerms
      .slice(0, 3)
      .join(", ")}를 확인했습니다. itemSeq=${hit.itemSeq}`;
  } else {
    verdict = "불일치";
    reason =
      entry.known === "off"
        ? "허가원문에서 주장 용도를 확인하지 못했습니다. off 판정과 어긋나지 않습니다."
        : `known=${entry.known ?? "미기재"} 이므로 오프라벨 판정 대상이 아닙니다.`;
  }
  counts[verdict] += 1;

  results.push({
    id: row.id,
    subj: row.subj,
    known: entry.known ?? null,
    매칭품목수: matches.length,
    효능효과발췌: excerpts,
    판정: verdict,
    이유: reason,
  });
}

await new Promise((done) => child.on("close", done));
results.sort((left, right) => left.id.localeCompare(right.id));
writeFileSync(outPath, `${JSON.stringify(results, null, 2)}\n`, "utf8");
console.log(
  JSON.stringify({ 엔트리: entries.size, 대조: results.length, ...counts }),
);
