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

  function dayLabel(iso) {
    var labels = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
    return labels[new Date(iso + "T00:00:00").getDay()];
  }

  function exerciseLine(e) {
    return e.name + " · " + e.sets + "×" + e.reps +
      " · отдых " + e.rest_sec + "с · RPE " + e.rpe_target;
  }

  if (here === "plan-week.html" && token()) {
    var main = document.querySelector("main");
    function renderWeek() {
      api("/api/plan/week").then(function (data) {
        document.querySelectorAll(".plan-day, .plan-session-card")
          .forEach(function (r) { r.remove(); });
        var done = (data.sessions || []).filter(function (x) {
          return x.status === "completed";
        }).length;
        var st = document.querySelector("[data-demo-status]");
        if (!st) {
          st = document.createElement("p");
          st.className = "demo-status";
          st.setAttribute("data-demo-status", "");
          main.insertBefore(st, main.firstChild);
        }
        st.textContent = "Выполнено " + done + " из " +
          (data.sessions || []).length + " сессий · неделя " +
          data.week_start + " · версия " + data.plan_version;
        if (data.cycle && data.cycle.phase && data.cycle.phase !== "unknown") {
          var pnote = document.createElement("p");
          pnote.className = "muted";
          pnote.textContent = "Оценка цикла: " + data.cycle.phase +
            " (день " + data.cycle.cycle_day + ", уверенность " +
            data.cycle.confidence + "). " + data.cycle.note;
          main.insertBefore(pnote, st.nextSibling);
        }
        (data.sessions || []).forEach(function (s) {
          var card = document.createElement("section");
          card.className = "card plan-session-card";
          var h = document.createElement("h2");
          h.textContent = dayLabel(s.day) + " · " + s.title;
          card.appendChild(h);
          var meta = document.createElement("p");
          meta.className = "muted";
          meta.textContent = s.duration_min + " мин · фокус: " + s.focus +
            " · статус: " + (s.status === "completed" ? "выполнено" : "план");
          card.appendChild(meta);
          var ul = document.createElement("ul");
          s.blocks.main.forEach(function (e) {
            var li = document.createElement("li");
            li.textContent = exerciseLine(e);
            ul.appendChild(li);
          });
          card.appendChild(ul);
          if (s.why && s.why.length) {
            var why = document.createElement("p");
            why.className = "muted";
            why.textContent = "Почему так: " + s.why.join(" ");
            card.appendChild(why);
          }
          var open = document.createElement("a");
          open.className = "button secondary";
          open.href = "plan-session.html?key=" + encodeURIComponent(s.key);
          open.textContent = s.status === "completed"
            ? "Посмотреть сессию" : "Открыть сессию";
          card.appendChild(open);
          main.appendChild(card);
        });
        var disc = document.createElement("p");
        disc.className = "disclaimer";
        disc.textContent = data.disclaimer || "";
        main.appendChild(disc);
      }).catch(function (e) {
        if (e.status === 401) { location.replace("login.html?mode=login"); }
      });
    }
    renderWeek();
  }

  if (here === "plan-session.html" && token()) {
    var smain = document.querySelector("main");
    var demoForm = document.querySelector('form[data-demo="session"]');
    if (demoForm) { demoForm.hidden = true; }
    var key = new URLSearchParams(location.search).get("key");
    api("/api/plan/week").then(function (data) {
      var session = (data.sessions || []).filter(function (s) {
        return !key || s.key === key;
      })[0] || (data.sessions || [])[0];
      if (!session) { return; }
      document.querySelectorAll(".plan-day").forEach(function (r) { r.remove(); });
      var card = document.createElement("section");
      card.className = "card";
      var h = document.createElement("h2");
      h.textContent = dayLabel(session.day) + " · " + session.title;
      card.appendChild(h);
      var meta = document.createElement("p");
      meta.className = "muted";
      meta.textContent = session.duration_min + " мин · " + session.day;
      card.appendChild(meta);
      ["warmup", "main", "cooldown"].forEach(function (block) {
        var title = document.createElement("h3");
        title.textContent = { warmup: "Разминка", main: "Основная часть",
          cooldown: "Заминка" }[block];
        card.appendChild(title);
        var ul = document.createElement("ul");
        (session.blocks[block] || []).forEach(function (e) {
          var li = document.createElement("li");
          li.textContent = exerciseLine(e) + (e.note ? " — " + e.note : "");
          ul.appendChild(li);
        });
        card.appendChild(ul);
      });
      var why = document.createElement("p");
      why.className = "muted";
      why.textContent = "Почему так: " + (session.why || []).join(" ");
      card.appendChild(why);
      var f = document.createElement("form");
      f.className = "demo-form";
      f.innerHTML = "<h3>Как прошло?</h3>" +
        "<label for='ses-rpe'>Усилие (RPE 1–10)</label>" +
        "<select id='ses-rpe'><option>6</option><option selected>7</option>" +
        "<option>8</option><option>9</option><option>10</option></select>" +
        "<label for='ses-feedback'>Ощущение</label>" +
        "<select id='ses-feedback'><option value='as_planned'>как планировалось</option>" +
        "<option value='too_easy'>было легко</option>" +
        "<option value='too_hard'>было тяжело</option></select>" +
        "<label><input type='checkbox' id='ses-pain'> была боль</label>" +
        "<label for='ses-notes'>Заметка</label>" +
        "<textarea id='ses-notes' rows='2'></textarea>" +
        "<p><button type='submit'>Завершить сессию</button></p>" +
        "<p class='placeholder-box' data-session-note hidden></p>";
      f.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var note = f.querySelector("[data-session-note]");
        api("/api/plan/session/" + encodeURIComponent(session.key) + "/complete", {
          method: "POST", body: {
            rpe: parseInt(f.querySelector("#ses-rpe").value, 10),
            feedback: f.querySelector("#ses-feedback").value,
            pain: f.querySelector("#ses-pain").checked,
            notes: f.querySelector("#ses-notes").value
          }
        }).then(function (res) {
          note.hidden = false;
          note.textContent = (res.advice || []).join(" ") ||
            "Сессия сохранена на сервере.";
        }).catch(function (e) {
          note.hidden = false;
          note.textContent = "Ошибка сохранения: " + e.message;
        });
      });
      card.appendChild(f);
      smain.insertBefore(card, smain.firstChild.nextSibling);
    }).catch(function (e) {
      if (e.status === 401) { location.replace("login.html?mode=login"); }
    });
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
        var goalSel = pform.querySelector("#goal");
        if (goalSel) { goalSel.value = me.profile.goal || "tonus"; }
        var minsSel = pform.querySelector("#session-minutes");
        if (minsSel) { minsSel.value = String(me.profile.session_minutes || 30); }
        var cycSel = pform.querySelector("#cycle-override");
        if (cycSel) { cycSel.value = me.profile.cycle_override || "auto"; }
        pform.querySelectorAll('input[name="equipment"]').forEach(function (cb) {
          cb.checked = (me.profile.equipment || ["bodyweight"])
            .indexOf(cb.value) >= 0;
        });
        pform.querySelectorAll('input[name="restriction"]').forEach(function (cb) {
          cb.checked = (me.profile.restrictions || []).indexOf(cb.value) >= 0;
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
        var goalSel = pform.querySelector("#goal");
        var minsSel = pform.querySelector("#session-minutes");
        var cycSel = pform.querySelector("#cycle-override");
        var equipment = Array.prototype.map.call(
          pform.querySelectorAll('input[name="equipment"]:checked'),
          function (c) { return c.value; });
        var restrictions = Array.prototype.map.call(
          pform.querySelectorAll('input[name="restriction"]:checked'),
          function (c) { return c.value; });
        api("/api/me/profile", { method: "PUT", body: {
          name: name ? name.value.trim() : "",
          experience: exp ? exp.value : "beginner",
          days: days,
          goal: goalSel ? goalSel.value : "tonus",
          equipment: equipment.length ? equipment : ["bodyweight"],
          session_minutes: minsSel ? parseInt(minsSel.value, 10) : 30,
          restrictions: restrictions,
          cycle_override: cycSel ? cycSel.value : "auto" } }).then(function () {
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

      var passForm = document.createElement("form");
      passForm.className = "auth-form";
      passForm.style.marginTop = "18px";
      passForm.innerHTML = "<h3>Сменить пароль</h3>" +
        "<label for='cur-pass'>Текущий пароль</label>" +
        "<input id='cur-pass' type='password' autocomplete='current-password'>" +
        "<label for='new-pass'>Новый пароль (минимум 8 символов)</label>" +
        "<input id='new-pass' type='password' autocomplete='new-password'>" +
        "<button class='button secondary' type='submit'>Обновить пароль</button>" +
        "<p class='auth-hint' data-pass-msg hidden></p>";
      passForm.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var cur = passForm.querySelector("#cur-pass");
        var nw = passForm.querySelector("#new-pass");
        var pm = passForm.querySelector("[data-pass-msg]");
        api("/api/me/password", { method: "POST", body: {
          current_password: cur ? cur.value : "",
          new_password: nw ? nw.value : "" } }).then(function (data) {
            var a = auth() || {};
            setAuth({ token: data.token, user: a.user });
            pm.textContent = "Пароль обновлён; другие сессии завершены.";
            pm.hidden = false;
          }).catch(function (e) {
            pm.textContent = e.message === "AUTH_INVALID_CREDENTIALS"
              ? "Текущий пароль неверен." : "Ошибка: " + e.message;
            pm.hidden = false;
          });
      });
      box.appendChild(passForm);
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
