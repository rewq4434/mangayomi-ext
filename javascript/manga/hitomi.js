// Hitomi (hitomi.la) - Tachiyomi/Mihon "Hitomi" 확장을 망가요미 JS로 옮긴 버전
// 목록은 .nozomi(4바이트 big-endian 갤러리 id 배열), 텍스트 검색은 galleriesindex B-tree,
// 이미지 주소는 매번 gg.js를 받아 계산합니다. (사이트 common.js / search.js 로직과 동일)
const mangayomiSources = [
  {
    id: 913575201,
    name: "Hitomi (한국어)",
    lang: "ko",
    baseUrl: "https://hitomi.la",
    apiUrl: "",
    iconUrl: "https://raw.githubusercontent.com/rewq4434/mangayomi-ext/main/icon/hitomi.png",
    typeSource: "single",
    itemType: 0,
    isManga: true,
    isNsfw: true,
    hasCloudflare: false,
    version: "1.0.1",
    dateFormat: "",
    dateFormatLocale: "",
    pkgPath: "javascript/manga/hitomi.js",
    additionalParams: '{"language":"korean"}',
  },
  {
    id: 913575202,
    name: "Hitomi (日本語)",
    lang: "ja",
    baseUrl: "https://hitomi.la",
    apiUrl: "",
    iconUrl: "https://raw.githubusercontent.com/rewq4434/mangayomi-ext/main/icon/hitomi.png",
    typeSource: "single",
    itemType: 0,
    isManga: true,
    isNsfw: true,
    hasCloudflare: false,
    version: "1.0.1",
    dateFormat: "",
    dateFormatLocale: "",
    pkgPath: "javascript/manga/hitomi.js",
    additionalParams: '{"language":"japanese"}',
  },
  {
    id: 913575203,
    name: "Hitomi (English)",
    lang: "en",
    baseUrl: "https://hitomi.la",
    apiUrl: "",
    iconUrl: "https://raw.githubusercontent.com/rewq4434/mangayomi-ext/main/icon/hitomi.png",
    typeSource: "single",
    itemType: 0,
    isManga: true,
    isNsfw: true,
    hasCloudflare: false,
    version: "1.0.1",
    dateFormat: "",
    dateFormatLocale: "",
    pkgPath: "javascript/manga/hitomi.js",
    additionalParams: '{"language":"english"}',
  },
  {
    id: 913575204,
    name: "Hitomi (전체 언어)",
    lang: "all",
    baseUrl: "https://hitomi.la",
    apiUrl: "",
    iconUrl: "https://raw.githubusercontent.com/rewq4434/mangayomi-ext/main/icon/hitomi.png",
    typeSource: "single",
    itemType: 0,
    isManga: true,
    isNsfw: true,
    hasCloudflare: false,
    version: "1.0.1",
    dateFormat: "",
    dateFormatLocale: "",
    pkgPath: "javascript/manga/hitomi.js",
    additionalParams: '{"language":"all"}',
  },
];

const HT_UA =
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";
const HT_DOMAIN2 = "gold-usergeneratedcontent.net";
const HT_LTN = "https://ltn." + HT_DOMAIN2;
const HT_PAGE_SIZE = 25;
const HT_MAX_NODE_SIZE = 464;

const HT_SORTS = [
  ["date:added", "추가일 (Date Added)"],
  ["date:published", "발행일 (Date Published)"],
  ["popular:today", "인기: 오늘"],
  ["popular:week", "인기: 이번 주"],
  ["popular:month", "인기: 이번 달"],
  ["popular:year", "인기: 올해"],
  ["random", "랜덤"],
];
const HT_TYPES = [
  ["doujinshi", "동인지 (Doujinshi)"],
  ["manga", "망가 (Manga)"],
  ["artistcg", "Artist CG"],
  ["gamecg", "Game CG"],
  ["imageset", "Image Set"],
  ["anime", "Anime"],
];
const HT_TEXT_FILTERS = [
  ["female", "여성 태그 (female)"],
  ["male", "남성 태그 (male)"],
  ["tag", "일반 태그 (female/male 태그는 위 칸에)"],
  ["artist", "작가 (artist)"],
  ["group", "그룹 (group)"],
  ["series", "시리즈 (series)"],
  ["character", "캐릭터 (character)"],
];
const HT_TYPE_NAMES = {
  doujinshi: "동인지",
  manga: "망가",
  artistcg: "Artist CG",
  gamecg: "Game CG",
  imageset: "Image Set",
  anime: "Anime",
};

// ---------- 바이너리 도우미 ----------
// 망가요미 HTTP 브리지는 charset 없는 응답(.nozomi, .index, .data)을 latin1로 디코드하므로
// 문자 코드 하나가 곧 바이트 하나입니다.
function htBytes(str) {
  const s = String(str || "");
  const out = new Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}
function htInt32(b, p) {
  return ((b[p] << 24) | (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3]) | 0;
}
function htUint64(b, p) {
  return (htInt32(b, p) >>> 0) * 4294967296 + (htInt32(b, p + 4) >>> 0);
}
function htIds(bytes) {
  const ids = [];
  for (let p = 0; p + 4 <= bytes.length; p += 4) ids.push(htInt32(bytes, p));
  return ids;
}

// 문자열의 SHA-256 앞 4바이트 (사이트 hash_term과 동일)
function htSha256(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c >= 0xd800 && c < 0xdc00 && i + 1 < str.length) c = 0x10000 + ((c - 0xd800) << 10) + (str.charCodeAt(++i) - 0xdc00);
    if (c < 0x80) bytes.push(c);
    else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98,
    0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8,
    0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
    0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
    0xc67178f2,
  ];
  let H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const hi = Math.floor(bitLen / 4294967296);
  for (const v of [hi, bitLen >>> 0]) bytes.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  const W = new Array(64);
  for (let off = 0; off < bytes.length; off += 64) {
    for (let i = 0; i < 16; i++) W[i] = htInt32(bytes, off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    H = [a, b, c, d, e, f, g, h].map((v, i) => (H[i] + v) | 0);
  }
  const out = [];
  for (const v of H) out.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255);
  return out;
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

  get language() {
    return this.params.language || "all";
  }

  get supportsLatest() {
    return true;
  }

  get client() {
    return this._client || (this._client = new Client());
  }

  getHeaders(url) {
    return { "User-Agent": HT_UA, Referer: "https://hitomi.la/" };
  }

  async get(url, range = null) {
    // Range 요청에 gzip을 허용하면 서버가 "압축된 파일의 일부"를 보내서
    // 망가요미(Dart)가 압축 해제에 실패합니다 (FormatException: Filter error, bad data).
    const headers = { ...this.getHeaders(), "Accept-Encoding": "identity" };
    if (range) headers.Range = `bytes=${range[0]}-${range[1]}`;
    let last = null;
    for (let i = 0; i < 3; i++) {
      try {
        const res = await this.client.get(url, headers);
        if (res.statusCode === 200 || res.statusCode === 206) return res;
        if (res.statusCode === 404 || res.statusCode === 416) return null;
        last = new Error(`Hitomi 요청 실패 (HTTP ${res.statusCode})`);
      } catch (e) {
        last = e;
      }
    }
    throw last;
  }

  // ---------- 목록 (.nozomi) ----------
  nozomiUrl(state) {
    const lang = state.language;
    if (state.orderby !== "date" || state.orderbykey === "published") {
      if (state.area === "all") return `${HT_LTN}/n/${state.orderby}/${state.orderbykey}-${lang}.nozomi`;
      return `${HT_LTN}/n/${state.area}/${state.orderby}/${state.orderbykey}/${encodeURIComponent(state.tag)}-${lang}.nozomi`;
    }
    if (state.area === "all") return `${HT_LTN}/n/${state.tag}-${lang}.nozomi`;
    return `${HT_LTN}/n/${state.area}/${encodeURIComponent(state.tag)}-${lang}.nozomi`;
  }

  async nozomi(state, range = null) {
    const res = await this.get(this.nozomiUrl(state), range);
    if (!res) return { ids: [], total: 0 };
    const ids = htIds(htBytes(res.body));
    const cr = /\/(\d+)/.exec(String(res.headers?.["content-range"] || res.headers?.["Content-Range"] || ""));
    return { ids, total: cr ? Number(cr[1]) / 4 : null };
  }

  baseState(sort) {
    const state = { area: "all", tag: "index", language: this.language, orderby: "date", orderbykey: "added", random: false };
    if (sort === "random") state.random = true;
    else if (sort) {
      const [orderby, key] = sort.split(":");
      state.orderby = orderby;
      state.orderbykey = key;
    }
    return state;
  }

  // 검색 없이 목록: Range 요청으로 필요한 25개만 받습니다.
  async pagedList(page, sort) {
    const start = (page - 1) * HT_PAGE_SIZE * 4;
    const { ids, total } = await this.nozomi(this.baseState(sort), [start, start + HT_PAGE_SIZE * 4 - 1]);
    const hasNext = total != null ? start + ids.length * 4 < total * 4 : ids.length >= HT_PAGE_SIZE;
    return { list: await this.galleries(ids), hasNextPage: ids.length > 0 && hasNext };
  }

  getPopular(page) {
    return this.pagedList(page, "popular:week");
  }

  getLatestUpdates(page) {
    return this.pagedList(page, "date:added");
  }

  // ---------- 텍스트 검색 (galleriesindex B-tree) ----------
  async indexVersion() {
    if (this._indexVersion && Date.now() - this._indexVersionAt < 10 * 60 * 1000) return this._indexVersion;
    const res = await this.get(`${HT_LTN}/galleriesindex/version?_=${Date.now()}`);
    this._indexVersion = String(res.body).trim();
    this._indexVersionAt = Date.now();
    return this._indexVersion;
  }

  async node(version, address) {
    const res = await this.get(`${HT_LTN}/galleriesindex/galleries.${version}.index`, [
      address,
      address + HT_MAX_NODE_SIZE - 1,
    ]);
    if (!res) return null;
    const b = htBytes(res.body);
    let p = 0;
    const node = { keys: [], datas: [], subs: [] };
    const nKeys = htInt32(b, p);
    p += 4;
    for (let i = 0; i < nKeys; i++) {
      const size = htInt32(b, p);
      if (!size || size > 32) return null;
      p += 4;
      node.keys.push(b.slice(p, p + size));
      p += size;
    }
    const nDatas = htInt32(b, p);
    p += 4;
    for (let i = 0; i < nDatas; i++) {
      node.datas.push([htUint64(b, p), htInt32(b, p + 8)]);
      p += 12;
    }
    for (let i = 0; i < 17; i++) {
      node.subs.push(htUint64(b, p));
      p += 8;
    }
    return node;
  }

  async textSearch(term) {
    const version = await this.indexVersion();
    const key = htSha256(term).slice(0, 4);
    const cmp = (a, b) => {
      for (let i = 0; i < Math.min(a.length, b.length); i++) {
        if (a[i] < b[i]) return -1;
        if (a[i] > b[i]) return 1;
      }
      return 0;
    };
    let node = await this.node(version, 0);
    for (let depth = 0; node && node.keys.length && depth < 20; depth++) {
      let i = 0;
      let c = -1;
      for (; i < node.keys.length; i++) {
        c = cmp(key, node.keys[i]);
        if (c <= 0) break;
      }
      if (c === 0) {
        const [offset, length] = node.datas[i];
        if (length <= 0 || length > 100000000) return [];
        const res = await this.get(`${HT_LTN}/galleriesindex/galleries.${version}.data`, [offset, offset + length - 1]);
        if (!res) return [];
        const b = htBytes(res.body);
        const n = htInt32(b, 0);
        if (n <= 0 || b.length !== n * 4 + 4) return [];
        return htIds(b.slice(4));
      }
      if (node.subs.every((x) => !x) || !node.subs[i]) return [];
      node = await this.node(version, node.subs[i]);
    }
    return [];
  }

  // 사이트 get_galleryids_for_query와 동일
  async idsForTerm(term, state) {
    term = term.replace(/_/g, " ");
    if (term.includes(":")) {
      const idx = term.indexOf(":");
      const left = term.slice(0, idx);
      const right = term.slice(idx + 1);
      const s = { ...state };
      if (left === "female" || left === "male") {
        s.area = "tag";
        s.tag = term;
      } else if (left === "language") {
        s.language = right;
      } else {
        s.area = left;
        s.tag = right;
      }
      return (await this.nozomi(s)).ids;
    }
    return this.textSearch(term);
  }

  async searchIds(query, state) {
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const positive = [];
    const negative = [];
    for (const t of terms) {
      if (t.startsWith("-") && t.length > 1) negative.push(t.slice(1));
      else positive.push(t);
    }
    if (state.language !== "all" && !positive.some((t) => t.startsWith("language:"))) {
      positive.push("language:" + state.language);
    }
    positive.sort((a, b) => (a.includes(":") === b.includes(":") ? 0 : a.includes(":") ? -1 : 1));

    let results;
    if (!positive.length || (!positive[0].includes(":") && state.orderbykey !== "added")) {
      results = (await this.nozomi(state)).ids;
    } else {
      results = await this.idsForTerm(positive.shift(), state);
    }
    const pos = await Promise.all(positive.map((t) => this.idsForTerm(t, state)));
    for (const ids of pos) {
      const set = new Set(ids);
      results = results.filter((id) => set.has(id));
    }
    const neg = await Promise.all(negative.map((t) => this.idsForTerm(t, state)));
    for (const ids of neg) {
      const set = new Set(ids);
      results = results.filter((id) => !set.has(id));
    }
    if (state.random) {
      for (let i = results.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [results[i], results[j]] = [results[j], results[i]];
      }
    }
    return results;
  }

  filterValue(filters, type, def) {
    const f = (filters || []).find((x) => x.type === type);
    if (!f) return def;
    if (f.values) return f.values[f.state]?.value ?? def;
    return f.state ?? def;
  }

  buildQuery(query, filters) {
    const terms = [];
    const text = String(query || "").trim();
    if (text) terms.push(text);
    const types = ((filters || []).find((f) => f.type === "types")?.state || []).filter((c) => c.state);
    if (types.length === 1) terms.push("type:" + types[0].value);
    for (const [area] of HT_TEXT_FILTERS) {
      const v = String(this.filterValue(filters, area, "") || "");
      for (let item of v.split(",")) {
        item = item.trim().toLowerCase();
        if (!item) continue;
        const neg = item.startsWith("-");
        if (neg) item = item.slice(1).trim();
        if (!item) continue;
        terms.push((neg ? "-" : "") + area + ":" + item.replace(/\s+/g, "_"));
      }
    }
    return { q: terms.join(" "), types: types.map((t) => t.value) };
  }

  async search(query, page, filters) {
    const text = String(query || "").trim();
    // 갤러리 번호나 주소를 입력하면 그 작품을 바로 보여줍니다.
    const idMatch = /^(?:https?:\/\/hitomi\.la\/.*?)?(\d{3,})(?:\.html)?$/.exec(text);
    if (idMatch && page === 1) {
      const one = await this.galleries([Number(idMatch[1])]);
      if (one.length) return { list: one, hasNextPage: false };
    }

    const sort = this.filterValue(filters, "sort", "date:added");
    const { q, types } = this.buildQuery(text, filters);
    if (!q && types.length === 0 && sort !== "random") return this.pagedList(page, sort);

    const cacheKey = `${this.language}|${sort}|${q}|${types.join(",")}`;
    if (page === 1 || this._searchKey !== cacheKey) {
      const state = this.baseState(sort);
      let ids = await this.searchIds(q, state);
      if (types.length > 1) {
        // 종류를 여러 개 고른 경우: 각 종류 결과의 합집합으로 거릅니다.
        const allowed = new Set();
        for (const t of types) (await this.idsForTerm("type:" + t, state)).forEach((id) => allowed.add(id));
        ids = ids.filter((id) => allowed.has(id));
      }
      this._searchKey = cacheKey;
      this._searchIds = ids;
    }
    const ids = this._searchIds.slice((page - 1) * HT_PAGE_SIZE, page * HT_PAGE_SIZE);
    return {
      list: await this.galleries(ids),
      hasNextPage: page * HT_PAGE_SIZE < this._searchIds.length,
    };
  }

  getFilterList() {
    return [
      {
        type_name: "SelectFilter",
        type: "sort",
        name: "정렬",
        state: 0,
        values: HT_SORTS.map(([value, name]) => ({ type_name: "SelectOption", name, value })),
      },
      {
        type_name: "GroupFilter",
        type: "types",
        name: "종류",
        state: HT_TYPES.map(([value, name]) => ({ type_name: "CheckBox", name, value, state: false })),
      },
      { type_name: "HeaderFilter", name: "태그는 쉼표(,)로 구분, 앞에 -를 붙이면 제외 (영어로 입력)" },
      ...HT_TEXT_FILTERS.map(([type, name]) => ({ type_name: "TextFilter", type, name, state: "" })),
    ];
  }

  // ---------- 갤러리 정보 ----------
  async galleryInfo(id) {
    const res = await this.get(`${HT_LTN}/galleries/${id}.js`);
    if (!res) return null;
    const body = String(res.body);
    const start = body.indexOf("{");
    if (start < 0) return null;
    return JSON.parse(body.slice(start));
  }

  async galleries(ids) {
    const gg = await this.gg();
    const infos = await Promise.all(ids.map((id) => this.galleryInfo(id).catch(() => null)));
    return infos
      .filter((g) => g && g.id)
      .map((g) => ({
        name: String(g.title || "").trim(),
        link: "/galleries/" + g.id + ".html",
        imageUrl: g.files?.length ? this.thumbUrl(gg, g.files[0]) : "",
      }));
  }

  galleryId(url) {
    const m = /(\d+)(?:\.html|\.js)?(?:[?#].*)?$/.exec(String(url));
    if (!m) throw new Error("올바른 Hitomi 갤러리 주소가 아닙니다.");
    return m[1];
  }

  parseDate(s) {
    const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)(?:\.\d+)?([+-]\d{2})(?::?(\d{2}))?/.exec(String(s || ""));
    if (!m) return null;
    const t = Date.parse(`${m[1]}T${m[2]}${m[3]}:${m[4] || "00"}`);
    return Number.isFinite(t) ? String(t) : null;
  }

  async getDetail(url) {
    const id = this.galleryId(url);
    const [g, gg] = await Promise.all([this.galleryInfo(id), this.gg()]);
    if (!g) throw new Error("갤러리 정보를 찾을 수 없습니다. 삭제된 작품일 수 있습니다.");

    const names = (arr, key) => (arr || []).map((x) => x[key]).filter(Boolean);
    const artists = names(g.artists, "artist");
    const groups = names(g.groups, "group");
    const series = names(g.parodys, "parody");
    const characters = names(g.characters, "character");
    const tags = (g.tags || []).map((t) =>
      t.female === "1" || t.female === 1 ? `${t.tag} ♀` : t.male === "1" || t.male === 1 ? `${t.tag} ♂` : t.tag,
    );

    const lines = [];
    if (g.japanese_title) lines.push(`일본어 제목: ${g.japanese_title}`);
    if (series.length) lines.push(`시리즈: ${series.join(", ")}`);
    if (characters.length) lines.push(`캐릭터: ${characters.join(", ")}`);
    lines.push(`종류: ${HT_TYPE_NAMES[g.type] || g.type || "-"}`);
    if (g.language_localname || g.language) lines.push(`언어: ${g.language_localname || g.language}`);
    lines.push(`페이지: ${(g.files || []).length}`);
    lines.push(`갤러리 번호: ${g.id}`);

    return {
      name: String(g.title || "").trim(),
      link: `/galleries/${g.id}.html`,
      imageUrl: g.files?.length ? this.thumbUrl(gg, g.files[0]) : "",
      author: (artists.length ? artists : groups).join(", "),
      artist: artists.join(", "),
      description: lines.join("\n"),
      genre: tags,
      status: 1,
      chapters: [
        {
          name: "Chapter",
          url: `/galleries/${g.id}.html`,
          dateUpload: this.parseDate(g.datepublished || g.date),
          scanlator: groups.join(", ") || null,
        },
      ],
    };
  }

  // ---------- 이미지 주소 (gg.js) ----------
  async gg() {
    if (this._gg && Date.now() - this._ggAt < 60 * 1000) return this._gg;
    const res = await this.get(`${HT_LTN}/gg.js?_=${Date.now()}`);
    const code = String(res?.body || "");
    const def = /var o = (\d+)/.exec(code);
    const b = /b: '([^']+)'/.exec(code);
    if (!def || !b) throw new Error("이미지 서버 정보(gg.js)를 읽지 못했습니다. 사이트가 바뀌었을 수 있습니다.");
    const map = {};
    const re = /((?:case\s+\d+:\s*)+)o\s*=\s*(\d+);?\s*break;/g;
    let m;
    while ((m = re.exec(code))) {
      const val = Number(m[2]);
      for (const c of m[1].match(/\d+/g)) map[c] = val;
    }
    this._gg = { def: Number(def[1]), map, b: b[1] };
    this._ggAt = Date.now();
    return this._gg;
  }

  ggM(gg, g) {
    return g in gg.map ? gg.map[g] : gg.def;
  }

  ggS(hash) {
    const m = /(..)(.)$/.exec(hash);
    return parseInt(m[2] + m[1], 16);
  }

  imageUrl(gg, file) {
    const g = this.ggS(file.hash);
    return `https://w${1 + this.ggM(gg, g)}.${HT_DOMAIN2}/${gg.b}${g}/${file.hash}.webp`;
  }

  thumbUrl(gg, file) {
    const h = file.hash;
    const g = this.ggS(h);
    const sub = String.fromCharCode(97 + this.ggM(gg, g)) + "tn";
    return `https://${sub}.${HT_DOMAIN2}/webpbigtn/${h.slice(-1)}/${h.slice(-3, -1)}/${h}.webp`;
  }

  async getPageList(url) {
    const id = this.galleryId(url);
    const [g, gg] = await Promise.all([this.galleryInfo(id), this.gg()]);
    if (!g?.files?.length) throw new Error("이미지를 찾을 수 없습니다.");
    const headers = { ...this.getHeaders(), Referer: `https://hitomi.la/reader/${id}.html` };
    return g.files.map((f) => ({ url: this.imageUrl(gg, f), headers }));
  }

  getSourcePreferences() {
    return [];
  }
}
