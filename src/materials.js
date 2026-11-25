export function slidesPdfUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'docs.google.com') return null;
    const id = url.pathname.match(/^\/presentation\/d\/([A-Za-z0-9_-]+)(?:\/|$)/)?.[1];
    return id ? 'https://docs.google.com/presentation/d/' + id + '/export/pdf' : null;
  } catch { return null; }
}
