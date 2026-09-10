/* Applique le thème AVANT le premier rendu (évite le flash blanc/noir).
   Chargé en <script src> synchrone dans <head> — doit rester en phase avec
   src/lib/theme.tsx (getInitialTheme). Fichier externe = compatible CSP stricte. */
(function () {
  try {
    var t = localStorage.getItem('reiim-theme');
    if (t !== 'dark' && t !== 'light') {
      t = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    document.documentElement.classList.add(t);
  } catch (_) {
    document.documentElement.classList.add('dark');
  }
})();
