// 북코 (015.bookkor.com) - 웹소설
// 사이트는 Laravel + Inertia.js로 되어 있어 페이지 데이터(JSON)를 X-Inertia 헤더로 바로 받아옵니다.
const mangayomiSources = [
  {
    id: 529174860,
    name: "북코 소설",
    lang: "ko",
    baseUrl: "https://015.bookkor.com",
    apiUrl: "",
    iconUrl: "https://raw.githubusercontent.com/rewq4434/mangayomi-ext/main/icon/bookkor.png",
    typeSource: "single",
    itemType: 2,
    isManga: false,
    isNsfw: false,
    hasCloudflare: false,
    version: "1.0.2",
    dateFormat: "",
    dateFormatLocale: "",
    pkgPath: "javascript/novel/bookkor.js",
  },
];

const BK_UA =
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";

const BK_MENUS = [
  ["", "전체"],
  ["일반소설", "일반소설"],
  ["완결소설", "완결소설"],
  ["성인소설", "성인소설"],
  ["BLGL", "BL/GL"],
];
const BK_SORTS = [
  ["latest", "최신순"],
  ["views", "조회순"],
  ["bookmark", "북마크순"],
  ["rating", "평점순"],
];
const BK_GENRES = ["판타지", "무협", "현대", "로맨스", "로맨스 판타지", "BL", "라노벨", "드라마", "19금", "기타"];

function bkEscape(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function bkDecodeEntities(s) {
  return String(s)
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function bkQuery(obj) {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) v.forEach((x, i) => out.push([`${k}[${i}]`, x]));
    else if (v !== "" && v != null) out.push([k, v]);
  }
  return out.map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v)).join("&");
}

class DefaultExtension extends MProvider {
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
    return { "User-Agent": BK_UA, Referer: this.baseUrl + "/" };
  }

  getSourcePreferences() {
    return [
      {
        key: "base_url",
        editTextPreference: {
          title: "사이트 주소",
          summary: "도메인 숫자가 바뀌면 새 주소를 입력하세요. 비우면 기본 주소를 사용합니다.",
          value: "",
          dialogTitle: "사이트 주소",
          dialogMessage: "예: https://015.bookkor.com",
        },
      },
    ];
  }

  checkResponse(res) {
    const body = String(res.body || "");
    if (/cf-chl-|cf-turnstile|<title>Just a moment/i.test(body))
      throw new Error("WebView에서 사이트 인증을 완료한 후 다시 시도해 주세요.");
    if (res.statusCode < 200 || res.statusCode >= 300)
      throw new Error(`사이트 요청에 실패했습니다 (HTTP ${res.statusCode}).`);
    return body;
  }

  // Inertia 페이지 데이터 가져오기. 버전을 모르면 일반 HTML에서 data-page를 꺼내 버전을 기억합니다.
  async page(path, partial = null) {
    const url = this.baseUrl + path;
    if (this.inertiaVersion) {
      const headers = {
        ...this.getHeaders(),
        Accept: "text/html, application/xhtml+xml",
        "X-Requested-With": "XMLHttpRequest",
        "X-Inertia": "true",
        "X-Inertia-Version": this.inertiaVersion,
      };
      if (partial) {
        headers["X-Inertia-Partial-Component"] = partial.component;
        headers["X-Inertia-Partial-Data"] = partial.props.join(",");
      }
      const res = await this.client.get(url, headers);
      if (res.statusCode !== 409) return this.remember(JSON.parse(this.checkResponse(res)));
      this.inertiaVersion = ""; // 사이트가 업데이트됨 → HTML로 다시
    }
    const res = await this.client.get(url, this.getHeaders());
    const html = this.checkResponse(res);
    const m = /<script[^>]*\bdata-page=[^>]*>([\s\S]*?)<\/script>/i.exec(html) || /\bdata-page="([^"]+)"/.exec(html);
    if (!m) throw new Error("사이트 응답을 읽지 못했습니다. 사이트 구조가 바뀌었을 수 있습니다.");
    const raw = m[1].trim().startsWith("{") ? m[1] : bkDecodeEntities(m[1]);
    return this.remember(JSON.parse(raw));
  }

  remember(data) {
    if (!data || typeof data.props !== "object") throw new Error("사이트 응답을 읽지 못했습니다.");
    if (data.version) this.inertiaVersion = String(data.version);
    return data;
  }

  cover(thumb) {
    const t = String(thumb || "").trim();
    if (!t) return "";
    return /^https?:\/\//i.test(t) ? t : `${this.baseUrl}/storage/${t.replace(/^\/+/, "")}`;
  }

  filterValue(filters, type, def) {
    const f = (filters || []).find((x) => x.type === type);
    if (!f) return def;
    if (f.values) return f.values[f.state]?.value ?? def;
    return f.state ?? def;
  }

  // 앱 한 페이지 = 사이트 2페이지(80개). 큰 화면에서도 스크롤이 생겨 자동으로 다음 페이지를 불러옵니다.
  async listing(page, keyword, filters, sort) {
    const menu = this.filterValue(filters, "menu", "");
    const genres = ((filters || []).find((f) => f.type === "genres")?.state || [])
      .filter((c) => c.state)
      .map((c) => c.value);
    const sitePage = async (p) => {
      const query = bkQuery({
        keyword: String(keyword || "").trim(),
        genres,
        sort: sort || this.filterValue(filters, "sort", "latest"),
        page: String(p),
      });
      const path = (menu ? "/" + encodeURIComponent(menu) : "/") + "?" + query;
      const data = await this.page(path, { component: "contents/Home", props: ["comics"] });
      const comics = data.props.comics;
      if (!Array.isArray(comics?.data)) throw new Error("소설 목록을 찾을 수 없습니다.");
      return comics;
    };

    const first = await sitePage(page * 2 - 1);
    const last = Number(first.last_page) || 1;
    const pages = [first];
    if (page * 2 <= last) pages.push(await sitePage(page * 2));

    const seen = new Set();
    const list = [];
    for (const comics of pages) {
      for (const c of comics.data) {
        if (!c?.slug || seen.has(c.slug)) continue;
        seen.add(c.slug);
        list.push({
          name: String(c.title || "").trim(),
          link: "/" + encodeURIComponent(String(c.slug)),
          imageUrl: this.cover(c.thumbnail),
        });
      }
    }
    const lastFetched = Number(pages[pages.length - 1].current_page) || page * 2;
    return { list, hasNextPage: list.length > 0 && lastFetched < last };
  }

  getPopular(page) {
    return this.listing(page, "", [], "views");
  }

  getLatestUpdates(page) {
    return this.listing(page, "", [], "latest");
  }

  search(query, page, filters) {
    return this.listing(page, query, filters || [], null);
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
      select("menu", "구분", BK_MENUS),
      select("sort", "정렬", BK_SORTS),
      {
        type_name: "GroupFilter",
        type: "genres",
        name: "장르",
        state: BK_GENRES.map((g) => ({ type_name: "CheckBox", name: g, value: g, state: false })),
      },
    ];
  }

  // 링크 → 사이트 경로 ("/작품슬러그" 또는 "/작품슬러그/회차슬러그")
  path(url) {
    let p = String(url || "").trim();
    if (/^https?:\/\//i.test(p)) p = p.replace(/^https?:\/\/[^/]+/i, "");
    p = p.split("#")[0].split("?")[0];
    if (!p.startsWith("/")) p = "/" + p;
    return p
      .split("/")
      .map((seg) => {
        try {
          return encodeURIComponent(decodeURIComponent(seg));
        } catch (e) {
          return encodeURIComponent(seg);
        }
      })
      .join("/");
  }

  async getDetail(url) {
    const path = this.path(url);
    const first = await this.page(path);
    const comic = first.props.comic;
    if (!comic?.title) throw new Error("작품 정보를 찾을 수 없습니다.");
    const workSlug = path.split("/")[1];

    const chapters = new Map();
    const addEpisodes = (list) => {
      for (const raw of list || []) {
        const e = Array.isArray(raw) ? { id: raw[0], title: raw[1], slug: raw[2], published_at: raw[3] } : raw;
        if (!e?.slug || chapters.has(String(e.slug))) continue;
        const t = Date.parse(String(e.published_at || ""));
        chapters.set(String(e.slug), {
          name: String(e.title || "").trim() || `회차 ${e.id}`,
          url: `/${workSlug}/${encodeURIComponent(String(e.slug))}`,
          dateUpload: Number.isFinite(t) ? String(t) : null,
          scanlator: null,
        });
      }
    };

    const props = first.props;
    // ?page 없이 연 첫 화면은 1페이지가 아닐 수 있어서(current: null) 그때는 1페이지부터 다시 받습니다.
    const firstIsPage1 = !Array.isArray(props.episodes) || Number(props.epPages?.current) === 1;
    if (firstIsPage1) addEpisodes(Array.isArray(props.episodes) ? props.episodes : props.episodes?.data);
    const last = Number(Array.isArray(props.episodes) ? props.epPages?.last : props.episodes?.last_page) || 1;
    const partial = { component: String(first.component || "contents/List"), props: ["episodes", "epPages", "episodesTotal"] };

    // 나머지 페이지를 몇 개씩 병렬로 가져옵니다.
    const pages = [];
    for (let p = firstIsPage1 ? 2 : 1; p <= Math.min(last, 300); p++) pages.push(p);
    for (let i = 0; i < pages.length; i += 6) {
      const batch = await Promise.all(pages.slice(i, i + 6).map((p) => this.page(`${path}?page=${p}`, partial)));
      for (const d of batch) {
        const e = d.props.episodes;
        addEpisodes(Array.isArray(e) ? e : e?.data);
      }
    }

    const tags = (comic.tags || [])
      .map((t) => (typeof t.name === "object" ? t.name.ko : t.name))
      .filter(Boolean);
    const genre = [...new Set(tags.length ? tags : String(comic.tags_string || "").split(","))]
      .map((g) => String(g).trim())
      .filter(Boolean);

    return {
      name: String(comic.title).trim(),
      link: path,
      imageUrl: this.cover(comic.thumbnail),
      author: String(comic.author || "").trim(),
      description: String(comic.description || "")
        .replace(/<[^>]+>/g, "")
        .trim(),
      genre,
      status: comic.completed_at ? 1 : 0,
      chapters: [...chapters.values()],
    };
  }

  async getHtmlContent(name, url) {
    const data = await this.page(this.path(url));
    const ep = data.props.episode;
    let html = String(ep?.body?.html || "");
    if (!html && typeof ep?.body === "string") html = ep.body;
    html = html.replace(/<(script|style|iframe)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "").trim();
    if (!html) throw new Error("회차 본문이 비어 있습니다.");
    return `<h2>${bkEscape(ep.title || name || "")}</h2>\n${html}`;
  }

  async cleanHtmlContent(html) {
    return html;
  }
}
