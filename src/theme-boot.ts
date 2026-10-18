// Runs in <head>, before the stylesheet paints, so the saved theme applies
// without a flash of the wrong colours. Kept tiny and dependency free.
try {
  const raw = localStorage.getItem("camra-studio:prefs");
  const pref = raw ? JSON.parse(raw).theme : undefined;
  let t = pref === "light" || pref === "dark" ? pref : "dark";
  if (pref === "system" && window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) t = "light";
  document.documentElement.dataset.theme = t;
  document.documentElement.style.colorScheme = t;
} catch {
  document.documentElement.dataset.theme = "dark";
}
