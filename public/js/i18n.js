// ── i18n: Multi-language support ────────────────────────────────
const I18n = (() => {
  let translations = {};
  let currentLang = 'en';

  const load = async (lang) => {
    try {
      const res = await fetch(`/locales/${lang}.json`);
      translations = await res.json();
      currentLang = lang;
      localStorage.setItem('lang', lang);
      applyAll();
    } catch (e) {
      console.warn('i18n load failed', e);
    }
  };

  const t = (key) => translations[key] || key;

  const applyAll = () => {
    document.querySelectorAll('[data-key]').forEach(el => {
      const key = el.getAttribute('data-key');
      if (el.tagName === 'INPUT') el.placeholder = t(key);
      else el.textContent = t(key);
    });
    document.querySelectorAll('[data-placeholder]').forEach(el => {
      el.placeholder = t(el.getAttribute('data-placeholder'));
    });
    // Update active lang pill
    document.querySelectorAll('.lang-pill').forEach(p => p.classList.remove('active-lang'));
    const activePill = document.querySelector(`.lang-pill[onclick*="'${currentLang}'"]`);
    if (activePill) activePill.classList.add('active-lang');
  };

  const getLang = () => currentLang;

  return { load, t, applyAll, getLang };
})();
