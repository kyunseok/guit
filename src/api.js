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

export function createApi(config, transport = fetch) {
  let base;
  try { base = new URL(config.supabaseUrl); } catch { throw new Error("CONFIG"); }
  if (base.protocol !== "https:" || base.username || base.password || !isPublicKey(config.supabasePublishableKey)) {
    throw new Error("CONFIG");
  }
  const root = base.href.replace(/\/$/, "") + "/rest/v1/";
  const key = config.supabasePublishableKey;
  async function request(path, options = {}) {
    if (globalThis.navigator?.onLine === false) throw new Error("OFFLINE");
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
    async reservationsList(from, to) {
      const rows = [];
      for (let offset = 0; ; offset += 500) {
        const query = new URLSearchParams({ select: "id,starts_at,ends_at,user_name,purpose,people,has_password", starts_at: "lt." + to, ends_at: "gt." + from, order: "starts_at.asc,id.asc", limit: "500", offset: String(offset) });
        const result = await request("room_reservations?" + query);
        if (!Array.isArray(result.data)) throw new Error("INVALID_RESPONSE");
        rows.push(...result.data);
        if (result.data.length < 500) return rows;
      }
    },
    async fixedReservationsList(from, to) {
      const result = await request("rpc/guitarhana_room_fixed_occurrences_v1", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ p_from: from, p_to: to })
      });
      if (!Array.isArray(result.data) || result.data.some(row => row.is_fixed !== true)) throw new Error("INVALID_RESPONSE");
      return result.data;
    },
    async reservationSubmit(values) {
      const result = await request("rpc/guitarhana_reserve_room_v1", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
          p_id: values.id, p_start: values.starts_at, p_end: values.ends_at, p_user: values.user_name,
          p_purpose: values.purpose, p_people: values.people, p_password: values.password || ""
        })
      });
      if (result.data !== values.id) throw new Error("INVALID_RESPONSE");
    },
    async reservationCancel(id, password = "") {
      const result = await request("rpc/guitarhana_cancel_room_v1", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ p_id: id, p_password: password })
      });
      if (!["cancelled", "already_cancelled", "password_required", "invalid_password", "rate_limited", "unavailable"].includes(result.data)) throw new Error("INVALID_RESPONSE");
      return result.data;
    },
    async feedbackList(songKey, offset = 0) {
      if (!/^[a-f0-9]{64}$/.test(songKey) || !Number.isInteger(offset) || offset < 0) throw new Error("INVALID_FEEDBACK");
      const query = new URLSearchParams({ select: "id,author_name,body,created_at", song_key: "eq." + songKey, order: "created_at.desc,id.desc", limit: "50", offset: String(offset) });
      const result = await request("song_feedback?" + query, { headers: { Prefer: "count=exact" } });
      if (!Array.isArray(result.data)) throw new Error("INVALID_RESPONSE");
      return { rows: result.data, total: result.total };
    },
    async feedbackSubmit(values) {
      try {
        await request("song_feedback", {
          method: "POST", headers: { "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(values)
        });
      } catch (error) { if (error.code !== "23505") throw error; }
    }
  };
}
