// Entry point: storage first, then the editor, then the panels around it.

import "./styles/main.css";
import { initStore, store } from "./ui/store.ts";
import { initNotices, notify } from "./ui/notices.ts";
import { initDialogs } from "./ui/dialog.ts";
import { applyTheme, watchSystemTheme } from "./ui/theme.ts";
import { byId } from "./ui/dom.ts";
import { initEditor } from "./ui/editor.ts";
import { initExport, doDownload } from "./ui/export.ts";
import { initDesigns, refreshDesigns, saveCurrent } from "./ui/designs-ui.ts";
import { initLogoPicker } from "./ui/logos-ui.ts";
import { initSettings, refreshSettings } from "./ui/settings-ui.ts";
import { initCampaigns, refreshCampaigns } from "./ui/campaigns-ui.ts";
import { onDataChanged } from "./ui/backup-ui.ts";
import { initTips, startTips } from "./ui/tips.ts";
import { registerServiceWorker } from "./ui/sw-register.ts";

async function boot(): Promise<void> {
  initNotices(byId("notices"), byId("alerts"));
  initDialogs();
  await initStore();
  const prefs = store.getPrefs();
  applyTheme(prefs.theme);
  watchSystemTheme(() => store.getPrefs().theme);
  const result = await initEditor();
  initExport();
  await initDesigns();
  initSettings();
  initLogoPicker();
  initCampaigns();
  initTips();
  // Ctrl or Cmd + S saves the design instead of the browser's "save page".
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "s") {
      e.preventDefault();
      if (!document.querySelector("dialog[open]")) saveCurrent();
    }
  });
  onDataChanged(() => {
    refreshDesigns();
    refreshSettings();
    refreshCampaigns();
  });
  document.documentElement.dataset.ready = "1";
  if (result.download) window.setTimeout(() => doDownload(result.zip), 120);
  else startTips(false);
  registerServiceWorker();
}

boot().catch((e) => {
  console.error(e);
  notify("error", "The studio could not start: " + (e instanceof Error ? e.message : String(e)) + ". Try reloading the page.");
});
