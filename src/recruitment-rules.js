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
