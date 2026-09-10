# 블로그 정적 HTML 자동 반영

## 편집 기준
글의 원본은 story/posts.json입니다. 이 채팅으로 수정을 요청하거나 관리자 화면에서 저장하면 이 데이터를 수정합니다. 기존 story/*.html의 본문만 바꾸면 배포 생성기가 덮어씁니다. 이미지의 기존 figure는 보존하며 새 글은 선택적으로 image: {src: "../assets/파일명.jpg", alt: "...", width: 750, height: 750, caption: "..."}를 지정할 수 있습니다.

새 글의 url은 영문 주제명.html을 권장합니다. 없으면 id에서 안정적인 post-해시.html을 생성합니다. 기존 url은 바꾸지 마세요. title, body, summary, description, author, date, updated, faq, sources를 함께 관리합니다. 내용 수정 시 updated를 실제 수정일로 기록합니다. 생성기는 사실·효능·후기·설명을 지어내지 않습니다.

## 자동 처리
Vercel이 배포할 때 node scripts/build-stories.cjs를 실행합니다. 별도 패키지·프레임워크·번들러가 없으며 결과는 순수 HTML/CSS/JS입니다. 소스 index.html은 저장소 최상위에 유지합니다. 방문자의 JavaScript 실행 전에 본문과 목록이 HTML에 들어 있습니다.

_site/에 정적 글, 최신 3편 홈 목록, 전체 이야기 목록, 정규화한 posts.json, title/description/canonical/OG/JSON-LD, sitemap.xml, feed.xml, llms.txt를 생성합니다. 소스 원본은 덮어쓰지 않습니다. 관리자·robots 등 기존 페이지는 유지합니다. 삭제된 글은 출력에서 빠집니다. 검증 실패 시 배포가 실패하므로 이전 성공 배포를 유지해야 합니다.

## 검토와 발행
검토용 브랜치는 Preview로 생성되고 검색 제외 메타가 붙습니다. main에 승인된 변경이 들어가야 운영 사이트에 반영됩니다. 이 생성기는 PR을 자동 병합하거나 발행을 승인하지 않습니다.
기존 관리자 화면은 선택한 브랜치에 직접 저장하므로 검토하려면 main 대신 검토용 작업 브랜치를 지정하세요. 고정 글 검토함 codex/story-review는 별도 브랜치이므로 승인된 생성기 변경을 반영할 때 review/ 목록과 전용 noindex 설정을 보존해야 합니다.

## 검사
node scripts/test-stories.cjs
node scripts/build-stories.cjs

추가·수정·삭제·빈 목록·경로 공격·중복·JSON-LD·미리보기 검색 제외를 검사합니다. 실제 SEO 성과나 검색엔진 색인은 자동 생성만으로 보장되지 않습니다. 기존 브랜드 유래·포장 변경 기록의 사실 확인은 별도입니다.

