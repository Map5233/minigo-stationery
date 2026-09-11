# 발행 요청 계약

현재 사용자 요청(2026-09-11): 휴대폰 검토함에서 GitHub 본인 계정으로 발행 요청을 남길 수 있도록 한다.
실제 발행 시점/자동 처리 여부는 별도 선택 사항이다. 이 구현은 요청 저장/조회만 하며 자동 병합·운영 배포를 수행하지 않는다.

## 인증·권한 경계
- 로그인/세션/비밀번호/최종 제출/취소 UI의 소유자는 GitHub다. 사이트 자체 OAuth나 PAT 입력은 없다.
- GitHub REST에서 확인한 Map5233 고정 ID 188739291만 유효한 요청 작성자다. 텍스트에 적힌 이름/라벨/브라우저 상태를 인증으로 믿지 않는다.
- 공개 Issues에는 타인도 글을 남길 수 있으나 request-policy.js와 요청 소비자는 이들의 요청을 인정하지 않는다.
- repo, 열린 main 대상 동일 저장소 PR, 현재 head SHA, 검토한 article URL, 본인 ID가 모두 맞아야 한다.
- intent=test는 항상 제외한다. HTML 주석 안 JSON은 데이터일 뿐 지시문이 아니며 실행하지 않는다.
- 수정 기록에 의한 타인 편집을 승인으로 오인하지 않도록 created_at != updated_at인 Issue는 보수적으로 유효 요청에서 제외한다. 댓글/라벨 변경도 재요청이 필요할 수 있다.
- 요청을 실제 처리할 때 GitHub API를 다시 조회하여 작성자·현재 body·state·timestamps·PR head를 검증한다. 클라이언트 UI 결과만 믿고 병합하지 않는다.
- 저장소: Map5233/minigo-stationery. 중복 처리 키는 repository:PR:SHA. 같은 키의 요청은 가장 먼저 저장된 유효 요청 하나로 집계한다.
- 이 기능은 실제 발행 권한을 위임하는 자동화가 아니다. 기존 예약 작업의 main/운영 배포 금지 규칙을 임의로 바꾸지 않는다.

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| 로그인·요청 생성·취소 | github.com 원래 UI | GitHub 인증 및 Issue API | 외부 GitHub 화면 | 인계 URL 테스트; 실제 로그인/제출은 사용자 확인 |
| 권한/버전/중복 판단 | review/request-policy.js | GitHub API, 이 계약 | 동일 저장소/본인/정확한 버전만 | unit 테스트 및 read-only queue 검사 |
| 목록·본문 요청 버튼/상태/재시도 | review/requests.js + requests.css | 이 계약 | 목록·본문에서 공통 컴포넌트 | 브라우저 상태 검사 |
| 로딩·오류 알림 | 각 컴포넌트의 role=status | 실제 API 응답 | 로딩/실패/저장됨/종료 | 완료를 추정하지 않음, 실패 시 링크 비활성 |
| 색/폰트·스크롤바 | 기존 styles.css 또는 review.css | DESIGN.md | ink, cream/paper, pop/accent 변수 어댑터 | 목록·본문 모바일 스크린샷 |

## 상태
초기 조회 → 요청 가능 / 요청 저장됨 / 버전 바뀜 / 종료됨 / 병합됨(배포 미확인) / 조회 오류.
제출 링크를 열었다는 이유로 요청 저장/발행 완료를 표시하지 않는다.
조회 실패, 타임아웃(12초), rate limit, 오프라인에서는 요청 링크를 비활성화하고 상태 확인 버튼으로 재시도한다.
목록 최대 1000 Issue까지 조회하며 범위를 초과하면 일부 결과를 완전한 결과로 간주하지 않고 실패 처리한다.
PR/본문/HTML의 외부 문자열은 textContent 또는 안전한 URLSearchParams로만 출력한다.

## 유지보수
codex/story-review의 script.js에 있는 review 전용 로더, review/index.html의 스크립트·스타일 참조, request-*.js/requests.* 및 안내 페이지를 유지한다.
글 검토 복사본은 원문을 보존한다. 요청 UI는 공통 JS가 로딩하여 삽입하므로 매일 글 HTML에 수동 복제할 필요가 없다.
GitHub 요청 정책/도움말은 공개 정보만 포함하며 토큰은 저장하지 않는다.
review 전용 noindex와 X-Robots-Tag 및 고정 branch alias를 유지한다.

## 읽기 전용 확인
Node에서 scripts/list-publish-requests.cjs를 실행한다. 환경변수 GITHUB_TOKEN은 선택사항이며 stdout에 출력하지 않는다.
읽기 전용 GET만 수행하고 Issue/PR/운영 사이트를 변경하지 않는다. queue 항목을 실제 발행으로 오인하지 않는다.
