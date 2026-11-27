// AVsee (05.avsee.is) - 성인 영상 (그누보드/아미나 기반)
// 사이트 전체가 Cloudflare 보안 확인을 거치므로 hasCloudflare: true
// (앱이 웹뷰로 확인을 한 번 통과한 뒤 그 쿠키로 접속합니다).
// 목록은 /{게시판}?page=N, 게시판 안 검색은 /{게시판}?sfl=wr_subject||wr_content&stx=..., 전체 검색은 /bbs/search.php
const mangayomiSources = [
  {
    id: 735190428,
    name: "AVsee",
    lang: "ko",
    baseUrl: "https://05.avsee.is",
    apiUrl: "",
    iconUrl: "https://raw.githubusercontent.com/rewq4434/mangayomi-ext/main/icon/avsee.png",
    typeSource: "single",
    itemType: 1,
    isManga: false,
    isNsfw: true,
    hasCloudflare: true,
    version: "0.1.0",
    dateFormat: "",
    dateFormatLocale: "",
    pkgPath: "javascript/anime/avsee.js",
  },
];

const AVS_UA =
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";

// 영상 게시판 (메뉴 기준)
const AVS_BOARDS = [
  ["javm", "일본 모자이크파괴"],
  ["javc", "일본 유모"],
  ["javu", "일본 노모"],
  ["javleak", "일본 유출"],
  ["caption", "일본 자막"],
  ["javmgs", "일본 MGStage"],
  ["javfc2", "일본 FC2"],
  ["korea", "국내 영상"],
  ["western", "서양"],
];
const AVS_SORTS = [
  ["", "최신순"],
  ["wr_hit", "조회수순"],
  ["wr_good", "추천순"],
  ["wr_comment", "댓글순"],
];
// 전체 검색(/bbs/search.php)의 정렬 값
const AVS_SEARCH_SORT = { "": "newest", wr_hit: "hit", wr_good: "good", wr_comment: "comment" };

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

  // 인기·최신 탭에 쓸 게시판 (설정에서 변경)
  get defaultBoard() {
    const v = String(this.prefs.get("default_board") || "").trim();
    return AVS_BOARDS.some(([k]) => k === v) ? v : "javm";
  }

  get client() {
    return this._client || (this._client = new Client());
  }

  getHeaders(url) {
    return { "User-Agent": AVS_UA, Referer: this.baseUrl + "/" };
  }

  getSourcePreferences() {
    return [
      {
        key: "base_url",
        editTextPreference: {
          title: "사이트 주소",
          summary: "도메인 숫자가 바뀌면(05 → 06 …) 새 주소를 입력하세요. 비우면 기본 주소를 사용합니다.",
          value: "",
          dialogTitle: "사이트 주소",
          dialogMessage: "예: https://05.avsee.is",
        },
      },
      {
        key: "default_board",
        listPreference: {
          title: "인기·최신 탭 게시판",
          summary: "인기(조회수순)·최신(최신순) 탭에 보여줄 게시판",
          valueIndex: 0,
          entries: AVS_BOARDS.map(([, name]) => name),
          entryValues: AVS_BOARDS.map(([key]) => key),
        },
      },
    ];
  }

  async request(url) {
    let last = null;
    for (let i = 0; i < 2; i++) {
      try {
        const res = await this.client.get(url, this.getHeaders());
        const body = String(res.body || "");
        // 정상 페이지에도 Cloudflare 스크립트가 들어 있으므로 확인 화면 제목으로만 판단합니다.
        if (/<title>\s*(Just a moment|Attention Required)/i.test(body))
          throw new Error("Cloudflare 확인이 필요합니다. 웹뷰에서 사이트를 한 번 연 뒤 다시 시도해 주세요.");
        if (res.statusCode >= 200 && res.statusCode < 300) return body;
        last = new Error(`사이트 요청에 실패했습니다 (HTTP ${res.statusCode}).`);
        if (![408, 429, 500, 502, 503, 504].includes(res.statusCode)) break;
      } catch (e) {
        last = e;
        if (/Cloudflare/.test(e.message)) break;
      }
    }
    throw last;
  }

  path(url) {
    return String(url || "")
      .trim()
      .replace(/&amp;/g, "&")
      .replace(/^https?:\/\/[^/]+/i, "")
      .split("#")[0];
  }

  // "/javm/332806?page=1" → "/javm/332806"
  postPath(url) {
    const m = /^\/([a-z0-9_]+)\/(\d+)/i.exec(this.path(url));
    return m ? `/${m[1]}/${m[2]}` : "";
  }

  image(src) {
    const s = String(src || "").trim();
    if (!s || s.startsWith("data:") || s.startsWith("./")) return "";
    if (s.startsWith("//")) return "https:" + s;
    if (s.startsWith("/")) return this.baseUrl + s;
    return s;
  }

  text(el) {
    return el ? String(el.text || "").replace(/\s+/g, " ").trim() : "";
  }

  maxPage(doc, current) {
    let max = current;
    for (const a of doc.select(".pagination a, a.pg_page")) {
      const m = /[?&]page=(\d+)/.exec(String(a.attr("href")).replace(/&amp;/g, "&"));
      if (m) max = Math.max(max, Number(m[1]));
    }
    return max;
  }

  // ---------- 목록 ----------

  parseBoardList(html, page) {
    const doc = new Document(html);
    const seen = new Set();
    const list = [];
    for (const item of doc.select(".list-item")) {
      const a = item.selectFirst(".img-item a[href]") || item.selectFirst("h2 a[href]");
      if (!a) continue;
      const link = this.postPath(a.attr("href"));
      if (!link || seen.has(link)) continue;
      seen.add(link);
      const img = item.selectFirst(".img-item img");
      list.push({
        name: this.text(item.selectFirst("h2 a")) || this.text(item.selectFirst("h2")),
        link,
        imageUrl: this.image(img ? img.attr("data-src") || img.attr("src") : ""),
      });
    }
    return { list, hasNextPage: list.length > 0 && this.maxPage(doc, page) > page };
  }

  // 사이트 한 페이지는 9개뿐이라, 앱 한 페이지에 사이트 3페이지(27개)를 불러옵니다.
  // (큰 화면에서도 스크롤이 생겨 '더 불러오기' 없이 이어서 불러오도록)
  async boardList(board, page, opts = {}) {
    const PER = 3;
    const first = (page - 1) * PER + 1;
    const r1 = await this.boardPage(board, first, opts);
    const seen = new Set(r1.list.map((x) => x.link));
    const list = r1.list.slice();
    let hasNext = r1.hasNextPage;
    if (hasNext) {
      const rest = await Promise.all(
        [first + 1, first + 2].map((p) => this.boardPage(board, p, opts).catch(() => ({ list: [], hasNextPage: false }))),
      );
      for (const r of rest) for (const x of r.list) if (!seen.has(x.link)) seen.add(x.link) && list.push(x);
      hasNext = rest[1].hasNextPage;
    }
    return { list, hasNextPage: list.length > 0 && hasNext };
  }

  async boardPage(board, page, { sort = "", query = "" } = {}) {
    const q = [];
    if (query) {
      q.push("sfl=" + encodeURIComponent("wr_subject||wr_content"));
      q.push("stx=" + encodeURIComponent(query));
      q.push("sop=and");
    }
    if (sort) q.push("sst=" + encodeURIComponent(sort), "sod=desc");
    q.push("page=" + page);
    const url = `${this.baseUrl}/${board}?${q.join("&")}`;
    return this.parseBoardList(await this.request(url), page);
  }

  getPopular(page) {
    return this.boardList(this.defaultBoard, page, { sort: "wr_hit" });
  }

  getLatestUpdates(page) {
    return this.boardList(this.defaultBoard, page);
  }

  filterValue(filters, type, def) {
    const f = (filters || []).find((x) => x.type === type);
    if (!f || !f.values) return def;
    return f.values[f.state]?.value ?? def;
  }

  // 전체 검색: 결과가 게시판별로 묶여 나오므로 영상 게시판 글만 모읍니다.
  async globalSearch(query, page, sort) {
    const url =
      `${this.baseUrl}/bbs/search.php?sfl=${encodeURIComponent("wr_subject||wr_content")}` +
      `&stx=${encodeURIComponent(query)}&sop=and&result_type=all` +
      `&result_sort=${AVS_SEARCH_SORT[sort] || "newest"}&page=${page}`;
    const html = await this.request(url);
    const doc = new Document(html);
    const boards = new Set(AVS_BOARDS.map(([k]) => k));
    const seen = new Set();
    const list = [];
    for (const li of doc.select("li.search-result")) {
      const a = li.selectFirst(".search-result-title a[href]") || li.selectFirst("a.search-thumbnail[href]");
      if (!a) continue;
      const link = this.postPath(a.attr("href"));
      if (!link || seen.has(link) || !boards.has(link.split("/")[1])) continue;
      seen.add(link);
      const img = li.selectFirst("a.search-thumbnail img");
      list.push({
        name: this.text(li.selectFirst(".search-result-title a")),
        link,
        imageUrl: this.image(img ? img.attr("data-src") || img.attr("src") : ""),
      });
    }
    // "1 / 4 페이지"
    const m = /(\d+)\s*\/\s*(\d+)\s*페이지/.exec(this.text(doc.selectFirst(".discover-summary")) || html);
    const hasNext = m ? Number(m[1]) < Number(m[2]) : this.maxPage(doc, page) > page;
    return { list, hasNextPage: hasNext };
  }

  async search(query, page, filters) {
    const board = this.filterValue(filters, "board", "");
    const sort = this.filterValue(filters, "sort", "");
    query = String(query || "").trim();
    if (!query) return this.boardList(board || this.defaultBoard, page, { sort });
    if (!board) return this.globalSearch(query, page, sort);
    return this.boardList(board, page, { sort, query });
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
      { type_name: "HeaderFilter", name: "게시판을 '전체'로 두고 검색하면 모든 영상 게시판에서 찾습니다." },
      select("board", "게시판", [["", "전체 (검색할 때)"], ...AVS_BOARDS]),
      select("sort", "정렬", AVS_SORTS),
    ];
  }

  // ---------- 상세 ----------

  async getDetail(url) {
    const path = this.postPath(url);
    if (!path) throw new Error("올바른 AVsee 게시글 주소가 아닙니다.");
    const html = await this.request(this.baseUrl + path);
    const doc = new Document(html);

    const h1 = doc.selectFirst(".view-wrap h1") || doc.selectFirst("h1");
    const name = (h1 && (h1.attr("content") || this.text(h1))) || path;
    const img = doc.selectFirst(".view-img img") || doc.selectFirst(".view-content img");
    const content = doc.selectFirst(".view-content");

    // 본문: <h2>원제 - 번역 제목</h2> 출연 : … / 출시일 : … / 재생시간 : …
    const lines = [];
    const h2 = content ? this.text(content.selectFirst("h2")) : "";
    if (h2) lines.push(h2);
    const raw = content ? String(content.text || "") : "";
    const field = (label) => {
      const m = new RegExp(label + "\\s*:\\s*([^\\n]+?)(?=\\s*(?:출연|출시일|재생시간|다운로드 링크|$))").exec(
        raw.replace(/\s+/g, " "),
      );
      return m ? m[1].trim() : "";
    };
    const cast = field("출연");
    const release = field("출시일");
    const runtime = field("재생시간");
    if (cast) lines.push("출연: " + cast);
    if (release) lines.push("출시일: " + release);
    if (runtime) lines.push("재생시간: " + runtime);
    const board = AVS_BOARDS.find(([k]) => path.startsWith(`/${k}/`));
    if (board) lines.push("게시판: " + board[1]);

    const tags = doc
      .select(".view-tag a")
      .map((a) => this.text(a).replace(/^[#@]/, ""))
      .filter(Boolean);

    let dateUpload = null;
    const pub = doc.selectFirst("[itemprop=datePublished]");
    const pm = /(\d{4}-\d{2}-\d{2})\D*(\d{2}:\d{2}:\d{2})?/.exec(pub ? pub.attr("content") : "");
    if (pm) {
      const t = Date.parse(`${pm[1]}T${pm[2] || "00:00:00"}+09:00`);
      if (Number.isFinite(t)) dateUpload = String(t);
    }

    // 표지: 본문 이미지, 없으면 원본 이미지 보기 링크(view_image.php?bo_table=&fn=)에서 주소를 만듭니다.
    let imageUrl = this.image(img ? img.attr("src") : "");
    if (!imageUrl) {
      const vi = doc.selectFirst("a.view_image");
      const m = /bo_table=([a-z0-9_]+)&(?:amp;)?fn=([^&"]+)/i.exec(vi ? vi.attr("href") : "");
      if (m) imageUrl = `https://files.avsee.is/data/file/${m[1]}/${m[2]}`;
    }

    return {
      name: String(name).replace(/\s+/g, " ").trim(),
      link: path,
      imageUrl,
      description: lines.join("\n"),
      author: cast,
      genre: tags,
      status: 1,
      episodes: [{ name: "재생", url: path, dateUpload }],
    };
  }

  // ---------- 재생 ----------
  // 본문의 플레이어(iframe) 페이지에서 m3u8/mp4 주소를 찾습니다.
  // 플레이어가 주소를 숨기거나 암호화한 경우는 지원하지 않고 웹뷰로 안내합니다.
  async getVideoList(url) {
    const path = this.postPath(url);
    const html = await this.request(this.baseUrl + path);
    const doc = new Document(html);
    const frames = doc
      .select(".view-content iframe")
      .map((f) => this.image(f.attr("src") || f.attr("data-src")))
      .filter((s) => /^https?:\/\//i.test(s));

    const found = [];
    const add = (u, quality, referer) => {
      u = String(u).replace(/\\\//g, "/");
      if (found.some((v) => v.url === u)) return;
      const origin = (/^https?:\/\/[^/]+/i.exec(referer) || [this.baseUrl])[0];
      found.push({
        url: u,
        originalUrl: u,
        quality,
        headers: { "User-Agent": AVS_UA, Referer: referer, Origin: origin },
      });
    };
    const scan = (text, referer) => {
      for (const m of String(text).matchAll(/https?:(?:\\?\/){2}[^"'\s<>]+?\.(m3u8|mp4)(?:\?[^"'\s<>]*)?/gi))
        add(m[0], m[1].toLowerCase() === "m3u8" ? "HLS" : "MP4", referer);
    };

    scan(html, this.baseUrl + path);
    for (const src of frames) {
      try {
        const res = await this.client.get(src, { "User-Agent": AVS_UA, Referer: this.baseUrl + "/" });
        scan(res.body, src);
      } catch (e) {}
    }
    if (!found.length)
      throw new Error("이 영상의 재생 주소를 찾지 못했습니다. 웹뷰 버튼으로 사이트에서 직접 보세요.");
    return found;
  }
}
