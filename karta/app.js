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
  function confirmReset() { return window.confirm ? window.confirm("Стереть все записи на этом устройстве?") : true; }

  function Cycle() {
    let h = `<div class="stack">${back("#/dives", "Погружения")}
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

  // плеер погружения: пока без аудиофайла — время идет по таймеру.
  // Свернуть нельзя: уход с экрана — только через «Завершить погружение?».
  let timer = null;
  let PL = null; // { id, pos, playing }
  const mix = (a, b, k) => { const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); const x = p(a), y = p(b); return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, "0")).join(""); };
  function diveScene() {
    let b = "";
    const rnd = (i, k) => ((Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1;
    for (let i = 0; i < 12; i++) { const x = 30 + Math.round(rnd(i, 1) * 330), r = [1.5, 2, 2.5, 3][i % 4], d = 12 + Math.round(rnd(i, 2) * 10), bg = (rnd(i, 3) * d).toFixed(1); b += `<circle cx="${x}" cy="760" r="${r}" fill="none" stroke="#CFE6F5" stroke-width="1" opacity="0"><animate attributeName="cy" values="760;120" dur="${d}s" begin="-${bg}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;.7;.7;0" keyTimes="0;.15;.8;1" dur="${d}s" begin="-${bg}s" repeatCount="indefinite"/></circle>`; }
    let s = "";
    for (let i = 0; i < 22; i++) { const x = 10 + Math.round(rnd(i, 4) * 370), y = 80 + Math.round(rnd(i, 5) * 720), d = 26 + Math.round(rnd(i, 6) * 14), bg = (rnd(i, 7) * d).toFixed(1); s += `<circle cx="${x}" cy="${y}" r="1" fill="#A9C4DA" opacity=".5"><animate attributeName="cy" values="${y - 40};${y + 40}" dur="${d}s" begin="-${bg}s" repeatCount="indefinite"/></circle>`; }
    return `<svg class="dive-svg" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs><linearGradient id="dvbg" x1="0" y1="0" x2="0" y2="1"><stop id="dvt" offset="0" stop-color="#2F5D88"/><stop id="dvm" offset=".45" stop-color="#16304F"/><stop offset="1" stop-color="#08121F"/></linearGradient>
      <radialGradient id="dvgl" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#DCEEFA" stop-opacity=".75"/><stop offset=".35" stop-color="#8CC4E8" stop-opacity=".35"/><stop offset="1" stop-color="#8CC4E8" stop-opacity="0"/></radialGradient></defs>
      <rect width="390" height="844" fill="url(#dvbg)"/>
      <g id="dvglw"><ellipse cx="195" cy="-10" rx="600" ry="420" fill="url(#dvgl)"><animate attributeName="opacity" values=".6;1;.6" dur="10s" repeatCount="indefinite"/></ellipse></g>
      <g id="dvsn" opacity=".4">${s}</g><g id="dvbb">${b}</g></svg>
      <div class="dive-depth" aria-hidden="true"><i></i><i style="top:25%"></i><i style="top:50%"></i><i style="top:75%"></i><i style="top:100%"></i><b id="dvdot"></b></div>`;
  }
  function setDepth(t) {
    const d = t < 0.15 ? t / 0.15 : t > 0.85 ? Math.max(0, (1 - t) / 0.15) : 1; // спуск — глубина — всплытие
    const q = (id) => document.getElementById(id);
    if (!q("dvt")) return;
    q("dvt").setAttribute("stop-color", mix("#2F5D88", "#0F2038", d));
    q("dvm").setAttribute("stop-color", mix("#16304F", "#0A1626", d));
    q("dvglw").setAttribute("transform", `translate(195 0) scale(${(1 - 0.5 * d).toFixed(3)}) translate(-195 0)`);
    q("dvglw").setAttribute("opacity", (1 - 0.55 * d).toFixed(2));
    q("dvbb").setAttribute("opacity", (1 - 0.7 * d).toFixed(2));
    q("dvsn").setAttribute("opacity", (0.3 + 0.5 * d).toFixed(2));
    q("dvdot").style.top = (d * 100).toFixed(1) + "%";
  }
  function exitSheet() {
    if (!PL || document.querySelector(".sheet-bg")) return;
    const id = PL.id, was = PL.playing; PL.playing = false;
    const pp = $("#pp"); if (pp) pp.innerHTML = icon.play;
    const bg = document.createElement("div"); bg.className = "sheet-bg";
    bg.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="exh"><div class="grip"></div>
      <h2 id="exh" style="font-size:20px">Завершить погружение?</h2>
      <p class="lead">Запись остановится. Перед тем как выйти, сделай пару глубоких вдохов и почувствуй опору под собой.</p>
      <button class="btn" id="exstay">Продолжить погружение</button>
      <button class="btn ghost" id="exgo" style="border-color:var(--terra-line);color:var(--terra-l)">Завершить</button></div>`;
    document.body.appendChild(bg);
    const close = () => bg.remove();
    $("#exstay").onclick = () => { close(); if (PL) { PL.playing = was; const b = $("#pp"); if (b) b.innerHTML = was ? icon.pause : icon.play; } };
    bg.onclick = (e) => { if (e.target === bg) $("#exstay").click(); };
    $("#exgo").onclick = () => { close(); leaveDive(id); };
  }
  // плеер медленно растворяется, вода светлеет — и только потом экран возвращения
  function leaveDive(id) {
    clearInterval(timer); timer = null; PL = null;
    const ui = document.querySelector(".dive-ui"); if (ui) ui.classList.add("fading");
    const dd = document.querySelector(".dive-depth"); if (dd) dd.style.opacity = "0";
    setDepth(1);
    setTimeout(() => go("#/return/" + id), 1800);
  }
  function Player(id) {
    const p = prac(id);
    if (!p) return go("#/");
    if (!PL || PL.id !== id) PL = { id, pos: 0, playing: true };
    if (NOW.kind) closeAudio();
    app.innerHTML = `<div class="dive">${diveScene()}</div><div class="player dive-ui">
      <div class="center"><div class="kicker" style="letter-spacing:.06em;color:var(--muted2)">ПЕРВЫЕ ШАГИ · ${idx(id) + 1}</div><div style="font-size:24px;font-weight:800">${esc(p.title)}</div></div>
      <div class="orb" role="img" aria-label="Погружение идет"></div>
      <div class="seek"><input id="seek" type="range" min="0" max="${p.duration}" value="0" aria-label="Перемотка"><div class="times"><span id="cur">0:00</span><span>${fmt(p.duration)}</span></div></div>
      <div class="ctrls">
        <button class="round" id="rew" aria-label="Назад на 15 секунд">${icon.rew}</button>
        <button class="play" id="pp" aria-label="Пауза">${PL.playing ? icon.pause : icon.play}</button>
        <button class="round" id="fwd" aria-label="Вперед на 15 секунд">${icon.fwd}</button>
      </div>
      <button class="exit" id="exit">Выйти</button>
    </div>`;
    const seek = $("#seek"), cur = $("#cur"), pp = $("#pp");
    const sync = () => {
      seek.value = PL.pos; cur.textContent = fmt(PL.pos); setDepth(PL.pos / p.duration);
      if (PL.pos >= COUNT_AFTER_SEC && !counted(id)) { S.listens[id] = now(); save(); }
      if (PL.pos >= p.duration) finish();
    };
    const finish = () => leaveDive(id);
    clearInterval(timer);
    timer = setInterval(() => { if (PL && PL.playing) { PL.pos += 1; sync(); } }, 1000);
    sync();
    pp.onclick = () => { PL.playing = !PL.playing; pp.innerHTML = PL.playing ? icon.pause : icon.play; pp.setAttribute("aria-label", PL.playing ? "Пауза" : "Продолжить"); };
    $("#rew").onclick = () => { PL.pos = Math.max(0, PL.pos - 15); sync(); };
    $("#fwd").onclick = () => { PL.pos = Math.min(p.duration, PL.pos + 15); sync(); };
    seek.oninput = () => { PL.pos = Number(seek.value); sync(); };
    $("#exit").onclick = exitSheet;
  }

  function Return(id) {
    const ln = (d, html) => `<div class="ln" style="animation-delay:${d}s">${html}</div>`;
    app.innerHTML = `<div class="dive ret-bg">${diveScene()}</div><div class="stack dive-ui ret">
      ${ln(0.4, '<h1>Не торопись</h1>')}
      ${ln(2.2, '<p class="lead">Почувствуй опору под собой</p>')}
      ${ln(4.0, '<p class="lead">Пошевели пальцами</p>')}
      ${ln(5.8, '<p class="lead">Потянись, как после сна</p>')}
      <div class="ln stack" style="animation-delay:7.8s;gap:12px;margin-top:auto">
        <a class="btn" href="#/after/${id}">Записать, что было</a>
        <a class="card terra" href="#/observer"><div class="small hint-terra" style="font-weight:600">Если сложно вернуться в реальность</div><div style="font-weight:800;font-size:18px">Техника «Наблюдатель»</div><div class="small" style="color:var(--muted2)">прочитать и сделать · 2–3 минуты</div></a>
        <a class="btn ghost" href="#/">Позже</a>
        ${counted(id) ? "" : `<p class="small center">Практика не засчитана — прошло меньше двух минут. К ней можно вернуться в любой момент.</p>`}
      </div></div>`;
    setDepth(1);
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
      <div class="stack" style="gap:8px"><a class="link-row" href="#/body/n/${id}/front" style="border-color:var(--terra-line)"><span class="stack" style="gap:2px"><b>4. Где отозвалось в теле</b><span class="small" style="font-weight:400">${n.body && Object.keys(n.body).length ? "отмечено: " + Object.keys(n.body).length : n.bodyQuiet ? "тело молчало" : "отметить на силуэте"}</span></span>${icon.chev}</a>${bodyChips(n)}</div>
      <button class="btn" id="save">Сохранить</button>
      ${p.closing && p.closing.text ? `<div class="card sage">${p.closing.title ? `<div style="font-weight:800;color:var(--sage-l)">${esc(p.closing.title)}</div>` : ""}<div style="font-size:14px">${esc(p.closing.text)}</div></div>` : ""}
      ${p.integration ? `<p class="small center">Интеграция откроется через 8 часов — напомню.</p>` : ""}
    </div>`;
    const sel = new Set(n.feelings);
    const draft = () => { S.notes[id] = Object.assign(S.notes[id] || {}, { image: $("#img").value, feelings: Array.from(sel), own: n.own || [], stand: $("#stand").value }); save(); };
    ["#img", "#stand"].forEach((q) => $(q).addEventListener("input", draft));
    app.querySelectorAll("[data-f]").forEach((b) => b.onclick = () => { const f = b.dataset.f; sel.has(f) ? sel.delete(f) : sel.add(f); b.classList.toggle("on"); draft(); });
    $("#addf").onclick = () => {
      const w = (window.prompt && window.prompt("Свое слово для чувства")) || "";
      const t = w.trim().toLowerCase(); if (!t) return;
      n.own = Array.from(new Set((n.own || []).concat(t))); sel.add(t); S.notes[id] = Object.assign(n, { image: $("#img").value, stand: $("#stand").value, feelings: Array.from(sel) }); save(); After(id);
    };
    $("#save").onclick = () => {
      S.notes[id] = Object.assign(S.notes[id] || {}, { image: $("#img").value.trim(), feelings: Array.from(sel), own: n.own || [], stand: $("#stand").value.trim(), savedAt: now() });
      save(); haptic(); go("#/journal/saved");
    };
  }

  function Journal(flag) {
    const items = cycle.practices.filter((p) => S.notes[p.id] || counted(p.id));
    let h = `<div class="stack">${back("#/dives", "Погружения")}`;
    if (flag === "saved") h += `<div class="card sage" style="padding:18px;gap:12px"><div style="font-weight:800;font-size:18px;color:var(--sage-l)">Заметка сохранена</div><div style="font-size:14px">Интеграция откроется через 8 часов — напомню.</div><a class="btn" href="#/">Вернуться на главную</a></div>`;
    h += `<h1>Мои погружения</h1>`;
    if (!items.length) h += `<p class="lead">Здесь появятся заметки после погружений.</p>`;
    items.slice().reverse().forEach((p) => {
      const n = S.notes[p.id] || {};
      h += `<div class="card"><div class="row" style="justify-content:space-between"><b>${esc(p.title)}</b><span class="small">${counted(p.id) ? fmtWhen(counted(p.id)).replace(" в ", ", ") : ""}</span></div>
        ${n.image ? `<div style="font-size:14px;color:var(--muted2)">${esc(n.image)}</div>` : `<div class="small">Заметки пока нет</div>`}
        ${n.feelings && n.feelings.length ? `<div class="chips">${n.feelings.map((f) => `<span class="chip on" style="min-height:0;padding:5px 10px;font-size:12px">${esc(f)}</span>`).join("")}</div>` : ""}
        ${bodyChips(n)}
        <div class="row" style="gap:16px;flex-wrap:wrap"><a class="small" style="color:var(--blue);font-weight:700" href="#/after/${p.id}">${n.image ? "Изменить заметку" : "Записать"}</a>
        ${integrOpen(p.id) ? `<a class="small" style="color:var(--terra-l);font-weight:700" href="#/integr/${p.id}">${integrDone(p.id) ? "Интеграция" : "Интеграция открыта"}</a>` : p.integration && counted(p.id) ? `<span class="small">интеграция — ${fmtWhen(integrAt(p.id))}</span>` : ""}</div></div>`;
    });
    if (S.catches && S.catches.length) {
      h += `<h2 style="margin-top:8px">Пойманные слова</h2>`;
      S.catches.slice().reverse().slice(0, 30).forEach((c) => {
        const i = S.catches.indexOf(c);
        h += `<a class="card" href="#/caught/${i}" style="gap:6px"><div class="row" style="justify-content:space-between"><b>${esc(c.word)}</b><span class="small">${fmtWhen(c.at).replace(" в ", ", ")}</span></div>${bodyChips(c)}</a>`;
      });
    }
    h += `<a class="btn" href="#/" style="margin-top:6px">На главную</a></div>`;
    app.innerHTML = h;
  }

  function Integr(id) {
    const p = prac(id);
    if (!p || !p.integration) return go("#/");
    if (!integrOpen(id)) { app.innerHTML = `<div class="stack">${back("#/", "Сегодня")}<h1>${esc(p.title)}</h1><p class="lead">Интеграция откроется ${fmtWhen(integrAt(id))}.</p></div>`; return; }
    const I = p.integration, a = (S.integr[id] && S.integr[id].answers) || {};
    const n = S.notes[id] || {};
    const field = (k, t, d, ph) => `<label class="q"><b>${esc(t)}</b>${d ? `<span>${esc(d)}</span>` : ""}<textarea data-k="${k}" rows="2" placeholder="${esc(ph || "Первое, что приходит…")}">${esc(a[k] || "")}</textarea></label>`;
    let h = `<div class="stack">${back("#/", "Сегодня")}
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
    app.innerHTML = `<div class="stack">${back("#/", "Сегодня")}
      <div class="stack" style="gap:6px"><div class="kicker terra">Аптечка</div><h1>Если сейчас тяжело</h1></div>
      <a class="choice terra" href="#/gate" style="padding:20px"><span class="t"><b style="font-size:20px">Плохо, а что — не понять</b><span>накрыло сейчас или тянется давно</span></span>${icon.chev}</a>
      <div class="kicker" style="letter-spacing:.08em;margin-top:6px">ПРАКТИКИ</div>
      <div class="stack" style="gap:8px">
        <a class="sym-row" href="#/observer"><span class="t"><b>Сложно вернуться в реальность</b><span>Наблюдатель · прочитать и сделать · 2–3 мин</span></span>${icon.chev}</a>
        <div class="sym-row" style="background:none;border:1px dashed var(--line)"><span class="t"><b style="color:var(--muted)">Тревога, гнев, грусть и другие гнетущие чувства</b><span>скоро</span></span></div>
      </div>
      <div class="kicker" style="letter-spacing:.08em;margin-top:6px">ЖИВОЙ КОНТАКТ</div>
      <button type="button" class="choice" id="bot"><span class="t"><b>Написать мне</b><span>бот поддержки, отвечаю лично</span></span>${icon.chev}</button>
    </div>`;
    $("#bot").onclick = () => { const u = "https://t.me/glubina_help_bot"; try { tg && tg.openTelegramLink ? tg.openTelegramLink(u) : window.open(u, "_blank"); } catch (e) { window.open(u, "_blank"); } };
  }
  function Observer() {
    app.innerHTML = `<div class="stack">${back("#/aid", "Аптечка")}
      <div class="stack" style="gap:6px"><div class="kicker terra">Сложно вернуться в реальность · 2–3 мин</div><h1>Наблюдатель</h1><p class="lead" style="font-size:14px">Прочитай и сделай — ничего записывать не нужно.</p></div>
      <div class="card terra" style="padding:18px"><div style="font-size:16px;line-height:1.6">Два коротких вдоха носом, долгий выдох ртом — пока дыхание не выровняется.</div><div class="small">[Полный текст — пришлет Настя]</div></div>
      <a class="btn ghost" href="#/">На главную</a></div>`;
  }


  // ---------- первый вход: знакомство ----------
  function ageOf(dob) {
    const d = new Date(dob); if (isNaN(d)) return null;
    const t = new Date(); let a = t.getFullYear() - d.getFullYear();
    if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) a--;
    return a;
  }
  function Welcome() {
    if (!window.WELCOME_HTML) { app.innerHTML = `<div class="stack" style="padding-top:48px"><h1>Добро пожаловать на Глубину</h1><a class="btn" href="#/hello/2">Нырнуть</a></div>`; return; }
    app.innerHTML = `<div class="wel"><div class="stage">${window.WELCOME_HTML}</div></div>`;
    const st = app.querySelector(".stage");
    const fit = () => { if (!st.isConnected) return window.removeEventListener("resize", fit); const k = window.innerWidth / 390; const H = Math.max(window.innerHeight / k, 640); st.style.height = H + "px"; st.classList.toggle("short", H < 760); st.style.transform = `translateX(-50%) scale(${k})`; };
    fit(); window.addEventListener("resize", fit);
  }
  function Know() {
    const u = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) || {};
    const st = { gender: "" };
    app.innerHTML = `<div class="stack">${back("#/hello", "Назад")}
      <h1>Давай познакомимся</h1>
      <label class="q"><b>Как к тебе обращаться?</b><input class="inp" id="nm" type="text" maxlength="40" autocomplete="given-name" value="${esc(u.first_name || "")}" placeholder="Имя"></label>
      <div class="stack" style="gap:8px"><b style="font-size:15px">Пол</b><div class="seg3" id="gd">
        <button type="button" data-g="f">женский</button><button type="button" data-g="m">мужской</button><button type="button" data-g="n">не указывать</button></div>
        <div class="small">Чтобы тексты обращались к тебе правильно.</div></div>
      <label class="q"><b>Дата рождения</b><input class="inp" id="dob" type="text" inputmode="numeric" autocomplete="bday" placeholder="дд.мм.гггг" maxlength="10" style="letter-spacing:.06em;font-variant-numeric:tabular-nums"><span class="small">Нужна, чтобы убедиться, что тебе есть 18, и чтобы Настя учитывала возраст, когда отвечает на твои вопросы.</span></label>
      <label class="consent"><input type="checkbox" id="ok"><span>Принимаю <a href="#/policy/privacy" style="color:var(--blue);text-decoration:underline">политику конфиденциальности</a> и даю <a href="#/policy/consent" style="color:var(--blue);text-decoration:underline">согласие на обработку персональных данных</a></span></label>
      <button class="btn" id="go" disabled>Продолжить</button>
    </div>`;
    const nm = $("#nm"), dob = $("#dob"), ok = $("#ok"), btn = $("#go");
    const parseDob = (v) => { const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(v); if (!m) return null; const d = +m[1], mo = +m[2], y = +m[3]; const dt = new Date(y, mo - 1, d); return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d ? `${m[3]}-${m[2]}-${m[1]}` : null; };
    dob.addEventListener("input", () => {
      const dgt = dob.value.replace(/\D/g, "").slice(0, 8);
      dob.value = dgt.length > 4 ? `${dgt.slice(0, 2)}.${dgt.slice(2, 4)}.${dgt.slice(4)}` : dgt.length > 2 ? `${dgt.slice(0, 2)}.${dgt.slice(2)}` : dgt;
    });
    const check = () => { btn.disabled = !(nm.value.trim() && parseDob(dob.value) && ok.checked && st.gender); };
    app.querySelectorAll("[data-g]").forEach((b) => b.onclick = () => { st.gender = b.dataset.g; app.querySelectorAll("[data-g]").forEach((x) => x.classList.toggle("on", x === b)); check(); });
    [nm, dob, ok].forEach((e) => { e.oninput = check; e.onchange = check; });
    btn.onclick = () => {
      const iso = parseDob(dob.value); const a = iso ? ageOf(iso) : null;
      if (a === null || a < 0 || a > 110) { toast("Проверь дату рождения"); return; }
      if (a < 18) { S.profile = { minor: true, at: now() }; save(); return go("#/adult"); }
      S.profile = { name: nm.value.trim(), gender: st.gender, dob: iso, consent: new Date().toISOString(), at: now() };
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
  const symByTitle = (t) => SY.find((x) => x.title.toLowerCase() === String(t).toLowerCase());
  const mine = (id) => S.myimg[id] || (S.myimg[id] = { text: "", links: [] });
  const hasMine = (id) => S.myimg[id] && (S.myimg[id].text || (S.myimg[id].links || []).length);
  function Dict(tab) {
    const my = tab === "my";
    let h = `<div class="stack">${back("#/lib", "Библиотека")}
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
  const track = (id) => MU.find((t) => t.id === id);
  const voiceById = (id) => VOICES.find((v) => v.id === id);
  const queue = () => ((M.qtab || M.tab) === "mine" ? S.playlist.map(track).filter(Boolean) : MU);
  const fmtMin = (sec) => Math.round(sec / 60) + " мин";
  async function wake(on) {
    try {
      if (on && "wakeLock" in navigator && !M.lock) { M.lock = await navigator.wakeLock.request("screen"); M.lock.addEventListener("release", () => { M.lock = null; }); }
      if (!on && M.lock) { await M.lock.release(); M.lock = null; }
    } catch (e) {}
  }
  // Голос поверх музыки: музыка и голос идут через общий микшер, чтобы приглушать музыку
  // (на iPhone громкость у audio менять нельзя — только через Web Audio).
  const DUCK = 0.35, VOICE_IN = 20000, BACK_UP = 20000;
  const V = window.__kartaV || (window.__kartaV = { st: "off", at: 0, end: 0, left: 0 }); // off · wait · play · after
  const MX = window.__kartaMix || (window.__kartaMix = { ac: null, gm: null, gv: null });
  function mixer() {
    if (MX.ac) { if (MX.ac.state === "suspended") MX.ac.resume().catch(() => {}); return true; }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return false;
      const ac = new Ctx();
      const gm = ac.createGain(), gv = ac.createGain();
      ac.createMediaElementSource(audio).connect(gm); gm.connect(ac.destination);
      ac.createMediaElementSource(vEl).connect(gv); gv.connect(ac.destination);
      MX.ac = ac; MX.gm = gm; MX.gv = gv;
      return true;
    } catch (e) { return false; }
  }
  function setVol(el, g, v) {
    v = Math.max(0, Math.min(1, v));
    if (MX.ac && g) { try { g.gain.setTargetAtTime(v, MX.ac.currentTime, 0.5); } catch (e) {} }
    else { try { el.volume = v; } catch (e) {} }
  }
  const voiceOn = () => { const vs = mset().voice, v = voiceById(vs.id); return vs.on && v && v.src ? v : null; };
  const voiceDur = () => { const v = voiceById(mset().voice.id) || {}; return (vEl.duration && isFinite(vEl.duration) ? vEl.duration : v.dur || 0) * 1000; };
  // таймер не меньше, чем идет голос
  function ensureTimer() {
    if (!M.end) return;
    if (V.st === "wait") M.end = Math.max(M.end, V.at + voiceDur() + BACK_UP);
    if (V.st === "play") M.end = Math.max(M.end, Date.now() + (voiceDur() - (vEl.currentTime || 0) * 1000) + BACK_UP);
  }
  function armVoice(delay) {
    const v = voiceOn(); if (!v) return;
    mixer();
    if (vEl.getAttribute("src") !== v.src) vEl.src = v.src;
    V.st = "wait"; V.at = Date.now() + delay; ensureTimer();
  }
  function startVoice() {
    const v = voiceOn(); if (!v) { V.st = "off"; return; }
    if (vEl.getAttribute("src") !== v.src) vEl.src = v.src;
    try { vEl.currentTime = 0; } catch (e) {}
    setVol(vEl, MX.gv, 1);
    vEl.play().catch(() => {});
    V.st = "play"; ensureTimer();
  }
  function voiceOff() { // «Только музыка»: голос стихает, музыка возвращается за 20 секунд
    if (V.st === "play") { setVol(vEl, MX.gv, 0); setTimeout(() => vEl.pause(), 1500); }
    V.st = V.st === "play" ? "after" : "off"; V.end = Date.now();
  }
  vEl.onended = () => { V.st = "after"; V.end = Date.now(); };
  function mixTick() {
    if (NOW.kind !== "music" || audio.paused) return;
    const t = Date.now();
    let duck = 1;
    if (V.st === "wait") { if (t >= V.at) startVoice(); else if (t >= V.at - 3000) duck = DUCK; }
    if (V.st === "play") duck = DUCK;
    if (V.st === "after") { const k = Math.min(1, (t - V.end) / BACK_UP); duck = DUCK + (1 - DUCK) * k; if (k >= 1) V.st = "off"; }
    let fade = 1;
    if (M.end && mset().fade) { const left = M.end - t; if (left < 30000) fade = Math.max(0, left / 30000); }
    setVol(audio, MX.gm, duck * fade);
    if (V.st === "play") setVol(vEl, MX.gv, fade);
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && !audio.paused) { wake(true); if (MX.ac && MX.ac.state === "suspended") MX.ac.resume().catch(() => {}); } });
  // Один звук на все приложение: музыка или подкаст. NOW — что сейчас в плеере.
  const NOW = window.__kartaNow || (window.__kartaNow = { kind: null, id: null });
  function playTrack(id, auto) {
    const t = track(id); if (!t) return;
    const starting = audio.paused || NOW.kind !== "music";
    if (!auto && starting) M.qtab = M.tab;
    if (NOW.kind !== "music" || M.cur !== id || !audio.src) { audio.src = t.src; M.cur = id; }
    NOW.kind = "music"; NOW.id = id;
    if (MX.ac) mixer();
    audio.playbackRate = 1;
    if (!auto) {
      const tm = mset().timer; M.end = tm ? Date.now() + tm * 60000 : 0;
      if (voiceOn()) {
        if (V.st === "off") armVoice(VOICE_IN);
        else if (V.st === "wait" && starting) { V.at = Date.now() + Math.max(V.left || 0, 3000); V.left = 0; }
        else if (V.st === "play") vEl.play().catch(() => {});
      }
      ensureTimer();
      setVol(audio, MX.gm, V.st === "play" ? DUCK : 1);
    }
    audio.play().catch(() => toast("Нажми ▶ еще раз"));
    try { if ("mediaSession" in navigator) navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: "Карта Глубины" }); } catch (e) {}
    wake(true); paintMini();
  }
  function stopMusic(full) {
    audio.pause(); M.end = 0; wake(false);
    if (V.st === "wait") V.left = Math.max(0, V.at - Date.now());
    if (V.st === "play") vEl.pause();
    if (full) { vEl.pause(); V.st = "off"; }
    setVol(audio, MX.gm, 1);
  }
  function closeAudio() {
    audio.pause(); M.end = 0; wake(false); vEl.pause(); V.st = "off"; setVol(audio, MX.gm, 1);
    if (NOW.kind === "pod") podSave(true);
    audio.removeAttribute("src"); try { audio.load(); } catch (e) {}
    NOW.kind = null; NOW.id = null; M.cur = null; paintMini(); paint();
  }
  audio.onended = () => {
    if (NOW.kind === "pod") { const st = podSt(NOW.id); st.done = true; st.pos = 0; save(); paint(); paintMini(); return; }
    const r = mset().repeat, q = queue(), i = q.findIndex((t) => t.id === M.cur);
    if (r === "one") { audio.currentTime = 0; audio.play(); return; }
    const nx = q[i + 1] || (r === "list" ? q[0] : null);
    if (nx) playTrack(nx.id, true);
    else if (V.st === "wait" || V.st === "play") playTrack(q[0].id, true); // голос еще идет — музыка не обрывается
    else { stopMusic(true); paint(); paintMini(); }
  };
  audio.onplay = audio.onpause = () => { paintMini(); paint(); };
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
      NOW.kind = "pod"; NOW.id = id;
      try { if ("mediaSession" in navigator) navigator.mediaSession.metadata = new MediaMetadata({ title: e.title, artist: "Настя Черемных · " + e.series.title }); } catch (x) {}
    }
    if (MX.ac) mixer(); setVol(audio, MX.gm, 1); audio.playbackRate = S.podRate || 1;
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
    if (hide) { mini.className = ""; mini.innerHTML = ""; mini._h = ""; return; }
    let title, sub, prog = null, href;
    if (NOW.kind === "music") {
      const t = track(NOW.id) || {}; title = t.title || "Музыка"; href = "#/music";
      const left = M.end ? Math.max(0, Math.ceil((M.end - Date.now()) / 60000)) : 0;
      sub = audio.paused ? "пауза" : (V.st === "play" ? "с голосом · " : "") + (left ? "таймер " + left + " мин" : "играет");
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
  function voiceSheet(onDone) {
    const vs = mset().voice;
    let pick = voiceById(vs.id) && !voiceById(vs.id).soon ? vs.id : (VOICES.find((v) => !v.soon) || {}).id;
    const bg = document.createElement("div"); bg.className = "sheet-bg";
    const draw = () => {
      bg.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="vsh"><div class="grip"></div>
        <h2 id="vsh" style="font-size:19px">Голосовое сопровождение</h2>
        <p class="small" style="margin-top:-6px">Ляжет поверх любой музыки: сначала немного музыки, потом голос, потом снова только музыка.</p>
        <div class="stack" style="gap:8px">${VOICES.map((v) => `<button type="button" class="vopt${v.id === pick ? " on" : ""}${v.soon ? " soon" : ""}" data-v="${v.id}"><span class="rad"></span><span class="t"><b>${esc(v.title)}</b><span>${esc(v.sub || "")}${v.soon ? " · скоро" : v.dur ? " · " + fmtMin(v.dur) : ""}</span></span></button>`).join("")}</div>
        <button class="btn" id="von"${pick ? "" : " disabled"}>Включить</button></div>`;
      bg.querySelectorAll("[data-v]").forEach((b) => b.onclick = () => {
        const v = voiceById(b.dataset.v);
        if (v.soon) { toast("Эта запись появится скоро"); return; }
        pick = v.id; draw();
      });
      const on = bg.querySelector("#von");
      if (on) on.onclick = () => {
        const was = vs.on && vs.id;
        vs.id = pick; vs.on = true; save(); haptic(); bg.remove();
        if (NOW.kind === "music" && !audio.paused) {
          if (V.st === "play" && was !== pick) { vEl.pause(); V.st = "off"; }
          if (V.st === "off" || V.st === "after") armVoice(5000);
        }
        onDone();
      };
    };
    draw();
    bg.onclick = (e) => { if (e.target === bg) bg.remove(); };
    document.body.appendChild(bg);
  }
  function Music() {
    const st = mset();
    const draw = () => {
      const q = M.tab === "mine" ? S.playlist.map(track).filter(Boolean) : MU;
      const vs = st.voice, vv = vs.on ? voiceById(vs.id) : null;
      app.innerHTML = `<div class="stack" style="gap:14px">${back("#/lib", "Библиотека")}
        <div class="stack" style="gap:4px"><h1>Музыкальное сопровождение</h1><div class="small">Для сна, практик и чтобы побыть с собой</div></div>
        <div class="vplate"><button type="button" class="vbody" id="vpick">${MIC}<span class="t"><b>С голосом</b>${vv ? `<span class="on">${esc(vv.title)} <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#A9CBB3" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg></span>` : `<span>выбрать, что будет звучать</span>`}</span></button>
          <button type="button" class="tgl${vs.on ? " on" : ""}" id="vtgl" role="switch" aria-checked="${vs.on}" aria-label="С голосом"><i></i></button></div>
        <div class="seg2"><a href="#" data-tab="all" class="${M.tab === "all" ? "on" : ""}">Вся музыка</a><a href="#" data-tab="mine" class="${M.tab === "mine" ? "on" : ""}">Мой плейлист · ${S.playlist.length}</a></div>
        <div id="now"></div>
        ${q.length ? `<div class="row" style="gap:8px"><button type="button" class="btn" id="pall" style="flex:1;padding:12px 0;font-size:15px;display:flex;align-items:center;justify-content:center;gap:8px"><svg width="14" height="14" viewBox="0 0 24 24" fill="#0F1E33" aria-hidden="true"><path d="M7 4l13 8-13 8z"/></svg>Слушать все</button><button type="button" class="btn ghost" id="ploop" style="width:auto;padding:12px 14px;display:flex;align-items:center;gap:6px">${REP("#9FB2C8")}по кругу</button></div>` : ""}
        <div class="stack" style="gap:8px">${q.length ? q.map((t) => `<div class="trk${M.cur === t.id ? " cur" : ""}">
          <button type="button" class="tbody" data-play="${t.id}"><span class="ti">${M.cur === t.id && !audio.paused ? icon.pauseS : icon.note}</span><span class="t"><b>${esc(t.title)}</b><span>${fmtMin(t.dur)}${t.tag ? " · " + esc(t.tag) : ""}</span></span></button>
          <button type="button" class="add${S.playlist.includes(t.id) ? " in" : ""}" data-add="${t.id}" aria-label="${S.playlist.includes(t.id) ? "Убрать из плейлиста" : "Добавить в плейлист"}">${S.playlist.includes(t.id) ? icon.checkS : icon.plus}</button></div>`).join("") : `<div class="card dashed"><div class="small">Плейлист пока пуст. Во вкладке «Вся музыка» нажми «+» у треков, которые хочешь сюда.</div></div>`}</div>
        ${M.tab === "all" ? `<div class="small center" style="font-size:12px;color:var(--dim)">Нажми «+», чтобы собрать свой плейлист</div>` : ""}
        <div class="tmr" id="tmr">${MOONS("#9FB2C8")}<span class="t"><span>Таймер сна</span><span class="small" style="font-size:12px">шаг 10 минут</span></span>
          <button type="button" class="pm" id="tminus" aria-label="Меньше">−</button><b id="tval">${st.timer ? st.timer + " мин" : "выкл"}</b><button type="button" class="pm" id="tplus" aria-label="Больше">+</button></div>
        <a class="small center" href="#" id="chan" style="min-height:44px;display:flex;align-items:center;justify-content:center">Эта музыка есть и в канале ↗</a>
      </div>`;
      app.querySelectorAll("[data-tab]").forEach((b) => b.onclick = (e) => { e.preventDefault(); M.tab = b.dataset.tab; draw(); });
      app.querySelectorAll("[data-play]").forEach((b) => b.onclick = () => { const id = b.dataset.play; if (M.cur === id && !audio.paused) stopMusic(); else { if (M.cur !== id || audio.paused) M.qtab = M.tab; playTrack(id); } draw(); });
      app.querySelectorAll("[data-add]").forEach((b) => b.onclick = () => { const id = b.dataset.add, i = S.playlist.indexOf(id); i >= 0 ? S.playlist.splice(i, 1) : S.playlist.push(id); save(); haptic(); draw(); });
      const startAll = (rep) => { st.repeat = rep; save(); if (!audio.paused && NOW.kind === "music") stopMusic(); M.qtab = M.tab; playTrack(q[0].id); draw(); };
      if ($("#pall")) { $("#pall").onclick = () => startAll("none"); $("#ploop").onclick = () => startAll("list"); }
      $("#vpick").onclick = () => voiceSheet(draw);
      $("#vtgl").onclick = () => {
        if (vs.on) { vs.on = false; save(); if (V.st !== "off") voiceOff(); draw(); }
        else voiceSheet(draw);
      };
      const setT = (v) => { st.timer = Math.max(0, Math.min(180, v)); save(); $("#tval").textContent = st.timer ? st.timer + " мин" : "выкл"; if (NOW.kind === "music" && !audio.paused) { M.end = st.timer ? Date.now() + st.timer * 60000 : 0; ensureTimer(); } paint(); };
      $("#tminus").onclick = () => setT(st.timer - 10);
      $("#tplus").onclick = () => setT(st.timer + 10);
      $("#chan").onclick = (e) => { e.preventDefault(); toast("Ссылку на канал добавим перед запуском"); };
      paint = () => {
        const el = $("#now"); if (!el || M.drag) return;
        const t = track(M.cur); if (!t || NOW.kind !== "music") { el.innerHTML = ""; return; }
        const pq = queue(), pi = pq.findIndex((x) => x.id === t.id);
        const d = audio.duration && isFinite(audio.duration) ? audio.duration : t.dur, c = audio.currentTime || 0;
        const left = M.end ? Math.max(0, Math.ceil((M.end - Date.now()) / 60000)) : 0;
        const sub = (pq.length > 1 && pi >= 0 ? pi + 1 + " из " + pq.length + " · " : "") + (audio.paused ? "пауза" : left ? "затихнет через " + left + " мин" : "играет");
        let vrow = "";
        if (V.st === "wait" || V.st === "play") {
          const vd = voiceDur() / 1000, vc = vEl.currentTime || 0;
          const txt = V.st === "wait" ? "Голос начнется через " + fmt(Math.max(0, ((audio.paused ? V.left : V.at - Date.now()) || 0) / 1000)) : "Голос · " + fmt(vc) + " из " + fmt(vd);
          vrow = `<div class="vrow"><span class="eq${V.st === "play" && !audio.paused ? " live" : ""}"><i></i><i></i><i></i><i></i><i></i></span><span style="flex:1">${txt}</span><button type="button" id="vonly">Только музыка</button></div>`;
        }
        const r = st.repeat || "list";
        el.innerHTML = `<div class="mplayer"><div class="stack" style="gap:2px"><b style="font-size:17px">${esc(t.title)}</b><span class="small" style="font-size:12px;color:var(--blue)">${sub}</span></div>
          ${vrow}
          <input id="ms" type="range" min="0" max="${Math.floor(d)}" value="${Math.floor(c)}" aria-label="Перемотка"><div class="times"><span>${fmt(c)}</span><span>${fmt(d)}</span></div>
          <div class="mctl"><button type="button" class="side" id="mrep" aria-label="Повтор: ${REP_LABEL[r]}"><span class="ring${r !== "none" ? " on" : ""}">${REP(r !== "none" ? "#8CC4E8" : "#7F93AA", r === "one")}</span><span class="lb">${REP_LABEL[r]}</span></button>
          <button type="button" class="nav" id="mprev" aria-label="Предыдущий"><svg width="22" height="22" viewBox="0 0 24 24" fill="#C3D0DE"><path d="M6 5h2v14H6zM20 5v14L9 12z"/></svg></button>
          <button type="button" class="big" id="mp" aria-label="${audio.paused ? "Играть" : "Пауза"}">${audio.paused ? icon.play : icon.pause}</button>
          <button type="button" class="nav" id="mnext" aria-label="Следующий"><svg width="22" height="22" viewBox="0 0 24 24" fill="#C3D0DE"><path d="M16 5h2v14h-2zM4 5v14l11-7z"/></svg></button>
          <button type="button" class="side" id="mtm" aria-label="Таймер"><span class="ring">${MOONS(M.end ? "#8CC4E8" : "#7F93AA")}</span><span class="lb">${M.end && !audio.paused ? left + " мин" : st.timer ? st.timer + " мин" : "выкл"}</span></button></div></div>`;
        const ms = $("#ms");
        ms.oninput = () => { M.drag = true; };
        ms.onchange = (e) => { audio.currentTime = Number(e.target.value); M.drag = false; };
        $("#mp").onclick = () => { if (audio.paused) playTrack(M.cur); else stopMusic(); draw(); };
        $("#mrep").onclick = () => { st.repeat = { none: "list", list: "one", one: "none" }[r]; save(); haptic(); paint(); };
        const step = (k) => { if (!pq.length) return; const j = (pi + k + pq.length) % pq.length; const was = !audio.paused; playTrack(pq[j].id, true); if (!was) { M.end = st.timer ? Date.now() + st.timer * 60000 : 0; } draw(); };
        $("#mprev").onclick = () => { if (c > 5) { audio.currentTime = 0; return; } step(-1); };
        $("#mnext").onclick = () => step(1);
        $("#mtm").onclick = () => { const tm = $("#tmr"); if (tm) tm.scrollIntoView({ behavior: "smooth", block: "center" }); };
        if ($("#vonly")) $("#vonly").onclick = () => { voiceOff(); haptic(); paint(); };
      };
      paint();
    };
    draw();
  }

  // ---------- подкасты: экраны ----------
  function Pods() {
    let h = `<div class="stack">${back("#/lib", "Библиотека")}
      <div class="stack" style="gap:6px"><h1>Подкасты</h1><div class="small">Теория и письменные практики. Записи сохраняются сами.</div></div>`;
    if (!PODS.length) h += `<p class="lead">Подкасты появятся после подключения.</p>`;
    PODS.forEach((se) => {
      const n = se.episodes.filter((e) => e.src).length, d = se.episodes.filter((e) => podSt(e.id).done).length;
      h += `<a class="card" href="#/series/${se.id}" style="gap:6px;padding:18px"><div class="row" style="justify-content:space-between"><span class="kicker" style="letter-spacing:.08em">СЕРИЯ</span><span class="small" style="color:var(--sage)">${d} из ${n}</span></div><div style="font-weight:800;font-size:19px">${esc(se.title)}</div><div class="small">${esc(se.short || "")}</div></a>`;
    });
    app.innerHTML = h + `</div>`;
  }
  // обложка серии: пять этапов — пять звезд на орбитах вокруг солнца (Самости); пройденные горят
  function seriesCover(se) {
    const orb = [[76, 60, 0, 4], [62, 44, 140, 3.5], [48, 32, 250, 3.5], [34, 22, 40, 3], [20, 14, 200, 3]];
    const stages = se.episodes.filter((e) => e.n);
    let g = orb.map((o) => `<circle cx="175" cy="85" r="${o[0]}" fill="none" stroke="#2A4263"/>`).join("");
    g += orb.map((o, i) => { const e = stages[i], lit = e && podSt(e.id).done, c = lit ? "#8CC4E8" : "#3A5578";
      return `<g transform="rotate(${o[2]} 175 85)"><g class="orbit" style="animation-duration:${o[1]}s"><circle cx="175" cy="${85 - o[0]}" r="${o[3] + 4}" fill="${c}" opacity=".15"/><circle cx="175" cy="${85 - o[0]}" r="${o[3]}" fill="${c}"/></g></g>`; }).join("");
    return `<svg width="100%" viewBox="0 0 350 170" aria-hidden="true" style="display:block;border-radius:20px;background:var(--card2)">
      <defs><radialGradient id="sun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#A9CBB3" stop-opacity=".55"/><stop offset="1" stop-color="#A9CBB3" stop-opacity="0"/></radialGradient></defs>
      <circle class="tw" cx="52" cy="40" r="1.5" fill="#F0C7B5"/><circle class="tw" style="animation-delay:-2s" cx="300" cy="30" r="1.5" fill="#E8EEF4"/><circle class="tw" style="animation-delay:-4s" cx="310" cy="140" r="1.5" fill="#F0C7B5"/><circle class="tw" style="animation-delay:-1s" cx="40" cy="128" r="1.2" fill="#E8EEF4"/><circle cx="270" cy="150" r="1" fill="#E8EEF4"/><circle cx="85" cy="18" r="1" fill="#E8EEF4"/>
      ${g}
      <path class="flow" d="M175.0 9.0 L181.9 9.8 L188.7 11.2 L195.2 13.2 L201.6 15.8 L207.6 18.9 L213.2 22.6 L218.5 26.7 L223.4 31.3 L227.7 36.3 L231.6 41.6 L234.9 47.2 L237.7 53.0 L240.0 59.1 L241.6 65.3 L242.7 71.5 L243.2 77.8 L243.1 84.1 L242.4 90.3 L241.2 96.4 L239.4 102.3 L237.1 107.9 L234.3 113.3 L231.1 118.4 L227.4 123.1 L223.4 127.4 L219.0 131.3 L214.3 134.8 L209.3 137.8 L204.1 140.3 L198.7 142.3 L193.2 143.8 L187.7 144.7 L182.1 145.2 L176.6 145.1 L171.1 144.5 L165.7 143.5 L160.5 141.9 L155.6 139.9 L150.8 137.5 L146.3 134.7 L142.2 131.4 L138.4 127.9 L134.9 124.0 L131.9 119.9 L129.3 115.6 L127.1 111.0 L125.3 106.3 L124.0 101.6 L123.2 96.7 L122.8 91.9 L122.8 87.0 L123.3 82.3 L124.3 77.6 L125.6 73.1 L127.3 68.8 L129.4 64.7 L131.9 60.9 L134.7 57.3 L137.7 54.0 L141.1 51.1 L144.6 48.5 L148.3 46.2 L152.2 44.3 L156.2 42.9 L160.3 41.8 L164.4 41.0 L168.6 40.7 L172.7 40.8 L176.7 41.2 L180.7 42.0 L184.5 43.2 L188.1 44.7 L191.6 46.5 L194.8 48.6 L197.8 50.9 L200.5 53.5 L203.0 56.3 L205.1 59.3 L207.0 62.4 L208.5 65.7 L209.7 69.0 L210.6 72.4 L211.1 75.8 L211.3 79.2 L211.3 82.6 L210.9 85.9 L210.2 89.2 L209.2 92.3 L207.9 95.2 L206.4 98.0 L204.7 100.6 L202.7 103.0 L200.6 105.2 L198.3 107.1 L195.9 108.8 L193.3 110.2 L190.7 111.4 L188.0 112.3 L185.3 113.0 L182.6 113.3 L179.9 113.4 L177.2 113.3 L174.6 112.9 L172.1 112.3 L169.7 111.5 L167.5 110.4 L165.3 109.2 L163.4 107.8 L161.6 106.3 L160.0 104.6 L158.6 102.8 L157.4 100.9 L156.4 98.9 L155.6 96.9 L155.0 94.9 L154.6 92.8 L154.4 90.8 L154.4 88.8 L154.6 86.9 L155.0 85.0" fill="none" stroke="#8CC4E8" stroke-width="1.4" stroke-dasharray="3 6" stroke-linecap="round" opacity=".55"/>
      <circle class="sunglow" cx="175" cy="85" r="20" fill="url(#sun)"/><circle cx="175" cy="85" r="5" fill="#A9CBB3"/></svg>`;
  }
  function Series(sid) {
    const se = PODS.find((x) => x.id === sid); if (!se) return go("#/pod");
    const cur = se.episodes.find((e) => e.src && !podSt(e.id).done);
    let h = `<div class="stack" style="gap:20px">${back("#/pod", "Подкасты")}${seriesCover(se)}
      <div class="stack" style="gap:8px"><div class="kicker" style="letter-spacing:.08em">${esc(se.kicker || "СЕРИЯ")}</div><h1>${esc(se.title)}</h1><p class="lead">${esc(se.desc)}</p><div class="small">${se.episodes.length} выпусков · письменная практика к каждому</div></div>
      ${se.order ? `<div class="card sage" style="flex-direction:row;gap:10px;align-items:flex-start;font-size:13px;line-height:1.5;color:#D3E4D8;padding:12px 14px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A9CBB3" stroke-width="2" stroke-linecap="round" style="flex-shrink:0;margin-top:1px" aria-hidden="true"><path d="M4 6h16M4 12h10M4 18h6"/></svg><span>${esc(se.order)}</span></div>` : ""}
      <div class="stack" style="gap:8px">`;
    se.episodes.forEach((e) => {
      const st = podSt(e.id), soon = !e.src, isCur = cur && cur.id === e.id;
      const num = e.n ? String(e.n) : "";
      const badge = st.done ? `<span class="epn done">${icon.check}</span>` : soon ? `<span class="epn soon">${num}</span>` : `<span class="epn${isCur ? " cur" : ""}">${num || "•"}</span>`;
      const meta = soon ? "скоро" : Math.round(e.dur / 60) + " мин";
      const prog = !st.done && st.pos > 5 && e.dur ? `<span class="row" style="gap:8px;margin-top:6px"><span class="bar"><span style="width:${Math.min(100, (st.pos / e.dur) * 100).toFixed(0)}%"></span></span><span class="small" style="color:var(--blue);font-weight:700">с ${fmt(st.pos)}</span></span>` : "";
      const inner = `${badge}<span class="t"><b>${esc(e.title)}</b><span>${esc(e.sub)} · ${meta}</span>${prog}</span>`;
      h += soon ? `<div class="ep soon">${inner}</div>` : `<a class="ep${isCur ? " cur" : st.done ? " done" : ""}" href="#/ep/${e.id}">${inner}</a>`;
    });
    app.innerHTML = h + `</div></div>`;
  }
  function Episode(id) {
    const e = epById(id); if (!e || !e.src) return go("#/pod");
    const se = e.series, st = podSt(id);
    app.innerHTML = `<div class="stack" style="gap:22px">${back("#/series/" + se.id, se.title)}
      <div class="stack" style="gap:6px"><div class="kicker" style="letter-spacing:.08em">${e.n ? `ЭТАП ${e.n} ИЗ ${se.episodes.filter((x) => x.n).length}` : "ВВОДНЫЙ ВЫПУСК"}</div><h1 style="font-size:30px">${esc(e.title)}</h1><p class="lead">${esc(e.desc)}</p></div>
      <div class="pplayer" id="pp-box"></div>
      <div id="prac"></div></div>`;
    paint = () => {
      const box = $("#pp-box"); if (!box) return;
      const mine = NOW.kind === "pod" && NOW.id === id && audio.src;
      const d = (mine && audio.duration) || e.dur, c = mine ? audio.currentTime || 0 : st.done ? 0 : st.pos || 0;
      const playing = mine && !audio.paused;
      const rate = S.podRate || 1;
      const html = `<div class="row" style="gap:14px"><button class="play sm" id="epp" aria-label="${playing ? "Пауза" : "Слушать"}">${playing ? icon.pause : icon.play}</button>
        <div style="flex:1;display:flex;flex-direction:column;gap:2px"><input id="eps" type="range" min="0" max="${Math.floor(d)}" value="${Math.floor(c)}" aria-label="Перемотка"><div class="times"><span>${fmt(c)}</span><span>${fmt(d)}</span></div></div></div>
        <div class="row" style="justify-content:center;gap:10px"><button class="pill" id="epr">−15 с</button><button class="pill" id="eprate">${String(rate).replace(".", ",")}×</button><button class="pill" id="epf">+15 с</button></div>`;
      if (box._h === html) return; box._h = html; box.innerHTML = html;
      $("#epp").onclick = () => { if (playing) { audio.pause(); podSave(true); } else playEp(id); paint(); };
      const jump = (k) => { if (mine) { audio.currentTime = Math.max(0, Math.min(d, audio.currentTime + k)); } else { st.pos = Math.max(0, Math.min(d, (st.pos || 0) + k)); st.done = false; save(); } paint(); };
      $("#epr").onclick = () => jump(-15); $("#epf").onclick = () => jump(15);
      $("#eprate").onclick = () => { const rs = [1, 1.25, 1.5, 0.75], nx = rs[(rs.indexOf(rate) + 1) % rs.length]; S.podRate = nx; save(); if (mine) audio.playbackRate = nx; paint(); };
      $("#eps").onchange = (ev) => { const v = Number(ev.target.value); if (mine) audio.currentTime = v; else { st.pos = v; st.done = false; save(); } paint(); };
    };
    paint();
    drawPractice(e);
  }
  // письменная практика к выпуску: ответы сохраняются сами
  function drawPractice(e) {
    const box = $("#prac"); if (!box) return;
    const P = e.practice, st = podSt(e.id), A = st.ans || (st.ans = {});
    if (!P) { box.innerHTML = e.noPractice ? `<div class="small center">${esc(e.noPractice)}</div>` : ""; return; }
    const part = Math.min(A._part || 0, P.parts.length - 1), pt = P.parts[part];
    const ta = (k, ph, rows) => `<textarea data-a="${k}" rows="${rows || 3}" placeholder="${esc(ph || "Первое, что приходит…")}">${esc(A[k] || "")}</textarea>`;
    const stepHead = (n, s) => `<div class="sn"><i>${n}</i><b>${esc(s.q)}</b></div>${s.hint ? `<div class="hint">${esc(s.hint)}</div>` : ""}`;
    const bansOf = (ans) => ((ans && ans.roles) || []).map((x) => (x.b || "").trim()).filter(Boolean);
    let h = `<div class="stack" style="gap:22px"><div style="height:1px;background:var(--card3)"></div>
      <div class="stack" style="gap:6px"><div class="row" style="justify-content:space-between;align-items:baseline"><span class="kicker" style="letter-spacing:.08em;color:var(--sage);font-weight:700">ПИСЬМЕННАЯ ПРАКТИКА</span><span class="small">${esc(P.mins || "")}</span></div><h2 style="font-size:22px">${esc(P.title)}</h2></div>`;
    if (P.parts.length > 1) h += `<div class="seg2 ptabs">${P.parts.map((x, i) => `<a href="#" data-part="${i}" class="${i === part ? "on" : ""}">${i + 1}. ${esc(x.tab || x.title)}</a>`).join("")}</div>`;
    if (pt.intro) h += `<p class="lead" style="font-size:14px">${esc(pt.intro)}</p>`;
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
        h += s.line ? `<input class="inp" data-a="${k}" value="${esc(A[k] || "")}" placeholder="${esc(s.ph || "")}">` : ta(k, s.ph, s.rows);
      }
      h += `</div>`;
    });
    if (pt.outro) h += `<p class="quote">${esc(pt.outro)}</p>`;
    if (P.parts.length > 1 && part < P.parts.length - 1) h += `<a href="#" class="link-row" data-part="${part + 1}"><span class="stack" style="gap:3px"><b>Часть ${part + 2}. ${esc(P.parts[part + 1].title)}</b>${P.parts[part + 1].lead ? `<span class="small" style="font-weight:400">${esc(P.parts[part + 1].lead)}</span>` : ""}</span>${icon.chev}</a>`;
    if (P.quote) h += `<p class="quote">${esc(P.quote)}</p>`;
    if (P.link) h += `<button type="button" class="card blue linkcard" id="plink"><span class="t"><b>${esc(P.link.title)}</b><span class="small">${esc(P.link.sub)}</span></span>${icon.chev}</button>`;
    if (P.note) h += `<div class="row small" style="align-items:flex-start"><span style="flex-shrink:0;margin-top:2px">${icon.checkS}</span><span>${esc(P.note)}</span></div>`;
    box.innerHTML = h + `</div>`;
    // события
    let deb;
    const store = () => { clearTimeout(deb); deb = setTimeout(save, 400); };
    box.querySelectorAll("[data-a]").forEach((t) => t.oninput = () => { A[t.dataset.a] = t.value; store(); });
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
  function Body(kind, key, side) {
    const H0 = bodyHost(kind, key); if (!H0) return go("#/");
    side = side === "back" ? "back" : "front";
    const B = H0.obj.body || (H0.obj.body = {});
    const zs = ZONES[side], marked = Object.keys(B);
    const svg = `<svg class="bodysvg" viewBox="0 0 200 420" role="img" aria-label="Силуэт ${side === "front" ? "спереди" : "со спины"}">
      ${side === "back" ? `<g stroke="#2A4263" stroke-width="1.5" stroke-dasharray="3 3" fill="none">${BACK_GHOST.map((d) => `<path d="${d}"/>`).join("")}</g>` : ""}
      <g stroke-width="1.5" stroke-linejoin="round">${zs.map((z) => `<path class="zone${B[z[0]] ? " on" : ""}" data-z="${z[0]}" d="${z[2]}"><title>${z[1]}</title></path>`).join("")}</g></svg>`;
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

  // ---------- если плохо: поймать слово ----------
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
      <a class="choice terra" href="#/catch"><span class="t"><b>Накрыло сейчас</b><span>жжет, кипит, сжимает — ярко и прямо сейчас</span><span class="meta">1–2 минуты · поймать слово</span></span>${icon.chev}</a>
      <a class="choice" href="#/deep"><span class="t"><b>Тянется давно</b><span>фон, туман, «что-то не так», но непонятно что</span><span class="meta">10–15 минут · через образ · скоро</span></span>${icon.chev}</a>
      <p class="small center">Сложно выбрать? Начни с первого — оттуда можно перейти ко второму.</p></div>`;
  }
  function Deep() {
    app.innerHTML = `<div class="stack">${back("#/gate", "Назад")}
      <h1>Путь через образ</h1><p class="lead">Время года, погода, воспоминание — этот путь появится в следующей версии.</p>
      <p class="lead">Пока можно поймать слово через таблицу чувств: иногда имя находится и для того, что тянется давно.</p>
      <a class="btn" href="#/feels">Открыть таблицу чувств</a></div>`;
  }
  function Catch(dir, opt) {
    if (!dir) {
      app.innerHTML = `<div class="stack">${back("#/gate", "Назад")}
        <div class="stack" style="gap:6px"><div class="kicker terra">Накрыло сейчас · поймать слово</div><h1>Плохо, а что — не понять?</h1><p class="lead" style="font-size:14px">Это не пустота, а клубок из нескольких чувств, сваренных в один суп. Распутаем за три шага.</p></div>
        <div class="card blue" style="padding:16px"><div style="font-size:15px">Закрой глаза на 10 секунд и почувствуй: <b>куда течет энергия?</b></div></div>
        <a class="choice terra" href="#/catch/up"><span class="ic">${arrow("up")}</span><span class="t"><b>Вверх</b><span>хочется кричать, бежать, что-то швырнуть</span></span>${icon.chev}</a>
        <a class="choice" href="#/catch/down"><span class="ic">${arrow("down")}</span><span class="t"><b>Вниз</b><span>хочется выключиться, свернуться, под одеяло</span></span>${icon.chev}</a>
        <a class="choice dashed" href="#/deep"><span class="t"><b>Никуда — ничего не чувствую</b><span>замерло, пусто, не понимаю, о чем речь</span></span>${icon.chev}</a>
        <a class="link-row" href="#/feels" style="justify-content:center;border-style:dashed;color:var(--blue)">Не понимаю — покажи всю таблицу</a></div>`;
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
      <div class="choice dashed" style="opacity:.75"><span class="t"><b>Посмотреть на это через образ</b><span>острое прошло — а откуда оно? Время года, погода, воспоминание · скоро</span></span></div>
      <a class="btn ghost" href="#/">На главную</a></div>`;
  }


  // ---------- день: «Как ты?», сон, символ дня ----------
  const dkey = (ts) => { const d = new Date(ts || now()); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  if (!S.days) S.days = {}; if (!S.dreams) S.dreams = {}; if (!S.sym) S.sym = {};
  const today = () => S.days[dkey()] || (S.days[dkey()] = { zones: {}, feel: {}, want: [], before: [] });
  const isNight = () => { const h = new Date(now()).getHours(); return h >= 22 || h < 5; };
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
      <span class="t"><span class="small">Если сложно заснуть</span><b>Музыкальное сопровождение</b><span class="small" style="color:var(--blue)">${mset().timer ? "таймер " + mset().timer + " мин · " : ""}экран не гаснет</span></span>${icon.chev}</a>`;
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
    app.innerHTML = `<div class="stack">${back("#/", "Сегодня")}<h1>Заглянуть в себя</h1><div class="howcard" style="padding-top:14px">${insideRows()}</div></div>`;
  }
  // «Как я сегодня»: тело → ощущение → чувство → хочется → откуда
  const SENS_GROUPS = [["ДАВЛЕНИЕ", ["тяжесть", "сжатие", "ком", "распирание"]], ["ТЕМПЕРАТУРА", ["тепло", "жар", "холод"]], ["ДВИЖЕНИЕ", ["дрожь", "пульсация", "покалывание", "хочется двигаться"]], ["ПУСТОТА", ["онемение", "пустота", "как будто не мое"]], ["ПРОСТОР", ["легкость", "расслабление", "мягкость"]]];
  const FEEL_BASE = { "злость": ["раздражение", "досада", "гнев", "ярость", "возмущение", "ревность"], "страх": ["тревога", "беспокойство", "испуг", "растерянность", "опасение", "ужас"], "грусть": ["печаль", "обида", "одиночество", "тоска", "разочарование", "сожаление", "бессилие"], "стыд": ["вина", "смущение", "неловкость", "унижение"], "радость": ["облегчение", "спокойствие", "воодушевление", "благодарность", "интерес"], "нежность": ["тепло", "любовь", "жалость", "трогательность"] };
  const WANTS = ["отдохнуть", "сказать вслух", "тепла", "тишины", "подвигаться", "поплакать", "чтобы обняли", "выйти на воздух", "побыть в одиночестве"];
  const chipSel = (list, sel, attr, cls) => list.map((x) => `<button type="button" class="chip${sel.includes(x) ? " " + (cls || "terraon") : ""}" data-${attr}="${esc(x)}">${esc(x)}</button>`).join("");
  function Today(step, i) {
    const D = today();
    if (!step) {
      // тело: отметить места
      const side = i === "back" ? "back" : "front", zs = ZONES[side], marked = Object.keys(D.zones);
      app.innerHTML = `<div class="stack" style="gap:12px;padding-bottom:190px">
        <div class="row" style="justify-content:space-between">${back("#/", "Сегодня")}<div class="seg2 mini2"><a href="#/today/body/front" class="${side === "front" ? "on" : ""}">Спереди</a><a href="#/today/body/back" class="${side === "back" ? "on" : ""}">Сзади</a></div></div>
        <div class="stack" style="gap:4px"><h1 style="font-size:24px">Где сегодня откликается тело?</h1><div class="small">Отметь места, где что-то ощущается — напряжение, тепло, пустота</div></div>
        <div class="bodywrap"><span style="left:6px">${side === "front" ? "правая" : "левая"}</span><span style="right:6px">${side === "front" ? "левая" : "правая"}</span>
        <svg class="bodysvg" viewBox="0 0 200 420" role="img" aria-label="Силуэт">${side === "back" ? `<g stroke="#2A4263" stroke-width="1.5" stroke-dasharray="3 3" fill="none">${BACK_GHOST.map((d) => `<path d="${d}"/>`).join("")}</g>` : ""}<g stroke-width="1.5" stroke-linejoin="round">${zs.map((z) => `<path class="zone${D.zones[z[0]] ? " on" : ""}" data-tz="${z[0]}" d="${z[2]}"><title>${z[1]}</title></path>`).join("")}</g></svg></div></div>
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
      app.innerHTML = `<div class="stack">${back(n ? "#/today/z/" + (n - 1) : "#/today/body/front", n ? "Назад" : "Тело")}
        <div class="stack" style="gap:6px"><div class="kicker terra">${esc(name)} · ${n + 1} из ${ks.length}</div><h1 style="font-size:26px">Как ощущается здесь?</h1><p class="small">Трудно назвать — это нормально. Выбери то, что хоть немного похоже. Можно несколько.</p></div>
        ${SENS_GROUPS.map((g) => `<div class="stack" style="gap:8px"><span class="kicker" style="letter-spacing:.08em;font-size:11px">${g[0]}</span><div class="chips">${chipSel(g[1], Z.sense, "s")}</div></div>`).join("")}
        <div class="stack" style="gap:8px"><span class="kicker" style="letter-spacing:.08em;font-size:11px">СВОИ СЛОВА</span>${(S.ownSense || []).length ? `<div class="chips">${chipSel(S.ownSense, Z.sense, "s")}</div>` : ""}
          <div class="row"><input class="inp" id="sadd" placeholder="+ свое ощущение" maxlength="30"><button type="button" class="pill" id="saddb" style="min-height:48px">Добавить</button></div></div>
        <div class="stack" style="gap:8px"><b style="font-size:15px">Насколько сильно</b><div class="seg3">${["едва", "заметно", "очень сильно"].map((x) => `<button type="button" data-pw="${x}" class="${Z.power === x ? "on" : ""}">${x}</button>`).join("")}</div></div>
        <label class="q"><b>Если бы у ощущения была форма или цвет</b><input class="inp" id="form" value="${esc(Z.form)}" placeholder="тугой узел, темно-синий…"></label>
        <a class="btn" href="#/today/z/${n + 1}">Дальше</a></div>`;
      app.querySelectorAll("[data-s]").forEach((b) => b.onclick = () => { const x = b.dataset.s, k = Z.sense.indexOf(x); k >= 0 ? Z.sense.splice(k, 1) : Z.sense.push(x); b.classList.toggle("terraon"); save(); });
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
  function Dream() {
    const D = S.dreams[dkey()] || (S.dreams[dkey()] = { text: "", images: [], assoc: "", feel: [] });
    const FE = ["любопытство", "тревога", "легкость", "грусть", "покой", "растерянность"];
    const d = new Date(now()), mon = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
    const draw = () => {
      const first = D.images[0];
      app.innerHTML = `<div class="stack">${back("#/", "Сегодня")}
        <div class="stack" style="gap:6px"><div class="kicker">${d.getHours() < 12 ? "Утро" : "Сегодня"} · ${d.getDate()} ${mon[d.getMonth()]}</div><h1>Что снилось?</h1><p class="small">Без толкований — только то, что было, и твои ассоциации.</p></div>
        <label class="q"><b>Сон</b><textarea id="dtx" rows="5" placeholder="Что было, где ты, кто рядом…">${esc(D.text)}</textarea></label>
        <div class="stack" style="gap:8px"><b style="font-size:15px">Главные образы</b>
          <div class="chips">${D.images.map((x, j) => { const y = symByTitle(x); return `<span class="chip on sm">${y ? `<a href="#/sym/${y.id}" style="text-decoration:underline">${esc(x)}</a>` : esc(x)} <button type="button" data-dx="${j}" aria-label="Убрать" style="background:none;border:none;color:inherit;padding:0 0 0 4px">×</button></span>`; }).join("")}</div>
          <div class="row"><input class="inp" id="dimg" placeholder="образ: дом, дверь, вода…" maxlength="40"><button type="button" class="pill" id="dadd" style="min-height:48px">Добавить</button></div>
          <span class="small" style="font-size:12px">Образы, которые есть в словаре, становятся ссылками.</span></div>
        ${first ? `<label class="q"><b>Что первое приходит, если подумать о «${esc(first)}»?</b><textarea id="das" rows="2" placeholder="Первое, что приходит…">${esc(D.assoc)}</textarea></label>` : ""}
        <div class="stack" style="gap:8px"><b style="font-size:15px">Чувство при пробуждении</b><div class="chips">${chipSel(FE.concat(D.feel.filter((x) => !FE.includes(x))), D.feel, "df", "on")}</div></div>
        <button class="btn" id="dsave">Сохранить</button></div>`;
      $("#dtx").oninput = (e) => { D.text = e.target.value; save(); };
      const das = $("#das"); if (das) das.oninput = (e) => { D.assoc = e.target.value; save(); };
      const add = () => { const v = $("#dimg").value.trim().toLowerCase(); if (!v) return; D.images.push(v); save(); draw(); const n = $("#dimg"); if (n) n.focus(); };
      $("#dadd").onclick = add; $("#dimg").onkeydown = (e) => { if (e.key === "Enter") add(); };
      app.querySelectorAll("[data-dx]").forEach((b) => b.onclick = () => { D.images.splice(Number(b.dataset.dx), 1); save(); draw(); });
      app.querySelectorAll("[data-df]").forEach((b) => b.onclick = () => { const x = b.dataset.df, k = D.feel.indexOf(x); k >= 0 ? D.feel.splice(k, 1) : D.feel.push(x); b.classList.toggle("on"); save(); });
      $("#dsave").onclick = () => { D.savedAt = now(); save(); haptic(); toast("Сон записан"); go("#/"); };
    };
    draw();
  }
  const cardFace = (c) => `<div class="tcard face" style="--ink:${c.ink};--fade:${c.fade}"><img src="${c.img}" alt="${esc(c.title)}"><i class="fade"></i><i class="line"></i><span class="nm">${esc(c.title.toUpperCase())}</span></div>`;
  function SymDay() {
    const st = S.sym[dkey()];
    if (!DECK.length) { app.innerHTML = `<div class="stack">${back("#/", "Сегодня")}<h1>Символ дня</h1><p class="lead">Колода появится после подключения.</p></div>`; return; }
    if (!st) {
      app.innerHTML = `<div class="stack" style="align-items:center;text-align:center"><div style="align-self:flex-start">${back("#/", "Сегодня")}</div>
        <div class="stack" style="gap:6px;align-items:center"><h1>Символ дня</h1><p class="small">Сделай вдох и коснись карты, когда почувствуешь, что пора.</p></div>
        <button type="button" class="flip" id="flip" aria-label="Открыть карту"><div class="tcard back"><img src="${C.deck.back}" alt=""><i class="line" style="--ink:#5A4A44"></i></div></button></div>`;
      $("#flip").onclick = () => {
        const prev = S.sym[dkey(now() - 86400000)], pool = DECK.filter((c) => !prev || c.id !== prev.id);
        const c = pool[Math.floor(Math.random() * pool.length)];
        S.sym[dkey()] = { id: c.id, at: now(), note: "" }; save(); haptic();
        const f = $("#flip"); f.classList.add("turn"); setTimeout(() => SymDay(), 450);
      };
      return;
    }
    const c = cardById(st.id) || DECK[0], y = symByTitle(c.title);
    app.innerHTML = `<div class="stack">${back("#/", "Сегодня")}
      <div class="stack" style="align-items:center">${cardFace(c)}</div>
      <label class="q"><b>Что откликается в этом образе сегодня?</b><textarea id="snote" rows="3" placeholder="Первое, что приходит…">${esc(st.note || "")}</textarea></label>
      ${y ? `<a class="link-row" href="#/sym/${y.id}">${esc(c.title)} в словаре символов ${icon.chev}</a>` : ""}
      <p class="small center">Новая карта — завтра.</p></div>`;
    $("#snote").oninput = (e) => { st.note = e.target.value; save(); };
  }

  // ---------- «Сегодня» и вкладки ----------
  const TABS = [["", "Сегодня", '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>'], ["dives", "Погружения", '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>'], ["lib", "Библиотека", '<path d="M4 19V5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M14 3v5h5"/>'], ["notes", "Мои записи", '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>']];
  const tabsEl = document.getElementById("tabs") || (() => { const d = document.createElement("nav"); d.id = "tabs"; d.setAttribute("aria-label", "Разделы"); document.body.appendChild(d); return d; })();
  const waterEl = document.getElementById("water") || (() => { const d = document.createElement("div"); d.id = "water"; d.setAttribute("aria-hidden", "true"); document.body.insertBefore(d, document.body.firstChild); return d; })();
  function paintTabs(active) {
    document.body.classList.toggle("tabs", active >= 0);
    if (active < 0) { tabsEl.innerHTML = ""; return; }
    tabsEl.innerHTML = TABS.map(([r, l, p], i) => `<a href="#/${r}" class="${i === active ? "on" : ""}"${i === active ? ' aria-current="page"' : ""}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>${l}</a>`).join("");
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
<path d="M0 ${H - 110} Q 60 ${H - 140} 120 ${H - 118} T 240 ${H - 126} T 390 ${H - 120} V${H} H0Z" fill="#132845"/>
<path d="M0 ${H - 70} Q 80 ${H - 92} 160 ${H - 74} T 300 ${H - 80} T 390 ${H - 72} V${H} H0Z" fill="#0E1E36"/>
${weed}<g><path d="M180 ${H} q-5 -40 8 -60 q10 18 2 60z" fill="#3A2E33"/><path d="M200 ${H} q3 -50 18 -66 q5 26 -8 66z" fill="#4A3036"/><circle cx="218" cy="${H - 66}" r="3.5" fill="#C9775A" opacity=".7"/></g>${b}</svg>`;
  }
  function setWater(on) {
    document.body.classList.toggle("water", on);
    if (on && !waterEl.innerHTML) waterEl.innerHTML = waterSVG();
    try { tg && tg.setHeaderColor && tg.setHeaderColor(on ? "#24456B" : "#0F1E33"); } catch (e) {}
  }
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
    return h + `</div><div class="legend"><span><i style="background:#8FB39A"></i>как ты</span><span><i style="background:#8CC4E8"></i>погружение</span><span><i style="background:#CFE6F5"></i>сон</span><span><i style="background:#C9775A"></i>слово</span></div></div>`;
  }
  const PLAY = (c) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="${c}" aria-hidden="true"><path d="M7 4l13 8-13 8z"/></svg>`;
  function Main() {
    const pendingInt = cycle.practices.filter((p) => integrOpen(p.id) && !integrDone(p.id));
    const waitingInt = cycle.practices.filter((p) => counted(p.id) && p.integration && !integrOpen(p.id));
    const nx = nextStep(), done = anyToday(), k = dkey();
    let h = `<div class="stack" style="gap:20px">
      <div class="row" style="justify-content:space-between;gap:12px"><h1 style="font-size:28px">Привет${S.profile && S.profile.name ? ", " + esc(S.profile.name) : ""}</h1><a class="sos" href="#/aid"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F0C7B5" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Если сложно</a></div>`;
    if (isNight()) h += `<a class="night glass" href="#/music"><svg width="40" height="40" viewBox="0 0 44 44" aria-hidden="true" style="flex-shrink:0"><circle cx="22" cy="22" r="21" fill="#0F1E33"/><path d="M28 27.5A9 9 0 1 1 18.5 15a7 7 0 0 0 9.5 12.5z" fill="#CFE6F5"/></svg><span class="t"><span class="small">Если сложно заснуть</span><b>Музыкальное сопровождение</b></span>${icon.chev}</a>`;
    if (!done) {
      const tile = (href, ic, t, ok) => `<a class="tile" href="${href}"><span class="ic">${ic}</span>${t}${ok ? '<span class="ok"></span>' : ""}</a>`;
      h += `<div class="howcard"><svg class="rings" width="140" height="140" viewBox="0 0 140 140" aria-hidden="true"><circle cx="70" cy="70" r="60"/><circle cx="70" cy="70" r="42"/><circle cx="70" cy="70" r="24"/></svg>
        <span style="font-size:28px;font-weight:800;line-height:1.1;position:relative">Как ты?</span>
        <div class="tiles">${tile("#/today", ICN.body, "Тело<br>и чувства")}${tile("#/dream", ICN.moon, "Что<br>снилось")}${tile("#/symbol", ICN.card, "Символ<br>дня")}</div></div>`;
    }
    h += `<div class="stack" style="gap:8px"><span class="lbl">СЕЙЧАС</span>`;
    if (nx) {
      const open = isOpen(nx.id);
      h += `<a class="nowcard" href="${open ? "#/prep/" + nx.id : "#/cycle/" + cycle.id}"><span class="pl${open ? "" : " off"}">${open ? PLAY("#0F1E33") : icon.lock}</span><span class="t"><span class="small" style="font-size:12px">${esc(cycle.title)} · ${idx(nx.id) + 1} из ${cycle.practices.length}</span><b>${esc(nx.title)}</b><span class="small" style="font-size:12px;color:${open ? "var(--blue)" : "var(--muted)"}">${open ? "погружение" + (nx.duration ? " · " + Math.round(nx.duration / 60) + " мин" : "") : "откроется " + (unlockAt(nx.id) ? fmtWhen(unlockAt(nx.id)) : "после предыдущей")}</span></span></a>`;
    } else h += `<a class="nowcard" href="#/dives"><span class="pl">${icon.check}</span><span class="t"><b>Цикл «${esc(cycle.title)}» пройден</b><span class="small" style="font-size:12px">практики вне циклов — во вкладке «Погружения»</span></span></a>`;
    pendingInt.forEach((p) => { h += `<a class="introw" href="#/integr/${p.id}"><span class="dot"></span><span style="flex:1">Открыта интеграция к «${esc(p.title)}»</span>${icon.chev}</a>`; });
    waitingInt.forEach((p) => { h += `<div class="introw wait"><span class="dot"></span><span style="flex:1">Интеграция к «${esc(p.title)}» — ${fmtWhen(integrAt(p.id))}</span></div>`; });
    h += `</div>` + weekBlock() + `</div>`;
    if (done) h += `<a class="lookpill" href="#/inside"><span class="dot"></span><span class="t"><b>Заглянуть в себя</b><span>${esc(daySummary(k))}</span></span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A9CBB3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></a>`;
    app.innerHTML = h;
  }
  const FUTURE_CYCLES = ["Тот, кто ждал", "Своя опора"];
  function Dives() {
    const nx = nextStep(), dn = cycle.practices.filter((p) => counted(p.id)).length, free = C.free || [];
    let h = `<div class="stack" style="gap:20px"><h1>Погружения</h1>
      <a class="nowcard" href="#/cycle/${cycle.id}" style="padding:12px 14px"><span class="pl" style="width:40px;height:40px">${PLAY("#0F1E33")}</span><span class="t"><span class="small" style="font-size:12px">${esc(cycle.title)} · ${dn} из ${cycle.practices.length}</span><b style="font-size:15px">${nx ? esc(nx.title) + (nx.duration ? " · " + Math.round(nx.duration / 60) + " мин" : "") : "цикл пройден"}</b></span>${icon.chev}</a>
      <div class="stack" style="gap:10px"><div class="stack" style="gap:2px"><h2>Когда хочется сейчас</h2><span class="small">в любой день, без порядка</span></div>`;
    if (free.length) h += `<div class="free">${free.map((f, i) => `<a class="fcard c${i % 3}" href="${f.href || "#"}"><span class="pl">${PLAY("#C3D0DE")}</span><b>${esc(f.title)}</b><span class="small" style="margin-top:auto;font-size:12px">${f.duration ? Math.round(f.duration / 60) + " мин" : ""}</span></a>`).join("")}</div>`;
    else h += `<div class="card dashed"><div class="small">Скоро здесь появятся практики, которые можно слушать в любой день: для ресурса, перед сном, для встречи с образом.</div></div>`;
    h += `</div><div class="stack" style="gap:8px"><div class="row" style="justify-content:space-between;align-items:baseline"><span class="lbl">ЦИКЛЫ</span>${dn ? `<a class="small" href="#/journal" style="color:var(--blue);font-weight:700;font-size:12px">пройденные · ${dn} →</a>` : ""}</div>
      <div class="cyc"><a href="#/cycle/${cycle.id}"><b>${esc(cycle.title)}</b><span>${dn} из ${cycle.practices.length}</span></a>${FUTURE_CYCLES.map((t) => `<span class="soon"><b>${esc(t)}</b><span>скоро</span></span>`).join("")}</div></div>
      <div class="demo stack" style="gap:10px">
        <div class="small">Демо-режим: перемотка времени, чтобы проверить таймеры (8 и 48 часов)</div>
        <div class="chips"><button class="chip" data-shift="8">+8 часов</button><button class="chip" data-shift="48">+48 часов</button><button class="chip" data-reset="1">Начать заново</button></div>
      </div></div>`;
    app.innerHTML = h;
    app.querySelectorAll("[data-shift]").forEach((b) => b.onclick = () => { S.shift = (S.shift || 0) + Number(b.dataset.shift) * H; save(); toast("Время сдвинуто на +" + b.dataset.shift + " ч"); render(); });
    app.querySelector("[data-reset]").onclick = () => { if (confirmReset()) { S = blank(); save(); go("#/"); render(); } };
  }
  function Lib() {
    const eps = EPS.filter((e) => e.src), dd = eps.filter((e) => podSt(e.id).done).length;
    const nSym = DS.reduce((a, s) => a + ((s.items || s.symbols || []).length || 0), 0);
    const card = (href, cls, kick, t, sub, art) => `<a class="libcard ${cls}" href="${href}">${art}<span class="k">${kick}</span><b>${t}</b><span class="s">${sub}</span></a>`;
    const orb = '<svg width="150" height="150" viewBox="0 0 150 150" aria-hidden="true" class="art" style="right:-20px;top:-15px;opacity:.6"><circle cx="75" cy="75" r="60" fill="none" stroke="#3A5578"/><circle cx="75" cy="75" r="42" fill="none" stroke="#3A5578"/><circle cx="75" cy="75" r="24" fill="none" stroke="#3A5578"/><circle cx="75" cy="15" r="4" fill="#8CC4E8"/><circle cx="117" cy="75" r="3.5" fill="#8CC4E8"/><circle cx="75" cy="75" r="5" fill="#A9CBB3"/></svg>';
    const book = '<svg width="120" height="120" viewBox="0 0 24 24" aria-hidden="true" class="art" style="right:-6px;top:6px;opacity:.18" fill="none" stroke="#E8EEF4" stroke-width="1"><path d="M2 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H2zM22 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z"/></svg>';
    const wave = '<svg width="180" height="80" viewBox="0 0 180 80" aria-hidden="true" class="art" style="right:-30px;top:8px;opacity:.35"><path d="M0 40 Q 15 20 30 40 T 60 40 T 90 40 T 120 40 T 150 40 T 180 40" fill="none" stroke="#8CC4E8" stroke-width="2"/><path d="M0 52 Q 15 36 30 52 T 60 52 T 90 52 T 120 52 T 150 52 T 180 52" fill="none" stroke="#3A5578" stroke-width="1.5"/></svg>';
    const se = PODS[0];
    app.innerHTML = `<div class="stack" style="gap:14px"><div class="stack" style="gap:4px"><h1>Библиотека</h1><span class="small">Теория, образы и музыка — когда хочется не погружаться, а узнать и побыть.</span></div>
      ${card("#/pod", "a", "ПОДКАСТЫ", se ? esc(se.title) : "Подкасты", eps.length ? dd + " из " + eps.length + " выпусков · письменные практики" : "теория и письменные практики", orb)}
      ${card("#/dict", "b", "СЛОВАРЬ", "Словарь символов", (nSym ? nSym + " символов · " : "") + "мои образы — " + Object.keys(S.myimg || {}).length, book)}
      ${card("#/music", "c", "МУЗЫКА", "Музыкальное сопровождение", "для сна, практик и побыть с собой · " + MU.length + " " + plural(MU.length, "трек", "трека", "треков"), wave)}</div>`;
  }
  let NF = "all";
  function Notes() {
    const items = [];
    Object.keys(S.days || {}).forEach((k) => { const d = S.days[k]; if (d && d.done) items.push({ kind: "day", ts: dayTs(k), k }); });
    Object.keys(S.dreams || {}).forEach((k) => { const d = S.dreams[k]; if (d && d.text) items.push({ kind: "dream", ts: dayTs(k), k }); });
    (S.catches || []).forEach((c, i) => items.push({ kind: "word", ts: c.at, i }));
    cycle.practices.forEach((p) => { const n = S.notes[p.id]; if (n || counted(p.id)) items.push({ kind: "dive", ts: counted(p.id) || (n && n.savedAt) || 0, p }); });
    items.sort((a, b) => b.ts - a.ts);
    const F = [["all", "Все"], ["dive", "Погружения"], ["dream", "Сны"], ["day", "Как ты"], ["word", "Слова"]];
    const chipsOf = (xs, bg, c) => xs.length ? `<span class="nchips">${xs.map((x) => `<span style="background:${bg};color:${c}">${esc(x)}</span>`).join("")}</span>` : "";
    let h = `<div class="stack" style="gap:14px"><div class="stack" style="gap:4px"><h1>Мои записи</h1><span class="small">Видишь только ты.</span></div>
      <div class="nfil">${F.map(([k, l]) => `<button type="button" class="${NF === k ? "on" : ""}" data-nf="${k}">${l}</button>`).join("")}</div>`;
    const list = items.filter((x) => NF === "all" || x.kind === NF);
    if (!list.length) h += `<div class="card dashed"><div class="small">Здесь будут твои записи: после погружений, сны, «Как ты?» и пойманные слова.</div></div>`;
    list.forEach((x) => {
      let col, kind, t, sub = "", ch = "", href = "";
      if (x.kind === "day") { const d = S.days[x.k]; col = "#8FB39A"; kind = "КАК ТЫ"; t = daySummary(x.k) || "отмечено"; sub = d.want && d.want.length ? "хочется: " + d.want.join(", ") : ""; ch = chipsOf(Object.keys(d.zones || {}).map(zoneTitle), "#33262A", "#F0C7B5"); if (x.k === dkey()) href = "#/inside"; }
      if (x.kind === "dream") { const d = S.dreams[x.k]; col = "#CFE6F5"; kind = "СОН"; t = d.text.length > 70 ? d.text.slice(0, 70) + "…" : d.text; sub = d.feel && d.feel.length ? "при пробуждении: " + d.feel.join(", ") : ""; ch = chipsOf(d.images || [], "#1F3654", "#CFE6F5"); if (x.k === dkey()) href = "#/dream"; }
      if (x.kind === "word") { const c = S.catches[x.i]; col = "#C9775A"; kind = "ПОЙМАННОЕ СЛОВО"; t = c.word; href = "#/caught/" + x.i; }
      if (x.kind === "dive") { const n = S.notes[x.p.id] || {}; col = "#8CC4E8"; kind = "ПОГРУЖЕНИЕ"; t = x.p.title; sub = n.image ? (n.image.length > 90 ? n.image.slice(0, 90) + "…" : n.image) : "заметки пока нет"; ch = chipsOf(n.feelings || [], "#24382F", "#D3E4D8"); href = "#/after/" + x.p.id; }
      const inner = `<span class="bar" style="background:${col}"></span><span class="t"><span class="hd"><span style="color:${col}">${kind}</span><span>${x.ts ? dayLabel(x.ts) : ""}</span></span><b>${esc(t)}</b>${sub ? `<span class="sub">${esc(sub)}</span>` : ""}${ch}</span>`;
      h += href ? `<a class="note" href="${href}">${inner}</a>` : `<div class="note">${inner}</div>`;
    });
    app.innerHTML = h + `</div>`;
    app.querySelectorAll("[data-nf]").forEach((b) => b.onclick = () => { NF = b.dataset.nf; Notes(); });
  }

  // ---------- роутер ----------
  function render() {
    const parts = (location.hash.replace(/^#\/?/, "") || "").split("/");
    const [r, id] = parts;
    if (PL && r !== "player") { history.replaceState(null, "", "#/player/" + PL.id); exitSheet(); return; }
    clearInterval(timer); timer = null;
    document.querySelectorAll(".sheet-bg").forEach((x) => x.remove());
    window.scrollTo(0, 0);
    const tabI = r ? ["dives", "lib", "notes"].indexOf(r) + 1 || -1 : 0;
    if (tg && tg.BackButton) { tabI < 0 ? tg.BackButton.show() : tg.BackButton.hide(); }
    if (r !== "policy" && (!S.profile || S.profile.minor)) { paintTabs(-1); setWater(false); }
    if (r !== "policy") {
      if (!S.profile) return r === "hello" && id === "2" ? Know() : Welcome();
      if (S.profile.minor) return Minor();
    }
    paint = () => {};
    paintMini();
    paintTabs(tabI); setWater(tabI === 0);
    switch (r) {
      case "dives": return Dives();
      case "lib": return Lib();
      case "notes": return Notes();
      case "policy": return Policy(id);
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
      case "observer": return Observer();
      case "pod": return Pods();
      case "series": return Series(id);
      case "ep": return Episode(id);
      case "body": return Body(id, parts[2], parts[3]);
      case "gate": return Gate();
      case "deep": return Deep();
      case "catch": return Catch(id, parts[2]);
      case "feels": return Feels();
      case "caught": return Caught(id);
      case "inside": return Inside();
      case "today": return id === "body" ? Today("", parts[2]) : Today(id, parts[2]);
      case "dream": return Dream();
      case "symbol": return SymDay();
      default: return Main();
    }
  }
  window.addEventListener("hashchange", render);
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
