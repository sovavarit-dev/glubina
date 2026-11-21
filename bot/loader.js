// karta-bot: загрузчик. Код бота лежит в закрытом бакете (DATA_BUCKET/bot/main.js),
// чтобы обновлять его без пересоздания функции (переменные окружения не трогаются).
let M = null, at = 0;
async function load(token) {
  if (M && Date.now() - at < 300000) return M;
  const r = await fetch("https://storage.yandexcloud.net/" + process.env.DATA_BUCKET + "/bot/main.js", { headers: { "X-YaCloud-SubjectToken": token } });
  if (!r.ok) { if (M) return M; throw new Error("main.js " + r.status); }
  const src = await r.text(), m = { exports: {} };
  new Function("module", "exports", "require", src)(m, m.exports, require);
  M = m.exports; at = Date.now(); return M;
}
module.exports.handler = async function (event, context) {
  const mod = await load(context && context.token && context.token.access_token);
  return mod.handler(event, context);
};
