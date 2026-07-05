const THEME_KEY = "gesture.theme";

export function getInitialDarkMode(): boolean {
  if (typeof window === "undefined") return true;
  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored === "dark") return true;
  if (stored === "light") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;
}

export function applyTheme(darkMode: boolean) {
  document.documentElement.classList.toggle("dark", darkMode);
  window.localStorage.setItem(THEME_KEY, darkMode ? "dark" : "light");
}
