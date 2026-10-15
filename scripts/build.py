import json
import shutil
from pathlib import Path
from urllib.parse import quote, urlsplit
import base64
import os

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "dist"


def public_key(value):
    if value.startswith("sb_publishable_") and len(value) > 20:
        return True
    try:
        payload = value.split(".")[1]
        decoded = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        return decoded.get("role") == "anon"
    except (ValueError, IndexError, KeyError):
        return False


def copy(source, destination):
    if source.is_symlink() or not source.resolve().is_relative_to(ROOT):
        raise ValueError(f"Unsafe file: {source.name}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, destination)


config = json.loads((ROOT / "config.json").read_text())
environment_url = os.environ.get("SUPABASE_URL", "").strip()
environment_key = os.environ.get("SUPABASE_PUBLISHABLE_KEY", "").strip()
if environment_url or environment_key:
    config = {"supabaseUrl": environment_url, "supabasePublishableKey": environment_key}
url = config.get("supabaseUrl", "")
key = config.get("supabasePublishableKey", "")
if url or key:
    parsed = urlsplit(url)
    if parsed.scheme != "https" or not parsed.netloc or parsed.username or not public_key(key):
        raise ValueError("config.json에는 HTTPS 프로젝트 URL과 publishable 또는 anon 키만 사용할 수 있습니다.")
else:
    print("Supabase is not configured. Public pages will work; recruitment stays unavailable.")

content = json.loads((ROOT / "data/content.json").read_text())
assert isinstance(content["introduction"], str)
assert isinstance(content["schedule"], list)
assert isinstance(content["interviewSlots"], list)

if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir()
for name in ("index.html", "styles.css", "app.js", "core.js", "guitLogo.png"):
    copy(ROOT / name, OUT / name)
copy(ROOT / "data/content.json", OUT / "data/content.json")
(OUT / "config.json").write_text(json.dumps({"supabaseUrl": url, "supabasePublishableKey": key}, indent=2) + "\n")

calendar = None
for ext in ("png", "jpg", "jpeg", "webp"):
    image = ROOT / "assets" / ("calendar." + ext)
    if image.is_file():
        relative = image.relative_to(ROOT).as_posix()
        copy(image, OUT / relative)
        calendar = {"path": quote(relative, safe="/")}
        break

materials = []
folder = ROOT / "materials"
if folder.is_dir():
    for pdf in sorted(folder.iterdir(), key=lambda p: p.name, reverse=True):
        if pdf.is_file() and pdf.suffix.lower() == ".pdf":
            relative = pdf.relative_to(ROOT).as_posix()
            copy(pdf, OUT / relative)
            materials.append({"name": pdf.name, "title": pdf.stem.replace("_", " "), "path": quote(relative, safe="/"), "size": pdf.stat().st_size})

for name, value in (("calendar", calendar), ("materials", materials)):
    (OUT / "data" / (name + ".json")).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")
(OUT / ".nojekyll").touch()
print(f"Built dist/: {len(materials)} PDF(s), calendar={'yes' if calendar else 'no'}")
