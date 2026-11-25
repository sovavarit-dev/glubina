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
// ---------- время человека (часовой пояс из приложения) ----------
const okTz = (tz) => { if (typeof tz !== "string" || !/^[A-Za-z0-9_+\-\/]{1,64}$/.test(tz)) return false; try { new Intl.DateTimeFormat("en", { timeZone: tz }); return true; } catch (e) { return false; } };
function local(tz, t) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: okTz(tz) ? tz : "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(t || Date.now()));
  const g = (k) => (p.find((x) => x.type === k) || {}).value;
  return { date: g("year") + "-" + g("month") + "-" + g("day"), min: Number(g("hour")) * 60 + Number(g("minute")) };
}
const hm = (v) => { const m = /^(\d{2}):(\d{2})$/.exec(String(v || "")); return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null; };
const DAY_FROM = 10 * 60, DAY_TO = 21 * 60; // дневное окно для прочих сообщений: 10:00–20:59 по времени человека
const isDay = (u, t) => { const L = local(u && u.tz, t); return L.min >= DAY_FROM && L.min < DAY_TO; };

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
  if (hookReply === false && /^(sendMessage|editMessageText|answerCallbackQuery)$/.test(method)) { hookReply = Object.assign({ method }, body); return { ok: true, result: { message_id: 0 }, viaHook: true }; }
  const base = process.env.TG_API || "https://api.telegram.org";
  try {
    const r = await fetch(`${base}/bot${process.env.BOT_TOKEN}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(4000) });
    const j = await r.json().catch(() => ({}));
    if (!j.ok) console.log("tg", method, r.status, JSON.stringify(j).slice(0, 200));
    return j;
  } catch (e) { console.log("tg", method, "unreachable"); return { ok: false, description: "unreachable" }; }
}
// отправка файла (скриншота) в Telegram: multipart через посредника
async function tgPhoto(chat, buf, caption) {
  const base = process.env.TG_API || "https://api.telegram.org";
  try {
    const fd = new FormData(); fd.append("chat_id", String(chat)); if (caption) fd.append("caption", caption.slice(0, 1000));
    fd.append("photo", new Blob([buf], { type: "image/jpeg" }), "screen.jpg");
    const r = await fetch(`${base}/bot${process.env.BOT_TOKEN}/sendPhoto`, { method: "POST", body: fd, signal: AbortSignal.timeout(15000) });
    const j = await r.json().catch(() => ({})); if (!j.ok) console.log("tgPhoto", r.status, JSON.stringify(j).slice(0, 200)); return j;
  } catch (e) { console.log("tgPhoto unreachable"); return { ok: false }; }
}
// сообщение об ошибке из приложения: текст + до 3 скриншотов → Насте, копия в бакет
async function bugReport(token, bucket, user, b) {
  const text = String(b.text || "").slice(0, 3000).trim(), imgs = (Array.isArray(b.images) ? b.images : []).slice(0, 3);
  if (!text && !imgs.length) return { error: "empty" };
  const id = Date.now() + "-" + user.id, meta = { id, uid: user.id, name: user.first_name || "", text, where: String(b.where || "").slice(0, 120), ua: String(b.ua || "").slice(0, 200), ver: String(b.ver || "").slice(0, 20), web: !!user.web, at: Date.now(), images: imgs.length };
  await putObj(token, bucket, "bugs/" + id + ".json", meta);
  const bufs = imgs.map((x) => { const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(String(x)); return m ? Buffer.from(m[2], "base64") : null; }).filter((x) => x && x.length < 2500000);
  for (let i = 0; i < bufs.length; i++) await fetch(S3 + bucket + "/bugs/" + id + "-" + i + ".jpg", { method: "PUT", headers: { "X-YaCloud-SubjectToken": token, "Content-Type": "image/jpeg" }, body: bufs[i] }).catch(() => {});
  const head = `🐞 Ошибка в приложении\nОт: ${esc(meta.name)} (id ${user.id})${meta.web ? " · сайт" : " · Telegram"}\nГде: ${esc(meta.where || "—")}\n${esc(meta.ua)}\n\n${esc(text || "(без текста)")}`;
  if (process.env.NASTYA_ID) { await send(process.env.NASTYA_ID, head); for (const bf of bufs) await tgPhoto(process.env.NASTYA_ID, bf, "Скриншот к ошибке " + id); }
  return { ok: true };
}
// ---------- хранение записей человека (зашифровано) ----------
const dataKey = () => process.env.DATA_KEY ? crypto.createHash("sha256").update("karta-data:" + process.env.DATA_KEY).digest() : null;
function seal(obj) { const k = dataKey(), iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", k, iv); const ct = Buffer.concat([c.update(JSON.stringify(obj), "utf8"), c.final()]); return { v: 1, iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64"), ct: ct.toString("base64") }; }
function unseal(box) { const k = dataKey(), d = crypto.createDecipheriv("aes-256-gcm", k, Buffer.from(box.iv, "base64")); d.setAuthTag(Buffer.from(box.tag, "base64")); return JSON.parse(Buffer.concat([d.update(Buffer.from(box.ct, "base64")), d.final()]).toString("utf8")); }
const skey = (id) => "state/" + String(id).replace(/\D/g, "") + ".json";
async function stateGet(token, bucket, user) {
  if (!dataKey()) return { error: "not_ready" };
  const box = await getObj(token, bucket, skey(user.id)); if (!box || !box.ct) return { data: null };
  try { return { data: unseal(box), at: box.at || 0 }; } catch (e) { console.log("unseal", String(e).slice(0, 80)); return { error: "decrypt" }; }
}
async function statePut(token, bucket, user, data) {
  if (!dataKey()) return { error: "not_ready" };
  if (!data || typeof data !== "object") return { error: "bad_data" };
  const json = JSON.stringify(data); if (json.length > 2800000) return { error: "too_big" };
  const k = skey(user.id), prev = await getObj(token, bucket, k), t = Date.now();
  // копия раз в сутки, последние 7 дней — чтобы записи можно было вернуть
  let lastBak = prev && prev.lastBak || 0;
  if (prev && prev.ct && t - lastBak > DAY) { await putObj(token, bucket, "state-bak/" + String(user.id).replace(/\D/g, "") + "-" + new Date(t).getUTCDay() + ".json", prev); lastBak = t; }
  await putObj(token, bucket, k, Object.assign(seal(data), { at: t, lastBak }));
  return { ok: true, at: t };
}
// ---------- обращения людей (для Насти в приложении) ----------
async function inboxSave(token, bucket, from, text) {
  const id = Date.now() + "-" + from.id;
  await putObj(token, bucket, "inbox/" + id + ".json", { id, uid: from.id, name: from.first_name || "", user: from.username || "", text: String(text || "").slice(0, 4000), at: Date.now(), answered: false });
  return id;
}
const isAdmin = (u) => !!(u && process.env.NASTYA_ID && String(u.id) === String(process.env.NASTYA_ID));
async function adminList(token, bucket, kind) {
  const pre = kind === "bug" ? "bugs/" : "inbox/";
  const keys = (await listKeys(token, bucket, pre)).filter((k) => /\/\d+-\d+\.json$/.test(k)).sort().reverse().slice(0, 100);
  const out = [];
  for (let i = 0; i < keys.length; i += 10) out.push(...(await Promise.all(keys.slice(i, i + 10).map((k) => getObj(token, bucket, k).catch(() => null)))));
  return { items: out.filter(Boolean) };
}
async function adminImg(token, bucket, id, i) {
  const r = await fetch(S3 + bucket + "/bugs/" + String(id).replace(/[^\d-]/g, "") + "-" + (+i || 0) + ".jpg", { headers: { "X-YaCloud-SubjectToken": token } });
  if (!r.ok) return { error: "no_image" };
  return { img: "data:image/jpeg;base64," + Buffer.from(await r.arrayBuffer()).toString("base64") };
}
async function adminMark(token, bucket, kind, id, done) {
  const k = (kind === "bug" ? "bugs/" : "inbox/") + String(id).replace(/[^\d-]/g, "") + ".json", x = await getObj(token, bucket, k);
  if (!x) return { error: "not_found" };
  if (kind === "bug") x.done = !!done; else x.answered = !!done;
  await putObj(token, bucket, k, x); return { ok: true };
}
async function adminReply(token, bucket, id, text) {
  const k = "inbox/" + String(id).replace(/[^\d-]/g, "") + ".json", x = await getObj(token, bucket, k);
  if (!x || !x.uid || !String(text || "").trim()) return { error: "bad" };
  const msg = "Ответ Насти:\n\n" + esc(String(text).slice(0, 3500));
  const uk = ukey(x.uid), uu = (await getObj(token, bucket, uk)) || { id: x.uid, firstSeen: Date.now(), sent: {} };
  let when = "now";
  if (isDay(uu)) { const r = await tg("sendMessage", { chat_id: x.uid, text: msg, parse_mode: "HTML" }); if (!r || !r.ok) return { error: "send_failed", why: (r && r.description) || "" }; }
  else { uu.queue = (uu.queue || []).concat([{ text: msg, at: Date.now() }]); await putObj(token, bucket, uk, uu); when = "morning"; }
  x.answered = true; x.replies = (x.replies || []).concat([{ text: String(text).slice(0, 3500), at: Date.now(), when }]);
  await putObj(token, bucket, k, x); return { ok: true, when };
}
const appUrl = (q) => (process.env.APP_URL || "https://karta-glubiny-app.website.yandexcloud.net/") + (q || "");
// кнопок под сообщениями и клавиатуры под полем нет: вход в приложение — одна кнопка «Открыть» слева от поля ввода
const KB = { remove_keyboard: true };
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

// ---------- вход на сайте через бота (ярлык на телефоне, без Telegram) ----------
// сайт создает nonce → человек открывает t.me/<бот>?start=login_<nonce> → жмет «Войти» →
// бот кладет login/<nonce>.json → сайт забирает сессию (подпись HMAC, 90 дней).
const SESS_DAYS = 90;
const b64u = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const sessKey = () => crypto.createHmac("sha256", String(process.env.BOT_SECRET || "")).update("karta-session").digest();
function makeSession(id, name) {
  const body = b64u(JSON.stringify({ id: Number(id), n: String(name || "").slice(0, 40), exp: Date.now() + SESS_DAYS * DAY }));
  return body + "." + b64u(crypto.createHmac("sha256", sessKey()).update(body).digest());
}
function checkSession(s) {
  if (!s || !process.env.BOT_SECRET) return null;
  const [body, sig] = String(s).split("."); if (!body || !sig) return null;
  const calc = b64u(crypto.createHmac("sha256", sessKey()).update(body).digest());
  if (calc.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(sig))) return null;
  try { const j = JSON.parse(Buffer.from(body.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")); return j.id && j.exp > Date.now() ? { id: j.id, first_name: j.n || "", start_param: "", web: true } : null; } catch (e) { return null; }
}
const okNonce = (n) => /^[A-Za-z0-9_-]{16,48}$/.test(String(n || ""));

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
async function access(token, bucket, user, rawCode, extra) {
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
  if (extra && okTz(extra.tz)) u.tz = extra.tz;
  if (extra && extra.remind && typeof extra.remind === "object") {
    const r = extra.remind;
    u.remind = { on: r.on !== false, morning: hm(r.morning) !== null ? r.morning : "09:00", evening: hm(r.evening) !== null ? r.evening : "21:30" };
  }
  await putObj(token, bucket, ukey(user.id), u);
  return Object.assign(status(u, t), { promo, sub: subView(u), admin: isAdmin(user) || undefined });
}
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
function notifyNastya(text) { if (process.env.NASTYA_ID) send(process.env.NASTYA_ID, text).catch(() => {}); }
const dm = (ts) => { const d = new Date(ts + MSK); return d.getUTCDate() + " " + ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"][d.getUTCMonth()]; };


// ---------- оплата: Продамус (подписки 2990 / 4990, списывает сам Продамус) ----------
// Переменные: PRODAMUS_URL (https://<магазин>.payform.ru/), PRODAMUS_KEY (секретный ключ — вписывает Настя),
// PRODAMUS_SUB_BASIC / PRODAMUS_SUB_FULL (ID подписок), SITE_URL (адрес сайта для возврата после оплаты).
const TARIFFS = { basic: { name: "Карта Глубины", price: 2990, env: "PRODAMUS_SUB_BASIC" }, full: { name: "Карта Глубины + ответы Насти", price: 4990, env: "PRODAMUS_SUB_FULL" } };
const proUrl = () => { const u = String(process.env.PRODAMUS_URL || ""); return u && !u.endsWith("/") ? u + "/" : u; };
const proReady = () => !!(proUrl() && process.env.PRODAMUS_KEY && process.env.PRODAMUS_SUB_BASIC && process.env.PRODAMUS_SUB_FULL);
const strDeep = (v) => Array.isArray(v) ? v.map(strDeep) : v && typeof v === "object" ? Object.keys(v).sort().reduce((o, k) => (o[k] = strDeep(v[k]), o), {}) : v === null || v === undefined ? "" : typeof v === "boolean" ? (v ? "1" : "0") : String(v);
const proSign = (data, slash) => { let j = JSON.stringify(strDeep(data)); if (slash !== false) j = j.replace(/\//g, "\\/"); return crypto.createHmac("sha256", String(process.env.PRODAMUS_KEY || "")).update(j).digest("hex"); };
function unflat(form) { // products[0][name] → { products: [ { name } ] }
  const root = {};
  for (const [key, val] of Object.entries(form)) {
    const parts = key.match(/[^[\]]+/g) || [key]; let node = root;
    parts.forEach((p, i) => { const last = i === parts.length - 1, k = /^\d+$/.test(p) ? +p : p;
      if (last) node[k] = val; else { if (typeof node[k] !== "object" || node[k] === null) node[k] = /^\d+$/.test(parts[i + 1]) ? [] : {}; node = node[k]; } });
  }
  return root;
}
function proVerify(form, sign) {
  if (!sign || !process.env.PRODAMUS_KEY) return false;
  const s = String(sign).trim().toLowerCase(), clean = Object.assign({}, form); delete clean.signature; delete clean.sign;
  const nested = unflat(clean);
  for (const d of [nested, clean]) for (const sl of [true, false]) { const x = proSign(d, sl); if (x.length === s.length && crypto.timingSafeEqual(Buffer.from(x), Buffer.from(s))) return true; }
  return false;
}
const qs = (o, pre) => Object.entries(o).flatMap(([k, v]) => { const key = pre ? `${pre}[${k}]` : k; return v && typeof v === "object" ? qs(v, key) : [[key, String(v)]]; });
const addMonth = (ts) => ts + 30 * DAY; // в Продамусе интервал подписки — 30 дней
// ссылка на оплату выбранной подписки; номер заказа связывает оплату с человеком
async function payLink(token, bucket, user, tariff) {
  const T0 = TARIFFS[tariff]; if (!T0 || !proReady()) return { error: !T0 ? "bad_tariff" : "not_ready" };
  const order = "kg" + user.id + "-" + Date.now().toString(36);
  await putObj(token, bucket, "orders/" + order + ".json", { uid: user.id, tariff, at: Date.now() });
  const site = String(process.env.SITE_URL || "https://kartaglubiny.ru/").replace(/\/?$/, "/");
  const data = { do: "pay", order_id: order, customer_extra: "uid:" + user.id, subscription: String(process.env[T0.env]),
    products: [{ name: T0.name, price: String(T0.price), quantity: "1", type: "service" }],
    urlSuccess: site + "#/sub/ok", urlReturn: site + "#/sub" };
  return { url: proUrl() + "?" + qs(data).map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v)).join("&") };
}
// уведомление Продамуса: оплата, продление, неудачное списание, отключение подписки
async function proHook(token, bucket, form) {
  const d = unflat(form), low = (x) => String(x || "").trim().toLowerCase();
  const pay = low(d.payment_status), act = low(d.action_code), sub = d.subscription && typeof d.subscription === "object" ? d.subscription : {};
  let uid = null, tariff = null;
  const ord = d.order_num ? await getObj(token, bucket, "orders/" + String(d.order_num).replace(/[^\w-]/g, "") + ".json") : null;
  if (ord) { uid = ord.uid; tariff = ord.tariff; }
  if (!uid) { const m = /uid:(\d+)/.exec(String(d.customer_extra || "")); if (m) uid = +m[1]; }
  const subId = String(sub.id || d.subscription_id || (typeof d.subscription === "string" ? d.subscription : "") || "");
  if (!tariff && subId) tariff = subId === String(process.env.PRODAMUS_SUB_FULL) ? "full" : subId === String(process.env.PRODAMUS_SUB_BASIC) ? "basic" : null;
  if (!uid && subId) { // продление без номера заказа: ищем по подписке и почте/телефону
    const idx = (await getObj(token, bucket, "orders/by-customer.json")) || {};
    uid = idx[low(d.customer_email)] || idx[String(d.customer_phone || "").replace(/\D/g, "")] || null;
  }
  const ours = /^kg\d+-/.test(String(d.order_num || "")) || [String(process.env.PRODAMUS_SUB_BASIC), String(process.env.PRODAMUS_SUB_FULL)].includes(subId);
  if (!ours) return "foreign"; // консультации и другие оплаты на той же форме — не наши
  if (!uid) { await putObj(token, bucket, "orders/unmatched-" + Date.now() + ".json", d); notifyNastya("Продамус: оплата подписки без привязки к человеку, проверь в кабинете"); return "unmatched"; }
  const k = ukey(uid), t = Date.now(), u = (await getObj(token, bucket, k)) || { id: uid, firstSeen: t, sent: {} };
  u.sent = u.sent || {};
  u.sub = Object.assign(u.sub || {}, { id: subId || (u.sub && u.sub.id) || "", email: d.customer_email || (u.sub && u.sub.email) || "", phone: d.customer_phone || (u.sub && u.sub.phone) || "" });
  if (tariff) u.tariff = tariff;
  const next = Date.parse(sub.date_next_payment || d.date_next_payment || "") || 0;
  // по документации Продамуса: первая оплата — payment_status=success; продления и сбои — в subscription[type/action_code/notification_code/error_code]
  const sty = low(sub.type), sact = low(sub.action_code || act), ncode = low(sub.notification_code), err = sub.error_code || d.error_code;
  const paid = ["success", "paid", "ok", "completed"].includes(pay) && !sty || (sty === "action" && sact === "auto_payment" && !err);
  const failed = ["fail", "failed", "error", "declined", "rejected"].includes(pay) || (sty === "notification" && ncode === "auto_payment" && !!err);
  const stopped = (sty === "action" && ["deactivation", "finish"].includes(sact)) || (sty === "notification" && ncode === "deactivation") || low(sub.active) === "0";
  const resumed = sty === "notification" && ncode === "activation";
  let res = "info";
  if (paid) {
    const base = Math.max(t, u.paidUntil || 0);
    u.paidUntil = Math.max(next ? next + DAY : 0, addMonth(base) + DAY); // день запаса на списание
    u.sub.active = true; u.sub.next = next || addMonth(base); u.sub.lastPay = t; delete u.sub.failAt; res = "paid";
    const idx = (await getObj(token, bucket, "orders/by-customer.json")) || {};
    if (d.customer_email) idx[low(d.customer_email)] = uid; if (d.customer_phone) idx[String(d.customer_phone).replace(/\D/g, "")] = uid;
    await putObj(token, bucket, "orders/by-customer.json", idx);
    u.queue = (u.queue || []).concat([{ text: `Подписка «${TARIFFS[u.tariff] ? TARIFFS[u.tariff].name : "Карта Глубины"}» активна до ${dm(u.paidUntil - DAY)}. Спасибо!`, at: t }]);
  } else if (failed) { u.sub.failAt = t; res = "failed";
    if (u.sent.failFor === (u.sub.next || 0)) { await putObj(token, bucket, k, u); return res; } // одно сообщение на период, а не на каждую попытку
    u.sent.failFor = u.sub.next || 0;
    u.queue = (u.queue || []).concat([{ text: "Не получилось продлить подписку: списание не прошло. Доступ к «Моей карте» сохранится. Проверить карту можно в личном кабинете на сайте kartaglubiny.ru.", at: t }]);
  } else if (stopped) { u.sub.active = false; u.sub.stopAt = t; res = "stopped"; }
  else if (resumed) { u.sub.active = true; res = "resumed"; }
  await putObj(token, bucket, k, u);
  return res;
}
// отмена подписки по кнопке в приложении: отключаем автосписание в Продамусе от лица пользователя
async function proCancel(token, bucket, user) {
  const k = ukey(user.id), u = await getObj(token, bucket, k);
  if (!u || !u.sub || !u.sub.id) return { error: "no_subscription" };
  if (!proReady()) return { error: "not_ready" };
  const ids = [u.sub.phone ? { customer_phone: u.sub.phone } : null, u.sub.email ? { customer_email: u.sub.email } : null].filter(Boolean);
  let ok = false;
  for (const idf of ids) {
    const data = Object.assign({ subscription: String(u.sub.id), active_user: "0" }, idf); data.signature = proSign(data);
    try { const r = await fetch(proUrl() + "rest/setActivity/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(data).toString(), signal: AbortSignal.timeout(8000) });
      if (/success/i.test(await r.text())) { ok = true; break; } } catch (e) { console.log("setActivity", String(e).slice(0, 120)); }
  }
  if (!ok) { notifyNastya(`Не получилось отключить подписку в Продамусе (id ${user.id}). Отключи вручную: Подписчики → ${esc(u.sub.email || u.sub.phone || "")}`); return { error: "prodamus_failed" }; }
  u.sub.active = false; u.sub.stopAt = Date.now(); await putObj(token, bucket, k, u);
  return Object.assign(status(u), { sub: subView(u) });
}
const subView = (u) => u && u.sub ? { active: !!u.sub.active, next: u.sub.next || null, tariff: u.tariff || null, fail: !!u.sub.failAt } : null;

// ---------- тексты бота ----------
const T = {
  start: (name) => `${name ? esc(name) + ", з" : "З"}десь вход в «Карту Глубины».\n\nПогружения в образы, дневник снов и чувств, словарь символов и ИИ-проводник — все в одном приложении. Первые 3 дня — бесплатно.`,
  startPromo: (name) => `${name ? esc(name) + ", з" : "З"}десь вход в «Карту Глубины».\n\nПо твоему промокоду открыт полный доступ до 30 декабря: все погружения, подкасты, Проводник и вопросы Насте.`,
  help: () => `Если что-то не работает или есть вопрос по приложению — напиши сюда, Настя прочитает и ответит.\n\nЕсли сейчас опасно — звони 112.`,
  got: `Передали Насте. Ответ придет сюда.`,
  trialSoon: `Завтра заканчивается пробный период «Карты Глубины». Все записи останутся с тобой, а чтобы погружения и Проводник оставались открыты — оформи подписку.`,
  trialEnd: `Пробный период закончился. Записи в «Моей карте» остаются с тобой. Продлить доступ можно в приложении.`,
  promoEnd: `Бесплатный период закончился. Спасибо, что декабрь прошел вместе с «Картой Глубины». Продлить доступ можно в приложении.`,
  morning: `Доброе утро. Если снился сон — запиши, пока он не растаял. Символ дня уже ждет.`,
  evening: `Как ты? Пара слов о дне — и его можно отпускать.`,
  sub: (s) => s.plan === "trial" ? `Пробный период до ${dm(s.until)}.` : s.plan === "promo" ? `Полный доступ по промокоду до ${dm(s.until)}.` : s.plan === "expired" ? `Доступ закончился. Записи сохранены, продлить можно в приложении.` : `Подписка до ${dm(s.until)}.`,
};

// ---------- вебхук ----------
async function onUpdate(token, bucket, up) {
  const cq = up.callback_query;
  if (cq && cq.from && /^news:/.test(cq.data || "") && process.env.NASTYA_ID && String(cq.from.id) === String(process.env.NASTYA_ID)) {
    const msg = cq.message || {}, d = await getObj(token, bucket, "news/draft.json");
    let out = "Отменено.";
    if (cq.data === "news:send" && d && d.text) { const id = "n-" + Date.now(); await putObj(token, bucket, "news/" + id + ".json", { id, text: d.text, at: Date.now() }); out = "Новость поставлена в рассылку:\n\n" + esc(d.text); }
    else if (cq.data === "news:send") out = "Черновик не найден, отправь /news еще раз.";
    await putObj(token, bucket, "news/draft.json", {});
    return tg("editMessageText", { chat_id: msg.chat && msg.chat.id, message_id: msg.message_id, text: out, parse_mode: "HTML", reply_markup: { inline_keyboard: [] } });
  }
  if (cq && cq.from && /^login:/.test(cq.data || "")) {
    const nonce = cq.data.slice(6), msg = cq.message || {};
    if (!okNonce(nonce) || !isAllowed(cq.from.id)) return tg("answerCallbackQuery", { callback_query_id: cq.id, text: "Вход пока закрыт" });
    await putObj(token, bucket, "login/" + nonce + ".json", { id: cq.from.id, name: cq.from.first_name || "", at: Date.now() });
    return tg("editMessageText", { chat_id: msg.chat && msg.chat.id, message_id: msg.message_id, text: "Готово. Вернись на сайт — вход выполнится сам (если нет — нажми там «Проверить вход»).", reply_markup: { inline_keyboard: [] } });
  }
  const m = up.message; if (!m || !m.chat || m.chat.type !== "private" || !m.from) return;
  const text = String(m.text || "").trim(), from = m.from;
  const key = ukey(from.id);
  const u0 = await getObj(token, bucket, key);
  if (u0 && !u0.chat) { u0.chat = true; await putObj(token, bucket, key, u0); }
  // Настя отвечает на пересланное сообщение — ответ уходит человеку
  if (process.env.NASTYA_ID && String(from.id) === String(process.env.NASTYA_ID) && m.reply_to_message) {
    const link = await getObj(token, bucket, "support/" + m.reply_to_message.message_id + ".json");
    if (link && link.user) {
      if (link.inbox) { const ik = "inbox/" + link.inbox + ".json", it = await getObj(token, bucket, ik); if (it) { it.answered = true; it.replies = (it.replies || []).concat([{ text: String(text || "").slice(0, 3500), at: Date.now(), via: "telegram" }]); await putObj(token, bucket, ik, it); } }
      const msg = "Ответ Насти:\n\n" + esc(text || "(без текста)");
      const uk = ukey(link.user), uu = (await getObj(token, bucket, uk)) || { id: link.user, firstSeen: Date.now(), sent: {} };
      if (isDay(uu)) { const r = await tg("sendMessage", { chat_id: link.user, text: msg, parse_mode: "HTML" }); return send(m.chat.id, r && r.ok ? "Отправлено." : "Не получилось отправить: " + esc((r && r.description) || "ошибка")); }
      uu.queue = (uu.queue || []).concat([{ text: msg, at: Date.now() }]); await putObj(token, bucket, uk, uu);
      return send(m.chat.id, "У человека сейчас ночь или раннее утро — ответ придет в 10:00 по его времени.");
    }
  }
  // новости: Настя пишет /news текст → предпросмотр → «Отправить всем»
  if (process.env.NASTYA_ID && String(from.id) === String(process.env.NASTYA_ID) && /^\/news\b/.test(text)) {
    const body = text.replace(/^\/news(@\w+)?\s*/, "").trim();
    if (!body) return send(m.chat.id, "Напиши так: /news и текст новости в одном сообщении.");
    await putObj(token, bucket, "news/draft.json", { text: body, at: Date.now() });
    return send(m.chat.id, "Предпросмотр новости:\n\n" + esc(body) + "\n\nКаждый получит ее днем, с 10 до 21 по своему времени.", { inline_keyboard: [[{ text: "Отправить всем", callback_data: "news:send" }, { text: "Отмена", callback_data: "news:cancel" }]] });
  }
  if (!isAllowed(from.id)) {
    if (/^\/start\b/.test(text)) return send(m.chat.id, `${from.first_name ? esc(from.first_name) + ", п" : "П"}риложение «Карта Глубины» скоро откроется. Напишем сюда, когда можно будет зайти.`, { remove_keyboard: true });
    if (process.env.NASTYA_ID && text && !/^\//.test(text)) { const r = await tg("forwardMessage", { chat_id: process.env.NASTYA_ID, from_chat_id: m.chat.id, message_id: m.message_id }); const ib = await inboxSave(token, bucket, from, text); if (r && r.ok) { await putObj(token, bucket, "support/" + r.result.message_id + ".json", { user: from.id, at: Date.now(), inbox: ib }); } return send(m.chat.id, T.got); }
    return;
  }
  if (/^\/start\s+login_/.test(text)) {
    const nonce = text.split(/\s+/)[1].slice(6);
    if (!okNonce(nonce)) return send(m.chat.id, "Ссылка для входа устарела. Открой сайт и нажми «Войти через Telegram» еще раз.", KB);
    return send(m.chat.id, "Вход в «Карту Глубины» на сайте.\n\nНажми кнопку ниже, если это ты сейчас открыл(а) сайт. Если нет — ничего не нажимай.", { inline_keyboard: [[{ text: "Войти на сайте", callback_data: "login:" + nonce }]] });
  }
  if (/^\/start\b/.test(text)) {
    const arg = text.split(/\s+/)[1] || "";
    const code = codes().includes(normCode(arg)) ? normCode(arg) : "";
    // в /start ничего не регистрируем: срок пробного периода считается с первого открытия приложения
    if (code && isAllowed(from.id)) await tg("setChatMenuButton", { chat_id: from.id, menu_button: { type: "web_app", text: "Открыть", web_app: { url: appUrl("?promo=" + code) } } });
    if (u0) { u0.chat = true; await putObj(token, bucket, key, u0); }
    else await putObj(token, bucket, key + ".chat", { chat: true, at: Date.now() });
    return send(m.chat.id, (code ? T.startPromo(from.first_name) : T.start(from.first_name)) + "\n\nПриложение открывается кнопкой «Открыть» слева от поля ввода.", KB);
  }
  if (/^\/help\b/.test(text) || text === "Помощь") return send(m.chat.id, T.help(), KB);
  if (/^\/podpiska\b/.test(text) || text === "Моя подписка") return send(m.chat.id, u0 ? T.sub(status(u0)) : "Открой приложение кнопкой «Открыть» слева от поля ввода — там начнется пробный период.", KB);
  // любое другое сообщение — Насте (обращение в поддержку)
  if (process.env.NASTYA_ID && !/^\//.test(text)) {
    const ib = await inboxSave(token, bucket, from, text);
    const r = await tg("forwardMessage", { chat_id: process.env.NASTYA_ID, from_chat_id: m.chat.id, message_id: m.message_id });
    if (r && r.ok) {
      await putObj(token, bucket, "support/" + r.result.message_id + ".json", { user: from.id, at: Date.now(), inbox: ib });
      await send(process.env.NASTYA_ID, `↑ ${esc(from.first_name || "")} (id ${from.id}). Ответь на пересланное сообщение — ответ уйдет человеку.`);
      return send(m.chat.id, T.got, KB);
    }
    return send(m.chat.id, "Сообщение сохранено, Настя прочитает и ответит.", KB);
  }
  return send(m.chat.id, "Все самое важное — в приложении: кнопка «Открыть» слева от поля ввода.", KB);
}

// настройка бота: вебхук на эту функцию, кнопка «Открыть» слева от поля, список команд
let setupDone = false;
async function ensureSetup() {
  if (setupDone || !process.env.BOT_TOKEN || !process.env.SELF_URL || !process.env.BOT_SECRET) return null;
  const info = await tg("getWebhookInfo", {});
  let wh = true;
  if (!info.ok || !info.result || info.result.url !== process.env.SELF_URL) wh = (await tg("setWebhook", { url: process.env.SELF_URL, secret_token: process.env.BOT_SECRET, allowed_updates: ["message", "callback_query"], drop_pending_updates: true })).ok;
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
// reminders.json: { "morning": ["...", ...], "evening": ["...", ...] } — по строке на день, по кругу от первого входа
const lineFor = (L, part, n) => { const a = L && Array.isArray(L[part]) ? L[part].filter((x) => typeof x === "string" && x.trim()) : []; return a.length ? esc(a[n % a.length].trim()) : ""; };
async function remind(token, bucket) {
  const t = Date.now();
  const keys = (await listKeys(token, bucket, "users/")).filter((k) => /^users\/\d+\.json$/.test(k));
  const newsKeys = (await listKeys(token, bucket, "news/n-")).filter((k) => /\.json$/.test(k)).slice(-20);
  const news = [];
  for (const k of newsKeys) { const n = await getObj(token, bucket, k); if (n && n.id && t - n.at < 7 * DAY) news.push(n); }
  const LINES = (await getObj(token, bucket, process.env.LINES_KEY || "reminders.json").catch(() => null)) || {};
  let sent = 0;
  for (const k of keys) {
    const u = await getObj(token, bucket, k); if (!u || !u.id || !isAllowed(u.id)) continue;
    u.sent = u.sent || {};
    const st = status(u, t), L = local(u.tz, t), day = L.min >= DAY_FROM && L.min < DAY_TO;
    const out = []; // [текст, кнопка, флаг]
    // утро и вечер — в то время, что человек выбрал в приложении (по его часовому поясу)
    const R = u.remind || { on: true, morning: "09:00", evening: "21:30" };
    const dayN = Math.max(0, Math.floor((t - (u.firstSeen || t)) / DAY));
    // в пробный период утро и вечер отключить нельзя
    if ((R.on || st.plan === "trial") && st.plan !== "expired") {
      for (const part of ["morning", "evening"]) {
        const at = hm(R[part]);
        if (at !== null && L.min >= at && L.min < at + 60 && u.sent[part] !== L.date) out.push([lineFor(LINES, part, dayN) || T[part], null, () => { u.sent[part] = L.date; }]);
      }
    }
    if (day) {
      // ответы Насти, пришедшие ночью
      if (u.queue && u.queue.length) { for (const q of u.queue) out.push([q.text, null, null]); u.queue = []; }
      // новости — только вышедшие после первого входа человека
      for (const n of news) { if (n.at > (u.firstSeen || 0) && !(u.sent.news || []).includes(n.id)) { out.push([esc(n.text), "Открыть приложение", () => { u.sent.news = (u.sent.news || []).concat([n.id]).slice(-30); }]); break; } }
      // предупреждение о списании за 3 дня
      if (u.sub && u.sub.active && u.sub.next && u.sub.next - t < 3 * DAY && u.sub.next > t && u.sent.preCharge !== u.sub.next) {
        const tf = TARIFFS[u.tariff] || TARIFFS.basic, nx = u.sub.next;
        out.push([`${dm(nx)} продлится подписка «${tf.name}» — ${tf.price} ₽. Отменить продление можно в личном кабинете на сайте kartaglubiny.ru.`, null, () => { u.sent.preCharge = nx; }]);
      }
      // конец пробного периода и промокода
      const trialEnd = u.firstSeen + TRIAL_DAYS * DAY, paid = u.paidUntil && t < u.paidUntil;
      if (!paid && !u.promo && t > trialEnd - DAY && t < trialEnd && !u.sent.trialSoon) out.push([T.trialSoon, "Открыть приложение", () => { u.sent.trialSoon = t; }]);
      else if (!paid && !u.promo && t >= trialEnd && t < trialEnd + 3 * DAY && !u.sent.trialEnd) out.push([T.trialEnd, "Открыть приложение", () => { u.sent.trialEnd = t; }]);
      else if (!paid && u.promo && t >= promoEnd() - 12 * 3600000 && !u.sent.promoEnd) out.push([T.promoEnd, "Открыть приложение", () => { u.sent.promoEnd = t; }]);
    }
    if (!out.length) continue;
    for (const [text, btn, mark] of out) {
      const r = await send(u.id, text, KB);
      if (r && r.ok) sent++; else u.sent.lastFail = ((r && r.description) || "fail").slice(0, 80);
      if (mark) mark();
    }
    await putObj(token, bucket, k, u);
  }
  return { users: keys.length, news: news.length, sent };
}

function cors(origin, reqOrigin) {
  const list = String(origin || "*").split(",").map((s) => s.trim());
  return list.includes("*") ? "*" : list.includes(reqOrigin) ? reqOrigin : list[0];
}
function reply(code, body, origin) {
  return { statusCode: code, headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "X-Telegram-Init-Data, X-Session, Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Cache-Control": "no-store" }, body: typeof body === "string" ? body : JSON.stringify(body) };
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
  // уведомление Продамуса (адрес функции + ?pay=prodamus)
  const q = event.queryStringParameters || {};
  if (q.pay === "prodamus") {
    const raw = event.isBase64Encoded ? Buffer.from(event.body || "", "base64").toString("utf8") : event.body || "";
    const form = {}; for (const [k2, v2] of new URLSearchParams(raw)) form[k2] = v2;
    if (!proVerify(form, h.Sign || h.sign || h.SIGN)) { console.log("prodamus bad sign"); return { statusCode: 400, body: "bad sign" }; }
    try { const r = await proHook(token, bucket, form); console.log("prodamus", r); } catch (e) { console.log("prodamus err", String(e).slice(0, 200)); return { statusCode: 500, body: "error" }; }
    return { statusCode: 200, headers: { "Content-Type": "text/plain" }, body: "success" };
  }
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
  // сайт: забрать сессию после нажатия «Войти» в боте (одноразово, 10 минут)
  if (b.action === "login_check") {
    if (!okNonce(b.nonce)) return reply(400, { error: "bad_nonce" }, origin);
    try {
      const k = "login/" + b.nonce + ".json", L = await getObj(token, bucket, k);
      if (!L) return reply(200, { wait: true }, origin);
      if (L.used || Date.now() - L.at > 10 * 60000) return reply(200, { error: "expired" }, origin);
      await putObj(token, bucket, k, { used: true, at: L.at });
      if (!isAllowed(L.id)) return reply(200, { error: "closed" }, origin);
      return reply(200, { session: makeSession(L.id, L.name), name: L.name }, origin);
    } catch (e) { console.log("login", String(e).slice(0, 200)); return reply(502, { error: "storage" }, origin); }
  }
  // запрос приложения: из Telegram (initData) или с сайта (сессия)
  const user = checkInitData(h["X-Telegram-Init-Data"] || h["x-telegram-init-data"] || "", process.env.BOT_TOKEN) || checkSession(h["X-Session"] || h["x-session"] || "");
  if (!user) return reply(401, { error: "open_in_telegram" }, origin);
  if (!isAllowed(user.id)) return reply(403, { error: "closed", plan: "closed" }, origin);
  if (b.action === "bug") return reply(200, await bugReport(token, bucket, user, b), origin);
  if (/^admin_/.test(b.action || "")) {
    if (!isAdmin(user)) return reply(403, { error: "forbidden" }, origin);
    if (b.action === "admin_list") return reply(200, await adminList(token, bucket, b.kind), origin);
    if (b.action === "admin_img") return reply(200, await adminImg(token, bucket, b.id, b.i), origin);
    if (b.action === "admin_mark") return reply(200, await adminMark(token, bucket, b.kind, b.id, b.done), origin);
    if (b.action === "admin_reply") return reply(200, await adminReply(token, bucket, b.id, b.text), origin);
  }
  // записи человека на сервере: зашифрованы (AES-256-GCM, ключ DATA_KEY только в настройках функции)
  if (b.action === "state_get") return reply(200, await stateGet(token, bucket, user), origin);
  if (b.action === "state_put") return reply(200, await statePut(token, bucket, user, b.data), origin);
  // расшифровка голоса (сны, заметки): кусок LPCM 16 кГц → текст через SpeechKit, звук не сохраняется
  if (b.action === "stt") {
    const audio = Buffer.from(String(b.audio || ""), "base64");
    if (!audio.length || audio.length > 1000000) return reply(400, { error: "bad_audio" }, origin);
    try {
      const r = await fetch(`https://stt.api.cloud.yandex.net/speech/v1/stt:recognize?folderId=${process.env.FOLDER_ID || "b1ghnlv1kcfnlc4uabvr"}&lang=ru-RU&format=lpcm&sampleRateHertz=16000`, { method: "POST", headers: { Authorization: "Bearer " + token, "x-data-logging-enabled": "false" }, body: audio, signal: AbortSignal.timeout(20000) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { console.log("stt", r.status, JSON.stringify(j).slice(0, 200)); return reply(502, { error: "stt_failed", status: r.status }, origin); }
      return reply(200, { text: String(j.result || "").replace(/ё/g, "е") }, origin);
    } catch (e) { console.log("stt error", String(e).slice(0, 120)); return reply(502, { error: "stt_failed" }, origin); }
  }
  if (b.action === "pay_link") return reply(200, await payLink(token, bucket, user, b.tariff), origin);
  if (b.action === "cancel_sub") return reply(200, await proCancel(token, bucket, user), origin);
  // контент для сайта (в Telegram его отдает karta-api)
  if (b.action === "content") {
    try {
      const r = await fetch(S3 + bucket + "/" + (process.env.CONTENT_KEY || "content.json"), { headers: { "X-YaCloud-SubjectToken": token } });
      if (!r.ok) return reply(502, { error: "content_unavailable" }, origin);
      return reply(200, await r.text(), origin);
    } catch (e) { return reply(502, { error: "content_unavailable" }, origin); }
  }
  if (b.action === "access") {
    try { return reply(200, await access(token, bucket, user, b.code || user.start_param, { tz: b.tz, remind: b.remind }), origin); }
    catch (e) { console.log("access", String(e).slice(0, 200)); return reply(502, { error: "storage" }, origin); }
  }
  return reply(400, { error: "bad_action" }, origin);
};
module.exports._t = { proSign, proVerify, proHook, payLink, unflat, local, isDay, status, normCode, T, remind, access, onUpdate, makeSession, checkSession };
