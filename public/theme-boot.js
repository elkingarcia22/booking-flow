// Aplica el modo antes del primer pintado para evitar el flash claro→oscuro.
(function () {
  try {
    var raw = localStorage.getItem("thema-theme");
    var mode = raw ? JSON.parse(raw).mode : "dark";
    var dark = mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
