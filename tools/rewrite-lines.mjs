// 어색한 한 줄을 다시 쓴다. 조사 내용은 건드리지 않는다 — 문장만 바꾼다.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "entries");

const NEW = {
  "acupuncture-chronic-pain":
    "만성 통증 환자 자료를 모아보니 가짜침보다 통증이 조금 더 줄었습니다",
  "bedtime-screen-blue-light":
    "저녁에 화면을 보면 잠드는 시각이 늦어졌습니다",
  "benzodiazepine-cognitive-decline-harm":
    "오래 먹은 사람에게서 치매가 더 많았지만 약 때문인지는 가리지 못했습니다",
  "breakfast-skipping-weight-null":
    "시험 10편 487명을 합쳐보니 아침을 먹든 거르든 체중이 달라지지 않았습니다",
  "chronic-noise-cardiovascular-risk":
    "교통소음을 오래 겪은 사람에게 고혈압이 더 많았지만 지켜본 연구뿐입니다",
  "cold-water-exercise-recovery":
    "운동 뒤 찬물에 몸을 담그면 피로가 잠깐 덜했습니다",
  "cold-water-mood-null":
    "기분을 직접 잰 연구가 체계적 검토 하나뿐이라 아직 판단할 수 없습니다",
  "community-mask-respiratory-transmission-null":
    "무작위와 관찰 연구를 다 모아도 전파를 얼마나 줄이는지 가려내지 못했습니다",
  "compression-stockings-flight-thrombosis":
    "장거리 비행에서 증상 없는 혈전은 줄였지만 실제로 병이 줄었는지는 모릅니다",
  "curcumin-arthritis-inflammation":
    "관절염 시험 29개 2,396명에서 통증이 줄었지만 시험들의 질이 낮았습니다",
  "isotretinoin-psychiatric-null":
    "우울이 늘었다는 근거는 없었지만 드물게 생기는 정신과 부작용까지 지우지는 못했습니다",
  "lactate-muscle-soreness-null":
    "운동 다음 날 오는 근육통은 젖산이 아니라 근섬유 손상과 염증 때문입니다",
  "liss-hiit-body-fat-null":
    "과체중 성인 시험을 합쳐보니 천천히 오래 하나 짧고 세게 하나 체지방이 비슷하게 줄었습니다",
  "melatonin-insomnia-null":
    "불면 시험 154개 44,089명을 합쳤는데 잠이 눈에 띄게 늘지 않았습니다",
  "melatonin-jet-lag":
    "시차증 시험 10개 중 9개에서 증상이 줄었고, 시간대를 여럿 넘은 여행자는 두 명 중 한 명꼴로 덕을 봤습니다",
  "naltrexone-bupropion-obesity":
    "과체중 성인 1,742명에서 평균 체중 감소를 1.3%에서 6.1%로 키웠습니다",
  "ppi-long-term-fracture-infection-harm":
    "오래 먹은 사람에게서 골절과 감염이 더 많았습니다. 다만 지켜본 연구뿐입니다",
  "preserved-artificial-tears-corneal-irritation":
    "보존제가 든 인공눈물을 쓴 쪽에서 눈 시림과 이물감을 더 많이 호소했습니다",
  "probiotics-ibs-strain-uncertain":
    "시험 82개 10,332명을 봤더니 몇몇 균주만 증상을 줄였고 제품 전체에 통하는 효과는 없었습니다",
  "semaglutide-alcohol-use-disorder":
    "알코올 사용장애 성인 48명에게 나눠 줬더니 마시는 날의 음주량과 갈망이 줄었습니다",
  "tart-cherry-muscle-recovery":
    "운동으로 근육이 상한 뒤 통증이 덜하다는 결과가 있었지만 시험마다 편차가 컸습니다",
  "tart-cherry-sleep-null":
    "소규모 예비시험에서 잠이 는다고 나왔지만 뒤이은 시험에서는 재현되지 않았습니다",
  "vitamin-a-high-dose-harm":
    "오래 많이 먹으면 간이 상하고 뼈에 문제가 생깁니다",
};

let n = 0;
for (const [id, line] of Object.entries(NEW)) {
  const p = join(dir, id + ".json");
  if (!existsSync(p)) { console.error(`없는 파일: ${id}`); continue; }
  const e = JSON.parse(readFileSync(p, "utf8"));
  if (e.line === line) continue;
  console.log(`  ${e.subj}\n    전 ${e.line}\n    후 ${line}\n`);
  e.line = line;
  writeFileSync(p, JSON.stringify(e, null, 2) + "\n", "utf8");
  n++;
}
console.log(`${n}건 다시 썼습니다.`);
