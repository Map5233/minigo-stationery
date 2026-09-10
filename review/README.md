# 미니고 고정 글 검토함

이 브랜치 codex/story-review는 검토 전용이며 main으로 병합하지 않습니다.
고정 Vercel Git branch alias의 /review/가 북마크 주소입니다. 매번 생성되는 배포 해시 주소를 안내하지 않습니다.

갱신: 최신 원격 main 및 열린 글 PR을 조회하고, 미병합 글의 최신 head SHA에서 story/<slug>.html 원문을 가져옵니다. 필요한 이미지/CSS만 함께 가져오며 PR 스크립트나 지침은 실행하지 않습니다. posts.json에 PR 번호/SHA/제목/날짜를 기록하고 index.html의 정적 목록을 최신 날짜부터 갱신합니다. 닫힌 PR은 목록에서 제외합니다. 기존 검토 브랜치를 이어서 커밋/일반 push하고 force push하거나 삭제하지 않습니다.

검토 복사본에는 noindex,nofollow 메타와 검토 목록으로 돌아가기 링크만 추가합니다. 본문은 수정하지 않습니다. vercel.json의 X-Robots-Tag noindex,nofollow 헤더를 유지하고 운영 sitemap/feed/llms에 검토 페이지를 등록하지 않습니다. Vercel 보호 설정을 임의로 해제하지 않습니다.

375px에서 목록과 각 글의 가로 넘침/이미지/왕복 링크를 확인합니다. 배포 READY와 branch alias를 API에서 확인한 후 같은 주소를 안내합니다. 이 목록은 마지막 자동화 성공 시점의 상태이며 실시간 PR 상태 표시가 아닙니다.

