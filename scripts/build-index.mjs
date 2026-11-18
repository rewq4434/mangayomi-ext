// javascript/ 아래 확장 파일의 mangayomiSources를 모아 index.json을 만듭니다.
// 사용법: node scripts/build-index.mjs
import fs from "node:fs";
import path from "node:path";

const REPO_RAW = "https://raw.githubusercontent.com/rewq4434/mangayomi-ext/main";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

const files = [];
(function walk(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p);
    else if (f.name.endsWith(".js")) files.push(p);
  }
})(path.join(root, "javascript"));

const index = [];
for (const file of files.sort()) {
  const code = fs.readFileSync(file, "utf8");
  const sources = new Function("MProvider", code + "\nreturn mangayomiSources;")(class {});
  const rel = path.relative(root, file).split(path.sep).join("/");
  for (const s of sources) {
    const itemType = s.itemType ?? 0;
    index.push({
      itemType,
      isManga: itemType === 0,
      typeSource: s.typeSource || "single",
      sourceCodeLanguage: 1, // 1 = JavaScript
      appMinVerReq: "0.5.0",
      hasCloudflare: !!s.hasCloudflare,
      isFullData: false,
      dateFormat: s.dateFormat || "",
      dateFormatLocale: s.dateFormatLocale || "",
      id: s.id,
      name: s.name,
      lang: s.lang,
      baseUrl: s.baseUrl,
      apiUrl: s.apiUrl || "",
      version: s.version,
      isNsfw: !!s.isNsfw,
      ...(s.additionalParams ? { additionalParams: s.additionalParams } : {}),
      sourceCodeUrl: `${REPO_RAW}/${rel}`,
      iconUrl: s.iconUrl,
    });
  }
}

const ids = index.map((s) => s.id);
if (new Set(ids).size !== ids.length) throw new Error("중복된 소스 id가 있습니다.");
fs.writeFileSync(path.join(root, "index.json"), JSON.stringify(index, null, 2) + "\n");
console.log(`index.json: ${index.length}개 소스`);
for (const s of index) console.log(`  - ${s.name} v${s.version} (${["만화", "애니", "소설"][s.itemType]})`);
