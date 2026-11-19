# 나만의 망가요미 확장 저장소

[Mangayomi](https://github.com/kodjodevf/mangayomi)에서 쓰는 한국어 사이트 확장 모음이에요.

## 저장소 추가 방법

망가요미에서 **더보기 → 설정 → 브라우저(확장 프로그램) → 저장소 추가**를 열고, 아래 주소를 넣으면 돼요.

```
https://raw.githubusercontent.com/rewq4434/mangayomi-ext/main/index.json
```

만화 확장과 소설 확장은 앱에서 **탭이 따로** 있어요. 만화 탭과 소설 탭 양쪽에 같은 주소를 넣으면 각 탭에 맞는 확장이 보여요.

## 포함된 확장

| 이름 | 종류 | 사이트 | 파일 |
|---|---|---|---|
| 마루마루 웹툰 | 만화 | marumaru111.com | `javascript/marumaru.js` |
| 마루마루 만화 | 만화 | marumaru111.com | `javascript/marumaru.js` |
| 마루마루 소설 | 소설 | marumaru111.com | `javascript/marumaru.js` |
| 북코 소설 | 소설 | 015.bookkor.com | `javascript/novel/bookkor.js` |
| Hitomi (한국어 / 日本語 / English / 전체 언어) | 만화 | hitomi.la | `javascript/manga/hitomi.js` |

- 사이트 도메인 숫자가 바뀌면(예: marumaru112) 확장 설정 → **사이트 주소**에 새 주소를 넣으면 돼요.
- Hitomi는 Tachiyomi/Mihon Hitomi 확장을 옮긴 거예요. 검색창에 hitomi 검색 문법(`female:big_breasts -netorare`)이나 갤러리 번호, 주소를 넣을 수 있어요. 필터에서 정렬, 종류, 태그, 작가, 그룹, 시리즈, 캐릭터를 고를 수 있어요.
- 마루마루의 포인트 구매 회차는 열리지 않아요. 이때는 안내 메시지가 나와요.

## 개발

```bash
# 망가요미 런타임을 흉내 내서 실제 사이트로 테스트 (인덱스: 소스 순서, 검색어는 선택)
node scripts/test.mjs javascript/marumaru.js 0
node scripts/test.mjs javascript/marumaru.js 2 화산
node scripts/test.mjs javascript/novel/bookkor.js 0 화산
node scripts/test.mjs javascript/manga/hitomi.js 0

# 확장 파일의 mangayomiSources로 index.json 다시 만들기
node scripts/build-index.mjs
```

확장을 고치면 파일 안의 `version`을 올리고 `node scripts/build-index.mjs`를 실행하세요. 그다음 커밋하면 앱에 업데이트가 떠요.
