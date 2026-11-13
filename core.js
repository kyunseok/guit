export function isPublicKey(key) {
  if (typeof key !== "string") return false;
  if (key.startsWith("sb_publishable_") && key.length > 20) return true;
  try {
    const token = key.split(".");
    if (token.length !== 3) return false;
    const payload = JSON.parse(atob(token[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.role === "anon";
  } catch { return false; }
}

export function slotsOf(row) {
  return (row.interview_slots || []).map(slot => slot.interview_time);
}

export function assignInterviews(applicants) {
  const used = new Set();
  return [...applicants].sort((a, b) => slotsOf(a).length - slotsOf(b).length).map(row => {
    const available = slotsOf(row).find(slot => !used.has(slot));
    if (available) used.add(available);
    return {
      "이름": row.name,
      "학번": row.student_id,
      "연락처": row.phone,
      "배정된 시간": available || "배정 실패 (수동 조율 필요)",
      "지원 사유": row.motive
    };
  });
}

export function csvString(rows) {
  if (!rows.length) return "\uFEFF";
  const headers = Object.keys(rows[0]);
  const cell = value => {
    let text = String(value ?? "");
    if (/^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  return "\uFEFF" + [headers, ...rows.map(row => headers.map(header => row[header]))]
    .map(values => values.map(cell).join(",")).join("\r\n") + "\r\n";
}

export function formatDate(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).format(date);
}

export function publicFileUrl(path, base) {
  const origin = new URL("./", base);
  const url = new URL(path, origin);
  if (url.origin !== origin.origin || !url.pathname.startsWith(origin.pathname)) {
    throw new Error("Invalid asset path");
  }
  return url.href;
}

export function createApi(config, transport = fetch) {
  let base;
  try { base = new URL(config.supabaseUrl); } catch { throw new Error("CONFIG"); }
  if (base.protocol !== "https:" || base.username || base.password || !isPublicKey(config.supabasePublishableKey)) {
    throw new Error("CONFIG");
  }
  const root = base.href.replace(/\/$/, "") + "/rest/v1/";
  const key = config.supabasePublishableKey;
  async function request(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const headers = { apikey: key, Accept: "application/json", ...options.headers };
      if (!key.startsWith("sb_publishable_")) headers.Authorization = "Bearer " + key;
      const response = await transport(root + path, { ...options, headers, signal: controller.signal, cache: "no-store" });
      let data;
      try { data = await response.json(); } catch { data = null; }
      if (!response.ok) {
        const error = new Error("DATABASE");
        error.code = data?.code;
        error.status = response.status;
        throw error;
      }
      return { data, total: Number(response.headers.get("content-range")?.split("/")[1]) };
    } finally { clearTimeout(timer); }
  }
  return {
    async submit(values) {
      const result = await request("rpc/guitarhana_submit_application_v1", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
          p_name: values.name, p_student_id: values.student_id, p_phone: values.phone,
          p_motive: values.motive, p_slots: values.slots
        })
      });
      if (typeof result.data !== "string" || !/^[A-Z0-9]{6}$/.test(result.data)) throw new Error("INVALID_RESPONSE");
      return result.data;
    },
    async lookup(code) {
      if (!/^[A-Z0-9]{6}$/.test(code)) throw new Error("INVALID_CODE");
      const result = await request("rpc/guitarhana_lookup_application_v1", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ p_code: code })
      });
      if (result.data !== null && (typeof result.data !== "object" || result.data.id !== code)) throw new Error("INVALID_RESPONSE");
      return result.data;
    },
    async list(password) {
      const rows = [];
      for (let offset = 0; ; ) {
        const result = await request("rpc/guitarhana_admin_applicants_v1", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ p_password: password, p_offset: offset, p_limit: 500 })
        });
        const page = result.data;
        if (!Array.isArray(page?.rows) || !Number.isInteger(page.total)) throw new Error("INVALID_RESPONSE");
        rows.push(...page.rows);
        offset += page.rows.length;
        if (!page.rows.length || offset >= page.total) break;
      }
      return rows;
    }
  };
}

