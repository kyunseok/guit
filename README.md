# 기타하나 — GitHub Pages
https://kyunseok.github.io/guit/

## When you deploy...

1. Settings -> Pages -> Build and deployment -> Set Source to **Github Actions** in this repository.
2. If the repository is private, you need to subscribe a plan like GitHub Pro/Team!
3. Actions -> **Deploy Guitarhana Pages** -> Run workflow
4. You can check your link in Settings -> Pages.

## 로컬 확인
```bash
npm ci
npm run check
python -m http.server 8000 --directory dist
```

## 주요 파일
- `index.html`, `styles.css`: 화면 구조와 공통 디자인
- `app.js`: 앱 초기화와 각 기능 연결
- `src/`: 화면별 컨트롤러, API 통신, 날짜·예약·면접 규칙
- `manifest.webmanifest`, `sw.js`, `src/pwa.js`: 설치 정보, 오프라인 화면, 업데이트 안내
- `scripts/build.py`: 공개 배포 파일만 dist에 모으고 달력/PDF 목록 생성
- `.github/workflows/pages.yml`: GitHub Pages 빌드·배포
- `supabase/github-pages.sql`: 기존 DB 연결을 위한 일회성 설정.

## 정모 자료 링크
`data/content.json`의 `materialLinks`에 주차(`week`), 제목(`title`), Google Slides 주소(`url`)를 등록합니다. 자료 제목 아래에 링크가 표시됩니다. 같은 주차의 정모 PDF가 `materials/`에 있으면 하나의 카드에 미리보기와 다운로드도 표시됩니다. PDF가 없으면 링크만 표시되며, PDF를 추가해 배포하면 자동으로 합쳐집니다.

## 공연 셋리스트
`data/content.json`의 `performances`에서 공연 이름과 `sheetUrl`을 관리합니다. 공개 Google Sheets를 브라우저에서 읽어 표로 표시합니다. 첫 워크시트를 사용하며 특정 시트를 지정하려면 URL에 `gid`를 넣습니다. 기본적으로 두 번째 행을 표의 제목 행으로 사용합니다. 구조가 달라지면 `headerRow`를 0부터 세는 행 번호로 설정하세요.

셋리스트 메뉴에 들어오거나 공연 탭을 전환할 때마다 데이터를 다시 읽습니다. 별도 새로고침 버튼은 없습니다. 시트 변경 내용의 반영에는 Google 측 캐시로 인한 지연이 있을 수 있습니다. 읽기에 실패하면 원본 링크와 재시도 안내를 표시합니다. 연합공연은 주소를 등록하기 전까지 준비 안내를 표시합니다.

## 모집 관리
지원서 제출과 본인 코드 조회는 공개되어 있습니다. 전체 지원서 목록과 면접 배정은 서버에서 관리 비밀번호를 검증한 뒤에 열립니다. 비밀번호는 브라우저 저장소에 저장하지 않으며 페이지를 새로고침하면 다시 입력해야 합니다.

DB 설정은 `supabase/github-pages.sql`을 실행합니다. 기존 지원서는 유지되며 테이블 직접 조회는 차단됩니다. 새 프로젝트에서는 DB 관리자 권한으로 다음 쿼리의 값을 원하는 비밀번호로 바꾸어 설정합니다. 실제 비밀번호를 공개 저장소나 프런트엔드 코드에 넣지 마세요.

```sql
insert into guitarhana_private.admin_settings (id, password_hash)
values (1, extensions.crypt('새로운_관리_비밀번호', extensions.gen_salt('bf', 10)))
on conflict (id) do update set password_hash = excluded.password_hash;
```




## 학기별 보기
동아리 일정과 기타교실은 왼쪽에서 26-2학기 / 27-1학기를 선택합니다. 기존 달력, 일정, PDF, 기타교실 정보는 모두 26-2학기에 속합니다. 27-1학기는 현재 등록 전 안내를 표시합니다. 향후 내용은 해당 학기 패널에 추가하며 기존 학기 자료를 덮어쓰지 않습니다.

## 곡별 피드백
`supabase/song-feedback.sql`은 피드백 전용 테이블과 공개 읽기·쓰기 권한을 만드는 일회성 설정입니다. 곡 제목을 누르면 피드백 창이 열립니다. 닉네임은 선택 사항이며 빈 값은 익명으로 표시됩니다. 본문은 1,000자까지 작성할 수 있고 모든 방문자에게 공개됩니다. 사이트에서는 기존 피드백 수정·삭제를 제공하지 않습니다.

피드백은 스프레드시트 ID, 시트 gid, 조 이름, 곡명을 정규화한 키로 연결합니다. 행의 순서가 바뀌어도 유지되며, 공백·영문 대소문자 차이는 같은 곡으로 봅니다. 곡명·조 이름·시트 자체를 변경하면 별도 피드백으로 구분되므로, 이름 변경 시 기존 의견을 이어 쓰려면 키를 함께 이전해야 합니다. 같은 공연과 조 안의 같은 곡은 피드백을 공유합니다. 곡명 열은 기본적으로 두 번째 열이며, 변경하려면 `performances` 항목에 0부터 세는 `songColumn` 값을 지정합니다.


정기공연의 `sheets` 목록에는 `셋리스트`와 `1차리허설`을 각각 등록합니다. 각 항목의 `id`, `title`, `sheetUrl`, `headerRow`로 시트 전환 메뉴를 구성하며, URL의 `gid`가 피드백을 분리합니다. 기존 정기공연의 gid=0 피드백은 그대로 유지됩니다. 공연 공지 영역은 표시하지 않습니다.


## 코드 구조와 검사

Node.js 22 이상과 Python 3.12를 사용합니다. `npm ci`로 테스트 도구만 설치하며, 배포 사이트에는 npm 패키지를 포함하지 않습니다. `npm run check`는 기능 테스트, 정적 사이트 빌드, 배포 파일 검사를 차례로 수행합니다. PR과 push에서도 같은 검사를 실행하며 통과한 기본 브랜치만 Pages에 배포합니다.

| 파일 | 담당 기능 |
| --- | --- |
| `src/api.js` | Supabase 요청, 응답 검증, 시간 제한 |
| `src/content.js`, `src/files.js` | 소개·달력·PDF·기타교실, 공개 파일 경로 |
| `src/navigation.js` | 메뉴, 학기 전환, 현재 메뉴 밑줄 |
| `src/recruitment.js`, `src/recruitment-rules.js` | 지원·조회·관리 화면, 면접 배정·CSV |
| `src/reservations.js`, `src/reservation-rules.js`, `src/timetable.js` | 예약·취소 화면, 한국 시간·예약 규칙, 시간표 |
| `src/performances.js`, `src/setlists.js`, `src/setlist-view.js`, `src/feedback.js` | 공연·시트 전환, 셋리스트, 곡별 피드백 |
| `src/ui.js`, `src/dates.js` | 공통 화면 요소와 날짜 표시 |

화면 컨트롤러는 자신의 상태를 내부에 보관하고 필요한 기능만 반환합니다. 순수한 날짜·검증·배정 계산은 별도 함수로 분리했습니다. 상속 구조나 불필요한 클래스 없이도 역할 분리와 상태 캡슐화를 유지합니다.

이전 Streamlit 실행 파일(`app.py`, `.streamlit/config.toml`, `requirements.txt`)과 Streamlit 접속 유지 작업은 제거했습니다. 이전 버전은 Git 기록에 남아 있습니다. `.github/workflows/supabase-health.yml`은 기존 Supabase 점검만 유지합니다. 데이터베이스 테이블이나 기존 데이터는 이 정리로 변경되지 않습니다.

`data/calendar.json`과 `data/materials.json`은 빌드 산출물이므로 직접 편집하지 않습니다. 달력 이미지는 `assets/calendar.*`, PDF는 `materials/`, 링크와 문구는 `data/content.json`에서 관리합니다. PDF 원본은 보존하며 미리보기를 눌렀을 때만 문서를 로딩합니다.

## 배포 버전과 PWA

빌드가 공개 파일 내용으로 버전을 계산하고 HTML과 모든 JS import에 같은 버전을 적용합니다. 날짜 문자열이나 쿼리 버전을 직접 수정할 필요가 없습니다. 기존 로고를 설치 아이콘으로 재사용합니다.

사이트 아래의 **앱 설치** 버튼을 이용합니다. 설치 안내를 제공하는 브라우저에서는 설치 창이 열리고, 그 외에는 홈 화면 추가 방법이 표시됩니다. 아이폰은 Safari 공유 메뉴의 **홈 화면에 추가**, 안드로이드는 Chrome의 **앱 설치 / 홈 화면에 추가**를 사용할 수 있습니다. 실제 메뉴 이름과 지원 범위는 브라우저에 따라 달라집니다.

서비스 워커는 이 저장소 경로의 공개 화면, 코드, 설정, 달력·이미지·목록 파일만 저장합니다. 설치나 첫 접속 시 PDF를 한꺼번에 다운로드하지 않습니다. PDF 원본, Supabase 응답, 지원서, 예약 정보, 비밀번호, 피드백, 외부 스프레드시트는 오프라인 캐시에 저장하지 않습니다. 오프라인에서는 저장된 화면을 볼 수 있고 상태 안내가 표시됩니다. 예약·취소·지원서 제출·피드백 쓰기를 대기열에 저장하거나 나중에 자동 전송하지 않습니다.

새 버전이 준비되면 안내와 **지금 새로고침** 버튼을 표시합니다. 입력 중인 내용을 보호하기 위해 자동으로 페이지를 새로고침하지 않습니다. 버튼을 누르면 입력 내용이 초기화되므로 작성을 마친 뒤 누릅니다. 앱을 완전히 닫고 다시 열 때에도 새 버전이 적용될 수 있습니다.

## Supabase 설정 파일 보존

`supabase/`의 SQL은 사용하지 않는 파일이 아니라 새 프로젝트 재구축과 변경 이력을 위한 설정입니다. 이미 적용된 데이터베이스에서는 이 코드 정리를 이유로 다시 실행하지 않습니다. 새 프로젝트에 적용할 때의 순서는 다음과 같습니다.

1. `github-pages.sql`
2. `song-feedback.sql`
3. `room-reservations.sql`
4. `room-reservation-cancellation.sql`
5. `room-fixed-slots.sql`

예약은 최대 2시간, 경계 시각을 공유하는 연속 예약 허용, 고정 수업 시간 차단 규칙을 유지합니다. 날짜 계산과 입력은 한국 시간이며 API에는 `+09:00` 오프셋을 명시합니다. PostgreSQL의 `timestamptz`는 같은 순간을 UTC로 표시할 수 있고, 한국 시간 조회용 열과 화면에서 한국 시간으로 확인합니다. 비밀번호 검증과 예약 충돌 차단은 서버에서 수행합니다.
