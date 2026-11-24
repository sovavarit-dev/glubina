window.startApp = function () {
  "use strict";

  const C = window.CONTENT;
  (function clean(o) { if (!o || typeof o !== "object") return; for (const k in o) { const v = o[k]; if (typeof v === "string" && /^\[Текст хранится/.test(v)) o[k] = ""; else if (v && typeof v === "object") clean(v); } })(C);
  const tg = window.Telegram && window.Telegram.WebApp;
  const H = 3600 * 1000;
  const COUNT_AFTER_SEC = 120;      // практика засчитывается после 2 минут
  const INTEGRATION_AFTER = 8 * H;  // интеграция через 8 часов
  const NEXT_AFTER = 48 * H;        // следующая практика через 48 часов
  const KEY = "karta-state-v1";

  // ---------- состояние (пока на устройстве; потом — сервер) ----------
  const blank = () => ({ listens: {}, notes: {}, integr: {}, shift: 0, profile: null, myimg: {}, playlist: [], music: { timer: 60, repeat: "list", fade: true }, pod: {}, catches: [], days: {}, dreams: {}, sym: {} });
  let S;
  try { S = Object.assign(blank(), JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { S = blank(); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
  const now = () => Date.now() + (S.shift || 0);

  // ---------- утилиты ----------
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = (sel) => document.querySelector(sel);
  const app = $("#app");
  const go = (h) => { location.hash = h; };
  const haptic = (t) => { try { tg && tg.HapticFeedback && tg.HapticFeedback.notificationOccurred(t || "success"); } catch (e) {} };
  const toast = (msg) => { const d = document.createElement("div"); d.className = "toast"; d.setAttribute("role", "status"); d.textContent = msg; document.body.appendChild(d); setTimeout(() => d.remove(), 3000); };
  const fmt = (sec) => { sec = Math.max(0, Math.floor(sec)); return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0"); };
  const fmtWhen = (ts) => {
    const d = new Date(ts);
    const days = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
    const today = new Date(now()); today.setHours(0, 0, 0, 0);
    const day = new Date(ts); day.setHours(0, 0, 0, 0);
    const diff = Math.round((day - today) / 86400000);
    const hm = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    if (diff === 0) return "сегодня в " + hm;
    if (diff === 1) return "завтра в " + hm;
    return days[d.getDay()] + ", " + d.getDate() + "." + String(d.getMonth() + 1).padStart(2, "0") + " в " + hm;
  };
  const icon = {
    back: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
    chev: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9FB2C8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
    check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0F1E33" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>',
    lock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7F93AA" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="Закрыто"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
    pause: '<svg width="28" height="28" viewBox="0 0 24 24" fill="#0F1E33" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
    play: '<svg width="28" height="28" viewBox="0 0 24 24" fill="#0F1E33" aria-hidden="true"><path d="M7 4l13 8-13 8z"/></svg>',
    rew: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
    note: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9FB2C8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>',
    pauseS: '<svg width="20" height="20" viewBox="0 0 24 24" fill="#8CC4E8" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
    plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9FB2C8" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    checkS: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A9CBB3" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>',
    fwd: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>'
  };
  const back = (href, label) => `<a class="back" href="${href}">${icon.back}${esc(label)}</a>`;

  // ---------- правила ----------
  const CYC = C.cycles || [];
  // «Перед сном» переехало в голосовое сопровождение; новые погружения — заглушками, пока нет записей
  const FREE_SOON = [
    { id: "ryadom", title: "Рядом", short: "Если открылось старое чувство: стыд, вина, «опять я…». Побыть рядом с собой и бережно закрыть.", tone: 1 },
    { id: "opora", title: "Опора", short: "Для тех, кто с детства держит других и боится подвести.", tone: 0 },
    { id: "gavan", title: "Тихая гавань", short: "Когда накрывает. Три минуты: тело, дыхание, комната.", tone: 3 },
    { id: "storozh", title: "Сторож", short: "Встретиться со своей тревогой и узнать, что она охраняет.", tone: 2 },
    { id: "ryukzak", title: "Рюкзак", short: "Разобрать, что несешь, и оставить чужое у дороги.", tone: 1 },
    { id: "kritik", title: "Критик и защитник", short: "Когда внутренний голос не дает покоя.", tone: 0 },
    { id: "dom", title: "Дом", short: "Если одиноко или пусто внутри.", tone: 3 }];
  const FREE = (C.free || []).filter((p) => p.id !== "son" && p.title !== "Перед сном");
  FREE_SOON.forEach((x) => { if (!FREE.some((p) => p.id === x.id)) FREE.push(Object.assign({ soon: true }, x)); });
  CYC.forEach((cy, ci) => cy.practices.forEach((p, i) => { p._cy = cy; p._ci = ci; p._i = i; }));
  FREE.forEach((p, i) => { p._cy = null; p._i = i; p._free = true; });
  const cycle = CYC[0];
  const ALLP = CYC.reduce((a, cy) => a.concat(cy.practices), []).concat(FREE);
  const prac = (id) => ALLP.find((p) => p.id === id);
  const idx = (id) => { const p = prac(id); return p ? p._i : -1; };
  const counted = (id) => S.listens[id] || null;
  const real = (cy) => cy.practices.filter((p) => !p.soon);
  const cyDone = (cy) => real(cy).every((p) => counted(p.id));
  const cyLast = (cy) => Math.max.apply(null, real(cy).map((p) => counted(p.id) || 0));
  const cyCount = (cy) => real(cy).filter((p) => counted(p.id)).length;
  function unlockAt(id) {
    const p = prac(id); if (!p || p.soon) return null;
    if (p._free) return cyDone(cycle) ? cyLast(cycle) : null; // вне циклов — после всех «Первых шагов»
    const cy = p._cy;
    let j = p._i - 1; while (j >= 0 && cy.practices[j].soon) j--;
    if (j < 0) { if (p._ci === 0) return 0; const prev = CYC[p._ci - 1]; return cyDone(prev) ? cyLast(prev) + NEXT_AFTER : null; }
    const prevTs = counted(cy.practices[j].id);
    return prevTs ? prevTs + NEXT_AFTER : null; // null — предыдущая еще не пройдена
  }
  // промокод (декабрь 2026): люди уже проходили эти погружения вживую — все открыто сразу, интеграции без ожидания
  const promoOpen = () => !!(S.access && S.access.plan === "promo" && now() < new Date((S.access.until || "2026-12-30") + "T23:59:59").getTime());
  const isOpen = (id) => { const p = prac(id); if (promoOpen() && p && !p.soon) return true; return !!counted(id) || (unlockAt(id) !== null && now() >= unlockAt(id)); };
  const integrAt = (id) => (counted(id) ? counted(id) + INTEGRATION_AFTER : null);
  const hasInt = (p) => !!(p && p.integration && !p.integration.soon);
  const integrOpen = (id) => hasInt(prac(id)) && (promoOpen() || (!!counted(id) && now() >= integrAt(id)));
  const integrDone = (id) => !!(S.integr[id] && S.integr[id].done);
  function nextStep() {
    for (const cy of CYC) for (const p of cy.practices) if (!p.soon && !counted(p.id)) return p;
    return null;
  }
  const lockHint = (p) => {
    if (p.soon) return "скоро";
    if (p._free) return "откроется после «" + cycle.title + "» · " + cyCount(cycle) + " из " + real(cycle).length;
    const at = unlockAt(p.id);
    if (at) return "откроется " + fmtWhen(at);
    if (p._i === 0 && p._ci > 0) return "откроется после цикла «" + CYC[p._ci - 1].title + "»";
    return "через 48 ч после предыдущей";
  };
  const where = (p) => p._free ? "Вне циклов" : p._cy.title + " · " + (p._i + 1) + " из " + p._cy.practices.length;

  // ---------- экраны ----------
  function confirmReset() { return window.confirm ? window.confirm("Стереть все записи на этом устройстве?") : true; }

  const artOf = (cy) => (window.CYCLE_ART || [])[CYC.indexOf(cy)];
  const CY_ART = ["Pogruzheniya-2.webp", "Pogruzheniya-3.webp", "Pogruzheniya-4.webp"];
  const cyArt = (cy) => CY_ART[CYC.indexOf(cy) % 3];
  const ICN_PLAY = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>';
  const ICN_CHECK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const ICN_LOCK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  const dots = (cy) => { const n = real(cy).length, d = cyCount(cy); return `<span class="cy-dots">${Array.from({ length: n }, (_, i) => `<i class="${i < d ? "on" : ""}"></i>`).join("")}</span><span class="small" style="font-size:12px">${d} из ${n}</span>`; };
  function Cycle(cid) {
    const cy = CYC.find((x) => x.id === cid) || cycle, ci = CYC.indexOf(cy);
    setBg("Pogruzheniya-1.webp", { pos: "0% 0" });
    let h = `<img class="cy-hero" src="${V27}${cyArt(cy)}" alt=""><div class="stack" style="gap:20px">${back("#/dives", "Циклы")}
      <div class="cy-h"><div class="cap">Цикл ${cy.n || ci + 1} · ${cyCount(cy)} из ${real(cy).length}</div><h1>${esc(cy.title)}</h1>${cy.desc ? `<p>${esc(cy.desc)}</p>` : ""}${cy.note ? `<p class="small">${esc(cy.note)}</p>` : ""}</div>
      <div class="stack" style="gap:8px">`;
    cy.practices.forEach((p, i) => {
      const done = !!counted(p.id), open = isOpen(p.id), mins = p.duration ? Math.round(p.duration / 60) + " мин" : "";
      const n = `${i + 1}. ${esc(p.title)}`;
      if (done) h += `<a class="pr-row" href="#/prep/${p.id}"><span class="pr-i">${ICN_CHECK}</span><span class="t"><b>${n}</b><span>${[mins, S.notes[p.id] && S.notes[p.id].image ? "заметка есть" : "", integrOpen(p.id) && !integrDone(p.id) ? "интеграция открыта" : hasInt(p) && !integrOpen(p.id) ? "интеграция — " + fmtWhen(integrAt(p.id)) : ""].filter(Boolean).join(" · ")}</span></span></a>`;
      else if (open) h += `<a class="pr-row cur" href="#/prep/${p.id}"><span class="pr-i on">${ICN_PLAY}</span><span class="t"><b>${n}</b><span>${[mins, "можно слушать"].filter(Boolean).join(" · ")}</span></span></a>`;
      else h += `<div class="pr-row off"><span class="pr-i lk">${p.soon ? "" : ICN_LOCK}</span><span class="t"><b>${n}</b><span>${esc(lockHint(p))}</span></span></div>`;
    });
    h += `</div></div>`;
    app.innerHTML = h;
  }

  function Prep(id) {
    const p = prac(id);
    if (!p || p.soon || !isOpen(id)) return go(p && p._cy ? "#/cycle/" + p._cy.id : "#/dives");
    if (!S.ask) S.ask = {};
    const mins = Math.round(p.duration / 60);
    setBg("Pogruzheniya-1.webp");
    let h = `${p._free ? "" : `<img class="cy-hero" src="${V27}${cyArt(p._cy)}" alt="">`}<div class="stack" style="gap:18px">${p._free ? back("#/dives", "Погружения") : back("#/cycle/" + p._cy.id, p._cy.title)}
      <div class="cy-h"><div class="cap">${esc(p._free ? "Вне циклов" : p._cy.title + " · " + (p._i + 1) + " из " + p._cy.practices.length)}</div><h1>${esc(p.title)}</h1><p>${mins} минут</p></div>
      ${p.intro.map((t) => `<p class="lead">${esc(t)}</p>`).join("")}
      ${p.accent ? `<div class="card" style="padding:18px"><div style="font-weight:500;font-size:18px;color:var(--cream)">${esc(p.accent.title)}</div><div style="font-size:15px;line-height:1.6;color:var(--text-body)">${esc(p.accent.text)}</div></div>` : ""}
      ${p.introAfter ? `<p class="lead">${esc(p.introAfter)}</p>` : ""}
      ${p.warn ? `<div class="card" style="padding:16px"><div class="cap">Внимание</div><div style="font-size:15px;line-height:1.55">${esc(p.warn)}</div></div>` : ""}
      ${p.ask ? `<label class="q"><b>Твой запрос</b><span>Одной фразой. Он сохранится и будет ждать тебя после практики.</span><textarea id="ask" rows="2" placeholder="Что меня держит в…">${esc((S.ask[id] && S.ask[id].text) || "")}</textarea></label>` : ""}
      <div class="card prep-l">
        <div class="row"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-6h3zM3 19a2 2 0 0 0 2 2h1v-6H3z"/></svg>Наушники</div>
        <div class="row"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>Место, где никто не потревожит</div>
        <div class="row"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/></svg>Около ${mins} минут только для себя</div>
        <div class="row"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M3 3l18 18"/></svg>Уведомления выключены, экран можно погасить</div>
      </div>
      ${hasInt(p) ? `<p class="small center">Интеграция откроется через 8 часов после прослушивания</p>` : ""}
      <a class="btn" id="start" href="#/player/${id}">${ICN_PLAY}<span style="margin-left:10px">Начать погружение</span></a>
      <details class="safe-d"><summary>Правила безопасности</summary>
        <p><b>Открыть глаза можно в любой момент.</b> Если стало страшно или неприятно — открой глаза, почувствуй опору, назови три предмета вокруг. Образ подождет.</p>
        <p><b>Когда лучше не погружаться:</b> острое состояние (паника, сильное горе прямо сейчас); опыт психоза или галлюцинаций, эпилепсия; алкоголь или вещества; за рулем и в местах, где нужно внимание. В таких случаях начни с <a href="#/aid">Аптечки</a> или поговори со специалистом.</p>
      </details>
      ${counted(id) ? `<a class="link-row" href="#/after/${id}">Заметка «сразу после» ${icon.chev}</a>` : ""}
    </div>`;
    app.innerHTML = h;
    const ask = $("#ask");
    if (ask) ask.oninput = () => { S.ask[id] = { text: ask.value, at: now() }; save(); };
  }
  // перед первым погружением — коротко о безопасности
  function Safety(id) {
    // правила безопасности теперь на экране подготовки — старые ссылки ведут туда
    return go("#/prep/" + id);
    app.innerHTML = `<div class="stack">${back("#/prep/" + id, "Назад")}
      <div class="stack" style="gap:6px"><div class="kicker" style="color:var(--sage);font-weight:700;letter-spacing:.08em">ПЕРЕД ПЕРВЫМ ПОГРУЖЕНИЕМ</div><h1>Ты в безопасности</h1></div>
      <p class="lead">Погружение — это расслабление и образы, которые приходят сами. Ты все время слышишь голос, чувствуешь тело и решаешь, куда смотреть и где остановиться.</p>
      <div class="card sage" style="padding:18px;gap:10px"><div style="font-weight:800;color:var(--sage-l)">Открыть глаза можно в любой момент</div><div style="font-size:14px;line-height:1.55">Если стало страшно или неприятно — открой глаза, почувствуй опору, назови три предмета вокруг. Образ подождет.</div></div>
      <div class="card terra" style="padding:18px;gap:8px"><div style="font-weight:800;color:var(--terra-l)">Когда лучше не погружаться</div>
        <ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.6"><li>острое состояние: паника, сильное горе прямо сейчас</li><li>опыт психоза или галлюцинаций, эпилепсия</li><li>алкоголь или вещества</li><li>за рулем и в местах, где нужно внимание</li></ul>
        <div class="small" style="color:var(--muted2)">В таких случаях начни с Аптечки или поговори со специалистом.</div></div>
      <a class="btn" href="#/player/${id}" id="ok">Понятно, начать</a>
      <a class="link-row" href="#/aid" style="justify-content:center;border:none;color:var(--terra-l)">Сейчас тяжело — в Аптечку</a></div>`;
    $("#ok").onclick = () => { S.safety = now(); save(); };
  }
  const diveEl = window.__kartaDive || (window.__kartaDive = new Audio());
  diveEl.preload = "auto";

  // плеер погружения: пока без аудиофайла — время идет по таймеру.
  // Свернуть нельзя: уход с экрана — только через «Завершить погружение?».
  let timer = null;
  let PL = null; // { id, pos, playing }
  const mix = (a, b, k) => { const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); const x = p(a), y = p(b); return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, "0")).join(""); };
  function diveScene() {
    return `<div class="dv2" aria-hidden="true"><div class="dv2-dark" id="dvdark"></div>
      <div class="dv2-line"><span style="top:0">поверхность</span><span style="top:100%">глубина</span><img class="dv2-pearl" id="dvpearl" src="${V27}PleerIdet-1.webp" alt=""></div></div>`;
  }
  function setDepth(t) {
    const d = t < 0.15 ? t / 0.15 : t > 0.85 ? Math.max(0, (1 - t) / 0.15) : 1; // спуск — глубина — всплытие
    const dk = document.getElementById("dvdark"), pr = document.getElementById("dvpearl");
    if (!dk) return;
    dk.style.opacity = (0.55 * d).toFixed(2);
    pr.style.top = (d * 100).toFixed(1) + "%";
    const st = document.getElementById("dvst"); if (st) st.textContent = t < 0.15 ? "спуск · дыши свободно" : t > 0.85 ? "всплытие · не торопись" : "глубина";
  }
  function exitSheet() {
    if (!PL || document.querySelector(".sheet-bg")) return;
    const id = PL.id, was = PL.playing; PL.playing = false; try { diveEl.pause(); } catch (e) {}
    const pp = $("#pp"); if (pp) pp.innerHTML = icon.play;
    const bg = document.createElement("div"); bg.className = "sheet-bg";
    bg.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="exh"><div class="grip"></div>
      <h2 id="exh" style="font-size:20px">Завершить погружение?</h2>
      <p class="lead">Запись остановится. Перед тем как выйти, сделай пару глубоких вдохов и почувствуй опору под собой.</p>
      <button class="btn" id="exstay">Продолжить погружение</button>
      <button class="btn ghost" id="exgo" style="border-color:var(--terra-line);color:var(--terra-l)">Завершить</button></div>`;
    document.body.appendChild(bg);
    const close = () => bg.remove();
    $("#exstay").onclick = () => { close(); if (PL) { PL.playing = was; if (was && diveEl.src) diveEl.play().catch(() => {}); const b = $("#pp"); if (b) b.innerHTML = was ? icon.pause : icon.play; } };
    bg.onclick = (e) => { if (e.target === bg) $("#exstay").click(); };
    $("#exgo").onclick = () => { close(); leaveDive(id); };
  }
  // плеер медленно растворяется, вода светлеет — и только потом экран возвращения
  function leaveDive(id) {
    clearInterval(timer); timer = null; PL = null;
    try { diveEl.pause(); diveEl.removeAttribute("src"); diveEl.load(); } catch (e) {}
    wake(false);
    const ui = document.querySelector(".dive-ui"); if (ui) ui.classList.add("fading");
    const dd = document.querySelector(".dive-depth"); if (dd) dd.style.opacity = "0";
    setDepth(1);
    setTimeout(() => go("#/return/" + id), 1800);
  }
  function Player(id) {
    const p = prac(id);
    if (!p || p.soon) return go("#/");
    const fresh = !PL || PL.id !== id;
    if (fresh) PL = { id, pos: 0, playing: true };
    if (NOW.kind) closeAudio();
    const D = () => (p.src && diveEl.duration && isFinite(diveEl.duration) ? diveEl.duration : p.duration);
    setBg("Pogruzheniya-1n.webp", { pos: "0% 0" }); document.body.classList.add("nofade");
    app.innerHTML = `${diveScene()}<div class="pl2 dive-ui">
      <div class="row" style="justify-content:space-between"><button class="pl2-x" id="exit"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>Выйти</button><span class="cap" style="opacity:.6">${esc(p._free ? "Вне циклов" : p._cy.title + " · " + (p._i + 1))}</span></div>
      <div class="pl2-b"><div class="center"><div class="pl2-t">${esc(p.title)}</div><div class="small" id="dvst">спуск · дыши свободно</div></div>
      <div class="seek"><input id="seek" type="range" min="0" max="${Math.floor(p.duration)}" value="0" aria-label="Перемотка"><div class="times"><span id="cur">0:00</span><span id="dur">${fmt(p.duration)}</span></div></div>
      <div class="pl2-c"><button class="pl2-r" id="rew" aria-label="Назад на 15 секунд">−15</button><button class="pl2-p" id="pp" aria-label="Пауза">${PL.playing ? icon.pause : icon.play}</button><button class="pl2-r" id="fwd" aria-label="Вперед на 15 секунд">+15</button></div></div>
    </div>`;
    const seek = $("#seek"), cur = $("#cur"), pp = $("#pp");
    const setPP = () => { pp.innerHTML = PL.playing ? icon.pause : icon.play; pp.setAttribute("aria-label", PL.playing ? "Пауза" : "Продолжить"); };
    const finish = () => leaveDive(id);
    const sync = () => {
      if (!PL) return;
      const d = D();
      seek.max = Math.floor(d); seek.value = PL.pos; cur.textContent = fmt(PL.pos); $("#dur").textContent = fmt(d); setDepth(PL.pos / d);
      if (PL.pos >= COUNT_AFTER_SEC && !counted(id)) { S.listens[id] = now(); save(); }
      if (!p.src && PL.pos >= d) finish();
    };
    if (p.src) {
      if (fresh || diveEl.getAttribute("src") !== p.src) { diveEl.src = p.src; diveEl.currentTime = 0; }
      diveEl.onended = () => { if (PL && PL.id === id) { PL.pos = D(); sync(); finish(); } };
      if (PL.playing) diveEl.play().catch(() => { PL.playing = false; setPP(); toast("Нажми ▶, чтобы начать"); });
      try { if ("mediaSession" in navigator) navigator.mediaSession.metadata = new MediaMetadata({ title: p.title, artist: "Настя Черемных · Карта Глубины" }); } catch (e) {} sessionFor("dive");
    }
    wake(true);
    clearInterval(timer);
    timer = setInterval(() => { if (!PL) return; if (p.src) { PL.pos = diveEl.currentTime || PL.pos; PL.playing = !diveEl.paused; } else if (PL.playing) PL.pos += 1; sync(); }, 1000);
    sync();
    pp.onclick = () => {
      PL.playing = !PL.playing;
      if (p.src) { if (PL.playing) diveEl.play().catch(() => {}); else diveEl.pause(); }
      setPP();
    };
    const jump = (dt) => { PL.pos = Math.max(0, Math.min(D(), PL.pos + dt)); if (p.src) diveEl.currentTime = PL.pos; sync(); };
    $("#rew").onclick = () => jump(-15);
    $("#fwd").onclick = () => jump(15);
    seek.oninput = () => { PL.pos = Number(seek.value); if (p.src) diveEl.currentTime = PL.pos; sync(); };
    $("#exit").onclick = exitSheet;
  }

  function Return(id) {
    setBg("Pogruzheniya-1n.webp");
    const p = prac(id), ln = (d, html) => `<div class="ln" style="animation-delay:${d}s">${html}</div>`;
    app.innerHTML = `<img class="ret-pearl" src="${V27}PleerIdet-1.webp" alt=""><div class="stack" style="gap:14px;padding-top:calc(min(100vw,520px) * .9)">
      ${ln(0.3, "<h1>С возвращением</h1>")}
      ${ln(1.2, '<p class="lead">Не торопись. Почувствуй опору под собой, пошевели пальцами, потянись, как после сна.</p>')}
      <div class="ln stack" style="animation-delay:2.4s;gap:10px;margin-top:10px">
        <a class="btn" href="#/after/${id}">Записать, что пришло</a>
        ${p && hasInt(p) && counted(id) ? `<div class="card row" style="flex-direction:row;gap:12px;padding:14px 16px;font-size:14px;color:var(--text-body)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/></svg>Интеграция откроется через 8 часов</div>` : ""}
        <a class="center" href="#/observer/${id}" style="padding:14px 0;font-weight:500;color:var(--cream)">Сложно вернуться в реальность?<br>практика «Наблюдатель»</a>
        ${counted(id) ? "" : `<p class="small center">Практика не засчитана — прошло меньше двух минут. К ней можно вернуться в любой момент.</p>`}
      </div></div>`;
  }

  // поле с голосовым вводом
  const MIC_I = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
  const vta = (id, val, ph, rows, attr) => `<div class="vta"><textarea id="${id}" ${attr || ""} rows="${rows || 4}" placeholder="${esc(ph || "Можно словами, можно голосом…")}">${esc(val || "")}</textarea><button type="button" class="mic" data-mic="${id}" aria-label="Наговорить голосом">${MIC_I}</button></div>`;
  function bindMics() {
    app.querySelectorAll("[data-mic]").forEach((b) => b.onclick = () => {
      const t = document.getElementById(b.dataset.mic), box = b.parentNode;
      const lbl = { set textContent(v) { b.setAttribute("aria-label", v); let st = box.querySelector(".mic-st"); if (v === "Рассказать голосом") { if (st) st.remove(); return; } if (!st) { st = document.createElement("span"); st.className = "mic-st"; box.appendChild(st); } st.textContent = v; } };
      voice(b, lbl, (txt) => { t.value = (t.value ? t.value.trim() + " " : "") + txt; t.dispatchEvent(new Event("input")); t.dispatchEvent(new Event("change")); });
    });
  }
  // «Обсудить с Настей»: обычно / пробный период / вопросы месяца закончились
  function nastyaBox() {
    const m = new Date(now()), used = (S.questions || []).filter((q) => { const d = new Date(q.at); return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear(); }).length;
    const trial = S.plan === "trial", lim = used >= 4;
    const sub = trial ? "Вопросы Насте откроются после оформления подписки. Сессию можно записать уже сейчас." : lim ? used + " из 4 вопросов в этом месяце. Похоже, вопросов становится больше — может, пора поговорить на сессии?" : "Ответ придет сюда, в приложение, в течение 48 часов · " + used + " из 4 вопросов в этом месяце";
    const ask = trial ? `<span class="btn milk dis">${ICN_LOCK}<span style="margin-left:6px">Вопрос</span></span>` : lim ? `<a class="btn milk" href="#/ask">Вопрос · 500 ₽</a>` : `<a class="btn" href="#/ask">Задать вопрос</a>`;
    const ses = `<a class="btn ${trial || lim ? "" : "milk"}" href="#/consult">Записаться на сессию</a>`;
    return `<div class="card nbox"><div class="row" style="gap:14px;align-items:flex-start"><span class="av-n">Н</span><span class="stack" style="gap:4px"><b style="font-size:17px;font-weight:500;color:var(--cream)">Обсудить с Настей</b><span class="small" style="font-size:13px;color:var(--text-body)">${sub}</span></span></div><div class="two">${lim ? ses + ask : ask + ses}</div></div>`;
  }
  function After(id) {
    const p = prac(id);
    const n = S.notes[id] || { image: "", feelings: [], own: [], stand: "" }; n.feelings = n.feelings || [];
    const all = C.feelings.concat(n.own || []);
    const saved = !!n.savedAt;
    app.innerHTML = `<div class="stack" style="gap:16px">${back("#/return/" + id, "Возвращение")}
      <div class="scr-h" style="margin-top:calc(min(100vw,520px) * .52)"><div class="cap">Сразу после · ${esc(p._free ? "вне циклов" : p._cy.title + " · " + (p._i + 1))}</div><h1>Что пришло</h1><p>Образы, ощущения, слова — как есть, без разбора.</p></div>
      ${p.ask && S.ask && S.ask[id] && S.ask[id].text ? `<div class="card"><div class="cap">Твой запрос</div><div style="font-size:15px">${esc(S.ask[id].text)}</div><div class="small">Перечитай его и заметь, как он звучит теперь.</div></div>` : ""}
      <div class="stack" style="gap:10px"><b class="qb">Что было в образе?</b>${vta("img", n.image, "Все, что пришло: картинки, звуки, ощущения — одним текстом", 5)}</div>
      <div class="stack" style="gap:10px"><b class="qb">С каким чувством ты возвращаешься?</b><div class="chips" id="feel">${all.map((f) => `<button type="button" class="chip${n.feelings.includes(f) ? " on" : ""}" data-f="${esc(f)}">${esc(f)}</button>`).join("")}<button type="button" class="chip add" id="addf">+ свое</button></div></div>
      <a class="link-row" href="#/body/n/${id}/front"><span class="row" style="gap:12px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="4.5" r="2"/><path d="M12 7v7M8 10h8M9.5 21l2.5-7 2.5 7"/></svg><span>${n.body && Object.keys(n.body).length ? "В теле отмечено: " + Object.keys(n.body).length : n.bodyQuiet ? "Тело молчало" : "Отметить, где откликнулось в теле"}</span></span>${icon.chev}</a>
      ${p.integration ? `<p class="small row" style="gap:10px;align-items:flex-start"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true" style="flex-shrink:0;margin-top:2px"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/></svg>Интеграция откроется через 8 часов — вернемся к этой записи.</p>` : ""}
      <button class="btn" id="save">${saved ? "Сохранено. Обсудить с Проводником?" : "Сохранить"}</button>
      ${p.closing && p.closing.text ? `<div class="card">${p.closing.title ? `<div style="font-weight:500;color:var(--cream)">${esc(p.closing.title)}</div>` : ""}<div style="font-size:14px;color:var(--text-body)">${esc(p.closing.text)}</div></div>` : ""}
    </div>`;
    bindMics();
    const sel = new Set(n.feelings);
    const draft = () => { S.notes[id] = Object.assign(S.notes[id] || {}, { image: $("#img").value, feelings: Array.from(sel), own: n.own || [] }); save(); $("#save").textContent = "Сохранить"; };
    $("#img").addEventListener("input", draft);
    app.querySelectorAll("[data-f]").forEach((b) => b.onclick = () => { const f = b.dataset.f; sel.has(f) ? sel.delete(f) : sel.add(f); b.classList.toggle("on"); draft(); });
    $("#addf").onclick = () => {
      const w = (window.prompt && window.prompt("Свое слово для чувства")) || "";
      const t = w.trim().toLowerCase(); if (!t) return;
      n.own = Array.from(new Set((n.own || []).concat(t))); sel.add(t); S.notes[id] = Object.assign(n, { image: $("#img").value, feelings: Array.from(sel) }); save(); After(id);
    };
    $("#save").onclick = () => {
      const b = $("#save");
      if (b.textContent.indexOf("Проводник") >= 0) { S.guide = Object.assign(gNew(), { dive: id }); S.guideDraft = "После погружения «" + p.title + "» пришло: " + (S.notes[id].image || "") + " "; save(); return go("#/guide"); }
      S.notes[id] = Object.assign(S.notes[id] || {}, { image: $("#img").value.trim(), feelings: Array.from(sel), own: n.own || [], savedAt: now() });
      save(); haptic(); toast("Сохранено в Мою карту"); b.textContent = "Сохранено. Обсудить с Проводником?";
    };
  }

  // фото рисунка: уменьшаем до 720 px, чтобы поместилось в память устройства
  function photoOf(file, cb) {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => { const im = new Image(); im.onload = () => { const k = Math.min(1, 720 / Math.max(im.width, im.height)); const cv = document.createElement("canvas"); cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k); cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height); try { cb(cv.toDataURL("image/jpeg", 0.72)); } catch (e) { toast("Не получилось сохранить фото"); } }; im.src = r.result; };
    r.readAsDataURL(file);
  }
  function Journal() {
    const items = ALLP.filter((p) => S.notes[p.id] || counted(p.id)).sort((x, y) => (counted(y.id) || 0) - (counted(x.id) || 0));
    let h = `<div class="stack" style="gap:16px">${back("#/dives", "Погружения")}<div class="scr-h"><div class="cap">Пройденные</div><h1>Мои погружения</h1><p>Можно переслушивать в любом порядке.</p></div><div style="height:30px"></div>`;
    if (!items.length) h += `<p class="lead">Здесь появятся заметки после погружений.</p>`;
    items.forEach((p) => {
      const n = S.notes[p.id] || {}, t = counted(p.id);
      const act = integrOpen(p.id) && !integrDone(p.id) ? `<a class="pill-c" href="#/integr/${p.id}">Записать интеграцию</a>` : hasInt(p) && t && !integrOpen(p.id) ? `<span class="small row" style="gap:8px"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/></svg>Интеграция откроется ${fmtWhen(integrAt(p.id))}</span>` : "";
      h += `<div class="card jr"><div class="row" style="justify-content:space-between"><span class="small">${esc(p._free ? "Вне цикла" : p._cy.title)}</span><span class="small">${t ? dayLabel(t) : ""}</span></div>
        <a href="#/prep/${p.id}" class="jr-t">${esc(p.title)}</a>
        ${n.image ? `<a class="jr-x" href="#/after/${p.id}">«${esc(n.image.length > 120 ? n.image.slice(0, 120) + "…" : n.image)}»</a>` : `<a class="small" href="#/after/${p.id}" style="color:var(--cream)">Записать, что пришло</a>`}
        ${integrDone(p.id) ? `<a class="small" href="#/integr/${p.id}" style="color:var(--cream)">Интеграция записана</a>` : act}</div>`;
    });
    app.innerHTML = h + `</div>`;
  }
  function Integr(id) {
    const p = prac(id);
    if (!p || !p.integration) return go("#/");
    const hd = (sub) => `${back("#/journal", "Мои погружения")}<div class="scr-h" style="margin-top:calc(min(100vw,520px) * .52)"><div class="cap">Интеграция · ${esc(p._free ? "вне циклов" : p._cy.title + " · " + (p._i + 1))}</div><h1>${esc(p.title)}</h1><p>${sub}</p></div>`;
    if (p.integration.soon) { app.innerHTML = `<div class="stack">${hd("Интеграция к этой практике скоро появится. А пока побудь с тем ощущением, которое осталось в теле.")}</div>`; return; }
    if (!integrOpen(id)) {
      const at = integrAt(id), n0 = S.notes[id] || {};
      const left = at ? Math.max(0, at - now()) : 0, hh = Math.floor(left / 3600e3), mm = Math.ceil((left % 3600e3) / 60000);
      app.innerHTML = `<div class="stack" style="gap:18px">${hd(at ? "Интеграция откроется " + fmtWhen(at) + "." : "Интеграция откроется через 8 часов после прослушивания.")}
        ${n0.image ? `<button type="button" class="paper" id="paper"><img src="${V27}Integraciya-1.webp" alt=""><img class="pin" src="${V27}Segodnya5m-4.webp" alt=""><span class="paper-t"><span class="cap" style="color:#7A6650">Запись сразу после</span><span class="paper-x">«${esc(n0.image)}»</span><span class="paper-h">Коснись, чтобы развернуть</span></span></button>` : at ? `<a class="card" href="#/after/${id}" style="gap:6px"><span class="cap">Запись сразу после</span><span class="small">Пока пусто. Можно записать, что пришло, до начала интеграции.</span></a>` : ""}
        ${at ? `<div class="card row" style="flex-direction:row;gap:14px;align-items:center"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F5E8D9" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/></svg><span class="stack" style="gap:2px"><b style="font-weight:500;font-size:20px">${hh ? hh + " ч " : ""}${mm} мин</b><span class="small">до интеграции. Пусть пока побудет внутри.</span></span></div>` : `<a class="btn" href="#/prep/${id}">К погружению</a>`}</div>`;
      if ($("#paper")) $("#paper").onclick = () => $("#paper").classList.toggle("open");
      return;
    }
    const I = p.integration, a = (S.integr[id] && S.integr[id].answers) || {}, done = S.integr[id] && S.integr[id].done;
    const n = S.notes[id] || {};
    const field = (k, t, d, ph) => `<div class="stack" style="gap:8px"><b class="qb">${esc(t)}</b>${d ? `<span class="small">${esc(d)}</span>` : ""}${vta("f_" + k, a[k], ph || "Можно словами, можно голосом…", 3, `data-k="${k}"`)}</div>`;
    let h = `<div class="stack" style="gap:18px">${hd(counted(id) && !promoOpen() ? "Прошло 8 часов. Вернемся к тому, что пришло." : "Вернемся к тому, что пришло в погружении.")}
      ${n.image ? `<button type="button" class="paper" id="paper"><img src="${V27}Integraciya-1.webp" alt=""><img class="pin" src="${V27}Segodnya5m-4.webp" alt=""><span class="paper-t"><span class="cap" style="color:#7A6650">Запись сразу после</span><span class="paper-x">«${esc(n.image)}»</span><span class="paper-h">Коснись, чтобы развернуть</span></span></button>` : ""}
      ${I.lead ? `<p class="lead">${esc(I.lead)}</p>` : ""}
      ${I.questions.map((q, i) => field("q" + i, q.t, q.d)).join("")}`;
    if (I.minute) h += `<div class="card" style="padding:18px"><div style="font-size:14px;color:var(--text-body)">${esc(I.minute.intro)}</div><div style="font-size:17px;font-weight:500;font-style:italic;color:var(--cream)">${esc(I.minute.q)}</div></div>${field("minute", "Что приходит", "", "Можно одним словом…")}`;
    if (I.forks) I.forks.forEach((f, i) => { h += `<div class="card" style="padding:18px"><div class="cap">${esc(f.label)}</div>${f.intro ? `<div style="font-size:14px;color:var(--text-body)">${esc(f.intro)}</div>` : ""}<div style="font-size:16px;font-weight:500;font-style:italic;color:var(--cream)">${esc(f.q)}</div></div>${field("fork" + i, "Ответ", "", "")}`; });
    if (I.outro) h += `<p class="lead">${esc(I.outro)}</p>`;
    h += `<button class="btn" id="done">${done ? "Сохранено. Обсудить с Проводником?" : "Сохранить в Мою карту"}</button>${nastyaBox()}</div>`;
    app.innerHTML = h;
    bindMics();
    const pp = $("#paper"); if (pp) pp.onclick = () => pp.classList.toggle("open");
    const collect = () => { const o = {}; app.querySelectorAll("[data-k]").forEach((t) => { if (t.value.trim()) o[t.dataset.k] = t.value.trim(); }); return o; };
    app.querySelectorAll("[data-k]").forEach((t) => t.onchange = () => { S.integr[id] = Object.assign(S.integr[id] || {}, { answers: collect() }); save(); });
    $("#done").onclick = () => {
      if ($("#done").textContent.indexOf("Проводник") >= 0) { S.guide = Object.assign(gNew(), { dive: id }); S.guideDraft = "Интеграция после «" + p.title + "». "; save(); return go("#/guide"); }
      S.integr[id] = { answers: collect(), done: true, at: now() }; save(); haptic(); toast("Сохранено в Мою карту"); $("#done").textContent = "Сохранено. Обсудить с Проводником?";
    };
  }

  function Aid() {
    app.innerHTML = `<div class="stack">${back("#/", "Сегодня")}
      <div class="stack" style="gap:6px"><div class="kicker terra">Аптечка</div><h1>Если сейчас тяжело</h1></div>
      <a class="choice big" href="#/catch" style="padding:20px"><span class="t"><b style="font-size:20px">Плохо, а что — не понять</b><span>накрыло сейчас или тянется давно</span></span>${icon.chev}</a>
      <div class="kicker" style="letter-spacing:.08em;margin-top:6px">ПРАКТИКИ</div>
      <div class="stack" style="gap:8px">
        <a class="sym-row" href="#/observer"><span class="t"><b>Сложно вернуться в реальность</b><span>Наблюдатель · прочитать и сделать · 2–3 мин</span></span>${icon.chev}</a>
        <div class="sym-row" style="background:none;border:1px dashed var(--line)"><span class="t"><b style="color:var(--muted)">Тревога, гнев, грусть и другие гнетущие чувства</b><span>скоро</span></span></div>
      </div>
      <div class="kicker" style="letter-spacing:.08em;margin-top:6px">ЖИВОЙ КОНТАКТ</div>
      ${nastyaBox()}
      <a class="link-row" href="#/export"><span class="t" style="display:flex;flex-direction:column;gap:2px"><b style="font-weight:500">Собрать наблюдения для психолога</b><span class="small" style="font-size:12px">записи за период одним текстом</span></span>${icon.chev}</a>
      <p class="small center">Если есть угроза жизни — звони 112.</p>
    </div>`;
  }
  const ICO = {
    cyc: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8CC4E8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>',
    req: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8CC4E8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></svg>',
    msg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8CC4E8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    cal: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A9CBB3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>'
  };
  // вопрос Насте: пока хранится на устройстве, отправка заработает с сервером
  function Ask() {
    if (!S.questions) S.questions = [];
    const list = S.questions.slice().reverse();
    app.innerHTML = `<div class="stack">${back("#/aid", "Аптечка")}
      <div class="stack" style="gap:4px"><h1>Вопрос Насте</h1><span class="small">Напиши, что происходит, своими словами. Отвечу лично — текстом или голосовым.</span></div>
      <textarea id="qt" rows="7" placeholder="Что случилось, что чувствуешь, о чем хочется спросить…"></textarea>
      <div class="card" style="flex-direction:row;gap:10px;align-items:flex-start;font-size:13px;color:var(--muted2)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8CC4E8" stroke-width="2" stroke-linecap="round" style="flex-shrink:0;margin-top:2px"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><span>Отвечу в течение 48 часов. Ответ придет сюда, в «Мои вопросы», и бот пришлет уведомление.</span></div>
      <button class="btn" id="send">Отправить</button>
      <div class="card terra" style="gap:4px"><b style="color:var(--terra-l);font-size:14px">Если сейчас опасно</b><span class="small" style="color:#D9B8AA">Ответ придет не сразу. Если есть угроза жизни — звони 112.</span></div>
      ${list.length ? `<h2 style="margin-top:6px">Мои вопросы</h2>` + list.map((q) => `<div class="card" style="gap:6px"><div class="row" style="justify-content:space-between"><span class="small" style="font-weight:700;color:${q.answer ? "var(--sage-l)" : "var(--blue)"}">${q.answer ? "ОТВЕТ ЕСТЬ" : "ЖДЕТ ОТВЕТА"}</span><span class="small">${fmtWhen(q.at).replace(" в ", ", ")}</span></div><div style="font-size:14px">${esc(q.text)}</div>${q.answer ? `<div class="card sage">${esc(q.answer)}</div>` : ""}</div>`).join("") : ""}
    </div>`;
    $("#send").onclick = () => {
      const t = $("#qt").value.trim(); if (!t) { toast("Напиши вопрос"); return; }
      S.questions.push({ text: t, at: now() }); save(); haptic();
      toast("Вопрос сохранен. Отправка Насте заработает с запуском"); Ask();
    };
  }
  function Consult() {
    app.innerHTML = `<div class="stack">${back("#/aid", "Аптечка")}
      <h1>Консультация</h1>
      <div class="row" style="gap:14px"><span class="av big">Н</span><span class="stack" style="gap:2px"><b style="font-size:16px">Настя Черемных</b><span class="small">юнгианский анализ и символдрама</span></span></div>
      <p class="lead">Когда хочется разобрать глубже: повторяющийся сон, образ из погружения, то, что тянется давно. В терапии мы работаем вдвоем.</p>
      <div class="facts"><div><b>60–90 мин</b><span>длительность</span></div><div><b>онлайн</b><span>формат</span></div><div><b>5000 ₽</b><span>стоимость</span></div></div>
      <div class="card" style="gap:6px"><b style="font-size:14px">Важно знать</b><span class="small" style="color:var(--muted2)">Оплата — не позднее чем за 24 часа до встречи. Перенос или отмена — тоже за 24 часа. Если отменяю я — следующая консультация бесплатно.</span></div>
      <button class="btn" id="book">Выбрать время и оплатить ↗</button>
      <p class="small center">откроется страница записи и оплаты</p></div>`;
    $("#book").onclick = () => toast("Ссылку на запись добавим перед запуском");
  }
  function Observer(from) {
    // пришли с экрана возвращения после погружения — туда и назад, и в конце туда же: записать, что пришло
    const pr = from && prac(from);
    app.innerHTML = `<div class="stack">${pr ? back("#/return/" + from, "К погружению") : back("#/aid", "Аптечка")}
      <div class="stack" style="gap:6px"><div class="kicker terra">Сложно вернуться в реальность · 2–3 мин</div><h1>Наблюдатель</h1><p class="lead" style="font-size:14px">Прочитай и сделай — ничего записывать не нужно.</p></div>
      <div class="card terra" style="padding:18px;gap:12px"><div class="small" style="font-size:13px">Бывает, после погружения сложно вернуться в реальность. При панике тоже помогает.</div><ol class="obs"><li><b>Остановись.</b> Открой глаза. Поставь стопы на пол, почувствуй опору.</li><li><b>Дыхание.</b> Два коротких вдоха носом подряд, второй «добирает» воздух. Длинный медленный выдох ртом, будто дуешь на горячий чай. Повтори 3–5 раз.</li><li><b>Стань наблюдателем.</b> Про себя назови, что происходит: «Я замечаю, что сердце бьется быстро». «Я замечаю страх». <i>Не борись с ощущением. Просто смотри на него со стороны.</i></li><li><b>Вернись в комнату.</b> Найди глазами 3 предмета вокруг. Услышь 2 звука. Почувствуй 1 точку тела, которая касается опоры.</li><li><b>Скажи себе:</b> «Это был образ. Сейчас я здесь». <i>Образ не обязательно досматривать. К нему можно вернуться потом или не возвращаться вовсе.</i></li></ol><b style="font-size:15px">Если не отпустило — повтори с шага 2.</b></div>
      ${pr ? `<a class="btn" href="#/after/${from}">Записать, что пришло</a>` : `<a class="btn ghost" href="#/">На главную</a>`}</div>`;
  }


  // ---------- профиль и настройки ----------
  function Me() {
    if (!S.remind) S.remind = { morning: "09:00", evening: "21:30", on: true };
    const R = S.remind, p = S.profile || {};
    app.innerHTML = `<div class="stack">${back("#/notes", "Моя карта")}
      <div class="cap" style="margin-bottom:-6px">Личный кабинет</div>
      <div class="row" style="gap:14px"><span class="av big">${esc((p.name || "?").slice(0, 1).toUpperCase())}</span><span class="stack" style="gap:2px"><h1 style="font-size:24px">${esc(p.name || "Профиль")}</h1><span class="small">вход через Telegram</span></span></div>
      <a class="link-row" href="#/sub"><span class="stack" style="gap:2px"><b>Подписка</b><span class="small" style="font-weight:400">${esc(planLine())}</span></span>${icon.chev}</a>
      <div class="card" style="gap:6px"><b>Вход на сайте</b><span class="small">kartaglubiny.ru → «Войти через Telegram». Подписка общая, записи пока хранятся на каждом устройстве отдельно.</span></div>
      <div class="card" style="gap:12px"><div class="row" style="justify-content:space-between"><b>Напоминания от бота</b><button type="button" class="tgl${R.on ? " on" : ""}" id="ron" role="switch" aria-checked="${R.on}" aria-label="Напоминания"><i></i></button></div>
        <label class="row" style="justify-content:space-between"><span class="small" style="color:var(--muted2)">Утро: сон и символ дня</span><input class="tm" id="rm" inputmode="numeric" maxlength="5" placeholder="09:00" aria-label="Время утреннего напоминания" value="${R.morning}"></label>
        <label class="row" style="justify-content:space-between"><span class="small" style="color:var(--muted2)">Вечер: «Как ты?»</span><input class="tm" id="re" inputmode="numeric" maxlength="5" placeholder="21:30" aria-label="Время вечернего напоминания" value="${R.evening}"></label>
        <span class="small">Не больше двух сообщений в день. Пропуск — это просто пропуск.</span></div>
      <a class="link-row" href="#/ask">Мои вопросы Насте ${icon.chev}</a>
      <a class="link-row" href="#/export">Собрать наблюдения для своего психолога ${icon.chev}</a>
      <a class="link-row" href="#/policy/privacy">Политика конфиденциальности ${icon.chev}</a>
      <div class="demo stack" style="gap:10px">
        <div class="small">Демо-режим: перемотка времени, чтобы проверить таймеры (8 и 48 часов)</div>
        <div class="chips"><button class="chip" data-shift="8">+8 часов</button><button class="chip" data-shift="48">+48 часов</button><button class="chip" data-shift="200">пройти все циклы</button><button class="chip" data-reset="1">Начать заново</button></div>
      </div></div>`;
    const push = () => { clearTimeout(Me.t); Me.t = setTimeout(() => syncAccess(""), 800); }; // время напоминаний — боту
    $("#ron").onclick = () => { R.on = !R.on; save(); push(); Me(); };
    const hhmm = (el, key) => {
      el.oninput = () => { const d = el.value.replace(/\D/g, "").slice(0, 4); el.value = d.length > 2 ? d.slice(0, 2) + ":" + d.slice(2) : d; };
      el.onchange = el.onblur = () => {
        const m = el.value.match(/^(\d{1,2}):?(\d{2})$/);
        if (m && +m[1] < 24 && +m[2] < 60) { const v = String(+m[1]).padStart(2, "0") + ":" + m[2]; if (v !== R[key]) { R[key] = v; save(); push(); } }
        el.value = R[key];
      };
    };
    hhmm($("#rm"), "morning"); hhmm($("#re"), "evening");
    app.querySelectorAll("[data-shift]").forEach((b) => b.onclick = () => {
      const hrs = Number(b.dataset.shift);
      if (hrs === 200) { let t = now() - 400 * H; ALLP.forEach((p) => { if (!p.soon && !counted(p.id)) { S.listens[p.id] = t; t += 50 * H; } }); save(); toast("Все практики отмечены пройденными"); return Me(); }
      S.shift = (S.shift || 0) + hrs * H; save(); toast("Время сдвинуто на +" + hrs + " ч");
    });
    app.querySelector("[data-reset]").onclick = () => { if (confirmReset()) { S = blank(); save(); go("#/"); render(); } };
  }
  // ИИ-проводник (тест): чат с YandexGPT через облачную функцию. Открыт только по ключу предпросмотра и тестировщикам.
  let guideOK = null, guideBusy = false;
  const gApi = (body) => fetch(window.KARTA_API, { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, window.KARTA_HEADERS || {}), body: JSON.stringify(body) })
    .then((r) => r.json().then((j) => ({ ok: r.ok, status: r.status, j })), () => ({ ok: false, status: 0, j: {} }));
  // контекст для Проводника: заметки о погружении и словарь по образам из разговора (только суть символа)
  const GMODE = { dream: "Обсудить сон", dive: "Обсудить погружение", feel: "Разобраться в переживаниях" };
  function guideCtx(G) {
    const out = [];
    if (G.mode) out.push("Режим разговора, выбранный человеком: " + GMODE[G.mode] + ".");
    if (G.dream) out.push("Сон, который человек выбрал для разговора: " + G.dream.slice(0, 900));
    const diveLine = (p) => { const n = S.notes[p.id] || {}; return "Погружение «" + p.title + "»" + ((p.images || []).length ? " (образы практики: " + p.images.join(", ") + ")" : "") + (n.image ? ". Заметка человека: " + n.image : "") + ((n.feelings || []).length ? ". Чувства: " + n.feelings.join(", ") : ""); };
    if (G.dive) { const p = prac(G.dive); if (p) out.push(diveLine(p)); }
    else ALLP.filter((p) => S.notes[p.id] && S.notes[p.id].image).sort((a, b) => (S.notes[b.id].savedAt || 0) - (S.notes[a.id].savedAt || 0)).slice(0, 2).forEach((p) => out.push(diveLine(p)));
    const text = G.msgs.filter((m) => m.r === "u").map((m) => m.t).join(" ").toLowerCase().replace(/ё/g, "е");
    const seen = new Set();
    text.split(/[^а-яa-z-]+/).forEach((w) => { if (w.length < 3 || seen.size >= 5) return; const y = symByTitle(w); if (y && !seen.has(y.id)) { seen.add(y.id); out.push("Словарь: " + y.title + " — " + y.essence); } });
    return out.join("\n").slice(0, 1800);
  }
  const gNew = () => ({ conv: Math.random().toString(36).slice(2, 10) + Date.now().toString(36), msgs: [], entries: null });
  function gText(t) {
    return esc(t).replace(/\[([^\]]{1,40})\]\((#\/[a-z\/]+)\)/g, (m, label, href) => {
      const r = href.split("/")[1], id = href.split("/")[2];
      const ok = r === "catch" || r === "observer" || (r === "prep" && ALLP.some((p) => p.id === id && !p.soon));
      return ok ? `<a href="${href}" style="color:var(--sage);font-weight:600">${label} ›</a>` : `«${label}»`;
    }).replace(/\n/g, "<br>");
  }
  // просьба связать образы: «соедини огонь с башней», «свяжи образ воды и ворона», «соедини с башней» (второй — образ разговора)
  function linkReq(t, G) {
    const m = t.toLowerCase().replace(/ё/g, "е").trim().replace(/\s+в (?:моей )?карте/, "").match(/^(?:пожалуйста,?\s*)?(?:соед[еи]ни|свяжи|связать|соед[еи]нить)(?:те)?,?\s+(?:образ\S*\s+)?(?:(?:«|")?([а-я-]{2,24}(?: [а-я-]{2,24})?)(?:»|")?\s+)?(?:и|с|со)\s+(?:образ\S*\s+)?(?:«|")?([а-я-]{2,24}(?: [а-я-]{2,24})?)(?:»|")?\s*[.!?]*$/);
    if (!m) return null;
    // творительный падеж → начальная форма (грубо): башней → башня, водой → вода, вороном → ворон
    const norm1 = (w) => w.replace(/ью$/, "ь").replace(/ей$/, "я").replace(/ой$/, "а").replace(/(ом|ем)$/, "").replace(/ю$/, "я").replace(/([бвгджзклмнпрстфхцчшщ])у$/, "$1а").trim();
    const known = Object.keys(imgIndex());
    const fix = (w) => { if (!w) return ""; if (known.includes(w)) return w; const k = known.find((x) => x.length > 2 && w.startsWith(x.slice(0, Math.max(3, x.length - 1)))); return k || norm1(w); };
    const b = fix(m[2]), a = m[1] ? fix(m[1]) : G.img || (G.msgs.map((x) => x.t).join(" ").match(/образом «([^»]+)»/) || [])[1] || "";
    return a && b && a !== b ? [a, b] : null;
  }
  // «переименуй башню в маяк», «исправь бвшня на башня»
  function renReq(t) {
    const m = t.toLowerCase().replace(/ё/g, "е").trim().match(/^(?:пожалуйста,?\s*)?(?:переименуй|исправь|замени)\s+(?:образ\s+)?(?:«|")?([а-я-]{2,30})(?:»|")?\s+(?:в|на)\s+(?:«|")?([а-я-]{2,30})(?:»|")?\s*[.!]*$/);
    if (!m) return null; const known = Object.keys(imgIndex()); const a = known.find((x) => x === m[1]) || known.find((x) => m[1].startsWith(x.slice(0, Math.max(3, x.length - 1)))) || m[1];
    return [a, m[2]];
  }
  function Guide() {
    if (!window.KARTA_API || !window.KARTA_HEADERS || !Object.keys(window.KARTA_HEADERS).length) return GuideSoon();
    if (guideOK === false) return GuideSoon();
    if (guideOK === null) {
      app.innerHTML = `<div class="stack"><h1>Проводник</h1><p class="small">Открываю…</p></div>`;
      gApi({ action: "hello" }).then((r) => { guideOK = !!(r.ok && r.j.ok); if (location.hash.startsWith("#/guide")) Guide(); });
      return;
    }
    // пауза больше 3 часов — новый разговор (разбор логов 09.11: разговоры склеивались)
    if (S.guide && S.guide.msgs.length && Date.now() - (S.guide.last || 0) > 3 * 3600e3) S.guide = gNew();
    const G = S.guide || (S.guide = Object.assign(gNew(), S.guideImg ? { img: S.guideImg } : {}));
    if (S.guideImg) { S.guideImg = null; save(); }
    const g = (S.profile && S.profile.gender) || "n";
    setBg("ProvodnikChat-1.jpg", { top: true });
    if (!G.msgs.length && !G.mode && G.dive) return guideStart(G, "dive");
    if (!G.msgs.length && !G.mode && !G.img && !S.guideDraft) return guidePick(G);
    const bubbles = G.msgs.map((m, i) => m.r === "u" ? `<div class="b me">${esc(m.t)}</div>` :
      `<span class="cap gcap">ИИ-проводник</span><div class="b">${gText(m.t)}</div>${m.local ? "" : m.mark ? `<span class="small" style="font-size:11px;margin:-4px 0 0 6px">${m.mark.ok ? "отмечено: хорошо" : "отмечено: не так"}</span>` : `<span class="gmk" style="display:flex;gap:14px;margin:-2px 0 0 6px;font-size:12px"><a href="#" data-ok="${i}" style="color:var(--muted)">хорошо</a><a href="#" data-no="${i}" style="color:var(--muted)">не так</a></span>`}`).join("");
    const ent = G.entries;
    app.innerHTML = `<div class="stack">
      <div class="toppad" style="height:calc(min(100vw,520px) * .64)"></div><div class="scr-h"><div class="cap">Капитанская рубка</div><h1>Проводник</h1><p class="g-sub">Разговор сохраняется в Моей карте</p>
      ${G.mode ? `<button type="button" class="gmode" id="gchg">${GMODE[G.mode]}${G.msgs.length > 1 ? "" : " · сменить"}</button>` : ""}
      <p class="small" style="font-size:12px">Тестовый режим. Если сейчас опасно — звони 112.</p></div>
      <div class="chat" id="gch">${bubbles}${guideBusy ? `<div class="b typing" aria-label="Проводник пишет"><i></i><i></i><i></i></div>` : ""}</div>
      ${ent ? `<div class="card" style="gap:10px"><b>Записи из разговора</b>${G.keys && G.keys.length ? `<span class="small">В «Мою карту» добавлены образы: ${G.keys.map((k) => `<a href="${imgHref(k)}" style="color:var(--blue)">${esc(k)}</a>`).join(", ")}</span>` : ""}${ent.length ? ent.map((e, i) => `<label class="row" style="gap:10px;align-items:flex-start"><input type="checkbox" data-e="${i}" checked style="margin-top:3px"><span style="font-size:14px;line-height:1.45"><span class="small" style="font-size:11px;letter-spacing:.06em">${esc(e.type.toUpperCase())}</span><br>${esc(e.text)}</span></label>`).join("") + `<button class="btn" id="gsave">Сохранить в «Моя карта»</button>` : `<span class="small">Записывать нечего.</span>`}<button class="btn ghost" id="gnew2">Новый разговор</button></div>` : `
      <div class="gdock"><textarea id="gin" class="inp" rows="2" maxlength="1500" placeholder="Напиши, что сейчас важно…" style="flex:1;resize:none;border-radius:24px"${guideBusy ? " disabled" : ""}>${esc(S.guideDraft || "")}</textarea><button class="sendb" id="gsend"${guideBusy ? " disabled" : ""} aria-label="Отправить"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0F1E33" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></div>
      ${G.msgs.length ? `<div class="row" style="gap:16px;justify-content:center"><a href="#" id="gend" class="small" style="color:var(--blue)">Закончить и сохранить</a><a href="#" id="gnew" class="small">Новый разговор</a></div>` : ""}`}</div>`;
    const ch = $("#gch"); if (ch && ch.lastElementChild && G.msgs.length > 1) requestAnimationFrame(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const fresh = () => { S.guide = gNew(); save(); Guide(); };
    const send = () => {
      const inp = $("#gin"), t = inp ? inp.value.trim() : "";
      if (!t || guideBusy) return;
      // «соедини огонь с башней» — линия между образами в «Моей карте»
      const rn = renReq(t);
      if (rn && rn[0] !== rn[1]) { renameImg(rn[0], rn[1]); toast("В «Моей карте»: " + rn[0] + " → " + rn[1]); }
      const lk = rn ? null : linkReq(t, G);
      if (lk) { S.links = S.links || []; if (!S.links.some((l) => (l.a === lk[0] && l.b === lk[1]) || (l.a === lk[1] && l.b === lk[0]))) S.links.push({ a: lk[0], b: lk[1], at: now() }); toast("В «Моей карте»: " + lk[0] + " — " + lk[1]); }
      G.msgs.push({ r: "u", t }); G.last = Date.now(); guideBusy = true; S.guideDraft = ""; save(); Guide();
      gApi({ action: "say", conv: G.conv, text: t, gender: g, mode: G.mode || "", open: G.open || "", ctx: guideCtx(G) }).then((r) => {
        guideBusy = false;
        if (r.ok && r.j.text) G.msgs.push({ r: "a", t: r.j.text, i: r.j.i });
        else { G.msgs.pop(); toast(r.status === 429 ? "Разговор получился длинным — начни новый" : "Проводник не ответил. Попробуй еще раз"); setTimeout(() => { const x = $("#gin"); if (x) x.value = t; }, 0); }
        save(); if (location.hash.startsWith("#/guide")) Guide();
      });
    };
    if ($("#gsend")) { $("#gsend").onclick = send; $("#gin").onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }; }
    if ($("#gchg")) $("#gchg").onclick = () => { if (G.msgs.length > 1) return; S.guide = gNew(); save(); Guide(); };
    if ($("#gnew")) $("#gnew").onclick = (e) => { e.preventDefault(); fresh(); };
    if ($("#gnew2")) $("#gnew2").onclick = fresh;
    if ($("#gend")) $("#gend").onclick = (e) => {
      e.preventDefault(); if (guideBusy) return; guideBusy = true; Guide();
      gApi({ action: "finish", conv: G.conv }).then((r) => { guideBusy = false; G.entries = r.ok ? r.j.entries || [] : [];
        const keys = [...new Set(G.entries.flatMap((e) => e.keys || []).map((k) => String(k).toLowerCase().replace(/ё/g, "е").trim()).filter((k) => k.length > 1 && k.length < 30))];
        if (G.img && !keys.includes(G.img)) keys.unshift(G.img);
        if (keys.length) { S.gimg = (S.gimg || []).concat([{ w: keys, at: now(), conv: G.conv }]); G.keys = keys; } if (!r.ok) toast("Не получилось собрать записи"); save(); Guide(); });
    };
    if ($("#gsave")) $("#gsave").onclick = () => {
      S.free = S.free || [];
      const parts = []; app.querySelectorAll("[data-e]").forEach((c) => { if (c.checked) { const e = ent[+c.dataset.e]; parts.push({ type: String(e.type).toLowerCase(), text: e.text }); } });
      if (parts.length) S.free.push({ src: "guide", at: now(), parts, text: parts.map((p) => p.type[0].toUpperCase() + p.type.slice(1) + ": " + p.text).join("\n") });
      toast("Сохранено в «Моя карта»"); fresh();
    };
    const mark = (i, ok, note) => { const m = G.msgs[i]; gApi({ action: "mark", conv: G.conv, i: m.i, ok, note }).then((r) => { if (r.ok) { m.mark = { ok }; save(); toast("Спасибо, отмечено"); if (location.hash.startsWith("#/guide")) Guide(); } else toast("Не получилось отметить"); }); };
    app.querySelectorAll("[data-ok]").forEach((a) => a.onclick = (e) => { e.preventDefault(); mark(+a.dataset.ok, true, ""); });
    app.querySelectorAll("[data-no]").forEach((a) => a.onclick = (e) => {
      e.preventDefault(); const i = +a.dataset.no, box = a.parentElement;
      box.outerHTML = `<div class="stack" style="gap:6px;margin-left:6px" id="gm"><textarea class="inp" rows="2" placeholder="Как ответить лучше?" id="gmt"></textarea><button class="btn ghost" id="gms" style="padding:10px">Отправить</button></div>`;
      $("#gmt").focus(); $("#gms").onclick = () => mark(i, false, $("#gmt").value.trim());
    });
  }
  // три режима разговора: сон, погружение, переживания
  const GOPEN = {
    dream: (d) => d ? "Давай побудем с этим сном. Что в нем сейчас ярче всего: какой-то образ, место или чувство?" : "Расскажи сон так, как он запомнился, можно обрывками. Что в нем было ярче всего?",
    dive: (p) => p ? "Вернемся в погружение «" + p.title + "». Какой образ из него помнится сейчас ярче всего?" : "Какое погружение хочется обсудить? Расскажи, что в нем было: образ, место, чувство.",
    feel: () => "Что сейчас происходит внутри? Можно одним словом или так, как получается.",
  };
  function guideStart(G, mode, extra) {
    G.mode = mode; Object.assign(G, extra || {});
    const p = G.dive ? prac(G.dive) : null;
    G.open = GOPEN[mode](mode === "dive" ? p : G.dream);
    G.msgs.push({ r: "a", t: G.open, local: true }); G.last = Date.now(); save(); Guide();
  }
  function guidePick(G) {
    const ic = (d) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F5E8D9" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
    app.innerHTML = `<div class="stack">
      <div class="toppad" style="height:calc(min(100vw,520px) * .64)"></div>
      <div class="scr-h"><div class="cap">Капитанская рубка</div><h1>Проводник</h1><p class="g-sub">О чем поговорим?</p></div>
      <button type="button" class="opt gm" data-m="dream"><span class="oi">${ic('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>')}</span><span class="t"><b>Сон</b><span>Разобрать сон: образы, чувства, на что похоже в жизни</span></span>${icon.chev}</button>
      <button type="button" class="opt gm" data-m="dive"><span class="oi">${ic('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>')}</span><span class="t"><b>Погружение</b><span>Вернуться к образу из пройденной практики</span></span>${icon.chev}</button>
      <button type="button" class="opt gm" data-m="feel"><span class="oi">${ic('<path d="M3 12h4l2-5 4 10 2-5h6"/>')}</span><span class="t"><b>Переживания</b><span>Разобраться, что сейчас происходит внутри</span></span>${icon.chev}</button>
      <p class="small center" style="font-size:12px">Разговор сохраняется в Моей карте. Если сейчас опасно — звони 112.</p></div>`;
    const sheet = (title, list, onPick, emptyT, newT) => {
      const bg = document.createElement("div"); bg.className = "sheet-bg";
      bg.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="grip"></div><span class="cap">${title}</span>
        <button type="button" class="pk" data-j="-1"><b style="font-weight:500">${newT}</b></button>
        ${list.length ? list.slice(0, 15).map((x, j) => `<button type="button" class="pk" data-j="${j}"><span class="cap" style="font-size:10px">${esc(x.lbl)}</span><span>${esc(x.t.length > 110 ? x.t.slice(0, 110) + "…" : x.t)}</span></button>`).join("") : `<p class="small">${emptyT}</p>`}</div>`;
      bg.onclick = (ev) => { if (ev.target === bg) { bg.remove(); return; } const b = ev.target.closest("[data-j]"); if (b) { bg.remove(); onPick(+b.dataset.j < 0 ? null : list[+b.dataset.j]); } };
      document.body.appendChild(bg);
    };
    app.querySelectorAll("[data-m]").forEach((b) => b.onclick = () => {
      const m = b.dataset.m;
      if (m === "feel") return guideStart(G, "feel");
      if (m === "dream") {
        const L = Object.keys(S.dreams || {}).filter((k) => S.dreams[k] && S.dreams[k].text).sort().reverse().map((k) => { const d = new Date(dayTs(k)); return { lbl: d.getDate() + " " + MONS[d.getMonth()], t: S.dreams[k].text }; });
        return sheet("Какой сон обсудим?", L, (x) => guideStart(G, "dream", x ? { dream: x.t } : {}), "Записанных снов пока нет.", "Новый сон: расскажу сейчас");
      }
      const L = ALLP.filter((p) => counted(p.id) || S.notes[p.id]).sort((a, b) => (counted(b.id) || 0) - (counted(a.id) || 0)).map((p) => ({ id: p.id, lbl: p._free ? "вне циклов" : p._cy.title, t: p.title + (S.notes[p.id] && S.notes[p.id].image ? ": " + S.notes[p.id].image : "") }));
      sheet("Какое погружение обсудим?", L, (x) => guideStart(G, "dive", x ? { dive: x.id } : {}), "Пройденных погружений пока нет.", "Другое: расскажу сам" + (S.profile && S.profile.gender === "f" ? "а" : ""));
    });
  }
  // заглушка проводника для всех, кроме тестировщиков
  function GuideSoon() {
    setBg("ProvodnikChat-1.jpg", { top: true });
    app.innerHTML = `<div class="stack">
      <div class="toppad" style="height:calc(min(100vw,520px) * .64)"></div>
      <div class="scr-h"><span class="soon-p">Скоро</span><h1>Проводник</h1><p class="g-sub">Задает вопросы к твоим снам, образам и чувствам, а не выдает толкования.</p></div>
      <div class="card" style="gap:10px"><b style="font-weight:500">Как он работает</b><ul class="g-how"><li>видит твои записи и замечает повторяющиеся образы</li><li>не толкует за тебя: спрашивает и помогает услышать свое</li><li>не заменяет психолога и возвращает к живому контакту</li><li>при остром состоянии сразу ведет в Аптечку и к живой помощи</li></ul></div>
      <p class="center g-soon">Откроется скоро</p>
      <a class="link-row" href="#/export">А пока: собрать наблюдения для своего психолога ${icon.chev}</a></div>`;
  }
  // выгрузка наблюдений: текстом, чтобы отправить своему психологу
  function exportText(days) {
    const from = days ? now() - days * 86400000 : 0, L = [];
    L.push("Карта Глубины — мои наблюдения" + (days ? " за " + days + " дней" : "")); L.push("");
    const inR = (ts) => ts && ts >= from;
    Object.keys(S.days || {}).sort().forEach((k) => { const d = S.days[k]; if (d && d.done && inR(dayTs(k))) L.push(k + " · Как ты: " + daySummary(k) + (d.want && d.want.length ? " · хочется: " + d.want.join(", ") : "") + (d.link ? " · связь дня: " + d.link : "")); });
    Object.keys(S.dreams || {}).sort().forEach((k) => { const d = S.dreams[k]; if (d && d.text && inR(dayTs(k))) L.push(k + " · Сон: " + d.text + (d.images && d.images.length ? " · образы: " + d.images.join(", ") : "") + (d.feel && d.feel.length ? " · при пробуждении: " + d.feel.join(", ") : "")); });
    Object.keys(S.sym || {}).sort().forEach((k) => { const y = S.sym[k], c = cardById(y.id); if (c && inR(dayTs(k))) L.push(k + " · Символ дня: " + c.title + (y.note ? " · откликается: " + y.note : "")); });
    (S.catches || []).forEach((c) => { if (inR(c.at)) L.push(dkey(c.at) + " · Названное чувство: " + c.word); });
    ALLP.forEach((p) => { const n = S.notes[p.id]; if (n && inR(n.savedAt || counted(p.id))) L.push(dkey(n.savedAt || counted(p.id)) + " · Погружение «" + p.title + "»: " + (n.image || "") + (n.feelings && n.feelings.length ? " · чувства: " + n.feelings.join(", ") : "")); });
    const rec = recurring(); if (rec.length) { L.push(""); L.push("Повторяющиеся образы: " + rec.map((r) => r[0] + " ×" + r[1]).join(", ")); }
    return L.join("\n");
  }
  function Export(days) {
    const d = Number(days) || 30, txt = exportText(d === 999 ? 0 : d);
    app.innerHTML = `<div class="stack">${back("#/me", "Личный кабинет")}
      <div class="stack" style="gap:4px"><h1>Для моего психолога</h1><span class="small">Записи собираются в один текст. Кому и когда его отправить — решать тебе.</span></div>
      <div class="seg3">${[[7, "7 дней"], [30, "30 дней"], [999, "все"]].map(([v, l]) => `<button type="button" class="${d === v ? "on" : ""}" data-d="${v}">${l}</button>`).join("")}</div>
      <textarea id="ex" rows="14" readonly>${esc(txt)}</textarea>
      <button class="btn" id="cp">Скопировать</button>
      <button class="btn ghost" id="dl">Сохранить файлом</button></div>`;
    app.querySelectorAll("[data-d]").forEach((b) => b.onclick = () => Export(b.dataset.d));
    $("#cp").onclick = () => { const t = $("#ex"); t.select(); try { navigator.clipboard.writeText(t.value).then(() => toast("Скопировано"), () => { document.execCommand("copy"); toast("Скопировано"); }); } catch (e) { document.execCommand("copy"); toast("Скопировано"); } };
    $("#dl").onclick = async () => {
      try { const f = new File([txt], "karta-glubiny.txt", { type: "text/plain" }); if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: "Карта Глубины" }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], { type: "text/plain;charset=utf-8" })); a.download = "karta-glubiny.txt"; document.body.appendChild(a); a.click(); a.remove(); };
  }
  // повторяющиеся образы: сны, символ дня, образы погружений (чувства считаются отдельно)
  function recurring() {
    const m = {};
    const add = (w) => { w = String(w || "").trim().toLowerCase(); if (w) m[w] = (m[w] || 0) + 1; };
    Object.values(S.dreams || {}).forEach((d) => (d.images || []).forEach(add));
    Object.values(S.sym || {}).forEach((y) => { const c = cardById(y.id); if (c) add(c.title); });
    ALLP.forEach((p) => { if (S.notes[p.id]) (p.images || []).forEach(add); });
    return Object.keys(m).map((k) => [k, m[k]]).filter((x) => x[1] > 1).sort((a, b) => b[1] - a[1]).slice(0, 12);
  }
  // «Как ты?» за 20 секунд: одно чувство и его оттенок
  function QuickVoice() {
    app.innerHTML = `<div class="stack" style="gap:16px">${back("#/", "Сегодня")}<div class="toppad"></div>
      <div class="scr-h"><div class="cap">На бегу</div><h1>Пара слов — и дальше</h1><p>Наговори или напиши, разберемся потом.</p></div>
      <div class="qv"><button type="button" class="qv-mic" id="qmic" aria-label="Наговорить">${MIC_I.replace('width="18" height="18"', 'width="34" height="34"')}</button><span class="small" id="qlbl">Нажми, чтобы наговорить</span></div>
      <div class="row" style="gap:10px"><input class="inp" id="qline" maxlength="200" placeholder="или одной строкой…" style="border-radius:999px"><button type="button" class="qv-ok" id="qok" aria-label="Сохранить">${ICN_CHECK}</button></div>
      <a class="center small" href="#/quick/feel" style="padding:8px 0;text-decoration:underline;text-underline-offset:4px">Отметить чувства одним касанием</a></div>`;
    const inp = $("#qline"), lbl = $("#qlbl");
    $("#qmic").onclick = () => voice($("#qmic"), { set textContent(v) { lbl.textContent = v === "Рассказать голосом" ? "Нажми, чтобы наговорить" : v; } }, (t) => { inp.value = (inp.value ? inp.value + " " : "") + t; });
    const ok = () => { const t = inp.value.trim(); if (!t) return; S.free = S.free || []; S.free.push({ text: t, at: now(), quick: true }); save(); haptic(); toast("Сохранено в Мою карту"); go("#/"); };
    $("#qok").onclick = ok; inp.onkeydown = (e) => { if (e.key === "Enter") ok(); };
  }
  function Quick() {
    const D = today();
    const F = D.feel && D.feel.list ? D.feel : { list: D.feel ? [D.feel.shade || D.feel.base].filter(Boolean) : [], bases: D.feel && D.feel.base ? [D.feel.base] : [], word: "" };
    const sync = () => {
      const all = F.list.concat(F.word ? [F.word] : []);
      D.feel = { list: F.list, bases: F.bases, word: F.word, base: F.bases[0] || "", shade: F.list[0] || "", own: all.join(", ") };
      if (!all.length && !F.bases.length) D.feel = null;
      save();
    };
    const draw = () => {
      const any = F.list.length || F.bases.length || F.word;
      app.innerHTML = `<div class="stack">${back("#/", "Сегодня")}
        <div class="scr-h"><h1>Чувства сейчас</h1><p>Можно выбрать несколько. Не нужно думать долго.</p></div>
        <div class="chips">${Object.keys(FEEL_BASE).map((f) => `<button type="button" class="chip${F.bases.includes(f) ? " on" : ""}" data-b="${f}" aria-pressed="${F.bases.includes(f)}">${f}</button>`).join("")}</div>
        ${F.bases.map((b) => `<div class="stack" style="gap:8px"><b>${esc(b)} — а точнее?</b><div class="chips">${FEEL_BASE[b].map((f) => `<button type="button" class="chip${F.list.includes(f) ? " terraon" : ""}" data-s="${f}" aria-pressed="${F.list.includes(f)}">${f}</button>`).join("")}</div></div>`).join("")}
        <label class="q"><b>Свое слово</b><input class="inp" id="qw" type="text" maxlength="40" placeholder="Если нужного слова нет" value="${esc(F.word || "")}"></label>
        <button class="btn" id="qs"${any ? "" : " disabled"}>Готово</button>
        <a class="link-row" href="#/today" style="justify-content:center;border:none;color:var(--blue)">Подробнее — с телом и потребностью</a></div>`;
      app.querySelectorAll("[data-b]").forEach((b) => b.onclick = () => { const f = b.dataset.b, i = F.bases.indexOf(f); if (i >= 0) { F.bases.splice(i, 1); F.list = F.list.filter((x) => !FEEL_BASE[f].includes(x)); } else F.bases.push(f); sync(); draw(); });
      app.querySelectorAll("[data-s]").forEach((b) => b.onclick = () => { const f = b.dataset.s, i = F.list.indexOf(f); i >= 0 ? F.list.splice(i, 1) : F.list.push(f); sync(); draw(); });
      const qw = $("#qw");
      qw.oninput = () => { F.word = qw.value.trim().toLowerCase().replace(/ё/g, "е"); sync(); $("#qs").disabled = !(F.list.length || F.bases.length || F.word); };
      $("#qs").onclick = () => { if (!F.list.length && F.bases.length) F.list = F.bases.slice(); sync(); D.done = true; D.quick = true; save(); haptic(); go("#/"); };
    };
    draw();
  }

  // ---------- первый вход: знакомство ----------
  function ageOf(dob) {
    const d = new Date(dob); if (isNaN(d)) return null;
    const t = new Date(); let a = t.getFullYear() - d.getFullYear();
    if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) a--;
    return a;
  }
  const LOCK_I = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" style="vertical-align:-2px;margin-right:6px"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  function Welcome() {
    app.innerHTML = `<div class="v-wel"><div class="v-wel-t"><h1>Добро пожаловать<br>на Глубину</h1><p>Место, где можно встретиться с собой.</p><a class="btn" href="#/hello/2">Нырнуть</a></div></div>`;
  }
  const WHY = ["Понять себя", "Повторяется сценарий", "Тесно в прежней жизни", "Сны", "Тревога", "Просто смотрю"];
  function promoFromLink() {
    const sp = (tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) || new URLSearchParams(location.search).get("promo") || "";
    const m = /^(?:promo_)?([A-Za-z0-9]{4,16})$/.exec(sp); return m ? m[1].toUpperCase() : "";
  }
  const PROMO_UNTIL = "2026-12-30";
  function syncAccess(code) {
    const local = () => { if (!S.access) S.access = code ? { plan: "promo", code, until: PROMO_UNTIL } : { plan: "trial", since: now(), until: now() + 3 * 86400000 }; return null; };
    if (!window.KARTA_BOT || !window.KARTA_HEADERS || !(window.KARTA_HEADERS["X-Telegram-Init-Data"] || window.KARTA_HEADERS["X-Session"])) return Promise.resolve(local());
    return fetch(window.KARTA_BOT, { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, window.KARTA_HEADERS), body: JSON.stringify({ action: "access", code: code || "", tz: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { return ""; } })(), remind: S.remind || { on: true, morning: "09:00", evening: "21:30" } }) })
      .then((r) => r.ok ? r.json() : null).then((j) => {
        if (!j || !j.plan) return local();
        S.access = { plan: j.plan, until: j.until ? new Date(j.until + 3 * 3600000).toISOString().slice(0, 10) : null, untilTs: j.until, code: j.code || "", sub: j.sub || null }; save(); return j;
      }).catch(local);
  }
  // «glubina 12» и «ГЛУБИНА12» — одно и то же; есть ли такой код и не использован ли он — решает сервер (список кодов в открытом коде не хранится)
  const normCode = (v) => { const t = String(v || "").toUpperCase().replace(/\s+/g, "").replace(/^ГЛУБИНА/, "GLUBINA"); if (!t) return ""; return /^[A-Z0-9]{4,16}$/.test(t) ? t : null; };
  function Know() {
    const u = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) || window.KARTA_WEB_USER || {};
    const linkCode = promoFromLink();
    const st = { gender: "", why: [] };
    app.innerHTML = `<div class="stack v-pad" style="gap:22px">
      <div class="scr-h"><div class="cap">Знакомство</div><h1>Давай познакомимся</h1><p>Так Проводник и приложение будут обращаться к тебе</p></div>
      ${linkCode ? `<div class="pr-ok"><span class="pr-ok-i">✓</span><span><b>Промокод принят</b><span>Полный доступ до 30 декабря</span></span></div>` : ""}
      <div class="v-panel stack" style="gap:16px">
        <label class="q"><b>Как тебя зовут?</b><input class="inp" id="nm" type="text" maxlength="40" autocomplete="given-name" value="${esc(u.first_name || "")}" placeholder="Имя"></label>
        <div class="stack" style="gap:8px"><b class="qb">Как к тебе обращаться?</b><div class="seg2b" id="gd"><button type="button" data-g="f">Ты пришла</button><button type="button" data-g="m">Ты пришел</button></div></div>
        <div class="stack" style="gap:8px"><div class="stack" style="gap:2px"><b class="qb">Что привело тебя на Глубину?</b><span class="small" style="font-size:12px">можно выбрать несколько</span></div><div class="chips why">${WHY.map((w) => `<button type="button" class="chip" data-w="${esc(w)}">${esc(w)}</button>`).join("")}</div></div>
        <label class="q"><b>Дата рождения</b><input class="inp" id="dob" type="text" inputmode="numeric" autocomplete="bday" placeholder="дд.мм.гггг" maxlength="10" style="letter-spacing:.06em;font-variant-numeric:tabular-nums"><span class="small">Чтобы убедиться, что тебе есть 18.</span></label>
        <label class="consent"><input type="checkbox" id="ok"><span>Принимаю <a href="#/policy/privacy" style="text-decoration:underline">политику конфиденциальности</a> и даю <a href="#/policy/consent" style="text-decoration:underline">согласие на обработку персональных данных</a></span></label>
      </div>
      ${linkCode ? "" : `<div class="pr-box" id="prb"><button type="button" class="pr-link" id="prl">Есть промокод?</button></div>`}
      <button class="btn" id="go" disabled>Дальше</button>
      <p class="small center v-lock">${LOCK_I}Видишь только ты</p>
    </div>`;
    const nm = $("#nm"), dob = $("#dob"), ok = $("#ok"), btn = $("#go");
    const parseDob = (v) => { const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(v); if (!m) return null; const d = +m[1], mo = +m[2], y = +m[3]; const dt = new Date(y, mo - 1, d); return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d ? `${m[3]}-${m[2]}-${m[1]}` : null; };
    dob.addEventListener("input", () => {
      const dgt = dob.value.replace(/\D/g, "").slice(0, 8);
      dob.value = dgt.length > 4 ? `${dgt.slice(0, 2)}.${dgt.slice(2, 4)}.${dgt.slice(4)}` : dgt.length > 2 ? `${dgt.slice(0, 2)}.${dgt.slice(2)}` : dgt;
    });
    const check = () => { btn.disabled = !(nm.value.trim() && parseDob(dob.value) && ok.checked && st.gender); };
    app.querySelectorAll("[data-g]").forEach((b) => b.onclick = () => { st.gender = b.dataset.g; app.querySelectorAll("[data-g]").forEach((x) => x.classList.toggle("on", x === b)); check(); });
    app.querySelectorAll("[data-w]").forEach((b) => b.onclick = () => { const w = b.dataset.w; st.why = st.why.includes(w) ? st.why.filter((x) => x !== w) : st.why.concat([w]); b.classList.toggle("on", st.why.includes(w)); });
    [nm, dob, ok].forEach((e) => { e.oninput = check; e.onchange = check; });
    if ($("#prl")) $("#prl").onclick = () => { $("#prb").innerHTML = `<label class="q" style="width:100%"><b>Промокод</b><input class="inp" id="prc" maxlength="16" autocapitalize="characters" placeholder="Код из сообщения" style="letter-spacing:.08em;text-transform:uppercase"></label><span class="small" style="font-size:12px">Проверим после «Дальше»</span>`; $("#prc").focus(); };
    btn.onclick = () => {
      const iso = parseDob(dob.value); const a = iso ? ageOf(iso) : null;
      if (a === null || a < 0 || a > 110) { toast("Проверь дату рождения"); return; }
      if (a < 18) { S.profile = { minor: true, at: now() }; save(); return go("#/adult"); }
      S.profile = { name: nm.value.trim(), gender: st.gender, why: st.why, dob: iso, consent: new Date().toISOString(), at: now() };
      // доступ: пока решается в приложении (для показа); в рабочей версии срок выдает сервер по Telegram ID
      const code = normCode(linkCode || ($("#prc") ? $("#prc").value : ""));
      if (code === null) { toast("Такого промокода нет. Проверь или оставь поле пустым"); return; }
      btn.disabled = true;
      syncAccess(code).then((r) => {
        if (r && r.promo === "used") toast("Этот промокод уже использован. Открыт пробный период");
        else if (r && r.promo === "unknown") toast("Такого промокода нет. Открыт пробный период");
        else if (r && r.promo === "expired") toast("Срок промокода закончился");
        save(); haptic(); go("#/access");
      });
    };
  }
  // экран доступа после анкеты: пробный период или промокод

  // ---------- подписка: оформление на сайте (Продамус), в Telegram — только статус и отмена ----------
  const inTG = () => !!(tg && tg.initData);
  const MON = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  const dmy = (ts) => { const d = new Date(ts); return d.getDate() + " " + MON[d.getMonth()]; };
  const TAR = { basic: { t: "Подписка", p: 2990, f: ["Все погружения и подкасты", "Словарь символов и Таро", "Проводник без ограничений"] }, full: { t: "Подписка с ответами Насти", p: 4990, f: ["Все, что в подписке", "4 ответа Насти в месяц на твои вопросы"] } };
  function planLine() {
    const A = S.access || {}, s = A.sub, u = A.untilTs;
    if (A.plan === "basic" || A.plan === "full" || A.plan === "paid") return (TAR[A.plan] ? TAR[A.plan].t : "Подписка") + (s && s.active && s.next ? " · продлится " + dmy(s.next) : u ? " · до " + dmy(u - 86400000) : "");
    if (A.plan === "promo") return "Промокод · полный доступ до 30 декабря";
    if (A.plan === "trial") return "Пробный период" + (u ? " · до " + dmy(u) : "");
    if (A.plan === "expired") return "Доступ закончился · открыта «Моя карта»";
    return "Пробный период";
  }
  function Sub(ok) {
    const A = S.access || {}, s = A.sub, paid = A.plan === "basic" || A.plan === "full" || A.plan === "paid";
    const st = { tariff: A.plan === "full" ? "full" : "basic", agree: false, sure: false };
    const draw = () => {
      app.innerHTML = `<div class="stack v-pad" style="gap:18px">${back("#/me", "Личный кабинет")}
        <div class="scr-h"><div class="cap">Подписка</div><h1>${paid ? esc(TAR[A.plan] ? TAR[A.plan].t : "Подписка") : "Полный доступ к Глубине"}</h1><p>${esc(planLine())}</p></div>
        ${ok ? `<div class="pr-ok"><span class="pr-ok-i">✓</span><span><b>Оплата прошла</b><span id="okst">Обновляю доступ…</span></span></div>` : ""}
        ${s && s.fail ? `<div class="card small">Последнее списание не прошло. Проверь карту в письме Продамуса или оформи подписку заново.</div>` : ""}
        ${inTG() ? `<div class="card stack" style="gap:8px"><b>Оформить подписку</b><span class="small">Оформить и поменять подписку можно на сайте kartaglubiny.ru — вход через Telegram, подписка общая для сайта и Telegram.</span><button type="button" class="pill" id="cpy" style="align-self:flex-start">Скопировать адрес сайта</button></div>`
          : (paid && s && s.active ? "" : `<div class="stack" style="gap:10px">${Object.entries(TAR).map(([k, x]) => `<button type="button" class="card tar${st.tariff === k ? " on" : ""}" data-tar="${k}" style="text-align:left;gap:6px"><div class="row" style="justify-content:space-between"><b>${x.t}</b><b style="white-space:nowrap">${x.p.toLocaleString("ru-RU")} ₽<span class="small" style="font-weight:400"> / мес</span></b></div><span class="small">${x.f.join(" · ")}</span></button>`).join("")}</div>
            <label class="consent"><input type="checkbox" id="agr"${st.agree ? " checked" : ""}><span>Соглашаюсь на ежемесячное автоматическое списание ${TAR[st.tariff].p.toLocaleString("ru-RU")} ₽${window.KARTA_OFFER ? ` и с <a href="${esc(window.KARTA_OFFER)}" target="_blank" style="text-decoration:underline">условиями оферты</a>` : ""}. Отменить продление можно здесь в любой момент, за 3 дня до списания придет напоминание.</span></label>
            <button class="btn" id="pay"${st.agree ? "" : " disabled"}>Перейти к оплате</button>`)}
        ${s && s.active ? `<button type="button" class="pr-link" id="stop" style="align-self:center">${st.sure ? "Точно отменить? Доступ сохранится до " + esc(A.untilTs ? dmy(A.untilTs - 86400000) : "конца оплаченного месяца") : "Отменить продление"}</button>` : ""}
      </div>`;
      app.querySelectorAll("[data-tar]").forEach((b) => b.onclick = () => { st.tariff = b.dataset.tar; draw(); });
      const agr = $("#agr"); if (agr) agr.onchange = () => { st.agree = agr.checked; $("#pay").disabled = !st.agree; };
      const pay = $("#pay"); if (pay) pay.onclick = () => {
        if (!st.agree) return; pay.disabled = true; pay.textContent = "Открываю оплату…";
        botCall({ action: "pay_link", tariff: st.tariff }).then((j) => { if (j && j.url) location.href = j.url; else { toast(j && j.error === "not_ready" ? "Оплата скоро подключится" : "Не получилось открыть оплату"); pay.disabled = false; pay.textContent = "Перейти к оплате"; } });
      };
      const cpy = $("#cpy"); if (cpy) cpy.onclick = () => { try { navigator.clipboard.writeText("https://kartaglubiny.ru"); toast("Адрес скопирован"); } catch (e) { toast("kartaglubiny.ru"); } };
      const stop = $("#stop"); if (stop) stop.onclick = () => {
        if (!st.sure) { st.sure = true; draw(); return; }
        stop.disabled = true; botCall({ action: "cancel_sub" }).then((j) => { if (j && j.plan) { S.access.sub = j.sub; save(); toast("Продление отменено"); Sub(); } else toast("Не получилось отменить. Настя уже знает и отключит вручную"); });
      };
    };
    draw();
    if (ok) { let n = 0; const poll = () => syncAccess("").then(() => { const p = S.access && S.access.plan; if (p === "basic" || p === "full") { const e = $("#okst"); if (e) e.textContent = "Доступ открыт: " + planLine(); } else if (++n < 20) setTimeout(poll, 3000); }); poll(); }
  }
  function botCall(body) {
    if (!window.KARTA_BOT || !window.KARTA_HEADERS) return Promise.resolve(null);
    return fetch(window.KARTA_BOT, { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, window.KARTA_HEADERS), body: JSON.stringify(body) }).then((r) => r.json()).catch(() => null);
  }
  function Access() {
    const A = S.access || { plan: "trial" }, promo = A.plan === "promo";
    const ic = (d) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F5E8D9" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
    const I = { dive: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>', pod: '<path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z"/><path d="M19 11a7 7 0 0 1-14 0M12 18v3"/>', guide: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>', music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>', book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/>', map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14"/>', msg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>', aid: '<path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z"/>' };
    const row = (i, t, s2) => `<li><span class="ac-i">${ic(I[i])}</span><span><b>${t}</b>${s2 ? `<span>${s2}</span>` : ""}</span></li>`;
    const list = promo
      ? [row("dive", "Все погружения", "циклы и практики вне циклов"), row("pod", "Все подкасты"), row("guide", "Проводник без ограничений"), row("msg", "Вопросы Насте", "4 ответа в месяц"), row("map", "Музыка, словарь, дневник и Моя карта")]
      : [row("dive", "Первое погружение", "«Точка обзора» и одно вне циклов"), row("pod", "3 выпуска подкаста", "«5 этапов на пути к себе»"), row("guide", "Проводник", "5 ответов"), row("music", "Музыка и словарь символов"), row("map", "Дневник и Моя карта"), row("aid", "Аптечка", "«Плохо, а что — не понять»")];
    app.innerHTML = `<div class="stack v-pad" style="gap:20px">
      <div class="scr-h"><div class="cap">${promo ? "Промокод · " + esc(A.code) : "Пробный период"}</div><h1>${promo ? "Полный доступ до 30 декабря" : "3 дня, чтобы познакомиться"}</h1>
        <p>${promo ? "Все разделы приложения и вопросы Насте. 30 декабря бот напомнит, как продлить доступ." : "Открыто главное, чтобы почувствовать, как это работает. Остальное видно и откроется с подпиской."}</p></div>
      <ul class="ac-list v-panel">${list.join("")}</ul>
      <p class="small center" style="font-size:12px;margin-top:-4px">Telegram спросит, можно ли боту писать тебе: так придут ответы Насти и напоминание о конце ${promo ? "доступа" : "пробного периода"}.</p>
      <button class="btn" id="acgo">Начать</button>
      ${promo || inTG() ? "" : `<button type="button" class="pr-link" id="acpay" style="align-self:center">Оформить подписку сразу</button>`}
    </div>`;
    $("#acgo").onclick = () => {
      const fin = () => go("#/");
      try { if (tg && tg.requestWriteAccess) tg.requestWriteAccess((ok) => { S.botWrite = !!ok; save(); fin(); }); else fin(); } catch (e) { fin(); }
    };
    if ($("#acpay")) $("#acpay").onclick = () => go("#/sub");
  }
  function Minor() {
    app.innerHTML = `<div class="stack" style="padding-top:48px;text-align:center;align-items:center">
      <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true"><circle cx="36" cy="36" r="34" fill="#182B45"/><circle cx="36" cy="36" r="20" fill="#1F3654"/><circle cx="36" cy="36" r="6" fill="#8CC4E8"/></svg>
      <h1>Карта Глубины — приложение для взрослых</h1>
      <p class="lead">Возвращайся, когда исполнится 18.</p>
    </div>`;
  }
  function Policy(kind) {
    const consent = kind === "consent";
    app.innerHTML = `<div class="stack">${back(S.profile ? "#/" : "#/hello/2", "Назад")}
      <h1>${consent ? "Согласие на обработку персональных данных" : "Политика конфиденциальности"}</h1>
      <p class="lead">[Полный текст — подготовим до запуска.]</p>
    </div>`;
  }

  // ---------- словарь символов ----------
  const DS = (C.dict && C.dict.sections) || [];
  const SY = []; DS.forEach((sec) => sec.symbols.forEach((x) => SY.push(Object.assign({ sec: sec }, x))));
  const symById = (id) => SY.find((x) => x.id === id);
  // карта или образ → статья словаря: точное имя, затем часть «X или Y», затем синонимы
  const SYALIAS = { "кот": "кошка", "ванна": "ванная и туалет", "незнакомка": "незнакомец или незнакомка" };
  const symByTitle = (t) => { const w = String(t || "").toLowerCase().replace(/ё/g, "е").trim(); if (!w) return null;
    return SY.find((x) => x.title.toLowerCase() === w) || SY.find((x) => x.title.toLowerCase().split(/ или | и /).includes(w)) || (SYALIAS[w] && SY.find((x) => x.title.toLowerCase() === SYALIAS[w])) || null; };
  const mine = (id) => S.myimg[id] || (S.myimg[id] = { text: "", links: [] });
  const hasMine = (id) => S.myimg[id] && (S.myimg[id].text || (S.myimg[id].links || []).length);
  const ART = window.DICT_ART || { secs: {}, defs: "" };
  const ARTOLD = { "voda-i-mesta": "nature", "stihii-i-pogoda": "nature", "nebo-i-svetila": "nature", "rasteniya": "plants", "zhivotnye-i-pticy": "animals", "figury": "people", "predmety": "magic", "chisla": "magic", "cveta": "magic", "telo": "body", "dom-i-komnaty": "home", "vremya-i-puti": "paths", "dorogi-i-transport": "paths" };
  const isDreamSec = (s) => s.id === "dreams" || s.id === "syuzhety-snov";
  const secArt = (s) => ART.secs[s.id] || ART.secs[ARTOLD[s.id]] || ART.secs.magic || "";
  const neon = (inner, vb, w, h) => `<svg viewBox="${vb}" width="${w}" height="${h}" aria-hidden="true">${ART.defs}${inner}</svg>`;
  const STARS = '<svg class="dstars" viewBox="0 0 390 170" preserveAspectRatio="xMaxYMin meet" aria-hidden="true"><defs><filter id="gs" filterUnits="userSpaceOnUse" x="0" y="0" width="390" height="170"><feGaussianBlur stdDeviation="2.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>' +
    [[300, 40, 7, .95, 0], [350, 78, 4.5, .8, 1.2], [262, 96, 3.5, .6, 2.1], [338, 138, 5.5, .85, .6], [372, 30, 3, .6, 1.7], [232, 52, 2.6, .5, 2.6]].map(([x, y, r, o, dl]) => `<path d="M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r}Z" fill="#fff" fill-opacity="${o}" filter="url(#gs)"><animate attributeName="opacity" values="1;.25;1" dur="${3 + dl}s" begin="-${dl}s" repeatCount="indefinite"/></path>`).join("") + "</svg>";
  // старшие арканы: имена и картинки — в приложении, тексты — в закрытом контенте (dict.tarot)
  const ROM = ["0", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI"];
  const ARC = [["Шут", "00-shut"], ["Маг", "01-mag"], ["Верховная Жрица", "02-zhrica"], ["Императрица", "03-imperatrica"], ["Император", "04-imperator"], ["Иерофант", "05-ierofant"], ["Влюбленные", "06-vlyublennye"], ["Колесница", "07-kolesnica"], ["Сила", "08-sila"], ["Отшельник", "09-otshelnik"], ["Колесо Фортуны", "10-koleso"], ["Справедливость", "11-spravedlivost"], ["Повешенный", "12-poveshennyj"], ["Смерть", "13-smert"], ["Умеренность", "14-umerennost"], ["Дьявол", "15-dyavol"], ["Башня", "16-bashnya"], ["Звезда", "17-zvezda"], ["Луна", "18-luna"], ["Солнце", "19-solnce"], ["Суд", "20-sud"], ["Мир", "21-mir"]];
  const TAROT = (C.dict && C.dict.tarot) || [];
  const arcData = (n) => TAROT.find((x) => Number(x.arcana) === n || String(x.arcana) === ROM[n]) || TAROT.find((x) => String(x.title || "").toLowerCase() === ARC[n][0].toLowerCase()) || null;
  const arcImg = (n) => "img/tarot/" + ARC[n][1] + ".jpg";
  const mythsHTML = (a) => (a || []).map((y) => `<div class="dmy"><b>${esc(y.h)}</b><p>${esc(y.t)}</p></div>`).join("");
  // карта на весь экран: свайп вниз или крестик закрывают; если карт несколько — листать стрелками и свайпом вбок
  function cardView(src, top, sub, list, idx) {
    const L = list || [{ src, top, sub }]; let i = idx || 0;
    const bg = document.createElement("div"); bg.className = "cview";
    const many = L.length > 1;
    bg.innerHTML = `<div class="cv-top"><span></span><b></b></div><img alt=""><button type="button" class="cv-x" aria-label="Закрыть">×</button>${many ? '<button type="button" class="cv-n prev" aria-label="Предыдущая карта">‹</button><button type="button" class="cv-n next" aria-label="Следующая карта">›</button>' : ""}`;
    const im = bg.querySelector("img"), sp = bg.querySelector(".cv-top span"), tb = bg.querySelector(".cv-top b");
    const show = () => { const c = L[i]; im.src = c.src; im.alt = c.top || ""; tb.textContent = c.top || ""; sp.textContent = c.sub || ""; sp.style.display = c.sub ? "" : "none"; im.style.transform = ""; };
    const go2 = (k) => { if (!many) return; i = (i + k + L.length) % L.length; show(); haptic(); };
    show();
    const close = () => { bg.classList.add("out"); setTimeout(() => bg.remove(), 200); document.removeEventListener("keydown", key); };
    const key = (e) => { if (e.key === "Escape") close(); else if (e.key === "ArrowRight") go2(1); else if (e.key === "ArrowLeft") go2(-1); };
    document.addEventListener("keydown", key);
    bg.querySelector(".cv-x").onclick = close;
    if (many) { bg.querySelector(".cv-n.prev").onclick = () => go2(-1); bg.querySelector(".cv-n.next").onclick = () => go2(1); }
    bg.onclick = (e) => { if (e.target === bg) close(); };
    let x0 = null, y0 = null;
    bg.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    bg.addEventListener("touchmove", (e) => { if (y0 === null) return; const dx = e.touches[0].clientX - x0, dy = e.touches[0].clientY - y0;
      if (Math.abs(dx) > Math.abs(dy) && many) im.style.transform = `translateX(${dx}px)`;
      else if (dy > 0) { im.style.transform = `translateY(${dy}px)`; bg.style.opacity = String(Math.max(.3, 1 - dy / 400)); } }, { passive: true });
    bg.addEventListener("touchend", (e) => { if (y0 === null) return; const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = y0 = null;
      if (many && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) go2(dx < 0 ? 1 : -1);
      else if (dy > 90) close(); else { im.style.transform = ""; bg.style.opacity = ""; } });
    document.body.appendChild(bg);
  }
  const SEC_IMG = { nature: "Slovar-3.webp", plants: "Slovar-4.webp", animals: "Slovar-5.webp", people: "Slovar-6.webp", magic: "SlovarRazdely-2.webp", body: "SlovarRazdely-3.webp", home: "SlovarRazdely-4.webp", paths: "SlovarRazdely-5.webp", colors: "SlovarRazdely-1.webp" };
  function Dict(tab) {
    const my = tab === "my";
    const myN = Object.keys(S.myimg).filter(hasMine).length;
    let h = `<div class="dict"><div class="dhead">${STARS}<div class="dhead-in">${back("#/lib", "Бухта")}
      <div class="dkick">язык бессознательного</div><h1>Словарь символов</h1><p class="dsub">У символа нет одного значения. Здесь то, что он нес в мифах, и место для своего.</p>
      ${my ? "" : `<label class="dsearch">${'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D6D8FF" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>'}<input id="q" type="search" placeholder="Найти: вода, дом, волк…" aria-label="Поиск символа"></label>`}</div></div>
      <div class="dbody"><div class="dchips"><a href="#/dict" class="${my ? "" : "on"}">Словарь · ${SY.length}</a><a href="#/dict/my" class="${my ? "on" : ""}">Мои образы · ${myN}</a></div>`;
    if (!DS.length) { app.innerHTML = h + `<p class="lead">Словарь появится после подключения.</p></div></div>`; return; }
    if (my) {
      const ids = Object.keys(S.myimg).filter(hasMine);
      if (!ids.length) h += `<div class="dcard"><div class="small">Здесь появятся твои записи к символам и твои связи между ними. Открой любой символ и напиши, что он значит для тебя.</div></div>`;
      ids.forEach((id) => {
        const x = symById(id); if (!x) return; const m = S.myimg[id];
        h += `<a class="dcard" href="#/sym/${id}"><div class="row" style="justify-content:space-between"><b>${esc(x.title)}</b>${icon.chev}</div>
          ${m.text ? `<div style="font-size:14px;color:#D9DCF2">${esc(m.text)}</div>` : ""}
          ${(m.links || []).length ? `<div class="chips">${m.links.map((l) => { const y = symById(l); return y ? `<span class="chip mine sm">${esc(y.title.toLowerCase())}</span>` : ""; }).join("")}</div>` : ""}</a>`;
      });
      app.innerHTML = h + `</div></div>`; return;
    }
    const dsec = DS.find(isDreamSec), secs = DS.filter((s) => !isDreamSec(s));
    h += `<div id="res" class="stack" style="gap:8px"></div><div id="secs" class="stack" style="gap:10px">
      <div class="dwides">${dsec ? `<a class="dwide" href="#/dsec/${dsec.id}"><b>${esc(dsec.title).replace(" ", "<br>")}</b><img src="${V27}Slovar-1.webp" alt=""></a>` : ""}<a class="dwide" href="#/tarot"><b>Старшие<br>арканы</b><img src="${V27}Slovar-2.webp" alt=""></a></div>
      <div class="dkick" style="margin-top:14px">Разделы</div>
      <div class="dgrid">${secs.map((s) => `<a class="dtile" href="#/dsec/${s.id}">${SEC_IMG[s.id] ? `<img src="${V27}${SEC_IMG[s.id]}" alt="">` : ""}<b>${esc(s.title)}</b><span class="dn">${s.symbols.length}</span></a>`).join("")}</div></div></div></div>`;
    app.innerHTML = h;
    const q = $("#q"), res = $("#res"), secsEl = $("#secs");
    q.oninput = () => {
      const t = q.value.trim().toLowerCase().replace(/ё/g, "е");
      if (!t) { res.innerHTML = ""; secsEl.style.display = ""; return; }
      const f = SY.filter((x) => x.title.toLowerCase().includes(t) || String(x.essence || "").toLowerCase().includes(t)).slice(0, 30);
      secsEl.style.display = "none";
      res.innerHTML = f.length ? f.map(symRow).join("") : `<div class="small">Такого символа пока нет в словаре. Свой образ можно записать в «Совпадениях».</div>`;
    };
  }
  const symRow = (x) => `<a class="sym-row" href="#/sym/${x.id}"><span class="t"><b>${esc(x.title)}</b><span>${esc(x.essence)}</span></span>${icon.chev}</a>`;
  function DSec(id) {
    const sec = DS.find((x) => x.id === id); if (!sec) return go("#/dict");
    app.innerHTML = `<div class="dict"><div class="dhead sm">${STARS}<div class="dhead-in">${back("#/dict", "Словарь")}
      <div class="dart-top">${SEC_IMG[sec.id] || isDreamSec(sec) ? `<img class="dsec-i" src="${V27}${SEC_IMG[sec.id] || "Slovar-1.webp"}" alt="">` : ""}<div class="stack" style="gap:6px;min-width:0"><div class="dkick">Раздел</div><h1>${esc(sec.title)}</h1>${sec.intro ? `<p class="dsub">${esc(sec.intro)}</p>` : ""}</div></div></div></div>
      <div class="dbody"><div class="stack" style="gap:8px">${sec.symbols.map((x) => symRow(Object.assign({ sec: sec }, x))).join("")}</div></div></div>`;
  }
  // карта колоды к символу: по имени карты
  const deckFor = (x) => DECK.find((c) => { const y = symByTitle(c.title); return y && y.id === x.id; });
  function dtabs(list, cur, base) { return `<div class="dtabs" role="tablist">${list.map(([k, l]) => `<a role="tab" href="${base}/${k}" class="${k === cur ? "on" : ""}" aria-selected="${k === cur}">${l}</a>`).join("")}</div>`; }
  function mineBlock(id, title, questions, rel) {
    const m = S.myimg[id] || { text: "", links: [] };
    return `<div class="dcard" style="gap:10px"><label for="moe"><h2 style="font-size:17px">Что ${esc(title.toLowerCase())} значит для тебя?</h2></label>
      ${(questions || []).length ? `<div class="stack" style="gap:6px;font-size:13px;line-height:1.45;color:#B9BFE0"><span style="font-size:12px;color:#9AA3CF">Если нужна подсказка:</span>${questions.map((q) => `<span>— ${esc(q)}</span>`).join("")}</div>` : ""}
      <textarea id="moe" rows="4" placeholder="Твоя ассоциация — она здесь главная">${esc(m.text)}</textarea>
      <span class="small" id="st" style="font-size:12px;color:#9AA3CF">${m.text ? "Сохранено в «Мои образы»" : "Запись сохранится в «Мои образы»"}</span></div>${rel ? `<div class="rel-low">${rel}</div>` : ""}`;
  }
  function bindMine(id) {
    const ta = $("#moe"), stl = $("#st"); if (!ta) return; let deb;
    ta.oninput = () => { clearTimeout(deb); deb = setTimeout(() => { mine(id).text = ta.value.trim(); mine(id).at = now(); save(); stl.textContent = "Сохранено в «Мои образы»"; }, 500); };
  }
  const para = (t) => t ? String(t).split(/\n\s*\n/).map((x) => `<p class="dp">${esc(x.trim())}</p>`).join("") : "";
  function Sym(id, tab) {
    const x = symById(id); if (!x) return go("#/dict");
    const m = S.myimg[id] || { text: "", links: [] };
    const links = m.links || [];
    const related = x.related || [];
    const relIds = related.map((t) => { const y = symByTitle(t); return y ? y.id : null; });
    const rel = related.map((t, i) => { const y = relIds[i]; return y ? `<a class="chip${links.includes(y) ? " mine" : ""}" href="#/sym/${y}">${esc(t)}</a>` : `<span class="chip" style="color:var(--muted)">${esc(t)}</span>`; }).join("");
    const myl = links.filter((l) => !relIds.includes(l)).map((l) => { const y = symById(l); return y ? `<a class="chip mine" href="#/sym/${y.id}">${esc(y.title.toLowerCase())}</a>` : ""; }).join("");
    const TB = [["sut", "Суть"]]; if ((x.myths || []).length) TB.push(["myths", "Мифы"]); if ((x.dream || []).length) TB.push(["son", "Во сне"]); TB.push(["moe", "Мое"]);
    const cur = TB.some((t) => t[0] === tab) ? tab : "sut";
    const card = deckFor(x);
    let body = "";
    if (cur === "sut") body = `${para(x.gift)}${x.shadow ? `<div class="dcard"><h2 style="font-size:16px">Теневая сторона</h2><p class="dp">${esc(x.shadow)}</p></div>` : ""}
      ${x.sd || x.deep ? `<div class="dcard">${x.sd ? `<h2 style="font-size:16px">В символдраме</h2><p class="dp">${esc(x.sd)}</p>` : ""}${x.deep ? `<span class="small" style="color:#B9BFE0">В Глубине: ${esc(x.deep)}</span>` : ""}</div>` : ""}`;
    else if (cur === "myths") body = mythsHTML(x.myths);
    else if (cur === "son") body = `<p class="small" style="color:#B9BFE0">Сон говорит на языке самого человека. Это возможные прочтения, а не толкование.</p>${mythsHTML(x.dream)}`;
    else body = mineBlock(id, x.title, x.questions, `<div class="stack" style="gap:10px"><div class="dkick" style="color:#C3CBEB">рядом по смыслу</div><div class="chips">${rel}${myl}</div>
        <a class="dash-btn" href="#/pick/${id}">${links.length ? "Изменить мои связи" : "Открыть весь список"} ${icon.chev}</a>
        <span class="small" style="font-size:12px;color:#9AA3CF">Выбери символы, которые связаны с этим образом для тебя. Твои связи появятся здесь и в «Моих образах».</span></div>`);
    app.innerHTML = `<div class="dict"><div class="dhead sm">${STARS}<div class="dhead-in">${back("#/dsec/" + x.sec.id, x.sec.title)}
      <div class="dart-top">${card && card.img ? `<button type="button" class="dthumb" id="dcard" aria-label="Открыть карту «${esc(card.title)}»"><img src="${card.img}" alt=""></button>` : ""}
      <div class="stack" style="gap:6px;min-width:0"><div class="dkick">${esc(x.sec.title)}</div><h1>${esc(x.title)}</h1><p class="dsub">${esc(x.essence)}</p></div></div></div></div>
      <div class="dbody">${dtabs(TB, cur, "#/sym/" + id)}<div class="stack" style="gap:14px">${body}</div></div></div>`;
    if ($("#dcard")) $("#dcard").onclick = () => cardView(card.img, card.title);
    bindMine(id);
  }
  function Tarot() {
    const intro = C.dict && C.dict.tarotIntro;
    app.innerHTML = `<div class="dict"><div class="dhead sm">${STARS}<div class="dhead-in">${back("#/dict", "Словарь")}
      <img class="arc-i" src="${V27}Arkany-1.webp" alt=""><h1>Старшие<br>арканы</h1><p class="dsub" style="max-width:60%">22 этапа на пути к себе: от Шута к Миру</p></div></div>
      <div class="dbody">${intro ? `<p class="dp">${esc(intro)}</p>` : ""}<div class="apath">${ARC.map((a, i) => `<a class="arow${S.myimg["arc" + i] && S.myimg["arc" + i].text ? " has" : ""}" href="#/arc/${i}"><span class="anum">${ROM[i]}</span><span class="aname">${esc(a[0])}</span></a>`).join("")}</div></div></div>`;
  }
  function Arc(n, tab) {
    n = Math.max(0, Math.min(21, Number(n) || 0));
    const a = ARC[n], x = arcData(n) || {}, id = "arc" + n;
    const TB = [["sut", "Суть"], ["karta", "Карта"], ["put", "Путь"], ["son", "Во сне"], ["moe", "Мое"]];
    const cur = TB.some((t) => t[0] === tab) ? tab : "sut";
    const soon = `<p class="small" style="color:#B9BFE0">Текст к этой карте скоро появится.</p>`;
    let body = "";
    if (cur === "sut") body = x.gift || x.shadow ? `${para(x.gift)}${x.shadow ? `<div class="dcard"><h2 style="font-size:16px">Теневая сторона</h2><p class="dp">${esc(x.shadow)}</p></div>` : ""}${(x.myths || []).length ? `<div class="dkick" style="color:#C3CBEB;margin-top:4px">в мифах и сказках</div>${mythsHTML(x.myths)}` : ""}` : soon;
    else if (cur === "karta") body = `<button type="button" class="abig" id="abig" aria-label="Открыть карту"><img src="${arcImg(n)}" alt="${esc(a[0])}"></button>${x.card ? `<div class="dcard"><h2 style="font-size:16px">Что на карте</h2><p class="dp">${esc(x.card)}</p></div>` : ""}`;
    else if (cur === "put") body = `<details class="dwhat"><summary>Что такое путь</summary><p class="dp">${esc((C.dict && C.dict.pathInfo) || "Путь — место карты в истории от Шута к Миру: что было до нее, какой урок она приносит и куда ведет дальше.")}</p></details>${x.path ? `<div class="dstory">${para(x.path)}</div>` : soon}`;
    else if (cur === "son") body = (x.dream || []).length ? `<p class="small" style="color:#B9BFE0">Возможные прочтения, а не толкование.</p>${mythsHTML(x.dream)}` : soon;
    else { const rl = (x.related || []).map((t) => { const y = symByTitle(t); return y ? `<a class="chip" href="#/sym/${y.id}">${esc(t)}</a>` : `<span class="chip" style="color:var(--muted)">${esc(t)}</span>`; }).join(""); body = mineBlock(id, a[0], x.questions, rl ? `<div class="stack" style="gap:10px"><div class="dkick" style="color:#C3CBEB">рядом по смыслу</div><div class="chips">${rl}</div></div>` : ""); }
    app.innerHTML = `<div class="dict"><div class="dhead sm">${STARS}<div class="dhead-in">${back("#/tarot", "Старшие арканы")}
      <div class="dart-top"><button type="button" class="dthumb arc" id="dcard" aria-label="Открыть карту «${esc(a[0])}»"><img src="${arcImg(n)}" alt=""></button>
      <div class="stack" style="gap:6px;min-width:0"><div class="dkick" style="color:#FFC2A8">аркан ${ROM[n]}</div><h1>${esc(a[0])}</h1>${x.essence ? `<p class="dsub">${esc(x.essence)}</p>` : ""}</div></div></div></div>
      <div class="dbody">${dtabs(TB, cur, "#/arc/" + n)}<div class="stack" style="gap:14px">${body}</div>
      <div class="anav">${n > 0 ? `<a href="#/arc/${n - 1}/${cur}">‹ ${esc(ARC[n - 1][0])} · ${ROM[n - 1]}</a>` : "<span></span>"}${n < 21 ? `<a href="#/arc/${n + 1}/${cur}">${esc(ARC[n + 1][0])} · ${ROM[n + 1]} ›</a>` : "<span></span>"}</div></div></div>`;
    const open = () => cardView(null, null, null, ARC.map((c, k) => ({ src: arcImg(k), top: c[0], sub: "аркан " + ROM[k] })), n);
    $("#dcard").onclick = open; if ($("#abig")) $("#abig").onclick = open;
    bindMine(id);
  }
  function Pick(id) {
    const x = symById(id); if (!x) return go("#/dict");
    const sel = new Set((S.myimg[id] && S.myimg[id].links) || []);
    app.innerHTML = `<div class="stack">${back("#/sym/" + id, x.title)}
      <div class="stack" style="gap:6px"><h1>Твои связи: ${esc(x.title.toLowerCase())}</h1><p class="small">Отметь символы, которые для тебя связаны с этим образом. Здесь нет правильных ответов.</p></div>
      ${DS.map((sec) => `<div class="stack" style="gap:8px"><div class="kicker" style="letter-spacing:.06em">${esc(sec.title.toUpperCase())}</div><div class="chips">${sec.symbols.filter((y) => y.id !== id).map((y) => `<button type="button" class="chip${sel.has(y.id) ? " mine" : ""}" data-l="${y.id}">${esc(y.title.toLowerCase())}</button>`).join("")}</div></div>`).join("")}
      <button class="btn" id="done">Готово</button></div>`;
    app.querySelectorAll("[data-l]").forEach((b) => b.onclick = () => { const l = b.dataset.l; sel.has(l) ? sel.delete(l) : sel.add(l); b.classList.toggle("mine"); });
    $("#done").onclick = () => { mine(id).links = Array.from(sel); mine(id).at = now(); save(); haptic(); go("#/sym/" + id); };
  }

  // ---------- музыка ----------
  const MU = C.music || [];
  const VOICES = C.voices || [];
  const audio = window.__kartaAudio || (window.__kartaAudio = new Audio());
  audio.preload = "none";
  const vEl = window.__kartaVoice || (window.__kartaVoice = new Audio());
  vEl.preload = "none";
  const M = window.__kartaMusic || (window.__kartaMusic = { cur: null, tab: "all", qtab: "all", end: 0, iv: null, lock: null, drag: false });
  const mset = () => {
    const m = S.music || (S.music = { timer: 60, repeat: "list", fade: true });
    if (!m.voice) m.voice = { on: false, id: "relax" };
    return m;
  };
  const track = (id) => MU.find((t) => t.id === id) || VOICES.find((t) => t.id === id && t.src && !t.soon);
  const isVoiced = (id) => !MU.some((t) => t.id === id) && VOICES.some((t) => t.id === id);
  const voiceById = (id) => VOICES.find((v) => v.id === id);
  const queue = () => ((M.qtab || M.tab) === "mine" ? S.playlist.map(track).filter(Boolean) : MU);
  const fmtMin = (sec) => Math.round(sec / 60) + " мин";
  async function wake(on) {
    try {
      if (on && "wakeLock" in navigator && !M.lock) { M.lock = await navigator.wakeLock.request("screen"); M.lock.addEventListener("release", () => { M.lock = null; }); }
      if (!on && M.lock) { await M.lock.release(); M.lock = null; }
    } catch (e) {}
  }
  // Голос поверх музыки — второй обычный плеер (так звук продолжается в свернутом приложении).
  // В начале файла голоса 20 секунд тишины: оба плеера стартуют одним нажатием.
  // Голос звучит один раз за сеанс: заново — после закрытия плеера или повторного включения тумблера.
  const V = window.__kartaV || (window.__kartaV = { st: "off" }); // off · play · done
  const setVol = (el, v) => { try { el.volume = Math.max(0, Math.min(1, v)); } catch (e) {} };
  // С 05.11 голос не накладывается поверх музыки: три трека «музыка + голос» записаны одним файлом.
  const voiceOn = () => null;
  const voiceLeft = () => { const v = voiceById(mset().voice.id) || {}; const d = vEl.duration && isFinite(vEl.duration) ? vEl.duration : v.dur || 0; return Math.max(0, d - (vEl.currentTime || 0)) * 1000; };
  function ensureTimer() { if (M.end && V.st === "play") M.end = Math.max(M.end, Date.now() + voiceLeft() + 20000); }
  function startVoice() {
    const v = voiceOn(); if (!v) return;
    if (vEl.getAttribute("src") !== v.src) vEl.src = v.src;
    try { vEl.currentTime = 0; } catch (e) {}
    setVol(vEl, 1); vEl.play().catch(() => {});
    V.st = "play"; ensureTimer();
  }
  function voiceOff() { vEl.pause(); V.st = "done"; setVol(audio, 1); }
  vEl.onended = () => { V.st = "done"; setVol(audio, 1); };
  function mixTick() {
    if (NOW.kind !== "music" || audio.paused) return;
    let v = 1;
    // на Android громкость меняется: под голосом музыка тише; на iPhone баланс заложен в самих файлах
    if (V.st === "play" && (vEl.currentTime || 0) > 18) v = 0.55;
    if (M.end && mset().fade) { const left = M.end - Date.now(); if (left < 30000) v *= Math.max(0, left / 30000); }
    setVol(audio, v); if (V.st === "play") setVol(vEl, M.end && M.end - Date.now() < 30000 ? Math.max(0, (M.end - Date.now()) / 30000) : 1);
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && !audio.paused && NOW.kind !== "music" && NOW.kind !== "pod") wake(true); });
  // Один звук на все приложение: музыка или подкаст. NOW — что сейчас в плеере.
  const NOW = window.__kartaNow || (window.__kartaNow = { kind: null, id: null });
  function playTrack(id, auto) {
    const t = track(id); if (!t) return;
    const starting = audio.paused || NOW.kind !== "music";
    if (!auto && starting) M.qtab = M.tab;
    if (!auto) M.endless = isVoiced(id); // после трека с голосом музыка идет без конца
    if (NOW.kind !== "music" || M.cur !== id || !audio.src) { M.sw = Date.now(); audio.src = t.src; M.cur = id; }
    if (!isVoiced(id)) M.sel = id;
    NOW.kind = "music"; NOW.id = id;
    audio.playbackRate = 1;
    if (!auto) {
      const tm = mset().timer; M.end = tm ? Date.now() + tm * 60000 : 0;
      if (voiceOn()) {
        if (V.st === "off") startVoice();
        else if (V.st === "play" && vEl.paused) vEl.play().catch(() => {});
      }
      ensureTimer();
    }
    audio.play().catch(() => toast("Нажми ▶ еще раз"));
    try { if ("mediaSession" in navigator) navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: "Карта Глубины" }); } catch (e) {}
    sessionFor("music");
    wake(false); paintMini(); // во время музыки экран может гаснуть
  }
  function stopMusic(full) {
    audio.pause(); M.end = 0; wake(false);
    if (V.st === "play") vEl.pause();
    if (full) { vEl.pause(); if (V.st === "play") V.st = "done"; }
    setVol(audio, 1);
  }
  function closeAudio() { M.voicedOnce = false; M.after = null;
    audio.pause(); M.end = 0; wake(false); vEl.pause(); V.st = "off"; setVol(audio, 1);
    if (NOW.kind === "pod") podSave(true);
    audio.removeAttribute("src"); try { audio.load(); } catch (e) {}
    NOW.kind = null; NOW.id = null; M.cur = null; paintMini(); paint();
  }
  audio.onended = () => {
    if (NOW.kind === "pod") { const st = podSt(NOW.id); st.done = true; st.pos = 0; save(); const nx = S.podAuto && epNext(NOW.id, 1); if (nx) { playEp(nx.id); if (location.hash.indexOf("#/ep/") === 0) go("#/ep/" + nx.id); } paint(); paintMini(); return; }
    const q = queue(), i = q.findIndex((t) => t.id === M.cur);
    if (isVoiced(M.cur)) { const nx = (M.after && track(M.after)) || q[0]; M.after = null; if (nx) playTrack(nx.id, true); else { stopMusic(true); paint(); paintMini(); } return; }
    let r = mset().repeat; if (M.endless && r === "none") r = "list";
    if (r === "one") { audio.currentTime = 0; audio.play(); return; }
    const nx = q[i + 1] || (r === "list" ? q[0] : null);
    if (nx) playTrack(nx.id, true);
    else if (V.st === "play") playTrack(q[0].id, true); // голос еще идет — музыка не обрывается
    else { stopMusic(true); paint(); paintMini(); }
  };
  // Системные кнопки (экран блокировки, шторка) управляют только последним запущенным плеером — голосом.
  // Поэтому связываем плееры: пауза или запуск одного повторяется на другом.
  const voicePaired = () => NOW.kind === "music" && V.st === "play";
  const switching = () => Date.now() - (M.sw || 0) < 1500;
  audio.onplay = () => { if (voicePaired() && vEl.paused && !vEl.ended) vEl.play().catch(() => {}); paintMini(); paint(); };
  audio.onpause = () => { if (voicePaired() && !audio.ended && !switching() && !vEl.paused) vEl.pause(); paintMini(); paint(); };
  vEl.onplay = () => { if (voicePaired() && audio.paused && audio.src) { audio.play().catch(() => {}); wake(true); } };
  vEl.onpause = () => { if (voicePaired() && !vEl.ended && !audio.paused) { audio.pause(); paintMini(); paint(); } };
  function sessionFor(kind) {
    if (!("mediaSession" in navigator)) return;
    const set = (a, f) => { try { navigator.mediaSession.setActionHandler(a, f); } catch (e) {} };
    if (kind === "music") {
      set("pause", () => { audio.pause(); if (V.st === "play") vEl.pause(); try { navigator.mediaSession.playbackState = "paused"; } catch (e) {} });
      set("play", () => { audio.play().catch(() => {}); if (V.st === "play" && !vEl.ended) vEl.play().catch(() => {}); try { navigator.mediaSession.playbackState = "playing"; } catch (e) {} });
      set("stop", () => { stopMusic(true); paintMini(); paint(); });
    } else ["pause", "play", "stop"].forEach((a) => set(a, null));
  }
  let paint = () => {};

  // ---------- подкасты: состояние воспроизведения ----------
  const PODS = (C.podcasts && C.podcasts.series) || [];
  const EPS = []; PODS.forEach((se) => se.episodes.forEach((e) => EPS.push(Object.assign({ series: se }, e))));
  const epById = (id) => EPS.find((e) => e.id === id);
  if (!S.pod) S.pod = {};
  const podSt = (id) => S.pod[id] || (S.pod[id] = { pos: 0, done: false, ans: {} });
  let podTick = 0;
  function podSave(force) {
    if (NOW.kind !== "pod" || !audio.src) return;
    const st = podSt(NOW.id), d = audio.duration || (epById(NOW.id) || {}).dur || 0;
    st.pos = audio.currentTime || 0;
    if (d && st.pos > d - 30) st.done = true;
    if (force || ++podTick % 5 === 0) save();
  }
  function playEp(id) {
    const e = epById(id); if (!e || !e.src) return;
    if (NOW.kind !== "pod" || NOW.id !== id || !audio.src) {
      M.end = 0; M.cur = null; wake(false); vEl.pause(); V.st = "off";
      audio.src = e.src;
      const pos = podSt(id).done ? 0 : podSt(id).pos || 0;
      if (pos > 1) audio.addEventListener("loadedmetadata", () => { try { audio.currentTime = pos; } catch (x) {} }, { once: true });
      NOW.kind = "pod"; NOW.id = id; sessionFor("pod");
      try { if ("mediaSession" in navigator) navigator.mediaSession.metadata = new MediaMetadata({ title: e.title, artist: "Настя Черемных · " + e.series.title }); } catch (x) {}
    }
    setVol(audio, 1); audio.playbackRate = S.podRate || 1;
    audio.play().catch(() => toast("Нажми ▶ еще раз"));
    paintMini();
  }

  // ---------- мини-плеер: тонкая строка сверху ----------
  const mini = document.getElementById("mini") || (() => { const d = document.createElement("div"); d.id = "mini"; app.parentNode.insertBefore(d, app); return d; })();
  function paintMini() {
    const parts = (location.hash.replace(/^#\/?/, "") || "").split("/");
    const r = parts[0], id = parts[1];
    const hide = !NOW.kind || !audio.src || !S.profile || r === "player" || r === "hello" ||
      (NOW.kind === "music" && r === "music") || (NOW.kind === "pod" && r === "ep" && id === NOW.id);
    document.body.classList.toggle("hasmini", !hide);
    if (hide) { mini.className = ""; mini.innerHTML = ""; mini._h = ""; return; }
    let title, sub, prog = null, href;
    if (NOW.kind === "music") {
      const t = track(NOW.id) || {}; title = t.title || "Музыка"; href = "#/music";
      const left = M.end ? Math.max(0, Math.ceil((M.end - Date.now()) / 60000)) : 0;
      sub = audio.paused ? "пауза" : (isVoiced(NOW.id) ? "с голосом · " : "") + (left ? "таймер " + left + " мин" : "играет");
    } else {
      const e = epById(NOW.id) || {}; title = e.title || "Подкаст"; href = "#/ep/" + NOW.id;
      const d = audio.duration || e.dur || 0, c = audio.currentTime || 0;
      sub = fmt(c) + " / " + fmt(d); prog = d ? Math.min(100, (c / d) * 100) : 0;
    }
    mini.className = "mini" + (audio.paused ? " paused" : "");
    const html = `<a class="mi-body" href="${href}"><span class="mi-dot"></span><b>${esc(title)}</b><span class="mi-sub">· ${esc(sub)}</span></a>
      <button type="button" class="mi-btn" id="mipp" aria-label="${audio.paused ? "Играть" : "Пауза"}">${audio.paused ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="#E8EEF4"><path d="M7 4l13 8-13 8z"/></svg>' : '<svg width="16" height="16" viewBox="0 0 24 24" fill="#E8EEF4"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>'}</button>
      <button type="button" class="mi-btn" id="mix" aria-label="Закрыть плеер"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9FB2C8" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      ${prog !== null ? `<span class="mi-prog" style="width:${prog.toFixed(1)}%"></span>` : ""}`;
    if (mini._h === html) return;
    mini._h = html; mini.innerHTML = html;
    mini.querySelector("#mipp").onclick = () => {
      if (!audio.paused) { if (NOW.kind === "music") stopMusic(); else { audio.pause(); podSave(true); } }
      else if (NOW.kind === "music") playTrack(NOW.id); else playEp(NOW.id);
      paintMini(); paint();
    };
    mini.querySelector("#mix").onclick = closeAudio;
  }
  clearInterval(window.__kartaLoop);
  window.__kartaLoop = setInterval(() => {
    if (NOW.kind === "music" && !audio.paused) {
      mixTick();
      if (M.end && M.end - Date.now() <= 0) { stopMusic(true); paint(); }
    }
    if (NOW.kind === "pod" && !audio.paused) podSave();
    if (!audio.paused || mini.innerHTML) { paintMini(); paint(); }
  }, 1000);
  const MIC = '<svg width="36" height="36" viewBox="0 0 40 40" aria-hidden="true" style="flex-shrink:0"><circle cx="20" cy="20" r="19" fill="#1F3654"/><rect x="16" y="9" width="8" height="14" rx="4" fill="none" stroke="#A9BDD2" stroke-width="1.8"/><path d="M12 19a8 8 0 0 0 16 0M20 27v4" fill="none" stroke="#A9BDD2" stroke-width="1.8" stroke-linecap="round"/></svg>';
  const REP = (c, one) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>${one ? `<circle cx="12" cy="12" r="4.6" fill="${c}" stroke="none"/><text x="12" y="14.6" font-size="7.5" text-anchor="middle" fill="#0F1E33" stroke="none" font-weight="800" font-family="Manrope,sans-serif">1</text>` : ""}</svg>`;
  const MOONS = (c) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>`;
  const REP_LABEL = { none: "без повтора", list: "по кругу", one: "один трек" };
  // настроения треков: цвет обложки и знак
  const MOOD = {
    "сон": ["#5B4B9A", "#2A2350", '<circle cx="26" cy="16" r="6" fill="#fff" fill-opacity=".85"/><circle cx="29" cy="14" r="5" fill="#5B4B9A"/><circle cx="14" cy="24" r="1.2" fill="#fff" fill-opacity=".7"/><circle cx="32" cy="30" r="1" fill="#fff" fill-opacity=".6"/>'],
    "вода": ["#2F8E9A", "#123B47", '<path d="M6 24q5-4 10 0t10 0 10 0" stroke="#fff" stroke-opacity=".8" stroke-width="2" fill="none"/><path d="M6 31q5-4 10 0t10 0 10 0" stroke="#fff" stroke-opacity=".45" stroke-width="2" fill="none"/>'],
    "лес": ["#5E8C5F", "#1D3324", '<path d="M10 34l6-14 6 14z M20 34l7-18 7 18z" fill="#fff" fill-opacity=".7"/>'],
    "тепло": ["#B86A4E", "#3A2420", '<path d="M22 10c4 6 8 9 8 15a8 8 0 0 1-16 0c0-4 3-6 4-9 1 3 3 4 4 4-1-3-1-6 0-10z" fill="#fff" fill-opacity=".8"/>'],
    "свет": ["#6E8FC9", "#1E2E52", '<circle cx="22" cy="22" r="6" fill="#fff" fill-opacity=".85"/><g stroke="#fff" stroke-opacity=".6" stroke-width="2" stroke-linecap="round"><path d="M22 8v4M22 32v4M8 22h4M32 22h4M12 12l3 3M29 29l3 3M12 32l3-3M29 15l3-3"/></g>']
  };
  const MOODK = Object.keys(MOOD);
  const moodOf = (t) => {
    if (!t) return "вода";
    if (MOOD[t.mood]) return t.mood;
    const s = String((t.tag || "") + " " + t.title).toLowerCase();
    if (/сон|сна|колыб|звезд|ночь|ноч/.test(s)) return "сон";
    if (/вод|мор|дожд|рек|океан|волн/.test(s)) return "вода";
    if (/лес|птиц|трав|сад/.test(s)) return "лес";
    if (/огон|огн|тепл|пустын|солн/.test(s)) return "тепло";
    if (/свет|ветер|утр|рассв/.test(s)) return "свет";
    return MOODK[Math.max(0, MU.findIndex((x) => x.id === t.id)) % MOODK.length];
  };
  const MCOV = { "вода": "Muzyka-2.webp", "сон": "Muzyka-3.webp", "свет": "Muzyka-4.webp", "тепло": "Muzyka-5.webp", "лес": "Muzyka-2.webp" };
  const cover = (t, sz) => `<img class="mcov" src="${V27}${MCOV[moodOf(t)]}" alt="" style="width:${sz}px;height:${sz}px">`;
  const ICM = {
    mic: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
    rep: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/></svg>',
    moon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>',
    play: '<svg width="22" height="22" viewBox="0 0 24 24" fill="#0F1E33" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.9l10-6.5a1 1 0 0 0 0-1.7l-10-6.5A1 1 0 0 0 8 5.5z"/></svg>',
    pause: '<svg width="22" height="22" viewBox="0 0 24 24" fill="#0F1E33" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
    prev: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h2v14H6zM20 5v14L9 12z"/></svg>',
    next: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 5h2v14h-2zM4 5v14l11-7z"/></svg>'
  };
  const cap1 = (s) => { s = String(s || ""); return s.charAt(0).toUpperCase() + s.slice(1); };
  function voiceSheet(onDone) {
    const vs = mset().voice;
    let pick = voiceById(vs.id) && !voiceById(vs.id).soon ? vs.id : (VOICES.find((v) => !v.soon) || {}).id;
    const bg = document.createElement("div"); bg.className = "sheet-bg";
    const draw = () => {
      bg.innerHTML = `<div class="sheet msheet" role="dialog" aria-modal="true" aria-labelledby="vsh"><div class="grip"></div>
        <h2 id="vsh" style="font-size:19px">С голосом</h2>
        <p class="small" style="margin-top:-6px">Сначала звучит запись с голосом, потом только музыка.</p>
        <div class="stack" style="gap:8px">${VOICES.map((v) => `<button type="button" class="vopt${v.id === pick ? " on" : ""}${v.soon ? " soon" : ""}" data-v="${v.id}"><span class="rad"></span><span class="t"><b>${esc(v.title)}</b><span>${esc(cap1(v.sub))}${v.soon ? " · скоро" : v.dur ? " · " + fmtMin(v.dur) : ""}</span></span></button>`).join("")}</div>
        <button class="btn" id="von"${pick ? "" : " disabled"}>Включить</button>
        <button type="button" class="link-row" id="voff" style="justify-content:center;border:none;color:var(--muted2)">Без голоса</button></div>`;
      bg.querySelectorAll("[data-v]").forEach((b) => b.onclick = () => {
        const v = voiceById(b.dataset.v);
        if (v.soon) { toast("Эта запись появится скоро"); return; }
        pick = v.id; draw();
      });
      const on = bg.querySelector("#von");
      if (on) on.onclick = () => {
        const changed = vs.id !== pick || !vs.on;
        vs.id = pick; vs.on = true; save(); haptic(); bg.remove();
        if (changed) M.voicedOnce = false;
        onDone();
      };
      bg.querySelector("#voff").onclick = () => { vs.on = false; save(); haptic(); bg.remove(); onDone(); };
    };
    draw();
    bg.onclick = (e) => { if (e.target === bg) bg.remove(); };
    document.body.appendChild(bg);
  }
  function timerSheet(onDone) {
    const st = mset(); if (!st.timerLast) st.timerLast = st.timer || 40;
    const bg = document.createElement("div"); bg.className = "sheet-bg";
    const draw = () => {
      const on = !!st.timer;
      bg.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="tsh"><div class="grip"></div>
        <div class="row" style="justify-content:space-between"><h2 id="tsh" style="font-size:19px">Таймер сна</h2><button type="button" class="tgl tglb${on ? " on" : ""}" id="ton" role="switch" aria-checked="${on}" aria-label="Таймер сна"><i></i></button></div>
        <p class="small" style="margin-top:-6px">${on ? "Музыка плавно затихнет и остановится." : "Таймер выключен: музыка играет, пока не остановишь."}</p>
        <div class="tmr${on ? "" : " off"}"><button type="button" class="pm" id="tm" aria-label="Меньше">−</button><b style="flex:1;text-align:center;font-size:22px">${st.timerLast} мин</b><button type="button" class="pm" id="tp" aria-label="Больше">+</button></div>
        <span class="small center">шаг 10 минут</span>
        <button class="btn" id="tok">Готово</button></div>`;
      const apply = () => { save(); if (NOW.kind === "music" && !audio.paused) { M.end = st.timer ? Date.now() + st.timer * 60000 : 0; ensureTimer(); if (!M.end) setVol(audio, 1); } };
      bg.querySelector("#ton").onclick = () => { st.timer = st.timer ? 0 : st.timerLast; apply(); draw(); };
      bg.querySelector("#tm").onclick = () => { st.timerLast = Math.max(10, st.timerLast - 10); if (st.timer) st.timer = st.timerLast; apply(); draw(); };
      bg.querySelector("#tp").onclick = () => { st.timerLast = Math.min(180, st.timerLast + 10); if (st.timer) st.timer = st.timerLast; apply(); draw(); };
      bg.querySelector("#tok").onclick = () => { bg.remove(); onDone(); };
    };
    draw();
    bg.onclick = (e) => { if (e.target === bg) { bg.remove(); onDone(); } };
    document.body.appendChild(bg);
  }
  function Music() {
    const st = mset();
    // «С голосом» при каждом запуске выключен; остальное (повтор, таймер, вкладка, выбранный трек) сохраняется
    if (!M.init) { M.init = 1; st.voice.on = false; if (st.tab) M.tab = st.tab; if (st.sel && track(st.sel) && !isVoiced(st.sel)) M.sel = st.sel; }
    if (!M.sel) M.sel = M.cur || (MU[0] && MU[0].id);
    const draw = () => {
      const mine = M.tab === "mine";
      const q = mine ? S.playlist.map(track).filter(Boolean) : MU;
      const vs = st.voice, vv = vs.on ? voiceById(vs.id) : null;
      const playing = (id) => M.cur === id && NOW.kind === "music" && !audio.paused;
      app.innerHTML = `<div class="mpage"><div class="mh2">${back("#/lib", "Бухта")}<img src="${V27}Muzyka-1.webp" alt=""><h1>Музыка</h1><p>Для сна, практик и чтобы побыть с собой</p></div>
        <div class="stack" style="gap:12px">
        <div class="mchips"><button type="button" data-tab="all" class="${!mine ? "on" : ""}">Вся музыка</button><button type="button" data-tab="mine" class="${mine ? "on" : ""}">Мой плейлист · ${S.playlist.length}</button>
          <span class="vsw"><button type="button" class="vsw-l" id="vpick">Голос</button><button type="button" class="tgl tglm${vs.on ? " on" : ""}" id="vtgl" role="switch" aria-checked="${vs.on}" aria-label="С голосом"><i></i></button></span></div>
        ${vv ? `<button type="button" class="vname2" id="vpick2">С голосом: <b>${esc(vv.title)}</b> · сменить</button>` : ""}
        <div class="stack" style="gap:8px">${q.length ? q.map((t, i) => { const m = MOOD[moodOf(t)], sel = M.sel === t.id; return `<div class="mtrk${sel ? " sel" : ""}" style="${sel ? `background:linear-gradient(90deg,${m[0]}40,rgba(24,43,69,.7));border-color:${m[0]}` : ""}">
          <button type="button" class="tbody" data-sel="${t.id}" aria-pressed="${sel}">${cover(t, 44)}<span class="t"><b>${esc(t.title)}${playing(t.id) ? ' <span class="eq"><i></i><i></i><i></i></span>' : ""}</b><span>${fmtMin(t.dur)} · ${moodOf(t)}</span></span></button>
          ${mine ? `<span class="ord"><button type="button" data-up="${i}" aria-label="Выше"${i ? "" : " disabled"}>↑</button><button type="button" data-dn="${i}" aria-label="Ниже"${i < q.length - 1 ? "" : " disabled"}>↓</button></span>` : ""}
          <button type="button" class="add${S.playlist.includes(t.id) ? " in" : ""}" data-add="${t.id}" aria-label="${S.playlist.includes(t.id) ? "Убрать из плейлиста" : "Добавить в плейлист"}">${S.playlist.includes(t.id) ? (mine ? "×" : "✓") : "+"}</button></div>`; }).join("") : `<div class="card dashed"><div class="small">Плейлист пока пуст. Во «Всей музыке» нажми «+» у треков, которые хочешь сюда.</div></div>`}</div>
        <div class="small center" style="font-size:12px;color:var(--dim)">${mine ? "Стрелками можно выстроить свой порядок" : "Нажми на трек, чтобы выбрать, и ▶ — чтобы слушать"}</div>
        <div id="now"></div></div></div>`;
      // если включено «С голосом»: сначала запись с голосом, потом выбранная музыка без конца
      const start = (id) => {
        M.qtab = M.tab;
        const fromStop = NOW.kind !== "music" || audio.paused && !(M.cur === id && audio.currentTime > 0);
        if (vv && vv.src && !vv.soon && !M.voicedOnce && fromStop && !isVoiced(id)) { M.voicedOnce = true; M.after = id; playTrack(vv.id); }
        else playTrack(id);
      };
      // включили голос: музыка замолкает, плеер встает на запись с голосом и ждет ▶; после голоса — выбранная музыка
      const armVoice = () => {
        const v = vs.on ? voiceById(vs.id) : null;
        if (!v || !v.src || v.soon) { if (isVoiced(M.sel)) M.sel = M.after || (q[0] && q[0].id); draw(); return; }
        const was = isVoiced(M.sel) ? M.after : M.sel || (M.cur && !isVoiced(M.cur) ? M.cur : null);
        if (NOW.kind === "music" && audio.src) stopMusic(true);
        M.after = was || (q[0] && q[0].id); M.voicedOnce = true; M.sel = v.id; M.qtab = M.tab;
        draw();
      };
      const voiceOffNow = () => { vs.on = false; save(); haptic(); if (isVoiced(M.cur) && NOW.kind === "music") stopMusic(true); if (isVoiced(M.sel)) M.sel = M.after || (q[0] && q[0].id); draw(); };
      $("#vpick").onclick = () => voiceSheet(armVoice); if ($("#vpick2")) $("#vpick2").onclick = () => voiceSheet(armVoice);
      $("#vtgl").onclick = () => { if (vs.on) voiceOffNow(); else voiceSheet(armVoice); };
      app.querySelectorAll("[data-tab]").forEach((b) => b.onclick = () => { M.tab = st.tab = b.dataset.tab; save(); draw(); });
      app.querySelectorAll("[data-sel]").forEach((b) => b.onclick = () => { const id = b.dataset.sel; M.sel = id; if (!isVoiced(id)) { st.sel = id; save(); } haptic(); if (NOW.kind === "music" && !audio.paused && M.cur !== id) { M.qtab = M.tab; playTrack(id, true); } draw(); });
      app.querySelectorAll("[data-add]").forEach((b) => b.onclick = () => { const id = b.dataset.add, i = S.playlist.indexOf(id); i >= 0 ? S.playlist.splice(i, 1) : S.playlist.push(id); save(); haptic(); draw(); });
      const mv = (i, k) => { const a = S.playlist, j = i + k; if (j < 0 || j >= a.length) return; const x = a[i]; a[i] = a[j]; a[j] = x; save(); draw(); };
      app.querySelectorAll("[data-up]").forEach((b) => b.onclick = () => mv(Number(b.dataset.up), -1));
      app.querySelectorAll("[data-dn]").forEach((b) => b.onclick = () => mv(Number(b.dataset.dn), 1));
      paint = () => {
        const el = $("#now"); if (!el || M.drag) return;
        const on = NOW.kind === "music" && audio.src;
        const t = track(M.sel) || (on && track(M.cur)) || q[0];
        if (!t) { el.innerHTML = ""; return; }
        const pq = queue(), pi = pq.findIndex((x) => x.id === t.id), vo = isVoiced(t.id);
        const isPlay = on && !audio.paused && M.cur === t.id;
        const d = on && audio.duration && isFinite(audio.duration) ? audio.duration : t.dur || 0, c = on && M.cur === t.id ? audio.currentTime || 0 : 0;
        const left = M.end ? Math.max(0, Math.ceil((M.end - Date.now()) / 60000)) : 0;
        const r = st.repeat || "list";
        const sub = vo ? "с голосом, дальше музыка" : (pq.length > 1 && pi >= 0 ? pi + 1 + " из " + pq.length + " · " : "") + (isPlay ? (left ? "затихнет через " + left + " мин" : "играет") : on && M.cur === t.id ? "пауза" : "выбран");
        const m = MOOD[moodOf(t)];
        const html = `<div class="mbar" style="background:linear-gradient(110deg,${m[0]}F2,${m[1]}F2 70%);border-color:${m[0]}"><div class="mbar-r">${cover(t, 44)}
          <span class="mbar-t"><b>${esc(t.title)}</b><span>${sub}</span></span></div>
          <div class="mseek-r"><span>${fmt(c)}</span><input class="mseek" id="ms" type="range" min="0" max="${Math.max(1, Math.floor(d))}" step="1" value="${Math.floor(c)}" aria-label="Перемотка" style="--p:${d ? Math.min(100, (c / d) * 100).toFixed(1) : 0}%"${on && M.cur === t.id ? "" : " disabled"}><span>${fmt(d)}</span></div>
          <div class="mbar-c"><button type="button" class="ib${st.timer ? " on" : ""}" id="mtmr" aria-label="Таймер сна"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="14" r="7"/><path d="M12 10v4l2.5 1.5M10 3h4M12 3v4"/></svg>${st.timer ? `<span class="badge">${isPlay && left ? left : st.timer}</span>` : ""}</button>
            <button type="button" class="ib nav" id="mprev" aria-label="Предыдущий трек">${ICM.prev}</button><button type="button" class="mplay" id="mp" aria-label="${isPlay ? "Пауза" : "Играть"}">${isPlay ? ICM.pause : ICM.play}</button><button type="button" class="ib nav" id="mnext" aria-label="Следующий трек">${ICM.next}</button>
            <button type="button" class="ib${r !== "none" ? " on" : ""}" id="mrep" aria-label="Повтор: ${REP_LABEL[r]}">${ICM.rep}${r === "one" ? '<span class="badge">1</span>' : r !== "none" ? '<i class="rdot"></i>' : ""}</button></div></div>`;
        if (el._h === html) return; el._h = html; el.innerHTML = html;
        $("#mp").onclick = () => {
          if (isPlay) stopMusic();
          else if (on && M.cur === t.id && audio.currentTime > 0) playTrack(t.id);
          else start(t.id);
          draw();
        };
        const ms = $("#ms");
        ms.oninput = () => { M.drag = true; ms.style.setProperty("--p", (ms.value / ms.max * 100) + "%"); };
        ms.onchange = () => { try { audio.currentTime = Number(ms.value); } catch (e) {} M.drag = false; el._h = ""; paint(); };
        ms.addEventListener("pointerup", () => { if (M.drag) ms.onchange(); });
        const step = (k) => {
          const L = pq.length ? pq : q; if (!L.length) return;
          let i = L.findIndex((x) => x.id === t.id); if (i < 0) i = 0;
          if (k < 0 && isPlay && audio.currentTime > 5) { audio.currentTime = 0; return; }
          const nx = L[(i + k + L.length) % L.length]; M.sel = nx.id;
          if (isPlay) { playTrack(nx.id, true); } else if (on) { audio.pause(); M.cur = null; NOW.kind = null; }
          haptic(); draw();
        };
        $("#mprev").onclick = () => step(-1); $("#mnext").onclick = () => step(1);
        $("#mrep").onclick = () => { st.repeat = { list: "one", one: "none", none: "list" }[r]; save(); haptic(); toast(REP_LABEL[st.repeat]); paint(); };
        $("#mtmr").onclick = () => timerSheet(draw);
      };
      paint();
    };
    draw();
  }

  // ---------- подкасты: экраны ----------
  const epNext = (id, k) => { const e = epById(id); if (!e) return null; const L = e.series.episodes.filter((x) => x.src); const i = L.findIndex((x) => x.id === id); const n = L[i + k]; return n ? epById(n.id) : null; };
  const POD_TH = (se) => V27 + (se && se.single ? "Podkasty-3.webp" : "Podkasty-2.webp");
  function Pods() {
    setBg("Podkasty-1.webp", { light: true, pos: "78% 100%" });
    const cont = EPS.filter((e) => e.src && !podSt(e.id).done && podSt(e.id).pos > 5).sort((a, b) => (podSt(b.id).at || 0) - (podSt(a.id).at || 0))[0];
    let h = `<div class="stack pd-main" style="gap:18px">${back("#/lib", "Бухта")}<h1>Подкасты</h1>`;
    if (cont) { const st = podSt(cont.id); h += `<a class="pd-cont" href="#/ep/${cont.id}"><img src="${POD_TH(cont.series)}" alt=""><span class="t"><span class="cap">Продолжить</span><b>${esc(cont.title)}</b><span class="pd-bar"><i style="width:${Math.min(100, (st.pos / cont.dur) * 100).toFixed(0)}%"></i></span><span class="small" style="font-size:12px">осталось ${Math.max(1, Math.round((cont.dur - st.pos) / 60))} мин</span></span><span class="pd-play">${ICN_PLAY}</span></a>`; }
    if (!PODS.length) h += `<p class="lead">Подкасты появятся после подключения.</p>`;
    h += `<div class="pd-gap" id="pdgap"></div><div class="cap pd-cap" id="pdcap">Серии и выпуски</div><div class="stack" style="gap:8px">`;
    PODS.forEach((se) => {
      if (se.single) { h += se.episodes.map((e) => `<a class="pd-row" href="#/ep/${e.id}"><img src="${e.cover || POD_TH(se)}" alt=""><span class="t"><b>${esc(e.title)}</b><span class="small">выпуск${e.dur ? " · " + Math.round(e.dur / 60) + " мин" : ""}</span></span>${icon.chev}</a>`).join(""); return; }
      const n = se.episodes.filter((e) => e.n).length || se.episodes.length, d = se.episodes.filter((e) => podSt(e.id).done).length;
      h += `<a class="pd-row" href="#/series/${se.id}"><img src="${POD_TH(se)}" alt=""><span class="t"><b>${esc(se.title)}</b><span class="row" style="gap:8px"><span class="cy-dots ink">${Array.from({ length: Math.min(n, 8) }, (_, i) => `<i class="${i < d ? "on" : ""}"></i>`).join("")}</span><span class="small" style="font-size:12px">${d} из ${n}</span></span></span>${icon.chev}</a>`;
    });
    app.innerHTML = h + `</div></div>`;
    // список начинается у берега (около 60% высоты экрана) и листается дальше на светлый песок
    const gap = $("#pdgap"), capEl = $("#pdcap");
    if (gap && capEl) { const y = capEl.getBoundingClientRect().top + scrollY - gap.offsetHeight; gap.style.height = Math.max(20, Math.round(innerHeight * 0.6 - y)) + "px"; }

  }
  function Series(sid) {
    const se = PODS.find((x) => x.id === sid); if (!se) return go("#/pod");
    setBg("PodkastVypusk-1.webp", { light: true, top: true });
    const cur = se.episodes.find((e) => e.src && !podSt(e.id).done);
    let h = `<img class="cy-hero" src="${V27}Podkasty-2.webp" alt=""><div class="stack" style="gap:18px">${back("#/pod", "Подкасты")}<div style="height:calc(min(100vw,520px) * .62)"></div>
      <div class="scr-h"><div class="cap">${esc(se.kicker || "Серия")}</div><h1>${esc(se.title)}</h1>${se.desc ? `<p>${esc(se.desc)}</p>` : ""}<span class="small">${se.episodes.length} выпусков · письменная практика к каждому</span></div>
      ${se.order ? `<div class="card" style="font-size:13px;line-height:1.5">${esc(se.order)}</div>` : ""}
      <div class="stack" style="gap:8px">`;
    se.episodes.forEach((e) => {
      const st = podSt(e.id), soon = !e.src, isCur = cur && cur.id === e.id;
      const meta = soon ? "скоро" : Math.round(e.dur / 60) + " мин";
      const inner = `<span class="pr-i${st.done ? "" : isCur ? " on" : " lk"}">${st.done ? ICN_CHECK : soon ? (e.n || "") : ICN_PLAY}</span><span class="t"><b>${esc(e.title)}</b><span>${esc(e.sub || "")}${e.sub ? " · " : ""}${meta}${!st.done && st.pos > 5 ? " · с " + fmt(st.pos) : ""}</span></span>`;
      h += soon ? `<div class="pr-row off">${inner}</div>` : `<a class="pr-row${isCur ? " cur" : ""}" href="#/ep/${e.id}">${inner}</a>`;
    });
    app.innerHTML = h + `</div></div>`;
  }
  const ICN_PREV = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h2v14H6zM20 5v14L9 12z"/></svg>', ICN_NEXT = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 5h2v14h-2zM4 5v14l11-7z"/></svg>';
  function Episode(id) {
    const e = epById(id); if (!e || !e.src) return go("#/pod");
    setBg("PodkastVypusk-1.webp", { light: true, top: true });
    const se = e.series, st = podSt(id), nStage = se.episodes.filter((x) => x.n).length;
    app.innerHTML = `<img class="cy-hero" src="${V27}Podkasty-2.webp" alt=""><div class="stack" style="gap:18px">${se.single ? back("#/pod", "Подкасты") : back("#/series/" + se.id, "Подкасты")}<div style="height:calc(min(100vw,520px) * .62)"></div>
      <div class="scr-h"><div class="cap">${se.single ? "Выпуск" : esc(se.title) + (e.n ? " · " + e.n + " из " + nStage : " · вводный")}</div><h1>${esc(e.title)}</h1>${e.desc ? `<p>${esc(e.desc)}</p>` : ""}</div>
      <div class="pd-pl" id="pp-box"></div>
      <div id="prac"></div></div>`;
    paint = () => {
      const box = $("#pp-box"); if (!box) return;
      const mine = NOW.kind === "pod" && NOW.id === id && audio.src;
      const d = (mine && audio.duration) || e.dur, c = mine ? audio.currentTime || 0 : st.done ? 0 : st.pos || 0;
      const playing = mine && !audio.paused, rate = S.podRate || 1, pv = epNext(id, -1), nx = epNext(id, 1);
      const html = `<input id="eps" type="range" min="0" max="${Math.floor(d)}" value="${Math.floor(c)}" aria-label="Перемотка"><div class="times"><span>${fmt(c)}</span><span>−${fmt(Math.max(0, d - c))}</span></div>
        <div class="pd-c"><button class="pd-s" id="eprate" aria-label="Скорость">${String(rate).replace(".", ",")}×</button><button class="pd-s" id="epv" aria-label="Предыдущий выпуск" ${pv ? "" : "disabled"}>${ICN_PREV}</button><button class="pd-pp" id="epp" aria-label="${playing ? "Пауза" : "Слушать"}">${playing ? icon.pause : icon.play}</button><button class="pd-s" id="epn" aria-label="Следующий выпуск" ${nx ? "" : "disabled"}>${ICN_NEXT}</button><button class="pd-tg${S.podAuto ? " on" : ""}" id="epauto" role="switch" aria-checked="${!!S.podAuto}" aria-label="Автопереключение выпусков"><i></i></button></div>`;
      if (box._h === html) return; box._h = html; box.innerHTML = html;
      $("#epp").onclick = () => { if (playing) { audio.pause(); podSave(true); } else playEp(id); paint(); };
      $("#epv").onclick = () => pv && go("#/ep/" + pv.id); $("#epn").onclick = () => nx && go("#/ep/" + nx.id);
      $("#epauto").onclick = () => { S.podAuto = !S.podAuto; save(); toast(S.podAuto ? "Следующий выпуск включится сам" : "Автопереключение выключено"); paint(); };
      $("#eprate").onclick = () => { const rs = [1, 1.25, 1.5, 0.75], n2 = rs[(rs.indexOf(rate) + 1) % rs.length]; S.podRate = n2; save(); if (mine) audio.playbackRate = n2; paint(); };
      $("#eps").onchange = (ev) => { const v = Number(ev.target.value); if (mine) audio.currentTime = v; else { st.pos = v; st.done = false; save(); } paint(); };
    };
    paint();
    drawPractice(e);
  }
  // письменная практика к выпуску: ответы сохраняются сами
  // {женская|мужская} форма в текстах практик — по обращению из анкеты
  const gw = (t) => String(t || "").replace(/\{([^{}|]*)\|([^{}|]*)\}/g, (_, f, m) => { const g = S.profile && S.profile.gender; return g === "f" ? f : g === "m" ? m : f + " или " + m; });
  function drawPractice(e) {
    const box = $("#prac"); if (!box) return;
    const P = e.practice, st = podSt(e.id), A = st.ans || (st.ans = {});
    if (!P) { box.innerHTML = e.noPractice ? `<div class="small center">${esc(e.noPractice)}</div>` : ""; return; }
    const part = Math.min(A._part || 0, P.parts.length - 1), pt = P.parts[part];
    const ta = (k, ph, rows) => `<textarea data-a="${k}" rows="${rows || 3}" placeholder="${esc(ph || "Первое, что приходит…")}">${esc(A[k] || "")}</textarea>`;
    const stepHead = (n, s) => `<div class="sn pq"><b><span class="pqn">${n}.</span> ${esc(gw(s.q))}</b></div>${s.hint ? `<div class="hint pqh">${esc(gw(s.hint))}</div>` : ""}${s.fromEp && epById(s.fromEp) ? `<a class="small" href="#/ep/${esc(s.fromEp)}" style="color:var(--blue);text-decoration:underline">Мои ответы к выпуску «${esc(epById(s.fromEp).title)}»</a>` : ""}`;
    const bansOf = (ans) => ((ans && ans.roles) || []).map((x) => (x.b || "").trim()).filter(Boolean);
    const opened = box.dataset.open === "1";
    let h = `<div class="card pd-pr"><button type="button" class="pd-prh" id="prtog" aria-expanded="${opened}"><span class="pd-pri"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20l4-1 11-11-3-3L5 16z"/></svg></span><span class="t"><b>Письменная практика</b><span>${esc(P.title || "к этому выпуску")}${P.mins ? " · " + esc(P.mins) : ""}</span></span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true" style="transform:rotate(${opened ? 180 : 0}deg)"><path d="M6 9l6 6 6-6"/></svg></button>`;
    if (!opened) { box.innerHTML = h + `</div>`; $("#prtog").onclick = () => { box.dataset.open = "1"; drawPractice(e); }; return; }
    h += `<div class="stack" style="gap:22px;margin-top:8px">`;
    if (P.parts.length > 1) h += `<div class="seg2 ptabs">${P.parts.map((x, i) => `<a href="#" data-part="${i}" class="${i === part ? "on" : ""}">${i + 1}. ${esc(x.tab || x.title)}</a>`).join("")}</div>`;
    if (pt.intro) h += `<p class="lead" style="font-size:14px">${esc(gw(pt.intro))}</p>`;
    pt.steps.forEach((s, i) => {
      const k = "p" + part + "s" + i;
      h += `<div class="stack" style="gap:10px">${stepHead(i + 1, s)}`;
      if (s.type === "roles") {
        const rows = (A.roles && A.roles.length ? A.roles : [{ r: "", b: "" }]);
        h += `<div class="stack" style="gap:6px"><div class="rgrid lbl"><span>РОЛЬ</span><span>ЧТО В НЕЙ НЕЛЬЗЯ</span></div>
          ${rows.map((x, j) => `<div class="rgrid"><input class="inp" data-ri="${j}" data-rf="r" value="${esc(x.r)}" placeholder="роль…"><input class="inp terra" data-ri="${j}" data-rf="b" value="${esc(x.b)}" placeholder="нельзя…"></div>`).join("")}
          <button type="button" class="dash-btn" id="addrole">+ Еще роль</button></div>`;
      } else if (s.type === "bans") {
        const b = bansOf(A);
        h += b.length ? `<div class="chips bans">${b.map((x) => `<span class="chip terra sm">${esc(x)}</span>`).join("")}</div>` : `<div class="empty-box">Здесь соберутся запреты из твоих ролей</div>`;
        h += ta(k, s.ph);
      } else if (s.type === "list") {
        const L = A.traits || [];
        h += `${s.examples ? `<div class="hint">Например: ${s.examples.map((x) => "«" + esc(x) + "»").join(", ")}</div>` : ""}
          ${L.length ? `<div class="chips">${L.map((x, j) => `<button type="button" class="chip sm" data-del="${j}" aria-label="Убрать">${esc(x)} ×</button>`).join("")}</div>` : ""}
          <div class="row"><input class="inp" id="trin" placeholder="${esc(s.ph || "Что раздражает…")}" maxlength="80"><button type="button" class="pill" id="tradd" style="min-height:48px">Добавить</button></div>`;
      } else if (s.type === "traits") {
        const L = A.traits || [];
        if (s.example) h += `<div class="hint">${esc(s.example)}</div>`;
        h += L.length ? L.map((x, j) => `<div class="card" style="background:var(--card2);gap:8px"><b>«${esc(x)}»</b>
            <span class="small">${esc(s.l1 || "Где это есть во мне?")}</span>${ta("me" + j, "даже чуть-чуть…", 2)}
            <span class="small" style="color:var(--sage-l)">${esc(s.l2 || "Золото — если взять в своей мере")}</span><textarea class="gold" data-a="gold${j}" rows="2" placeholder="что полезного в этом качестве?">${esc(A["gold" + j] || "")}</textarea></div>`).join("")
          : `<div class="empty-box">Сначала выпиши черты в шаге ${i}</div>`;
      } else if (s.type === "fromEp") {
        const src = epById(s.ep), b = bansOf(src && podSt(s.ep).ans);
        h += `<div class="card terra" style="gap:10px"><span class="small hint-terra" style="letter-spacing:.04em">ИЗ ПРАКТИКИ «${esc((src && src.title || "").toUpperCase())}»</span>
          ${b.length ? `<div class="chips">${b.map((x) => `<span class="chip terra sm">${esc(x)}</span>`).join("")}</div>` : `<span class="small">Запретов пока нет. <a href="#/ep/${esc(s.ep)}" style="color:var(--blue);text-decoration:underline">Открыть практику</a></span>`}</div>` + ta(k, s.ph);
      } else {
        h += s.line ? `<input class="inp" data-a="${k}"${s.dated ? " data-dated=\"1\"" : ""} value="${esc(A[k] || "")}" placeholder="${esc(gw(s.ph || ""))}">` : ta(k, gw(s.ph), s.rows);
        if (s.dated && A[k]) h += `<span class="small">Пункт договора от ${esc(A[k + "_d"] || new Date().toLocaleDateString("ru-RU"))}</span>`;
      }
      h += `</div>`;
    });
    if (pt.outro) h += `<p class="quote">${esc(gw(pt.outro))}</p>`;
    if (P.parts.length > 1 && part < P.parts.length - 1) h += `<a href="#" class="link-row" data-part="${part + 1}"><span class="stack" style="gap:3px"><b>Часть ${part + 2}. ${esc(P.parts[part + 1].title)}</b>${P.parts[part + 1].lead ? `<span class="small" style="font-weight:400">${esc(P.parts[part + 1].lead)}</span>` : ""}</span>${icon.chev}</a>`;
    if (P.quote) h += `<p class="quote">${esc(P.quote)}</p>`;
    if (P.link) h += `<button type="button" class="card blue linkcard" id="plink"><span class="t"><b>${esc(P.link.title)}</b><span class="small">${esc(P.link.sub)}</span></span>${icon.chev}</button>`;
    if (P.note) h += `<div class="row small" style="align-items:flex-start"><span style="flex-shrink:0;margin-top:2px">${icon.checkS}</span><span>${esc(P.note)}</span></div>`;
    box.innerHTML = h + `</div></div>`;
    $("#prtog").onclick = () => { box.dataset.open = ""; drawPractice(e); };
    // события
    let deb;
    const store = () => { clearTimeout(deb); deb = setTimeout(save, 400); };
    box.querySelectorAll("[data-a]").forEach((t) => t.oninput = () => { A[t.dataset.a] = t.value; if (t.dataset.dated && !A[t.dataset.a + "_d"]) A[t.dataset.a + "_d"] = new Date().toLocaleDateString("ru-RU"); store(); });
    box.querySelectorAll("[data-part]").forEach((b) => b.onclick = (ev) => { ev.preventDefault(); A._part = Number(b.dataset.part); save(); drawPractice(e); box.scrollIntoView({ behavior: "smooth" }); });
    box.querySelectorAll("[data-ri]").forEach((t) => t.oninput = () => {
      A.roles = A.roles && A.roles.length ? A.roles : [{ r: "", b: "" }];
      const j = Number(t.dataset.ri); A.roles[j] = A.roles[j] || { r: "", b: "" }; A.roles[j][t.dataset.rf] = t.value; store();
      const bx = box.querySelector(".bans") || box.querySelector(".empty-box");
      if (t.dataset.rf === "b" && bx) { const b = bansOf(A); const n = document.createElement("div"); n.innerHTML = b.length ? `<div class="chips bans">${b.map((x) => `<span class="chip terra sm">${esc(x)}</span>`).join("")}</div>` : `<div class="empty-box">Здесь соберутся запреты из твоих ролей</div>`; bx.replaceWith(n.firstChild); }
    });
    const ar = $("#addrole"); if (ar) ar.onclick = () => { A.roles = (A.roles && A.roles.length ? A.roles : [{ r: "", b: "" }]); A.roles.push({ r: "", b: "" }); save(); drawPractice(e); const ins = box.querySelectorAll('[data-rf="r"]'); ins[ins.length - 1].focus(); };
    const tin = $("#trin"), tad = $("#tradd");
    if (tad) { const add = () => { const v = tin.value.trim(); if (!v) return; A.traits = (A.traits || []).concat(v); save(); drawPractice(e); const n = $("#trin"); if (n) n.focus(); }; tad.onclick = add; tin.onkeydown = (ev) => { if (ev.key === "Enter") add(); }; }
    box.querySelectorAll("[data-del]").forEach((b) => b.onclick = () => { const j = Number(b.dataset.del); A.traits.splice(j, 1); ["me", "gold"].forEach((p) => { for (let x = j; x < 50; x++) A[p + x] = A[p + (x + 1)]; }); save(); drawPractice(e); });
    const pl = $("#plink"); if (pl) pl.onclick = () => { if (P.link.href) go(P.link.href); else toast("Цикл появится позже"); };
  }

  // ---------- тело: где отозвалось ----------
  const ELL = "M78 32a22 25 0 1 0 44 0a22 25 0 1 0 -44 0Z", NECK = "M92 59h16a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-16a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3Z";
  const ZONES = {
    front: [
      ["head", "голова", ELL, "head"], ["throat", "горло", NECK, "throat"],
      ["rsh", "правое плечо", "M64 78L80 75L80 92L74 100L52 98Q54 82 64 78Z", "shoulder"], ["lsh", "левое плечо", "M136 78L120 75L120 92L126 100L148 98Q146 82 136 78Z", "shoulder"],
      ["chest", "грудь", "M82 75L118 75L118 92L124 101L124 140L76 140L76 101L82 92Z", "chest"], ["belly", "живот", "M74 142L126 142L124 180L76 180Z", "belly"], ["pelvis", "низ живота", "M76 182L124 182L126 214L100 226L74 214Z", "pelvis"],
      ["rarm", "правая рука", "M48 102L70 104L66 150L47 149Z", "arm"], ["relb", "правый локоть", "M47 153L66 154L65 168L46 167Z", "arm"], ["rfa", "правое предплечье", "M46 171L65 172L60 218L44 216Z", "arm"], ["rhand", "правая кисть", "M44 220L60 222L60 242Q54 252 46 248Q40 240 42 230Z", "hand"],
      ["larm", "левая рука", "M152 102L130 104L134 150L153 149Z", "arm"], ["lelb", "левый локоть", "M153 153L134 154L135 168L154 167Z", "arm"], ["lfa", "левое предплечье", "M154 171L135 172L140 218L156 216Z", "arm"], ["lhand", "левая кисть", "M156 220L140 222L140 242Q146 252 154 248Q160 240 158 230Z", "hand"],
      ["rthigh", "правое бедро", "M74 216L98 226L97 282L76 282Q71 250 74 216Z", "thigh"], ["rknee", "правое колено", "M76 286L97 286L97 306L77 306Z", "knee"], ["rshin", "правая голень", "M77 310L97 310L95 380L81 380Z", "shin"], ["rfoot", "правая стопа", "M81 384L95 384L96 400Q96 408 88 408L74 408Q69 404 76 398Z", "foot"],
      ["lthigh", "левое бедро", "M126 216L102 226L103 282L124 282Q129 250 126 216Z", "thigh"], ["lknee", "левое колено", "M124 286L103 286L103 306L123 306Z", "knee"], ["lshin", "левая голень", "M123 310L103 310L105 380L119 380Z", "shin"], ["lfoot", "левая стопа", "M119 384L105 384L104 400Q104 408 112 408L126 408Q131 404 124 398Z", "foot"]
    ],
    back: [
      ["nape", "затылок", ELL, "nape"], ["neckb", "шея сзади", NECK, "neckb"],
      ["lblade", "левая лопатка", "M64 78L98 75L98 128L74 128L72 100L52 98Q54 82 64 78Z", "blade"], ["rblade", "правая лопатка", "M136 78L102 75L102 128L126 128L128 100L148 98Q146 82 136 78Z", "blade"],
      ["midback", "середина спины", "M74 132L126 132L125 168L75 168Z", "midback"], ["lower", "поясница", "M75 172L125 172L124 196L76 196Z", "lower"], ["sacrum", "крестец", "M76 200L124 200L127 230Q114 240 100 232Q86 240 73 230Z", "sacrum"],
      ["lthb", "левое бедро сзади", "M73 234Q86 244 98 236L97 300L77 300Q71 270 73 234Z", "thigh"], ["rthb", "правое бедро сзади", "M127 234Q114 244 102 236L103 300L123 300Q129 270 127 234Z", "thigh"],
      ["lcalf", "левая икра", "M77 304L97 304L95 380L81 380Z", "shin"], ["rcalf", "правая икра", "M123 304L103 304L105 380L119 380Z", "shin"]
    ]
  };
  const BACK_GHOST = ["M50 100L70 104L60 218L44 216Z", "M44 220L60 222L60 242Q54 252 46 248Q40 240 42 230Z", "M150 100L130 104L140 218L156 216Z", "M156 220L140 222L140 242Q146 252 154 248Q160 240 158 230Z", "M81 384L95 384L96 400Q96 408 88 408L74 408Q69 404 76 398Z", "M119 384L105 384L104 400Q104 408 112 408L126 408Q131 404 124 398Z"];
  const ZQ = {
    head: "О чем думается без остановки? Что хочется перестать обдумывать?", throat: "Что осталось несказанным? Кому это хочется сказать?",
    shoulder: "Что лежит на плечах? Это твое или чье-то?", chest: "Что сейчас в сердце? Чему здесь тесно, а чему просторно?",
    belly: "Что не удается переварить? Что тревожит изнутри?", pelvis: "Что здесь живет: желание, страх, сила? Чему не дают места?",
    arm: "Что хочется взять, а что оттолкнуть?", hand: "Что хочется удержать, а что отпустить?",
    thigh: "Куда хочется двинуться? Что держит на месте?", knee: "Где приходится уступать или прогибаться?",
    shin: "Хватает ли сил идти дальше? Что не дает остановиться?", foot: "На что ты опираешься? Где сейчас твоя опора?",
    nape: "Что осталось за спиной, но продолжает думаться?", neckb: "Что приходится нести, склонив голову?",
    blade: "Что за спиной давит, хотя его не видно?", midback: "На что опирается спина? Что держит тебя прямо?",
    lower: "Не держится ли на тебе слишком многое? Кто поддерживает тебя?", sacrum: "Что дает тебе устойчивость? Чего для нее не хватает?"
  };
  const SENSES = ["тяжесть", "напряжение", "тепло", "холод", "легкость", "пустота", "покалывание", "сжатие", "дрожь"];
  const zoneById = (z) => ZONES.front.concat(ZONES.back).find((x) => x[0] === z);
  if (!S.catches) S.catches = [];
  function bodyHost(kind, key) {
    if (kind === "c") { const c = S.catches[Number(key)]; return c ? { obj: c, back: "#/caught/" + key, title: "Где " + c.word + " в теле?" } : null; }
    const p = prac(key); if (!p) return null;
    const n = S.notes[key] || (S.notes[key] = { image: "", feelings: [], own: [], stand: "" });
    return { obj: n, back: "#/after/" + key, title: "В каких частях тело отозвалось?" };
  }
  const silImg = (side) => V27 + ((S.profile && S.profile.gender === "f") ? (side === "back" ? "Telo1b-1.webp" : "Telo1-1.webp") : (side === "back" ? "Siluety-2.webp" : "Siluety-1.webp"));
  // точки силуэта в координатах картинки 520×780 (вид спереди: правая сторона человека слева)
  const ZPT = { head: [258, 60, 40, 46], throat: [258, 128, 22, 16], rsh: [185, 180, 30, 24], lsh: [330, 180, 30, 24], chest: [258, 215, 52, 36], belly: [258, 290, 48, 34], pelvis: [258, 365, 54, 30],
    rarm: [172, 248, 18, 38], relb: [160, 302, 16, 16], rfa: [146, 350, 16, 30], rhand: [120, 422, 22, 30], larm: [344, 248, 18, 38], lelb: [356, 302, 16, 16], lfa: [370, 350, 16, 30], lhand: [398, 422, 22, 30],
    rthigh: [220, 462, 30, 52], rknee: [213, 560, 22, 20], rshin: [210, 640, 20, 48], rfoot: [198, 745, 26, 18], lthigh: [298, 462, 30, 52], lknee: [305, 560, 22, 20], lshin: [308, 640, 20, 48], lfoot: [318, 745, 26, 18],
    nape: [258, 55, 40, 44], neckb: [258, 125, 20, 16], lblade: [215, 210, 32, 32], rblade: [300, 210, 32, 32], midback: [258, 265, 45, 28], lower: [258, 320, 50, 24], sacrum: [258, 372, 45, 24], lthb: [225, 480, 32, 58], rthb: [292, 480, 32, 58], lcalf: [222, 620, 22, 48], rcalf: [295, 620, 22, 48] };
  const bodyFig = (side, zs, isOn, attr) => `<div class="bfig"><img src="${silImg(side)}" alt=""><svg class="bodysvg2" viewBox="0 0 520 780" role="img" aria-label="Силуэт ${side === "front" ? "спереди" : "со спины"}"><defs><radialGradient id="zglow"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".95"/><stop offset=".3" stop-color="#B9A6FF" stop-opacity=".85"/><stop offset="1" stop-color="#7C64D8" stop-opacity="0"/></radialGradient></defs>${zs.filter((z) => isOn(z[0])).map((z) => { const q = ZPT[z[0]] || [258, 390, 30, 30]; return `<ellipse class="zg" cx="${q[0]}" cy="${q[1]}" rx="${Math.max(q[2], 28) * 1.3}" ry="${Math.max(q[3], 22) * 1.1}" fill="url(#zglow)"/>`; }).join("")}${zs.map((z) => { const q = ZPT[z[0]] || [258, 390, 30, 30]; return `<ellipse class="zone2${isOn(z[0]) ? " on" : ""}" ${attr}="${z[0]}" cx="${q[0]}" cy="${q[1]}" rx="${q[2]}" ry="${q[3]}"><title>${z[1]}</title></ellipse>`; }).join("")}</svg></div>`;
  function Body(kind, key, side) {
    const H0 = bodyHost(kind, key); if (!H0) return go("#/");
    side = side === "back" ? "back" : "front";
    const B = H0.obj.body || (H0.obj.body = {});
    const zs = ZONES[side], marked = Object.keys(B);
    const svg = bodyFig(side, zs, (z) => !!B[z], "data-z");
    app.innerHTML = `<div class="stack" style="gap:12px;padding-bottom:190px">
      <div class="row" style="justify-content:space-between"><a class="back" href="${H0.back}" aria-label="Закрыть"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9FB2C8" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></a>
        <div class="seg2 mini2"><a href="#/body/${kind}/${key}/front" class="${side === "front" ? "on" : ""}">Спереди</a><a href="#/body/${kind}/${key}/back" class="${side === "back" ? "on" : ""}">Сзади</a></div></div>
      <div class="stack" style="gap:4px"><h1 style="font-size:24px">${esc(H0.title)}</h1><div class="small">${side === "front" ? "Коснись участка — появится окно с ощущением и вопросом" : "Руки и стопы отмечаются спереди"}</div></div>
      <div class="bodywrap"><span style="left:6px">${side === "front" ? "правая" : "левая"}</span><span style="right:6px">${side === "front" ? "левая" : "правая"}</span>${svg}</div>
    </div>
    <div class="bodybar">${marked.length ? `<div class="chips">${marked.map((z) => { const zz = zoneById(z); return zz ? `<button type="button" class="chip terra sm" data-z="${z}">${esc(zz[1])}</button>` : ""; }).join("")}</div>` : ""}
      <a class="btn" href="${H0.back}" id="bdone">${marked.length ? "Готово · " + marked.length + " " + plural(marked.length, "место", "места", "мест") : "Готово"}</a>
      <button type="button" class="link-row" id="quiet" style="justify-content:center;border:none;color:var(--muted);font-weight:500;min-height:36px;padding:4px">Тело молчит</button></div>`;
    app.querySelectorAll("[data-z]").forEach((el) => el.onclick = () => zoneSheet(kind, key, side, el.dataset.z));
    $("#quiet").onclick = () => { H0.obj.body = {}; H0.obj.bodyQuiet = true; save(); go(H0.back); };
    $("#bdone").onclick = () => { H0.obj.bodyQuiet = false; save(); };
  }
  const plural = (n, a, b, c) => { const m = n % 10, mm = n % 100; return m === 1 && mm !== 11 ? a : m >= 2 && m <= 4 && (mm < 10 || mm >= 20) ? b : c; };
  function zoneSheet(kind, key, side, z) {
    const H0 = bodyHost(kind, key), zz = zoneById(z); if (!H0 || !zz) return;
    const B = H0.obj.body || (H0.obj.body = {});
    const cur = Object.assign({ sense: [], own: "", ans: "" }, B[z] || {});
    const bg = document.createElement("div"); bg.className = "sheet-bg";
    document.body.appendChild(bg);
    const close = () => bg.remove();
    bg.onclick = (ev) => { if (ev.target === bg) close(); };
    const step1 = () => {
      bg.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="grip"></div>
        <div class="row" style="justify-content:space-between"><h2 style="font-size:20px">${esc(zz[1][0].toUpperCase() + zz[1].slice(1))}</h2><span class="small">1 из 2</span></div>
        <b style="font-size:16px;font-weight:600">Какое ощущение здесь?</b>
        <div class="chips">${SENSES.concat((S.ownSense || []).filter((x) => !SENSES.includes(x))).map((s) => `<button type="button" class="chip${cur.sense.includes(s) ? " terraon" : ""}" data-s="${esc(s)}">${esc(s)}</button>`).join("")}</div>
        <div class="row"><input class="inp" id="sown" placeholder="+ свое ощущение" maxlength="30"><button type="button" class="pill" id="sownb" style="min-height:48px">Добавить</button></div>
        <button class="btn" id="snext">Дальше</button>
        ${B[z] ? `<button type="button" class="link-row" id="sdel" style="justify-content:center;border:none;color:var(--muted);font-weight:500;min-height:36px">Убрать отметку</button>` : ""}</div>`;
      bg.querySelectorAll("[data-s]").forEach((b) => b.onclick = () => { const s = b.dataset.s, i = cur.sense.indexOf(s); i >= 0 ? cur.sense.splice(i, 1) : cur.sense.push(s); b.classList.toggle("terraon"); });
      const addOwn = () => { const v = bg.querySelector("#sown").value.trim().toLowerCase(); if (!v) return false; S.ownSense = Array.from(new Set((S.ownSense || []).concat(v))); if (!cur.sense.includes(v)) cur.sense.push(v); save(); return true; };
      bg.querySelector("#sownb").onclick = () => { if (addOwn()) step1(); };
      bg.querySelector("#sown").onkeydown = (e) => { if (e.key === "Enter" && addOwn()) step1(); };
      bg.querySelector("#snext").onclick = () => { addOwn(); cur.own = ""; step2(); };
      const d = bg.querySelector("#sdel"); if (d) d.onclick = () => { delete B[z]; save(); close(); Body(kind, key, side); };
    };
    const step2 = () => {
      const tag = cur.sense.concat(cur.own ? [cur.own] : []).join(", ");
      bg.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="grip"></div>
        <div class="row" style="justify-content:space-between"><div class="row" style="gap:8px;flex-wrap:wrap"><button type="button" class="back" id="sback" aria-label="Назад к ощущению" style="min-height:36px">${icon.back}</button><h2 style="font-size:20px">${esc(zz[1][0].toUpperCase() + zz[1].slice(1))}</h2>${tag ? `<span class="chip terra sm">${esc(tag)}</span>` : ""}</div><span class="small">2 из 2</span></div>
        <div style="font-size:21px;font-weight:800;line-height:1.3">${esc(ZQ[zz[3]] || "Что здесь происходит?")}</div>
        <textarea id="sans" rows="4" placeholder="Первое, что приходит…">${esc(cur.ans)}</textarea>
        <div class="row"><button class="btn ghost" id="sskip" style="flex:1">Пропустить</button><button class="btn" id="ssave" style="flex:2">Сохранить</button></div></div>`;
      bg.querySelector("#sback").onclick = () => { cur.ans = bg.querySelector("#sans").value; step1(); };
      const fin = (withAns) => { cur.ans = withAns ? bg.querySelector("#sans").value.trim() : cur.ans; cur.at = now(); B[z] = cur; H0.obj.bodyQuiet = false; save(); haptic(); close(); Body(kind, key, side); };
      bg.querySelector("#sskip").onclick = () => fin(false);
      bg.querySelector("#ssave").onclick = () => fin(true);
    };
    step1();
  }
  const bodyChips = (o) => {
    if (!o) return "";
    if (o.bodyQuiet) return `<span class="small">Тело молчало</span>`;
    const ks = Object.keys(o.body || {}); if (!ks.length) return "";
    return `<div class="chips">${ks.map((z) => { const zz = zoneById(z); const b = o.body[z]; return zz ? `<span class="chip terra sm">${esc(zz[1])}${b.sense && b.sense.length ? " · " + esc(b.sense.join(", ")) : ""}</span>` : ""; }).join("")}</div>`;
  };

  // ---------- если плохо: назвать чувство ----------
  const CATCH = {
    up: { title: "Энергия вверх", q: "Чего хочется больше?", sub: "Не думай долго — что ближе прямо сейчас.", simple: ["кипит", "жжет", "трясет", "распирает"],
      opts: [
        { id: "attack", t: "Напасть, оттолкнуть, высказать все", s: "кулаки сжаты, хочется что-то швырнуть", h: "Похоже на злость", w: ["злость", "раздражение", "ярость", "бешенство", "негодование", "возмущение", "досада", "презрение", "ненависть", "ревность", "зависть", "отвращение", "неприязнь"] },
        { id: "flee", t: "Убежать, спрятаться, спастись", s: "сердце колотится, хочется, чтобы это закончилось", h: "Похоже на страх", w: ["страх", "испуг", "ужас", "тревога", "беспокойство", "опасение", "боязнь", "подозрение", "оцепенение", "ошарашенность"] },
        { id: "restless", t: "Не могу усидеть на месте", s: "все дрожит, но непонятно, куда деть", h: "Похоже на тревогу", w: ["тревога", "беспокойство", "истерия", "раздражение", "досада", "возмущение", "опасение", "ошарашенность"] }
      ] },
    down: { title: "Энергия вниз", q: "А что с людьми?", sub: "Представь, что рядом кто-то близкий. Что хочется?", simple: ["тяжело", "щемит", "колет", "пусто"],
      opts: [
        { id: "toward", t: "Тянет к ним", s: "хочется, чтобы пришли, обняли, спросили, что случилось", h: "Похоже на грусть или обиду", w: ["обида", "грусть", "печаль", "тоска", "горечь", "разочарование", "сожаление", "жалость", "одиночество", "отчаяние", "беспомощность", "душевная боль"] },
        { id: "away", t: "Хочется закрыть дверь", s: "сделать вид, что тебя не существует", h: "Похоже на стыд или вину", w: ["стыд", "вина", "унижение", "отчужденность", "застенчивость", "растерянность", "загнанность", "сломленность"] },
        { id: "none", t: "Ничего не хочется", s: "ни к людям, ни от них — просто нет сил", h: "Похоже на бессилие", w: ["безнадежность", "беспомощность", "отрешенность", "отчаяние", "тоска", "скука", "лень", "загнанность", "сломленность"] }
      ] }
  };
  const FEEL_UP = ["бешенство", "ярость", "ненависть", "истерия", "злость", "раздражение", "презрение", "негодование", "ревность", "зависть", "досада", "возмущение", "отвращение", "неприязнь", "ужас", "испуг", "тревога", "беспокойство", "боязнь", "подозрение", "оцепенение", "ошарашенность", "опасение"];
  const FEEL_DOWN = ["горечь", "тоска", "скорбь", "печаль", "жалость", "отчаяние", "безнадежность", "беспомощность", "душевная боль", "разочарование", "сожаление", "отчужденность", "скука", "лень", "отрешенность", "загнанность", "стыд", "вина", "унижение", "обида", "растерянность", "застенчивость", "сломленность"];
  const arrow = (dir) => `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${dir === "up" ? "#F0C7B5" : "#8CC4E8"}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${dir === "up" ? '<path d="M12 19V5M5 12l7-7 7 7"/>' : '<path d="M12 5v14M5 12l7 7 7-7"/>'}</svg>`;
  function Gate() {
    app.innerHTML = `<div class="stack">${back("#/aid", "Аптечка")}
      <div class="stack" style="gap:6px"><div class="kicker terra">Если плохо</div><h1>Накрыло сейчас или тянется давно?</h1><p class="lead" style="font-size:14px">Это разное — и помогает разное.</p></div>
      <a class="choice terra" href="#/catch"><span class="t"><b>Накрыло сейчас</b><span>жжет, кипит, сжимает — ярко и прямо сейчас</span><span class="meta">1–2 минуты · назвать чувство</span></span>${icon.chev}</a>
      <a class="choice" href="#/deep"><span class="t"><b>Тянется давно</b><span>фон, туман, «что-то не так», но непонятно что</span><span class="meta">10–15 минут · через образ</span></span>${icon.chev}</a>
      <p class="small center">Сложно выбрать? Начни с первого — оттуда можно перейти ко второму.</p></div>`;
  }
  // ---------- «Тянется давно» — путь через образ: время года → погода → воспоминание → чего не хватало → здесь и сейчас ----------
  if (!S.deep) S.deep = [];
  const SEASONS = {
    winter: { t: "Зима", bg: "#1F3654", c: "#C3D0DE", w: ["солнце", "ясно", "мороз", "снегопад", "метель", "слякоть", "серость", "гололед"],
      ic: (n) => `<svg width="${n}" height="${n}" viewBox="0 0 64 64" aria-hidden="true"><path d="M32 10v44M13 21l38 22M51 21L13 43" stroke="#C3D0DE" stroke-width="3" stroke-linecap="round" fill="none"/><path d="M26 14l6 6 6-6M26 50l6-6 6 6M14 29l8-2-2-8M50 35l-8 2 2 8M50 29l-8-2 2-8M14 35l8 2-2 8" stroke="#C3D0DE" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>` },
    spring: { t: "Весна", bg: "#24382F", c: "#A9CBB3", w: ["солнце", "гроза", "ветер", "капель", "цветение", "радуга", "тепло", "туман", "оттепель", "слякоть"],
      ic: (n) => `<svg width="${n}" height="${n}" viewBox="0 0 64 64" aria-hidden="true"><path d="M32 56V30" stroke="#8FB39A" stroke-width="3" stroke-linecap="round" fill="none"/><path d="M32 40c-10 0-16-6-16-14 9 0 16 5 16 14ZM32 34c0-10 6-16 16-16 0 10-6 16-16 16Z" fill="#24382F" stroke="#A9CBB3" stroke-width="3" stroke-linejoin="round"/></svg>` },
    summer: { t: "Лето", bg: "#33262A", c: "#F0C7B5", w: ["солнце", "зной", "теплый дождь", "духота", "звездная ночь", "закат", "безоблачно"],
      ic: (n) => `<svg width="${n}" height="${n}" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="11" fill="#C9775A"/><path d="M32 8v7M32 49v7M8 32h7M49 32h7M15 15l5 5M44 44l5 5M15 49l5-5M44 20l5-5" stroke="#F0C7B5" stroke-width="3" stroke-linecap="round" fill="none"/></svg>` },
    autumn: { t: "Осень", bg: "#2A2830", c: "#F0C7B5", w: ["солнце", "листопад", "затяжной дождь", "туман", "заморозки", "ветер", "слякоть", "бабье лето"],
      ic: (n) => `<svg width="${n}" height="${n}" viewBox="0 0 64 64" aria-hidden="true"><path d="M16 48C16 26 30 14 50 14c0 22-12 34-34 34Z" fill="#33262A" stroke="#C9775A" stroke-width="3" stroke-linejoin="round"/><path d="M16 48L40 24M26 38h8M32 32v-7" stroke="#C9775A" stroke-width="2.4" stroke-linecap="round" fill="none"/></svg>` }
  };
  const deepLine = (d) => SEASONS[d.season] ? SEASONS[d.season].t + (d.weather && d.weather.length ? " · " + d.weather.join(", ") : "") : "";
  const steps = (n) => `<div class="dsteps" aria-label="Шаг ${n} из 5">${[1, 2, 3, 4, 5].map((i) => `<span class="${i <= n ? "on" : ""}"></span>`).join("")}</div>`;
  const SEA_IMG = { winter: "Nikuda1-1.webp", spring: "Nikuda1-3.webp", summer: "Nikuda1-4.webp", autumn: "Nikuda1-5.webp" };
  const dsteps = (n) => `<div class="dsteps2" aria-label="Шаг ${n} из 4">${[1, 2, 3, 4].map((i) => `<i class="${i <= n ? "on" : ""}"></i>`).join("")}</div>`;
  function Deep(step, arg) {
    const D = S.deepDraft || (S.deepDraft = {});
    const Z = SEASONS[D.season];
    if (step === "done") return DeepDone(arg);
    const cap = `<div class="cap">Ничего не чувствую · через образ</div>`;
    if (!step || !Z) {
      setBg("Segodnya5m-1.webp", { pos: "0% 0" });
      app.innerHTML = `<div class="stack" style="gap:14px">${back("#/catch", "Назад")}${dsteps(1)}
        <div class="scr-h">${cap}<h1>Какое время года сейчас внутри?</h1><p>Первое, что приходит. Без правильного ответа.</p></div>
        <div class="sea4">${["winter", "spring", "summer", "autumn"].map((k) => `<button type="button" class="seac" data-se="${k}"><img class="seac-f" src="${V27}Nikuda1-2.webp" alt=""><img class="seac-i" src="${V27}${SEA_IMG[k]}" alt=""><img class="seac-r" src="${V27}Segodnya5m-4.webp" alt=""><b>${SEASONS[k].t}</b></button>`).join("")}</div></div>`;
      app.querySelectorAll("[data-se]").forEach((b) => b.onclick = () => { S.deepDraft = { season: b.dataset.se, weather: [], at: now() }; save(); go("#/deep/2"); });
      return;
    }
    setBg(SEA_IMG[D.season], { light: true });
    if (step === "2") {
      const own = (D.weather || []).filter((w) => !Z.w.includes(w));
      app.innerHTML = `<div class="stack" style="gap:16px">${back("#/deep", "Времена года")}${dsteps(2)}
        <div class="scr-h">${cap}<h1>${Z.t}. Какая здесь погода?</h1></div>
        <div class="chips">${Z.w.concat(own).map((w) => `<button type="button" class="chip${D.weather.includes(w) ? " on" : ""}" data-w="${esc(w)}">${esc(cap1(w))}</button>`).join("")}<button type="button" class="chip add" id="wadd">+ свой вариант</button></div>
        <div class="row" id="wbox" style="gap:8px;display:none"><input class="inp" id="wown" maxlength="30" placeholder="Своя погода"><button type="button" class="btn" id="wok" style="width:auto;padding:0 18px;height:48px">OK</button></div>
        <button class="btn" id="next"${D.weather.length ? "" : " disabled"}>Дальше</button></div>`;
      app.querySelectorAll("[data-w]").forEach((b) => b.onclick = () => { const w = b.dataset.w, i = D.weather.indexOf(w); if (i < 0) D.weather.push(w); else D.weather.splice(i, 1); save(); Deep("2"); });
      $("#wadd").onclick = () => { $("#wbox").style.display = "flex"; $("#wown").focus(); };
      $("#wok").onclick = () => { const w = $("#wown").value.trim().toLowerCase(); if (w && !D.weather.includes(w)) D.weather.push(w); save(); Deep("2"); };
      $("#next").onclick = () => go("#/deep/3");
      return;
    }
    if (step === "3") {
      app.innerHTML = `<div class="stack" style="gap:16px">${back("#/deep/2", Z.t)}${dsteps(3)}
        <div class="scr-h">${cap}<h1>${esc(cap1(deepLine(D).replace(" · ", ", ")))}</h1></div>
        <b class="qb">Какое воспоминание или образ приходит с этой погодой?</b>${vta("mem", D.mem, "", 6)}
        <button class="btn" id="next"${(D.mem || "").trim() ? "" : " disabled"}>Дальше</button>
        <button type="button" class="center" id="none" style="background:none;border:none;padding:8px 0;font:500 14px var(--font);color:inherit;text-decoration:underline;text-underline-offset:4px">Ничего не пришло — останемся в самой погоде</button>
        <a href="#/aid" class="small center" style="padding:4px 0">Если воспоминание тяжелое — Аптечка</a></div>`;
      bindMics();
      const m = $("#mem"); m.oninput = () => { D.mem = m.value; save(); $("#next").disabled = !m.value.trim(); };
      $("#next").onclick = () => go("#/deep/4");
      $("#none").onclick = () => { D.mem = ""; save(); go("#/deep/4"); };
      return;
    }
    if (step === "4") {
      const hasMem = (D.mem || "").trim();
      app.innerHTML = `<div class="stack" style="gap:16px">${back("#/deep/3", "Образ")}${dsteps(4)}
        <div class="scr-h">${cap}<h1>${hasMem ? "В этом образе" : "В самой погоде"}</h1></div>
        <b class="qb">${hasMem ? "Чего тебе не хватало в этом образе или воспоминании?" : "Чего тебе не хватает в этой погоде?"}</b>${vta("lack", D.lack, "", 3)}
        <b class="qb">${hasMem ? "Что тогда хотелось?" : "Чего хочется в ней?"}</b>${vta("want", D.want, "", 3)}
        <button class="btn" id="next">Дальше</button></div>`;
      bindMics();
      const l = $("#lack"), w = $("#want"), nx = $("#next"), upd = () => { D.lack = l.value; D.want = w.value; save(); nx.disabled = !(l.value.trim() || w.value.trim()); };
      l.oninput = upd; w.oninput = upd; nx.disabled = !((D.lack || "").trim() || (D.want || "").trim());
      nx.onclick = () => go("#/deep/5");
      return;
    }
    if (step === "5") {
      const found = [D.lack && "Не хватало: " + D.lack.trim(), D.want && "Хотелось: " + D.want.trim()].filter(Boolean).map((x) => `<span>${esc(x)}</span>`).join("");
      app.innerHTML = `<div class="stack" style="gap:16px">${back("#/deep/4", "Назад")}${dsteps(4)}
        <div class="scr-h">${cap}<h1>Обратно в сегодня</h1></div>
        ${found ? `<div class="card found"><div class="cap">Найдено в образе</div>${found}</div>` : ""}
        <b class="qb">Где этому есть место в сегодняшнем дне?</b>${vta("nowt", D.now, "Одно маленькое действие или человек…", 4)}
        <button class="btn" id="next">Сохранить в Мою карту</button>
        <a class="center" href="#/ask" style="padding:6px 0;font-weight:500;font-size:14px">Поделиться с Настей</a></div>`;
      bindMics();
      const t = $("#nowt"); t.oninput = () => { D.now = t.value; save(); };
      $("#next").onclick = () => {
        const rec = { at: now(), season: D.season, weather: D.weather.slice(), mem: (D.mem || "").trim(), lack: (D.lack || "").trim(), want: (D.want || "").trim(), now: (D.now || "").trim() };
        S.deep.push(rec); S.deepDraft = null; save(); haptic(); toast("Сохранено в Мою карту"); go("#/deep/done/" + (S.deep.length - 1));
      };
      return;
    }
    go("#/deep");
  }
  function DeepDone(i) {
    const d = S.deep[Number(i)];
    if (!d) return go("#/notes");
    app.innerHTML = `<div class="stack">${back("#/", "Сегодня")}
      <div class="stack center" style="gap:10px;padding:16px 0 4px;align-items:center">
        <svg width="72" height="72" viewBox="0 0 72 72" fill="none" aria-hidden="true"><circle cx="36" cy="36" r="34" fill="rgba(245,238,228,.16)" stroke="rgba(245,232,217,.4)"/><path d="M24 37l8 8 16-17" stroke="#F5E8D9" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <div class="small">${esc(deepLine(d))}</div><h1>Запись готова</h1><p class="lead" style="font-size:14px;max-width:300px">Образ сказал о сегодняшнем дне. Можно вернуться к нему позже — он сохранится.</p></div>
      <label class="choice" style="cursor:pointer"><span class="t"><b>Сохранить в «Моя карта»</b><span id="dsv" style="color:var(--sage-l)">${d.off ? "не сохранено" : "Сохранено"}</span></span><input type="checkbox" id="dkeep" role="switch"${d.off ? "" : " checked"} style="width:22px;height:22px;accent-color:#8FB39A"></label>
      <a class="choice" href="#/feels"><span class="t"><b>Назвать чувство словом</b><span>таблица чувств — если хочется имени</span></span>${icon.chev}</a>
      <a class="choice" href="#/ask"><span class="t"><b>Поделиться с Настей</b><span>вопрос о том, что открылось</span></span>${icon.chev}</a>
      <a class="btn" href="#/">На сегодня достаточно</a></div>`;
    $("#dkeep").onchange = (e) => { d.off = !e.target.checked; save(); $("#dsv").textContent = d.off ? "не сохранено" : "Сохранено"; };
  }
  function DeepView(i) {
    const d = S.deep[Number(i)]; if (!d) return go("#/notes");
    const F = [["mem", "Воспоминание или образ"], ["lack", "Тогда не хватало"], ["want", "Тогда хотелось"], ["now", "В моей жизни сейчас"]];
    app.innerHTML = `<div class="stack">${back("#/notes", "Моя карта")}<div class="kicker">${dayLabel(d.at)} · через образ</div><h1>${esc(deepLine(d))}</h1>
      ${F.map(([k, l]) => `<label class="stack" style="gap:6px"><span class="kicker">${l}</span><textarea data-f="${k}" rows="3" maxlength="2000">${esc(d[k] || "")}</textarea></label>`).join("")}
      <button class="btn" id="dsv2">Сохранить</button>
      <button type="button" class="link-row" id="ddel" style="justify-content:center;color:var(--muted)">Удалить запись</button></div>`;
    $("#dsv2").onclick = () => { app.querySelectorAll("[data-f]").forEach((t) => { d[t.dataset.f] = t.value.trim(); }); save(); haptic(); toast("Сохранено"); go("#/notes"); };
    $("#ddel").onclick = () => { d.off = true; save(); go("#/notes"); };
  }

  function Catch(dir, opt) {
    if (!dir) {
      app.innerHTML = `<div class="stack">${back("#/gate", "Назад")}
        <div class="stack" style="gap:6px"><div class="kicker terra">Накрыло сейчас · назвать чувство</div><h1>Плохо, а что — не понять?</h1><p class="lead" style="font-size:14px">Это не пустота, а клубок из нескольких чувств, сваренных в один суп. Распутаем за три шага.</p></div>
        <div class="note-p"><img src="${V27}Integraciya-1.webp" alt=""><span>Закрой глаза на 10 секунд и почувствуй:<br><b>куда течет энергия?</b></span></div>
        <a class="choice" href="#/catch/up"><span class="ic on">${arrow("up")}</span><span class="t"><b>Вверх</b><span>хочется кричать, бежать, что-то швырнуть</span></span>${icon.chev}</a>
        <a class="choice" href="#/catch/down"><span class="ic">${arrow("down")}</span><span class="t"><b>Вниз</b><span>хочется выключиться, свернуться, под одеяло</span></span>${icon.chev}</a>
        <a class="choice dashed" href="#/deep"><span class="t"><b>Никуда — ничего не чувствую</b><span>замерло, пусто, не понимаю, о чем речь</span></span>${icon.chev}</a>
        <a class="center" href="#/feels" style="padding:12px 0;font-size:14px;font-weight:500;text-decoration:underline;text-underline-offset:4px">Не понимаю — покажи всю таблицу</a></div>`;
      return;
    }
    const D = CATCH[dir]; if (!D) return go("#/catch");
    if (!opt) {
      app.innerHTML = `<div class="stack">${back("#/catch", "Назад")}
        <div class="stack" style="gap:6px"><div class="kicker ${dir === "up" ? "terra" : ""}">${D.title}</div><h1>${D.q}</h1><p class="lead" style="font-size:14px">${D.sub}</p></div>
        ${D.opts.map((o) => `<a class="choice${dir === "up" ? " terra" : ""}" href="#/catch/${dir}/${o.id}"><span class="t"><b>${o.t}</b><span>${o.s}</span></span>${icon.chev}</a>`).join("")}</div>`;
      return;
    }
    const O = D.opts.find((o) => o.id === opt); if (!O) return go("#/catch/" + dir);
    let pick = "";
    app.innerHTML = `<div class="stack">${back("#/catch/" + dir, "Назад")}
      <div class="stack" style="gap:6px"><div class="kicker">${dir === "up" ? "Вверх" : "Вниз"} · ${O.t.toLowerCase()}</div><h1>${O.h}</h1><p class="lead" style="font-size:14px">Выбери любое слово, что откликается. Необязательно снайперски точно — важно, чтобы у чувства появилось имя.</p></div>
      <div class="chips" id="ws">${O.w.map((w) => `<button type="button" class="chip" data-w="${w}">${w}</button>`).join("")}</div>
      <div class="small">Или проще — тоже подойдет</div>
      <div class="chips">${D.simple.map((w) => `<button type="button" class="chip" data-w="${w}">${w}</button>`).join("")}</div>
      <input class="inp" id="wown" placeholder="Свое слово" maxlength="40">
      <button class="btn" id="wok" disabled>Это оно</button></div>`;
    const ok = $("#wok"), own = $("#wown");
    app.querySelectorAll("[data-w]").forEach((b) => b.onclick = () => { pick = b.dataset.w; own.value = ""; app.querySelectorAll("[data-w]").forEach((x) => x.classList.toggle("terraon", x === b)); ok.disabled = false; });
    own.oninput = () => { if (own.value.trim()) { pick = ""; app.querySelectorAll("[data-w]").forEach((x) => x.classList.remove("terraon")); } ok.disabled = !(pick || own.value.trim()); };
    ok.onclick = () => caught(own.value.trim().toLowerCase() || pick, dir, opt);
  }
  function caught(word, dir, branch) {
    S.catches.push({ at: now(), word, dir, branch: branch || "" }); save(); haptic();
    go("#/caught/" + (S.catches.length - 1));
  }
  function Feels() {
    const block = (dir, title, sub, list) => `<div class="card ${dir === "up" ? "terra" : "blue"}" style="gap:12px"><div class="row">${arrow(dir)}<div class="stack" style="gap:2px"><b style="font-size:17px">${title}</b><span class="small">${sub}</span></div></div>
      <div class="chips">${list.map((w) => `<button type="button" class="chip sm" data-fw="${w}" data-dir="${dir}">${w}</button>`).join("")}</div></div>`;
    app.innerHTML = `<div class="stack">${back("#/catch", "Назад")}
      <div class="stack" style="gap:6px"><h1>Таблица чувств</h1><p class="small">Найди свою сторону, а потом слово. Нажми на слово — оно сохранится.</p></div>
      ${block("up", "Вверх", "хочется кричать, бежать, действовать", FEEL_UP)}${block("down", "Вниз", "хочется свернуться, исчезнуть, спрятаться", FEEL_DOWN)}</div>`;
    app.querySelectorAll("[data-fw]").forEach((b) => b.onclick = () => caught(b.dataset.fw, b.dataset.dir, "table"));
  }
  function Caught(i) {
    const c = S.catches[Number(i)]; if (!c) return go("#/");
    app.innerHTML = `<div class="stack">${back("#/", "Сегодня")}
      <div class="stack center" style="gap:10px;padding:18px 0;align-items:center">
        <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="27" fill="#24382F"/><path d="M18 29l7 7 13-15" fill="none" stroke="#A9CBB3" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <div class="kicker" style="color:var(--sage);letter-spacing:.08em;font-weight:700">ИМЯ ЕСТЬ</div>
        <div style="font-size:34px;font-weight:800">${esc(c.word)}</div>
        <p class="lead">Теперь это не «просто плохо», а чувство, с которым можно быть.</p></div>
      <div class="kicker" style="letter-spacing:.08em">СЕЙЧАС</div>
      <a class="choice terra" href="#/body/c/${i}/front"><span class="t"><b>Где ${esc(c.word)} в теле?</b><span>отметить на силуэте</span></span>${icon.chev}</a>
      ${bodyChips(c)}
      <div class="choice dashed" style="opacity:.75"><span class="t"><b>Побыть с этим чувством</b><span>практика · скоро</span></span></div>
      <div class="kicker" style="letter-spacing:.08em;margin-top:6px">КОГДА СТАНЕТ ТИШЕ</div>
      <a class="choice" href="#/deep" style="background:#1F3654;border-color:#3A5578"><span class="t"><b>Посмотреть на это через образ</b><span>острое прошло — а откуда оно? Время года, погода, воспоминание</span></span>${icon.chev}</a>
      <button type="button" class="link-row" id="cfix" style="justify-content:center;color:var(--muted)">Исправить слово</button>
      <a class="btn ghost" href="#/">На главную</a></div>`;
    $("#cfix").onclick = () => { const b = $("#cfix"); b.outerHTML = `<div class="row" style="gap:8px"><input class="inp" id="cw" maxlength="40" value="${esc(c.word)}"><button type="button" class="btn" id="cws" style="width:auto;padding:12px 16px">OK</button></div>`; $("#cw").focus(); $("#cws").onclick = () => { const v = $("#cw").value.trim().toLowerCase(); if (v) { c.word = v; save(); toast("Исправлено"); } Caught(i); }; };
  }


  // ---------- день: «Как ты?», сон, символ дня ----------
  const dkey = (ts) => { const d = new Date(ts || now()); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  if (!S.days) S.days = {}; if (!S.dreams) S.dreams = {}; if (!S.sym) S.sym = {};
  const today = () => S.days[dkey()] || (S.days[dkey()] = { zones: {}, feel: {}, want: [], before: [] });
  const isNight = () => { const h = new Date(now()).getHours(); return h >= 22 || h < 5; };
  // время суток для цвета воды: утро · день · вечер · ночь
  const phase = () => { const h = new Date(now()).getHours(); return h >= 22 || h < 5 ? "night" : h < 11 ? "morning" : h < 17 ? "day" : "evening"; };
  const PAL = {
    morning: [[0, "#F2D3CB"], [13, "#B9D5D6"], [30, "#5E93AE"], [55, "#24456B"], [80, "#13284A"], [100, "#0B1728"]],
    day: [[0, "#CFEAF0"], [14, "#9CCFDC"], [32, "#4F8DB0"], [56, "#24456B"], [80, "#13284A"], [100, "#0B1728"]],
    evening: [[0, "#D9BFD3"], [14, "#A7A6C8"], [32, "#56769F"], [56, "#22406A"], [80, "#13284A"], [100, "#0B1728"]],
    night: [[0, "#1A2F50"], [30, "#13284A"], [70, "#0E1F38"], [100, "#081220"]]
  };
  const SUN = { morning: "rgba(255,241,236,.8)", day: "rgba(255,255,255,.55)", evening: "rgba(244,222,236,.6)", night: "rgba(207,230,245,.14)" };
  const DECK = (C.deck && C.deck.cards) || [];
  const cardById = (id) => DECK.find((c) => c.id === id);
  const ICN = {
    body: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0F1E33" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="5" r="2.5"/><path d="M12 8v7M8 11h8M10 21l2-6 2 6"/></svg>',
    moon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0F1E33" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
    card: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0F1E33" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="3" width="12" height="18" rx="2"/><circle cx="12" cy="12" r="3"/></svg>'
  };
  const zoneTitle = (z) => { const x = zoneById(z); return x ? x[1] : z; };
  function daySummary(k) {
    k = k || dkey();
    const d = S.days[k], parts = [];
    if (d && d.quiet) parts.push("тело спокойно");
    if (d && d.zones) { const zs = Object.keys(d.zones).slice(0, 2).map(zoneTitle); if (zs.length) parts.push(zs.join(", ")); }
    if (d && d.feel && (d.feel.shade || d.feel.base || d.feel.own)) parts.push(d.feel.own || d.feel.shade || d.feel.base);
    const sy = S.sym[k]; if (sy && cardById(sy.id)) parts.push("символ «" + cardById(sy.id).title + "»");
    if (S.dreams[k] && S.dreams[k].text) parts.push("сон записан");
    return parts.join(" · ");
  }
  const insideRows = () => {
    const sy = S.sym[dkey()], d = S.days[dkey()];
    const row = (href, ic, t, sub) => `<a class="in-row" href="${href}"><span class="ic">${ic}</span><span class="t"><b>${t}</b><span>${sub}</span></span>${icon.chev}</a>`;
    return row("#/today", ICN.body, "Что в теле и внутри", d && d.done ? "сегодня: " + esc(daySummary().split(" · символ")[0] || "отмечено") : "ощущения, чувства · 1–2 мин") +
      row("#/dream", ICN.moon, "Что снилось?", S.dreams[dkey()] && S.dreams[dkey()].text ? "сон записан" : "запиши, пока не растаял") +
      row("#/symbol", ICN.card, "Символ дня", sy && cardById(sy.id) ? "сегодня: " + esc(cardById(sy.id).title.toLowerCase()) : "вытянуть карту");
  };
  function todayBlock() {
    let h = "";
    if (isNight()) h += `<a class="night" href="#/music"><svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true" style="flex-shrink:0"><circle cx="22" cy="22" r="21" fill="#0F1E33"/><path d="M28 27.5A9 9 0 1 1 18.5 15a7 7 0 0 0 9.5 12.5z" fill="#CFE6F5"/><circle cx="31" cy="13" r="1.2" fill="#E8EEF4"/><circle cx="12" cy="31" r="1" fill="#E8EEF4" opacity=".7"/></svg>
      <span class="t"><span class="small">Если сложно заснуть</span><b>Музыкальное сопровождение</b><span class="small" style="color:var(--blue)">${mset().timer ? "таймер " + mset().timer + " мин · " : ""}можно свернуть</span></span>${icon.chev}</a>`;
    const d = S.days[dkey()];
    if (d && d.done) {
      h += `<a class="done-row" href="#/inside"><span class="ok">${icon.check}</span><span class="t"><b>Заглянуть в себя</b><span>сегодня: ${esc(daySummary())}</span></span>${icon.chev}</a>`;
    } else {
      h += `<div class="howcard"><svg class="rings" width="140" height="140" viewBox="0 0 140 140" aria-hidden="true"><circle cx="70" cy="70" r="60"/><circle cx="70" cy="70" r="42"/><circle cx="70" cy="70" r="24"/></svg>
        <div class="stack" style="gap:6px;padding:0 4px"><span class="kicker" style="color:var(--sage-l);letter-spacing:.08em;font-weight:700">СЕГОДНЯ</span><span style="font-size:30px;font-weight:800;line-height:1.1">Как ты?</span><span style="font-size:14px;color:#D3E4D8">С чего хочется начать?</span></div>
        ${insideRows()}</div>`;
    }
    return h;
  }
  function Inside() {
    const sy = S.sym[dkey()], D = S.days[dkey()], c = sy && cardById(sy.id);
    app.innerHTML = `<div class="stack">${back("#/", "Сегодня")}<h1>Заглянуть в себя</h1><div class="howcard" style="padding-top:14px">${insideRows()}</div>
      ${c && D && D.done ? `<div class="card blue" style="gap:10px;padding:18px"><span class="lbl">СВЯЗЬ ДНЯ</span><div style="font-size:15px;line-height:1.55">Сегодня выпал символ <b>«${esc(c.title)}»</b>. А внутри: ${esc(daySummary().split(" · символ")[0])}.</div><label class="q"><b>Есть ли между ними связь?</b><textarea id="lnk" rows="2" placeholder="Первое, что приходит…">${esc(D.link || "")}</textarea></label></div>` : ""}</div>`;
    const l = $("#lnk"); if (l) l.oninput = () => { D.link = l.value; save(); };
  }
  // «Как я сегодня»: тело → ощущение → чувство → хочется → откуда
  const SENS_GROUPS = [["Давление", ["тяжесть", "давит", "сжатие", "ком", "зажим", "стянуто", "тесно", "тянет", "распирание", "будто что-то держит"]], ["Температура", ["тепло", "жар", "горячая волна", "жжение", "холод", "прохлада", "озноб"]], ["Движение", ["дрожь", "пульсация", "покалывание", "мурашки", "вибрация", "щекотка", "трепет", "волны", "колотится", "хочется двигаться"]], ["Пустота", ["пустота", "онемение", "ватность", "провал", "как будто не мое", "почти не чувствую"]], ["Простор", ["легкость", "расслабление", "мягкость", "свобода", "раскрытость", "тепло разливается"]]];
  const FEEL_BASE = { "злость": ["раздражение", "досада", "недовольство", "нетерпение", "гнев", "ярость", "возмущение", "протест", "ревность", "зависть"], "страх": ["тревога", "беспокойство", "волнение", "опасение", "неуверенность", "растерянность", "беззащитность", "испуг", "паника", "ужас"], "грусть": ["печаль", "обида", "одиночество", "тоска", "разочарование", "сожаление", "бессилие", "безнадежность", "горе", "скука"], "стыд": ["вина", "смущение", "неловкость", "уязвимость", "унижение", "никчемность"], "отвращение": ["неприязнь", "брезгливость", "отторжение", "презрение", "пресыщение"], "оцепенение": ["пустота", "безразличие", "апатия", "отстраненность", "ступор", "усталость"], "удивление": ["изумление", "недоумение", "замешательство", "любопытство"], "радость": ["облегчение", "спокойствие", "удовлетворение", "интерес", "воодушевление", "надежда", "гордость", "благодарность", "восторг"], "нежность": ["тепло", "любовь", "забота", "сочувствие", "жалость", "трогательность", "близость", "принятие"] };
  const WANTS = ["отдохнуть", "сказать вслух", "тепла", "тишины", "подвигаться", "поплакать", "чтобы обняли", "выйти на воздух", "побыть в одиночестве"];
  const chipSel = (list, sel, attr, cls) => list.map((x) => `<button type="button" class="chip${sel.includes(x) ? " " + (cls || "terraon") : ""}" data-${attr}="${esc(x)}">${esc(x)}</button>`).join("");
  function Today(step, i) {
    const D = today();
    if (!step) {
      // тело: отметить места
      const side = i === "back" ? "back" : "front", zs = ZONES[side], marked = Object.keys(D.zones);
      app.innerHTML = `<div class="stack" style="gap:12px;padding-bottom:190px">
        <div class="row" style="justify-content:space-between">${back("#/", "Сегодня")}<div class="seg2 mini2"><a href="#/today/body/front" class="${side === "front" ? "on" : ""}">Спереди</a><a href="#/today/body/back" class="${side === "back" ? "on" : ""}">Сзади</a></div></div>
        <div class="scr-h"><h1>Где сегодня откликается тело?</h1><p>Отметь места, где что-то ощущается — напряжение, тепло, пустота</p></div>
        <div class="bodywrap"><span style="left:6px">${side === "front" ? "правая" : "левая"}</span><span style="right:6px">${side === "front" ? "левая" : "правая"}</span>
        ${bodyFig(side, zs, (z) => !!D.zones[z], "data-tz")}</div></div>
        <div class="bodybar">${marked.length ? `<div class="chips">${marked.map((z) => `<span class="chip terra sm">${esc(zoneTitle(z))}</span>`).join("")}</div>` : ""}
          <a class="btn" href="${marked.length ? "#/today/z/0" : "#/today/feel"}">${marked.length ? "Дальше · " + marked.length + " " + plural(marked.length, "место", "места", "мест") : "Дальше"}</a>
          <button type="button" class="link-row" id="calm" style="justify-content:center;border:none;color:var(--muted);font-weight:500;min-height:36px;padding:4px">Сегодня спокойно</button></div>`;
      app.querySelectorAll("[data-tz]").forEach((el) => el.onclick = () => { const z = el.dataset.tz; if (D.zones[z]) delete D.zones[z]; else D.zones[z] = { sense: [], power: "", form: "" }; D.quiet = false; save(); Today("", side); });
      $("#calm").onclick = () => { D.zones = {}; D.quiet = true; save(); go("#/today/feel"); };
      return;
    }
    if (step === "z") {
      const ks = Object.keys(D.zones), n = Number(i) || 0, z = ks[n];
      if (!z) return go("#/today/feel");
      const Z = D.zones[z], name = zoneTitle(z);
      if (M.rubZ !== z) { M.rubZ = z; M.rub = -1; }
      app.innerHTML = `<div class="stack">${back(n ? "#/today/z/" + (n - 1) : "#/today/body/front", n ? "Назад" : "Тело")}
        <div class="stack" style="gap:6px"><div class="kicker terra">${esc(name)} · ${n + 1} из ${ks.length}</div><h1 style="font-size:26px">Как ощущается здесь?</h1><p class="small">Трудно назвать — это нормально. Выбери то, что хоть немного похоже. Можно несколько.</p></div>
        <div class="stack" style="gap:10px"><div class="chips" id="rubs">${SENS_GROUPS.map((g, gi) => { const n = g[1].filter((x) => Z.sense.includes(x)).length; return `<button type="button" class="chip rub${M.rub === gi ? " open" : ""}${n ? " has" : ""}" data-rub="${gi}" aria-expanded="${M.rub === gi}">${g[0]}${n ? " · " + n : ""}<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="${M.rub === gi ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"}"/></svg></button>`; }).join("")}</div>
          ${M.rub >= 0 && SENS_GROUPS[M.rub] ? `<div class="chips rubl">${chipSel(SENS_GROUPS[M.rub][1], Z.sense, "s")}</div>` : `<span class="small" style="font-size:12px">Открой рубрику, чтобы выбрать ощущение</span>`}</div>
        <div class="stack" style="gap:8px"><span class="kicker" style="letter-spacing:.08em;font-size:11px">СВОИ СЛОВА</span>${(S.ownSense || []).length ? `<div class="chips">${chipSel(S.ownSense, Z.sense, "s")}</div>` : ""}
          <div class="row"><input class="inp" id="sadd" placeholder="+ свое ощущение" maxlength="30"><button type="button" class="pill" id="saddb" style="min-height:48px">Добавить</button></div></div>
        <div class="stack" style="gap:8px"><b style="font-size:15px">Насколько сильно</b><div class="seg3">${["едва", "заметно", "очень сильно"].map((x) => `<button type="button" data-pw="${x}" class="${Z.power === x ? "on" : ""}">${x}</button>`).join("")}</div></div>
        <label class="q"><b>Если бы у ощущения была форма или цвет</b><input class="inp" id="form" value="${esc(Z.form)}" placeholder="тугой узел, темно-синий…"></label>
        <a class="btn" href="#/today/z/${n + 1}">Дальше</a></div>`;
      app.querySelectorAll("[data-s]").forEach((b) => b.onclick = () => { const x = b.dataset.s, k = Z.sense.indexOf(x); k >= 0 ? Z.sense.splice(k, 1) : Z.sense.push(x); save(); const y = scrollY; Today("z", String(n)); scrollTo(0, y); });
      app.querySelectorAll("[data-rub]").forEach((b) => b.onclick = () => { const gi = Number(b.dataset.rub); M.rub = M.rub === gi ? -1 : gi; Today("z", String(n)); });
      app.querySelectorAll("[data-pw]").forEach((b) => b.onclick = () => { Z.power = b.dataset.pw; app.querySelectorAll("[data-pw]").forEach((x) => x.classList.toggle("on", x === b)); save(); });
      $("#form").oninput = (e) => { Z.form = e.target.value; save(); };
      const addS = () => { const v = $("#sadd").value.trim().toLowerCase(); if (!v) return; S.ownSense = Array.from(new Set((S.ownSense || []).concat(v))); if (!Z.sense.includes(v)) Z.sense.push(v); save(); Today("z", String(n)); };
      $("#saddb").onclick = addS; $("#sadd").onkeydown = (e) => { if (e.key === "Enter") addS(); };
      return;
    }
    if (step === "feel") {
      const F = D.feel;
      const ks = Object.keys(D.zones);
      const draw = () => {
        app.innerHTML = `<div class="stack">${back(ks.length ? "#/today/z/" + (ks.length - 1) : "#/today", "Назад")}
          <div class="stack" style="gap:6px"><div class="kicker">${ks.length ? esc(ks.map((z) => zoneTitle(z) + (D.zones[z].sense.length ? " · " + D.zones[z].sense.join(", ") : "")).join("; ")) : "Чувство"}</div><h1 style="font-size:26px">Какое чувство рядом${ks.length ? " с этим ощущением" : ""}?</h1><p class="small">Чувства часто смешиваются. Выбери ближайшее — потом можно уточнить оттенок.</p></div>
          <div class="chips">${chipSel(Object.keys(FEEL_BASE), F.base ? [F.base] : [], "fb", "on")}</div>
          ${F.base ? `<div class="stack" style="gap:8px"><b style="font-size:15px">Оттенки — что ближе?</b><div class="chips">${chipSel(FEEL_BASE[F.base].concat(["пока не знаю"]), F.shade ? [F.shade] : [], "fs", "on")}</div></div>` : ""}
          <input class="inp" id="fown" value="${esc(F.own || "")}" placeholder="Свое слово">
          <label class="q"><b>Если бы ощущение могло сказать одну фразу</b><textarea id="fph" rows="2" placeholder="Первое, что приходит…">${esc(F.phrase || "")}</textarea></label>
          <a class="btn" href="#/today/want">Дальше</a></div>`;
        app.querySelectorAll("[data-fb]").forEach((b) => b.onclick = () => { F.base = F.base === b.dataset.fb ? "" : b.dataset.fb; F.shade = ""; save(); draw(); });
        app.querySelectorAll("[data-fs]").forEach((b) => b.onclick = () => { F.shade = F.shade === b.dataset.fs ? "" : b.dataset.fs; save(); draw(); });
        $("#fown").oninput = (e) => { F.own = e.target.value; save(); };
        $("#fph").oninput = (e) => { F.phrase = e.target.value; save(); };
      };
      return draw();
    }
    if (step === "want") {
      const all = WANTS.concat((D.want || []).filter((x) => !WANTS.includes(x)));
      const ks = Object.keys(D.zones), z0 = ks[0], Z0 = z0 && D.zones[z0];
      app.innerHTML = `<div class="stack">${back("#/today/feel", "Чувство")}
        <div class="stack" style="gap:6px"><h1 style="font-size:26px">Чего сейчас хочется?</h1><p class="small">Не обязательно делать — достаточно заметить.</p></div>
        <div class="chips" id="wl">${chipSel(all, D.want, "w", "on")}<button type="button" class="chip add" id="wadd">+ свое</button></div>
        <div class="card" style="background:var(--card2);gap:8px"><span class="kicker" style="letter-spacing:.08em">СЕГОДНЯ</span>
          ${D.quiet ? `<div class="small">тело: спокойно</div>` : Z0 ? `<div style="font-size:14px"><span class="small">тело</span><br>${esc(zoneTitle(z0))}${Z0.sense.length ? " — " + esc(Z0.sense.join(", ")) : ""}${Z0.power ? " · " + esc(Z0.power) : ""}${ks.length > 1 ? `<span class="small"> + еще ${ks.length - 1}</span>` : ""}</div>` : ""}
          ${Z0 && Z0.form ? `<div style="font-size:14px"><span class="small">образ</span><br>${esc(Z0.form)}</div>` : ""}
          ${D.feel.base || D.feel.own ? `<div style="font-size:14px"><span class="small">чувство</span><br>${esc(D.feel.own || (D.feel.base + (D.feel.shade && D.feel.shade !== "пока не знаю" ? " → " + D.feel.shade : "")))}</div>` : ""}</div>
        <a class="btn" href="#/today/origin">Дальше</a></div>`;
      app.querySelectorAll("[data-w]").forEach((b) => b.onclick = () => { const x = b.dataset.w, k = D.want.indexOf(x); k >= 0 ? D.want.splice(k, 1) : D.want.push(x); b.classList.toggle("on"); save(); });
      $("#wadd").onclick = () => { const w = ((window.prompt && window.prompt("Чего хочется?")) || "").trim(); if (w) { D.want.push(w); save(); Today("want"); } };
      return;
    }
    if (step === "origin") {
      const WHEN = ["с утра", "после чего-то", "уже несколько дней", "давно знакомо", "не знаю"], BEF = ["разговор", "встреча", "новость", "мысль", "сон", "ничего особенного"];
      app.innerHTML = `<div class="stack">${back("#/today/want", "Потребность")}
        <div class="stack" style="gap:6px"><h1 style="font-size:26px">Откуда это?</h1><p class="small">Не нужно искать причину. Только то, что замечается.</p></div>
        <div class="stack" style="gap:8px"><b style="font-size:15px">Когда это появилось?</b><div class="chips">${chipSel(WHEN, D.when ? [D.when] : [], "wh", "on")}</div></div>
        <div class="stack" style="gap:8px"><b style="font-size:15px">Что было перед этим?</b><div class="chips">${chipSel(BEF, D.before, "bf", "on")}</div>
          <textarea id="btx" rows="2" placeholder="Пару слов — по желанию">${esc(D.beforeText || "")}</textarea></div>
        <label class="q"><b>Это ощущение знакомо? Какое воспоминание приходит первым?</b><span>Не ищи специально. Если пришло само — запиши пару слов.</span><textarea id="mem" rows="2" placeholder="…">${esc(D.memory || "")}</textarea></label>
        <a class="small" href="#/aid" style="color:var(--terra-l)">Если воспоминание тяжелое — аптечка</a>
        <button class="btn" id="tsave">Сохранить</button></div>`;
      app.querySelectorAll("[data-wh]").forEach((b) => b.onclick = () => { D.when = D.when === b.dataset.wh ? "" : b.dataset.wh; app.querySelectorAll("[data-wh]").forEach((x) => x.classList.toggle("on", x.dataset.wh === D.when)); save(); });
      app.querySelectorAll("[data-bf]").forEach((b) => b.onclick = () => { const x = b.dataset.bf, k = D.before.indexOf(x); k >= 0 ? D.before.splice(k, 1) : D.before.push(x); b.classList.toggle("on"); save(); });
      $("#btx").oninput = (e) => { D.beforeText = e.target.value; save(); };
      $("#mem").oninput = (e) => { D.memory = e.target.value; save(); };
      $("#tsave").onclick = () => { D.done = true; D.at = now(); save(); haptic(); toast("Сохранено. Спасибо, что нашлась минута для себя"); go("#/"); };
      return;
    }
    go("#/today");
  }
  // голос → текст: пишем звук в браузере (PCM 16 кГц), каждые ~25 с отправляем кусок на распознавание; звук не храним
  let VREC = null;
  function voice(btn, lbl, onText) {
    if (VREC) { VREC.stop(); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast("Запись голоса здесь недоступна. Можно надиктовать с клавиатуры — значок микрофона на ней"); return; }
    // iOS: звук пойдет, только если AudioContext создан и запущен прямо в нажатии
    const AC = window.AudioContext || window.webkitAudioContext, ctx = new AC(); try { ctx.resume(); } catch (e) {}
    btn.classList.add("wait"); lbl.textContent = "Включаю микрофон…";
    navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } }).then((stream) => {
      btn.classList.remove("wait");
      const src = ctx.createMediaStreamSource(stream), proc = ctx.createScriptProcessor(4096, 1, 1);
      let buf = [], len = 0, t0 = Date.now(), pending = 0, alive = true, heard = 0, tick = null;
      const flush = (last) => {
        if (!len) { if (last && !pending) done(); return; }
        const sr = ctx.sampleRate, ratio = sr / 16000, all = new Float32Array(len); let o = 0; buf.forEach((b) => { all.set(b, o); o += b.length; }); buf = []; len = 0;
        const n = Math.floor(all.length / ratio), pcm = new Int16Array(n);
        for (let i = 0; i < n; i++) { const v = Math.max(-1, Math.min(1, all[Math.floor(i * ratio)])); pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff; }
        const u8 = new Uint8Array(pcm.buffer); let bin = ""; for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
        pending++; lbl.textContent = "Расшифровываю…";
        gApi({ action: "stt", audio: btoa(bin) }).then((r) => { pending--; if (r.ok && r.j.text) onText(r.j.text); else if (!r.ok) toast("Не получилось расшифровать" + (r.status ? " (" + r.status + (r.j && r.j.status ? "/" + r.j.status : "") + ")" : "")); if (!alive && !pending) done(); else if (alive) lbl.textContent = "Слушаю… нажми, чтобы закончить"; });
      };
      const done = () => { btn.classList.remove("on"); lbl.textContent = "Рассказать голосом"; };
      const mmss = () => { const t = Math.floor((Date.now() - t0) / 1000); return Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0"); };
      proc.onaudioprocess = (e) => { if (!alive) return; const d = e.inputBuffer.getChannelData(0); buf.push(new Float32Array(d)); len += d.length; heard += d.length; if (len / ctx.sampleRate >= 25) flush(false); };
      src.connect(proc); proc.connect(ctx.destination); if (ctx.resume) ctx.resume();
      btn.classList.add("on"); lbl.textContent = "Идет запись 0:00 · нажми, чтобы закончить";
      tick = setInterval(() => { if (alive && !pending) lbl.textContent = "Идет запись " + mmss() + " · нажми, чтобы закончить"; }, 1000);
      VREC = { stop: () => { alive = false; VREC = null; clearInterval(tick); src.disconnect(); proc.disconnect(); stream.getTracks().forEach((x) => x.stop()); ctx.close();
        if (!heard) { buf = []; len = 0; done(); toast("Микрофон не передал звук. Проверь доступ к микрофону для Telegram в настройках телефона"); return; }
        flush(true); if (!pending) done(); } };
      setTimeout(() => { if (VREC && Date.now() - t0 > 5 * 60e3) VREC.stop(); }, 5 * 60e3 + 500);
    }, () => { btn.classList.remove("wait"); lbl.textContent = "Рассказать голосом"; try { ctx.close(); } catch (e) {} toast("Нет доступа к микрофону. Можно надиктовать с клавиатуры — значок микрофона на ней"); });
  }
  function Dream(k0) {
    const k = /^\d{4}-\d{2}-\d{2}$/.test(k0 || "") ? k0 : dkey(), past = k !== dkey();
    const D = S.dreams[k] || (S.dreams[k] = { text: "", images: [], assoc: "", feel: [] });
    const FE = ["любопытство", "тревога", "легкость", "грусть", "покой", "растерянность"];
    const d = new Date(past ? dayTs(k) : now()), mon = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
    const draw = () => {
      const first = D.images[0];
      app.innerHTML = `<div class="stack" style="gap:16px">${past ? back("#/notes", "Моя карта") : back("#/", "Сегодня")}<div class="toppad"></div>
        <div class="scr-h"><div class="cap">Сновидение · ${past ? d.getDate() + " " + mon[d.getMonth()] : WDAY[d.getDay()] + ", " + PH_RU[phase()]}</div><h1>${past ? "Сон" : "Что приснилось?"}</h1><p>Запиши сразу, пока сон не растаял.</p></div>
        ${vta("dtx", D.text, "Сюжет, места, люди — как помнится…", 5)}
        <div class="stack" style="gap:8px"><b class="qb">Образы из сна</b>
          <div class="chips">${D.images.map((x, j) => { const y = symByTitle(x); return `<span class="chip on sm">${y ? `<a href="#/sym/${y.id}" style="text-decoration:underline">${esc(x)}</a>` : esc(x)} <button type="button" data-dx="${j}" aria-label="Убрать" style="background:none;border:none;color:inherit;padding:0 0 0 4px">×</button></span>`; }).join("")}</div>
          <div class="row"><input class="inp" id="dimg" placeholder="образ: дом, дверь, вода…" maxlength="40"><button type="button" class="pill" id="dadd" style="min-height:48px">Добавить</button></div>
          <span class="small" style="font-size:12px">Образ из Словаря символов откроется по нажатию</span></div>
        ${first ? `<label class="q"><b>Что первое приходит, если подумать о «${esc(first)}»?</b><textarea id="das" rows="2" placeholder="Первое, что приходит…">${esc(D.assoc)}</textarea></label>` : ""}
        <div class="stack" style="gap:8px"><b class="qb">Какое чувство осталось после сна?</b><div class="chips">${chipSel(FE.concat(D.feel.filter((x) => !FE.includes(x))), D.feel, "df", "on")}</div></div>
        <button class="btn" id="dsave">Сохранить</button></div>`;
      $("#dtx").oninput = (e) => { D.text = e.target.value; save(); };
      bindMics();
      const das = $("#das"); if (das) das.oninput = (e) => { D.assoc = e.target.value; save(); };
      const add = () => { const v = $("#dimg").value.trim().toLowerCase(); if (!v) return; D.images.push(v); save(); draw(); const n = $("#dimg"); if (n) n.focus(); };
      $("#dadd").onclick = add; $("#dimg").onkeydown = (e) => { if (e.key === "Enter") add(); };
      app.querySelectorAll("[data-dx]").forEach((b) => b.onclick = () => { D.images.splice(Number(b.dataset.dx), 1); save(); draw(); });
      app.querySelectorAll("[data-df]").forEach((b) => b.onclick = () => { const x = b.dataset.df, k = D.feel.indexOf(x); k >= 0 ? D.feel.splice(k, 1) : D.feel.push(x); b.classList.toggle("on"); save(); });
      $("#dsave").onclick = () => { if (!past) D.savedAt = now(); save(); haptic(); toast("Сон записан"); go(past ? "#/notes" : "#/"); };
    };
    draw();
  }
  const cardFace = (c) => `<div class="tcard face" style="--ink:${c.ink};--fade:${c.fade}"><img src="${c.img}" alt="${esc(c.title)}"><i class="fade"></i><i class="line"></i><span class="nm">${esc(c.title.toUpperCase())}</span></div>`;
  // картинка для сторис: карта, вопрос и название приложения
  function shareCard(c) {
    const im = new Image(); im.crossOrigin = "anonymous";
    im.onload = () => {
      const cv = document.createElement("canvas"); cv.width = 1080; cv.height = 1920; const g = cv.getContext("2d");
      const gr = g.createLinearGradient(0, 0, 0, 1920); gr.addColorStop(0, "#24456B"); gr.addColorStop(1, "#0B1728"); g.fillStyle = gr; g.fillRect(0, 0, 1080, 1920);
      g.fillStyle = "#C3D0DE"; g.font = "600 40px Manrope, system-ui, sans-serif"; g.textAlign = "center"; g.fillText("СИМВОЛ ДНЯ", 540, 250);
      const w = 720, h = 1080, x = 180, y = 330; g.save(); g.shadowColor = "rgba(0,0,0,.45)"; g.shadowBlur = 50; g.shadowOffsetY = 20; g.drawImage(im, x, y, w, h); g.restore();
      const fd = g.createLinearGradient(0, y + h * 0.66, 0, y + h); fd.addColorStop(0, "rgba(0,0,0,0)"); fd.addColorStop(1, c.fade || "#0B1728"); g.fillStyle = fd; g.fillRect(x, y + h * 0.66, w, h * 0.34);
      g.strokeStyle = c.ink || "#E8EEF4"; g.globalAlpha = 0.6; g.lineWidth = 2; g.strokeRect(x + 28, y + 28, w - 56, h - 56); g.globalAlpha = 1;
      g.fillStyle = c.ink || "#E8EEF4"; g.font = "800 46px Manrope, system-ui, sans-serif"; g.fillText(c.title.toUpperCase().split("").join(" "), 540, y + h - 70);
      g.fillStyle = "#E8EEF4"; g.font = "700 52px Manrope, system-ui, sans-serif"; g.fillText("Что откликается в тебе", 540, 1560); g.fillText("в этом образе сегодня?", 540, 1630);
      g.fillStyle = "#8CC4E8"; g.font = "700 38px Manrope, system-ui, sans-serif"; g.fillText("Карта Глубины", 540, 1800);
      cv.toBlob((blob) => {
        const file = new File([blob], "simvol-dnya.png", { type: "image/png" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file] }).catch(() => {}); return; }
        const url = URL.createObjectURL(blob), bg = document.createElement("div"); bg.className = "sheet-bg";
        bg.innerHTML = `<div class="sheet" style="align-items:center"><div class="grip"></div><img src="${url}" alt="Символ дня для сторис" style="width:58%;border-radius:12px"><p class="small center">Зажми картинку, чтобы сохранить, или скачай.</p><a class="btn" href="${url}" download="simvol-dnya.png">Скачать</a></div>`;
        bg.onclick = (e) => { if (e.target === bg) bg.remove(); }; document.body.appendChild(bg);
      }, "image/png");
    };
    im.onerror = () => toast("Не получилось собрать картинку");
    im.src = c.img;
  }
  // символ дня: сразу картинка на затемненном экране; нажатие на картинку — словарь, вкладка «Мое»
  function drawSym() {
    let st = S.sym[dkey()];
    if (!st && DECK.length) {
      const prev = S.sym[dkey(now() - 86400000)], pool = DECK.filter((c) => !prev || c.id !== prev.id);
      const c0 = pool[Math.floor(Math.random() * pool.length)];
      st = S.sym[dkey()] = { id: c0.id, at: now(), note: "" }; save(); haptic();
    }
    return st;
  }
  function symOpen() {
    const st = drawSym(); if (!st) { toast("Колода появится после подключения"); return; }
    const c = cardById(st.id) || DECK[0], y = symByTitle(c.title);
    const bg = document.createElement("div"); bg.className = "cview symv";
    bg.innerHTML = `<button type="button" class="cv-x" aria-label="Закрыть">×</button><button type="button" class="symv-c" aria-label="${y ? "Открыть «" + esc(c.title) + "» в словаре" : esc(c.title)}"><img src="${c.img}" alt="Карта: ${esc(c.title)}"></button>`;
    const close = () => { bg.classList.add("out"); setTimeout(() => bg.remove(), 200); };
    bg.querySelector(".cv-x").onclick = close;
    bg.onclick = (e) => { if (e.target === bg) close(); };
    bg.querySelector(".symv-c").onclick = () => { bg.remove(); if (y) go("#/sym/" + y.id + "/moe"); };
    document.body.appendChild(bg);
    if (location.hash.replace(/^#\/?/, "") !== "") { history.replaceState(null, "", "#/"); render(); document.body.appendChild(bg); }
  }
  function SymDay() { history.replaceState(null, "", "#/"); render(); symOpen(); }


  // ---------- «Сегодня» и вкладки ----------
  const TABS = [["", "Сегодня", '<path d="M3 18h18M6 21h12M7 15a5 5 0 0 1 10 0M12 5v3M5 9l1.8 1.4M19 9l-1.8 1.4"/>'], ["lib", "Бухта", '<circle cx="12" cy="5" r="2"/><path d="M12 7v14M8 10h8M4 13a8 8 0 0 0 16 0"/>'], ["guide", "Проводник", '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>'], ["notes", "Моя карта", '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14"/>']];
  const tabsEl = document.getElementById("tabs") || (() => { const d = document.createElement("nav"); d.id = "tabs"; d.setAttribute("aria-label", "Разделы"); document.body.appendChild(d); return d; })();
  const waterEl = document.getElementById("water") || (() => { const d = document.createElement("div"); d.id = "water"; d.setAttribute("aria-hidden", "true"); document.body.insertBefore(d, document.body.firstChild); return d; })();
  const bgEl = document.getElementById("bgill") || (() => { const d = document.createElement("div"); d.id = "bgill"; d.setAttribute("aria-hidden", "true"); document.body.insertBefore(d, document.body.firstChild); return d; })();
  const V27 = "img/v27/";
  // фон экрана: иллюстрация во весь экран (уезжает вместе с содержимым), светлая тема для подкастов и времен года
  function setBg(img, o) {
    o = o || {};
    bgEl.style.backgroundImage = img ? "url(" + V27 + img + ")" : "none";
    bgEl.style.backgroundPosition = o.pos || "50% 0";
    bgEl.classList.toggle("top", !!o.top); bgEl.classList.toggle("shade", /AptTablica|AptVverh|Anketa|Slovar|Arkany|Pogruzheniya-1/.test(img || ""));
    bgEl.style.transform = o.flip ? "scaleX(-1)" : "";
    document.body.classList.toggle("lt", !!o.light);
    try { tg && tg.setHeaderColor && tg.setHeaderColor(o.light ? "#E9DCCB" : "#0F1E33"); } catch (e) {}
  }
  function paintTabs(active) {
    document.body.classList.toggle("tabs", active >= 0);
    if (active < 0) { tabsEl.innerHTML = ""; return; }
    tabsEl.innerHTML = TABS.map(([r, l, p], i) => `<a href="#/${r}" class="${i === active ? "on" : ""}"${i === active ? ' aria-current="page"' : ""}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>${l}</a>`).join("");
  }
  function waterSVG() {
    const H = 844; let seed = 5; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    let b = "";
    for (let i = 0; i < 12; i++) {
      const x = 30 + Math.round(rnd() * 330), r = [1.5, 2, 2.5, 3][Math.floor(rnd() * 4)], d = 10 + Math.round(rnd() * 8), bg = (rnd() * d).toFixed(1);
      b += `<circle cx="${x}" cy="${H - 40}" r="${r}" fill="none" stroke="#CFE6F5" stroke-width="1" opacity="0"><animate attributeName="cy" values="${H - 40};120" dur="${d}s" begin="-${bg}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;.55;.55;0" keyTimes="0;.15;.8;1" dur="${d}s" begin="-${bg}s" repeatCount="indefinite"/></circle>`;
    }
    let weed = "";
    [[28, 120, "#24382F", 0], [48, 160, "#2E4A3C", 1.5], [70, 100, "#24382F", 2.6], [300, 140, "#24382F", .8], [324, 105, "#2E4A3C", 2.2], [350, 170, "#24382F", .3], [368, 120, "#2E4A3C", 1.1]].forEach(([x, hh, c, dl]) => {
      weed += `<path d="M${x} ${H} Q ${x - 12} ${H - hh * .5} ${x} ${H - hh}" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" values="-5 ${x} ${H};5 ${x} ${H};-5 ${x} ${H}" dur="7s" begin="-${dl}s" repeatCount="indefinite"/></path>`;
    });
    const fish = (y, dur, dir, sc, col, delay) => {
      let body = `<g transform="scale(${sc})"><path d="M0 0 q14 -9 28 0 q-14 9 -28 0z" fill="${col}"/><path d="M27 0 l9 -6 v12z" fill="${col}"><animateTransform attributeName="transform" type="scale" values="1 1;1 .6;1 1" dur=".8s" repeatCount="indefinite"/></path><circle cx="6" cy="-1" r="1.3" fill="#0B1728"/></g>`;
      let vals;
      if (dir < 0) { body = `<g transform="scale(-1 1)">${body}</g>`; vals = `-50 ${y};440 ${y - 30}`; } else vals = `440 ${y};-50 ${y + 20}`;
      return `<g opacity=".55"><animateTransform attributeName="transform" type="translate" values="${vals}" dur="${dur}s" begin="-${delay}s" repeatCount="indefinite"/><g><animateTransform attributeName="transform" type="translate" values="0 0;0 -4;0 0" dur="3s" repeatCount="indefinite"/>${body}</g></g>`;
    };
    return `<svg viewBox="0 0 390 ${H}" preserveAspectRatio="xMidYMax slice" width="100%" height="100%">
<defs><linearGradient id="wray" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#CFE6F5" stop-opacity="0"/><stop offset=".3" stop-color="#CFE6F5" stop-opacity=".10"/><stop offset="1" stop-color="#CFE6F5" stop-opacity="0"/></linearGradient></defs>
<polygon points="110,0 150,0 230,${H} 130,${H}" fill="url(#wray)"><animate attributeName="opacity" values=".5;1;.5" dur="10s" repeatCount="indefinite"/></polygon><polygon points="230,0 258,0 330,${H} 262,${H}" fill="url(#wray)" opacity=".7"><animate attributeName="opacity" values="1;.4;1" dur="13s" repeatCount="indefinite"/></polygon>
${fish(520, 38, 1, 1, "#8CC4E8", 5)}${fish(600, 52, -1, .7, "#A9CBB3", 20)}${fish(440, 64, 1, .55, "#F0C7B5", 40)}
${b}</svg>`;
  }
  // дно — в самом конце прокрутки, под любым по длине экраном
  const bedEl = document.getElementById("bed") || (() => { const d = document.createElement("div"); d.id = "bed"; d.setAttribute("aria-hidden", "true"); document.body.insertBefore(d, document.body.firstChild); return d; })();
  bedEl.innerHTML = `<svg viewBox="0 0 390 150" preserveAspectRatio="xMidYMax slice" width="100%" height="100%"><path d="M0 40 Q 60 10 120 32 T 240 24 T 390 30 V150 H0Z" fill="#132845"/><path d="M0 80 Q 80 58 160 76 T 300 70 T 390 78 V150 H0Z" fill="#0E1E36"/><g><path d="M180 150 q-5 -40 8 -60 q10 18 2 60z" fill="#3A2E33"/><path d="M200 150 q3 -50 18 -66 q5 26 -8 66z" fill="#4A3036"/><circle cx="218" cy="84" r="3.5" fill="#C9775A" opacity=".7"/></g></svg>`;
  // mode: "full" — вода с анимацией; "tint" — оттенок времени суток только сверху; иначе — темный фон
  function setWater() {}

  const dayTs = (k) => new Date(k + "T12:00:00").getTime();
  const dayLabel = (ts) => {
    const t = new Date(now()); t.setHours(0, 0, 0, 0); const d = new Date(ts); d.setHours(0, 0, 0, 0);
    const diff = Math.round((t - d) / 86400000);
    if (diff === 0) return "сегодня"; if (diff === 1) return "вчера";
    return ["вс", "пн", "вт", "ср", "чт", "пт", "сб"][d.getDay()] + ", " + d.getDate() + "." + String(d.getMonth() + 1).padStart(2, "0");
  };
  const anyToday = () => { const k = dkey(), d = S.days[k]; return !!((d && d.done) || (S.dreams[k] && S.dreams[k].text) || S.sym[k]); };
  function dayDots(k) {
    const out = [];
    if (S.days[k] && S.days[k].done) out.push("#8FB39A");
    if (Object.values(S.listens || {}).some((ts) => ts && dkey(ts) === k)) out.push("#8CC4E8");
    if (S.dreams[k] && S.dreams[k].text) out.push("#CFE6F5");
    if ((S.catches || []).some((c) => dkey(c.at) === k)) out.push("#C9775A");
    return out;
  }
  function weekBlock() {
    const t = new Date(now()); t.setHours(12, 0, 0, 0);
    const mon = new Date(t); mon.setDate(t.getDate() - ((t.getDay() + 6) % 7));
    let h = `<div class="stack" style="gap:10px"><span class="lbl">НЕДЕЛЯ</span><div class="week">`;
    for (let i = 0; i < 7; i++) {
      const d = new Date(mon); d.setDate(mon.getDate() + i);
      const k = dkey(d.getTime()), cur = k === dkey(), fut = d > t;
      h += `<div class="wd${cur ? " cur" : ""}${fut ? " fut" : ""}"><span>${["пн", "вт", "ср", "чт", "пт", "сб", "вс"][i]}</span><b>${d.getDate()}</b><span class="dots">${fut ? "" : dayDots(k).map((c) => `<i style="background:${c}"></i>`).join("")}</span></div>`;
    }
    return h + `</div><div class="legend"><span><i style="background:#8FB39A"></i>как ты</span><span><i style="background:#8CC4E8"></i>погружение</span><span><i style="background:#CFE6F5"></i>сон</span><span><i style="background:#C9775A"></i>чувство</span></div></div>`;
  }
  const PLAY = (c) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="${c}" aria-hidden="true"><path d="M7 4l13 8-13 8z"/></svg>`;
  // образы человека: сколько раз, откуда пришли, с какими образами рядом
  function imgIndex() {
    const M = {}, byDay = {};
    const REN = S.ren || {}, HIDE = S.hide || [];
    const norm = (w) => { let x = String(w || "").trim().toLowerCase().replace(/ё/g, "е"); for (let k = 0; k < 4 && REN[x]; k++) x = REN[x]; return HIDE.includes(x) ? "" : x; };
    const put = (w, ref) => { w = norm(w); if (!w) return; const x = M[w] || (M[w] = { w, n: 0, src: {}, refs: [], co: {}, feel: {} }); x.n++; x.src[ref.kind] = 1; x.refs.push(ref); (ref.feel || []).forEach((f) => { x.feel[f] = 1; }); };
    const link = (ws) => { ws = ws.map(norm).filter(Boolean); ws.forEach((a) => ws.forEach((b) => { if (a !== b && M[a]) M[a].co[b] = (M[a].co[b] || 0) + 1; })); };
    const day = (k, ws) => { (byDay[k] = byDay[k] || []).push(...ws); };
    Object.keys(S.dreams || {}).forEach((k) => { const d = S.dreams[k]; if (!d || !(d.images || []).length) return; d.images.forEach((w) => put(w, { kind: "dream", ts: dayTs(k), k, text: d.text, feel: d.feel })); day(k, d.images); });
    Object.keys(S.sym || {}).forEach((k) => { const y = S.sym[k], c = cardById(y.id); if (!c) return; put(c.title, { kind: "sym", ts: y.at || dayTs(k), k, text: y.note }); day(k, [c.title]); });
    ALLP.forEach((p) => { const n = S.notes[p.id]; if (!n || !(p.images || []).length) return; const ts = n.savedAt || counted(p.id) || 0, k = dkey(ts); p.images.forEach((w) => put(w, { kind: "dive", ts, k, p, text: n.image, feel: n.feelings })); day(k, p.images); });
    Object.values(byDay).forEach(link);
    // образы, которые Проводник собрал из разговора (ключевые слова человека)
    (S.gimg || []).forEach((g) => { (g.w || []).forEach((w) => put(w, { kind: "guide", ts: g.at, k: dkey(g.at), text: "образ из разговора с Проводником" })); day(dkey(g.at), g.w || []); });
    // связи, которые человек попросил Проводника провести
    (S.links || []).forEach((l) => {
      [l.a, l.b].forEach((w) => { if (!M[norm(w)]) put(w, { kind: "guide", ts: l.at, k: dkey(l.at), text: "образ из разговора с Проводником" }); });
      if (!norm(l.a) || !norm(l.b)) return;
      const A = M[norm(l.a)], B = M[norm(l.b)]; if (A && B && A !== B) { A.co[B.w] = (A.co[B.w] || 0) + 2; B.co[A.w] = (B.co[A.w] || 0) + 2; }
    });
    return M;
  }
  const topImgs = (idx, n) => Object.values(idx).sort((a, b) => b.n - a.n || Math.max(...b.refs.map((r) => r.ts)) - Math.max(...a.refs.map((r) => r.ts))).slice(0, n);
  const imgHref = (w) => "#/img/" + encodeURIComponent(w);
  // светящиеся образы на дне главного экрана
  function seabed() {
    // все образы человека — светящиеся шарики без подписей; крупнее — чаще; плавают
    const L = topImgs(imgIndex(), 14);
    const SL = [[18, 60], [50, 34], [80, 62], [34, 112], [66, 104], [90, 120], [8, 118], [26, 24], [72, 18], [44, 74], [58, 136], [14, 150], [86, 26], [38, 146]];
    return `<div class="seabed" aria-label="Твои образы: ${L.length}">${L.map((x, i) => { const d = 18 + Math.min(x.n, 6) * 7; return `<a href="${imgHref(x.w)}" aria-label="${esc(x.w)}" style="--gc:${GLOW[mainSrc(x)][0]};left:${SL[i][0]}%;top:${SL[i][1]}px;animation-duration:${7 + (i % 5) * 1.7}s;animation-delay:-${i * 1.9}s"><i style="width:${d}px;height:${d}px;animation-delay:-${i * 1.3}s"></i></a>`; }).join("")}</div>`;
  }

  const MAIN_BACK = "img/back-main.jpg";
  const HELLO = { morning: "Доброе утро", day: "Добрый день", evening: "Добрый вечер", night: "Доброй ночи" };
  const WDAY = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"], MONS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  const WH = (x) => x.replace(/stroke="#0F1E33"/g, 'stroke="#E8EEF4"').replace(/width="18" height="18"/, 'width="24" height="24"');
  const ICN_PEN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0F1E33" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
  const ICN_RUN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0F1E33" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.5 2"/></svg>';
  const PH_RU = { morning: "утро", day: "день", evening: "вечер", night: "ночь" };
  const u = (x) => `calc(var(--u) * ${x})`;
  // сообщения сверху на «Сегодня»: смахнуть вверх — закрыть, влево-вправо — листать
  function todayMsgs() {
    const out = [], hid = (S.msgHide && S.msgHide[dkey()]) || [];
    (S.questions || []).forEach((q, i) => { if (q.answer && !q.seen) out.push({ id: "q" + i, cap: "Сейчас · Настя", t: "Настя ответила", sub: "На твой вопрос: " + q.text, href: "#/ask", ic: "msg" }); });
    const pend = ALLP.filter((p) => counted(p.id) && integrOpen(p.id) && !integrDone(p.id));
    pend.forEach((p) => out.push({ id: "i" + p.id, cap: "Интеграция", t: "Можно вернуться к «" + p.title + "»", sub: "Прошло 8 часов. Вернемся к тому, что пришло.", href: "#/integr/" + p.id, ic: "dive" }));
    const nx = nextStep();
    if (!isNight() && nx && isOpen(nx.id) && !pend.length) out.push({ id: "n" + nx.id, cap: "Дальше по пути", t: nx.title, sub: where(nx) + (nx.duration ? " · " + Math.round(nx.duration / 60) + " мин" : ""), href: "#/prep/" + nx.id, ic: "dive" });
    if (isNight()) out.push({ id: "night", cap: "Если не спится", t: "Музыкальное сопровождение", sub: "Для сна и чтобы просто побыть с собой. Всегда есть в Бухте → Музыка", href: "#/music", ic: "moon" });
    if (S.msgOff === dkey()) return [];
    return out.filter((m) => !hid.includes(m.id));
  }
  const MSG_IC = { msg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>', dive: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>', moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>' };
  function paintMsgs() {
    const box = $("#msgs"); if (!box) return;
    const L = todayMsgs(); let i = Math.min(+box.dataset.i || 0, L.length - 1);
    const stg = $("#today"); if (stg) stg.classList.toggle("hasmsg", L.length > 0);
    if (!L.length) { box.innerHTML = ""; return; }
    const m = L[i];
    box.innerHTML = `<div class="msg" id="msg1"><span class="msg-ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F5E8D9" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${MSG_IC[m.ic]}</svg></span><span class="msg-t"><span class="cap">${esc(m.cap)}</span><b>${esc(m.t)}</b><span>${esc(m.sub)}</span></span><a class="msg-go" href="${m.href}">Открыть</a><button type="button" class="msg-x" aria-label="Скрыть напоминания на сегодня">×</button></div>${L.length > 1 ? `<div class="msg-dots">${L.map((_, k) => `<i class="${k === i ? "on" : ""}"></i>`).join("")}</div>` : ""}`;
    const el = $("#msg1"); let x0 = 0, y0 = 0;
    el.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    el.addEventListener("touchend", (e) => {
      const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      if (dy < -30 && Math.abs(dy) > Math.abs(dx)) offToday();
      else if (Math.abs(dx) > 40) { box.dataset.i = (i + (dx < 0 ? 1 : -1) + L.length) % L.length; paintMsgs(); }
    });
    function offToday() { S.msgOff = dkey(); save(); el.classList.add("gone"); setTimeout(paintMsgs, 250); }
    el.querySelector(".msg-x").onclick = (e) => { e.preventDefault(); e.stopPropagation(); offToday(); };
    el.querySelector(".msg-go").onclick = () => { if (m.id[0] === "q") { const q = S.questions[+m.id.slice(1)]; if (q) { q.seen = true; save(); } } };
  }
  function Main() {
    const k = dkey(), nm = S.profile && S.profile.name, ph = phase(), d0 = new Date(now()), am = d0.getHours() < 14;
    const sy = S.sym[k], c = sy && cardById(sy.id), y = c && symByTitle(c.title);
    const q = y ? ((y.questions || [])[0] || y.essence || "") : "";
    const top = 226, porthole = DECK.length && !c;
    const pT = porthole ? 540 : 468;
    const btn = (href, img, l, w, h, ix) => `<a class="t-gauge" href="${href}" style="left:${u(ix)};top:${u(pT + 53)}"><img src="${V27}${img}" alt="" style="width:${u(34)};height:${u(34)};left:${u(w)};top:${u(15)}"><span style="top:${u(73)}">${l}</span></a>`;
    let h = `<div class="vs" id="today">
      <a class="t-hd" href="#/" aria-label="Сегодня" style="left:${u(24)};right:${u(100)};top:${u(56)}"><span class="cap">${WDAY[d0.getDay()]} · ${PH_RU[ph]}</span><h1>${HELLO[ph]}${nm ? ", " + esc(nm) : ""}</h1></a>
      <a class="t-ring" href="#/aid" aria-label="Если сложно — открыть Аптечку" style="left:${u(284)};top:${u(127)};width:${u(84)}"><img src="${V27}Segodnya5m-2.webp" alt=""></a>`;
    if (porthole) h += `<a class="t-port" href="#/symbol" aria-label="Открыть послание дня" style="left:${u(65)};top:${u(196)};width:${u(260)};height:${u(260)}"><img src="${V27}Segodnya4-1.webp" alt=""></a>
      <div class="t-portt" style="top:${u(472)}"><b>К тебе приплыла бутылка</b><span>Коснись стекла, чтобы открыть</span></div>`;
    else if (c) h += `<a class="t-sym" href="#/symbol" aria-label="Послание дня: ${esc(c.title)}" style="left:${u(24)};right:${u(24)};top:${u(top)};height:${u(200)}">
        <span class="t-card" style="left:${u(4)};top:${u(6)};width:${u(112)};height:${u(168)}"><img src="${c.img}" alt=""><img class="t-rivet" src="${V27}Segodnya5m-4.webp" alt="" style="width:${u(20)};height:${u(21)};top:${u(-9)};margin-left:${u(-10)}"></span>
        <span class="t-symt" style="left:${u(140)};top:${u(8)}"><span class="cap">Послание дня</span><span class="t-tt">${esc(c.title)}</span><span class="t-q">${esc(sy.note ? "«" + sy.note + "»" : q)}</span><span class="t-wr" style="width:${u(128)};height:${u(41)}"><img src="${V27}Segodnya5m-5.webp" alt=""><span>${sy.note ? "Дописать" : "Записать"}</span></span></span></a>`;
    h += `<img class="t-panel" src="${V27}Segodnya5m-6.webp" alt="" style="left:${u(5)};top:${u(pT)};width:${u(380)};height:${u(185)}">
      <div class="t-how" style="left:${u(124)};top:${u(pT + 25)};width:${u(140)}">КАК ТЫ?</div>
      ${btn("#/today", "Segodnya5m-7.webp", "Тело и чувства", 40, 0, 32)}${am ? btn("#/dream", "Segodnya5m-8.webp", "Сновидение", 37, 0, 142) : btn("#/free", "Segodnya5-1.webp", "Заметки", 37, 0, 142)}${btn("#/quick", "Segodnya5m-9.webp", "На бегу", 32, 0, 253)}
      <div class="t-msgs" id="msgs" data-i="0"></div></div>`;
    app.innerHTML = h;
    app.querySelectorAll('a[href="#/symbol"]').forEach((a) => a.onclick = (e) => {
      e.preventDefault();
      if (e.target.closest(".t-wr")) { const st = drawSym(), c = st && cardById(st.id), y = c && symByTitle(c.title); if (y) go("#/sym/" + y.id + "/moe"); return; }
      symOpen(); if (porthole) Main();
    });
    paintMsgs();
  }
  function Dives() {
    const nx = nextStep(), c1 = cyDone(cycle);
    let h = `<div class="stack" style="gap:18px">${back("#/lib", "Бухта")}
      <div class="row" style="justify-content:space-between;align-items:flex-end"><div class="scr-h"><div class="cap">Погружения</div><h1>Циклы</h1></div>${ALLP.some((p) => counted(p.id)) ? `<a class="pill-g" href="#/journal">Мои погружения</a>` : ""}</div>`;
    if (nx) {
      const open = isOpen(nx.id);
      h += `<a class="dv-next" href="${open ? "#/prep/" + nx.id : "#/cycle/" + nx._cy.id}"><img src="${V27}${nx._cy ? cyArt(nx._cy) : CY_ART[0]}" alt=""><span class="t"><span class="cap">Дальше по пути</span><b>${esc(nx.title)}</b><span class="small">${esc(where(nx))}${nx.duration ? " · " + Math.round(nx.duration / 60) + " мин" : ""}</span>${open ? `<span class="pill-c">${ICN_PLAY}Слушать</span>` : `<span class="small">${esc(lockHint(nx))}</span>`}</span></a>`;
    } else h += `<div style="height:120px"></div>`;
    h += `<div class="cap" style="margin-top:6px">Все циклы</div><div class="stack" style="gap:8px">`;
    CYC.forEach((cy) => {
      const first = cy.practices[0], open = isOpen(first.id) || cyCount(cy) > 0;
      h += `<a class="cy-row${open ? "" : " off"}" href="#/cycle/${cy.id}"><img src="${V27}${cyArt(cy)}" alt=""><span class="t"><b>${esc(cy.title)}</b><span class="row" style="gap:8px">${open ? dots(cy) : `<span class="small" style="font-size:12px">${esc(lockHint(first))}</span>`}</span></span>${open ? icon.chev : ICN_LOCK}</a>`;
    });
    h += `</div>`;
    if (FREE.length) {
      h += `<div class="cap" style="margin-top:10px">Вне циклов</div><p class="small" style="margin-top:-10px">${c1 ? "В любой день, без порядка." : "Откроются после цикла «" + esc(cycle.title) + "»."}</p><div class="stack" style="gap:8px">`;
      FREE.forEach((f) => {
        const open = isOpen(f.id);
        const inner = `<span class="pr-i${open ? " on" : " lk"}">${open ? ICN_PLAY : f.soon ? "" : ICN_LOCK}</span><span class="t"><b>${esc(f.title)}</b><span>${esc(f.soon ? "скоро" : [f.duration ? Math.round(f.duration / 60) + " мин" : "", f.short || ""].filter(Boolean).join(" · "))}</span></span>`;
        h += open ? `<a class="pr-row" href="#/prep/${f.id}">${inner}</a>` : `<div class="pr-row off">${inner}</div>`;
      });
      h += `</div>`;
    }
    app.innerHTML = h + `</div>`;
  }
  // Бухта: точки на картинке (координаты в пикселях исходника 780×1170). Нажимается и предмет, и подпись.
  const BX = [["#/pod", "ПОДКАСТЫ", 470, 150, 220, 180, "b"], ["#/music", "МУЗЫКА", 130, 360, 200, 160, "b"], ["#/dict", "СИМВОЛЫ", 455, 530, 185, 150, "b"], ["#/dives", "ПОГРУЖЕНИЯ", 100, 810, 240, 200, "b"]];
  function Lib() {
    setBg(null); document.body.classList.add("nofade");
    // карта и подписи — один слой с пропорциями картинки: подписи всегда на тех же местах изображения
    app.innerHTML = `<div class="bx2-st"><div class="bx-map"><img class="bx2-img" src="${V27}Bukhta-1.webp" alt="">${BX.map(([href, l, x, y, w, h, side], i) => `<a class="bx3${side === "r" ? " r" : ""}" href="${href}" aria-label="${cap1(l.toLowerCase())}" style="left:${(x / 7.8).toFixed(2)}%;top:${(y / 11.7).toFixed(2)}%;width:${(w / 7.8).toFixed(2)}%;height:${(h / 11.7).toFixed(2)}%"><span>${l}</span></a>`).join("")}</div><h1 class="bx2-h">Бухта</h1></div>`;
    const st = app.querySelector(".bx2-st"), map = app.querySelector(".bx-map");
    const place = () => {
      if (!document.body.contains(st)) { removeEventListener("resize", place); return; }
      const W = st.clientWidth, H = st.clientHeight, sc = Math.max(W / 780, H / 1170);
      Object.assign(map.style, { width: 780 * sc + "px", height: 1170 * sc + "px", left: (W - 780 * sc) * 0.52 + "px", top: (H - 1170 * sc) * 0.5 + "px" });
      map.style.setProperty("--fs", Math.max(10, Math.min(13, 11 * sc / 0.62)) + "px");
    };
    place(); addEventListener("resize", place);
  }
  function FreeNote(i) {
    S.free = S.free || [];
    const n = i !== undefined && S.free[+i] ? S.free[+i] : null, d0 = new Date(n ? n.at : now());
    app.innerHTML = `<div class="stack" style="gap:16px">${n ? back("#/notes", "Моя карта") : back("#/", "Сегодня")}<div class="toppad"></div>
      <div class="scr-h"><div class="cap">Заметки · ${PH_RU[phase()]}</div><h1>Как прошел день?</h1><p>Что было, что осталось внутри.</p></div>
      ${vta("fn", n ? n.text : "", "Можно словами, можно голосом…", 4)}
      <b class="qb">Что сегодня зацепило?</b>${vta("fh", n ? n.hook || "" : "", "Встреча, фраза, образ…", 2)}
      <a class="link-row" href="#/sovp"><span class="row" style="gap:12px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="12" r="4"/><circle cx="16" cy="12" r="4"/></svg>Было совпадение?</span>${icon.chev}</a>
      <button type="button" class="btn" id="fs">Сохранить</button></div>`;
    bindMics();
    $("#fs").onclick = () => {
      const t = $("#fn").value.trim(), hk = $("#fh").value.trim(); if (!t && !hk) return go(n ? "#/notes" : "#/");
      if (n) { n.text = t; n.hook = hk; } else S.free.push({ text: t, hook: hk, at: now() });
      save(); haptic(); toast("Сохранено в Мою карту"); go(n ? "#/notes" : "#/");
    };
  }
  let NF = "all", NM = "day", ND = null;
  // разговоры с Проводником: части по рубрикам (старые записи «Тело: …» по одной — склеиваются по времени)
  const GCAT = { "тело": "body", "мысль": "thought", "вывод": "thought", "образ": "image", "сон": "image", "чувство": "feel" };
  const GLBL = { body: "Тело", thought: "Мысли", image: "Образы", feel: "Чувства" };
  function guideTalks() {
    const out = [];
    (S.free || []).forEach((c, i) => {
      if (c.src !== "guide" || c.off) return;
      const ps = c.parts || [{ type: (String(c.text).match(/^([А-Яа-я]+):/) || [])[1] || "мысль", text: String(c.text).replace(/^[А-Яа-я]+:\s*/, "") }];
      const last = out[out.length - 1];
      if (last && !c.parts && !last.whole && Math.abs(c.at - last.at) < 60000) { last.idx.push(i); last.parts.push(...ps.map((p) => Object.assign({ i }, p))); }
      else out.push({ at: c.at, idx: [i], whole: !!c.parts, parts: ps.map((p) => Object.assign({ i }, p)) });
    });
    return out;
  }
  function Talk(i) {
    const T = guideTalks().find((t) => t.idx.includes(+i)); if (!T) return go("#/notes");
    const by = {}; T.parts.forEach((p, k) => { const g = GCAT[String(p.type).toLowerCase()] || "thought"; (by[g] = by[g] || []).push(Object.assign({ k }, p)); });
    app.innerHTML = `<div class="stack">${back("#/notes", "Моя карта")}<div class="kicker">${dayLabel(T.at)}</div><h1>Разговор с Проводником</h1>
      ${["feel", "body", "image", "thought"].filter((g) => by[g]).map((g) => `<div class="stack" style="gap:6px"><span class="kicker">${GLBL[g]}</span>${by[g].map((p) => `<textarea data-k="${p.k}" rows="2" maxlength="1000">${esc(p.text)}</textarea>`).join("")}</div>`).join("")}
      <button class="btn" id="tsv">Сохранить</button><button type="button" class="link-row" id="tdel" style="justify-content:center;color:var(--muted)">Удалить запись</button></div>`;
    $("#tsv").onclick = () => {
      app.querySelectorAll("[data-k]").forEach((t) => { T.parts[+t.dataset.k].text = t.value.trim(); });
      const keep = T.parts.filter((p) => p.text), first = S.free[T.idx[0]];
      first.parts = keep.map((p) => ({ type: p.type, text: p.text })); first.text = keep.map((p) => p.type[0].toUpperCase() + p.type.slice(1) + ": " + p.text).join("\n");
      T.idx.slice(1).forEach((j) => { S.free[j].off = true; }); save(); toast("Сохранено"); go("#/notes");
    };
    $("#tdel").onclick = () => { T.idx.forEach((j) => { S.free[j].off = true; }); save(); go("#/notes"); };
  }
  const SRC = { dream: ["сны", "#CFE6F5"], dive: ["погружения", "#8CC4E8"], sym: ["символ дня", "#F0C7B5"], guide: ["Проводник", "#A9CBB3"] };
  // созвездие образов: крупнее — чаще, линии — образы, которые были рядом
  // огоньки: цвет по источнику (решение Насти 10.11) — сон, погружение, символ дня, Проводник
  const GLOW = { dream: ["#BFD9FF", "#3E6FB8"], dive: ["#7FE3E0", "#138A8A"], sym: ["#FFC9A8", "#C2643A"], guide: ["#C6E8B8", "#4F8A4A"] };
  const mainSrc = (x) => { const c = {}; x.refs.forEach((r) => { c[r.kind] = (c[r.kind] || 0) + 1; }); return Object.keys(c).sort((a, b) => c[b] - c[a])[0] || "dream"; };
  function constellation(L) {
    const SL = [[175, 112], [82, 66], [272, 64], [302, 160], [96, 182], [208, 206], [36, 128], [176, 26]];
    const pos = {}; L.forEach((x, i) => { pos[x.w] = SL[i]; });
    const lt = phase() !== "night", gi = lt ? 1 : 0;
    const txt = lt ? "#13284A" : "#E8EEF4", line = lt ? "rgba(19,40,74,.32)" : "rgba(207,230,245,.3)";
    let g = "", e = "";
    L.forEach((x) => Object.keys(x.co).forEach((o) => { if (pos[o] && x.w < o) { const [x1, y1] = pos[x.w], [x2, y2] = pos[o]; e += `<path d="M${x1} ${y1} Q ${(x1 + x2) / 2} ${(y1 + y2) / 2 - 16} ${x2} ${y2}" fill="none" stroke="${line}" stroke-width="1.2" stroke-linecap="round"${x.co[o] > 1 ? "" : ' stroke-dasharray="2 4"'}/>`; } }));
    L.forEach((x, i) => {
      const [cx, cy] = pos[x.w], r = 3 + Math.min(x.n, 6) * 1.3, c = GLOW[mainSrc(x)][gi];
      g += `<a href="${imgHref(x.w)}" class="cg" style="animation-delay:-${i * 1.3}s"><circle cx="${cx}" cy="${cy}" r="${r * 4}" fill="${c}" opacity="${lt ? .32 : .3}" filter="url(#cgb2)"/><circle cx="${cx}" cy="${cy}" r="${r * 1.8}" fill="${c}" opacity=".85" filter="url(#cgb1)"/><circle cx="${cx}" cy="${cy}" r="${r * .9}" fill="#FFFFFF"/><text x="${cx}" y="${cy + r * 3 + 12}" text-anchor="middle" font-family="Manrope,system-ui,sans-serif" font-weight="700" font-size="${11 + Math.min(x.n, 3)}" fill="${txt}">${esc(x.w)}</text></a>`;
    });
    return `<div class="cmap"><svg viewBox="0 0 350 240" role="img" aria-label="Карта образов"><defs><filter id="cgb1" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="3"/></filter><filter id="cgb2" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="9"/></filter></defs>${e}${g}</svg>
      <div class="leg">${Object.keys(SRC).map((k) => `<span style="color:${lt ? "#13284A" : "#C3D0DE"}"><i style="background:${GLOW[k][gi]}"></i>${SRC[k][0]}</span>`).join("")}</div></div>`;
  }
  // отражение недели — из записей, без толкований
  function weekCard(idx) {
    const wk = now() - 7 * 86400000, inW = (ts) => ts && ts >= wk;
    const nDream = Object.keys(S.dreams || {}).filter((k) => S.dreams[k] && S.dreams[k].text && inW(dayTs(k))).length;
    const nDive = ALLP.filter((p) => inW(counted(p.id))).length;
    const nDay = Object.keys(S.days || {}).filter((k) => S.days[k] && S.days[k].done && inW(dayTs(k))).length;
    const zq = {}, fq = {}, addF = (f) => { if (f) fq[f] = (fq[f] || 0) + 1; };
    Object.keys(S.days || {}).forEach((k) => { const d = S.days[k]; if (!d || !d.done || !inW(dayTs(k))) return; Object.keys(d.zones || {}).forEach((z) => { zq[z] = (zq[z] || 0) + 1; }); if (d.feel) (d.feel.list ? d.feel.list.concat(d.feel.word ? [d.feel.word] : []) : [d.feel.own || d.feel.shade || d.feel.base]).forEach(addF); });
    (S.catches || []).forEach((c) => { if (inW(c.at)) addF(c.word); });
    ALLP.forEach((p) => { const n = S.notes[p.id]; if (n && inW(n.savedAt || counted(p.id))) (n.feelings || []).forEach(addF); });
    const parts = [];
    if (nDream) parts.push(nDream + " " + plural(nDream, "сон", "сна", "снов"));
    if (nDive) parts.push(nDive + " " + plural(nDive, "погружение", "погружения", "погружений"));
    if (nDay) parts.push("«Как ты?» — " + nDay + " " + plural(nDay, "раз", "раза", "раз"));
    const nDeep = (S.deep || []).filter((d) => !d.off && inW(d.at)).length;
    if (nDeep) parts.push("через образ — " + nDeep + " " + plural(nDeep, "раз", "раза", "раз"));
    let txt = parts.length ? parts.join(", ") + "." : "На этой неделе пока тихо.";
    const top = topImgs(idx, 1)[0];
    if (top && top.n > 1) { const nb = Object.keys(top.co).sort((a, b) => top.co[b] - top.co[a]).slice(0, 2); txt += ` <b>${esc(top.w)}</b> — уже ${top.n}-й раз${nb.length ? ", рядом " + nb.map((x) => `<b>${esc(x)}</b>`).join(" и ") : ""}.`; }
    const tz = Object.keys(zq).sort((a, b) => zq[b] - zq[a])[0];
    if (tz) txt += ` В теле чаще всего <b>${esc(String(zoneTitle(tz)).toLowerCase())}</b>.`;
    const tf = Object.keys(fq).sort((a, b) => fq[b] - fq[a]).slice(0, 5);
    return `<div class="weekc"><span class="lbl" style="color:var(--sage-l)">ЭТА НЕДЕЛЯ</span><span class="txt">${txt}</span>${tf.length ? `<div class="chips">${tf.map((f) => `<span class="chip feel">${esc(f)}${fq[f] > 1 ? " ×" + fq[f] : ""}</span>`).join("")}</div>` : ""}</div>`;
  }
  function noteItem(x) {
    const chipsOf = (xs, bg, c) => xs.length ? `<span class="nchips">${xs.map((v) => `<span style="background:${bg};color:${c}">${esc(v)}</span>`).join("")}</span>` : "";
    let col, kind, t, sub = "", ch = "", href = "";
    if (x.kind === "day") { const d = S.days[x.k]; col = "#8FB39A"; kind = "КАК ТЫ"; t = daySummary(x.k) || "отмечено"; sub = d.want && d.want.length ? "хочется: " + d.want.join(", ") : ""; ch = chipsOf(Object.keys(d.zones || {}).map(zoneTitle), "#33262A", "#F0C7B5"); if (x.k === dkey()) href = "#/inside"; }
    if (x.kind === "dream") { const d = S.dreams[x.k]; col = "#CFE6F5"; kind = "СОН"; t = d.text.length > 70 ? d.text.slice(0, 70) + "…" : d.text; sub = d.feel && d.feel.length ? "при пробуждении: " + d.feel.join(", ") : ""; ch = chipsOf(d.images || [], "#1F3654", "#CFE6F5"); href = "#/dream/" + x.k; }
    if (x.kind === "sym") { const y = S.sym[x.k], c = cardById(y.id); col = "#F0C7B5"; kind = "СИМВОЛ ДНЯ"; t = c.title; sub = y.note ? "откликается: " + y.note : ""; href = x.k === dkey() ? "#/symbol" : imgHref(c.title.toLowerCase()); }
    if (x.kind === "gpart") { col = "#A9BBD0"; kind = "ПРОВОДНИК · " + GLBL[GCAT[String(x.p.type).toLowerCase()] || "thought"].toUpperCase(); t = x.p.text; href = "#/talk/" + x.T.idx[0]; }
    if (x.kind === "talk") {
      col = "#A9BBD0"; kind = "РАЗГОВОР С ПРОВОДНИКОМ"; href = "#/talk/" + x.T.idx[0];
      const by = {}; x.T.parts.forEach((p) => { const g = GCAT[String(p.type).toLowerCase()] || "thought"; (by[g] = by[g] || []).push(p.text); });
      t = ""; sub = "";
      ch = `<span class="tparts">${["feel", "body", "image", "thought"].filter((g) => by[g]).map((g) => `<span><i>${GLBL[g]}</i>${esc(by[g].join(" · "))}</span>`).join("")}</span>`;
    }
    if (x.kind === "free") { const c = S.free[x.i]; col = "#A9BBD0"; kind = c.src === "guide" ? "ПРОВОДНИК" : "ЗАМЕТКА"; t = c.text.length > 90 ? c.text.slice(0, 90) + "…" : c.text; href = "#/free/" + x.i; }
    if (x.kind === "deep") { const d = S.deep[x.i]; col = "#B9D5D6"; kind = "ЧЕРЕЗ ОБРАЗ"; t = deepLine(d); sub = d.now || d.lack || d.mem || ""; if (sub.length > 90) sub = sub.slice(0, 90) + "…"; href = "#/deepv/" + x.i; }
    if (x.kind === "word") { const c = S.catches[x.i]; col = "#C9775A"; kind = "НАЗВАННОЕ ЧУВСТВО"; t = c.word; href = "#/caught/" + x.i; }
    if (x.kind === "sovp") { const c = S.sovp[x.i]; col = "#E3D2BE"; kind = "СОВПАДЕНИЕ"; t = c.text.length > 90 ? c.text.slice(0, 90) + "…" : c.text; sub = c.with ? "перекликается: " + c.with : ""; href = "#/sovp/" + x.i; }
    if (x.kind === "dive") { const n = S.notes[x.p.id] || {}; col = "#8CC4E8"; kind = "ПОГРУЖЕНИЕ"; t = x.p.title; sub = n.image ? (n.image.length > 90 ? n.image.slice(0, 90) + "…" : n.image) : ""; ch = chipsOf(n.feelings || [], "#24382F", "#D3E4D8"); href = "#/after/" + x.p.id; }
    const inner = `<span class="bar" style="background:${col}"></span><span class="t"><span class="hd"><span>${kind}</span><span>${x.ts ? (NM === "day" ? new Date(x.ts).toTimeString().slice(0, 5) : dayLabel(x.ts)) : ""}</span></span>${t ? `<b>${esc(t)}</b>` : ""}${sub ? `<span class="sub">${esc(sub)}</span>` : ""}${ch}</span>`;
    return href ? `<a class="note" href="${href}">${inner}</a>` : `<div class="note">${inner}</div>`;
  }
  function noteItems() {
    const items = [];
    Object.keys(S.days || {}).forEach((k) => { const d = S.days[k]; if (d && d.done) items.push({ kind: "day", ts: d.at || dayTs(k), k }); });
    Object.keys(S.dreams || {}).forEach((k) => { const d = S.dreams[k]; if (d && d.text) items.push({ kind: "dream", ts: d.savedAt || dayTs(k), k }); });
    Object.keys(S.sym || {}).forEach((k) => { if (cardById(S.sym[k].id)) items.push({ kind: "sym", ts: S.sym[k].at || dayTs(k), k }); });
    (S.catches || []).forEach((c, i) => items.push({ kind: "word", ts: c.at, i }));
    (S.free || []).forEach((c, i) => { if (!c.off && c.src !== "guide") items.push({ kind: "free", ts: c.at, i }); });
    (S.sovp || []).forEach((c, i) => items.push({ kind: "sovp", ts: c.at, i }));
    guideTalks().forEach((T) => items.push({ kind: "talk", ts: T.at, T }));
    (S.deep || []).forEach((d, i) => { if (!d.off) items.push({ kind: "deep", ts: d.at, i }); });
    ALLP.forEach((p) => { const n = S.notes[p.id]; if (n || counted(p.id)) items.push({ kind: "dive", ts: counted(p.id) || (n && n.savedAt) || 0, p }); });
    return items.sort((a, b) => b.ts - a.ts);
  }
  const NFIL = [["all", "Все"], ["dream", "Сны"], ["free", "Заметки"], ["feel", "Чувства"], ["body", "Тело"], ["sovp", "Совпадения"], ["dive", "Погружения"], ["talk", "Проводник"]];
  const nfOk = (x, f) => f === "all" || (f === "feel" && (x.kind === "word" || x.kind === "day")) || (f === "body" && x.kind === "day") || (f === "dream" && x.kind === "dream") || (f === "free" && (x.kind === "free" || x.kind === "deep" || x.kind === "sym")) || (f === "sovp" && x.kind === "sovp") || (f === "dive" && x.kind === "dive") || (f === "talk" && x.kind === "talk");
  function Notes() {
    const items = noteItems();
    let h = `<div class="stack" style="gap:14px;padding-top:24px"><div class="row" style="justify-content:space-between;align-items:center;gap:10px"><div class="scr-h"><h1>Моя карта</h1></div><div class="row" style="gap:8px"><a class="pill-g" href="#/svodka"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" style="margin-right:6px"><path d="M6 20V10M12 20V4M18 20v-7"/></svg>Сводка</a><button type="button" class="addbtn2" id="addN" aria-label="Добавить запись"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1F3654" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button></div></div><a class="lk" href="#/me"><span class="lk-av">${esc(((S.profile && S.profile.name) || "?").slice(0, 1).toUpperCase())}</span><span class="lk-tx"><b>Личный кабинет</b><span>${esc(planLine())}</span></span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></a>`;
    const days = []; for (let i = 6; i >= 0; i--) days.push(dkey(now() - i * 86400000));
    const has = (k) => items.some((x) => x.ts && dkey(x.ts) === k);
    if (!ND || !days.includes(ND)) ND = has(days[6]) ? days[6] : days.slice().reverse().find(has) || days[6];
    h += `<div class="wk">${days.map((k) => `<button type="button" class="${k === ND && NM === "day" ? "on" : ""}" data-day="${k}">${["вс", "пн", "вт", "ср", "чт", "пт", "сб"][new Date(dayTs(k)).getDay()]}${has(k) ? "<i></i>" : ""}</button>`).join("")}</div>`;
    h += `<div class="nfil2">${NFIL.map(([k, l]) => `<button type="button" class="${NF === k ? "on" : ""}" data-nf="${k}">${l}</button>`).join("")}</div>`;
    const list = items.filter((x) => nfOk(x, NF) && (NM !== "day" || (x.ts && dkey(x.ts) === ND)));
    if (!list.length) h += `<div class="card dashed"><div class="small">${NM === "day" ? "В этот день записей нет." : "Здесь будут твои записи: сны, заметки, чувства, погружения и совпадения."}</div></div>`;
    let lastDay = "";
    list.forEach((x) => { const k = dkey(x.ts); if (k !== lastDay) { const d = new Date(x.ts); h += `<div class="cap" style="margin-top:4px">${WDAY[d.getDay()]}, ${d.getDate()} ${MONS[d.getMonth()]}</div>`; lastDay = k; } h += noteItem(x); });
    h += `<a href="#" class="center small" id="nall" style="padding:10px 0;text-decoration:underline;text-underline-offset:4px">${NM === "day" ? "Все записи" : "По дням"}</a>`;
    app.innerHTML = h + `</div>`;
    app.querySelectorAll("[data-nf]").forEach((b) => b.onclick = () => { NF = b.dataset.nf; Notes(); });
    app.querySelectorAll("[data-day]").forEach((b) => b.onclick = () => { ND = b.dataset.day; NM = "day"; Notes(); });
    $("#nall").onclick = (e) => { e.preventDefault(); NM = NM === "day" ? "all" : "day"; Notes(); };
    $("#addN").onclick = newEntrySheet;
  }
  function newEntrySheet() {
    const ic = (p) => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F5E8D9" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
    const o = (href, i, t, sub) => `<a class="opt" href="${href}"><span class="oi">${ic(i)}</span><span class="t"><b>${t}</b><span>${sub}</span></span></a>`;
    const bg = document.createElement("div"); bg.className = "sheet-bg";
    bg.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="ash"><div class="grip"></div><div class="cap" id="ash">Новая запись</div>
      ${o("#/dream", '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>', "Сон", "Что приснилось, пока помнится")}
      ${o("#/free", '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>', "Заметка", "Мысль, событие, что-то из дня")}
      ${o("#/quick/feel", '<path d="M3 12h4l2-5 4 10 2-5h6"/>', "Чувства", "Что сейчас внутри и насколько сильно")}
      ${o("#/today", '<circle cx="12" cy="4.5" r="2"/><path d="M12 7v7M8 10h8M9.5 21l2.5-7 2.5 7"/>', "Тело", "Где откликается и как ощущается")}
      ${o("#/sovp", '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>', "Совпадение", "Образ из сна или практики встретился в жизни")}</div>`;
    bg.onclick = (ev) => { if (ev.target === bg || ev.target.closest("a")) bg.remove(); };
    document.body.appendChild(bg);
  }
  // совпадение: что встретилось в жизни и с чем перекликается
  function Sovp(i) {
    S.sovp = S.sovp || [];
    const old = i !== undefined && S.sovp[+i] ? S.sovp[+i] : null;
    const D = S.sovpDraft && !old ? S.sovpDraft : (S.sovpDraft = old ? Object.assign({}, old) : { text: "", feel: "", kind: "", with: "", ref: "" });
    const K = [["dive", "Практика", '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>'], ["dream", "Сон", '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'], ["mem", "Воспоминание", '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 8v4l3 2"/>'], ["own", "Свой образ", '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.3 6L12 16.6 6.6 19.4l1.3-6L3.4 9.3l6-.7z"/>']];
    const draw = () => {
      app.innerHTML = `<div class="stack" style="gap:16px;padding-top:20px"><a class="circ-b" href="#/notes" aria-label="Назад">${icon.back}</a>
        <div class="scr-h"><div class="cap">Совпадение</div><h1>Что-то встретилось снова</h1></div>
        <div class="card" style="gap:14px;padding:18px">
          <b class="qb">Что ты ${S.profile && S.profile.gender === "m" ? "заметил" : "заметила"} в жизни?</b><textarea id="stx" rows="3" placeholder="Например: на соседней улице сносят старый дом…">${esc(D.text)}</textarea>
          ${D.feelOpen || D.feel ? `<b class="qb">Какое чувство или ощущение появилось?</b><input class="inp" id="sfe" maxlength="80" value="${esc(D.feel)}">` : `<button type="button" class="lnk" id="sfo">+ Какое чувство или ощущение появилось?</button>`}
          <b class="qb">С чем перекликается?</b>
          <div class="sk4">${K.map(([k, l, ic]) => `<button type="button" class="${D.kind === k ? "on" : ""}" data-k="${k}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ic}</svg>${l}</button>`).join("")}</div>
          ${D.with ? `<div class="swith"><div class="row" style="justify-content:space-between"><span class="cap" style="font-size:10px">${esc(D.withLbl || "")}</span><button type="button" class="lnk" id="sch" style="font-size:12px">изменить</button></div><span>${esc(D.with)}</span></div>` : D.kind === "mem" || D.kind === "own" ? `<input class="inp" id="swi" maxlength="120" placeholder="${D.kind === "mem" ? "Какое воспоминание…" : "Какой образ…"}">` : ""}
        </div>
        <button class="btn" id="ssave">Сохранить в Мою карту</button></div>`;
      $("#stx").oninput = (e) => { D.text = e.target.value; save(); };
      if ($("#sfo")) $("#sfo").onclick = () => { D.feelOpen = true; draw(); $("#sfe").focus(); };
      if ($("#sfe")) $("#sfe").oninput = (e) => { D.feel = e.target.value; save(); };
      if ($("#swi")) $("#swi").onchange = (e) => { D.with = e.target.value.trim(); D.withLbl = D.kind === "mem" ? "Воспоминание" : "Свой образ"; save(); draw(); };
      if ($("#sch")) $("#sch").onclick = () => { D.with = ""; save(); pick(D.kind); };
      app.querySelectorAll("[data-k]").forEach((b) => b.onclick = () => { D.kind = b.dataset.k; D.with = ""; save(); if (D.kind === "dream" || D.kind === "dive") pick(D.kind); else draw(); });
      $("#ssave").onclick = () => {
        if (!D.text.trim()) { toast("Напиши, что встретилось"); return; }
        const rec = { text: D.text.trim(), feel: (D.feel || "").trim(), kind: D.kind, with: D.with || "", withLbl: D.withLbl || "", at: old ? old.at : now() };
        if (old) Object.assign(old, rec); else S.sovp.push(rec); S.sovpDraft = null; save(); haptic(); toast("Сохранено в Мою карту"); go("#/notes");
      };
    };
    const pick = (kind) => {
      const list = kind === "dream" ? Object.keys(S.dreams || {}).filter((k) => S.dreams[k] && S.dreams[k].text).sort().reverse().map((k) => ({ lbl: "Сон · " + new Date(dayTs(k)).getDate() + " " + MONS[new Date(dayTs(k)).getMonth()], t: S.dreams[k].text }))
        : ALLP.filter((p) => counted(p.id) || S.notes[p.id]).map((p) => ({ lbl: "Погружение · " + (p._free ? "вне циклов" : p._cy.title), t: p.title + (S.notes[p.id] && S.notes[p.id].image ? ": " + S.notes[p.id].image : "") }));
      const bg = document.createElement("div"); bg.className = "sheet-bg";
      bg.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="grip"></div><div class="row" style="justify-content:space-between"><span class="cap">${kind === "dream" ? "Выбери сон" : "Выбери практику"}</span><span class="small" style="font-size:12px">из Моей карты</span></div>
        ${list.length ? list.slice(0, 20).map((x, j) => `<button type="button" class="pk" data-j="${j}"><span class="cap" style="font-size:10px">${esc(x.lbl)}</span><span>${esc(x.t.length > 110 ? x.t.slice(0, 110) + "…" : x.t)}</span></button>`).join("") : `<p class="small">${kind === "dream" ? "Снов пока нет." : "Пройденных погружений пока нет."}</p>`}</div>`;
      bg.onclick = (ev) => { if (ev.target === bg) bg.remove(); const b = ev.target.closest("[data-j]"); if (b) { const x = list[+b.dataset.j]; D.with = x.t; D.withLbl = x.lbl; save(); bg.remove(); draw(); } };
      document.body.appendChild(bg);
    };
    draw();
  }
  // сводка: что повторялось за неделю, месяц, год
  let SVP = "month", SVO = 0, SVR = null;
  function Svodka() {
    const t0 = new Date(now()); let from, to, title;
    if (SVP === "week") { const d = new Date(t0); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + SVO * 7); from = d.getTime(); to = from + 7 * 86400000; const e = new Date(to - 1); title = d.getDate() + " " + MONS[d.getMonth()] + " — " + e.getDate() + " " + MONS[e.getMonth()]; }
    else if (SVP === "range") { if (!SVR) SVR = { a: dkey(now() - 29 * 86400000), b: dkey() }; from = new Date(SVR.a + "T00:00:00").getTime(); to = new Date(SVR.b + "T00:00:00").getTime() + 86400000; title = ""; }
    else if (SVP === "year") { const y = t0.getFullYear() + SVO; from = new Date(y, 0, 1).getTime(); to = new Date(y + 1, 0, 1).getTime(); title = String(y); }
    else { const m = new Date(t0.getFullYear(), t0.getMonth() + SVO, 1); from = m.getTime(); to = new Date(m.getFullYear(), m.getMonth() + 1, 1).getTime(); title = cap1(["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"][m.getMonth()]) + " " + m.getFullYear(); }
    const inR = (ts) => ts >= from && ts < to, items = noteItems().filter((x) => inR(x.ts));
    const cnt = (k) => items.filter((x) => x.kind === k).length;
    const per = SVP === "week" ? "неделю" : SVP === "year" ? "год" : SVP === "range" ? "период" : "месяц";
    const idx = imgIndex(), imgs = Object.values(idx).map((x) => ({ w: x.w, n: x.refs.filter((r) => inR(r.ts)).length })).filter((x) => x.n).sort((a, b) => b.n - a.n).slice(0, 7);
    const pos = [[34, 30], [62, 18], [20, 62], [70, 52], [46, 72], [84, 80], [12, 26]];
    const feel = {}, body = {};
    items.forEach((x) => { if (x.kind === "word") { const w = S.catches[x.i].word; feel[w] = (feel[w] || 0) + 1; } if (x.kind === "day") { const d = S.days[x.k]; ((d.feel && d.feel.list) || []).forEach((w) => { feel[w] = (feel[w] || 0) + 1; }); Object.keys(d.zones || {}).forEach((z) => { const t = zoneTitle(z); body[t] = (body[t] || 0) + 1; }); } });
    const bars = (o) => { const L = Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 5), mx = L.length ? L[0][1] : 1; return L.map(([k, v]) => `<div class="sbar"><span>${esc(cap1(k))}</span><i><b style="width:${(v / mx) * 100}%"></b></i><em>${v}</em></div>`).join(""); };
    const sv = items.filter((x) => x.kind === "sovp").map((x) => S.sovp[x.i]);
    const dives = items.filter((x) => x.kind === "dive");
    const empty = !items.length;
    app.innerHTML = `<div class="stack" style="gap:14px;padding-top:12px"><div class="row" style="gap:14px;align-items:center"><a class="circ-b" href="#/notes" aria-label="Назад">${icon.back}</a><h1 style="margin:0">Сводка</h1></div><p class="g-sub" style="margin-top:-6px">Что повторялось за период</p>
      <div class="per">${[["week", "Неделя"], ["month", "Месяц"], ["year", "Год"], ["range", "Период"]].map(([k, l]) => `<button type="button" class="${SVP === k ? "on" : ""}" data-p="${k}">${l}</button>`).join("")}</div>
      ${SVP === "range" ? `<div class="row" style="gap:8px;align-items:center"><input type="date" class="inp" id="ra" value="${SVR.a}" max="${dkey()}" aria-label="С"><span class="small">—</span><input type="date" class="inp" id="rb" value="${SVR.b}" max="${dkey()}" aria-label="По"></div>` : `<div class="row" style="justify-content:space-between"><button type="button" class="ib2" id="pv" aria-label="Раньше">‹</button><b style="font-weight:500">${title}</b><button type="button" class="ib2" id="nx" aria-label="Позже"${SVO >= 0 ? " disabled" : ""}>›</button></div>`}
      ${empty ? `<p class="g-sub center" style="padding:6px 8px">Пока мало записей — сводка появится после первых снов и заметок.</p>` : `<div class="st4"><div><b>${cnt("dream")}</b><span>${plural(cnt("dream"), "сон", "сна", "снов")}</span></div><div><b>${cnt("free") + cnt("sovp")}</b><span>заметок</span></div><div><b>${cnt("word") + cnt("day")}</b><span>чувства, тело</span></div><div><b>${dives.length}</b><span>погружения</span></div></div>`}
      <div class="imap"><div class="cap">Образы за ${per}</div>${imgs.length ? imgs.map((x, j) => `<a href="${imgHref(x.w)}" style="left:${pos[j][0]}%;top:${pos[j][1]}%"><i style="width:${8 + Math.min(10, x.n * 2)}px;height:${8 + Math.min(10, x.n * 2)}px"></i>${esc(cap1(x.w))} · ${x.n}</a>`).join("") : `<p class="small" style="position:absolute;left:16px;right:16px;top:44%;color:#3F5266">Образы появятся, когда будут сны и погружения.</p>`}</div>
      ${empty ? "" : `<div class="card" style="gap:10px"><div class="row" style="justify-content:space-between"><span class="cap">Совпадения за ${per}</span><b style="font-weight:500">${sv.length}</b></div>${sv.length ? sv.slice(0, 4).map((c) => `<div class="svi"><span class="svi-i"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg></span><span class="stack" style="gap:2px"><b style="font-weight:500">${esc(c.text.length > 50 ? c.text.slice(0, 50) + "…" : c.text)}</b>${c.with ? `<span class="small">${esc(c.withLbl ? c.withLbl + " — " : "")}${esc(c.with.slice(0, 60))}</span>` : ""}</span></div>`).join("") : `<span class="small">Пока не было. Совпадение можно записать через «+» в Моей карте.</span>`}</div>`}
      ${Object.keys(feel).length ? `<div class="card" style="gap:10px"><div class="row" style="justify-content:space-between"><span class="cap">Чувства</span><span class="small" style="font-size:11px">чаще всего</span></div>${bars(feel)}</div>` : ""}
      ${Object.keys(body).length ? `<div class="card" style="gap:10px"><div class="row" style="justify-content:space-between"><span class="cap">Тело</span><span class="small" style="font-size:11px">где откликалось</span></div>${bars(body)}</div>` : ""}
      ${dives.length ? `<div class="card" style="gap:6px"><span class="cap">Погружения</span><b style="font-weight:500">${dives.length} ${plural(dives.length, "погружение", "погружения", "погружений")}</b><span class="small">${esc(dives.map((x) => x.p.title).slice(0, 4).join(", "))}</span></div>` : ""}</div>`;
    app.querySelectorAll("[data-p]").forEach((b) => b.onclick = () => { SVP = b.dataset.p; SVO = 0; Svodka(); });
    if ($("#pv")) { $("#pv").onclick = () => { SVO--; Svodka(); }; $("#nx").onclick = () => { if (SVO < 0) { SVO++; Svodka(); } }; }
    if ($("#ra")) { const upd = () => { const a = $("#ra").value, b = $("#rb").value; if (a && b) { SVR = a <= b ? { a, b } : { a: b, b: a }; Svodka(); } }; $("#ra").onchange = upd; $("#rb").onchange = upd; }
  }
  const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);
  function renameImg(a, b) { S.ren = S.ren || {}; if (S.ren[b] === a) delete S.ren[b]; S.ren[a] = b; S.hide = (S.hide || []).filter((x) => x !== b); save(); }
  function ImgPage(w) {
    w = String(w || "").toLowerCase();
    const idx = imgIndex(), x = idx[w];
    if (!x) { app.innerHTML = `<div class="stack"><div class="hd-top">${back("#/notes", "Моя карта")}</div><h1>${esc(cap(w))}</h1><p class="small">Этот образ пока не встречался в записях.</p></div>`; return; }
    const KN = { dream: ["СОН", "#CFE6F5"], dive: ["ПОГРУЖЕНИЕ", "#8CC4E8"], sym: ["СИМВОЛ ДНЯ", "#F0C7B5"], guide: ["ПРОВОДНИК", "#A9CBB3"] };
    const cut = (t, n) => t && t.length > n ? t.slice(0, n) + "…" : t || "";
    const refs = x.refs.slice().sort((a, b) => b.ts - a.ts).map((r) => {
      const t = r.kind === "guide" ? "Связь, проведенная в разговоре с Проводником" : r.kind === "dream" ? cut(r.text, 110) : r.kind === "dive" ? r.p.title + (r.text ? ": " + cut(r.text, 90) : "") : cap(w) + (r.text ? ": «" + cut(r.text, 90) + "»" : "");
      const href = r.kind === "dive" ? "#/after/" + r.p.id : r.kind === "dream" ? "#/dream/" + r.k : r.kind === "sym" && r.k === dkey() ? "#/symbol" : "";
      const inner = `<span class="bar" style="background:${KN[r.kind][1]}"></span><span class="t"><span class="hd"><span style="color:${KN[r.kind][1]}">${KN[r.kind][0]}</span><span>${dayLabel(r.ts)}</span></span><b style="font-size:14px">${esc(t)}</b></span>`;
      return href ? `<a class="note" href="${href}">${inner}</a>` : `<div class="note">${inner}</div>`;
    }).join("");
    const co = Object.keys(x.co).sort((a, b) => x.co[b] - x.co[a]).slice(0, 6), fe = Object.keys(x.feel).slice(0, 6), y = symByTitle(w);
    const canGuide = window.KARTA_HEADERS && Object.keys(window.KARTA_HEADERS).length;
    app.innerHTML = `<div class="stack" style="gap:14px"><div class="hd-top">${back("#/notes", "Моя карта")}</div>
      <div class="imghero hd-top"><div class="orb"></div><h1>${esc(cap(w))}</h1><span class="small">встречается ${x.n} ${plural(x.n, "раз", "раза", "раз")}</span></div>
      ${co.length ? `<div class="stack" style="gap:6px"><span class="small">рядом</span><div class="chips">${co.map((o) => `<a class="chip" href="${imgHref(o)}" style="background:#1F3654;color:#CFE6F5">${esc(o)}</a>`).join("")}</div></div>` : ""}
      ${fe.length ? `<div class="stack" style="gap:6px"><span class="small">чувства рядом</span><div class="chips">${fe.map((f) => `<span class="chip feel">${esc(f)}</span>`).join("")}</div></div>` : ""}
      <div class="stack" style="gap:8px">${refs}</div>
      ${y ? `<a class="quietlink" href="#/sym/${y.id}">${esc(cap(w))} в словаре символов →</a>` : ""}
      <div class="row" style="gap:16px;justify-content:center"><button type="button" class="link-row" id="iren" style="border:none;color:var(--blue);width:auto">Исправить название</button><button type="button" class="link-row" id="ihide" style="border:none;color:var(--muted);width:auto">Убрать с карты</button></div>
      ${canGuide ? `<button type="button" class="link-row glass" id="ig" style="justify-content:flex-start;gap:10px;padding:12px 14px;border-radius:16px;font-weight:700"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8CC4E8" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/></svg>Побыть с этим образом с Проводником</button>` : ""}</div>`;
    $("#iren").onclick = () => { const b = $("#iren").parentElement; b.outerHTML = `<div class="stack" style="gap:6px"><span class="small">Если такой образ уже есть, они объединятся.</span><div class="row" style="gap:8px"><input class="inp" id="inew" maxlength="40" value="${esc(w)}"><button type="button" class="btn" id="inok" style="width:auto;padding:12px 16px">OK</button></div></div>`; $("#inew").focus(); $("#inok").onclick = () => { const v = $("#inew").value.trim().toLowerCase().replace(/ё/g, "е"); if (v && v !== w) { renameImg(w, v); toast("Исправлено"); go(imgHref(v)); } else ImgPage(w); }; };
    $("#ihide").onclick = () => { S.hide = (S.hide || []).concat([w]); save(); toast("Убрано с карты"); go("#/notes"); };
    if ($("#ig")) $("#ig").onclick = () => { S.guideDraft = "Хочу побыть с образом «" + w + "». "; S.guide = null; S.guideImg = w; save(); go("#/guide"); };
  }

  // ---------- роутер ----------
  function render() {
    // Telegram открывает приложение с адресом вида #tgWebAppData=…: это не экран, а служебные данные — считаем главным экраном
    if (location.hash && !/^#\//.test(location.hash)) history.replaceState(null, "", location.pathname + location.search + "#/");
    const parts = (location.hash.replace(/^#\/?/, "") || "").split("/");
    const [r, id, sub] = parts;
    if (PL && r !== "player") { history.replaceState(null, "", "#/player/" + PL.id); exitSheet(); return; }
    clearInterval(timer); timer = null;
    document.querySelectorAll(".sheet-bg").forEach((x) => x.remove());
    window.scrollTo(0, 0);
    // нижнее меню — на всех экранах, кроме погружения и опроса после него (и знакомства)
    const LIBR = ["lib", "dives", "journal", "integr", "after", "dict", "dsec", "sym", "pick", "tarot", "arc", "music", "cycle", "pod", "series", "ep", "prep"], NOTR = ["notes", "me", "sub", "svodka", "sovp", "free", "export", "img", "deepv", "talk"];
    const top = !r || r === "lib" || r === "guide" || r === "notes";
    const tabI = ["player", "hello", "adult", "access"].includes(r) ? -1 : r === "guide" ? 2 : LIBR.includes(r) ? 1 : NOTR.includes(r) && !(r === "free" && !id) ? 3 : 0;
    if (tg && tg.BackButton) { top ? tg.BackButton.hide() : tg.BackButton.show(); }
    if (r !== "policy" && (!S.profile || S.profile.minor)) { paintTabs(-1); setWater(""); setBg(r === "hello" && id === "2" ? "Anketa-1.webp" : "Main-1.jpg"); }
    if (r !== "policy") {
      if (!S.profile) return r === "hello" && id === "2" ? Know() : Welcome();
      if (S.profile.minor) return Minor();
    }
    paint = () => {};
    document.body.classList.remove("dim", "nofade");
    paintMini();
    const FULL = ["", "lib", "guide", "notes", "img"], DARK = ["prep", "safety", "player", "after", "return"];
    paintTabs(tabI); setWater(FULL.includes(r || "") ? "full" : DARK.includes(r) || tabI < 0 ? "" : "tint");
    const BG = { "": ["Segodnya5m-1.webp", "100% 0"], symbol: ["Segodnya5m-1.webp", "100% 0"], lib: ["Bukhta-1.webp"], dives: ["Pogruzheniya-1.webp"], journal: ["Pogruzheniya-1.webp"], cycle: ["Pogruzheniya-1.webp"], prep: ["Pogruzheniya-1.webp"], safety: ["Pogruzheniya-1.webp"], player: ["Pogruzheniya-1.webp"], "return": ["Pogruzheniya-1.webp"], after: ["ZapisPosle-1.webp", "", 1], integr: ["ZapisPosle-1.webp", "", 1], deepv: ["ZapisPosle-1.webp", "", 1], music: ["Anketa-1.webp"], dream: ["PanelSon-1.webp", "", 2], free: ["PanelZametki-1.webp", "", 2], quick: [id === "feel" ? "Anketa-1.webp" : "PanelNaBegu-1.webp", "", id === "feel" ? 0 : 2], catch: [!id ? "Anketa-1.webp" : id === "down" ? "AptVniz-1.webp" : "AptVverh-1.webp"], caught: ["AptVverh-1.webp"], feels: ["AptTablica-1.webp"], deep: ["Nikuda1-5.webp"], talk: ["ProvodnikChat-1.jpg"] };
    const bg = BG[r || ""] || ["Anketa-1.webp"];
    setBg(bg[0], { pos: bg[1], top: bg[2], flip: bg[2] === 1 });
    switch (r) {
      case "dives": return Dives();
      case "lib": return Lib();
      case "notes": return Notes();
      case "svodka": return Svodka();
      case "sovp": return Sovp(id);
      case "img": return ImgPage(decodeURIComponent(id || ""));
      case "deepv": return DeepView(id);
      case "talk": return Talk(id);
      case "free": return FreeNote(id);
      case "policy": return Policy(id);
      case "access": return Access();
      case "dict": return Dict(id);
      case "dsec": return DSec(id);
      case "sym": return Sym(id, sub);
      case "tarot": return Tarot();
      case "arc": return Arc(id, sub);
      case "pick": return Pick(id);
      case "music": return Music();
      case "cycle": return Cycle(id);
      case "safety": return Safety(id);
      case "ask": return Ask();
      case "consult": return Consult();
      case "me": return Me();
      case "sub": return Sub(parts[1] === "ok");
      case "guide": return Guide();
      case "export": return Export(id);
      case "quick": return id === "feel" ? Quick() : QuickVoice();
      case "prep": return Prep(id);
      case "player": return Player(id);
      case "return": return Return(id);
      case "after": return After(id);
      case "journal": return Journal();
      case "integr": return Integr(id);
      case "aid": return Aid();
      case "observer": return Observer(id);
      case "pod": return Pods();
      case "series": return Series(id);
      case "ep": return Episode(id);
      case "body": return Body(id, parts[2], parts[3]);
      case "gate": return Gate();
      case "deep": return Deep(id, sub);
      case "catch": return Catch(id, parts[2]);
      case "feels": return Feels();
      case "caught": return Caught(id);
      case "inside": return Inside();
      case "today": return id === "body" ? Today("", parts[2]) : Today(id, parts[2]);
      case "dream": return Dream(id);
      case "symbol": return SymDay();
      default: return Main();
    }
  }
  window.addEventListener("hashchange", render);
  // «Назад» возвращает туда, откуда пришли, а не в раздел-родитель
  const NAV = [];
  const navNote = () => {
    const h = location.hash || "#/", root = (h.replace(/^#\/?/, "") || "").split("/");
    if (root.length === 1 && TABS.some((x) => x[0] === root[0])) { NAV.length = 0; NAV.push(h); return; }
    if (NAV.length >= 2 && NAV[NAV.length - 2] === h) NAV.pop(); else if (NAV[NAV.length - 1] !== h) NAV.push(h);
  };
  navNote(); window.addEventListener("hashchange", navNote);
  const goBack = (fallback) => { if (NAV.length > 1) history.back(); else if (fallback) go(fallback); };
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("a.back[href]"); if (!a || NAV.length < 2) return;
    e.preventDefault(); goBack(a.getAttribute("href"));
  }, true);
  // нажатие на пустое место экрана прячет клавиатуру (кнопки, ссылки и сами поля работают как обычно)
  document.addEventListener("touchstart", (e) => {
    const a = document.activeElement;
    if (!a || (!/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && !a.isContentEditable)) return;
    if (e.target.closest && e.target.closest("input,textarea,select,button,a,label,[contenteditable],[role=button],.chip,.vta")) return;
    a.blur();
  }, { passive: true });
  // доступ (пробный / промокод / подписка) сверяется с сервером при каждом запуске
  setTimeout(() => { if (S.profile && !S.profile.minor) syncAccess(""); }, 2500);
  // заранее подгружаем иллюстрации экранов, куда можно перейти отсюда: переход без ожидания картинки
  const PRE = {
    "": ["Bukhta-1.webp", "ProvodnikChat-1.jpg", "Anketa-1.webp", "Poslanie-1.webp", "PanelSon-1.webp", "PanelZametki-1.webp", "PanelNaBegu-1.webp", "Telo1-1.webp", "Siluety-1.webp"],
    lib: ["Muzyka-1.webp", "Muzyka-6.webp", "Podkasty-1.webp", "Podkasty-2.webp", "Podkasty-3.webp", "Pogruzheniya-1.webp", "Pogruzheniya-2.webp", "Slovar-1.webp", "Slovar-2.webp", "Slovar-3.webp", "Slovar-4.webp", "Slovar-5.webp", "Slovar-6.webp"],
    dives: ["Pogruzheniya-2.webp", "Pogruzheniya-3.webp", "Pogruzheniya-4.webp", "PleerIdet-1.webp", "ZapisPosle-1.webp"],
    pod: ["PodkastVypusk-1.webp"], dict: ["SlovarRazdely-1.webp", "SlovarRazdely-2.webp", "SlovarRazdely-3.webp", "SlovarRazdely-4.webp", "SlovarRazdely-5.webp", "Arkany-1.webp"],
    aid: ["AptVniz-1.webp", "AptVverh-1.webp", "AptTablica-1.webp", "Nikuda1-1.webp", "Nikuda1-2.webp", "Nikuda1-3.webp", "Nikuda1-4.webp", "Nikuda1-5.webp"],
    notes: ["Muzyka-6.webp", "Anketa-1.webp"], symbol: ["Poslanie-1.webp"], music: ["Muzyka-2.webp", "Muzyka-3.webp", "Muzyka-4.webp", "Muzyka-5.webp", "Muzyka-6.webp"],
  };
  const preDone = {};
  const preload = () => {
    const r = (location.hash.replace(/^#\/?/, "") || "").split("/")[0];
    const L = (PRE[r] || []).concat(r === "" ? PRE.lib : []).filter((f) => !preDone[f]);
    if (!L.length) return;
    const go1 = () => { const f = L.shift(); if (!f) return; preDone[f] = 1; const im = new Image(); im.onload = im.onerror = () => setTimeout(go1, 60); im.src = V27 + f; };
    (window.requestIdleCallback || ((cb) => setTimeout(cb, 1200)))(go1);
  };
  window.addEventListener("hashchange", () => setTimeout(preload, 800));
  setTimeout(preload, 1500);
  // свайп влево/вправо на главных экранах вкладок: Сегодня ↔ Бухта ↔ Проводник ↔ Моя карта
  (function swipeTabs() {
    let sx = 0, sy = 0, st = 0, ok = false;
    const NOSW = ".ptabs,.nfil2,.mchips,.chips,.wk,.per,.sk4,#msgs,.msg,.sheet-bg,.imap,input,textarea,select,[contenteditable],.mseek,.dgrid";
    document.addEventListener("touchstart", (e) => {
      const t = e.touches[0]; if (!t || e.touches.length > 1) { ok = false; return; }
      ok = !(e.target.closest && e.target.closest(NOSW)); sx = t.clientX; sy = t.clientY; st = Date.now();
    }, { passive: true });
    document.addEventListener("touchend", (e) => {
      if (!ok) return; ok = false;
      const t = e.changedTouches[0]; if (!t) return;
      const dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx) * 0.7 || Date.now() - st > 900) return;
      const r = (location.hash.replace(/^#\/?/, "") || "").split("/");
      const i = (r.length > 1 && r[1]) ? -1 : TABS.findIndex((x) => x[0] === r[0]);
      if (i < 0) { // внутренний экран: свайп вправо — назад
        if (dx < 0 || !S.profile || document.querySelector(".cview,.sheet-bg")) return;
        const b = app.querySelector("a.back[href]"); if (!b && NAV.length < 2) return;
        document.body.dataset.sw = "r"; goBack(b && b.getAttribute("href")); setTimeout(() => { delete document.body.dataset.sw; }, 400); return;
      }
      if (!S.profile) return;
      const j = i + (dx < 0 ? 1 : -1); if (j < 0 || j >= TABS.length) return;
      document.body.dataset.sw = dx < 0 ? "l" : "r"; try { tg && tg.HapticFeedback && tg.HapticFeedback.selectionChanged(); } catch (e2) {}
      go("#/" + TABS[j][0]);
      setTimeout(() => { delete document.body.dataset.sw; }, 400);
    }, { passive: true });
  })();
  if (tg) {
    try { tg.disableVerticalSwipes && tg.disableVerticalSwipes(); } catch (e) {}
    try { tg.ready(); tg.expand(); tg.setHeaderColor && tg.setHeaderColor("#0F1E33"); tg.setBackgroundColor && tg.setBackgroundColor("#0F1E33"); tg.BackButton.onClick(() => history.back()); } catch (e) {}
  }
  render();
};

/* запрет масштабирования: iOS игнорирует user-scalable=no, поэтому гасим жесты вручную */
(function () {
  const stop = (e) => e.preventDefault();
  ["gesturestart", "gesturechange", "gestureend"].forEach((t) => document.addEventListener(t, stop, { passive: false }));
  document.addEventListener("touchmove", (e) => { if (e.touches.length > 1 || (e.scale && e.scale !== 1)) e.preventDefault(); }, { passive: false });
  let last = 0;
  document.addEventListener("touchend", (e) => {
    const now = Date.now();
    if (now - last < 300 && !e.target.closest("input,textarea,button,a,[role=button]")) e.preventDefault();
    last = now;
  }, { passive: false });
  document.addEventListener("wheel", (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
})();
