# 미니고 문구 배포 경로

- 운영 기준 URL: https://minigo.onthemol.com/stationery/
- /stationery 입력은 /stationery/로 이동합니다. 최상위 /는 향후 브랜드 안내 공간을 위해 임시 리디렉션입니다.
- 소스의 index.html은 저장소 최상위, 글은 story/<slug>.html을 유지합니다. Vercel rewrites가 /stationery/ 접두어를 처리합니다. 파일을 stationery 폴더에 중복 생성하지 않습니다.
- 새 글의 canonical·OG·JSON-LD·sitemap·feed·llms의 절대 주소는 모두 위 기준 URL 아래에 둡니다. posts.json의 글 url은 기존처럼 <slug>.html 상대 경로입니다.
- 구형 post.html?id/slug 리디렉션은 기존 경로와 /stationery/story/post.html 양쪽에 추가합니다.
- 기존 열린 글 PR은 병합 전 최신 main 반영 및 절대 URL 변경이 필요합니다. 본 주소 이전은 미발행 글을 발행하지 않습니다.
- codex/story-review 검토 브랜치와 고정 검토 주소는 운영과 별개입니다. 이 브랜치를 main에 병합하지 않습니다.
- DNS의 기존 mgo 레코드/도메인은 삭제하지 않고 새 주소로 리디렉션합니다.
