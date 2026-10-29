// Загружает авторский контент из Yandex Cloud (только для тех, кто пришел из Telegram).
(async function () {
  const tg = window.Telegram && window.Telegram.WebApp;
  const api = window.KARTA_API;
  if (api && tg && tg.initData) {
    try {
      const r = await fetch(api, { headers: { "X-Telegram-Init-Data": tg.initData } });
      if (r.ok) window.CONTENT = await r.json();
    } catch (e) { /* остаемся на встроенном демо-контенте */ }
  }
  window.startApp();
})();
