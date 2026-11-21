// Yandex Cloud Function «karta-bot» — бот @karta_glubini_bot.
// Два входа в одну функцию:
//   1) вебхук Telegram (POST от api.telegram.org) — команды /start, /help, /podpiska;
//   2) таймер (триггер раз в час) — напоминания о конце пробного периода и промокода.
// Еще умеет access — регистрация и промокод по запросу приложения (POST {action:"access"} c X-Telegram-Init-Data).
// Переменные окружения (вводит Настя сама, в консоли Яндекса):
//   BOT_TOKEN      — токен бота (тот же, что у karta-api)
//   BOT_SECRET     — секрет вебхука: Telegram присылает его в заголовке, чужие запросы отбрасываются
//   DATA_BUCKET    — закрытый бакет (karta-glubiny-content), записи о доступе лежат в users/
//   APP_URL        — адрес приложения (https://karta-glubiny-app.website.yandexcloud.net/ или https://kartaglubiny.ru/)
//   PROMO_CODES    — промокоды через запятую (GLUBINA12,GLUBINA13,GLUBINA14) — в коде их нет
//   PROMO_UNTIL    — последний день доступа по промокоду, 2026-12-30
//   NASTYA_ID      — Telegram ID Насти: ей приходят служебные сообщения
//   ALLOW_ORIGIN   — адрес приложения для CORS (можно несколько через запятую)
//   ALLOWED_IDS    — закрытый доступ: Telegram ID через запятую (пока только Настя). Пусто — открыто всем
//   SELF_URL       — адрес этой функции: бот сам подключает к нему вебхук, когда появляется токен
//   TG_API         — адрес посредника к api.telegram.org (из Yandex Cloud Telegram недоступен); пусто — напрямую
const crypto = require("crypto");

const DAY = 86400000, TRIAL_DAYS = 3;
const MSK = 3 * 3600000;

// ---------- хранилище (как в karta-api) ----------
const S3 = "https://storage.yandexcloud.net/";
async function getObj(token, bucket, key) {
  const r = await fetch(S3 + bucket + "/" + key, { headers: { "X-YaCloud-SubjectToken": token } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("storage_get " + r.status);
  return r.json();
}
async function putObj(token, bucket, key, obj) {
  const r = await fetch(S3 + bucket + "/" + key, { method: "PUT", headers: { "X-YaCloud-SubjectToken": token, "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(obj) });
  if (!r.ok) throw new Error("storage_put " + r.status);
}
async function listKeys(token, bucket, prefix) {
  const keys = []; let cont = "";
  for (let i = 0; i < 50; i++) {
    const q = "?list-type=2&max-keys=1000&prefix=" + encodeURIComponent(prefix) + (cont ? "&continuation-token=" + encodeURIComponent(cont) : "");
    const r = await fetch(S3 + bucket + q, { headers: { "X-YaCloud-SubjectToken": token } });
    if (!r.ok) throw new Error("storage_list " + r.status);
    const x = await r.text();
    for (const m of x.matchAll(/<Key>([^<]+)<\/Key>/g)) keys.push(m[1]);
    const n = x.match(/<NextContinuationToken>([^<]+)</); if (!n) break; cont = n[1];
  }
  return keys;
}

// ---------- Telegram ----------
// Из Yandex Cloud api.telegram.org недоступен. Поэтому:
//  — ответ на сообщение человека уходит прямо в ответе вебхука (Telegram сам его отправит), без исходящих запросов;
//  — исходящие (напоминания, пересылка Насте) идут через TG_API — адрес посредника вне РФ; пока его нет, они не отправляются.
let hookReply = null; // первый ответ в текущем вебхуке
async function tg(method, body) {
  if (hookReply === false && (method === "sendMessage")) { hookReply = Object.assign({ method }, body); return { ok: true, result: { message_id: 0 }, viaHook: true }; }
  const base = process.env.TG_API || "https://api.telegram.org";
  try {
    const r = await fetch(`${base}/bot${process.env.BOT_TOKEN}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(4000) });
    const j = await r.json().catch(() => ({}));
    if (!j.ok) console.log("tg", method, r.status, JSON.stringify(j).slice(0, 200));
    return j;
  } catch (e) { console.log("tg", method, "unreachable"); return { ok: false, description: "unreachable" }; }
}
const appUrl = (q) => (process.env.APP_URL || "https://karta-glubiny-app.website.yandexcloud.net/") + (q || "");
const openBtn = (text, q) => ({ inline_keyboard: [[{ text: text || "Приложение", web_app: { url: appUrl(q) } }]] });
const KB = { keyboard: [[{ text: "Приложение", web_app: { url: (process.env.APP_URL || "https://karta-glubiny-app.website.yandexcloud.net/") } }], [{ text: "Моя подписка" }, { text: "Помощь" }]], resize_keyboard: true, is_persistent: true };
const kbFor = (code) => code ? { keyboard: [[{ text: "Приложение", web_app: { url: (process.env.APP_URL || "https://karta-glubiny-app.website.yandexcloud.net/") + "?promo=" + code } }], [{ text: "Моя подписка" }, { text: "Помощь" }]], resize_keyboard: true, is_persistent: true } : KB;
const send = (chat, text, kb) => tg("sendMessage", Object.assign({ chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true }, kb ? { reply_markup: kb } : {}));

function checkInitData(initData, botToken) {
  if (!initData || !botToken) return null;
  const p = new URLSearchParams(initData), hash = p.get("hash"); if (!hash) return null; p.delete("hash");
  const dc = Array.from(p.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const calc = crypto.createHmac("sha256", secret).update(dc).digest("hex");
  if (calc.length !== hash.length || !crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(hash))) return null;
  if (Date.now() / 1000 - Number(p.get("auth_date") || 0) > 24 * 3600) return null;
  try { const u = JSON.parse(p.get("user") || "{}"); return u && u.id ? Object.assign(u, { start_param: p.get("start_param") || "" }) : null; } catch (e) { return null; }
}

// ---------- доступ ----------
const allowedList = () => String(process.env.ALLOWED_IDS || "").split(/[,;]/).map((x) => x.trim()).filter(Boolean);
const isAllowed = (id) => { const L = allowedList(); return !L.length || L.includes(String(id)); };
const codes = () => String(process.env.PROMO_CODES || "").split(/[,;]/).map((s) => s.trim().toUpperCase()).filter(Boolean);
const normCode = (v) => String(v || "").toUpperCase().replace(/\s+/g, "").replace(/^PROMO_/, "").replace(/^ГЛУБИНА/, "GLUBINA");
const promoEnd = () => new Date((process.env.PROMO_UNTIL || "2026-12-30") + "T23:59:59+03:00").getTime();
const ukey = (id) => "users/" + String(id).replace(/\D/g, "") + ".json";
function status(u, t) {
  t = t || Date.now();
  if (u.paidUntil && t < u.paidUntil) return { plan: u.tariff || "paid", until: u.paidUntil };
  if (u.promo && t < promoEnd()) return { plan: "promo", until: promoEnd(), code: u.promo };
  if (t < u.firstSeen + TRIAL_DAYS * DAY) return { plan: "trial", until: u.firstSeen + TRIAL_DAYS * DAY };
  return { plan: "expired", until: null };
}
// регистрация при первом входе + промокод (один код — один человек)
async function access(token, bucket, user, rawCode) {
  const t = Date.now();
  if (!isAllowed(user.id)) return { plan: "closed", until: null };
  let u = (await getObj(token, bucket, ukey(user.id))) || { id: user.id, firstSeen: t, sent: {} };
  const code = normCode(rawCode);
  let promo = null;
  if (code && !u.promo) {
    if (!codes().includes(code)) promo = "unknown";
    else if (t > promoEnd()) promo = "expired";
    else {
      const reg = (await getObj(token, bucket, "promo/used.json")) || {};
      if (reg[code] && reg[code] !== user.id) promo = "used";
      else { reg[code] = user.id; await putObj(token, bucket, "promo/used.json", reg); u.promo = code; u.promoAt = t; promo = "ok"; notifyNastya(`Промокод ${code} применен: ${esc(user.first_name || "")} (id ${user.id})`); }
    }
  }
  u.name = user.first_name || u.name || ""; u.lastSeen = t;
  await putObj(token, bucket, ukey(user.id), u);
  return Object.assign(status(u, t), { promo });
}
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
function notifyNastya(text) { if (process.env.NASTYA_ID) send(process.env.NASTYA_ID, text).catch(() => {}); }
const dm = (ts) => { const d = new Date(ts + MSK); return d.getUTCDate() + " " + ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"][d.getUTCMonth()]; };

// ---------- тексты бота ----------
const T = {
  start: (name) => `${name ? esc(name) + ", з" : "З"}десь вход в «Карту Глубины».\n\nПогружения в образы, дневник снов и чувств, словарь символов и ИИ-проводник — все в одном приложении. Первые 3 дня — бесплатно.`,
  startPromo: (name) => `${name ? esc(name) + ", з" : "З"}десь вход в «Карту Глубины».\n\nПо твоему промокоду открыт полный доступ до 30 декабря: все погружения, подкасты, Проводник и вопросы Насте.`,
  help: () => `Если что-то не работает или есть вопрос по приложению — напиши сюда, Настя прочитает и ответит.\n\nЕсли сейчас опасно — звони 112.`,
  got: `Передали Насте. Ответ придет сюда.`,
  trialSoon: `Завтра заканчивается пробный период «Карты Глубины». Все записи останутся с тобой, а чтобы погружения и Проводник оставались открыты — оформи подписку.`,
  trialEnd: `Пробный период закончился. Записи в «Моей карте» остаются с тобой. Продлить доступ можно в приложении.`,
  promoEnd: `Бесплатный период закончился. Спасибо, что декабрь прошел вместе с «Картой Глубины». Продлить доступ можно в приложении.`,
  sub: (s) => s.plan === "trial" ? `Пробный период до ${dm(s.until)}.` : s.plan === "promo" ? `Полный доступ по промокоду до ${dm(s.until)}.` : s.plan === "expired" ? `Доступ закончился. Записи сохранены, продлить можно в приложении.` : `Подписка до ${dm(s.until)}.`,
};

// ---------- вебхук ----------
async function onUpdate(token, bucket, up) {
  const m = up.message; if (!m || !m.chat || m.chat.type !== "private" || !m.from) return;
  const text = String(m.text || "").trim(), from = m.from;
  const key = ukey(from.id);
  const u0 = await getObj(token, bucket, key);
  if (u0 && !u0.chat) { u0.chat = true; await putObj(token, bucket, key, u0); }
  // Настя отвечает на пересланное сообщение — ответ уходит человеку
  if (process.env.NASTYA_ID && String(from.id) === String(process.env.NASTYA_ID) && m.reply_to_message) {
    const link = await getObj(token, bucket, "support/" + m.reply_to_message.message_id + ".json");
    if (link && link.user) { await send(link.user, "Ответ Насти:\n\n" + esc(text || "(без текста)")); return send(m.chat.id, "Отправлено."); }
  }
  if (!isAllowed(from.id)) {
    if (/^\/start\b/.test(text)) return send(m.chat.id, `${from.first_name ? esc(from.first_name) + ", п" : "П"}риложение «Карта Глубины» скоро откроется. Напишем сюда, когда можно будет зайти.`, { remove_keyboard: true });
    if (process.env.NASTYA_ID && text && !/^\//.test(text)) { const r = await tg("forwardMessage", { chat_id: process.env.NASTYA_ID, from_chat_id: m.chat.id, message_id: m.message_id }); if (r && r.ok) { await putObj(token, bucket, "support/" + r.result.message_id + ".json", { user: from.id, at: Date.now() }); return send(m.chat.id, T.got); } }
    return;
  }
  if (/^\/start\b/.test(text)) {
    const arg = text.split(/\s+/)[1] || "";
    const code = codes().includes(normCode(arg)) ? normCode(arg) : "";
    // в /start ничего не регистрируем: срок пробного периода считается с первого открытия приложения
    if (u0) { u0.chat = true; await putObj(token, bucket, key, u0); }
    else await putObj(token, bucket, key + ".chat", { chat: true, at: Date.now() });
    return send(m.chat.id, (code ? T.startPromo(from.first_name) : T.start(from.first_name)) + "\n\nКнопки — под полем ввода.", kbFor(code));
  }
  if (/^\/help\b/.test(text) || text === "Помощь") return send(m.chat.id, T.help(), KB);
  if (/^\/podpiska\b/.test(text) || text === "Моя подписка") return send(m.chat.id, u0 ? T.sub(status(u0)) : "Открой приложение — там начнется пробный период.", openBtn());
  // любое другое сообщение — Насте (обращение в поддержку)
  if (process.env.NASTYA_ID && !/^\//.test(text)) {
    const r = await tg("forwardMessage", { chat_id: process.env.NASTYA_ID, from_chat_id: m.chat.id, message_id: m.message_id });
    if (r && r.ok) {
      await putObj(token, bucket, "support/" + r.result.message_id + ".json", { user: from.id, at: Date.now() });
      await send(process.env.NASTYA_ID, `↑ ${esc(from.first_name || "")} (id ${from.id}). Ответь на пересланное сообщение — ответ уйдет человеку.`);
      return send(m.chat.id, T.got, KB);
    }
    await putObj(token, bucket, "support-inbox/" + Date.now() + "-" + from.id + ".json", { user: from.id, name: from.first_name || "", text, at: Date.now() });
    return send(m.chat.id, "Сообщение сохранено, Настя прочитает и ответит.", KB);
  }
  return send(m.chat.id, "Все самое важное — в приложении.", openBtn());
}

// настройка бота: вебхук на эту функцию, кнопка «Открыть» слева от поля, список команд
let setupDone = false;
async function ensureSetup() {
  if (setupDone || !process.env.BOT_TOKEN || !process.env.SELF_URL || !process.env.BOT_SECRET) return null;
  const info = await tg("getWebhookInfo", {});
  let wh = true;
  if (!info.ok || !info.result || info.result.url !== process.env.SELF_URL) wh = (await tg("setWebhook", { url: process.env.SELF_URL, secret_token: process.env.BOT_SECRET, allowed_updates: ["message"], drop_pending_updates: true })).ok;
  const st = await setup(); setupDone = wh && st.menu; return Object.assign({ webhook: wh }, st);
}
async function setup() {
  const L = allowedList();
  // при закрытом доступе кнопка «Открыть» — только у разрешенных, у остальных — обычное меню команд
  const a = L.length ? await tg("setChatMenuButton", { menu_button: { type: "commands" } }) : await tg("setChatMenuButton", { menu_button: { type: "web_app", text: "Открыть", web_app: { url: appUrl() } } });
  for (const id of L) await tg("setChatMenuButton", { chat_id: Number(id), menu_button: { type: "web_app", text: "Открыть", web_app: { url: appUrl() } } });
  const b = await tg("setMyCommands", { commands: [{ command: "start", description: "Приложение" }, { command: "podpiska", description: "Моя подписка" }, { command: "help", description: "Помощь" }] });
  const c = await tg("setMyDescription", { description: "Погружения в образы, дневник снов и чувств, словарь символов и ИИ-проводник. Автор — юнгианский аналитик и символдраматист Настя Черемных. Первые 3 дня бесплатно." });
  return { menu: a.ok, commands: b.ok, description: c.ok };
}

// ---------- напоминания (таймер) ----------
async function remind(token, bucket) {
  const t = Date.now(), hourMsk = new Date(t + MSK).getUTCHours();
  if (hourMsk < 10 || hourMsk > 20) return { skipped: "night" }; // не пишем ночью
  const keys = (await listKeys(token, bucket, "users/")).filter((k) => /^users\/\d+\.json$/.test(k));
  let sent = 0;
  for (const k of keys) {
    const u = await getObj(token, bucket, k); if (!u || !isAllowed(u.id)) continue;
    u.sent = u.sent || {};
    const trialEnd = u.firstSeen + TRIAL_DAYS * DAY, paid = u.paidUntil && t < u.paidUntil;
    let msg = null, flag = null;
    if (!paid && !u.promo && t > trialEnd - DAY && t < trialEnd && !u.sent.trialSoon) { msg = T.trialSoon; flag = "trialSoon"; }
    else if (!paid && !u.promo && t >= trialEnd && t < trialEnd + 3 * DAY && !u.sent.trialEnd) { msg = T.trialEnd; flag = "trialEnd"; }
    else if (!paid && u.promo && t >= promoEnd() - 12 * 3600000 && !u.sent.promoEnd) { msg = T.promoEnd; flag = "promoEnd"; } // 30 декабря после полудня
    if (!msg) continue;
    const r = await send(u.id, msg, openBtn("Открыть приложение"));
    u.sent[flag] = t; if (r && r.ok) sent++; else u.sent[flag + "Fail"] = (r && r.description) || "fail";
    await putObj(token, bucket, k, u);
  }
  return { users: keys.length, sent };
}

function cors(origin, reqOrigin) {
  const list = String(origin || "*").split(",").map((s) => s.trim());
  return list.includes("*") ? "*" : list.includes(reqOrigin) ? reqOrigin : list[0];
}
function reply(code, body, origin) {
  return { statusCode: code, headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "X-Telegram-Init-Data, Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Cache-Control": "no-store" }, body: typeof body === "string" ? body : JSON.stringify(body) };
}

module.exports.handler = async function (event, context) {
  const bucket = process.env.DATA_BUCKET, token = context && context.token && context.token.access_token;
  // таймер
  if (event && (event.messages && event.messages[0] && event.messages[0].event_metadata && /timer/i.test(event.messages[0].event_metadata.event_type || ""))) {
    if (!bucket || !token) return { error: "not_configured" };
    const su = await ensureSetup().catch((e) => ({ error: String(e).slice(0, 100) }));
    return Object.assign({ setup: su }, await remind(token, bucket));
  }
  const h = event.headers || {}, origin = cors(process.env.ALLOW_ORIGIN, h.Origin || h.origin || "");
  if (event.httpMethod === "OPTIONS") return reply(204, "", origin);
  if (!bucket || !token) return reply(500, { error: "not_configured" }, origin);
  let b = {};
  try { b = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body || "", "base64").toString("utf8") : event.body || "{}"); } catch (e) { return reply(400, { error: "bad_json" }, origin); }
  // вебхук Telegram: проверяем секрет
  const sec = h["X-Telegram-Bot-Api-Secret-Token"] || h["x-telegram-bot-api-secret-token"];
  if (sec !== undefined) {
    if (!process.env.BOT_SECRET || sec !== process.env.BOT_SECRET) return reply(403, { error: "bad_secret" }, origin);
    hookReply = false;
    try { await onUpdate(token, bucket, b); } catch (e) { console.log("update", String(e).slice(0, 200)); }
    const out = hookReply || { ok: true }; hookReply = null;
    return reply(200, out, origin); // Telegram ждет 200; метод в ответе он выполнит сам
  }
  // проверка настройки без секретов: подключает вебхук и меню, если токен уже введен
  if (b.action === "setup") return reply(200, (await ensureSetup().catch((e) => ({ error: String(e).slice(0, 100) }))) || { setup: setupDone ? "done" : "waiting_for_token" }, origin);
  // запрос приложения
  const user = checkInitData(h["X-Telegram-Init-Data"] || h["x-telegram-init-data"] || "", process.env.BOT_TOKEN);
  if (!user) return reply(401, { error: "open_in_telegram" }, origin);
  if (b.action === "access") {
    try { return reply(200, await access(token, bucket, user, b.code || user.start_param), origin); }
    catch (e) { console.log("access", String(e).slice(0, 200)); return reply(502, { error: "storage" }, origin); }
  }
  return reply(400, { error: "bad_action" }, origin);
};
module.exports._t = { status, normCode, T, remind, access, onUpdate };
