# 기타하나 — GitHub Pages
https://kyunseok.github.io/guit/

## When you deploy...

1. Settings -> Pages -> Build and deployment -> Set Source to **Github Actions** in this repository.
2. If the repository is private, you need to subscribe a plan like GitHub Pro/Team!
3. Actions -> **Deploy Gutarhana Pages** -> Run workflow
4. You can check your link in Settings -> Pages.

## 로컬 확인
```bash
python scripts/build.py
python -m http.server 8000 --directory dist
```

## 주요 파일
- `index.html`, `styles.css`, `app.js`, `core.js`: 정적 화면과 기능
- `scripts/build.py`: 공개 배포 파일만 dist에 모으고 달력/PDF 목록 생성
- `.github/workflows/pages.yml`: GitHub Pages 빌드·배포
- `supabase/github-pages.sql`: 기존 DB 연결을 위한 일회성 설정.

## 정모 자료 링크
`data/content.json`의 `materialLinks`에 주차(`week`), 제목(`title`), Google Slides 주소(`url`)를 등록합니다. 자료 제목 아래에 링크가 표시됩니다. 같은 주차의 정모 PDF가 `materials/`에 있으면 하나의 카드에 미리보기와 다운로드도 표시됩니다. PDF가 없으면 링크만 표시되며, PDF를 추가해 배포하면 자동으로 합쳐집니다.

## 공연 셋리스트
`data/content.json`의 `performances`에서 공연 이름과 `sheetUrl`을 관리합니다. 공개 Google Sheets를 브라우저에서 읽어 표로 표시합니다. 첫 워크시트를 사용하며 특정 시트를 지정하려면 URL에 `gid`를 넣습니다. 기본적으로 두 번째 행을 표의 제목 행으로 사용합니다. 구조가 달라지면 `headerRow`를 0부터 세는 행 번호로 설정하세요.

탭을 처음 열 때 데이터를 읽으며, 1분 이상 지난 후 다시 열거나 새로고침 버튼을 누르면 다시 가져옵니다. 시트 변경 내용의 반영에는 Google 측 캐시로 인한 지연이 있을 수 있습니다. 읽기에 실패하면 원본 링크와 재시도 안내를 표시합니다. 연합공연은 주소를 등록하기 전까지 준비 안내를 표시합니다.

## 모집 관리
지원서 제출과 본인 코드 조회는 공개되어 있습니다. 전체 지원서 목록과 면접 배정은 서버에서 관리 비밀번호를 검증한 뒤에 열립니다. 비밀번호는 브라우저 저장소에 저장하지 않으며 페이지를 새로고침하면 다시 입력해야 합니다.

DB 설정은 `supabase/github-pages.sql`을 실행합니다. 기존 지원서는 유지되며 테이블 직접 조회는 차단됩니다. 새 프로젝트에서는 DB 관리자 권한으로 다음 쿼리의 값을 원하는 비밀번호로 바꾸어 설정합니다. 실제 비밀번호를 공개 저장소나 프런트엔드 코드에 넣지 마세요.

```sql
insert into guitarhana_private.admin_settings (id, password_hash)
values (1, extensions.crypt('새로운_관리_비밀번호', extensions.gen_salt('bf', 10)))
on conflict (id) do update set password_hash = excluded.password_hash;
```


