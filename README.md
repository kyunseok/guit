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
