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
`data/content.json`의 `materialsLink.url`에 구글 스프레드시트의 https 주소를 넣으면 정모 자료 제목 바로 아래에 새 탭으로 열리는 링크가 표시됩니다. 링크 문구는 `materialsLink.label`에서 바꿀 수 있습니다. URL이 비어 있으면 준비 중 문구가 표시됩니다. 이 설정은 링크만 제공하며 시트 데이터를 가져오지는 않습니다.

## 모집 관리
지원서 제출과 본인 코드 조회는 공개되어 있습니다. 전체 지원서 목록과 면접 배정은 서버에서 관리 비밀번호를 검증한 뒤에 열립니다. 비밀번호는 브라우저 저장소에 저장하지 않으며 새로고침하거나 관리 화면 잠그기를 누르면 다시 입력해야 합니다.

DB 설정은 `supabase/github-pages.sql`을 실행합니다. 기존 지원서는 유지되며 테이블 직접 조회는 차단됩니다. 새 프로젝트에서는 DB 관리자 권한으로 다음 쿼리의 값을 원하는 비밀번호로 바꾸어 설정합니다. 실제 비밀번호를 공개 저장소나 프런트엔드 코드에 넣지 마세요.

```sql
insert into guitarhana_private.admin_settings (id, password_hash)
values (1, extensions.crypt('새로운_관리_비밀번호', extensions.gen_salt('bf', 10)))
on conflict (id) do update set password_hash = excluded.password_hash;
```

