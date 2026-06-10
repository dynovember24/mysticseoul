/* ============================================================
   Mystic Seoul — lightweight i18n engine
   - English lives in the HTML (snapshotted as the fallback).
   - Other languages live in TRANSLATIONS below.
   - Persisted in localStorage; flags in the header switch language.
   Add a string: give the element data-i18n="some.key" and add
   "some.key" to ko / zh / fr / ja below. English needs nothing.
   ============================================================ */
(function () {
  'use strict';

  var LANGS = ['en', 'ko', 'zh', 'fr', 'ja'];
  var LOCALE = { en: 'en-US', ko: 'ko-KR', zh: 'zh-CN', fr: 'fr-FR', ja: 'ja-JP' };

  // Translations are defined on window.MS_TRANSLATIONS (see translations file
  // appended at the bottom of this script).
  var T = window.MS_TRANSLATIONS || {};

  var state = { lang: 'en' };

  function dict(lang) { return T[lang] || {}; }

  // t() — for strings generated in JS (e.g. booking.js). English fallback lives
  // in T.en for these dynamic-only keys.
  function t(key, vars) {
    var v = (dict(state.lang)[key] != null) ? dict(state.lang)[key]
          : (dict('en')[key] != null ? dict('en')[key] : key);
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        v = v.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]);
      });
    }
    return v;
  }

  function looksLikeHtml(s) { return /[<&]/.test(s); }

  function applyTo(el) {
    if (el._i18nOrig === undefined) el._i18nOrig = el.innerHTML;
    var key = el.getAttribute('data-i18n');
    var v = (state.lang === 'en') ? el._i18nOrig
          : (dict(state.lang)[key] != null ? dict(state.lang)[key] : el._i18nOrig);
    if (v == null) return;
    if (looksLikeHtml(v)) el.innerHTML = v; else el.textContent = v;
  }

  function applyAttr(el, attr, dataAttr) {
    var cacheKey = '_i18nAttr_' + attr;
    if (el[cacheKey] === undefined) el[cacheKey] = el.getAttribute(attr) || '';
    var key = el.getAttribute(dataAttr);
    var v = (state.lang === 'en') ? el[cacheKey]
          : (dict(state.lang)[key] != null ? dict(state.lang)[key] : el[cacheKey]);
    if (v != null) el.setAttribute(attr, v);
  }

  function apply() {
    document.querySelectorAll('[data-i18n]').forEach(applyTo);
    document.querySelectorAll('[data-i18n-ph]').forEach(function (el) { applyAttr(el, 'placeholder', 'data-i18n-ph'); });
    document.querySelectorAll('[data-i18n-alt]').forEach(function (el) { applyAttr(el, 'alt', 'data-i18n-alt'); });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (el) { applyAttr(el, 'aria-label', 'data-i18n-aria'); });
    var _names={en:'English',ko:'한국어',zh:'中文',ja:'日本語',fr:'Français'};var _lc=document.getElementById('langCurrent');if(_lc)_lc.textContent=_names[state.lang]||'';
    document.documentElement.lang = state.lang;
    document.querySelectorAll('.lang-flag').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-lang') === state.lang);
      b.setAttribute('aria-pressed', b.getAttribute('data-lang') === state.lang ? 'true' : 'false');
    });
    document.dispatchEvent(new CustomEvent('i18n:changed', { detail: { lang: state.lang } }));
  }

  function setLang(lang) {
    if (LANGS.indexOf(lang) === -1) return;
    state.lang = lang;
    try { localStorage.setItem('ms_lang', lang); } catch (e) {}
    apply();
  }

  function init() {
    var saved;
    try { saved = localStorage.getItem('ms_lang'); } catch (e) {}
    if (!saved || LANGS.indexOf(saved) === -1) {
      // First visit: gently honour the browser language if we support it.
      var nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
      saved = LANGS.indexOf(nav) !== -1 ? nav : 'en';
    }
    state.lang = saved;
    document.addEventListener('click', function (e) {
      var f = e.target.closest ? e.target.closest('.lang-flag') : null;
      if (f) { e.preventDefault(); setLang(f.getAttribute('data-lang')); }
    });
    apply();
  }

  // Public API
  window.MSi18n = {
    t: t,
    setLang: setLang,
    get lang() { return state.lang; },
    locale: function () { return LOCALE[state.lang] || 'en-US'; }
  };
  window.t = t;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
