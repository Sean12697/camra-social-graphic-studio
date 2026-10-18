// Modal dialogs built on the native <dialog> element, which gives a focus trap,
// Escape to close and an inert page behind it for free. These helpers add the
// rest: scroll lock, focus return, closing on the backdrop, and a promise-based
// confirmation dialog whose safe choice (Cancel) has focus by default.

import { byId, h } from "./dom.ts";

const returnFocus = new WeakMap<HTMLDialogElement, Element | null>();

// A modal dialog makes the rest of the page inert and sits in the top layer,
// so toasts (and their Undo buttons) move into the topmost open dialog.
function relocateToasts(): void {
  const toasts = document.querySelector(".toasts");
  if (!toasts) return;
  const open = Array.from(document.querySelectorAll<HTMLDialogElement>("dialog[open]"));
  const host = open.length ? open[open.length - 1] : document.body;
  if (toasts.parentElement !== host) host.appendChild(toasts);
}

export function openDialog(d: HTMLDialogElement, focus?: HTMLElement | null): void {
  returnFocus.set(d, document.activeElement);
  if (!d.open) d.showModal();
  relocateToasts();
  document.documentElement.classList.add("modal-open");
  if (focus) focus.focus();
}

export function closeDialog(d: HTMLDialogElement, value = ""): void {
  if (d.open) d.close(value);
}

/** Wires the shared behaviour onto every dialog in the page once. */
export function initDialogs(): void {
  document.querySelectorAll<HTMLDialogElement>("dialog").forEach((d) => {
    d.addEventListener("close", () => {
      relocateToasts();
      if (!document.querySelector("dialog[open]")) document.documentElement.classList.remove("modal-open");
      const back = returnFocus.get(d);
      if (back && back instanceof HTMLElement && document.contains(back)) back.focus();
    });
    // A click on the backdrop (the dialog element itself, outside its card) closes it.
    d.addEventListener("click", (e) => {
      if (e.target === d && !d.hasAttribute("data-no-backdrop-close")) closeDialog(d);
    });
    d.querySelectorAll<HTMLElement>("[data-close]").forEach((b) => b.addEventListener("click", () => closeDialog(d)));
  });
}

export interface ConfirmOptions {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  cancelLabel?: string;
}

/** Asks a yes or no question. Resolves true only when the user confirms. */
export function confirmDialog(o: ConfirmOptions): Promise<boolean> {
  const d = byId<HTMLDialogElement>("confirmDialog");
  byId("confirmTitle").textContent = o.title;
  byId("confirmBody").textContent = o.body;
  const ok = byId<HTMLButtonElement>("confirmOk");
  const cancel = byId<HTMLButtonElement>("confirmCancel");
  ok.textContent = o.confirmLabel;
  ok.className = o.danger ? "btn danger" : "btn primary";
  cancel.textContent = o.cancelLabel || "Cancel";
  return new Promise((resolve) => {
    const done = (v: boolean) => {
      ok.removeEventListener("click", yes);
      d.removeEventListener("close", onClose);
      resolve(v);
    };
    const yes = () => {
      d.returnValue = "ok";
      closeDialog(d, "ok");
    };
    const onClose = () => done(d.returnValue === "ok");
    d.returnValue = "";
    ok.addEventListener("click", yes);
    d.addEventListener("close", onClose);
    openDialog(d, cancel);
  });
}

/** Asks for a single line of text (a design name). Resolves null on cancel. */
export function promptDialog(o: { title: string; label: string; value: string; confirmLabel: string; secondaryLabel?: string; note?: string }): Promise<{ value: string; secondary: boolean } | null> {
  const d = byId<HTMLDialogElement>("promptDialog");
  const form = byId<HTMLFormElement>("promptForm");
  const input = byId<HTMLInputElement>("promptInput");
  const ok = byId<HTMLButtonElement>("promptOk");
  const second = byId<HTMLButtonElement>("promptSecondary");
  const err = byId("promptError");
  byId("promptTitle").textContent = o.title;
  byId("promptLabel").textContent = o.label;
  ok.textContent = o.confirmLabel;
  second.textContent = o.secondaryLabel || "";
  second.hidden = !o.secondaryLabel;
  input.value = o.value;
  const note = byId("promptNote");
  note.textContent = o.note || "";
  note.hidden = !o.note;
  err.textContent = "";
  input.removeAttribute("aria-invalid");
  return new Promise((resolve) => {
    let result: { value: string; secondary: boolean } | null = null;
    const submit = (secondary: boolean) => (e: Event) => {
      e.preventDefault();
      const v = input.value.trim();
      if (!v) {
        err.textContent = "Give the design a name, for example the pub or event.";
        input.setAttribute("aria-invalid", "true");
        input.focus();
        return;
      }
      result = { value: v.slice(0, 200), secondary };
      closeDialog(d);
    };
    const onSubmit = submit(false);
    const onSecond = submit(true);
    const onClose = () => {
      form.removeEventListener("submit", onSubmit);
      second.removeEventListener("click", onSecond);
      d.removeEventListener("close", onClose);
      resolve(result);
    };
    form.addEventListener("submit", onSubmit);
    second.addEventListener("click", onSecond);
    d.addEventListener("close", onClose);
    openDialog(d, input);
    input.select();
  });
}

/** A labelled section heading for dialog bodies. */
export function section(title: string, ...children: Node[]): HTMLElement {
  return h("section", { class: "dlg-section" }, h("h3", {}, title), ...children);
}
