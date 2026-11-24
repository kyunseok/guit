import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const root = fileURLToPath(new URL('../../', import.meta.url));
const out = path.join(root, 'dist');
const read = name => readFile(path.join(out, name), 'utf8');
async function walk(folder) {
  const result = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const name = path.join(folder, entry.name);
    if (entry.isDirectory()) result.push(...await walk(name));
    else result.push(name);
  }
  return result;
}

test('all release imports resolve with the same content version and no development files ship', async () => {
  const html = await read('index.html');
  const dom = new JSDOM(html, { url: 'https://example.test/guit/' });
  const app = dom.window.document.querySelector('script[type=module]').src;
  const version = new URL(app).searchParams.get('v');
  assert.match(version, /^[a-f0-9]{16}$/);
  assert.equal(new URL(dom.window.document.querySelector('link[rel=stylesheet]').href).searchParams.get('v'), version);
  const files = await walk(out);
  for (const file of files.filter(file => file.endsWith('.js'))) {
    execFileSync(process.execPath, ['--check', file]);
    const code = await readFile(file, 'utf8');
    for (const match of code.matchAll(/(?:from\s+|import\s*)["'](\.[^"']+\.js\?v=([^"']+))["']/g)) {
      const target = new URL(match[1], 'file://' + file);
      assert.equal(target.searchParams.get('v'), version);
      await stat(fileURLToPath(target));
    }
  }
  for (const file of files) assert.doesNotMatch(path.relative(out, file), /^(tests|scripts|supabase|node_modules|\.github)\/|\.py$|package(-lock)?\.json$/);
  dom.window.close();
});

test('manifest and offline shell stay within scope, retain the original logo and exclude PDFs', async () => {
  const manifest = JSON.parse(await read('manifest.webmanifest'));
  assert.equal(manifest.scope, './');
  assert.equal(manifest.start_url, './#about');
  assert.equal(manifest.display, 'standalone');
  for (const icon of manifest.icons) {
    const png = await readFile(path.join(out, icon.src));
    assert.equal(icon.sizes, png.readUInt32BE(16) + 'x' + png.readUInt32BE(20));
    assert.ok(png.readUInt32BE(16) >= 512);
  }
  const worker = await read('sw.js');
  assert.doesNotMatch(worker, /__BUILD_VERSION__|__SHELL_FILES__/);
  const shell = JSON.parse(worker.match(/const FILES = (\[.*\]);/)[1]);
  for (const file of shell) {
    assert.ok(!file.includes('..') && !file.includes('://'));
    assert.ok(!file.endsWith('.pdf'));
    await stat(path.join(out, decodeURIComponent(file.split('?')[0])));
  }
  assert.ok(shell.includes('index.html'));
  const materials = JSON.parse(await read('data/materials.json'));
  const originals = (await readdir(path.join(root, 'materials'))).filter(name => name.toLowerCase().endsWith('.pdf'));
  assert.equal(materials.filter(item => item.path).length, originals.length);
  for (const item of materials.filter(item => item.path)) {
    const file = await stat(path.join(out, decodeURIComponent(item.path)));
    assert.equal(file.size, item.size);
  }
});

test('identical source builds produce identical release versions', async () => {
  const before = await read('sw.js');
  execFileSync('python3', ['scripts/build.py'], { cwd: root });
  assert.equal(await read('sw.js'), before);
});
