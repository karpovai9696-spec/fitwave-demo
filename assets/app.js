// FitWave local skeleton — DRAFT / implementation target only.
// FW-PHASE2-IMPLEMENT-002 (commit 2): hash-based local router +
// in-memory, session-only demo state.
// No fetch / XMLHttpRequest / WebSocket / storage persistence. No network.

(function () {
  "use strict";

  // ------------------------------------------------------------------
  // Canonical hash routes -> page files. "#/landing" is the default route.
  // One screen per static page; the router normalizes hashes, redirects
  // cross-screen hashes to the right page, and keeps browser back/forward
  // working through real history entries.
  // ------------------------------------------------------------------
  // Nav hrefs intentionally stay plain file links so the skeleton degrades
  // gracefully without JS; the click handler below adds the canonical
  // hash, and cross-screen hashes redirect to the owning page. Back/forward
  // works through real history entries.
  var FILE_ROUTES = {
    "index.html": "#/landing",
    "login.html": "#/login",
    "register.html": "#/register",
    "consent-gate.html": "#/consent-gate",
    "plan-home.html": "#/plan-home",
    "cycle-entry.html": "#/cycle-entry",
    "wellness-illness-entry.html": "#/wellness-illness-entry",
    "progress.html": "#/progress",
    "profile-setup.html": "#/profile-setup",
    "plan-week.html": "#/plan-week",
    "plan-session.html": "#/plan-session",
    "support-list.html": "#/support-list",
    "news-list.html": "#/news-list",
    "news-article.html": "#/news-article",
    "password-recovery.html": "#/password-recovery",
    // FW-PHASE2-IMPLEMENT-006: admin skeleton screens, DRAFT/mock only.
    // Separate admin nav; admin access is not enabled.
    "admin-login.html": "#/admin-login",
    "admin-dashboard.html": "#/admin-dashboard",
    "admin-users.html": "#/admin-users",
    "admin-exercises.html": "#/admin-exercises",
    "admin-news.html": "#/admin-news",
    "admin-support.html": "#/admin-support",
    "admin-analytics.html": "#/admin-analytics"
  };
  var ROUTES = {};
  Object.keys(FILE_ROUTES).forEach(function (file) {
    ROUTES[FILE_ROUTES[file]] = file;
  });
  var ROUTE_NAMES = Object.keys(ROUTES);

  var here = location.pathname.split("/").pop() || "index.html";
  var myRoute = null;
  ROUTE_NAMES.forEach(function (r) {
    if (ROUTES[r] === here) { myRoute = r; }
  });
  if (!myRoute) { myRoute = "#/landing"; }

  function knownRoute(hash) {
    return Object.prototype.hasOwnProperty.call(ROUTES, hash);
  }

  // Default route + repair of unknown hashes on this page.
  function normalize() {
    if (!knownRoute(location.hash)) {
      history.replaceState(null, "", myRoute);
    }
  }

  // Cross-screen route on the wrong page -> go to the owning page,
  // preserving the hash. Same-page hash changes need no re-render.
  function resolve(pushHistory) {
    if (!knownRoute(location.hash)) {
      history.replaceState(null, "", myRoute);
      return;
    }
    if (ROUTES[location.hash] !== here) {
      var target = ROUTES[location.hash] + location.hash;
      if (pushHistory) {
        location.href = target; // real history entry: back/forward works
      } else {
        location.replace(target); // load-time repair: no extra entry
      }
    }
  }

  // ------------------------------------------------------------------
  // FW-PHASE2-IMPLEMENT-008: in-page cross-route flow demo (plan flow).
  // FW-PHASE2-IMPLEMENT-010: extended to the cycle/wellness/progress
  // flow. On plan-home, the #/plan-week and #/plan-session routes render
  // INLINE (hidden sections on this page) instead of triggering a page
  // load, so the module-scope demoState survives the hash navigation.
  // On cycle-entry, #/wellness-illness-entry and #/progress render
  // inline the same way; on support-list, #/support-thread renders
  // inline as the mock thread step; on profile-setup,
  // #/profile-consent-preview renders inline as the mock consent
  // preview step; on login, the #/auth-*-demo routes render inline as
  // the mock auth demo steps; on news-list, #/news-article-preview
  // renders inline as the mock article preview step; on
  // admin-dashboard, the #/admin-*-demo routes render inline as the
  // mock admin module demo steps. State still lives for this page load
  // only and resets on reload; nothing is ever persisted.
  // ------------------------------------------------------------------
  var INLINE_ROUTES = {
    "#/plan-week": "flow-plan-week",
    "#/plan-session": "flow-plan-session",
    "#/wellness-illness-entry": "flow-wellness-illness",
    "#/progress": "flow-progress",
    "#/support-thread": "flow-support-thread",
    "#/profile-consent-preview": "flow-profile-consent",
    "#/auth-register-demo": "flow-auth-register",
    "#/auth-password-recovery-demo": "flow-auth-password-recovery",
    "#/auth-profile-setup-demo": "flow-auth-profile-setup",
    "#/news-article-preview": "flow-news-article",
    "#/admin-users-demo": "flow-admin-users",
    "#/admin-exercises-demo": "flow-admin-exercises",
    "#/admin-news-demo": "flow-admin-news",
    "#/admin-support-demo": "flow-admin-support",
    "#/admin-analytics-demo": "flow-admin-analytics"
  };

  function renderFlow(hash) {
    var id = INLINE_ROUTES[hash];
    if (!id) { return false; }
    var target = document.getElementById(id);
    if (!target) { return false; } // not on plan-home: fall through
    document.querySelectorAll("[data-flow-screen]").forEach(function (el) {
      el.hidden = el !== target;
    });
    document.querySelectorAll(".topnav a").forEach(function (a) {
      var href = a.getAttribute("href") || "";
      if (FILE_ROUTES[href] === hash) {
        a.setAttribute("aria-current", "page");
      } else {
        a.removeAttribute("aria-current");
      }
    });
    var h = target.querySelector("h1");
    if (h) {
      h.setAttribute("tabindex", "-1");
      h.focus({ preventScroll: true });
    }
    return true;
  }

  window.addEventListener("hashchange", function () {
    if (renderFlow(location.hash)) { return; } // in-page flow: no reload
    resolve(true);
  });

  normalize();
  if (!renderFlow(location.hash)) { resolve(false); }

  // ------------------------------------------------------------------
  // Accessible nav marker: aria-current follows the active route.
  // ------------------------------------------------------------------
  function markCurrentNav() {
    document.querySelectorAll(".topnav a").forEach(function (a) {
      var href = a.getAttribute("href") || "";
      if (href === here ||
          (ROUTES[location.hash] === href)) {
        a.setAttribute("aria-current", "page");
      } else {
        a.removeAttribute("aria-current");
      }
    });
  }
  markCurrentNav();

  // Intercept internal nav clicks to add the canonical hash route. Without
  // JS the plain file links still work (multi-page fallback).
  document.querySelectorAll(".topnav a").forEach(function (a) {
    a.addEventListener("click", function (ev) {
      var href = a.getAttribute("href") || "";
      if (!Object.prototype.hasOwnProperty.call(FILE_ROUTES, href)) {
        return; // not an internal route link
      }
      ev.preventDefault();
      var route = FILE_ROUTES[href];
      if (href === here) {
        if (location.hash !== route) { location.hash = route; }
      } else if (INLINE_ROUTES[route] &&
                 document.getElementById(INLINE_ROUTES[route])) {
        // In-page flow route on this screen: hash change only, no reload,
        // so demoState survives (FW-PHASE2-IMPLEMENT-008).
        if (location.hash !== route) { location.hash = route; }
      } else {
        location.href = href + route; // history entry: back/forward works
      }
    });
  });

  // ------------------------------------------------------------------
  // Keyboard focus management: move focus to the screen heading on load
  // so keyboard users land on content after route changes.
  // ------------------------------------------------------------------
  var heading = document.querySelector("main h1");
  if (heading && heading.offsetParent !== null) {
    heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
  }

  // ------------------------------------------------------------------
  // In-memory, session-only demo state.
  // Deliberately NOT persisted: no localStorage, no sessionStorage,
  // no indexedDB, no cookies. State lives for this page load only and
  // resets on navigation or reload — that is the DRAFT-safe behavior.
  // ------------------------------------------------------------------
  var demoState = {
    user: null,             // demo login/register only; never real data
    consentAccepted: false, // demo consent-gate only
    flowSelection: null,    // FW-PHASE2-IMPLEMENT-008 flow demo, page-load only
    flowCycle: null,        // FW-PHASE2-IMPLEMENT-010 cycle flow, page-load only
    flowWellness: null,     // FW-PHASE2-IMPLEMENT-010 wellness flow, page-load only
    flowSupport: null,      // FW-PHASE2-IMPLEMENT-011 support thread, page-load only
    flowProfileConsent: null, // FW-PHASE2-IMPLEMENT-012 profile/consent preview, page-load only
    flowAuth: null,         // FW-PHASE2-IMPLEMENT-013 auth demo steps, page-load only
    flowNews: null,         // FW-PHASE2-IMPLEMENT-014 news article preview, page-load only
    flowAdmin: null         // FW-PHASE2-IMPLEMENT-015 admin module demos, page-load only
  };

  function demoNote(form, message) {
    var note = form.querySelector("[data-demo-note]");
    if (note) {
      note.textContent = message;
      note.hidden = false;
    }
  }

  // Demo forms are inert by design: no backend exists (services/ are empty
  // skeletons). They only touch the in-memory demo state above.
  document.querySelectorAll("form[data-demo]").forEach(function (form) {
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var kind = form.getAttribute("data-demo");
      if (kind === "login" || kind === "register") {
        demoState.user = { email: "(демо, только в памяти)" };
        demoNote(form, "Демо: данные записаны в демо-состояние в памяти только на время " +
                       "этой загрузки страницы (нигде не сохраняются). " +
                       "Аутентификации ещё нет (fw-identity — пустой макет; " +
                       "контракты в статусе ЧЕРНОВИК).");
      } else if (kind === "consent") {
        demoState.consentAccepted = true;
        demoNote(form, "Демо: согласие отмечено в демо-состоянии в памяти только на время " +
                       "этой загрузки страницы (нигде не сохраняется). " +
                       "consent_version остаётся UNKNOWN; юридический текст — " +
                       "несогласованная заглушка.");
      } else if (kind === "flow-week") {
        demoState.flowSelection = "неделя выбрана (демо)";
        demoNote(form, "Демо: выбор сохранён в демо-состоянии в памяти только на время " +
                       "этой загрузки; ничего не сохраняется.");
        reflectFlowState();
      } else if (kind === "flow-session") {
        demoNote(form, "Демо: записи сессии не существует; ничего не отправлено " +
                       "и не сохранено.");
      } else if (kind === "flow-cycle") {
        demoState.flowCycle = "отметка цикла внесена (демо)";
        demoNote(form, "Демо: отметка сохранена в демо-состоянии в памяти только на время " +
                       "этой загрузки; ничего не сохраняется. Данные цикла " +
                       "остаются условной статистической оценкой.");
        reflectFlowState();
      } else if (kind === "flow-wellness") {
        demoState.flowWellness = "сигнал самочувствия записан (демо)";
        demoNote(form, "Демо: сигнал сохранён в демо-состоянии в памяти только на время " +
                       "этой загрузки; ничего не сохраняется. Только справочно " +
                       "(FW-IR-001); рекомендаций не даётся.");
        reflectFlowState();
      } else if (kind === "flow-support") {
        demoState.flowSupport = "тема открыта (демо)";
        demoNote(form, "Демо: выбор темы сохранён в демо-состоянии в памяти только на время " +
                       "этой загрузки; ничего не сохраняется. Содержимое ветки — " +
                       "условный макет; ответ не отправляется, уведомления " +
                       "не формируются (CA-O7 ЗАБЛОКИРОВАНО).");
        reflectFlowState();
      } else if (kind === "flow-profile-consent") {
        demoState.flowProfileConsent = "настройки отмечены (демо)";
        demoNote(form, "Демо: настройки сохранены в демо-состоянии в памяти только на время " +
                       "этой загрузки; ничего не сохраняется. Согласие здесь " +
                       "не принимается; consent_version остаётся UNKNOWN, " +
                       "юридический текст — только заглушка.");
        reflectFlowState();
      } else if (kind === "flow-auth") {
        demoState.flowAuth = "шаг авторизации отмечен (демо)";
        demoNote(form, "Демо: шаг авторизации отмечен в демо-состоянии в памяти только на " +
                       "время этой загрузки; ничего не сохраняется. Реальная " +
                       "аутентификация не выполняется; учётные данные не " +
                       "принимаются, не проверяются и не сохраняются; " +
                       "аккаунт не создаётся (fw-identity — пустой макет; " +
                       "контракты в статусе ЧЕРНОВИК).");
        reflectFlowState();
      } else if (kind === "flow-news") {
        demoState.flowNews = "статья открыта (демо)";
        demoNote(form, "Демо: выбор статьи сохранён в демо-состоянии в памяти только на " +
                       "время этой загрузки; ничего не сохраняется. Текст статьи — " +
                       "условный макет; CMS не подключена, уведомления не " +
                       "отправляются (CA-O7 ЗАБЛОКИРОВАНО), внешний контент " +
                       "не загружается.");
        reflectFlowState();
      } else if (kind === "flow-admin") {
        demoState.flowAdmin = "модуль админки отмечен (демо)";
        demoNote(form, "Демо: модуль админки отмечен в демо-состоянии в памяти только на " +
                       "время этой загрузки; ничего не сохраняется. Реальный " +
                       "админ-доступ не предоставляется; ролевая модель (RBAC) " +
                       "не реализована; данных пользователей, поддержки, CMS, " +
                       "упражнений, платежей, уведомлений и аналитики не " +
                       "существует (fw-backoffice — пустой макет; контракты " +
                       "в статусе ЧЕРНОВИК).");
        reflectFlowState();
      } else {
        demoNote(form, "Демо: бэкенда нет; ничего не отправлено и не сохранено.");
      }
    });
  });

  // FW-PHASE2-IMPLEMENT-008/010: reflect the flow selections into any
  // visible [data-flow-state] element (the plan session step and the
  // cycle flow progress step show them). This is the cross-route proof:
  // values recorded on earlier steps are still here after the hash-only
  // navigation, because no page load happened.
  function reflectFlowState() {
    var parts = [];
    if (demoState.flowSelection) { parts.push("неделя: " + demoState.flowSelection); }
    if (demoState.flowCycle) { parts.push("цикл: " + demoState.flowCycle); }
    if (demoState.flowWellness) { parts.push("самочувствие: " + demoState.flowWellness); }
    if (demoState.flowSupport) { parts.push("поддержка: " + demoState.flowSupport); }
    if (demoState.flowProfileConsent) { parts.push("профиль-согласие: " + demoState.flowProfileConsent); }
    if (demoState.flowAuth) { parts.push("авторизация: " + demoState.flowAuth); }
    if (demoState.flowNews) { parts.push("новости: " + demoState.flowNews); }
    if (demoState.flowAdmin) { parts.push("админка: " + demoState.flowAdmin); }
    document.querySelectorAll("[data-flow-state]").forEach(function (el) {
      el.textContent = parts.length
        ? "Эта загрузка: " + parts.join("; ") +
          " — состояние живёт только до перезагрузки; ничего не сохраняется."
        : "В этой загрузке выбор не делался. Состояние живёт только " +
          "до перезагрузки; ничего не сохраняется.";
    });
  }
  reflectFlowState();

  // Where a screen exposes a session tag, reflect the demo state honestly.
  document.querySelectorAll("[data-demo-session]").forEach(function (el) {
    var parts = [];
    if (demoState.user) { parts.push("демо-пользователь (в памяти)"); }
    if (demoState.consentAccepted) { parts.push("демо-согласие (в памяти)"); }
    el.textContent = parts.length
      ? "Эта загрузка: " + parts.join(", ") +
        " — только в памяти, не сохраняется, сбрасывается при переходе."
      : "В этой загрузке демо-состояния нет. Оно живёт только в памяти, " +
        "не сохраняется и сбрасывается при переходе или перезагрузке.";
  });
})();


/* Лендинг 2025: мягкое появление секций (без библиотек). */
(function () {
  if (!document.body.classList.contains("landing-2025")) return;
  var nodes = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
  if (!nodes.length) return;
  if (!("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    nodes.forEach(function (n) { n.classList.add("is-in"); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
  nodes.forEach(function (n) { io.observe(n); });
})();
