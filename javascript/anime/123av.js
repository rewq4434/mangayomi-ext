const mangayomiSources = [{
    "id": 480939976,
    "name": "123AV",
    "lang": "ko",
    "baseUrl": "https://123av.com",
    "apiUrl": "",
    "iconUrl": "https://123av.com/assets/123av/logo-square.png",
    "typeSource": "single",
    "itemType": 1,
    "isNsfw": true,
    "version": "0.0.1",
    "dateFormat": "",
    "dateFormatLocale": "",
    "pkgPath": "javascript/anime/123av.js"
}];

const UA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
const LANG = "ko";

const CATEGORIES = [
    ["신규", "new"],
    ["최근 추가", "recent"],
    ["인기", "hot"],
    ["유검열", "censored"],
    ["무검열", "uncensored"],
    ["무검열 유출", "uncensored-leaked"]
];

const SORTS = [
    ["기본", ""],
    ["출시일", "release_date"],
    ["최근 추가", "recent"],
    ["인기", "hot"],
    ["오늘 조회수", "today"],
    ["주간 조회수", "week"],
    ["월간 조회수", "month"],
    ["가장 많이 본", "views"],
    ["팔로워 많은 순", "follows"],
    ["최장", "longest"]
];

const GENRES = [
    ["전체", ""],
    ["솔로워크", "solowork"], ["크림파이", "creampie"], ["큰 가슴", "big-tits"],
    ["기혼 여성/주부", "married-womanhousewife"], ["아마추어", "amateur"], ["하이비전", "high-vision"],
    ["구강 성교", "e22f5b4c15"], ["아름다운 소녀", "beautiful-girl"], ["아름다운 가슴", "beautiful-breasts"],
    ["날씬한", "slender"], ["하메하", "gonzo"], ["3인/4인", "threesome-foursome"], ["사정", "squirting"],
    ["NTR", "cuckold-cuckolded-ntr"], ["독점", "exclusive"], ["4시간 이상", "over-4-hours"],
    ["파이즈리", "paizuri"], ["카우걸", "cowgirl"], ["수영복", "competitive-swimmingschool-swimwear"],
    ["하드코어", "lewdhard"], ["안면사정", "facial"], ["파이판", "shaved-pussy"], ["드라마", "drama"],
    ["여학생", "schoolgirl"], ["언니", "older-sister"], ["핸드잡", "handjob"], ["큰 엉덩이", "big-ass"],
    ["기획", "planning"], ["자위", "masturbation"], ["불륜", "adultery"], ["망상족", "mousozoku"],
    ["헌팅", "nampa"], ["커닐링구스", "cunnilingus"], ["다큐멘터리", "documentary"], ["근친", "incest"],
    ["코스프레", "7889ef8307"], ["굴욕", "humiliation"], ["성인용품", "sex-toys"], ["대학생", "female-college-student"],
    ["이라마치오", "deep-throat"], ["OL", "ol"], ["제복", "uniform"], ["갸루", "gal"], ["난교", "orgy"],
    ["관음", "voyeurismpeeping"], ["키스", "kisskiss"], ["애널", "anal"], ["데뷔작", "debut-work"],
    ["아이돌/연예인", "idolcelebrity"], ["각선미", "beautiful-legs"], ["베스트/컴필레이션", "bestcompilation"],
    ["빈유", "small-breaststiny-breasts"], ["로션/오일", "lotion"], ["부카케", "bukkake"], ["어머니", "mother"],
    ["마사지", "massage-reflex"], ["전마", "electric-machine"], ["주관", "subjectivity"],
    ["팬티스타킹", "pantyhosetights"], ["레즈비언", "f0f0e4571c"], ["교복", "school-uniform"]
];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client();
    }

    // ---------- 설정 ----------

    getPreference(key) {
        return new SharedPreferences().get(key);
    }

    getBaseUrl() {
        let url = "";
        try {
            url = this.getPreference("123av_domain") || "";
        } catch (e) {
            url = "";
        }
        url = String(url).trim();
        if (!url) url = mangayomiSources[0].baseUrl;
        if (!/^https?:\/\//i.test(url)) url = "https://" + url;
        return url.replace(/\/+$/, "");
    }

    getHeaders(url) {
        return {
            "User-Agent": UA,
            "Referer": this.getBaseUrl() + "/"
        };
    }

    absUrl(path) {
        if (!path) return "";
        if (/^https?:\/\//i.test(path)) return path;
        if (path.startsWith("//")) return "https:" + path;
        return this.getBaseUrl() + (path.startsWith("/") ? "" : "/") + path;
    }

    async request(url, headers) {
        const res = await this.client.get(url, headers || this.getHeaders(url));
        if (res.statusCode && res.statusCode >= 400) {
            throw new Error("HTTP " + res.statusCode + " : " + url);
        }
        return res.body;
    }

    // ---------- 목록 ----------

    parseList(html) {
        const doc = new Document(html);
        const list = [];
        const seen = {};
        for (const card of doc.select("div.card")) {
            const a = card.selectFirst("a.card__cover") || card.selectFirst("a[href*='/v/']");
            if (!a) continue;
            let link = a.attr("href");
            if (!link) continue;
            link = link.replace(/^https?:\/\/[^/]+/i, "");
            if (seen[link]) continue;
            seen[link] = true;
            const t = card.selectFirst(".card__title a") || card.selectFirst(".card__title");
            const img = card.selectFirst("img.card__img") || card.selectFirst("img");
            let name = t ? t.text.trim() : link.split("/").pop();
            list.push({
                name: name,
                imageUrl: img ? this.absUrl(img.attr("src") || img.attr("data-src")) : "",
                link: link
            });
        }
        const hasNextPage = doc.selectFirst("a[rel=next]") != null;
        return { list: list, hasNextPage: hasNextPage };
    }

    async listPage(path, page, sort) {
        let url = this.getBaseUrl() + "/" + LANG + "/" + path;
        const q = [];
        if (sort) q.push("sort=" + encodeURIComponent(sort));
        q.push("page=" + page);
        url += (url.includes("?") ? "&" : "?") + q.join("&");
        return this.parseList(await this.request(url));
    }

    async getPopular(page) {
        return await this.listPage("hot", page, "");
    }

    get supportsLatest() {
        return true;
    }

    async getLatestUpdates(page) {
        return await this.listPage("new", page, "");
    }

    filterValue(filters, type, fallback) {
        if (!filters) return fallback;
        for (const f of filters) {
            if (f && f.type === type && f.values && f.values.length) {
                const idx = typeof f.state === "number" ? f.state : 0;
                const v = f.values[idx] || f.values[0];
                return v ? v.value : fallback;
            }
        }
        return fallback;
    }

    async search(query, page, filters) {
        const sort = this.filterValue(filters, "sort", "");
        query = (query || "").trim();
        if (query) {
            let url = this.getBaseUrl() + "/" + LANG + "/search?keyword=" + encodeURIComponent(query);
            if (sort) url += "&sort=" + encodeURIComponent(sort);
            url += "&page=" + page;
            return this.parseList(await this.request(url));
        }
        const genre = this.filterValue(filters, "genre", "");
        if (genre) return await this.listPage("genres/" + genre, page, sort);
        const category = this.filterValue(filters, "category", "new");
        return await this.listPage(category, page, sort);
    }

    // ---------- 상세 ----------

    decodeEntities(s) {
        return s.replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
            .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
    }

    // JS 문자열 리터럴('...') 안의 이스케이프를 풀어서 원래 문자열로 만든다.
    unescapeJs(s) {
        let out = "";
        for (let i = 0; i < s.length; i++) {
            const c = s[i];
            if (c !== "\\" || i + 1 >= s.length) { out += c; continue; }
            const n = s[++i];
            if (n === "u" && /^[0-9a-fA-F]{4}$/.test(s.substr(i + 1, 4))) {
                out += String.fromCharCode(parseInt(s.substr(i + 1, 4), 16)); i += 4;
            } else if (n === "x" && /^[0-9a-fA-F]{2}$/.test(s.substr(i + 1, 2))) {
                out += String.fromCharCode(parseInt(s.substr(i + 1, 2), 16)); i += 2;
            } else if (n === "n") out += "\n";
            else if (n === "r") out += "\r";
            else if (n === "t") out += "\t";
            else out += n;
        }
        return out;
    }

    // 영상 페이지의 x-data="player(JSON.parse('[...]'), ...)" 에서 에피소드(재생 소스) 목록을 꺼낸다.
    parsePlayer(html) {
        const m = html.match(/player\(\s*JSON\.parse\('((?:[^'\\]|\\.)*)'\)/);
        if (!m) return [];
        try {
            const json = this.unescapeJs(this.decodeEntities(m[1]));
            const arr = JSON.parse(json);
            return Array.isArray(arr) ? arr : [];
        } catch (e) {
            return [];
        }
    }

    infoRows(doc) {
        const rows = {};
        for (const row of doc.select("div.watch__info-row")) {
            const dt = row.selectFirst("dt");
            const dd = row.selectFirst("dd");
            if (!dt || !dd) continue;
            const chips = dd.select("a");
            const vals = chips.length ? chips.map((a) => a.text.trim()).filter((x) => x) : [dd.text.trim()];
            rows[dt.text.trim()] = vals;
        }
        return rows;
    }

    async getDetail(url) {
        const path = url.replace(/^https?:\/\/[^/]+/i, "").split("#")[0];
        const html = await this.request(this.absUrl(path));
        const doc = new Document(html);
        const h1 = doc.selectFirst("h1.watch__title") || doc.selectFirst("h1");
        const name = h1 ? h1.text.trim() : path.split("/").pop();

        let imageUrl = "";
        const bg = html.match(/class="player"[^>]*style="background-image:url\('([^']+)'\)/);
        if (bg) imageUrl = this.decodeEntities(bg[1]);
        else {
            const og = doc.selectFirst("meta[property='og:image']");
            if (og) imageUrl = og.attr("content");
        }

        const rows = this.infoRows(doc);
        const genre = [];
        for (const k of ["유형", "장르", "태그"]) {
            for (const v of rows[k] || []) if (genre.indexOf(v) < 0) genre.push(v);
        }
        const lines = [];
        for (const k in rows) {
            if (k === "장르" || k === "태그") continue;
            lines.push(k + ": " + rows[k].join(", "));
        }
        const author = (rows["출연진"] || rows["여배우"] || rows["배우"] || []).join(", ");
        const artist = (rows["제작사"] || []).join(", ");

        let dateUpload = "";
        const rd = (rows["출시일"] || [])[0];
        if (rd && /^\d{4}-\d{2}-\d{2}$/.test(rd)) dateUpload = String(new Date(rd + "T00:00:00+09:00").getTime());

        const sources = this.parsePlayer(html);
        const episodes = [];
        if (sources.length <= 1) {
            episodes.push({ name: name.split(" — ")[0] || "재생", url: path + "#ep=" + (sources[0] ? sources[0].number : 1), dateUpload: dateUpload });
        } else {
            for (let i = sources.length - 1; i >= 0; i--) {
                const s = sources[i];
                episodes.push({ name: "파트 " + (s.name || s.number), url: path + "#ep=" + s.number, dateUpload: dateUpload });
            }
        }

        return {
            name: name,
            imageUrl: imageUrl,
            description: lines.join("\n"),
            author: author,
            artist: artist,
            genre: genre,
            status: 1,
            link: path,
            episodes: episodes
        };
    }

    // ---------- 재생 ----------

    async getVideoList(url) {
        const parts = url.split("#");
        const path = parts[0].replace(/^https?:\/\/[^/]+/i, "");
        const epMatch = (parts[1] || "").match(/ep=(\d+)/);
        const epNum = epMatch ? parseInt(epMatch[1]) : 1;

        const html = await this.request(this.absUrl(path));
        const sources = this.parsePlayer(html);
        if (!sources.length) throw new Error("재생 가능한 소스가 없습니다.");
        let src = sources.find((s) => Number(s.number) === epNum) || sources[0];

        const embed = src.url;
        const em = embed.match(/^(https?:\/\/[^/]+)\/e\/([a-z0-9_]+)/i);
        if (!em) throw new Error("지원하지 않는 플레이어입니다: " + embed);
        const origin = em[1];
        const id = em[2];
        let qs = "";
        const qi = embed.indexOf("?");
        if (qi >= 0) qs = "&" + embed.substring(qi + 1);

        const res = await this.client.get(origin + "/stream?id=" + id + qs, {
            "User-Agent": UA,
            "Referer": embed,
            "Accept": "application/json"
        });
        let data;
        try {
            data = JSON.parse(res.body);
        } catch (e) {
            throw new Error("영상 정보를 해석하지 못했습니다.");
        }
        const stream = data && data.media && data.media.stream;
        if (!stream) throw new Error("영상 주소를 찾지 못했습니다.");

        const headers = {
            "User-Agent": UA,
            "Referer": origin + "/",
            "Origin": origin
        };
        const videos = [{ url: stream, originalUrl: stream, quality: "자동 (HLS)", headers: headers }];

        // 마스터 m3u8이면 화질별 목록도 추가
        try {
            const m3u = (await this.client.get(stream, headers)).body || "";
            if (m3u.indexOf("#EXT-X-STREAM-INF") >= 0) {
                const base = stream.substring(0, stream.lastIndexOf("/") + 1);
                const lines = m3u.split("\n");
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line.startsWith("#EXT-X-STREAM-INF")) continue;
                    let next = (lines[i + 1] || "").trim();
                    if (!next || next.startsWith("#")) continue;
                    const res = line.match(/RESOLUTION=\d+x(\d+)/);
                    const q = res ? res[1] + "p" : "HLS";
                    const u = /^https?:\/\//i.test(next) ? next : base + next;
                    videos.push({ url: u, originalUrl: u, quality: q, headers: headers });
                }
            }
        } catch (e) { }

        return videos;
    }

    // ---------- 필터 / 설정 ----------

    getFilterList() {
        const opt = (arr) => arr.map((x) => ({ type_name: "SelectOption", name: x[0], value: x[1] }));
        return [
            { type_name: "HeaderFilter", name: "검색어가 있으면 정렬만 적용됩니다. 장르를 고르면 카테고리보다 우선합니다." },
            { type_name: "SelectFilter", type: "category", name: "카테고리", state: 0, values: opt(CATEGORIES) },
            { type_name: "SelectFilter", type: "genre", name: "장르", state: 0, values: opt(GENRES) },
            { type_name: "SelectFilter", type: "sort", name: "정렬", state: 0, values: opt(SORTS) }
        ];
    }

    getSourcePreferences() {
        return [{
            key: "123av_domain",
            editTextPreference: {
                title: "사이트 주소",
                summary: "주소가 바뀌면 여기에 새 주소를 입력하세요 (기본: https://123av.com)",
                value: "https://123av.com",
                dialogTitle: "사이트 주소",
                dialogMessage: "예: https://123av.com"
            }
        }];
    }
}
