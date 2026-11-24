export function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(field); field = "";
    } else if ((char === '\n' || char === '\r') && !quoted) {
      row.push(field); rows.push(row); row = []; field = "";
      if (char === '\r' && text[i + 1] === '\n') i++;
    } else field += char;
  }
  if (quoted) throw new Error("INVALID_CSV");
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export function setlistTable(rows, headerRow = 1) {
  const source = rows.slice(headerRow);
  let width = 0;
  (source[0] || []).forEach((cell, index) => { if (cell.trim()) width = index + 1; });
  if (!width || source.length < 1) return { headers: [], rows: [] };
  return {
    headers: Array.from({ length: width }, (_, index) => source[0][index]?.trim() || (index === 0 ? "구분" : "항목 " + (index + 1))),
    rows: source.slice(1).filter(row => row.slice(0, width).some(cell => cell.trim())).map(row => Array.from({ length: width }, (_, index) => row[index] || ""))
  };
}

export async function fetchSetlist(sheetUrl, headerRow = 1, transport = fetch) {
  const url = new URL(sheetUrl);
  const match = url.pathname.match(/^\/spreadsheets\/d\/([A-Za-z0-9_-]+)\//);
  if (url.protocol !== "https:" || url.hostname !== "docs.google.com" || !match) throw new Error("INVALID_SHEET");
  const source = new URL(`https://docs.google.com/spreadsheets/d/${match[1]}/gviz/tq`);
  source.searchParams.set("tqx", "out:csv");
  source.searchParams.set("headers", "0");
  const gid = url.searchParams.get("gid") || new URLSearchParams(url.hash.slice(1)).get("gid");
  if (gid && /^\d+$/.test(gid)) source.searchParams.set("gid", gid);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await transport(source.href, { signal: controller.signal, cache: "no-store", credentials: "omit" });
    if (!response.ok || !response.headers.get("content-type")?.includes("text/csv")) throw new Error("SHEET_UNAVAILABLE");
    return setlistTable(parseCsv(await response.text()), headerRow);
  } finally { clearTimeout(timer); }
}
