// Dark by default, with light and "match system" from Settings. The choice is
// applied before first paint by theme-boot.ts, so the page never flashes.

export type ThemePref = "dark" | "light" | "system";

const META_COLOURS = { dark: "#2b313d", light: "#f7f6f3" };

export function resolveTheme(pref: ThemePref | undefined): "dark" | "light" {
  if (pref === "light" || pref === "dark") return pref;
  if (pref === "system" && window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) return "light";
  return "dark";
}

export function applyTheme(pref: ThemePref | undefined): void {
  const t = resolveTheme(pref);
  document.documentElement.dataset.theme = t;
  document.documentElement.style.colorScheme = t;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", META_COLOURS[t]);
}

let mql: MediaQueryList | null = null;
export function watchSystemTheme(getPref: () => ThemePref | undefined): void {
  if (!window.matchMedia) return;
  mql = window.matchMedia("(prefers-color-scheme: light)");
  mql.addEventListener("change", () => {
    if (getPref() === "system") applyTheme("system");
  });
}
