// 망가요미 JS 런타임(MProvider/Client/SharedPreferences)을 흉내 내서 확장을 실제 사이트에 돌려 보는 테스트.
// 사용법: node scripts/test.mjs javascript/marumaru.js [소스 인덱스] [검색어]
import fs from "node:fs";

const [file, idxArg = "0", query = ""] = process.argv.slice(2);
if (!file) {
  console.error("usage: node scripts/test.mjs <extension.js> [sourceIndex] [query]");
  process.exit(1);
}

class Client {
  async request(method, url, headers = {}, body) {
    const res = await fetch(url, { method, headers, body, redirect: "follow" });
    // 망가요미(Dart http)처럼 charset이 없으면 latin1로 디코드 (JSON은 utf-8)
    const ct = res.headers.get("content-type") || "";
    const cs = /charset=([^;]+)/i.exec(ct)?.[1]?.trim().toLowerCase();
    const enc = cs ? (cs === "utf-8" || cs === "utf8" ? "utf-8" : cs) : /json/i.test(ct) ? "utf-8" : "latin1";
    const buf = Buffer.from(await res.arrayBuffer());
    return { statusCode: res.status, body: buf.toString(enc === "utf-8" ? "utf8" : "latin1"), headers: Object.fromEntries(res.headers) };
  }
  get(url, headers) {
    return this.request("GET", url, headers);
  }
  post(url, headers, body) {
    return this.request("POST", url, headers, typeof body === "string" ? body : JSON.stringify(body));
  }
}
class SharedPreferences {
  get() {
    return "";
  }
}
class MProvider {}

const code = fs.readFileSync(file, "utf8");
const factory = new Function(
  "MProvider",
  "Client",
  "SharedPreferences",
  code + "\nreturn { mangayomiSources, DefaultExtension };",
);
const { mangayomiSources, DefaultExtension } = factory(MProvider, Client, SharedPreferences);
const source = mangayomiSources[Number(idxArg)];
const ext = new DefaultExtension();
ext.source = source;

const isNovel = source.itemType === 2;
const show = (label, r) =>
  console.log(`\n[${label}] ${r.list.length}개, 다음 페이지: ${r.hasNextPage}\n  ` +
    r.list.slice(0, 3).map((x) => `${x.name} | ${x.link} | ${x.imageUrl}`).join("\n  "));

console.log(`=== ${source.name} (${isNovel ? "소설" : "만화"}) ===`);
const popular = await ext.getPopular(1);
show("인기", popular);
show("인기 2페이지", await ext.getPopular(2));
show("최신", await ext.getLatestUpdates(1));
const filters = ext.getFilterList();
console.log("\n[필터]", filters.map((f) => f.name).join(", "));
if (query) show(`검색 "${query}"`, await ext.search(query, 1, filters));

const target = query ? (await ext.search(query, 1, filters)).list[0] : popular.list[0];
const detail = await ext.getDetail(target.link);
console.log(`\n[상세] ${detail.name} / 작가: ${detail.author} / 상태: ${detail.status}`);
console.log(`  장르: ${detail.genre.join(", ")}`);
console.log(`  설명: ${detail.description.slice(0, 120).replace(/\n/g, " ")}`);
console.log(`  회차 ${detail.chapters.length}개:`, detail.chapters.slice(0, 2), "...", detail.chapters.slice(-1));

// 가장 오래된 회차(무료일 가능성이 높음)부터 본문 확인
const ch = detail.chapters[detail.chapters.length - 1];
if (isNovel) {
  const html = await ext.getHtmlContent(ch.name, ch.url);
  console.log(`\n[본문] ${html.length}자\n  ${html.slice(0, 300).replace(/\n/g, " ")}`);
} else {
  const pages = await ext.getPageList(ch.url);
  console.log(`\n[이미지] ${pages.length}장`, pages.slice(0, 2));
  const img = await fetch(pages[0].url, { headers: pages[0].headers });
  console.log(`  첫 이미지 HTTP ${img.status}, ${(await img.arrayBuffer()).byteLength} bytes`);
}
console.log("\n테스트 통과 ✔");
