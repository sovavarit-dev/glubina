// Иллюстрации циклов погружений: анимированная — к описанию цикла, иконка — для списка.
// Порядок = порядок циклов: 1 «Первые шаги», 2 «Тот, кто ждал», 3 «Свой дом».
window.CYCLE_ART = (function () {
  const sky = (id, a, b) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
  const glow = (id, c) => `<radialGradient id="${id}"><stop offset="0" stop-color="${c}" stop-opacity=".9"/><stop offset=".35" stop-color="${c}" stop-opacity=".35"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`;
  const stars = (pts) => pts.map(([x, y, r, d]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#E8EEF4"><animate attributeName="opacity" values=".2;.9;.2" dur="${d}s" repeatCount="indefinite"/></circle>`).join("");

  // 1. Первые шаги — пять камней через воду к приоткрытой арке со светом.
  // Камни загораются по очереди (пять практик), от каждого расходится круг по воде.
  const stones = [[70, 176, 26], [128, 160, 22], [178, 146, 19], [220, 134, 16], [256, 124, 13]];
  const hero1 = `<svg viewBox="0 0 360 220" width="100%" role="img" aria-label="Камни через воду ведут к арке, из которой льется свет">
<defs>${sky("a1s", "#2A4D74", "#0F1E33")}${sky("a1w", "#1B3556", "#0B1728")}${glow("a1g", "#F0C7B5")}${glow("a1b", "#CFE6F5")}</defs>
<rect width="360" height="220" fill="url(#a1s)"/>
${stars([[40, 30, 1, 5], [96, 18, 1.2, 7], [150, 40, .9, 6], [318, 26, 1.1, 8], [210, 16, .8, 5.5]])}
<path d="M0 112 Q 90 100 180 108 T 360 104 V220 H0Z" fill="url(#a1w)"/>
<path d="M232 112 Q 286 92 360 98 V112Z" fill="#132845"/>
<circle cx="296" cy="84" r="70" fill="url(#a1g)" opacity=".55"><animate attributeName="opacity" values=".4;.75;.4" dur="6s" repeatCount="indefinite"/></circle>
<path d="M280 112 V74 a16 16 0 0 1 32 0 V112" fill="#0E1E36" stroke="#C3D0DE" stroke-width="1.6"/>
<path d="M296 112 V60 a16 16 0 0 1 16 14 V112Z" fill="#F0C7B5" opacity=".85"><animate attributeName="opacity" values=".65;1;.65" dur="6s" repeatCount="indefinite"/></path>
<path d="M296 112 L250 220 H360 L312 112Z" fill="#F0C7B5" opacity=".07"/>
${stones.map(([x, y, r], i) => {
    const b = (i * 1.4).toFixed(1);
    return `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.32}" fill="none" stroke="#8CC4E8" stroke-width="1" opacity="0"><animate attributeName="rx" values="${r};${r * 2.4}" dur="10s" begin="${b}s" repeatCount="indefinite" keyTimes="0;1" calcMode="spline" keySplines=".2 .6 .4 1"/><animate attributeName="ry" values="${r * 0.32};${r * 0.8}" dur="10s" begin="${b}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;.7;0;0" keyTimes="0;.05;.3;1" dur="10s" begin="${b}s" repeatCount="indefinite"/></ellipse>
<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.32}" fill="#3A5578"><animate attributeName="fill" values="#3A5578;#CFE6F5;#8CC4E8;#3A5578" keyTimes="0;.05;.4;1" dur="10s" begin="${b}s" repeatCount="indefinite"/></ellipse>`;
  }).join("")}
<path d="M0 196 Q 60 188 120 196 T 240 194 T 360 196" fill="none" stroke="#8CC4E8" stroke-width="1" opacity=".25"><animate attributeName="d" values="M0 196 Q 60 188 120 196 T 240 194 T 360 196;M0 196 Q 60 202 120 194 T 240 198 T 360 194;M0 196 Q 60 188 120 196 T 240 194 T 360 196" dur="8s" repeatCount="indefinite"/></path>
</svg>`;

  // 2. Тот, кто ждал — маленький огонек ждет на воде, второй приближается,
  // они знакомятся, меняются местами и соединяются в одно свечение.
  const hero2 = `<svg viewBox="0 0 360 220" width="100%" role="img" aria-label="Два огонька над ночной водой встречаются и соединяются">
<defs>${sky("a2s", "#1F3654", "#0B1728")}${glow("a2a", "#A9CBB3")}${glow("a2b", "#8CC4E8")}${glow("a2c", "#E8EEF4")}</defs>
<rect width="360" height="220" fill="url(#a2s)"/>
${stars([[30, 24, 1, 6], [80, 52, .8, 5], [140, 20, 1.1, 7], [260, 34, 1, 6.5], [330, 60, .9, 5.2], [300, 18, .7, 8]])}
<circle cx="292" cy="44" r="16" fill="#CFE6F5" opacity=".9"/><circle cx="299" cy="40" r="14" fill="#1C3150"/>
<rect y="140" width="360" height="80" fill="#0E1E36"/>
<path d="M0 140 Q 90 134 180 140 T 360 138" fill="none" stroke="#3A5578" stroke-width="1"/>
<g><animateTransform attributeName="transform" type="translate" values="110 112;110 112;160 104;222 112;180 108;180 108;110 112" keyTimes="0;.3;.45;.6;.78;.86;1" dur="14s" repeatCount="indefinite" calcMode="spline" keySplines="0 0 1 1;.4 0 .2 1;.4 0 .2 1;.4 0 .2 1;0 0 1 1;0 0 1 1"/>
  <circle r="34" fill="url(#a2a)"/><circle r="5" fill="#D3E4D8"/>
  <animate attributeName="opacity" values="1;1;1;1;1;0;0;1" keyTimes="0;.3;.45;.6;.78;.84;.97;1" dur="14s" repeatCount="indefinite"/></g>
<g><animateTransform attributeName="transform" type="translate" values="400 88;250 104;200 104;138 112;180 108;180 108;400 88" keyTimes="0;.3;.45;.6;.78;.86;1" dur="14s" repeatCount="indefinite" calcMode="spline" keySplines=".3 0 .3 1;.4 0 .2 1;.4 0 .2 1;.4 0 .2 1;0 0 1 1;0 0 1 1"/>
  <circle r="34" fill="url(#a2b)"/><circle r="5" fill="#CFE6F5"/>
  <animate attributeName="opacity" values="0;1;1;1;1;0;0;0" keyTimes="0;.12;.45;.6;.78;.84;.97;1" dur="14s" repeatCount="indefinite"/></g>
<g transform="translate(180 108)"><circle r="62" fill="url(#a2c)"/><circle r="7" fill="#E8EEF4"/>
  <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;.78;.86;.95;1" dur="14s" repeatCount="indefinite"/></g>
<g opacity=".35" transform="translate(0 280) scale(1 -1)"><ellipse cx="180" cy="172" rx="60" ry="6" fill="#8CC4E8"><animate attributeName="opacity" values=".2;.5;.2" dur="7s" repeatCount="indefinite"/></ellipse></g>
<path d="M0 176 Q 60 170 120 176 T 240 174 T 360 176" fill="none" stroke="#8CC4E8" stroke-width="1" opacity=".2"><animate attributeName="d" values="M0 176 Q 60 170 120 176 T 240 174 T 360 176;M0 176 Q 60 182 120 174 T 240 178 T 360 174;M0 176 Q 60 170 120 176 T 240 174 T 360 176" dur="9s" repeatCount="indefinite"/></path>
</svg>`;

  // 3. Свой дом — дом рисуется линией, загорается окно, открывается дверь, свет выходит на тропинку.
  const L = 520;
  const hero3 = `<svg viewBox="0 0 360 220" width="100%" role="img" aria-label="Дом рисуется линией, загорается окно и открывается дверь">
<defs>${sky("a3s", "#26476B", "#101F36")}${glow("a3g", "#F0C7B5")}</defs>
<rect width="360" height="220" fill="url(#a3s)"/>
${stars([[36, 30, 1, 6], [90, 16, .8, 7], [270, 22, 1.1, 5.5], [320, 48, .9, 6.5], [220, 12, .7, 8]])}
<path d="M0 168 Q 100 150 200 160 T 360 156 V220 H0Z" fill="#132845"/>
<path d="M0 190 Q 120 178 240 188 T 360 184 V220 H0Z" fill="#0E1E36"/>
<path d="M30 168 q -4 -30 6 -46 q 8 20 2 46z" fill="#24382F"/><path d="M322 160 q -6 -36 6 -54 q 10 24 2 54z" fill="#2E4A3C"/>
<circle cx="180" cy="118" r="78" fill="url(#a3g)" opacity="0"><animate attributeName="opacity" values="0;0;.55;.55;0" keyTimes="0;.42;.55;.9;1" dur="14s" repeatCount="indefinite"/></circle>
<path d="M126 162 V108 L180 70 L234 108 V162 Z M126 108 H234 M206 84 V66 H218 V93" fill="none" stroke="#CFE6F5" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="${L}" stroke-dashoffset="${L}">
  <animate attributeName="stroke-dashoffset" values="${L};0;0;0;${L}" keyTimes="0;.35;.9;.97;1" dur="14s" repeatCount="indefinite" calcMode="spline" keySplines=".4 0 .2 1;0 0 1 1;0 0 1 1;0 0 1 1"/></path>
<rect x="144" y="120" width="20" height="18" rx="2" fill="#F0C7B5" opacity="0"><animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;.4;.46;.9;1" dur="14s" repeatCount="indefinite"/></rect>
<rect x="190" y="126" width="22" height="36" rx="2" fill="#0E1E36" stroke="#CFE6F5" stroke-width="1.6" opacity="0"><animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;.3;.36;.9;1" dur="14s" repeatCount="indefinite"/></rect>
<rect x="190" y="126" width="22" height="36" rx="2" fill="#F0C7B5" opacity="0"><animate attributeName="opacity" values="0;0;.95;.95;0" keyTimes="0;.55;.62;.9;1" dur="14s" repeatCount="indefinite"/></rect>
<path d="M190 162 L176 210 H232 L212 162Z" fill="#F0C7B5" opacity="0"><animate attributeName="opacity" values="0;0;.18;.18;0" keyTimes="0;.6;.7;.9;1" dur="14s" repeatCount="indefinite"/></path>
<circle cx="212" cy="62" r="3" fill="#C3D0DE" opacity="0"><animate attributeName="cy" values="62;30" dur="4s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;.5;0" dur="4s" repeatCount="indefinite"/></circle>
</svg>`;

  // Иконки для списка: линия в тон цикла на мягкой плашке.
  const ic = (bg, body) => `<svg viewBox="0 0 56 56" width="56" height="56" aria-hidden="true"><rect width="56" height="56" rx="16" fill="${bg}"/>${body}</svg>`;
  const icon1 = ic("#1F3654", `<path d="M33 40 V21 a6 6 0 0 1 12 0 V40" fill="none" stroke="#CFE6F5" stroke-width="2"/><path d="M39 40 V16 a6 6 0 0 1 6 5 V40Z" fill="#F0C7B5"/><ellipse cx="13" cy="44" rx="5" ry="1.8" fill="#8CC4E8"/><ellipse cx="22" cy="41" rx="4" ry="1.5" fill="#8CC4E8" opacity=".75"/><ellipse cx="29" cy="39" rx="3" ry="1.2" fill="#8CC4E8" opacity=".5"/>`);
  const icon2 = ic("#1E3330", `<circle cx="22" cy="28" r="11" fill="none" stroke="#A9CBB3" stroke-width="2"/><circle cx="34" cy="28" r="11" fill="none" stroke="#8CC4E8" stroke-width="2"/><path d="M28 18.8 a11 11 0 0 1 0 18.4 a11 11 0 0 1 0 -18.4z" fill="#E8EEF4" opacity=".9"/>`);
  const icon3 = ic("#2A2F45", `<path d="M14 42 V25 L28 14 L42 25 V42 Z" fill="none" stroke="#CFE6F5" stroke-width="2" stroke-linejoin="round"/><rect x="18" y="28" width="7" height="6" rx="1" fill="#F0C7B5"/><rect x="30" y="31" width="7" height="11" rx="1" fill="#F0C7B5" opacity=".85"/>`);

  return [{ hero: hero1, icon: icon1 }, { hero: hero2, icon: icon2 }, { hero: hero3, icon: icon3 }];
})();
