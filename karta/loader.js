// Загружает авторский контент из Yandex Cloud:
//  — в Telegram — по подписи Telegram (karta-api);
//  — на сайте / с ярлыка на телефоне — по сессии, полученной через бота (karta-bot, action "content");
//  — в браузере у Насти — по ключу предпросмотра из ссылки (?key=...).
(async function () {
  const tg = window.Telegram && window.Telegram.WebApp;
  const api = window.KARTA_API, bot = window.KARTA_BOT, botName = window.KARTA_BOT_NAME || "karta_glubini_bot";
  const ls = { get: (k) => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } }, set: (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (e) {} } };
  let key = "";
  try {
    const m = location.search.match(/[?&]key=([^&]+)/);
    if (m) { key = decodeURIComponent(m[1]); ls.set("karta-preview-key", key); history.replaceState(null, "", location.pathname + location.hash); }
    else key = ls.get("karta-preview-key");
  } catch (e) {}
  const inTg = !!(tg && tg.initData);
  const headers = {};
  if (inTg) headers["X-Telegram-Init-Data"] = tg.initData;
  if (key) headers["X-Preview-Key"] = key;

  // ---- сайт без Telegram: вход через бота ----
  if (!inTg && !key && bot) {
    const sess = ls.get("karta-session");
    if (!sess) return showLogin();
    headers["X-Session"] = sess;
    window.KARTA_WEB_USER = { first_name: ls.get("karta-session-name") };
    try {
      const r = await fetch(bot, { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, headers), body: JSON.stringify({ action: "content" }) });
      if (r.status === 401) { ls.set("karta-session", ""); return showLogin("Вход устарел, войди еще раз."); }
      if (r.status === 403) return showLogin("Приложение пока открыто не всем. Напишем в боте, когда можно будет зайти.");
      if (r.ok) window.CONTENT = await r.json();
    } catch (e) { /* нет сети — остаемся на сохраненном */ }
    window.KARTA_HEADERS = headers;
    return window.startApp();
  }

  window.KARTA_HEADERS = headers; // для проводника
  if (api && Object.keys(headers).length) {
    try {
      const r = await fetch(api, { headers });
      if (r.ok) window.CONTENT = await r.json();
    } catch (e) { /* остаемся на заглушках */ }
  }
  window.startApp();

  // ---- экран входа ----
  function showLogin(note) {
    const app = document.getElementById("app");
    document.body.classList.add("login-on");
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent), standalone = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone;
    const hint = standalone ? "" : ios
      ? "Чтобы открывать с экрана телефона: в Safari нажми «Поделиться» → «На экран Домой»."
      : "Чтобы открывать с экрана телефона: в Chrome нажми ⋮ → «Добавить на главный экран».";
    app.innerHTML = `<section class="login">
      <img class="login-i" src="img/icon-512.png" alt="">
      <h1>Карта Глубины</h1>
      <p class="login-t">Вход через Telegram-бота. Открой бота, нажми «Войти на сайте» и вернись сюда. Вход сохранится на этом устройстве.</p>
      ${note ? `<p class="login-n">${note}</p>` : ""}
      <button class="login-b" id="lgo">Войти через Telegram</button>
      <div class="login-w" id="lw" hidden>
        <p>Ждем подтверждения в Telegram…</p>
        <button class="login-l" id="lchk">Проверить вход</button>
        <a class="login-l" id="lagain" href="#">Открыть бота еще раз</a>
      </div>
      ${hint ? `<p class="login-h">${hint}</p>` : ""}
    </section>`;
    let nonce = "", timer = null, until = 0;
    try { const p = JSON.parse(ls.get("karta-login") || "null"); if (p && Date.now() - p.at < 9 * 60000) { nonce = p.n; until = p.at + 10 * 60000; } } catch (e) {}
    const link = () => "https://t.me/" + botName + "?start=login_" + nonce;
    const open = () => { const deep = "tg://resolve?domain=" + botName + "&start=login_" + nonce; location.href = deep; setTimeout(() => { if (document.visibilityState === "visible") window.open(link(), "_blank"); }, 1200); };
    const wait = () => { document.getElementById("lw").hidden = false; document.getElementById("lagain").href = link(); clearInterval(timer); timer = setInterval(check, 2000); };
    async function check() {
      if (!nonce || Date.now() > until) { clearInterval(timer); return; }
      if (document.visibilityState === "hidden") return;
      try {
        const r = await fetch(bot, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "login_check", nonce }) });
        const j = await r.json();
        if (j.session) { clearInterval(timer); ls.set("karta-session", j.session); ls.set("karta-session-name", j.name || ""); ls.set("karta-login", ""); history.replaceState(null, "", location.pathname + "#/"); location.reload(); }
        else if (j.error) { clearInterval(timer); ls.set("karta-login", ""); nonce = ""; document.getElementById("lw").hidden = true; alertNote(j.error === "closed" ? "Приложение пока открыто не всем." : "Ссылка устарела, нажми «Войти через Telegram» еще раз."); }
      } catch (e) {}
    }
    function alertNote(t) { let n = app.querySelector(".login-n"); if (!n) { n = document.createElement("p"); n.className = "login-n"; app.querySelector(".login-t").after(n); } n.textContent = t; }
    document.getElementById("lgo").onclick = () => {
      if (!nonce) {
        const a = new Uint8Array(16); crypto.getRandomValues(a);
        nonce = btoa(String.fromCharCode.apply(null, a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        until = Date.now() + 10 * 60000; ls.set("karta-login", JSON.stringify({ n: nonce, at: Date.now() }));
      }
      wait(); open();
    };
    document.getElementById("lchk").onclick = check;
    document.getElementById("lagain").onclick = (e) => { e.preventDefault(); open(); };
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
    if (nonce) { wait(); check(); }
  }
})();
