// 마루마루 (marumaru112.com) - 웹툰 / 만화 / 웹소설
// 사이트는 React SPA이고, 목록은 사이트의 /api, 회차와 본문은 storagewebtoon.store 리더 API에서 가져옵니다.
// 한 파일로 3개의 소스(웹툰, 만화, 소설)를 제공하며 additionalParams의 media 값으로 구분합니다.
const mangayomiSources = [
  {
    id: 718203541,
    name: "마루마루 웹툰",
    lang: "ko",
    baseUrl: "https://marumaru112.com",
    apiUrl: "",
    iconUrl: "https://raw.githubusercontent.com/rewq4434/mangayomi-ext/main/icon/marumaru.png",
    typeSource: "single",
    itemType: 0,
    isManga: true,
    isNsfw: true,
    hasCloudflare: false,
    version: "1.0.4",
    dateFormat: "",
    dateFormatLocale: "",
    pkgPath: "javascript/marumaru.js",
    additionalParams: '{"media":"WEBTOON"}',
  },
  {
    id: 718203542,
    name: "마루마루 만화",
    lang: "ko",
    baseUrl: "https://marumaru112.com",
    apiUrl: "",
    iconUrl: "https://raw.githubusercontent.com/rewq4434/mangayomi-ext/main/icon/marumaru.png",
    typeSource: "single",
    itemType: 0,
    isManga: true,
    isNsfw: true,
    hasCloudflare: false,
    version: "1.0.4",
    dateFormat: "",
    dateFormatLocale: "",
    pkgPath: "javascript/marumaru.js",
    additionalParams: '{"media":"MANHWA"}',
  },
  {
    id: 718203543,
    name: "마루마루 소설",
    lang: "ko",
    baseUrl: "https://marumaru112.com",
    apiUrl: "",
    iconUrl: "https://raw.githubusercontent.com/rewq4434/mangayomi-ext/main/icon/marumaru.png",
    typeSource: "single",
    itemType: 2,
    isManga: false,
    isNsfw: true,
    hasCloudflare: false,
    version: "1.0.4",
    dateFormat: "",
    dateFormatLocale: "",
    pkgPath: "javascript/marumaru.js",
    additionalParams: '{"media":"NOVEL"}',
  },
];

const MARU_UA =
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";
const MARU_API = "https://api.storagewebtoon.store";
const MARU_READER = MARU_API + "/api/v1/reader/A2";
const MARU_LIST_SIZE = 60; // 큰 화면에서도 스크롤이 생겨 자동으로 다음 페이지를 불러오도록
const MARU_EP_SIZE = 100;

const MARU_SORTS = [
  ["LATEST", "최신순"],
  ["BOOKMARK", "인기순 (북마크)"],
  ["VIEW", "조회순"],
  ["EPISODE", "회차 많은 순"],
];
const MARU_STATUS = [
  ["", "전체"],
  ["ON", "연재중"],
  ["COMPLETED", "완결"],
];
const MARU_WEEKDAYS = [
  ["", "전체"],
  ["월", "월"],
  ["화", "화"],
  ["수", "수"],
  ["목", "목"],
  ["금", "금"],
  ["토", "토"],
  ["일", "일"],
];

function maruEscape(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

class DefaultExtension extends MProvider {
  get params() {
    const src = mangayomiSources.find((s) => s.id === this.source.id) || this.source;
    try {
      return JSON.parse(src.additionalParams || "{}");
    } catch (e) {
      return {};
    }
  }

  get media() {
    return this.params.media || "WEBTOON";
  }

  get supportsLatest() {
    return true;
  }

  get baseUrl() {
    const pref = String(new SharedPreferences().get("base_url") || "").trim().replace(/\/+$/, "");
    return /^https?:\/\/[^\s/]+$/i.test(pref) ? pref : this.source.baseUrl;
  }

  get client() {
    return this._client || (this._client = new Client());
  }

  getHeaders(url) {
    return {
      "User-Agent": MARU_UA,
      Referer: this.baseUrl + "/",
    };
  }

  getSourcePreferences() {
    return [
      {
        key: "base_url",
        editTextPreference: {
          title: "사이트 주소",
          summary: "도메인이 바뀌면 새 주소를 입력하세요. 비우면 기본 주소를 사용합니다.",
          value: "",
          dialogTitle: "사이트 주소",
          dialogMessage: "예: https://marumaru112.com",
        },
      },
    ];
  }

  // 목록·검색·상세는 사이트의 데이터 서버(api.storagewebtoon.store)를 직접 부릅니다.
  // 마루마루 도메인 숫자가 바뀌어도(111 → 112 …) 영향을 받지 않고, 실패하면 사이트 주소로 한 번 더 시도합니다.
  async api(path) {
    try {
      return await this.json(MARU_API + path);
    } catch (e) {
      return await this.json(this.baseUrl + path);
    }
  }

  async json(url) {
    let lastError = null;
    for (let i = 0; i < 2; i++) {
      try {
        const res = await this.client.get(url, { ...this.getHeaders(), Accept: "application/json" });
        if (res.statusCode >= 200 && res.statusCode < 300) return JSON.parse(res.body);
        lastError = new Error(`사이트 요청에 실패했습니다 (HTTP ${res.statusCode}).`);
        if (![408, 429, 500, 502, 503, 504].includes(res.statusCode)) break;
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError;
  }

  toItem(w) {
    return {
      name: String(w.title || "").trim(),
      link: "/works/" + w.id,
      imageUrl: w.thumbUrl || w.coverUrl || "",
    };
  }

  listResult(data, page, size) {
    const items = Array.isArray(data?.items) ? data.items : [];
    const total = Number(data?.total || 0);
    return {
      list: items.filter((w) => w && w.id != null).map((w) => this.toItem(w)),
      hasNextPage: items.length > 0 && page * size < total,
    };
  }

  async works(page, sort, extra = {}) {
    const q = new URLSearchParamsLite();
    q.set("mediaType", this.media);
    q.set("sort", sort);
    q.set("page", String(page - 1));
    q.set("size", String(MARU_LIST_SIZE));
    for (const [k, v] of Object.entries(extra)) if (v) q.set(k, v);
    const data = await this.api("/api/works?" + q.toString());
    return this.listResult(data, page, MARU_LIST_SIZE);
  }

  getPopular(page) {
    return this.works(page, "BOOKMARK");
  }

  getLatestUpdates(page) {
    return this.works(page, "LATEST");
  }

  filterValue(filters, type, def) {
    const f = (filters || []).find((x) => x.type === type);
    if (!f) return def;
    if (f.values) return f.values[f.state]?.value ?? def;
    return f.state ?? def;
  }

  async search(query, page, filters) {
    const sort = this.filterValue(filters, "sort", "LATEST");
    const status = this.filterValue(filters, "status", "");
    const weekday = this.filterValue(filters, "weekday", "");
    query = String(query || "").trim();

    if (!query) {
      return this.works(page, sort, {
        completed: status === "COMPLETED" ? "true" : status === "ON" ? "false" : "",
        weekday: this.media === "WEBTOON" ? weekday : "",
      });
    }

    const q = new URLSearchParamsLite();
    q.set("q", query);
    q.set("page", String(page - 1));
    q.set("media", this.media);
    q.set("sort", sort);
    if (status) q.set("status", status);
    const data = await this.api("/api/search?" + q.toString());
    const res = this.listResult(data, page, Number(data?.size) || 70);
    // 검색 API가 media 필터를 무시하고 모든 종류를 섞어 주므로 이 소스의 종류만 남깁니다.
    const keep = new Set((data?.items || []).filter((w) => w && w.mediaType === this.media).map((w) => "/works/" + w.id));
    res.list = res.list.filter((x) => keep.has(x.link));
    return res;
  }

  getFilterList() {
    const select = (type, name, values) => ({
      type_name: "SelectFilter",
      type,
      name,
      state: 0,
      values: values.map(([value, label]) => ({ type_name: "SelectOption", name: label, value })),
    });
    const filters = [select("sort", "정렬", MARU_SORTS), select("status", "상태", MARU_STATUS)];
    if (this.media === "WEBTOON") filters.push(select("weekday", "요일 (검색어 없을 때)", MARU_WEEKDAYS));
    return filters;
  }

  workId(url) {
    const m = /\/(?:works|webtoon|manhwa|novel)\/(\d+)/.exec(String(url));
    if (!m) throw new Error("올바른 마루마루 작품 주소가 아닙니다.");
    return m[1];
  }

  async getDetail(url) {
    const id = this.workId(url);
    const detail = await this.api("/api/works/" + id);
    const w = detail?.work;
    if (!w) throw new Error("작품 정보를 찾을 수 없습니다.");

    // 회차 목록은 리더 API에서 100개씩 페이지로 가져옵니다.
    const base = String(detail.episodesUrl || `${MARU_READER}/works/${id}`).split("?")[0];
    const first = await this.json(`${base}?page=1&size=${MARU_EP_SIZE}`);
    const total = Number(first?.total || 0);
    const pages = Math.min(Math.ceil(total / MARU_EP_SIZE), 200);
    const rest = [];
    for (let p = 2; p <= pages; p++) rest.push(this.json(`${base}?page=${p}&size=${MARU_EP_SIZE}`));
    const all = [first, ...(await Promise.all(rest))];

    const seen = new Map();
    for (const page of all) {
      for (const e of page?.episodes || []) {
        if (!e || e.id == null || seen.has(e.id)) continue;
        seen.set(e.id, e);
      }
    }
    const episodes = [...seen.values()].sort((a, b) => (Number(b.number) || 0) - (Number(a.number) || 0));

    const paidIds = await this.findPaidEpisodes(episodes);

    const chapters = episodes.map((e) => {
      const t = Date.parse(String(e.published_at || ""));
      // 제목에 화수가 없으면(예: "과거의 그때처럼. (4)") 앱이 괄호 숫자를 회차 번호로 읽으므로 앞에 화수를 붙입니다.
      const title = String(e.title || "").trim();
      const num = Number(e.number);
      const hasNum = Number.isFinite(num) && new RegExp(`(^|\\D)${num}\\s*화`).test(title);
      let name = !Number.isFinite(num) ? title : !title ? `${num}화` : hasNum ? title : `${num}화 - ${title}`;
      if (e.show_status && e.show_status !== "표시가능") name += ` (${e.show_status})`;
      const paid = paidIds.has(e.id);
      if (paid) name = "🔒 " + name;
      return {
        name,
        url: "/episodes/" + e.id,
        dateUpload: Number.isFinite(t) ? String(t) : null,
        scanlator: paid ? "포인트 구매 회차" : null,
      };
    });

    const genres = String(w.genres || "")
      .split(",")
      .map((g) => g.trim())
      .filter(Boolean);
    const info = [w.platform, w.weekday && w.weekday !== "ALL" ? w.weekday + "요일" : ""].filter(Boolean).join(" · ");
    const synopsis = String(detail.synopsis || first?.synopsis || "").trim();

    return {
      name: String(w.title || "").trim(),
      link: "/works/" + id,
      imageUrl: w.coverUrl || w.thumbUrl || "",
      author: String(w.author || "").replace(/,\s*$/, "").trim(),
      artist: String(detail.illustrator || "").trim(),
      description: [info, synopsis].filter(Boolean).join("\n\n"),
      genre: genres,
      status: w.status === "COMPLETED" ? 1 : 0,
      chapters,
    };
  }

  // 회차 목록에는 유료 여부가 없어서 본문을 열어 봐야 알 수 있습니다.
  // 포인트 회차는 최신 1~3화에 몰려 있으므로, 최신 회차부터 5개씩 확인하다가
  // 유료 회차가 하나도 없는 묶음이 나오면 멈춥니다 (보통 추가 요청 5개, 최대 30개).
  async findPaidEpisodes(episodes) {
    const paid = new Set();
    const BATCH = 5;
    for (let i = 0; i < Math.min(episodes.length, 30); i += BATCH) {
      const batch = episodes.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map((e) =>
          this.json(`${MARU_READER}/episodes/${e.id}`)
            .then((d) => (d?.item?.body || []).some((b) => b && b.kind === "paid"))
            .catch(() => false),
        ),
      );
      let found = false;
      results.forEach((isPaid, k) => {
        if (isPaid) {
          paid.add(batch[k].id);
          found = true;
        }
      });
      if (!found) break;
    }
    return paid;
  }

  async episodeBody(url) {
    const m = /\/episodes\/(\d+)/.exec(String(url));
    if (!m) throw new Error("올바른 회차 주소가 아닙니다.");
    const data = await this.json(`${MARU_READER}/episodes/${m[1]}`);
    const item = data?.item;
    if (!item) throw new Error("회차를 불러오지 못했습니다.");
    return item;
  }

  blockMessage(body) {
    for (const b of body) {
      if (b?.kind === "paid") return "포인트 구매 회차라 볼 수 없습니다. (사이트에서 구매가 필요합니다)";
      if (b?.kind === "processing") return "아직 준비 중인 회차입니다. 잠시 후 다시 시도해 주세요.";
    }
    return "";
  }

  async getPageList(url) {
    const item = await this.episodeBody(url);
    const body = Array.isArray(item.body) ? item.body : [];
    const images = body
      .filter((b) => b && b.kind === "image" && b.url)
      .map((b) => String(b.url).replace(/(\/api\/media\/episode\/\d+\/\d+)(?![.\d])/, "$1.webp"));
    if (!images.length) throw new Error(this.blockMessage(body) || "회차에서 이미지를 찾을 수 없습니다.");
    return images.map((u) => ({ url: u, headers: this.getHeaders() }));
  }

  async getHtmlContent(name, url) {
    const item = await this.episodeBody(url);
    let body = Array.isArray(item.body) ? item.body : [];

    // 본문이 별도 주소(embed_url)에 있는 경우
    const embed = item.embed_url;
    if (embed && /^https?:\/\//i.test(embed) && !/\/api\/v1\/reader\//.test(embed)) {
      const res = await this.client.get(embed, this.getHeaders());
      const text = String(res.body || "").replace(/^﻿/, "").trim();
      body = [];
      if (text.startsWith("[")) {
        try {
          body = JSON.parse(text);
        } catch (e) {}
      }
      if (!body.length && text) body = [{ kind: "narration", text }];
    }

    const parts = [];
    for (const b of body) {
      if (!b) continue;
      if ((b.kind === "narration" || b.kind === "text") && b.text) {
        for (const line of String(b.text).split(/\n+/)) {
          const t = line.trim();
          if (t) parts.push(`<p>${maruEscape(t)}</p>`);
        }
      } else if (b.kind === "image" && b.url) {
        parts.push(`<p><img src="${maruEscape(b.url)}"></p>`);
      }
    }
    if (!parts.length) throw new Error(this.blockMessage(body) || "회차 본문이 비어 있습니다.");
    return `<h2>${maruEscape(item.title || name || "")}</h2>\n${parts.join("\n")}`;
  }

  async cleanHtmlContent(html) {
    return html;
  }
}

// 망가요미 JS 런타임에는 URLSearchParams가 없을 수 있어 간단한 대체 구현을 둡니다.
class URLSearchParamsLite {
  constructor() {
    this.entries = [];
  }
  set(k, v) {
    this.entries = this.entries.filter(([key]) => key !== k);
    this.entries.push([k, String(v)]);
  }
  toString() {
    return this.entries.map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v)).join("&");
  }
}
