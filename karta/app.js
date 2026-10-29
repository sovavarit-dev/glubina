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
  const blank = () => ({ listens: {}, notes: {}, integr: {}, shift: 0 });
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
      <div class="row" style="justify-content:space-between"><div><div class="kicker">Глубина</div><h1>Твоя карта</h1></div></div>`;
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

  // ---------- роутер ----------
  function render() {
    clearInterval(timer); timer = null;
    const parts = (location.hash.replace(/^#\/?/, "") || "").split("/");
    const [r, id] = parts;
    window.scrollTo(0, 0);
    if (tg && tg.BackButton) { r ? tg.BackButton.show() : tg.BackButton.hide(); }
    switch (r) {
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
