export const LOCALES = ["en", "ja", "zh-Hans", "zh-Hant", "ko"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_NAMES: Record<Locale, string> = { en: "English", ja: "日本語", "zh-Hans": "简体中文", "zh-Hant": "繁體中文", ko: "한국어" };

// Intl locale used for dates; en-GB gives "Tue 20 Oct".
export const INTL_LOCALE: Record<Locale, string> = { en: "en-GB", ja: "ja-JP", "zh-Hans": "zh-Hans", "zh-Hant": "zh-Hant", ko: "ko-KR" };

// Google's hl= parameter for each UI language.
export const GOOGLE_HL: Record<Locale, string> = { en: "en", ja: "ja", "zh-Hans": "zh-CN", "zh-Hant": "zh-TW", ko: "ko" };

export interface Strings {
  brand: string;
  sub: string;
  map: string;
  today: string;
  tomorrow: string;
  pastDay: string;
  upcoming: string;
  prevDay: string;
  nextDay: string;
  backToToday: string;
  comingUp: string;
  noUpcoming: string;
  nothingTitle: string;
  nothingToday: string;
  nothingDay: string;
  next: (name: string, date: string) => string;
  live: string;
  daytime: string;
  timesTBA: string;
  doors: (t: string) => string;
  start: (t: string) => string;
  ends: (t: string) => string;
  statusDoorsAt: (t: string) => string;
  statusDoorsOpen: string;
  statusOnNow: string;
  statusFinished: string;
  footer: (links: { enjoy: string; eventernote: string; official: string }) => string;
  updated: (when: string) => string;
  dataIssue: string;
  description: string;
  sports: Record<string, string>;
  language: string;
  details: string;
  askAI: string;
  askAIAbout: (name: string, date: string) => string;
  askAIDay: (date: string) => string;
  prevMonth: string;
  nextMonth: string;
  offline: string;
}

const en: Strings = {
  offline: "You're offline — showing the last saved schedule.",
  language: "Language",
  details: "Source",
  askAI: "Ask Google AI",
  askAIAbout: (name, date) => `Tell me about "${name}" at Nippon Budokan on ${date}: what it is, who performs, start time, and tickets.`,
  askAIDay: (date) => `What's happening at Nippon Budokan (日本武道館) on ${date}?`,
  prevMonth: "Previous month",
  nextMonth: "Next month",
  brand: "Budokan Today",
  sub: "日本武道館",
  map: "Map",
  today: "Today",
  tomorrow: "Tomorrow",
  pastDay: "Past day",
  upcoming: "Upcoming",
  prevDay: "Previous day",
  nextDay: "Next day",
  backToToday: "Back to today",
  comingUp: "Coming up",
  noUpcoming: "No upcoming events found.",
  nothingTitle: "Nothing listed",
  nothingToday: "No public event is on the calendar today. The hall may be closed, in setup for the next show, or hosting private practice.",
  nothingDay: "No public event is on the calendar for this day.",
  next: (name, date) => `Next: <b>${name}</b> on ${date}`,
  live: "Live",
  daytime: "Daytime",
  timesTBA: "Times TBA",
  doors: (t) => `Doors ${t}`,
  start: (t) => `Start ${t}`,
  ends: (t) => `Ends ${t}`,
  statusDoorsAt: (t) => `Doors ${t}`,
  statusDoorsOpen: "Doors open",
  statusOnNow: "On now",
  statusFinished: "Finished",
  footer: (l) => `Unofficial. Concerts from ${l.enjoy} and ${l.eventernote}; martial-arts events from the ${l.official}. Check with the organizer before you go.`,
  updated: (w) => `Updated ${w} JST`,
  dataIssue: "Some sources failed to update",
  description: "What's on at Nippon Budokan today: concerts and martial-arts tournaments.",
  sports: {},
};

const ja: Strings = {
  offline: "オフラインです。最後に保存した予定を表示しています。",
  language: "言語",
  details: "詳細",
  askAI: "Google AIに聞く",
  askAIAbout: (name, date) => `${date}に日本武道館で開催される「${name}」について、内容・出演者・開演時間・チケット情報を教えて。`,
  askAIDay: (date) => `${date}の日本武道館では何が開催されますか？`,
  prevMonth: "前の月",
  nextMonth: "次の月",
  brand: "今日の武道館",
  sub: "Nippon Budokan",
  map: "地図",
  today: "今日",
  tomorrow: "明日",
  pastDay: "過去",
  upcoming: "今後",
  prevDay: "前の日",
  nextDay: "次の日",
  backToToday: "今日に戻る",
  comingUp: "今後の予定",
  noUpcoming: "今後のイベントは見つかりませんでした。",
  nothingTitle: "予定なし",
  nothingToday: "今日は公開イベントの予定がありません。休館日、次の公演の設営、または非公開の稽古の可能性があります。",
  nothingDay: "この日は公開イベントの予定がありません。",
  next: (name, date) => `次回：${date} <b>${name}</b>`,
  live: "ライブ",
  daytime: "日中",
  timesTBA: "時間未定",
  doors: (t) => `開場 ${t}`,
  start: (t) => `開演 ${t}`,
  ends: (t) => `終演 ${t}`,
  statusDoorsAt: (t) => `開場 ${t}`,
  statusDoorsOpen: "開場中",
  statusOnNow: "開催中",
  statusFinished: "終了",
  footer: (l) => `非公式サイトです。コンサート情報は${l.enjoy}と${l.eventernote}、武道行事は${l.official}より。お出かけ前に主催者の情報をご確認ください。`,
  updated: (w) => `更新：${w}`,
  dataIssue: "一部のデータ更新に失敗しています",
  description: "日本武道館で今日開催されるコンサートや武道大会をチェック。",
  sports: {
    Jukendo: "銃剣道", Kendo: "剣道", Judo: "柔道", Karate: "空手道", Aikido: "合気道", Kyudo: "弓道",
    "Shorinji Kempo": "少林寺拳法", Naginata: "なぎなた", Kobudo: "古武道", Calligraphy: "書道",
    "New Year ceremony": "鏡開き式", "Martial arts": "武道",
  },
};

const zhHans: Strings = {
  offline: "当前离线，显示的是上次保存的日程。",
  language: "语言",
  details: "详情",
  askAI: "问 Google AI",
  askAIAbout: (name, date) => `介绍一下${date}在日本武道馆举行的「${name}」：活动内容、出演者、开演时间和门票信息。`,
  askAIDay: (date) => `${date}日本武道馆有什么活动？`,
  prevMonth: "上个月",
  nextMonth: "下个月",
  brand: "今日武道馆",
  sub: "日本武道館 · Nippon Budokan",
  map: "地图",
  today: "今天",
  tomorrow: "明天",
  pastDay: "往日",
  upcoming: "即将举行",
  prevDay: "前一天",
  nextDay: "后一天",
  backToToday: "回到今天",
  comingUp: "近期活动",
  noUpcoming: "暂无近期活动。",
  nothingTitle: "暂无活动",
  nothingToday: "今天没有公开活动。场馆可能休馆、正在为下一场演出布置，或举行非公开练习。",
  nothingDay: "这一天没有公开活动。",
  next: (name, date) => `下一场：${date} <b>${name}</b>`,
  live: "演出",
  daytime: "白天",
  timesTBA: "时间待定",
  doors: (t) => `入场 ${t}`,
  start: (t) => `开演 ${t}`,
  ends: (t) => `结束 ${t}`,
  statusDoorsAt: (t) => `${t} 入场`,
  statusDoorsOpen: "已开始入场",
  statusOnNow: "进行中",
  statusFinished: "已结束",
  footer: (l) => `非官方网站。演出信息来自 ${l.enjoy} 和 ${l.eventernote}，武道活动来自${l.official}。出发前请以主办方信息为准。`,
  updated: (w) => `更新于 ${w}（日本时间）`,
  dataIssue: "部分数据源更新失败",
  description: "查看日本武道馆今天的演唱会和武道比赛。",
  sports: {
    Jukendo: "铳剑道", Kendo: "剑道", Judo: "柔道", Karate: "空手道", Aikido: "合气道", Kyudo: "弓道",
    "Shorinji Kempo": "少林寺拳法", Naginata: "薙刀", Kobudo: "古武道", Calligraphy: "书法",
    "New Year ceremony": "新年开镜仪式", "Martial arts": "武道",
  },
};

const zhHant: Strings = {
  ...zhHans,
  offline: "目前離線，顯示的是上次儲存的日程。",
  language: "語言",
  details: "詳情",
  askAI: "問 Google AI",
  askAIAbout: (name, date) => `介紹一下${date}在日本武道館舉行的「${name}」：活動內容、演出者、開演時間和票務資訊。`,
  askAIDay: (date) => `${date}日本武道館有什麼活動？`,
  prevMonth: "上個月",
  nextMonth: "下個月",
  brand: "今日武道館",
  map: "地圖",
  pastDay: "往日",
  upcoming: "即將舉行",
  prevDay: "前一天",
  nextDay: "後一天",
  backToToday: "回到今天",
  comingUp: "近期活動",
  noUpcoming: "暫無近期活動。",
  nothingTitle: "暫無活動",
  nothingToday: "今天沒有公開活動。場館可能休館、正在為下一場演出佈置，或舉行非公開練習。",
  nothingDay: "這一天沒有公開活動。",
  next: (name, date) => `下一場：${date} <b>${name}</b>`,
  live: "演出",
  daytime: "白天",
  timesTBA: "時間待定",
  doors: (t) => `入場 ${t}`,
  start: (t) => `開演 ${t}`,
  ends: (t) => `結束 ${t}`,
  statusDoorsAt: (t) => `${t} 入場`,
  statusDoorsOpen: "已開始入場",
  statusOnNow: "進行中",
  statusFinished: "已結束",
  footer: (l) => `非官方網站。演出資訊來自 ${l.enjoy} 和 ${l.eventernote}，武道活動來自${l.official}。出發前請以主辦單位資訊為準。`,
  updated: (w) => `更新於 ${w}（日本時間）`,
  dataIssue: "部分資料來源更新失敗",
  description: "查看日本武道館今天的演唱會和武道比賽。",
  sports: {
    Jukendo: "銃劍道", Kendo: "劍道", Judo: "柔道", Karate: "空手道", Aikido: "合氣道", Kyudo: "弓道",
    "Shorinji Kempo": "少林寺拳法", Naginata: "薙刀", Kobudo: "古武道", Calligraphy: "書法",
    "New Year ceremony": "新年開鏡儀式", "Martial arts": "武道",
  },
};

const ko: Strings = {
  offline: "오프라인 상태입니다. 마지막으로 저장된 일정을 표시합니다.",
  language: "언어",
  details: "상세",
  askAI: "Google AI에게 묻기",
  askAIAbout: (name, date) => `${date} 일본 부도칸에서 열리는 「${name}」에 대해 알려줘: 내용, 출연자, 시작 시간, 티켓 정보.`,
  askAIDay: (date) => `${date} 일본 부도칸에서 무슨 행사가 열리나요?`,
  prevMonth: "이전 달",
  nextMonth: "다음 달",
  brand: "오늘의 부도칸",
  sub: "日本武道館 · 일본 부도칸",
  map: "지도",
  today: "오늘",
  tomorrow: "내일",
  pastDay: "지난 날",
  upcoming: "예정",
  prevDay: "이전 날",
  nextDay: "다음 날",
  backToToday: "오늘로 돌아가기",
  comingUp: "다가오는 일정",
  noUpcoming: "예정된 이벤트가 없습니다.",
  nothingTitle: "일정 없음",
  nothingToday: "오늘은 공개 이벤트가 없습니다. 휴관일이거나 다음 공연 준비 중, 또는 비공개 연습일 수 있습니다.",
  nothingDay: "이 날은 공개 이벤트가 없습니다.",
  next: (name, date) => `다음: ${date} <b>${name}</b>`,
  live: "공연",
  daytime: "낮",
  timesTBA: "시간 미정",
  doors: (t) => `입장 ${t}`,
  start: (t) => `개연 ${t}`,
  ends: (t) => `종료 ${t}`,
  statusDoorsAt: (t) => `${t} 입장`,
  statusDoorsOpen: "입장 중",
  statusOnNow: "진행 중",
  statusFinished: "종료",
  footer: (l) => `비공식 사이트입니다. 공연 정보는 ${l.enjoy}와 ${l.eventernote}, 무도 행사는 ${l.official}에서 가져옵니다. 방문 전 주최 측 정보를 확인하세요.`,
  updated: (w) => `업데이트: ${w} (일본 시간)`,
  dataIssue: "일부 데이터 업데이트 실패",
  description: "일본 부도칸에서 오늘 열리는 콘서트와 무도 대회를 확인하세요.",
  sports: {
    Jukendo: "총검도", Kendo: "검도", Judo: "유도", Karate: "가라테", Aikido: "합기도", Kyudo: "궁도",
    "Shorinji Kempo": "소림사권법", Naginata: "나기나타", Kobudo: "고무도", Calligraphy: "서예",
    "New Year ceremony": "신년 행사", "Martial arts": "무도",
  },
};

export const OFFICIAL_LINK_TEXT: Record<Locale, string> = {
  en: "official Budokan schedule",
  ja: "日本武道館公式の行事日程",
  "zh-Hans": "日本武道馆官方日程",
  "zh-Hant": "日本武道館官方日程",
  ko: "부도칸 공식 일정",
};

export const STRINGS: Record<Locale, Strings> = { en, ja, "zh-Hans": zhHans, "zh-Hant": zhHant, ko };

export function isLocale(s: string | null | undefined): s is Locale {
  return !!s && (LOCALES as readonly string[]).includes(s);
}

// Map a BCP 47 tag to one of our locales; zh-TW/HK/MO and Hant mean Traditional.
function fromTag(tag: string): Locale | undefined {
  const t = tag.trim().toLowerCase();
  if (t.startsWith("ja")) return "ja";
  if (t.startsWith("ko")) return "ko";
  if (t.startsWith("zh")) return /hant|-tw|-hk|-mo/.test(t) ? "zh-Hant" : "zh-Hans";
  if (t.startsWith("en")) return "en";
}

export function pickLocale(query: string | null, cookie: string | null, acceptLanguage: string | null): Locale {
  if (isLocale(query)) return query;
  const fromCookie = cookie?.match(/(?:^|;\s*)lang=([^;]+)/)?.[1];
  if (isLocale(fromCookie)) return fromCookie;
  const tags = (acceptLanguage ?? "")
    .split(",")
    .map((part) => {
      const [tag, q] = part.split(";q=");
      return { tag, q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { tag } of tags) {
    const l = fromTag(tag);
    if (l) return l;
  }
  return "en";
}
