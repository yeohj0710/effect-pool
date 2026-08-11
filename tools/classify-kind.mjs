// 주어(subj)가 무엇의 갈래인지 정한다 — 처방약·약국약·보충제·음식·운동·생활·시술기기.
// 결과는 data/kinds.json 에 주어별로 한 줄씩 쌓인다. 항목이 아니라 주어 단위다.
// 같은 주어는 항목이 몇 개든 갈래가 하나라서, 2천 줄만 정하면 5천 항목이 다 붙는다.
//
//   node tools/classify-kind.mjs            지금 상태만 보여준다
//   node tools/classify-kind.mjs --write    data/kinds.json 을 갱신한다
//
// 규칙이 확실할 때만 붙인다. 애매하면 비워두고 빌드가 사람한테 물어보게 둔다.
// 틀린 갈래는 빈칸보다 나쁘다.

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENTRY_DIR = join(root, "data", "entries");
const KINDS = join(root, "data", "kinds.json");
const WRITE = process.argv.includes("--write");

/* ── 약 이름의 끝자리. 이건 거의 안 틀린다 ── */
const DRUG_TAIL = [
  // 한글 음차
  "마이신", "시클린", "사이클린", "실린", "세팔", "세프", "플록사신", "코나졸", "나졸",
  "티딘", "프라졸", "사르탄", "프릴", "올롤", "로롤", "디핀", "스타틴", "글리타존",
  "글립틴", "글리플로진", "세타몰", "페낙", "프로펜", "록시캄", "코르티손", "니솔론",
  "메타손", "트립틸린", "옥세틴", "세트랄린", "제팜", "졸람", "리돈", "자핀", "피프라졸",
  "페리돌", "바린", "트렉세이트", "시타빈", "루비신", "탁셀", "플라틴", "티닙", "주맙",
  "시맙", "무맙", "리무스", "사이클로버", "클로버", "나비르", "그렐", "파린", "헤파린",
  "인슐린", "트립탄", "세트론", "프로스톤", "카인", "페니드", "펜타닐", "모르핀",
  "코데인", "트라마돌", "옥시코돈", "에페드린", "아드레날린", "테롤", "프로스틴",
  "루카스트", "테카트", "글루타이드", "글루톤", "리프틴", "미드", "설파", "졸리드",
  "빈크리스틴", "테레놀", "부틴", "카바인", "탄센", "덱손",
  // 영문
  "mab", "nib", "statin", "pril", "sartan", "olol", "dipine", "azole", "prazole",
  "cycline", "cillin", "mycin", "floxacin", "oxetine", "pram", "zepam", "zolam",
  "peridone", "parin", "gliptin", "gliflozin", "glitazone", "triptan", "setron",
  "navir", "ciclovir", "covir", "buvir", "previr", "asvir", "tide", "cept", "kinra",
  "sone", "solone", "onide", "caine", "fentanil", "morphine", "codone", "tinib",
  "lukast", "vastatin", "profen", "coxib", "dronate", "sartan", "curium", "afil",
  "prazine", "pramine", "triptyline", "barbital", "phylline", "terol", "tropium",
];

/* ── 갈래를 알려주는 낱말. 앞에서부터 먼저 걸리는 것을 쓴다 ── */
const RULES = [
  ["care", [
    "침 ", "침술", "acupunctur", "전침", "이침", "뜸", "부항", "마사지", "massage",
    "도수", "물리치료", "physical therapy", "physiotherapy", "지압", "카이로", "chiropract",
    "수술", "surgery", "surgical", "절제", "이식", "삽입", "스텐트", "stent", "카테터",
    "자극", "stimulation", "tdcs", "tms", "전기", "electr", "초음파", "ultrasound",
    "레이저", "laser", "광선", "phototherapy", "광치료", "온열", "냉각", "cryo",
    "압박", "compression", "보조기", "brace", "orthosis", "스타킹", "stocking",
    "테이핑", "taping", "기기", "device", "앱", " app", "app ", "디지털", "digital",
    "웨어러블", "wearable", "원격", "tele", "모니터링", "monitoring", "로봇", "robot",
    "가상현실", "virtual reality", "바이오피드백", "biofeedback", "진동", "vibration",
    "마스크", "mask", "cpap", "양압", "산소", "oxygen", "투석", "dialysis",
    "수혈", "transfusion", "방사선", "radiation", "radiotherapy", "체외충격파", "shock wave",
    "지속혈당", "continuous glucose", "혈압 측정", "blood pressure monitor",
    "hippotherapy", "승마", "가상", "virtual", "센서", "sensor",
    "패치", "patch", "임플란트", "implant", "펌프", "pump", "인공", "artificial",
    "photobiomodulation", "needling", "cupping", "lymphatic", "myofascial", "수기치료",
    "mirror therapy", "constraint-induced", "hearing aid", "insole", "orthotic",
    "flosser", "brush", "purifier", "brain computer", "augmented reality",
    "head-mounted", "smart home", "tracker", "smartwatch", "pedometer", "portal",
    "consultation", "chatbot", "챗봇", "microbiota transplant", "spirometry",
    "motion capture", "ergonomic", "sit stand", "담요", "blanket", "binaural",
    "sound therapy", "air purifier", "air quality", "air pollution", "공기", "습도", "humidity", "occupational therapy", "작업치료",
    "voice therapy", "auditory cueing", "감각통합", "조영제", "청색광", "blue light",
    "일주기 조명", "hospital at home", "ehealth", "e-health", "mobile health",
    "관절 꺾기", "치료적 접촉", "현실지남력",
  ]],
  ["move", [
    "운동", "exercise", "training", "훈련", "걷기", "walking", "달리기", "running",
    "요가", "yoga", "필라테스", "pilates", "태극권", "tai chi", "taichi", "기공", "qigong",
    "체조", "gymnas", "유산소", "aerobic", "저항", "resistance", "근력", "strength",
    "스트레칭", "stretch", "재활", "rehabilit", "자전거", "cycling", "수영", "swim",
    "무용", "dance", "sprint", "interval", "인터벌", "보행", "gait", "균형", "balance",
    "hand grip", "grip", "등척성", "isometric", "필드", "walk ", "치료적 운동",
    "physical activity", "신체활동", "활동량", "step count", "걸음", "step goal",
    "lifting", "rolling", "aquatic", "수중", "baduanjin", "팔단금", "춤", "dance",
    "video gaming", "video play", "nordic", "treadmill", "러닝머신",
  ]],
  ["life", [
    "수면", "sleep", "낮잠", "nap", "명상", "meditat", "마음챙김", "mindful",
    "단식", "fasting", "금연", "smoking cessation", "절주", "금주", "alcohol reduction",
    "사우나", "sauna", "냉수", "cold water", "냉수욕", "목욕", "bath",
    "호흡", "breath", "일기", "journal", "글쓰기", "writing", "자비", "compassion",
    "감사", "gratitude", "인지행동", "cognitive behav", "cbt", "심리", "psycho",
    "상담", "counsel", "동기면담", "motivational interview", "면담", "코칭", "coaching",
    "교육", "education", "음악", "music", "미술", "art therapy", "원예", "horticultur",
    "숲", "forest", "자연", "nature", "반려", "동물 보조", "animal assisted", "pet ",
    "스트레스", "stress", "이완", "relaxation", "최면", "hypno", "수용전념", "acceptance",
    "메타인지", "metacognitiv", "행동활성화", "behavioral activation", "습관", "habit",
    "동료 지지", "peer support", "peer ", "지지", "support group", "mentoring", "멘토",
    "community health worker", "가족", "family", "돌봄", "care giver", "caregiver",
    "일광", "sunlight", "햇빛", "light exposure", "소음", "noise", "독서", "reading",
    "봉사", "volunteer", "종교", "religio", "기도", "prayer", "감정", "emotion",
    "노출", "exposure", "안구운동", "emdr", "심상", "imagery", "problem solving",
    "self management", "자기관리", "자기효능", "행동", "behavio",
    "intervention", "중재", "program", "프로그램", "group", "집단", "activity",
    "support", "navigation", "literacy", "문해력", "adherence", "incentive",
    "storytelling", "singing", "노래", "laughter", "웃음", "humor", "유머",
    "gardening", "garden", "art therapy", "art making", "art museum", "art workshop", "visual arts", "예술", "museum", "craft", "coloring", "만다라", "mandala",
    "drama", "play therapy", "role playing", "놀이", "spiritual", "forgiveness", "dignity", "reminiscence",
    "schema", "defusion", "reappraisal", "screen time", "social media", "sedentary",
    "앉아", "bedtime", "quiet time", "wake therapy", "실행 의도", "목표 설정",
    "decision", "의사결정", "housing", "employment", "financial", "recovery community",
    "trauma-informed", "companion", "therapy dog", "equine", "animal", "immersion",
    "야외활동", "outdoor", "self-help", "self help", "cultural", "audiobook",
    "grief", "hope therapy", "role playing", "mentalization", "정신화", "solution focused",
    "해결중심", "자기연민", "self-compassion", "sexual health", "성 건강", "wellness",
    "social ", "사회적", "parenting", "parent-", "부모", "reminder", "text messag", "checklist",
    "clown", "광대", "therapeutic touch", "종교", "지남력", "우울증 자체",
  ]],
  ["food", [
    "식단", "식이", "diet", "음식", "food", "발효", "ferment", "우유", "milk",
    "요구르트", "yogurt", "요거트", "김치", "kimchi", "된장", "낫토", "natto",
    "생강", "ginger", "마늘", "garlic", "양파", "onion", "견과", "nuts", "아몬드", "almond",
    "호두", "walnut", "peanut", "베리", "berry", "블루베리", "체리", "cherry", "석류", "pomegranate",
    "비트", "beet", "토마토", "tomato", "코코아", "cocoa", "초콜릿", "chocolate",
    "올리브", "olive", "지중해", "mediterranean", "저탄수", "low carb", "케톤", "keto",
    "고단백", "채식", "vegan", "vegetarian", "plant rich", "plant based", "과일", "fruit",
    "채소", "vegetable", "통곡", "whole grain", "귀리", "oats", "oat ", "보리", "barley",
    "콩", "soy", "두유", "생선", "fish ", "연어", "salmon", "달걀", "egg", "계란",
    "커피", "coffee", "녹차", "green tea", "black tea", "홍차", "주스", "juice",
    "water intake", "coconut", "코코넛", "꿀", "honey", "식초", "vinegar", "소금",
    "salt", "설탕", "sugar", "감미료", "sweetener", "유제품", "dairy", "치즈", "cheese",
    "육류", "meat", "붉은 고기", "red meat", "가공식품", "processed", "아침식사",
    "breakfast", "간헐", "시간제한", "time restricted", "칼로리 제한", "caloric restriction",
    "지방 제한", "저염", "low sodium", "고섬유", "fiber", "식물성",
  ]],
  ["supp", [
    "비타민", "vitamin", "아연", "zinc", "마그네슘", "magnesium", "철분", "ferrous", "ferric",
    "칼슘", "calcium", "셀레늄", "selenium", "요오드", "크롬", "chromium",
    "오메가", "omega", "어유", "fish oil", "프로바이오틱", "probiotic",
    "유산균", "lactobacillus", "bifido", "신바이오", "프리바이오", "prebiotic",
    "콜라겐", "collagen", "크레아틴", "creatine", "카르니틴", "carnitine",
    "글루코사민", "glucosamine", "콘드로이틴", "커큐민", "curcumin", "강황", "turmeric",
    "인삼", "ginseng", "홍삼", "은행잎", "ginkgo", "밀크시슬", "milk thistle",
    "실리마린", "코엔자임", "coenzyme", "q10", "멜라토닌", "melatonin", "프로폴리스",
    "루테인", "lutein", "아르기닌", "arginin", "글루타민", "glutamin", "류신", "leucine",
    "hmb", "베타알라닌", "beta alanine", "타우린", "taurine", "베르베린", "berberine",
    "레스베라트롤", "resveratrol", "케르세틴", "quercetin", "폴리페놀", "polyphenol",
    "플라보노이드", "flavono", "egcg", "카테킨", "catechin", "안토시아닌", "anthocyan",
    "엽산", "folate", "folic", "5-mthf", "이노시톨", "inositol", "코엔", "nmn",
    "니코틴아미드", "nicotinamide", "nmn", "스피룰리나", "spirulina", "클로렐라",
    "프로테인", "protein supplement", "유청", "whey", "카제인", "casein", "아마씨",
    "flaxseed", "치아씨", "chia", "차전자", "psyllium", "이눌린", "inulin",
    "베타글루칸", "beta glucan", "글루타티온", "glutathione", "s-아데노실", "s-adenosyl",
    "알파리포산", "lipoic", "포스파티딜", "phosphatidyl", "콜린 ", "citicoline",
    "카페인", "caffeine", "테아닌", "theanine", "가르시니아", "garcinia", "허브", "herb",
    "추출물", "extract", "보충", "supplement", "다이어트 보조", "토코트리에놀",
    "tocotrienol", "토코페롤", "베타카로틴", "carotene", "리코펜", "lycopene",
    "아슈와간다", "ashwagandha", "쏘팔메토", "saw palmetto", "발레리안", "valerian",
    "세인트존스", "st john", "히알루론", "hyaluron", "케피어", "kefir",
  ]],
  ["otc", [
    "아세트아미노펜", "acetaminophen", "paracetamol", "이부프로펜", "ibuprofen",
    "덱시부프로펜", "나프록센", "naproxen", "로라타딘", "loratadine", "세티리진",
    "cetirizine", "클로르페니라민", "chlorpheniramine", "슈도에페드린", "pseudoephedrine",
    "덱스트로메토르판", "dextromethorphan", "구아이페네신", "guaifenesin",
    "파모티딘", "famotidine", "시메티딘", "cimetidine", "라니티딘", "제산", "antacid",
    "비사코딜", "bisacodyl", "락툴로스", "lactulose", "로페라마이드", "loperamide",
    "디멘히드리네이트", "dimenhydrinate", "메클리진", "meclizine", "스코폴라민",
    "미녹시딜", "minoxidil", "벤조일퍼옥사이드", "benzoyl peroxide", "살리실산",
    "salicylic acid", "클로트리마졸", "clotrimazole", "인공눈물", "artificial tear",
    "니코틴 대체", "nicotine replacement", "니코틴 패치", "오르리스타트", "orlistat",
    "히드로코르티손 1", "캡사이신", "capsaicin", "멘톨", "menthol", "생리식염수",
  ]],
];

/* 규칙으로는 못 가르는 주어를 손으로 못박는다. 규칙보다 먼저 본다.
   낱말에 뜻이 안 담긴 이름들이라 여기 적는 것 말고 방법이 없다. */
const PINNED = {
  // 마음·행동 프로그램
  "active listening": "life", "contingency management": "life", "home visiting": "life",
  "care coordination": "life", "cognitive bias modification": "life",
  "cognitive remediation therapy": "life", "인지 재구성": "life",
  "motivational enhancement therapy": "life", "cognitive therapy for suicide prevention": "life",
  "수용 기반 치료": "life", "저널 쓰기": "life", "therapeutic play": "life",
  "cognitive processing therapy": "life", "community art": "life",
  "community resilience": "life", "lifestyle medicine": "life", "active lifestyle": "life",
  "problem-solving therapy": "life", "rhythm therapy": "life", "recreation therapy": "life",
  "paced respiration": "life", "흡연": "life", "참기름 오일풀링": "life",
  "cooking class": "life", "healthy cooking": "life", "home cooking": "life",
  "parent cooking": "life", "요리 기술": "life",
  // 몸 쓰기
  "노르딕 워킹": "move", "active transport": "move",
  // 받는 것 · 기기
  "bright light therapy": "care", "light box therapy": "care", "light therapy": "care",
  "morning bright light": "care", "near-infrared light": "care", "red light therapy": "care",
  "heat therapy": "care", "thermal therapy": "care", "water therapy": "care",
  "침": "care", "봉독": "care",
  // 음식
  "meal delivery": "food", "meal replacement": "food", "meal timing": "food",
  "시간 제한 식사": "food", "time-restricted feeding": "food", "열량 제한": "food",
  "early time-restricted eating": "food", "저녁 늦은 식사": "food", "meal kit": "food",
  "canola oil": "food", "sunflower oil": "food", "white rice": "food", "red wine": "food",
  "resistant starch": "food", "bean consumption": "food", "black currant": "food",
  "fresh produce": "food", "grape consumption": "food", "grocery delivery": "food",
  "렌틸": "food", "produce box": "food", "produce delivery": "food",
  "produce voucher": "food", "produce prescription": "food", "wheat consumption": "food",
  "whole wheat bread": "food", "황색 완두": "food", "망고": "food", "밀렛": "food",
  "여주": "food",
  // 보충제
  "니코틴아마이드 리보사이드": "supp", "사카로미세스 보울라디": "supp",
  "red yeast rice": "supp", "sodium butyrate": "supp", "royal jelly": "supp",
  "urolithin a": "supp", "black cohosh": "supp", "black seed": "supp",
  "nigella sativa": "supp", "peppermint oil": "supp", "카바": "supp",
  "펙틴": "supp", "초유": "supp", "bovine colostrum": "supp", "mct oil": "supp",
  "plant-based protein": "supp", "protein shake": "supp", "완두 단백질": "supp",
  // 약
  "답손": "rx", "보툴리눔 독소": "rx", "도르나제 알파": "rx", "nitrous oxide": "rx",
  "ropeginterferon alfa-2b": "rx", "이소소르비드 모노나이트레이트": "rx",
  "미코페놀레이트 모페틸": "rx", "날트렉손·부프로피온": "rx", "저용량 날트렉손": "rx",
  "디메틸 푸마르산염 약물": "rx", "에포에틴 알파": "rx", "estradiol valerate": "rx",
  "메살라진 과민성장증후군": "rx", "프로파페논 과량": "rx", "glp-1 작용제": "rx",
  "sglt2 억제제": "rx", "세보플루란과 발현 섬망": "rx", "세보플루란 상처 적용": "rx",
  "벤조디아제핀 장기 복용": "rx", "ppi 장기 복용": "rx", "센나": "otc",
  "리튬": "rx", "medical cannabis": "rx", "메게스트롤 아세테이트": "rx",
  "sodium valproate": "rx",
  "meal preparation": "life", "board games": "life", "traditional games": "life",
  "찬물 입수": "life",
  "nutrition prescription": "food", "nut consumption": "food", "nut intake": "food",
  "rye bread": "food", "tea consumption": "food",
  "essential oil": "supp", "콜린": "supp", "식물 스타놀": "supp",
  "propolis mouthwash": "supp",
  "아스피린": "otc", "aspirin": "otc", "니코틴": "otc", "nicotine": "otc",
  "비타민 d": "supp", "포도당": "food", "생리식염수": "care",
  "산소": "care", "물": "food", "소금": "food",
  "보툴리눔 톡신": "rx", "botulinum toxin": "rx", "리도카인": "rx",
  "에탄올": "food", "알코올": "food", "술": "food",
  "대마": "rx", "칸나비디올": "rx", "cannabidiol": "rx", "cbd": "rx",
};

const norm = (s) => (s || "").toLowerCase().trim();

function classify(subj, blob) {
  const s = norm(subj);
  if (PINNED[s]) return PINNED[s];

  // 낱말 규칙은 주어에서만 본다. 본문까지 보면 "운동을 시킨 약 시험"이 운동으로 간다.
  for (const [kind, words] of RULES) {
    if (words.some((w) => s.includes(w))) return kind;
  }
  // 끝자리로 약을 가른다. 약국약 목록에 없으면 처방약으로 본다.
  if (DRUG_TAIL.some((t) => s.endsWith(t) || s.includes(t))) return "rx";

  // 여기까지 안 걸린 한 낱말짜리는 약 이름이다. 운동·식품·프로그램은 이름에 뜻이 들어 있어서
  // 위 규칙에 걸린다. 뜻 없는 낱말 하나가 남았다는 건 성분명이라는 뜻이다.
  // 약국에서 그냥 사는 약은 따로 목록이 있으니, 여기 남은 건 처방약으로 본다.
  if (!/[\s·]/.test(s) && s.length >= 3) return "rx";

  // 여러 낱말인데 못 가른 것은 비워둔다. 찍어서 붙이면 틀린 갈래가 섞인다.
  return null;
}

const files = readdirSync(ENTRY_DIR).filter((f) => f.endsWith(".json"));
const bySubj = new Map();
for (const f of files) {
  const e = JSON.parse(readFileSync(join(ENTRY_DIR, f), "utf8"));
  if (!bySubj.has(e.subj)) bySubj.set(e.subj, { n: 0, blob: "", kind: e.kind ?? null });
  const rec = bySubj.get(e.subj);
  rec.n++;
  if (rec.blob.length < 900) rec.blob += " " + [e.claim, e.saw, e.knownWhy].join(" ");
  if (e.kind) rec.kind = e.kind;
}

const prev = existsSync(KINDS) ? JSON.parse(readFileSync(KINDS, "utf8")) : {};
const out = {};
const miss = [];
let filled = 0;

for (const [subj, rec] of [...bySubj].sort((a, b) => b[1].n - a[1].n)) {
  // 사람이 손으로 적어둔 것을 규칙이 덮어쓰지 않는다
  const kind = prev[subj] ?? rec.kind ?? classify(subj, rec.blob);
  if (kind) { out[subj] = kind; filled += rec.n; }
  else miss.push([subj, rec.n]);
}

const tally = {};
for (const [subj, k] of Object.entries(out)) tally[k] = (tally[k] || 0) + bySubj.get(subj).n;

console.log(`주어 ${bySubj.size}종 중 ${Object.keys(out).length}종에 갈래를 붙였습니다`);
console.log(`항목 기준 ${filled}/${files.length}건 (${Math.round(filled / files.length * 100)}%)`);
console.log("갈래별 항목 수 " + JSON.stringify(tally));
console.log(`\n못 붙인 주어 ${miss.length}종 — 항목 많은 것부터 30개`);
console.log(miss.slice(0, 30).map(([s, n]) => `${s} (${n})`).join(" · "));

if (WRITE) {
  const sorted = Object.fromEntries(Object.keys(out).sort((a, b) => a.localeCompare(b, "ko")).map((k) => [k, out[k]]));
  writeFileSync(KINDS, JSON.stringify(sorted, null, 1) + "\n", "utf8");
  console.log(`\ndata/kinds.json 에 ${Object.keys(sorted).length}줄 적었습니다`);
}
