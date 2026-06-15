export const themeScript = `
try {
  const stored = localStorage.getItem("agent-arena-theme");
  if (stored === "light") {
    document.documentElement.classList.remove("dark");
  } else {
    document.documentElement.classList.add("dark");
  }
} catch (_) {}
`;
