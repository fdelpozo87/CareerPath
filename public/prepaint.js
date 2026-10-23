// Apariencia e idioma antes del primer dibujado. Va como archivo (no en línea) para cumplir la CSP: script-src 'self'.
(function () {
  try {
    var l = localStorage.getItem('cp_lang');
    var en = l === 'en' || (l !== 'es' && (navigator.language || '').toLowerCase().indexOf('en') === 0);
    document.documentElement.setAttribute('lang', en ? 'en' : 'es');
    var m = localStorage.getItem('cp_theme');
    var dark = m === 'dark' || (m !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#150e24' : '#6a3fc1');
  } catch (e) {}
})();
