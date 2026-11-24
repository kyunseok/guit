export async function jsonFile(path) {
  const response = await fetch(new URL(path, document.baseURI), { cache: "no-cache" });
  if (!response.ok) throw new Error("FILE");
  return response.json();
}

export function publicFileUrl(path, base) {
  const origin = new URL("./", base);
  const url = new URL(path, origin);
  if (url.origin !== origin.origin || !url.pathname.startsWith(origin.pathname)) {
    throw new Error("Invalid asset path");
  }
  return url.href;
}
