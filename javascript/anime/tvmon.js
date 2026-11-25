// 티비몬 (tvmon1.com) - 드라마/예능/영화/애니 다시보기 (탐색 전용)
// 사이트는 그누보드 기반. 목록·상세·회차 목록은 HTML, 검색은 /bbs/ajax.searchList.php(JSON)를 씁니다.
// 영상은 암호화된 스트림이라 재생은 지원하지 않습니다. 회차를 누르면 웹뷰로 사이트에서 직접 보도록 안내합니다.
const mangayomiSources = [
  {
    id: 640218537,
    name: "티비몬",
    lang: "ko",
    baseUrl: "https://tvmon1.com",
    apiUrl: "",
    iconUrl: "https://raw.githubusercontent.com/rewq4434/mangayomi-ext/main/icon/tvmon.png",
    typeSource: "single",
    itemType: 1,
    isManga: false,
    isNsfw: false,
    hasCloudflare: false,
    version: "1.0.0",
    dateFormat: "",
    dateFormatLocale: "",
    pkgPath: "javascript/anime/tvmon.js",
  },
];

const TVM_UA =
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";

const TVM_CATEGORIES = [
  ["drama", "드라마"],
  ["ent", "예능"],
  ["movie", "영화"],
  ["kor_movie", "한국영화"],
  ["world", "해외드라마"],
  ["ott_ent", "해외 예능/다큐"],
  ["animation", "애니메이션"],
  ["ani_movie", "극장판 애니"],
  ["sisa", "시사/다큐"],
  ["old_drama", "추억의 드라마"],
  ["old_ent", "추억의 예능"],
];
const TVM_SORTS = [
  ["subidx", "최근 방영순"],
  ["wr_datetime", "최근 등록순"],
  ["wr_hit", "조회수순"],
  ["wr_good", "좋아요순"],
];

class DefaultExtension extends MProvider {
  get supportsLatest() {
    return true;
  }

  get prefs() {
    return new SharedPreferences();
  }

  get baseUrl() {
    const pref = String(this.prefs.get("base_url") || "").trim().replace(/\/+$/, "");
    return /^https?:\/\/[^\s/]+$/i.test(pref) ? pref : this.source.baseUrl;
  }

  // 인기·최신 탭에 쓸 기본 카테고리 (설정에서 변경)
  get defaultCategory() {
    const v = String(this.prefs.get("default_category") || "").trim();
    return TVM_CATEGORIES.some(([k]) => k === v) ? v : "drama";
  }

  get client() {
    return this._client || (this._client = new Client());
  }

  getHeaders(url) {
    return { "User-Agent": TVM_UA, Referer: this.baseUrl + "/" };
  }

  getSourcePreferences() {
    return [
      {
        key: "base_url",
        editTextPreference: {
          title: "사이트 주소",
          summary: "도메인 숫자가 바뀌면(tvmon1 → tvmon2 …) 새 주소를 입력하세요. 비우면 기본 주소를 사용합니다.",
          value: "",
          dialogTitle: "사이트 주소",
          dialogMessage: "예: https://tvmon1.com",
        },
      },
      {
        key: "default_category",
        listPreference: {
          title: "인기·최신 탭 카테고리",
          summary: "인기(조회수순)·최신(최근 방영순) 탭에 보여줄 카테고리",
          valueIndex: 0,
          entries: TVM_CATEGORIES.map(([, name]) => name),
          entryValues: TVM_CATEGORIES.map(([key]) => key),
        },
      },
    ];
  }

  async request(url, extraHeaders = {}) {
    let last = null;
    for (let i = 0; i < 2; i++) {
      try {
        const res = await this.client.get(url, { ...this.getHeaders(), ...extraHeaders });
        if (res.statusCode >= 200 && res.statusCode < 300) {
          if (/<title>\s*Just a moment|cf-chl-/i.test(res.body || ""))
            throw new Error("WebView에서 사이트 인증을 완료한 후 다시 시도해 주세요.");
          return res.body;
        }
        last = new Error(`사이트 요청에 실패했습니다 (HTTP ${res.statusCode}).`);
        if (![408, 429, 500, 502, 503, 504].includes(res.statusCode)) break;
      } catch (e) {
        last = e;
      }
    }
    throw last;
  }

  // 전체 주소 → 사이트 내부 경로
  path(url) {
    return String(url || "")
      .trim()
      .replace(/&amp;/g, "&")
      .replace(/^https?:\/\/[^/]+/i, "")
      .split("#")[0];
  }

  // "/drama/4132/406793665"(최신 회차 링크) → "/drama/4132"(작품)
  workPath(url) {
    const m = /^\/([a-z_]+)\/(\d+)/i.exec(this.path(url));
    return m ? `/${m[1]}/${m[2]}` : "";
  }

  image(src) {
    const s = String(src || "").trim();
    if (!s || /\/img\/(no\d*|lazyloader)\.(png|svg)/i.test(s)) return "";
    if (s.startsWith("//")) return "https:" + s;
    if (s.startsWith("/")) return this.baseUrl + s;
    return s;
  }

  text(el) {
    return el ? String(el.text || "").replace(/\s+/g, " ").trim() : "";
  }

  // ---------- 목록 ----------

  parseList(html, page) {
    const doc = new Document(html);
    const seen = new Set();
    const list = [];
    for (const li of doc.select("li")) {
      const a = li.selectFirst("a.img");
      if (!a) continue;
      const link = this.workPath(a.attr("href"));
      if (!link || seen.has(link)) continue;
      seen.add(link);
      const img = a.selectFirst("img");
      list.push({
        name: this.text(li.selectFirst("a.title")) || this.text(a),
        link,
        imageUrl: this.image(img ? img.attr("data-src") || img.attr("src") : ""),
      });
    }
    let maxPage = page;
    for (const a of doc.select("a.pg_page")) {
      const m = /[?&]page=(\d+)/.exec(String(a.attr("href")).replace(/&amp;/g, "&"));
      if (m) maxPage = Math.max(maxPage, Number(m[1]));
    }
    return { list, hasNextPage: list.length > 0 && maxPage > page };
  }

  async categoryList(category, sort, page) {
    const url = `${this.baseUrl}/${category}?sst=${encodeURIComponent(sort)}&page=${page}`;
    return this.parseList(await this.request(url), page);
  }

  getPopular(page) {
    return this.categoryList(this.defaultCategory, "wr_hit", page);
  }

  getLatestUpdates(page) {
    return this.categoryList(this.defaultCategory, "subidx", page);
  }

  filterValue(filters, type, def) {
    const f = (filters || []).find((x) => x.type === type);
    if (!f || !f.values) return def;
    return f.values[f.state]?.value ?? def;
  }

  async search(query, page, filters) {
    const category = this.filterValue(filters, "category", "");
    const sort = this.filterValue(filters, "sort", "subidx");
    query = String(query || "").trim();

    // 검색어가 없으면 카테고리 목록을 정렬해서 보여줍니다.
    if (!query) return this.categoryList(category || this.defaultCategory, sort, page);

    let url =
      `${this.baseUrl}/bbs/ajax.searchList.php?sfl=wr_subject&stx=${encodeURIComponent(query)}` +
      `&sop=and&sst=subIdx&page=${page}`;
    if (category) url += `&sb=${encodeURIComponent(category)}`;
    const body = await this.request(url, {
      Accept: "application/json, text/javascript, */*",
      "X-Requested-With": "XMLHttpRequest",
      Referer: `${this.baseUrl}/search?stx=${encodeURIComponent(query)}`,
    });
    let data;
    try {
      data = JSON.parse(body);
    } catch (e) {
      throw new Error("검색 결과를 읽지 못했습니다. 사이트 구조가 바뀌었을 수 있습니다.");
    }
    const seen = new Set();
    const list = [];
    for (const row of data?.list || []) {
      const link = this.workPath(row.href) || (row.bo_table && row.wr_id ? `/${row.bo_table}/${row.wr_id}` : "");
      if (!link || seen.has(link)) continue;
      seen.add(link);
      const img = row.bo_table === "ani" && row.thumb ? row.thumb : row.wr_4;
      list.push({
        name: String(row.wr_subject || "").trim(),
        link,
        imageUrl: this.image(img),
      });
    }
    const pages = String(data?.pages || "").replace(/&amp;/g, "&");
    return { list, hasNextPage: list.length > 0 && pages.includes(`page=${page + 1}`) };
  }

  getFilterList() {
    const select = (type, name, values) => ({
      type_name: "SelectFilter",
      type,
      name,
      state: 0,
      values: values.map(([value, label]) => ({ type_name: "SelectOption", name: label, value })),
    });
    return [
      { type_name: "HeaderFilter", name: "검색어가 있으면 카테고리로만 거르고, 정렬은 검색어가 없을 때 적용됩니다." },
      select("category", "카테고리", [["", "전체 (검색할 때)"], ...TVM_CATEGORIES]),
      select("sort", "정렬", TVM_SORTS),
    ];
  }

  // ---------- 상세 ----------

  parseDate(s) {
    const m = /(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(String(s || ""));
    if (!m) return null;
    const t = Date.parse(`${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}T00:00:00+09:00`);
    return Number.isFinite(t) ? String(t) : null;
  }

  async getDetail(url) {
    const path = this.workPath(url);
    if (!path) throw new Error("올바른 티비몬 작품 주소가 아닙니다.");
    const html = await this.request(this.baseUrl + path);
    const doc = new Document(html);

    // 제목: "#bo_v_movinfo h3"의 첫 텍스트, 없으면 h1에서 "N화"·"다시보기"를 지움
    let name = "";
    const h3 = doc.selectFirst("#bo_v_movinfo h3");
    if (h3) {
      const ori = this.text(h3.selectFirst("span.ori_title"));
      name = this.text(h3).replace(ori, "").trim();
    }
    if (!name) {
      name = this.text(doc.selectFirst("h1#bo_v_title"))
        .replace(/\s*다시보기\s*$/, "")
        .replace(/\s*\d+\s*화\s*$/, "")
        .trim();
    }

    const poster = doc.selectFirst("#bo_v_poster img");
    const info = doc.select("#bo_v_movinfo dl.bo_v_info dd").map((d) => this.text(d)).filter(Boolean);
    const genre = doc
      .select("#bo_v_movinfo dl.ctgs dd a")
      .filter((a) => !/btn_watch/.test(a.attr("class")))
      .map((a) => this.text(a))
      .filter((g) => g && g !== "트레일러 보기");
    const ori = this.text(doc.selectFirst("#bo_v_movinfo span.ori_title"));
    const category = TVM_CATEGORIES.find(([k]) => path.startsWith(`/${k}/`));

    const lines = [];
    if (category) lines.push(`분류: ${category[1]}`);
    if (ori && ori.replace(/^원제\s*:\s*/, "") !== name) lines.push(ori);
    lines.push(...info);

    // 회차 목록 (최신 회차가 위). 위쪽 가로 목록(a.ep-item)은 최근 10개뿐이라 쓰지 않습니다.
    const episodes = [];
    const seen = new Set();
    for (const li of doc.select("li[data-ep-idx]")) {
      const a = li.selectFirst("a.ep-link");
      if (!a) continue;
      const epPath = this.path(a.attr("href"));
      if (!epPath || seen.has(epPath)) continue;
      seen.add(epPath);
      const img = a.selectFirst("img");
      episodes.push({
        name: this.text(li.selectFirst("a.title")) || this.text(a) || name,
        url: epPath,
        dateUpload: this.parseDate(this.text(li.selectFirst(".date"))),
        thumbnailUrl: this.image(img ? img.attr("data-src") || img.attr("data-original") : ""),
      });
    }

    return {
      name,
      link: path,
      // 예능처럼 포스터가 없는 작품은 최신 회차 썸네일로 대신합니다.
      imageUrl: this.image(poster ? poster.attr("src") : "") || episodes[0]?.thumbnailUrl || "",
      description: lines.join("\n"),
      author: "",
      genre,
      status: 5,
      episodes,
    };
  }

  // ---------- 재생 ----------

  async getVideoList(url) {
    throw new Error("재생은 지원하지 않습니다. 웹뷰 버튼으로 사이트에서 직접 보세요.");
  }
}
