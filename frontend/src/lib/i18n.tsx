import { useSyncExternalStore } from "react";
import translations from "./translations.json";

type Language = "th" | "en";
const key = "hdc-language";
let language: Language = "th";
try {
  language = localStorage.getItem(key) === "en" ? "en" : "th";
} catch {
  /* storage may be disabled */
}
const listeners = new Set<() => void>();
const dictionary: Record<string, string> = translations;
function notify() {
  document.documentElement.lang = language;
  listeners.forEach((listener) => listener());
}
document.documentElement.lang = language;
window.addEventListener("storage", (event) => {
  if (event.key === key) {
    language = event.newValue === "en" ? "en" : "th";
    notify();
  }
});
export function setLanguage(next: Language) {
  language = next;
  try {
    localStorage.setItem(key, next);
  } catch {
    /* keep in memory */
  }
  notify();
}
export function useLanguage() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => language,
  );
}
export function locale() {
  return language === "en" ? "en-US" : "th-TH";
}
export function t(text: string, ...values: unknown[]): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  const translated =
    language === "en" && dictionary[normalized]
      ? text.replace(text.trim(), dictionary[normalized])
      : text;
  return translated.replace(/\{(\d+)\}/g, (match, index) =>
    Number(index) < values.length ? String(values[Number(index)]) : match,
  );
}
export function LanguageSwitch() {
  const current = useLanguage();
  return (
    <button
      className="language-switch"
      type="button"
      onClick={() => setLanguage(current === "th" ? "en" : "th")}
      aria-label={current === "th" ? "Switch to English" : "เปลี่ยนเป็นภาษาไทย"}
      title={current === "th" ? "Switch to English" : "เปลี่ยนเป็นภาษาไทย"}
    >
      <span className={current === "th" ? "selected" : ""}>TH</span>
      <span aria-hidden="true">/</span>
      <span className={current === "en" ? "selected" : ""}>EN</span>
    </button>
  );
}
