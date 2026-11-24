import json
import hashlib
import shutil
from pathlib import Path
from urllib.parse import quote, urlsplit
import base64
import os
import re
import unicodedata

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
for name in ("index.html", "styles.css", "app.js", "manifest.webmanifest", "guitLogo.png"):
    copy(ROOT / name, OUT / name)
for module in sorted((ROOT / "src").rglob("*.js")):
    copy(module, OUT / module.relative_to(ROOT))
copy(ROOT / "data/content.json", OUT / "data/content.json")
copy(ROOT / "assets/cleantheroom.png", OUT / "assets/cleantheroom.png")
copy(ROOT / "assets/share-preview-20261117.png", OUT / "assets/share-preview-20261117.png")
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

links = {item["week"]: item for item in content.get("materialLinks", [])}
matched = set()
for material in materials:
    title = unicodedata.normalize("NFC", material["title"])
    week = re.search(r"(\d+)\s*주차", title) if "정모" in title else None
    if week:
        material["week"] = int(week.group(1))
        if material["week"] in links:
            material["url"] = links[material["week"]]["url"]
            matched.add(material["week"])
for week, item in links.items():
    if week not in matched:
        materials.append({"title": item["title"], "week": week, "url": item["url"]})
materials.sort(key=lambda item: item.get("week", -1), reverse=True)

for name, value in (("calendar", calendar), ("materials", materials)):
    (OUT / "data" / (name + ".json")).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")

digest = hashlib.sha256((ROOT / "sw.js").read_bytes())
for file in sorted(OUT.rglob("*")):
    if file.is_file():
        digest.update(file.relative_to(OUT).as_posix().encode())
        digest.update(b"\0")
        digest.update(file.read_bytes())
        digest.update(b"\0")
version = digest.hexdigest()[:16]
imports = re.compile(r"((?:\bfrom\s+|\bimport\s*)[\"'])(\.[^\"']+\.js)([\"'])")
for module in OUT.rglob("*.js"):
    module.write_text(imports.sub(lambda match: match[1] + match[2] + "?v=" + version + match[3], module.read_text()))
html = (OUT / "index.html").read_text()
html = html.replace('href="styles.css"', f'href="styles.css?v={version}"').replace('src="app.js"', f'src="app.js?v={version}"')
(OUT / "index.html").write_text(html)
shell = []
for file in sorted(OUT.rglob("*")):
    if not file.is_file() or file.suffix.lower() == ".pdf":
        continue
    relative = file.relative_to(OUT).as_posix()
    if relative == "assets/share-preview-20261117.png":
        continue
    path = quote(relative, safe="/")
    shell.append(path + ("?v=" + version if file.suffix in (".js", ".css") else ""))
worker = (ROOT / "sw.js").read_text().replace("__BUILD_VERSION__", version).replace("__SHELL_FILES__", json.dumps(shell, ensure_ascii=False))
(OUT / "sw.js").write_text(worker)
(OUT / ".nojekyll").touch()
print(f"Built dist/{version}: {sum(bool(item.get('path')) for item in materials)} PDF(s), calendar={'yes' if calendar else 'no'}")
