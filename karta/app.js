window.startApp = function () {
  "use strict";

  const C = window.CONTENT;
  const tg = window.Telegram && window.Telegram.WebApp;
  const H = 3600 * 1000;
  const COUNT_AFTER_SEC = 120;      // практика засчитывается после 2 минут
  const INTEGRATION_AFTER = 8 * H;  // интеграция через 8 часов
  const NEXT_AFTER = 48 * H;        // следующая практика через 48 часов
  const KEY = "karta-state-v1";

  // ---------- состояние (пока на устройстве; потом — сервер) ----------
  const blank = () => ({ listens: {}, notes: {}, integr: {}, shift: 0, profile: null, myimg: {}, playlist: [], music: { timer: 60, repeat: "list", fade: true } });
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
  const toast = (msg) => { const d = document.createElement("div"); d.className = "toast"; d.textContent = msg; document.body.appendChild(d); setTimeout(() => d.remove(), 2200); };
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
  const cycle = C.cycles[0];
  const prac = (id) => cycle.practices.find((p) => p.id === id);
  const idx = (id) => cycle.practices.findIndex((p) => p.id === id);
  const counted = (id) => S.listens[id] || null;
  function unlockAt(id) {
    const i = idx(id);
    if (i <= 0) return 0;
    const prevTs = counted(cycle.practices[i - 1].id);
    return prevTs ? prevTs + NEXT_AFTER : null; // null — предыдущая еще не пройдена
  }
  const isOpen = (id) => !!counted(id) || (unlockAt(id) !== null && now() >= unlockAt(id));
  const integrAt = (id) => (counted(id) ? counted(id) + INTEGRATION_AFTER : null);
  const integrOpen = (id) => !!prac(id).integration && !!counted(id) && now() >= integrAt(id);
  const integrDone = (id) => !!(S.integr[id] && S.integr[id].done);
  function nextStep() {
    for (const p of cycle.practices) if (!counted(p.id)) return p;
    return null;
  }

  // ---------- экраны ----------
  function Main() {
    const pendingInt = cycle.practices.filter((p) => integrOpen(p.id) && !integrDone(p.id));
    const waitingInt = cycle.practices.filter((p) => counted(p.id) && p.integration && !integrOpen(p.id));
    const nx = nextStep();
    let h = `<div class="stack">
      <div class="row" style="justify-content:space-between"><div><div class="kicker">${S.profile && S.profile.name ? "Привет, " + esc(S.profile.name) : "Глубина"}</div><h1>Твоя карта</h1></div></div>`;
    pendingInt.forEach((p) => {
      h += `<a class="card terra" href="#/integr/${p.id}"><div class="small hint-terra" style="font-weight:600">Интеграция открыта</div><div style="font-weight:700;font-size:16px">к практике «${esc(p.title)}»</div></a>`;
    });
    waitingInt.forEach((p) => {
      h += `<div class="card dashed"><div class="small">Интеграция к «${esc(p.title)}»</div><div style="font-weight:700">откроется ${fmtWhen(integrAt(p.id))}</div></div>`;
    });
    h += `<a class="card" href="#/cycle/${cycle.id}" style="gap:14px;padding:18px"><div class="row" style="justify-content:space-between"><h2 style="font-size:20px">Погружения</h2>${icon.chev}</div>`;
    if (nx) {
      const open = isOpen(nx.id);
      h += `<div class="card blue" style="padding:14px"><div class="small">Следующий шаг · Первые шаги ${idx(nx.id) + 1}/${cycle.practices.length}</div><div style="font-weight:800;font-size:17px">${esc(nx.title)}</div>${open ? "" : `<div class="small">откроется ${unlockAt(nx.id) ? fmtWhen(unlockAt(nx.id)) : "после предыдущей"}</div>`}</div>`;
    } else {
      h += `<div class="small">Цикл «${esc(cycle.title)}» пройден.</div>`;
    }
    h += `</a>
      <a class="link-row" href="#/journal">Мои погружения ${icon.chev}</a>
      <a class="link-row" href="#/dict">Словарь символов ${icon.chev}</a>
      <a class="link-row" href="#/music">Музыкальное сопровождение ${icon.chev}</a>
      <a class="link-row" href="#/aid" style="border-color:var(--terra-line);color:var(--terra-l)">Если сложно — Аптечка ${icon.chev}</a>
      <div class="demo stack" style="gap:10px">
        <div class="small">Демо-режим: перемотка времени, чтобы проверить таймеры (8 и 48 часов)</div>
        <div class="chips"><button class="chip" data-shift="8">+8 часов</button><button class="chip" data-shift="48">+48 часов</button><button class="chip" data-reset="1">Начать заново</button></div>
      </div>
    </div>`;
    app.innerHTML = h;
    app.querySelectorAll("[data-shift]").forEach((b) => b.onclick = () => { S.shift = (S.shift || 0) + Number(b.dataset.shift) * H; save(); toast("Время сдвинуто на +" + b.dataset.shift + " ч"); render(); });
    const r = app.querySelector("[data-reset]");
    r.onclick = () => { if (confirmReset()) { S = blank(); save(); render(); } };
  }
  function confirmReset() { return window.confirm ? window.confirm("Стереть все записи на этом устройстве?") : true; }

  function Cycle() {
    let h = `<div class="stack">${back("#/", "Карта")}
      <div class="stack" style="gap:6px"><div class="kicker" style="color:var(--sage);font-weight:600;letter-spacing:.08em">ЦИКЛ 1</div><h1>${esc(cycle.title)}</h1><p class="lead" style="font-size:14px">${esc(cycle.desc)}</p></div>
      <div class="stack" style="gap:10px">`;
    cycle.practices.forEach((p, i) => {
      const done = !!counted(p.id), open = isOpen(p.id);
      if (done) {
        h += `<a class="prac done" href="#/prep/${p.id}"><span class="num">${icon.check}</span><span class="t"><b>${esc(p.title)}</b>${integrOpen(p.id) && !integrDone(p.id) ? '<span class="hint-terra">интеграция открыта</span>' : p.integration && !integrOpen(p.id) ? `<span>интеграция — ${fmtWhen(integrAt(p.id))}</span>` : ""}</span>${icon.chev}</a>`;
      } else if (open) {
        h += `<a class="prac open" href="#/prep/${p.id}" style="background:var(--card3);border:1px solid #4A6A90"><span class="num">${i + 1}</span><span class="t"><b style="font-size:17px">${esc(p.title)}</b><span>можно начинать</span></span>${icon.chev}</a>`;
      } else {
        const at = unlockAt(p.id);
        h += `<div class="prac locked"><span class="num">${i + 1}</span><span class="t"><b style="color:var(--muted)">${esc(p.title)}</b><span>${at ? "откроется " + fmtWhen(at) : "через 48 ч после предыдущей"}</span></span>${icon.lock}</div>`;
      }
    });
    h += `</div></div>`;
    app.innerHTML = h;
  }

  function Prep(id) {
    const p = prac(id);
    if (!p || !isOpen(id)) return go("#/cycle/" + cycle.id);
    let h = `<div class="stack">${back("#/cycle/" + cycle.id, cycle.title)}
      ${p.img ? `<img class="illu" src="${p.img}" alt="${esc(p.imgAlt || p.title)}">` : `<div class="illu empty">иллюстрация скоро</div>`}
      <div class="stack" style="gap:6px"><div class="kicker">Практика ${idx(id) + 1} из ${cycle.practices.length} · ${Math.round(p.duration / 60)} мин</div><h1 style="font-size:30px">${esc(p.title)}</h1></div>
      ${p.intro.map((t) => `<p class="lead">${esc(t)}</p>`).join("")}
      ${p.accent ? `<div class="card blue" style="padding:18px"><div style="font-weight:800;font-size:18px;color:var(--blue)">${esc(p.accent.title)}</div><div style="font-size:15px;line-height:1.6">${esc(p.accent.text)}</div></div>` : ""}
      ${p.introAfter ? `<p class="lead">${esc(p.introAfter)}</p>` : ""}
      <div class="stack" style="gap:12px"><b>Подготовь место</b>
        <div class="check"><i><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8CC4E8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-6h3zM3 19a2 2 0 0 0 2 2h1v-6H3z"/></svg></i>Надень наушники</div>
        <div class="check"><i><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8CC4E8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12h20"/><path d="M4 12V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="M4 12v6M20 12v6"/></svg></i>Найди удобное положение</div>
        <div class="check"><i><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8CC4E8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M3 3l18 18"/></svg></i>Выключи уведомления</div>
        <div class="check"><i><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8CC4E8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg></i>Не сворачивай приложение</div>
      </div>
      <div class="small center">Остановиться можно в любой момент.</div>
      <a class="btn" href="#/player/${id}">Начать</a>
      ${counted(id) ? `<a class="link-row" href="#/after/${id}">Заметка «сразу после» ${icon.chev}</a>` : ""}
    </div>`;
    app.innerHTML = h;
  }

  // плеер: пока без аудиофайла — время идет по таймеру
  let timer = null;
  function Player(id) {
    const p = prac(id);
    if (!p) return go("#/");
    let pos = 0, playing = true;
    app.innerHTML = `<div class="player">
      <div class="center"><div class="kicker" style="letter-spacing:.06em">ПЕРВЫЕ ШАГИ · ${idx(id) + 1}</div><div style="font-size:24px;font-weight:800">${esc(p.title)}</div></div>
      <div class="orb"><div class="ripple" role="img" aria-label="Погружение идет"><span></span><span></span><span></span><div class="core"></div><div class="core2"></div></div></div>
      <div class="seek"><input id="seek" type="range" min="0" max="${p.duration}" value="0" aria-label="Перемотка"><div class="times"><span id="cur">0:00</span><span>${fmt(p.duration)}</span></div></div>
      <div class="ctrls">
        <button class="round" id="rew" aria-label="Назад на 15 секунд">${icon.rew}</button>
        <button class="play" id="pp" aria-label="Пауза">${icon.pause}</button>
        <button class="round" id="fwd" aria-label="Вперед на 15 секунд">${icon.fwd}</button>
      </div>
      <button class="exit" id="exit">Выйти</button>
    </div>`;
    const seek = $("#seek"), cur = $("#cur"), pp = $("#pp");
    const sync = () => {
      seek.value = pos; cur.textContent = fmt(pos);
      if (pos >= COUNT_AFTER_SEC && !counted(id)) { S.listens[id] = now(); save(); }
      if (pos >= p.duration) finish();
    };
    const finish = () => { clearInterval(timer); timer = null; go("#/return/" + id); };
    clearInterval(timer);
    timer = setInterval(() => { if (playing) { pos += 1; sync(); } }, 1000);
    pp.onclick = () => { playing = !playing; pp.innerHTML = playing ? icon.pause : icon.play; pp.setAttribute("aria-label", playing ? "Пауза" : "Продолжить"); };
    $("#rew").onclick = () => { pos = Math.max(0, pos - 15); sync(); };
    $("#fwd").onclick = () => { pos = Math.min(p.duration, pos + 15); sync(); };
    seek.oninput = () => { pos = Number(seek.value); sync(); };
    $("#exit").onclick = finish;
  }

  function Return(id) {
    app.innerHTML = `<div class="stack" style="padding-top:24px">
      <div class="stack" style="gap:8px"><h1>Не торопись</h1><p class="lead">Почувствуй опору под собой. Пошевели пальцами. Потянись, как после сна.</p></div>
      <a class="btn" href="#/after/${id}">Записать, что было</a>
      <a class="card terra" href="#/aid"><div class="small hint-terra" style="font-weight:600">Если сложно вернуться в реальность</div><div style="font-weight:800;font-size:18px">Техника «Наблюдатель»</div><div class="small" style="color:var(--muted2)">текст · 2–3 минуты</div></a>
      <a class="btn ghost" href="#/">Позже</a>
      ${counted(id) ? "" : `<p class="small center">Практика не засчитана — прошло меньше двух минут. К ней можно вернуться в любой момент.</p>`}
    </div>`;
  }

  function After(id) {
    const p = prac(id);
    const n = S.notes[id] || { image: "", feelings: [], own: [], stand: "" };
    const all = C.feelings.concat(n.own || []);
    app.innerHTML = `<div class="stack">${back("#/prep/" + id, p.title)}
      <div class="stack" style="gap:6px"><div class="kicker">Сразу после · ${esc(p.title)}</div><h1>Что было в погружении?</h1><div class="small">Заметку видишь только ты. Разбирать будем позже — сейчас только поймать.</div></div>
      <label class="q"><b>1. Какой образ к тебе пришел?</b><span>Опиши увиденное</span><textarea id="img" rows="4" placeholder="Что было видно, где ты, что вокруг…">${esc(n.image)}</textarea></label>
      <div class="stack" style="gap:10px"><b>2. С каким чувством ты возвращаешься?</b><div class="chips" id="feel">${all.map((f) => `<button type="button" class="chip${n.feelings.includes(f) ? " on" : ""}" data-f="${esc(f)}">${esc(f)}</button>`).join("")}<button type="button" class="chip add" id="addf">+ свое</button></div><div class="small">Свои слова сохраняются для следующих погружений.</div></div>
      <label class="q"><b>3. Что выделяется из увиденного?</b><textarea id="stand" rows="2" placeholder="Деталь, цвет, звук, что-то одно…">${esc(n.stand)}</textarea></label>
      <button class="btn" id="save">Сохранить</button>
      ${p.closing && p.closing.text ? `<div class="card sage">${p.closing.title ? `<div style="font-weight:800;color:var(--sage-l)">${esc(p.closing.title)}</div>` : ""}<div style="font-size:14px">${esc(p.closing.text)}</div></div>` : ""}
      ${p.integration ? `<p class="small center">Интеграция откроется через 8 часов — напомню.</p>` : ""}
    </div>`;
    const sel = new Set(n.feelings);
    app.querySelectorAll("[data-f]").forEach((b) => b.onclick = () => { const f = b.dataset.f; sel.has(f) ? sel.delete(f) : sel.add(f); b.classList.toggle("on"); });
    $("#addf").onclick = () => {
      const w = (window.prompt && window.prompt("Свое слово для чувства")) || "";
      const t = w.trim().toLowerCase(); if (!t) return;
      n.own = Array.from(new Set((n.own || []).concat(t))); sel.add(t); S.notes[id] = Object.assign(n, { feelings: Array.from(sel) }); save(); After(id);
    };
    $("#save").onclick = () => {
      S.notes[id] = { image: $("#img").value.trim(), feelings: Array.from(sel), own: n.own || [], stand: $("#stand").value.trim(), savedAt: now() };
      save(); haptic(); go("#/journal/saved");
    };
  }

  function Journal(flag) {
    const items = cycle.practices.filter((p) => S.notes[p.id] || counted(p.id));
    let h = `<div class="stack">${back("#/", "Карта")}`;
    if (flag === "saved") h += `<div class="card sage" style="padding:18px;gap:12px"><div style="font-weight:800;font-size:18px;color:var(--sage-l)">Заметка сохранена</div><div style="font-size:14px">Интеграция откроется через 8 часов — напомню.</div><a class="btn" href="#/">Вернуться на главную</a></div>`;
    h += `<h1>Мои погружения</h1>`;
    if (!items.length) h += `<p class="lead">Здесь появятся заметки после погружений.</p>`;
    items.slice().reverse().forEach((p) => {
      const n = S.notes[p.id] || {};
      h += `<div class="card"><div class="row" style="justify-content:space-between"><b>${esc(p.title)}</b><span class="small">${counted(p.id) ? fmtWhen(counted(p.id)).replace(" в ", ", ") : ""}</span></div>
        ${n.image ? `<div style="font-size:14px;color:var(--muted2)">${esc(n.image)}</div>` : `<div class="small">Заметки пока нет</div>`}
        ${n.feelings && n.feelings.length ? `<div class="chips">${n.feelings.map((f) => `<span class="chip on" style="min-height:0;padding:5px 10px;font-size:12px">${esc(f)}</span>`).join("")}</div>` : ""}
        <div class="row" style="gap:16px;flex-wrap:wrap"><a class="small" style="color:var(--blue);font-weight:700" href="#/after/${p.id}">${n.image ? "Изменить заметку" : "Записать"}</a>
        ${integrOpen(p.id) ? `<a class="small" style="color:var(--terra-l);font-weight:700" href="#/integr/${p.id}">${integrDone(p.id) ? "Интеграция" : "Интеграция открыта"}</a>` : p.integration && counted(p.id) ? `<span class="small">интеграция — ${fmtWhen(integrAt(p.id))}</span>` : ""}</div></div>`;
    });
    h += `<a class="btn" href="#/" style="margin-top:6px">На главную</a></div>`;
    app.innerHTML = h;
  }

  function Integr(id) {
    const p = prac(id);
    if (!p || !p.integration) return go("#/");
    if (!integrOpen(id)) { app.innerHTML = `<div class="stack">${back("#/", "Карта")}<h1>${esc(p.title)}</h1><p class="lead">Интеграция откроется ${fmtWhen(integrAt(id))}.</p></div>`; return; }
    const I = p.integration, a = (S.integr[id] && S.integr[id].answers) || {};
    const n = S.notes[id] || {};
    const field = (k, t, d, ph) => `<label class="q"><b>${esc(t)}</b>${d ? `<span>${esc(d)}</span>` : ""}<textarea data-k="${k}" rows="2" placeholder="${esc(ph || "Первое, что приходит…")}">${esc(a[k] || "")}</textarea></label>`;
    let h = `<div class="stack">${back("#/", "Карта")}
      <div class="stack" style="gap:6px"><div class="kicker terra">Интеграция · ${esc(cycle.title)} · ${idx(id) + 1}</div><h1 style="font-size:30px">${esc(p.title)}</h1></div>
      ${n.image ? `<div class="card"><div class="small" style="font-weight:600">ТВОЯ ЗАМЕТКА</div><div style="font-size:14px;color:#D6E0EA">${esc(n.image)}</div></div>` : ""}
      <p style="font-size:16px;line-height:1.6">${esc(I.lead)}</p>
      <h2>Сопоставь с реальностью</h2>
      ${I.questions.map((q, i) => field("q" + i, q.t, q.d)).join("")}`;
    if (I.minute) h += `<div class="card sage" style="padding:18px"><div style="font-size:14px;color:#D6E0EA">${esc(I.minute.intro)}</div><div style="font-size:17px;font-weight:700;font-style:italic;color:var(--sage-l)">${esc(I.minute.q)}</div></div>${field("minute", "Что приходит", "", "Можно одним словом…")}`;
    if (I.forks) I.forks.forEach((f, i) => { h += `<div class="card ${f.kind}" style="padding:18px"><div class="small" style="font-weight:700;color:${f.kind === "terra" ? "var(--terra-l)" : "var(--sage-l)"}">${esc(f.label.toUpperCase())}</div>${f.intro ? `<div style="font-size:14px;color:#D6E0EA">${esc(f.intro)}</div>` : ""}<div style="font-size:16px;font-weight:700;font-style:italic;color:${f.kind === "terra" ? "var(--terra-l)" : "var(--sage-l)"}">${esc(f.q)}</div></div>${field("fork" + i, "Ответ", "", "Можно одним словом…")}`; });
    if (I.outro) h += `<p class="lead">${esc(I.outro)}</p>`;
    h += `<button class="btn" id="done">Завершить интеграцию</button>
      <button class="link-row" id="share" style="justify-content:center;color:var(--blue)">Поделиться с Настей · скоро</button></div>`;
    app.innerHTML = h;
    const collect = () => { const o = {}; app.querySelectorAll("[data-k]").forEach((t) => { if (t.value.trim()) o[t.dataset.k] = t.value.trim(); }); return o; };
    app.querySelectorAll("[data-k]").forEach((t) => t.onchange = () => { S.integr[id] = Object.assign(S.integr[id] || {}, { answers: collect() }); save(); });
    $("#done").onclick = () => { S.integr[id] = { answers: collect(), done: true, at: now() }; save(); haptic(); toast("Интеграция сохранена"); go("#/"); };
    $("#share").onclick = () => toast("Отправка Насте появится в следующей версии");
  }

  function Aid() {
    app.innerHTML = `<div class="stack">${back("#/", "Карта")}
      <div class="stack" style="gap:6px"><div class="kicker terra">Аптечка</div><h1>Если сейчас тяжело</h1><p class="lead" style="font-size:14px">Письменные и аудиопрактики на несколько минут.</p></div>
      <div class="card terra" style="padding:18px"><div class="small hint-terra" style="font-weight:600">СЛОЖНО ВЕРНУТЬСЯ В РЕАЛЬНОСТЬ</div><div style="font-weight:800;font-size:20px">Наблюдатель</div><div style="font-size:14px;color:var(--muted2)">Два коротких вдоха носом, долгий выдох ртом — пока дыхание не выровняется. [Полный текст — пришлет Настя]</div></div>
      <div class="card dashed"><div class="small">Скоро здесь: «Плохо, а что — не понять» (накрыло сейчас / тянется давно), практики при тревоге, гневе, грусти.</div></div>
    </div>`;
  }


  // ---------- первый вход: знакомство ----------
  function ageOf(dob) {
    const d = new Date(dob); if (isNaN(d)) return null;
    const t = new Date(); let a = t.getFullYear() - d.getFullYear();
    if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) a--;
    return a;
  }
  function Welcome() {
    app.innerHTML = `<div class="stack" style="padding-top:32px">
      <div class="kicker">Карта Глубины</div>
      <h1 style="font-size:32px">Добро пожаловать</h1>
      <p class="lead">Здесь погружения в образы, записи после них и бережное знакомство с собой — в своем темпе.</p>
      <p class="lead">Сначала пара вопросов, чтобы приложение обращалось к тебе по-своему.</p>
      <a class="btn" href="#/hello/2" style="margin-top:12px">Начнем</a>
    </div>`;
  }
  function Know() {
    const u = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) || {};
    const st = { gender: "" };
    const maxDate = new Date().toISOString().slice(0, 10);
    app.innerHTML = `<div class="stack">${back("#/hello", "Назад")}
      <h1>Давай познакомимся</h1>
      <label class="q"><b>Как к тебе обращаться?</b><input class="inp" id="nm" type="text" maxlength="40" autocomplete="given-name" value="${esc(u.first_name || "")}" placeholder="Имя"></label>
      <div class="stack" style="gap:8px"><b style="font-size:15px">Пол</b><div class="seg3" id="gd">
        <button type="button" data-g="f">женский</button><button type="button" data-g="m">мужской</button><button type="button" data-g="n">не указывать</button></div>
        <div class="small">Чтобы тексты обращались к тебе правильно.</div></div>
      <label class="q"><b>Дата рождения</b><input class="inp" id="dob" type="date" min="1920-01-01" max="${maxDate}"><span class="small">Нужна, чтобы убедиться, что тебе есть 18, и чтобы Настя учитывала возраст, когда отвечает на твои вопросы.</span></label>
      <label class="consent"><input type="checkbox" id="ok"><span>Соглашаюсь на обработку персональных данных по <a href="#/policy" style="color:var(--blue);text-decoration:underline">политике</a>. Данные хранятся в России.</span></label>
      <button class="btn" id="go" disabled>Продолжить</button>
    </div>`;
    const nm = $("#nm"), dob = $("#dob"), ok = $("#ok"), btn = $("#go");
    const check = () => { btn.disabled = !(nm.value.trim() && dob.value && ok.checked && st.gender); };
    app.querySelectorAll("[data-g]").forEach((b) => b.onclick = () => { st.gender = b.dataset.g; app.querySelectorAll("[data-g]").forEach((x) => x.classList.toggle("on", x === b)); check(); });
    [nm, dob, ok].forEach((e) => { e.oninput = check; e.onchange = check; });
    btn.onclick = () => {
      const a = ageOf(dob.value);
      if (a === null || a < 0 || a > 110) { toast("Проверь дату рождения"); return; }
      if (a < 18) { S.profile = { minor: true, at: now() }; save(); return go("#/adult"); }
      S.profile = { name: nm.value.trim(), gender: st.gender, dob: dob.value, consent: new Date().toISOString(), at: now() };
      save(); haptic(); go("#/");
    };
  }
  function Minor() {
    app.innerHTML = `<div class="stack" style="padding-top:48px;text-align:center;align-items:center">
      <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true"><circle cx="36" cy="36" r="34" fill="#182B45"/><circle cx="36" cy="36" r="20" fill="#1F3654"/><circle cx="36" cy="36" r="6" fill="#8CC4E8"/></svg>
      <h1>Карта Глубины — приложение для взрослых</h1>
      <p class="lead">Возвращайся, когда исполнится 18.</p>
    </div>`;
  }
  function Policy() {
    app.innerHTML = `<div class="stack">${back(S.profile ? "#/" : "#/hello/2", "Назад")}
      <h1>Обработка персональных данных</h1>
      <p class="lead">[Полный текст политики — подготовим до запуска.]</p>
      <p class="lead">Коротко: мы храним имя, пол и дату рождения, чтобы обращаться к тебе по-своему, проверить совершеннолетие и учитывать возраст в ответах на вопросы. Данные хранятся в России и не передаются третьим лицам.</p>
    </div>`;
  }

  // ---------- словарь символов ----------
  const DS = (C.dict && C.dict.sections) || [];
  const SY = []; DS.forEach((sec) => sec.symbols.forEach((x) => SY.push(Object.assign({ sec: sec }, x))));
  const symById = (id) => SY.find((x) => x.id === id);
  const symByTitle = (t) => SY.find((x) => x.title.toLowerCase() === String(t).toLowerCase());
  const mine = (id) => S.myimg[id] || (S.myimg[id] = { text: "", links: [] });
  const hasMine = (id) => S.myimg[id] && (S.myimg[id].text || (S.myimg[id].links || []).length);
  function Dict(tab) {
    const my = tab === "my";
    let h = `<div class="stack">${back("#/", "Карта")}
      <div class="stack" style="gap:6px"><h1>Словарь символов</h1><p class="small">У символа нет одного значения. Здесь — то, что он нес в мифах и сказках, и место, чтобы найти свое.</p></div>
      <div class="seg2"><a href="#/dict" class="${my ? "" : "on"}">Словарь</a><a href="#/dict/my" class="${my ? "on" : ""}">Мои образы</a></div>`;
    if (!DS.length) { app.innerHTML = h + `<p class="lead">Словарь появится после подключения.</p></div>`; return; }
    if (my) {
      const ids = Object.keys(S.myimg).filter(hasMine);
      if (!ids.length) h += `<div class="card dashed"><div class="small">Здесь появятся твои записи к символам и твои связи между ними. Открой любой символ и напиши, что он значит для тебя.</div></div>`;
      ids.forEach((id) => {
        const x = symById(id); if (!x) return; const m = S.myimg[id];
        h += `<a class="card" href="#/sym/${id}"><div class="row" style="justify-content:space-between"><b>${esc(x.title)}</b>${icon.chev}</div>
          ${m.text ? `<div style="font-size:14px;color:var(--muted2)">${esc(m.text)}</div>` : ""}
          ${(m.links || []).length ? `<div class="chips">${m.links.map((l) => { const y = symById(l); return y ? `<span class="chip mine sm">${esc(y.title.toLowerCase())}</span>` : ""; }).join("")}</div>` : ""}</a>`;
      });
      app.innerHTML = h + `</div>`; return;
    }
    const deep = SY.filter((x) => x.deep);
    h += `<input class="inp" id="q" type="search" placeholder="Найти символ: вода, дом, волк…" aria-label="Поиск символа">
      <div id="res" class="stack" style="gap:8px"></div>
      <div id="secs" class="stack" style="gap:18px">
      <div class="stack" style="gap:10px"><div class="kicker" style="letter-spacing:.06em">ОБРАЗЫ ИЗ ПРАКТИК ГЛУБИНЫ</div><div class="chips">${deep.map((x) => `<a class="chip" href="#/sym/${x.id}">${esc(x.title.toLowerCase())}</a>`).join("")}</div></div>
      <div class="stack" style="gap:10px"><div class="kicker" style="letter-spacing:.06em">РАЗДЕЛЫ</div>
      ${DS.map((sec) => `<a class="card" href="#/dsec/${sec.id}" style="gap:4px"><div class="row" style="justify-content:space-between"><b>${esc(sec.title)}</b><span class="small">${sec.symbols.length}</span></div><div class="small">${esc(sec.symbols.slice(0, 6).map((x) => x.title.toLowerCase()).join(", "))}</div></a>`).join("")}
      </div></div></div>`;
    app.innerHTML = h;
    const q = $("#q"), res = $("#res"), secs = $("#secs");
    q.oninput = () => {
      const t = q.value.trim().toLowerCase();
      if (!t) { res.innerHTML = ""; secs.style.display = ""; return; }
      const f = SY.filter((x) => x.title.toLowerCase().includes(t) || x.essence.toLowerCase().includes(t)).slice(0, 30);
      secs.style.display = "none";
      res.innerHTML = f.length ? f.map(symRow).join("") : `<div class="small">Такого символа пока нет в словаре. Свой образ можно записать в «Совпадениях».</div>`;
    };
  }
  const symRow = (x) => `<a class="sym-row" href="#/sym/${x.id}"><span class="t"><b>${esc(x.title)}</b><span>${esc(x.essence)}</span></span>${icon.chev}</a>`;
  function DSec(id) {
    const sec = DS.find((x) => x.id === id); if (!sec) return go("#/dict");
    app.innerHTML = `<div class="stack">${back("#/dict", "Словарь")}
      <div class="stack" style="gap:6px"><h1>${esc(sec.title)}</h1><p class="small">${esc(sec.intro)}</p></div>
      <div class="stack" style="gap:8px">${sec.symbols.map((x) => symRow(Object.assign({ sec: sec }, x))).join("")}</div></div>`;
  }
  function Sym(id) {
    const x = symById(id); if (!x) return go("#/dict");
    const m = S.myimg[id] || { text: "", links: [] };
    const links = m.links || [];
    const relIds = x.related.map((t) => { const y = symByTitle(t); return y ? y.id : null; });
    const rel = x.related.map((t, i) => { const y = relIds[i]; return y ? `<a class="chip${links.includes(y) ? " mine" : ""}" href="#/sym/${y}">${esc(t)}</a>` : `<span class="chip" style="color:var(--muted)">${esc(t)}</span>`; }).join("");
    const myl = links.filter((l) => !relIds.includes(l)).map((l) => { const y = symById(l); return y ? `<a class="chip mine" href="#/sym/${y.id}">${esc(y.title.toLowerCase())}</a>` : ""; }).join("");
    app.innerHTML = `<div class="stack" style="gap:22px">${back("#/dsec/" + x.sec.id, x.sec.title)}
      <div class="stack" style="gap:6px"><div class="kicker" style="letter-spacing:.06em">${esc(x.sec.title.toUpperCase())}</div><h1 style="font-size:32px">${esc(x.title)}</h1><p class="lead" style="font-size:14px">${esc(x.essence)}</p></div>
      <div class="stack" style="gap:10px"><h2 style="font-size:17px">В мифах и сказках</h2>
        ${x.myths.map((y) => `<div class="row" style="align-items:flex-start;font-size:14px;line-height:1.55;color:#D6E0EA"><span style="color:var(--blue)">—</span><span><b style="color:var(--text)">${esc(y.h)}.</b> ${esc(y.t)}</span></div>`).join("")}</div>
      ${x.sd || x.deep ? `<div class="card" style="background:var(--card2)">${x.sd ? `<h2 style="font-size:17px">В символдраме</h2><p style="font-size:14px;line-height:1.55;color:#D6E0EA">${esc(x.sd)}</p>` : ""}${x.deep ? `<span class="small">В Глубине: ${esc(x.deep)}</span>` : ""}</div>` : ""}
      <div class="card" style="background:none;border:1px solid var(--line)"><h2 style="font-size:17px">Другая сторона</h2><p style="font-size:14px;line-height:1.55;color:#D6E0EA">${esc(x.shadow)}</p></div>
      <div class="stack" style="gap:10px"><div class="kicker" style="letter-spacing:.06em">РЯДОМ ПО СМЫСЛУ</div><div class="chips">${rel}${myl}</div>
        <a class="dash-btn" href="#/pick/${id}">${links.length ? "Изменить мои связи" : "Открыть весь список"} ${icon.chev}</a>
        <span class="small" style="font-size:12px;color:var(--dim)">Выбери символы, которые связаны с этим образом для тебя. Твои связи появятся здесь и в «Моих образах».</span></div>
      <div class="card" style="background:var(--card2);gap:10px"><label for="moe"><h2 style="font-size:17px">Что ${esc(x.title.toLowerCase())} значит для тебя?</h2></label>
        <div class="stack" style="gap:6px;font-size:13px;line-height:1.45;color:var(--muted)"><span style="font-size:12px;color:var(--dim)">Если нужна подсказка:</span>${x.questions.map((q) => `<span>— ${esc(q)}</span>`).join("")}</div>
        <textarea id="moe" rows="4" placeholder="Твоя ассоциация — она здесь главная">${esc(m.text)}</textarea>
        <span class="small" id="st" style="font-size:12px;color:var(--dim)">${m.text ? "Сохранено в «Мои образы»" : "Запись сохранится в «Мои образы»"}</span></div>
    </div>`;
    const ta = $("#moe"), stl = $("#st"); let deb;
    ta.oninput = () => { clearTimeout(deb); deb = setTimeout(() => { mine(id).text = ta.value.trim(); mine(id).at = now(); save(); stl.textContent = "Сохранено в «Мои образы»"; }, 500); };
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
  const audio = window.__kartaAudio || (window.__kartaAudio = new Audio());
  audio.preload = "none";
  const M = window.__kartaMusic || (window.__kartaMusic = { cur: null, tab: "all", end: 0, iv: null, lock: null });
  const mset = () => S.music || (S.music = { timer: 60, repeat: "list", fade: true });
  const track = (id) => MU.find((t) => t.id === id);
  const queue = () => (M.tab === "mine" ? S.playlist.map(track).filter(Boolean) : MU);
  const fmtMin = (sec) => Math.round(sec / 60) + " мин";
  async function wake(on) {
    try {
      if (on && "wakeLock" in navigator && !M.lock) { M.lock = await navigator.wakeLock.request("screen"); M.lock.addEventListener("release", () => { M.lock = null; }); }
      if (!on && M.lock) { await M.lock.release(); M.lock = null; }
    } catch (e) {}
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && !audio.paused) wake(true); });
  function playTrack(id) {
    const t = track(id); if (!t) return;
    if (M.cur !== id || !audio.src) { audio.src = t.src; M.cur = id; }
    audio.volume = 1;
    audio.play().catch(() => toast("Нажми ▶ еще раз"));
    const tm = mset().timer; M.end = tm ? Date.now() + tm * 60000 : 0;
    try { if ("mediaSession" in navigator) navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: "Карта Глубины" }); } catch (e) {}
    wake(true); tick();
  }
  function stopMusic() { audio.pause(); audio.volume = 1; M.end = 0; wake(false); }
  function tick() {
    clearInterval(M.iv);
    M.iv = setInterval(() => {
      if (audio.paused) return;
      if (M.end) {
        const left = M.end - Date.now();
        if (mset().fade && left < 30000) audio.volume = Math.max(0, Math.min(1, left / 30000));
        if (left <= 0) { stopMusic(); paint(); return; }
      }
      paint();
    }, 1000);
  }
  audio.onended = () => {
    const r = mset().repeat, q = queue(), i = q.findIndex((t) => t.id === M.cur);
    if (r === "one") { audio.currentTime = 0; audio.play(); return; }
    const nx = q[i + 1] || (r === "list" ? q[0] : null);
    if (nx) playTrack(nx.id); else { stopMusic(); paint(); }
  };
  let paint = () => {};
  function Music() {
    const st = mset();
    const draw = () => {
      const q = queue();
      const opt = (k, v, label) => `<button type="button" class="${st[k] === v ? "on" : ""}" data-${k}="${v}">${label}</button>`;
      app.innerHTML = `<div class="stack">${back("#/", "Карта")}
        <div class="stack" style="gap:6px"><h1>Музыкальное сопровождение</h1><div class="small">Музыка без голоса и заданий — для сна, практик и чтобы просто побыть с собой.</div></div>
        <div class="seg2"><a href="#" data-tab="all" class="${M.tab === "all" ? "on" : ""}">Вся музыка</a><a href="#" data-tab="mine" class="${M.tab === "mine" ? "on" : ""}">Мой плейлист · ${S.playlist.length}</a></div>
        <div class="stack" style="gap:8px">${q.length ? q.map((t) => `<div class="trk${M.cur === t.id ? " cur" : ""}">
          <button type="button" class="tbody" data-play="${t.id}"><span class="ti">${M.cur === t.id && !audio.paused ? icon.pauseS : icon.note}</span><span class="t"><b>${esc(t.title)}</b><span>${fmtMin(t.dur)}</span></span></button>
          <button type="button" class="add${S.playlist.includes(t.id) ? " in" : ""}" data-add="${t.id}" aria-label="${S.playlist.includes(t.id) ? "Убрать из плейлиста" : "Добавить в плейлист"}">${S.playlist.includes(t.id) ? icon.checkS : icon.plus}</button></div>`).join("") : `<div class="card dashed"><div class="small">Плейлист пока пуст. Во вкладке «Вся музыка» нажми «+» у треков, которые хочешь сюда.</div></div>`}</div>
        ${M.tab === "all" ? `<div class="small center" style="font-size:12px;color:var(--dim)">Нажми «+», чтобы собрать свой плейлист из этой музыки</div>` : ""}
        <div id="now"></div>
        <div class="card" style="gap:14px">
          <div class="stack" style="gap:8px"><span class="small">Таймер, мин</span><div class="seg5">${opt("timer", 10, "10")}${opt("timer", 20, "20")}${opt("timer", 40, "40")}${opt("timer", 60, "60")}${opt("timer", 0, "выкл")}</div></div>
          <div class="stack" style="gap:8px"><span class="small">Повтор</span><div class="seg3">${opt("repeat", "none", "Без повтора")}${opt("repeat", "one", "Один трек")}${opt("repeat", "list", "Плейлист")}</div></div>
          <label class="row" style="justify-content:space-between;min-height:44px"><span style="font-size:14px">Плавно затихнуть в конце</span><input type="checkbox" id="fade" ${st.fade ? "checked" : ""} style="width:22px;height:22px;accent-color:var(--sage)"></label>
        </div>
        <a class="small center" href="#" id="chan" style="min-height:44px;display:flex;align-items:center;justify-content:center">Эта музыка есть и в канале ↗</a>
      </div>`;
      app.querySelectorAll("[data-tab]").forEach((b) => b.onclick = (e) => { e.preventDefault(); M.tab = b.dataset.tab; draw(); });
      app.querySelectorAll("[data-play]").forEach((b) => b.onclick = () => { const id = b.dataset.play; if (M.cur === id && !audio.paused) stopMusic(); else playTrack(id); draw(); });
      app.querySelectorAll("[data-add]").forEach((b) => b.onclick = () => { const id = b.dataset.add, i = S.playlist.indexOf(id); i >= 0 ? S.playlist.splice(i, 1) : S.playlist.push(id); save(); haptic(); draw(); });
      app.querySelectorAll("[data-timer]").forEach((b) => b.onclick = () => { st.timer = Number(b.dataset.timer); M.end = st.timer && !audio.paused ? Date.now() + st.timer * 60000 : 0; audio.volume = 1; save(); draw(); });
      app.querySelectorAll("[data-repeat]").forEach((b) => b.onclick = () => { st.repeat = b.dataset.repeat; save(); draw(); });
      $("#fade").onchange = (e) => { st.fade = e.target.checked; save(); };
      $("#chan").onclick = (e) => { e.preventDefault(); toast("Ссылку на канал добавим перед запуском"); };
      paint = () => {
        const el = $("#now"); if (!el) return;
        const t = track(M.cur); if (!t) { el.innerHTML = ""; return; }
        const d = audio.duration || t.dur, c = audio.currentTime || 0;
        const left = M.end ? Math.max(0, Math.ceil((M.end - Date.now()) / 60000)) : 0;
        el.innerHTML = `<div class="card blue" style="gap:10px"><div class="row" style="justify-content:space-between"><b>${esc(t.title)}</b><span class="small">${audio.paused ? "пауза" : left ? "затихнет через " + left + " мин" : "играет"}</span></div>
          <input id="ms" type="range" min="0" max="${Math.floor(d)}" value="${Math.floor(c)}" aria-label="Перемотка"><div class="times"><span>${fmt(c)}</span><span>${fmt(d)}</span></div>
          <button class="btn" id="mp" style="padding:12px 0">${audio.paused ? "Слушать" : "Пауза"}</button></div>`;
        $("#ms").onchange = (e) => { audio.currentTime = Number(e.target.value); };
        $("#mp").onclick = () => { if (audio.paused) playTrack(M.cur); else stopMusic(); draw(); };
      };
      paint();
    };
    draw();
  }

  // ---------- роутер ----------
  function render() {
    clearInterval(timer); timer = null;
    const parts = (location.hash.replace(/^#\/?/, "") || "").split("/");
    const [r, id] = parts;
    window.scrollTo(0, 0);
    if (tg && tg.BackButton) { r ? tg.BackButton.show() : tg.BackButton.hide(); }
    if (r !== "policy") {
      if (!S.profile) return r === "hello" && id === "2" ? Know() : Welcome();
      if (S.profile.minor) return Minor();
    }
    if (r !== "music") paint = () => {};
    switch (r) {
      case "policy": return Policy();
      case "dict": return Dict(id);
      case "dsec": return DSec(id);
      case "sym": return Sym(id);
      case "pick": return Pick(id);
      case "music": return Music();
      case "cycle": return Cycle();
      case "prep": return Prep(id);
      case "player": return Player(id);
      case "return": return Return(id);
      case "after": return After(id);
      case "journal": return Journal(id);
      case "integr": return Integr(id);
      case "aid": return Aid();
      default: return Main();
    }
  }
  window.addEventListener("hashchange", render);
  if (tg) {
    try { tg.ready(); tg.expand(); tg.setHeaderColor && tg.setHeaderColor("#0F1E33"); tg.setBackgroundColor && tg.setBackgroundColor("#0F1E33"); tg.BackButton.onClick(() => history.back()); } catch (e) {}
  }
  render();
};
