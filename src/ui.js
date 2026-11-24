export const $ = id => document.getElementById(id);

export function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

export function message(target, text, type = "") {
  $(target).replaceChildren(element("p", text, "notice " + type));
}
