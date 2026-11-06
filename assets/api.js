/* FitWave API client — real beta backend integration.
   Loaded after config.js; falls back to the browser demo when the API is
   unavailable or the user is not signed in. Bearer token lives only in
   sessionStorage of the current tab. */
(function () {
  "use strict";
  var base = (window.FITWAVE_API_BASE || "").replace(/\/$/, "");
  if (!base) { return; }

  var KEY = "fitwave.auth.v1";
  var here = location.pathname.split("/").pop() || "index.html";
  var USER_PAGES = ["plan-home.html", "plan-week.html", "plan-session.html",
    "cycle-entry.html", "wellness-illness-entry.html", "progress.html",
    "profile-setup.html", "support-list.html", "news-list.html",
    "news-article.html"];

  function auth() {
    try { return JSON.parse(sessionStorage.getItem(KEY) || "null"); }
    catch (e) { return null; }
  }
  function setAuth(value) {
    if (value) { sessionStorage.setItem(KEY, JSON.stringify(value)); }
    else { sessionStorage.removeItem(KEY); }
  }
  function token() { var a = auth(); return a && a.token; }

  function api(path, options) {
    options = options || {};
    var headers = options.headers || {};
    headers["Accept"] = "application/json";
    if (options.body) { headers["Content-Type"] = "application/json"; }
    var t = token();
    if (t) { headers["Authorization"] = "Bearer " + t; }
    return fetch(base + path, {
      method: options.method || "GET",
      headers: headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      credentials: "omit",
      cache: "no-store"
    }).then(function (r) {
      return r.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
        if (r.status === 401) { setAuth(null); }
        if (!r.ok) {
          var code = data && data.detail && (data.detail.code || data.detail);
          var err = new Error(typeof code === "string" ? code : "API_ERROR");
          err.status = r.status;
          throw err;
        }
        return data;
      });
    });
  }

  function msg(el, text, isError) {
    if (!el) { return; }
    el.textContent = text;
    el.hidden = false;
    el.style.color = isError ? "#ff8f7a" : "";
  }

  function requireAuth() {
    if (!token()) { location.replace("login.html?mode=login"); return false; }
    return true;
  }

  // ---------------------------------------------------------------- auth
  if (here === "login.html") {
    document.querySelectorAll("[data-auth-panel]").forEach(function (form) {
      form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        var mode = form.getAttribute("data-auth-panel");
        var email = form.querySelector('input[type="email"]');
        var pass = form.querySelector('input[type="password"]');
        var out = form.querySelector("[data-auth-message]");
        if (!email || email.value.indexOf("@") < 1) {
          return msg(out, "Введите корректный e-mail.", true);
        }
        if (!pass || pass.value.length < 8) {
          return msg(out, "Пароль — минимум 8 символов.", true);
        }
        var payload;
        if (mode === "register") {
          var name = form.querySelector('input[type="text"]');
          var consent = form.querySelector('input[type="checkbox"]');
          if (!name || !name.value.trim()) {
            return msg(out, "Введите имя.", true);
          }
          if (!consent || !consent.checked) {
            return msg(out, "Отметьте согласие на обработку данных (бета).", true);
          }
          payload = { email: email.value.trim(), password: pass.value,
            name: name.value.trim(), consent_version: "beta-1" };
        } else {
          payload = { email: email.value.trim(), password: pass.value };
        }
        var path = mode === "register" ? "/api/auth/register" : "/api/auth/login";
        msg(out, "Подключаемся к бэкенду…", false);
        api(path, { method: "POST", body: payload }).then(function (data) {
          setAuth({ token: data.token, user: data.user });
          location.href = "plan-home.html";
        }).catch(function (err) {
          var map = {
            AUTH_INVALID_CREDENTIALS: "Неверный e-mail или пароль.",
            AUTH_EMAIL_EXISTS: "Аккаунт с таким e-mail уже есть.",
            AUTH_RATE_LIMITED: "Слишком много попыток. Подождите 15 минут.",
            CONSENT_REQUIRED: "Нужно согласие на обработку данных.",
            "FW-VALIDATION-001": "Проверьте поля формы."
          };
          msg(out, map[err.message] || "Ошибка API: " + err.message, true);
        });
      }, true);
    });
    var google = document.querySelector("[data-auth-google]");
    var note = document.querySelector("[data-auth-google-note]");
    if (google && note) {
      google.addEventListener("click", function () {
        note.hidden = false;
        note.textContent = "Google-вход ещё не подключён: бэкенд готов, но нужен OAuth Client ID в Google Cloud и его проверка на сервере.";
      });
    }
    return;
  }

  // ------------------------------------------------------- protected pages
  if (USER_PAGES.indexOf(here) >= 0 && !requireAuth()) { return; }

  function fillSession(name) {
    document.querySelectorAll("[data-demo-session]").forEach(function (el) {
      el.textContent = "Вы вошли как " + (name || "пользователь") +
        ". Данные хранятся на сервере FitWave (бета) и доступны с вашего аккаунта.";
    });
  }

  if (here === "plan-home.html") {
    Promise.all([api("/api/me"), api("/api/progress")]).then(function (res) {
      var me = res[0], pr = res[1];
      fillSession(me.user.name);
      var host = document.querySelector("main");
      var status = document.querySelector("[data-demo-status]");
      if (!status && host) {
        status = document.createElement("p");
        status.className = "demo-status";
        status.setAttribute("data-demo-status", "");
        host.insertBefore(status, host.firstChild.nextSibling);
      }
      if (status) {
        status.textContent = "Сессий: " + pr.sessions_completed +
          " · дней недели: " + pr.week_days_completed +
          " · отметок цикла: " + pr.cycle_entries +
          " · сигналов самочувствия: " + pr.wellness_events;
      }
    }).catch(function (err) {
      if (err.status === 401) { location.replace("login.html?mode=login"); }
    });
  }

  if (here === "plan-week.html" && token()) {
    var main = document.querySelector("main");
    function renderWeek() {
      api("/api/plan/week").then(function (data) {
        var rows = document.querySelectorAll(".plan-day");
        rows.forEach(function (r) { r.remove(); });
        var labels = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
        var done = data.days.filter(function (x) { return x.completed; }).length;
        var st = document.querySelector("[data-demo-status]");
        if (!st) {
          st = document.createElement("p");
          st.className = "demo-status";
          st.setAttribute("data-demo-status", "");
          main.insertBefore(st, main.firstChild);
        }
        st.textContent = "Отмечено " + done + " из " + data.days.length +
          " дней (сервер).";
        data.days.forEach(function (d) {
          var row = document.createElement("div");
          row.className = "plan-day";
          var date = new Date(d.day + "T00:00:00");
          var day = document.createElement("span");
          day.className = "day";
          day.textContent = labels[date.getDay()];
          var title = document.createElement("span");
          title.textContent = d.title;
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "demo-done";
          btn.textContent = d.completed ? "Готово" : "Отметить";
          btn.setAttribute("aria-pressed", d.completed ? "true" : "false");
          if (d.completed) { row.classList.add("is-done"); }
          btn.addEventListener("click", function () {
            api("/api/plan/day/" + d.day + "/complete",
              { method: "POST", body: { completed: !d.completed } })
              .then(renderWeek)
              .catch(function (e) { alert("Не удалось сохранить: " + e.message); });
          });
          row.appendChild(day);
          row.appendChild(title);
          row.appendChild(btn);
          main.appendChild(row);
        });
      }).catch(function (e) {
        if (e.status === 401) { location.replace("login.html?mode=login"); }
      });
    }
    renderWeek();
  }

  function bindListForm(kind, path, collect, render) {
    var form = document.querySelector('form[data-demo="' + kind + '"]');
    if (!form || !token()) { return; }
    var host = form.parentNode;
    var list = document.createElement("div");
    list.className = "demo-list";
    list.setAttribute("aria-live", "polite");
    host.insertBefore(list, form.nextSibling);
    function load() {
      api(path).then(function (data) {
        var items = data.entries || data.events || [];
        list.innerHTML = "";
        if (!items.length) {
          list.innerHTML = '<p class="muted">Пока нет записей.</p>';
          return;
        }
        items.forEach(function (it) { list.appendChild(render(it)); });
      }).catch(function (e) {
        if (e.status === 401) { location.replace("login.html?mode=login"); }
      });
    }
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      api(path, { method: "POST", body: collect(form) }).then(function () {
        load();
      }).catch(function (e) {
        var note = form.querySelector("[data-demo-note]");
        if (note) {
          note.textContent = "Ошибка сохранения: " + e.message;
          note.hidden = false;
        }
      });
    }, true);
    load();
  }

  if (here === "cycle-entry.html") {
    bindListForm("cycle-entry", "/api/cycle/entries",
      function (f) {
        var d = f.querySelector("#day");
        var flow = f.querySelector('input[name="flow"]:checked');
        var note = f.querySelector("#note");
        var sym = Array.prototype.map.call(
          f.querySelectorAll('input[type="checkbox"]:checked'),
          function (c) { return c.parentNode.textContent.trim(); });
        return { day: d && d.value ? d.value : new Date().toISOString().slice(0, 10),
          flow: flow ? flow.parentNode.textContent.trim() : "",
          symptoms: sym, note: note ? note.value : "" };
      },
      function (it) {
        var row = document.createElement("div");
        row.className = "demo-entry";
        row.textContent = it.day + " · " + (it.flow || "без потока") +
          (it.symptoms && it.symptoms.length ? " · " + it.symptoms.join(", ") : "") +
          (it.note ? " · " + it.note : "");
        return row;
      });
  }

  if (here === "wellness-illness-entry.html") {
    bindListForm("wellness", "/api/wellness/events",
      function (f) {
        var feel = f.querySelector('input[name="feel"]:checked');
        var sleep = f.querySelector("#sleep");
        var note = f.querySelector("#illnote");
        return { day: new Date().toISOString().slice(0, 10),
          energy: feel ? feel.parentNode.textContent.trim() : "",
          sleep: sleep ? sleep.value : "", note: note ? note.value : "" };
      },
      function (it) {
        var row = document.createElement("div");
        row.className = "demo-entry";
        row.textContent = it.day + " · " + (it.energy || "не отмечено") +
          (it.sleep ? " · сон: " + it.sleep : "") +
          (it.note ? " · " + it.note : "");
        return row;
      });
  }

  if (here === "progress.html") {
    api("/api/progress").then(function (pr) {
      var main = document.querySelector("main");
      var card = document.createElement("section");
      card.className = "card";
      card.innerHTML = "<h2>Ваш прогресс (сервер)</h2>" +
        '<div class="demo-stats">' +
        "<div><strong>" + pr.sessions_completed + "</strong><span>сессий</span></div>" +
        "<div><strong>" + pr.week_days_completed + "</strong><span>дней недели</span></div>" +
        "<div><strong>" + pr.cycle_entries + "</strong><span>отметок цикла</span></div>" +
        "<div><strong>" + pr.wellness_events + "</strong><span>сигналов</span></div>" +
        "</div>";
      main.insertBefore(card, main.firstChild.nextSibling);
    }).catch(function (e) {
      if (e.status === 401) { location.replace("login.html?mode=login"); }
    });
  }

  if (here === "profile-setup.html") {
    var pform = document.querySelector('form[data-demo="profile"]');
    if (pform && token()) {
      api("/api/me").then(function (me) {
        var name = pform.querySelector("#display-name");
        if (name && me.user.name) { name.value = me.user.name; }
        var exp = pform.querySelector('input[name="exp"][value="' +
          me.profile.experience + '"]');
        if (exp) { exp.checked = true; }
        var dayMap = { "Пн": "mon", "Вт": "tue", "Ср": "wed", "Чт": "thu",
          "Пт": "fri", "Сб": "sat", "Вс": "sun" };
        pform.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
          var label = (cb.parentNode.textContent || "").trim();
          var code = dayMap[label];
          if (code) { cb.checked = (me.profile.days || []).indexOf(code) >= 0; }
        });
      }).catch(function () {});
      pform.addEventListener("submit", function (ev) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        var name = pform.querySelector("#display-name");
        var exp = pform.querySelector('input[name="exp"]:checked');
        var dayCodes = { "Пн": "mon", "Вт": "tue", "Ср": "wed", "Чт": "thu",
          "Пт": "fri", "Сб": "sat", "Вс": "sun" };
        var days = Array.prototype.map.call(
          pform.querySelectorAll('input[type="checkbox"]:checked'),
          function (c) {
            return dayCodes[(c.parentNode.textContent || "").trim()] || "";
          }).filter(Boolean);
        api("/api/me/profile", { method: "PUT", body: {
          name: name ? name.value.trim() : "",
          experience: exp ? exp.value : "beginner",
          days: days, goal: "" } }).then(function () {
            var note = pform.querySelector("[data-demo-note]");
            if (note) { note.textContent = "Профиль сохранён на сервере."; note.hidden = false; }
          }).catch(function (e) {
            var note = pform.querySelector("[data-demo-note]");
            if (note) { note.textContent = "Ошибка: " + e.message; note.hidden = false; }
          });
      }, true);
    }
  }

  // profile: data export / account deletion (privacy)
  if (here === "profile-setup.html" && token()) {
    var mainP = document.querySelector("main");
    if (mainP) {
      var box = document.createElement("section");
      box.className = "card";
      box.innerHTML = "<h2>Данные и аккаунт</h2>" +
        "<p class='muted'>Бета: вы можете скачать свои данные или удалить " +
        "аккаунт вместе со всеми записями. Это не заменяет юридическую " +
        "политику и не является медицинским сервисом (FW-IR-001).</p>";
      var dl = document.createElement("button");
      dl.type = "button"; dl.className = "button secondary";
      dl.textContent = "Скачать мои данные (JSON)";
      dl.addEventListener("click", function () {
        fetch(base + "/api/me/export", {
          headers: { "Authorization": "Bearer " + token() },
          cache: "no-store"
        }).then(function (r) { return r.blob(); }).then(function (blob) {
          var a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = "fitwave-my-data.json";
          document.body.appendChild(a); a.click(); a.remove();
        }).catch(function () { alert("Не удалось скачать данные."); });
      });
      var del = document.createElement("button");
      del.type = "button"; del.className = "button ghost";
      del.textContent = "Удалить аккаунт и данные";
      del.style.marginLeft = "10px";
      del.addEventListener("click", function () {
        if (!confirm("Удалить аккаунт и все демо-данные без возможности восстановления?")) { return; }
        api("/api/me", { method: "DELETE", body: { confirm: "DELETE" } })
          .then(function () {
            setAuth(null);
            alert("Аккаунт удалён.");
            location.href = "index.html";
          }).catch(function (e) { alert("Ошибка удаления: " + e.message); });
      });
      box.appendChild(dl); box.appendChild(del);
      mainP.appendChild(box);
    }
  }

  // logout: clear server session when possible
  document.querySelectorAll(".topnav a").forEach(function (a) {
    if ((a.textContent || "").trim() === "Выйти") {
      a.addEventListener("click", function (ev) {
        ev.preventDefault();
        var had = !!token();
        if (had) {
          api("/api/auth/logout", { method: "POST" }).catch(function () {})
            .then(function () { setAuth(null); location.href = "index.html"; });
        } else {
          setAuth(null); location.href = "index.html";
        }
      });
    }
  });
})();
