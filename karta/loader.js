// Загружает авторский контент из Yandex Cloud: в Telegram — по подписи Telegram,
// в браузере — по ключу предпросмотра из ссылки (?key=...).
(async function () {
  const tg = window.Telegram && window.Telegram.WebApp;
  const api = window.KARTA_API;
  let key = "";
  try {
    const m = location.search.match(/[?&]key=([^&]+)/);
    if (m) { key = decodeURIComponent(m[1]); localStorage.setItem("karta-preview-key", key); history.replaceState(null, "", location.pathname + location.hash); }
    else key = localStorage.getItem("karta-preview-key") || "";
  } catch (e) {}
  const headers = {};
  if (tg && tg.initData) headers["X-Telegram-Init-Data"] = tg.initData;
  if (key) headers["X-Preview-Key"] = key;
  if (api && Object.keys(headers).length) {
    try {
      const r = await fetch(api, { headers });
      if (r.ok) window.CONTENT = await r.json();
    } catch (e) { /* остаемся на заглушках */ }
  }
  window.startApp();
})();
