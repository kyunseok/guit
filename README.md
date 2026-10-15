# 기타하나 — GitHub Pages

동아리 소개, 일정 달력, 텍스트 일정, 정모 PDF, 신입부원 모집을 제공하는 정적 사이트입니다.
기존 Streamlit의 문구, 로고, 갈색 테마, 중앙 정렬 너비와 공개 기능을 옮겼습니다.
달력 이미지 → 텍스트 일정 → 정모 자료 순서이며 달력 다운로드 버튼과 로그인은 없습니다.

## 처음 배포할 때

1. 이 저장소의 Settings → Pages → Build and deployment → Source를 **GitHub Actions**로 설정합니다.
2. 저장소가 비공개라면 GitHub Pro/Team 등 비공개 저장소의 Pages를 지원하는 요금제가 필요합니다.
   GitHub Free에서 공개 저장소로 전환하면 코드뿐 아니라 저장소의 기존 파일과 이력도 공개될 수 있습니다.
   이 프로젝트는 저장소의 공개 범위를 자동으로 변경하지 않습니다.
3. Actions → **Deploy Guitarhana Pages** → Run workflow를 실행합니다.
4. 배포가 성공하면 해당 실행의 `github-pages` 환경 링크 또는 Settings → Pages에서 주소를 확인합니다.

기본 브랜치에 변경을 커밋하면 다시 배포됩니다. `app.py`와 기존 Streamlit 파일은 보존하므로
전환 준비 중에도 이전 사이트를 사용할 수 있습니다. 방문자 접속 시 Python을 실행하지 않습니다.
Python은 GitHub Actions에서 배포 파일과 자료 목록을 만드는 데에만 사용합니다.

## 모집 기능 연결

소개·일정·PDF는 Supabase 없이 작동합니다. 모집 기능에는 아래 두 설정이 필요합니다.

### 1. 기존 Supabase 프로젝트에서 SQL 실행

`supabase/github-pages.sql` 전체를 해당 프로젝트의 SQL Editor에서 실행합니다.
기존 `public.applicants`, `public.interview_slots` 테이블을 그대로 사용하고 기존 데이터를 삭제하지 않습니다.
`applicants.id`는 기존의 6자리 문자 코드이며, `interview_slots.applicant_id`와 연결된 관계를 사용합니다.
학번 중복 제한과 `created_at` 기본값 등 기존 테이블 구조는 유지합니다.

SQL은 두 테이블에 공개 읽기 정책과 최소한의 SELECT 권한을 추가하고,
지원서와 면접 일정을 한 번에 저장하는 함수를 만듭니다. 저장 중 하나라도 실패하면 전체 저장을 취소합니다.
기존에 별도의 restrictive RLS 정책이나 다른 필드 타입/필수 열을 설정했다면 실제 스키마와 맞는지 확인해야 합니다.
SQL은 재실행할 수 있고 기존의 다른 정책을 삭제하지 않습니다.

**공개 범위:** 사용자 요청의 비밀번호 없는 전체 기능을 유지했습니다.
방문자는 모든 지원자의 이름·학번·연락처·지원 사유·지원서 코드·면접 후보를 조회하고 배정 CSV를 받을 수 있습니다.
SQL의 공개 읽기 정책도 이 동작을 허용합니다. 해당 자료의 비공개 운영이 필요하면 별도의 권한 설계가 필요합니다.

### 2. 프로젝트 URL과 공개용 키 등록

GitHub Settings → Secrets and variables → Actions → New repository secret에 등록합니다.

| 이름 | 값 |
| --- | --- |
| `SUPABASE_URL` | 기존 Supabase 프로젝트 URL (`https://….supabase.co`) |
| `SUPABASE_PUBLISHABLE_KEY` | 해당 프로젝트의 `sb_publishable_` 키. 기존 `anon` JWT 키도 허용 |

그다음 Pages 워크플로를 다시 실행합니다. 기존 Streamlit Secrets 설정은 GitHub Actions에 자동 전달되지 않습니다.

GitHub Secrets에 저장해도 정적 사이트에서 사용하는 공개용 키는 최종 `config.json`에 포함되어
방문자에게 전달됩니다. `service_role`, `sb_secret_`, DB 비밀번호는 넣지 마세요.
빌드와 브라우저 코드 모두 관리자 키를 거부합니다.

대안으로 저장소의 `config.json`에 `supabaseUrl`, `supabasePublishableKey`를 직접 입력할 수 있습니다.
GitHub Secrets에 값이 있으면 Secrets가 우선합니다. 설정이 없으면 소개·일정·PDF만 작동합니다.

## 콘텐츠 관리

| 변경할 내용 | 수정 위치 |
| --- | --- |
| 소개 본문·주차별 일정·면접 후보 | `data/content.json` |
| 연락처·SNS 링크·화면의 고정 문구 | `index.html` |
| 테마·간격·화면 너비 | `styles.css` |
| 달력 사진 | `assets/calendar.png` |
| 정모 PDF | `materials/` 안의 PDF 파일 |

달력은 png → jpg → jpeg → webp 순서로 `calendar`라는 이름의 파일 하나를 선택합니다.
`materials/`는 바로 아래의 `.pdf`/`.PDF` 파일만 표시합니다.
한글·공백·괄호가 있는 파일명도 가능합니다. 이름 역순이므로 `YYYY-MM-DD_제목.pdf` 형식을 권장합니다.
파일을 추가/삭제/교체하고 커밋하면 배포할 때 목록이 갱신됩니다. JSON 목록을 직접 수정할 필요는 없습니다.

최신 소스의 일정과 면접 날짜·요일은 임의로 고치지 않았습니다.
면접 자동 배정은 기존과 같이 가능한 시간이 적은 지원자부터 배정하며, 결과는 화면/CSV에만 표시합니다.
CSV는 Excel용 UTF-8 BOM을 포함하며, 수식으로 해석될 수 있는 값에는 작은따옴표를 붙입니다.
접수 시간은 한국 시간으로 표시합니다.

## 검증 및 운영

구현 검증: 메뉴·탭 전환, 달력/PDF 경로, 지원서 제출·조회·목록·배정·CSV,
필수 입력, 중복 제출 잠금, DB 장애 시 정적 화면 유지, HTML 문자열 안전 표시,
공개용 키 검증, API 페이지 분할, SQL 재실행·권한·중복 학번·저장 실패 시 롤백을 확인했습니다.
SQL은 기존 코드에서 확인한 구조를 재현한 임시 PostgreSQL 환경에서 검증했습니다.
실제 Supabase 프로젝트 설정과 GitHub Pages 배포는 해당 계정에서 확인해야 합니다.

소개·일정·PDF에는 Streamlit 휴면 방지 작업이 필요하지 않습니다.
Supabase Free의 비활동 중지는 여전히 모집 기능에 영향을 줄 수 있습니다.
기존 keep-alive 워크플로를 사용한다면 이전 Streamlit 앱이 필요한 동안 유지하고,
Streamlit을 완전히 종료한 뒤에는 그 작업만 제거할 수 있습니다.

## 로컬 확인

```bash
python scripts/build.py
python -m http.server 8000 --directory dist
```

브라우저에서 `http://localhost:8000`을 엽니다. 실제 운영 시 개인 컴퓨터를 켜둘 필요는 없습니다.

## 주요 파일

- `index.html`, `styles.css`, `app.js`, `core.js`: 정적 화면과 기능
- `scripts/build.py`: 공개 배포 파일만 dist에 모으고 달력/PDF 목록 생성
- `.github/workflows/pages.yml`: GitHub Pages 빌드·배포
- `supabase/github-pages.sql`: 기존 DB 연결을 위한 일회성 설정

배포물에는 위 화면 파일, 공개 설정, 로고, 선택한 달력, PDF, 콘텐츠 JSON만 들어갑니다.
기존 `.streamlit/secrets.toml`, Python 소스, SQL, 작업용 문서는 배포 대상에서 제외합니다.
