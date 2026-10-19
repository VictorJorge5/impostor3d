/* Impostor 3D · motor de dibujo 2D al estilo de Among Us.
   Todo se dibuja en un <canvas> 2D: el mapa de The Skeld visto desde arriba con las paredes de frente, los crewmates
   (cuerpo de alubia del color del jugador, mochila y la cara de la persona en el visor), fantasmas, cuerpos, mascotas,
   sombreros, equipaciones y efectos. No guarda estado de la partida: el juego le pasa lo que hay que pintar. */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const W2 = {};
  let S = null;

  /* ---------- utilidades de color ---------- */
  const hex2rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const shade = (h, k) => { const [r, g, b] = hex2rgb(h), f = v => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k))); return '#' + ((1 << 24) | (f(r) << 16) | (f(g) << 8) | f(b)).toString(16).slice(1); };
  W2.shade = shade;
  const OUT = '#0d0f17';   // el trazo negro de los dibujos de Among Us

  /* ---------- caras: de la foto (o de la textura esférica de los invitados) al visor ---------- */
  const imgCache = new Map();
  function imgFor(u) {
    let i = imgCache.get(u);
    if (!i) { i = new Image(); i.decoding = 'async'; i.src = u; imgCache.set(u, i); i.addEventListener('load', () => { W2.onFaceLoad && W2.onFaceLoad(); }, { once: true }); }
    return i;
  }
  W2.imgFor = imgFor;
  // recorte de la cara con la proporción pedida (ancho/alto): ojos y boca en el centro del visor
  function faceCrop(look, aspect) {
    if (!look || !look.f) return null;
    const im = imgFor(look.f); if (!im.complete || !im.naturalWidth) return null;
    const W = im.naturalWidth, H = im.naturalHeight;
    const sh = look.am ? H * .56 : H * .64, cy = look.am ? H * .45 : H * .49, sw = sh * aspect;
    return { im, sx: W / 2 - sw / 2, sy: cy - sh / 2, sw, sh };
  }
  W2.faceCrop = faceCrop;

  /* ---------- crewmate ----------
     g: contexto, (x, y): pies en píxeles, h: alto del personaje en píxeles. o: { color, look, dir (1 derecha / -1 izquierda),
     ph (fase de la animación de andar), mv (anda), ghost, alpha, t (segundos), squash (0..1 para entrar en la rejilla) } */
  function crew(g, x, y, h, o) {
    const look = o.look || {}, col = o.color || '#c51111', dk = shade(col, -.38), dir = o.dir < 0 ? -1 : 1, lw = Math.max(1.2, h * .045);
    const kit = S && S.KITS && look.kit ? S.KITS[look.kit] : null;
    g.save(); g.translate(x, y);
    if (o.alpha != null) g.globalAlpha = o.alpha;
    let bob = 0, l1 = 0, l2 = 0;
    if (o.ghost) bob = -h * .18 + Math.sin((o.t || 0) * 2.4) * h * .04;
    else if (o.mv) { const s = Math.sin(o.ph || 0); bob = -Math.abs(Math.cos(o.ph || 0)) * h * .035; l1 = s; l2 = -s; }
    if (o.squash) g.scale(1, Math.max(.02, 1 - o.squash));
    g.translate(0, bob);
    g.lineJoin = 'round'; g.lineCap = 'round'; g.lineWidth = lw; g.strokeStyle = OUT;
    const bw = h * .64, top = -h, bot = -h * .2;   // ancho del cuerpo; parte de arriba y de abajo del cuerpo (las piernas van debajo)
    // capa (detrás de todo)
    if (look.ac === 4 && !o.ghost) { g.fillStyle = S ? S.CLOTHES[look.tc] || '#8b1d2c' : '#8b1d2c'; g.beginPath(); g.moveTo(-dir * bw * .1, top + h * .32); g.quadraticCurveTo(-dir * bw * .95, top + h * .55, -dir * bw * .75, bot + h * .12); g.lineTo(dir * bw * .05, bot + h * .1); g.closePath(); g.fill(); g.stroke(); }
    // mochila
    const bpx = -dir * bw * .5;
    { g.fillStyle = col; rrect(g, bpx - (dir > 0 ? bw * .2 : -bw * .02), top + h * .3, bw * .22, h * .42, h * .07); g.fill(); g.stroke(); g.fillStyle = dk; rrect(g, bpx - (dir > 0 ? bw * .2 : -bw * .02), top + h * .58, bw * .22, h * .14, h * .05); g.fill(); }
    // piernas
    if (!o.ghost) {
      const leg = (lx, k) => { g.fillStyle = col; rrect(g, lx - bw * .19 + k * dir * h * .05, bot - h * .02 - Math.max(0, k) * h * .04, bw * .38, h * .22, h * .07); g.fill(); g.stroke(); };
      leg(-bw * .22, l2); leg(bw * .22, l1);
    }
    // cuerpo de alubia
    const body = () => {
      g.beginPath();
      if (o.ghost) {   // el fantasma acaba en una cola ondulada
        g.moveTo(-bw / 2, top + bw / 2); g.arc(0, top + bw / 2, bw / 2, Math.PI, 0); g.lineTo(bw / 2, bot);
        const n = 4; for (let k = 0; k < n; k++) { const x0 = bw / 2 - (k + 1) * bw / n, wv = Math.sin((o.t || 0) * 5 + k) * h * .03; g.quadraticCurveTo(x0 + bw / n / 2, bot + h * .1 + wv, x0, bot); }
        g.closePath();
      } else { g.moveTo(-bw / 2, top + bw / 2); g.arc(0, top + bw / 2, bw / 2, Math.PI, 0); g.lineTo(bw / 2, bot); g.quadraticCurveTo(bw / 2, bot + h * .06, bw / 2 - h * .06, bot + h * .06); g.lineTo(-bw / 2 + h * .06, bot + h * .06); g.quadraticCurveTo(-bw / 2, bot + h * .06, -bw / 2, bot); g.closePath(); }
    };
    body(); g.fillStyle = col; g.fill();
    // sombra en la espalda y equipación
    g.save(); body(); g.clip();
    g.fillStyle = dk; g.globalAlpha *= .55; g.beginPath(); g.ellipse(-dir * bw * .62, top + h * .55, bw * .32, h * .6, 0, 0, TAU); g.fill(); g.globalAlpha = o.alpha != null ? o.alpha : 1;
    if (kit && !o.ghost) {
      const ky = top + h * .5;
      g.fillStyle = kit.shirt; g.fillRect(-bw, ky, bw * 2, h);
      if (kit.alt) { g.fillStyle = kit.alt; for (let k = -3; k <= 3; k++) g.fillRect(k * bw * .26 - bw * .06, ky, bw * .12, h); }
      g.fillStyle = kit.shorts; g.fillRect(-bw, bot - h * .04, bw * 2, h);
      g.fillStyle = kit.trim; g.fillRect(-bw, ky, bw * 2, h * .03);
      if (look.num) { g.fillStyle = kit.num; g.font = `800 ${h * .17}px "Chakra Petch",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(look.num), -dir * bw * .12, ky + h * .14); }
    }
    g.restore();
    body(); g.stroke();
    // accesorios del cuello
    if (!o.ghost) {
      const ny = top + h * .5, cc = S ? S.CLOTHES[look.tc] || '#c62828' : '#c62828';
      if (look.ac === 1) { g.strokeStyle = '#3a3a44'; g.lineWidth = lw * 2; g.beginPath(); g.moveTo(-dir * bw * .45, top + h * .45); g.lineTo(dir * bw * .4, bot - h * .02); g.stroke(); g.strokeStyle = OUT; g.lineWidth = lw; }
      if (look.ac === 2) { g.fillStyle = cc; rrect(g, -bw * .5, ny - h * .03, bw, h * .09, h * .04); g.fill(); g.stroke(); rrect(g, -dir * bw * .3 - bw * .06, ny, bw * .14, h * .2, h * .03); g.fill(); g.stroke(); }
      if (look.ac === 3) { g.strokeStyle = '#f2c14e'; g.lineWidth = lw * 1.2; g.beginPath(); g.arc(dir * bw * .12, ny - h * .02, bw * .26, .3, Math.PI - .3); g.stroke(); g.strokeStyle = OUT; g.lineWidth = lw; }
      if (look.ac === 5) { g.fillStyle = cc; g.beginPath(); g.moveTo(dir * bw * .3, ny); g.lineTo(dir * bw * .3 + h * .07, ny - h * .05); g.lineTo(dir * bw * .3 + h * .07, ny + h * .05); g.closePath(); g.moveTo(dir * bw * .3, ny); g.lineTo(dir * bw * .3 - h * .07, ny - h * .05); g.lineTo(dir * bw * .3 - h * .07, ny + h * .05); g.closePath(); g.fill(); g.stroke(); }
    }
    // visor con la cara
    visor(g, dir * bw * .13, top + h * .31, bw * .5, h * .235, look, lw);   // visor grande: la gracia es ver la cara
    // sombrero
    hat(g, look, dir * bw * .05, top, bw, h, lw);
    g.restore();
  }
  W2.crew = crew;
  function visor(g, cx, cy, rx, ry, look, lw) {
    g.save();
    g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU);
    const fc = faceCrop(look, rx / ry);
    if (fc) {
      g.save(); g.clip(); g.fillStyle = '#222'; g.fill(); g.drawImage(fc.im, fc.sx, fc.sy, fc.sw, fc.sh, cx - rx, cy - ry, rx * 2, ry * 2); g.restore();
      g.fillStyle = 'rgba(160,215,235,.12)'; g.fill();
    } else {
      const gr = g.createLinearGradient(0, cy - ry, 0, cy + ry); gr.addColorStop(0, '#c6ecf5'); gr.addColorStop(.55, '#86c3d7'); gr.addColorStop(1, '#4b8aa3'); g.fillStyle = gr; g.fill();
    }
    g.lineWidth = lw * 1.1; g.strokeStyle = OUT; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = Math.max(1, lw * .7); g.beginPath(); g.ellipse(cx + rx * .1, cy - ry * .1, rx * .78, ry * .72, 0, -2.5, -1.6); g.stroke();
    g.restore();
  }
  // sombreros (el número coincide con S.OPT.hat)
  function hat(g, look, x, top, bw, h, lw) {
    const t = look.t | 0; if (!t) return;
    const c = S ? (look.ct || S.CLOTHES[look.tc] || '#c62828') : '#c62828', dk = shade(c, -.3), y = top + h * .02;
    g.save(); g.fillStyle = c; g.strokeStyle = OUT; g.lineWidth = lw;
    const P = () => { g.fill(); g.stroke(); };
    switch (t) {
      case 1: g.beginPath(); g.ellipse(x, y + h * .02, bw * .38, h * .12, 0, Math.PI, 0); P(); g.beginPath(); g.ellipse(x + bw * .28, y + h * .02, bw * .3, h * .035, 0, 0, TAU); g.fillStyle = dk; P(); break;
      case 2: g.beginPath(); g.ellipse(x, y + h * .03, bw * .4, h * .15, 0, Math.PI, 0); P(); g.fillStyle = dk; rrect(g, x - bw * .42, y, bw * .84, h * .06, h * .03); P(); g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y - h * .13, h * .045, 0, TAU); P(); break;
      case 3: g.fillStyle = c; rrect(g, x - bw * .45, y + h * .06, bw * .9, h * .06, h * .03); P(); break;
      case 4: g.beginPath(); g.ellipse(x, y + h * .02, bw * .38, h * .12, 0, Math.PI, 0); P(); g.beginPath(); g.ellipse(x - bw * .28, y + h * .02, bw * .3, h * .035, 0, 0, TAU); g.fillStyle = dk; P(); break;
      case 5: g.beginPath(); g.ellipse(x, y, bw * .7, h * .05, 0, 0, TAU); g.fillStyle = '#8a5a2b'; P(); g.beginPath(); g.ellipse(x, y - h * .02, bw * .32, h * .13, 0, Math.PI, 0); P(); break;
      case 6: g.fillStyle = '#16161c'; g.beginPath(); g.ellipse(x, y + h * .01, bw * .5, h * .04, 0, 0, TAU); P(); rrect(g, x - bw * .28, y - h * .3, bw * .56, h * .3, h * .02); P(); g.fillStyle = '#c62828'; g.fillRect(x - bw * .28, y - h * .08, bw * .56, h * .05); break;
      case 7: g.beginPath(); g.moveTo(x - bw * .25, y + h * .04); g.lineTo(x + bw * .05, y - h * .32); g.lineTo(x + bw * .28, y + h * .04); g.closePath(); P(); g.fillStyle = '#ffe14d'; g.beginPath(); g.arc(x + bw * .05, y - h * .33, h * .04, 0, TAU); P(); break;
      case 8: g.fillStyle = '#f2c14e'; g.beginPath(); g.moveTo(x - bw * .28, y + h * .04); for (let k = 0; k <= 4; k++) { const xx = x - bw * .28 + k * bw * .14; g.lineTo(xx, k % 2 ? y - h * .06 : y - h * .15); } g.lineTo(x + bw * .28, y + h * .04); g.closePath(); P(); break;
      case 9: g.beginPath(); g.ellipse(x - bw * .05, y + h * .01, bw * .42, h * .08, -.15, 0, TAU); P(); break;
      case 10: g.fillStyle = 'transparent'; g.lineWidth = lw * 1.6; g.strokeStyle = '#22252e'; g.beginPath(); g.arc(x, y + h * .16, bw * .48, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); g.lineWidth = lw; g.fillStyle = c; rrect(g, x - bw * .56, y + h * .1, bw * .16, h * .14, h * .04); P(); break;
      case 11: g.fillStyle = '#9aa3b5'; g.beginPath(); g.ellipse(x, y + h * .03, bw * .42, h * .15, 0, Math.PI, 0); P(); g.fillStyle = '#f2ead2'; [-1, 1].forEach(s => { g.beginPath(); g.moveTo(x + s * bw * .35, y - h * .02); g.quadraticCurveTo(x + s * bw * .62, y - h * .1, x + s * bw * .55, y - h * .25); g.lineTo(x + s * bw * .4, y - h * .08); g.closePath(); P(); }); break;
      case 12: g.beginPath(); g.moveTo(x - bw * .5, y + h * .05); g.lineTo(x - bw * .3, y - h * .12); g.lineTo(x + bw * .3, y - h * .12); g.lineTo(x + bw * .5, y + h * .05); g.closePath(); P(); break;
      case 13: g.strokeStyle = '#ffe27a'; g.lineWidth = lw * 1.6; g.beginPath(); g.ellipse(x, y - h * .1, bw * .3, h * .04, 0, 0, TAU); g.stroke(); break;
    }
    g.restore();
  }
  function rrect(g, x, y, w, h, r) { r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  W2.rrect = rrect;

  // cuerpo: la mitad de abajo del crewmate con el hueso, como en el original
  W2.body = (g, x, y, h, color, dir) => {
    const col = color || '#c51111', bw = h * .64, lw = Math.max(1.2, h * .045); dir = dir < 0 ? -1 : 1;
    g.save(); g.translate(x, y); g.lineJoin = 'round'; g.strokeStyle = OUT; g.lineWidth = lw;
    g.fillStyle = col; rrect(g, -bw * .45, -h * .2, bw * .38, h * .22, h * .07); g.fill(); g.stroke(); rrect(g, bw * .07, -h * .2, bw * .38, h * .22, h * .07); g.fill(); g.stroke();
    const top = -h * .5;
    g.beginPath(); g.moveTo(-bw / 2, top); g.lineTo(-bw / 2, -h * .16); g.quadraticCurveTo(-bw / 2, -h * .1, -bw / 2 + h * .06, -h * .1); g.lineTo(bw / 2 - h * .06, -h * .1); g.quadraticCurveTo(bw / 2, -h * .1, bw / 2, -h * .16); g.lineTo(bw / 2, top); g.closePath();
    g.fillStyle = col; g.fill(); g.stroke();
    g.fillStyle = '#d9e2f2'; g.beginPath(); g.ellipse(0, top, bw / 2, h * .07, 0, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = '#b3001b'; g.beginPath(); g.ellipse(0, top, bw * .38, h * .045, 0, 0, TAU); g.fill();
    // hueso
    g.fillStyle = '#f3ead8'; g.save(); g.translate(dir * bw * .08, top - h * .02); g.rotate(-dir * .25); rrect(g, -h * .035, -h * .2, h * .07, h * .2, h * .03); g.fill(); g.stroke();
    g.beginPath(); g.arc(-h * .035, -h * .2, h * .045, 0, TAU); g.arc(h * .035, -h * .2, h * .045, 0, TAU); g.fill(); g.stroke(); g.restore();
    g.restore();
  };

  // mascotas (S.OPT.pet): perrito, gatito, robot, minitripulante, pollito, dron
  W2.pet = (g, x, y, h, type, color, t, mv, dir) => {
    dir = dir < 0 ? -1 : 1; const lw = Math.max(1, h * .07), hop = mv ? -Math.abs(Math.sin(t * 12)) * h * .15 : 0;
    g.save(); g.translate(x, y + hop); g.scale(dir, 1); g.lineJoin = 'round'; g.strokeStyle = OUT; g.lineWidth = lw;
    const E = (cx, cy, rx, ry, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.fill(); g.stroke(); };
    const eye = (cx, cy) => { g.fillStyle = '#111'; g.beginPath(); g.arc(cx, cy, h * .05, 0, TAU); g.fill(); };
    switch (type) {
      case 1: E(0, -h * .32, h * .42, h * .28, '#b07a45'); E(h * .32, -h * .56, h * .24, h * .22, '#b07a45'); E(h * .2, -h * .72, h * .08, h * .14, '#7a4f28'); eye(h * .4, -h * .6); E(-h * .45, -h * .45, h * .08, h * .05, '#b07a45'); break;
      case 2: E(0, -h * .3, h * .4, h * .26, '#8d8f99'); E(h * .3, -h * .55, h * .24, h * .22, '#8d8f99'); [[.18, -.78], [.42, -.78]].forEach(([a, b]) => { g.fillStyle = '#8d8f99'; g.beginPath(); g.moveTo(a * h - h * .07, -h * .66); g.lineTo(a * h, b * h); g.lineTo(a * h + h * .07, -h * .66); g.fill(); g.stroke(); }); eye(h * .4, -h * .57); break;
      case 3: g.fillStyle = '#b8c2d6'; rrect(g, -h * .3, -h * .62, h * .6, h * .52, h * .1); g.fill(); g.stroke(); g.fillStyle = '#3fe0ff'; rrect(g, -h * .12, -h * .52, h * .36, h * .16, h * .05); g.fill(); g.beginPath(); g.moveTo(0, -h * .62); g.lineTo(0, -h * .82); g.stroke(); E(0, -h * .85, h * .05, h * .05, '#ff3d5e'); break;
      case 4: g.scale(dir, 1); crew(g, 0, 0, h * .9, { color, dir, mv, ph: t * 12, t }); break;
      case 5: E(0, -h * .32, h * .3, h * .28, '#ffd84a'); g.fillStyle = '#ff9a1f'; g.beginPath(); g.moveTo(h * .28, -h * .38); g.lineTo(h * .44, -h * .33); g.lineTo(h * .28, -h * .28); g.fill(); eye(h * .14, -h * .42); break;
      case 6: { const fy = -h * .9 + Math.sin(t * 3) * h * .08; g.fillStyle = '#5d6780'; rrect(g, -h * .3, fy, h * .6, h * .2, h * .08); g.fill(); g.stroke(); g.strokeStyle = '#c9d2e6'; g.lineWidth = lw * .8; const s = Math.sin(t * 40) * h * .25; g.beginPath(); g.moveTo(-s, fy - h * .06); g.lineTo(s, fy - h * .06); g.stroke(); E(h * .14, fy + h * .1, h * .05, h * .05, '#4ef0b8'); break; }
    }
    g.restore();
  };

  // retrato para menús, sala y reuniones: busto del crewmate con la cara grande en el visor
  W2.bust = (c, look, color) => {
    const s = c.width, g = c.getContext('2d'); g.clearRect(0, 0, s, s);
    const col = color || '#c51111', lw = s * .035;
    g.save(); g.lineJoin = 'round'; g.strokeStyle = OUT; g.lineWidth = lw;
    g.fillStyle = col; g.beginPath(); g.moveTo(s * .12, s * 1.05); g.lineTo(s * .12, s * .45); g.arc(s * .5, s * .45, s * .38, Math.PI, 0); g.lineTo(s * .88, s * 1.05); g.closePath(); g.fill();
    g.save(); g.clip(); { const gr = g.createLinearGradient(s * .12, 0, s * .5, 0); gr.addColorStop(0, shade(col, -.4)); gr.addColorStop(.45, shade(col, -.2)); gr.addColorStop(1, col); g.fillStyle = gr; g.globalAlpha = .55; g.fillRect(0, 0, s * .5, s); } g.restore(); g.stroke();
    visor(g, s * .54, s * .5, s * .29, s * .33, look || {}, lw);
    hat(g, look || {}, s * .52, s * .08, s * .76, s * .9, lw);
    g.restore();
    if (look && look.f) { const im = imgFor(look.f); if (!im.complete) im.addEventListener('load', () => W2.bust(c, look, color), { once: true }); }
  };

  /* ---------- mapa ---------- */
  const THEME = {
    cafeteria: ['#b3bccb', '#a3adbf', 'checker'], reactor: ['#7f8799', '#737b8d', 'plates'], electrica: ['#a59a77', '#968c6b', 'hazard'],
    enfermeria: ['#bdd8da', '#acc9cc', 'tiles'], motores: ['#8f95a4', '#848a99', 'grate'], motorinf: ['#8f95a4', '#848a99', 'grate'],
    navegacion: ['#94a7c4', '#879ab8', 'plates'], almacen: ['#a8987b', '#998a6e', 'wood'], seguridad: ['#908fa3', '#848397', 'plates'],
    administracion: ['#aaa3bb', '#9d96ae', 'checker'], comunicaciones: ['#98a9b6', '#8b9caa', 'tiles'], escudos: ['#9ea9c2', '#919cb5', 'plates'],
    oxigeno: ['#a8c6ba', '#9ab8ac', 'tiles'], armeria: ['#a19faf', '#9492a2', 'plates']
  };
  const CORR = ['#9aa2b2', '#8d95a6', 'corr'];
  const WALL = { face: '#b9c2d5', face2: '#a1abc2', base: '#5a6582', cap: '#39415a', capHi: '#4b5573', void: '#0b0e1a', stripe: '#d7deeb' };
  const FACE_H = 2.4, CAP = .7;   // alto del frente de las paredes y grosor del borde, en metros
  let M = null;   // datos del mapa calculados una vez
  W2.init = shared => {
    S = shared; const { W, H, CELL: C } = S, solid = (i, j) => i < 0 || j < 0 || i >= W || j >= H || S.grid[j][i];
    const doorDir = {};   // puertas: orientación del cierre
    S.ROOMS.forEach(rm => (S.DOORS[rm.id] || []).forEach(([i, j]) => { doorDir[i + ',' + j] = { room: rm.id, horiz: solid(i - 1, j) && solid(i + 1, j) }; }));
    const stars = Array.from({ length: 900 }, () => ({ x: Math.random() * W * C, y: Math.random() * H * C, r: Math.random() * 1.6 + .3, a: Math.random() * .6 + .2 }));
    M = { W, H, C, solid, doorDir, stars };
  };

  // dibuja el mapa visible. v = { cx, cy (centro en metros), sc (px por metro), w, h (px) }; o = estado (puertas, tareas, sabotaje...)
  W2.drawMap = (g, v, o) => {
    const { W, H, C, solid } = M, sc = v.sc, X = x => (x - v.cx) * sc + v.w / 2, Y = y => (y - v.cy) * sc + v.h / 2;
    const i0 = Math.max(0, Math.floor((v.cx - v.w / 2 / sc) / C) - 1), i1 = Math.min(W - 1, Math.ceil((v.cx + v.w / 2 / sc) / C) + 1);
    const j0 = Math.max(0, Math.floor((v.cy - v.h / 2 / sc) / C) - 1), j1 = Math.min(H - 1, Math.ceil((v.cy + v.h / 2 / sc) / C) + 2);
    g.fillStyle = WALL.void; g.fillRect(0, 0, v.w, v.h);
    // estrellas fuera de la nave
    g.fillStyle = '#fff'; for (const s of M.stars) { const x = X(s.x), y = Y(s.y); if (x < -2 || y < -2 || x > v.w + 2 || y > v.h + 2) continue; const ci = Math.floor(s.x / C), cj = Math.floor(s.y / C); if (!solid(ci, cj)) continue; g.globalAlpha = s.a; g.fillRect(x, y, s.r, s.r); } g.globalAlpha = 1;
    const cs = C * sc;
    // suelos
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      if (solid(i, j)) continue;
      const rm = S.roomAt(i, j), th = rm ? THEME[rm.id] || CORR : CORR, x = X(i * C), y = Y(j * C);
      g.fillStyle = th[2] === 'checker' && (i + j) % 2 ? th[1] : th[0]; g.fillRect(x, y, cs + .5, cs + .5);
      g.strokeStyle = 'rgba(40,46,64,.28)'; g.lineWidth = Math.max(1, sc * .06);
      switch (th[2]) {
        case 'tiles': g.beginPath(); for (let k = 1; k < 4; k++) { g.moveTo(x + k * cs / 4, y); g.lineTo(x + k * cs / 4, y + cs); g.moveTo(x, y + k * cs / 4); g.lineTo(x + cs, y + k * cs / 4); } g.stroke(); break;
        case 'plates': g.strokeRect(x + sc * .1, y + sc * .1, cs / 2 - sc * .2, cs / 2 - sc * .2); g.strokeRect(x + cs / 2 + sc * .1, y + cs / 2 + sc * .1, cs / 2 - sc * .2, cs / 2 - sc * .2); g.strokeRect(x + cs / 2 + sc * .1, y + sc * .1, cs / 2 - sc * .2, cs / 2 - sc * .2); g.strokeRect(x + sc * .1, y + cs / 2 + sc * .1, cs / 2 - sc * .2, cs / 2 - sc * .2); break;
        case 'grate': g.beginPath(); for (let k = 1; k < 8; k++) { g.moveTo(x, y + k * cs / 8); g.lineTo(x + cs, y + k * cs / 8); } g.stroke(); break;
        case 'wood': g.beginPath(); for (let k = 1; k < 6; k++) { g.moveTo(x, y + k * cs / 6); g.lineTo(x + cs, y + k * cs / 6); } g.stroke(); break;
        case 'hazard': g.strokeRect(x, y, cs, cs); break;
        case 'checker': g.strokeRect(x, y, cs, cs); break;
        default: g.beginPath(); g.moveTo(x + cs / 2, y); g.lineTo(x + cs / 2, y + cs); g.moveTo(x, y + cs / 2); g.lineTo(x + cs, y + cs / 2); g.stroke(); g.strokeRect(x, y, cs, cs);
      }
    }
    // paredes: el frente se ve en las que quedan al norte del suelo; el resto es un borde oscuro
    const fh = FACE_H * sc, cap = CAP * sc, lw = Math.max(1.5, sc * .09);
    g.lineWidth = lw; g.strokeStyle = OUT;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      if (!solid(i, j)) continue;
      const x = X(i * C), y = Y(j * C), dn = !solid(i, j + 1), up = !solid(i, j - 1), lf = !solid(i - 1, j), rt = !solid(i + 1, j);
      if (dn) {   // frente de pared con paneles
        const fy = y + cs - fh, ex0 = lf ? cap : 0, ex1 = rt ? cap : 0;
        const gr = g.createLinearGradient(0, fy, 0, y + cs); gr.addColorStop(0, WALL.face); gr.addColorStop(.8, WALL.face2); gr.addColorStop(.8, WALL.base); gr.addColorStop(1, WALL.base);
        g.fillStyle = gr; g.fillRect(x + ex0, fy, cs - ex0 - ex1, fh);
        g.fillStyle = WALL.stripe; g.fillRect(x + ex0, fy + fh * .18, cs - ex0 - ex1, Math.max(1, fh * .05));
        g.fillStyle = 'rgba(30,36,56,.25)'; for (let k = 1; k < 4; k++) g.fillRect(x + k * cs / 4 - lw / 4, fy + fh * .25, Math.max(1, lw / 2), fh * .55);
        g.fillStyle = WALL.cap; g.fillRect(x, y, cs, cs - fh);
        g.beginPath(); g.moveTo(x + ex0, fy); g.lineTo(x + cs - ex1, fy); g.moveTo(x + ex0, y + cs); g.lineTo(x + cs - ex1, y + cs); g.stroke();
      } else g.fillStyle = WALL.void;
      if (up) { g.fillStyle = WALL.cap; g.fillRect(x, y, cs, cap); g.fillStyle = WALL.capHi; g.fillRect(x, y, cs, cap * .35); g.beginPath(); g.moveTo(x, y); g.lineTo(x + cs, y); g.moveTo(x, y + cap); g.lineTo(x + cs, y + cap); g.stroke(); }
      if (lf) { g.fillStyle = WALL.cap; g.fillRect(x, dn ? y : y, cap, cs); g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + cs); g.moveTo(x + cap, dn ? y : y + (up ? cap : 0)); g.lineTo(x + cap, y + cs); g.stroke(); }
      if (rt) { g.fillStyle = WALL.cap; g.fillRect(x + cs - cap, y, cap, cs); g.beginPath(); g.moveTo(x + cs, y); g.lineTo(x + cs, y + cs); g.moveTo(x + cs - cap, y + (up ? cap : 0)); g.lineTo(x + cs - cap, y + cs); g.stroke(); }
      // esquinas en diagonal
      if (!dn && !rt && !solid(i + 1, j + 1)) { g.fillStyle = WALL.cap; g.fillRect(x + cs - cap, y + cs - cap, cap, cap); g.strokeRect(x + cs - cap, y + cs - cap, cap, cap); }
      if (!dn && !lf && !solid(i - 1, j + 1)) { g.fillStyle = WALL.cap; g.fillRect(x, y + cs - cap, cap, cap); g.strokeRect(x, y + cs - cap, cap, cap); }
      if (!up && !rt && !solid(i + 1, j - 1)) { g.fillStyle = WALL.cap; g.fillRect(x + cs - cap, y, cap, cap); g.strokeRect(x + cs - cap, y, cap, cap); }
      if (!up && !lf && !solid(i - 1, j - 1)) { g.fillStyle = WALL.cap; g.fillRect(x, y, cap, cap); g.strokeRect(x, y, cap, cap); }
    }
    // la ventana de Navegación da al espacio
    const nav = S.ROOMS.find(r => r.id === 'navegacion');
    if (nav) { const wx = X((nav.r[0] + nav.r[2]) * C), wy0 = Y((nav.r[1] + .6) * C), wy1 = Y((nav.r[1] + nav.r[3] - .6) * C); if (wx > -50 && wx < v.w + 50) { g.fillStyle = '#05081a'; g.fillRect(wx, wy0, cap * 1.6, wy1 - wy0); g.fillStyle = 'rgba(140,200,255,.5)'; for (let k = 0; k < 14; k++) g.fillRect(wx + cap * .3 + (k * 37 % 7) * cap * .15, wy0 + (k * 53 % 97) / 97 * (wy1 - wy0), 2, 2); g.strokeRect(wx, wy0, cap * 1.6, wy1 - wy0); } }
    // puertas cerradas (sabotaje)
    if (o.doorsRoom) (S.DOORS[o.doorsRoom] || []).forEach(([i, j]) => {
      const d = M.doorDir[i + ',' + j], x = X(i * C), y = Y(j * C);
      g.save(); g.fillStyle = '#6f7a91';
      if (d && d.horiz) { g.fillRect(x, y + cs * .38, cs, cs * .24); g.beginPath(); g.rect(x, y + cs * .38, cs, cs * .24); } else { g.fillRect(x + cs * .38, y, cs * .24, cs); g.beginPath(); g.rect(x + cs * .38, y, cs * .24, cs); }
      g.stroke(); g.clip(); g.fillStyle = '#f2b800'; for (let k = -cs; k < cs * 2; k += cs / 4) { g.beginPath(); g.moveTo(x + k, y); g.lineTo(x + k + cs / 8, y); g.lineTo(x + k + cs / 8 - cs, y + cs); g.lineTo(x + k - cs, y + cs); g.fill(); }
      g.restore();
    });
  };

  // objetos del suelo: consolas, rejillas, mesas... v igual que en drawMap; o.hl = ids de consola resaltadas, o.use = la que está a tu alcance
  W2.drawProps = (g, v, o) => {
    const sc = v.sc, X = x => (x - v.cx) * sc + v.w / 2, Y = y => (y - v.cy) * sc + v.h / 2, t = o.t || 0, lw = Math.max(1.2, sc * .08);
    const vis = (x, y, r) => { const px = X(x), py = Y(y), rr = r * sc; return px > -rr && py > -rr * 2 && px < v.w + rr && py < v.h + rr; };
    g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = OUT; g.lineWidth = lw;
    const P = () => { g.fill(); g.stroke(); };
    const box = (x, y, w, h, c, r) => { g.fillStyle = c; rrect(g, X(x) - w * sc / 2, Y(y) - h * sc, w * sc, h * sc, (r || .15) * sc); P(); };
    // rejillas
    S.VENTS.forEach(vt => {
      const p = S.cellPos(vt); if (!vis(p.x, p.z, 2)) return; const x = X(p.x), y = Y(p.z), w = 1.6 * sc, h = 1.0 * sc;
      const lid = o.ventOpen && o.ventOpen[vt.id] ? o.ventOpen[vt.id] : 0;
      g.fillStyle = '#1b1f2b'; rrect(g, x - w / 2, y - h / 2, w, h, sc * .12); P();
      g.save(); g.translate(x, y - h / 2); g.scale(1, 1 - lid * 1.6); g.fillStyle = '#7d879c'; rrect(g, -w / 2, 0, w, h, sc * .12); P();
      g.strokeStyle = '#3a4156'; g.lineWidth = lw * .9; for (let k = 1; k < 5; k++) { g.beginPath(); g.moveTo(-w / 2 + k * w / 5, h * .15); g.lineTo(-w / 2 + k * w / 5, h * .85); g.stroke(); } g.restore();
    });
    // mesa del botón de emergencia
    { const b = S.BUTTON; if (vis(b.x, b.z, 4)) { const x = X(b.x), y = Y(b.z), r = S.TABLE_R * sc;
      g.fillStyle = '#c8d0de'; g.beginPath(); g.ellipse(x, y, r, r * .8, 0, 0, TAU); P(); g.fillStyle = '#9aa4b8'; g.beginPath(); g.ellipse(x, y + r * .12, r * .92, r * .7, 0, 0, Math.PI); g.fill();
      g.fillStyle = 'rgba(190,230,255,.55)'; g.beginPath(); g.ellipse(x, y - r * .1, r * .42, r * .36, 0, 0, TAU); P();
      g.fillStyle = '#e8132e'; g.beginPath(); g.ellipse(x, y - r * .08, r * .26, r * .2, 0, 0, TAU); P(); g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.ellipse(x - r * .08, y - r * .14, r * .08, r * .04, -.4, 0, TAU); g.fill(); } }
    // decoración
    S.DECOR.forEach(d => {
      if (!vis(d.x, d.z, (d.len || d.r * 2) + 2)) return; const x = X(d.x), y = Y(d.z), r = d.r * sc;
      if (d.kind === 'table') { g.fillStyle = '#c8d0de'; g.beginPath(); g.ellipse(x, y, r, r * .8, 0, 0, TAU); P(); for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + .4; g.fillStyle = '#6f7a91'; g.beginPath(); g.ellipse(x + Math.cos(a) * r * 1.35, y + Math.sin(a) * r * 1.1, r * .3, r * .22, 0, 0, TAU); P(); } }
      else if (d.kind === 'bed') { g.fillStyle = '#e9eef5'; rrect(g, x - r * 1.1, y - r * .5, r * 2.2, r, r * .15); P(); g.fillStyle = '#9fd3e3'; rrect(g, x - r * 1.05, y - r * .45, r * .55, r * .9, r * .12); P(); }
      else if (d.kind === 'chair') { g.fillStyle = '#3b4a73'; g.beginPath(); g.ellipse(x, y, r, r * .8, 0, 0, TAU); P(); g.fillStyle = '#2b3654'; rrect(g, x - r * .8, y - r * 1.2, r * 1.6, r * .7, r * .2); P(); }
      else if (d.kind === 'crates') { [[-.5, .1], [.5, .2], [0, -.55]].forEach(([a, b], k) => { g.fillStyle = ['#a57a46', '#946b3c', '#b5884f'][k]; const s2 = r * .95; rrect(g, x + a * r - s2 / 2, y + b * r - s2 / 2, s2, s2, s2 * .1); P(); g.beginPath(); g.moveTo(x + a * r - s2 / 2, y + b * r - s2 / 2); g.lineTo(x + a * r + s2 / 2, y + b * r + s2 / 2); g.stroke(); }); }
      else if (d.kind === 'engine') { const L = d.len * sc; g.fillStyle = '#9aa4b8'; rrect(g, x - L / 2, y - r, L, r * 2, r * .5); P(); g.fillStyle = '#7d879c'; for (let k = 1; k < 5; k++) { g.fillRect(x - L / 2 + k * L / 5 - sc * .15, y - r, sc * .3, r * 2); } g.strokeRect(x - L / 2, y - r, L, r * 2);
        const gl = .6 + Math.sin(t * 9) * .2; g.fillStyle = `rgba(255,${120 + gl * 80 | 0},60,${gl})`; g.beginPath(); g.ellipse(x + L / 2 + r * .3, y, r * .45, r * .8, 0, 0, TAU); g.fill(); g.fillStyle = '#5d6780'; rrect(g, x + L / 2 - r * .3, y - r * .9, r * .5, r * 1.8, r * .2); P(); }
      else if (d.kind === 'core') { g.fillStyle = '#4a5370'; g.beginPath(); g.ellipse(x, y, r * 1.1, r * .9, 0, 0, TAU); P(); const gl = .7 + Math.sin(t * 4) * .15; const gr = g.createRadialGradient(x, y - r * .2, 0, x, y - r * .2, r * .8); gr.addColorStop(0, `rgba(160,240,255,${gl})`); gr.addColorStop(1, 'rgba(60,140,255,.2)'); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y - r * .2, r * .7, r * .6, 0, 0, TAU); P(); }
    });
    // consolas de tareas
    S.STATIONS.forEach(st => {
      const p = S.stationPos(st); if (!vis(p.x, p.z, 3)) return; const x = X(p.x), y = Y(p.z), hl = o.hl && o.hl.has(st.id), near = o.use === st.id;
      station(g, st.type, x, y, sc, t, lw);
      if (hl) { g.save(); g.strokeStyle = near ? '#ffe14d' : 'rgba(255,225,77,.55)'; g.lineWidth = lw * (near ? 2.4 : 1.4); g.setLineDash(near ? [] : [sc * .3, sc * .25]); rrect(g, x - sc * .95, y - sc * 1.55, sc * 1.9, sc * 1.85, sc * .25); g.stroke(); g.restore(); }
    });
    // paneles de sabotaje
    S.PANELS.forEach(pn => {
      const p = S.cellPos(pn); if (!vis(p.x, p.z, 3)) return; const x = X(p.x), y = Y(p.z), need = o.sabPanels && o.sabPanels.has(pn.id), on = need && Math.sin(t * 8) > 0;
      g.fillStyle = '#5c667f'; rrect(g, x - sc * .7, y - sc * 1.4, sc * 1.4, sc * 1.5, sc * .15); P();
      g.fillStyle = need ? (on ? '#ff2e4d' : '#7a1020') : '#2a3a4a'; rrect(g, x - sc * .5, y - sc * 1.2, sc, sc * .6, sc * .1); P();
      g.fillStyle = '#f2b800'; g.fillRect(x - sc * .7, y - sc * .25, sc * 1.4, sc * .18);
      if (need) { g.save(); g.strokeStyle = on ? '#ff2e4d' : 'rgba(255,46,77,.5)'; g.lineWidth = lw * 2; rrect(g, x - sc * .95, y - sc * 1.65, sc * 1.9, sc * 1.95, sc * .25); g.stroke(); g.restore(); }
    });
    // terminales de información
    S.INFO.forEach(it => {
      const p = S.cellPos(it); if (!vis(p.x, p.z, 3)) return; const x = X(p.x), y = Y(p.z), near = o.use === 'info:' + it.id;
      if (it.id === 'admin') { g.fillStyle = '#4a5370'; rrect(g, x - sc * 1.3, y - sc * 1.0, sc * 2.6, sc * 1.4, sc * .2); P(); g.fillStyle = '#3ad0ff'; rrect(g, x - sc * 1.0, y - sc * .8, sc * 2, sc * .9, sc * .1); P(); g.fillStyle = 'rgba(255,255,255,.5)'; for (let k = 0; k < 5; k++) g.fillRect(x - sc * .9 + k * sc * .38, y - sc * .6 + (k % 2) * sc * .3, sc * .25, sc * .2); }
      else { g.fillStyle = '#4a5370'; rrect(g, x - sc * .9, y - sc * 1.6, sc * 1.8, sc * 1.7, sc * .2); P(); g.fillStyle = it.id === 'vitals' ? '#183a2b' : '#1b2a44'; rrect(g, x - sc * .7, y - sc * 1.4, sc * 1.4, sc * .9, sc * .1); P();
        g.strokeStyle = it.id === 'vitals' ? '#4ef0b8' : '#7fb8ff'; g.lineWidth = lw * .8; g.beginPath(); for (let k = 0; k <= 10; k++) { const xx = x - sc * .6 + k * sc * .12, yy = y - sc * .95 + (it.id === 'vitals' && k === 5 ? -sc * .3 : Math.sin(k + t * 3) * sc * .06); k ? g.lineTo(xx, yy) : g.moveTo(xx, yy); } g.stroke(); g.strokeStyle = OUT; g.lineWidth = lw; }
      if (near) { g.save(); g.strokeStyle = '#ffe14d'; g.lineWidth = lw * 2.4; rrect(g, x - sc * 1.45, y - sc * 1.8, sc * 2.9, sc * 2.1, sc * .25); g.stroke(); g.restore(); }
    });
    // cámaras de seguridad en la pared (luz roja cuando alguien mira)
    S.CAMERAS.forEach(c => { const x = X(c.pos[0]), y = Y(c.pos[2]); if (x < -40 || y < -40 || x > v.w + 40 || y > v.h + 40) return; g.fillStyle = '#3b4258'; rrect(g, x - sc * .35, y - sc * .9, sc * .7, sc * .45, sc * .1); P(); g.fillStyle = o.camOn && Math.sin(t * 8) > 0 ? '#ff1d3a' : '#4a1018'; g.beginPath(); g.arc(x + sc * .2, y - sc * .8, sc * .1, 0, TAU); g.fill(); });
  };
  function station(g, type, x, y, sc, t, lw) {
    const P = () => { g.fill(); g.stroke(); }, R = (dx, dy, w, h, c, r) => { g.fillStyle = c; rrect(g, x + dx * sc, y + dy * sc, w * sc, h * sc, (r || .12) * sc); P(); };
    const scr = (dx, dy, w, h, c) => { R(dx, dy, w, h, '#1b2a44', .08); g.fillStyle = c || '#3ad0ff'; g.globalAlpha = .55 + Math.sin(t * 2 + x) * .15; g.fillRect(x + (dx + .1) * sc, y + (dy + .1) * sc, (w - .2) * sc, (h - .2) * sc); g.globalAlpha = 1; };
    switch (type) {
      case 'scan': g.fillStyle = '#5e6b85'; g.beginPath(); g.ellipse(x, y - sc * .2, sc * .95, sc * .55, 0, 0, TAU); P(); g.fillStyle = '#4ef0b8'; g.globalAlpha = .6; g.beginPath(); g.ellipse(x, y - sc * .22, sc * .6, sc * .32, 0, 0, TAU); g.fill(); g.globalAlpha = 1; R(-.15, -1.6, .3, 1.1, '#3a4258'); break;
      case 'fuel': case 'fillcan': g.fillStyle = '#ef7d0d'; rrect(g, x - sc * .5, y - sc * 1.5, sc, sc * 1.5, sc * .3); P(); g.fillStyle = '#c45f00'; g.fillRect(x - sc * .5, y - sc * .9, sc, sc * .15); R(-.15, -1.75, .3, .3, '#5c667f'); break;
      case 'trash': R(-.8, -1.6, 1.6, 1.7, '#6c7a5c'); R(-.6, -1.3, 1.2, .5, '#2f3826'); R(.55, -1.4, .2, .9, '#9aa4b8'); break;
      case 'leaves': R(-.8, -1.4, 1.6, 1.5, '#5c667f'); g.save(); g.translate(x, y - sc * .65); g.rotate(t * 6); g.fillStyle = '#2b3245'; for (let k = 0; k < 4; k++) { g.rotate(TAU / 4); g.beginPath(); g.ellipse(sc * .25, 0, sc * .25, sc * .1, 0, 0, TAU); g.fill(); } g.restore(); break;
      case 'asteroids': g.fillStyle = '#3b4a73'; g.beginPath(); g.ellipse(x, y - sc * .2, sc * .6, sc * .4, 0, 0, TAU); P(); R(-.8, -1.6, 1.6, .9, '#4a5370'); scr(-.6, -1.5, 1.2, .6, '#4ef0b8'); break;
      case 'shields': R(-.8, -1.5, 1.6, 1.6, '#4a5370'); for (let k = 0; k < 7; k++) { const a = k / 6 * TAU, rr = k ? sc * .32 : 0; g.fillStyle = Math.sin(t * 3 + k) > 0 ? '#5aa9ff' : '#c4162f'; g.beginPath(); g.arc(x + Math.cos(a) * rr, y - sc * .75 + Math.sin(a) * rr, sc * .14, 0, TAU); P(); } break;
      case 'wires': R(-.8, -1.7, 1.6, 1.8, '#5c667f'); ['#ff3b3b', '#3b7bff', '#ffd93b', '#ff4fd8'].forEach((c, k) => { g.fillStyle = c; g.fillRect(x - sc * .55 + k * sc * .32, y - sc * 1.4, sc * .16, sc * 1.1); }); break;
      case 'divert': R(-.85, -1.7, 1.7, 1.8, '#5c667f'); for (let k = 0; k < 6; k++) { g.fillStyle = '#1b2a44'; g.fillRect(x - sc * .7 + k * sc * .26, y - sc * 1.45, sc * .1, sc * 1.1); g.fillStyle = k === 2 ? '#ffd23f' : '#9aa4b8'; g.fillRect(x - sc * .74 + k * sc * .26, y - sc * (.6 + (k === 2 ? .6 : 0)), sc * .18, sc * .14); } break;
      case 'accept': R(-.6, -1.5, 1.2, 1.5, '#5c667f'); g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(x, y - sc * .8, sc * .28, 0, TAU); P(); break;
      case 'card': R(-.5, -1.6, 1, 1.7, '#3b4258'); R(-.6, -1.2, 1.2, .35, '#8a94b0'); g.fillStyle = Math.sin(t * 3) > 0 ? '#4ef0b8' : '#ff3d5e'; g.beginPath(); g.arc(x + sc * .35, y - sc * 1.4, sc * .08, 0, TAU); g.fill(); break;
      case 'align': R(-.7, -1.4, 1.4, 1.5, '#5c667f'); scr(-.55, -1.25, .8, .6, '#4ef0b8'); R(.35, -1.3, .2, .9, '#ffb547'); break;
      default: R(-.85, -1.6, 1.7, 1.7, '#5c667f'); scr(-.65, -1.45, 1.3, .75, type === 'simon' || type === 'manifolds' ? '#3b7bff' : type === 'samples' ? '#4ef0b8' : type === 'calibrate' ? '#ffd23f' : '#3ad0ff'); R(-.65, -.55, 1.3, .35, '#3b4258');
    }
  }

  // niebla de la visión: oscurece todo menos el polígono que ves (con borde suave). poly = [[x,y],...] en metros
  let shadeCv = null;
  W2.drawFog = (g, v, poly, eye, R, dark) => {
    if (!shadeCv) shadeCv = document.createElement('canvas');
    const cw = g.canvas.width, ch = g.canvas.height; if (shadeCv.width !== cw || shadeCv.height !== ch) { shadeCv.width = cw; shadeCv.height = ch; }
    const q = shadeCv.getContext('2d'), k = cw / v.w, X = x => ((x - v.cx) * v.sc + v.w / 2) * k, Y = y => ((y - v.cy) * v.sc + v.h / 2) * k;
    q.setTransform(1, 0, 0, 1, 0, 0); q.globalCompositeOperation = 'source-over'; q.clearRect(0, 0, cw, ch);
    q.fillStyle = dark || 'rgba(8,10,20,.78)'; q.fillRect(0, 0, cw, ch);
    q.globalCompositeOperation = 'destination-out';
    const ex = X(eye[0]), ey = Y(eye[1]), rr = R * v.sc * k, gr = q.createRadialGradient(ex, ey, rr * .6, ex, ey, rr);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); q.fillStyle = gr;
    q.beginPath(); poly.forEach(([x, y], i) => i ? q.lineTo(X(x), Y(y)) : q.moveTo(X(x), Y(y))); q.closePath(); q.fill();
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(shadeCv, 0, 0); g.restore();
  };

  // nombre encima del personaje (blanco con borde negro; rojo para los impostores compañeros)
  W2.name = (g, x, y, text, color, px) => {
    g.save(); g.font = `800 ${px}px "Inter",system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'bottom';
    g.lineJoin = 'round'; g.lineWidth = Math.max(2, px * .22); g.strokeStyle = 'rgba(0,0,0,.85)'; g.strokeText(text, x, y); g.fillStyle = color || '#fff'; g.fillText(text, x, y); g.restore();
  };

  // mapa pequeño (minimapa, panel de administración): salas en azul como el mapa del original
  W2.miniMap = ppm => {
    const { W, H, C, solid } = M, c = document.createElement('canvas'); c.width = Math.round(W * C * ppm); c.height = Math.round(H * C * ppm);
    const g = c.getContext('2d'), cs = C * ppm; g.fillStyle = '#0a1a3a'; g.fillRect(0, 0, c.width, c.height);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (!solid(i, j)) { g.fillStyle = S.roomAt(i, j) ? '#5b8fd9' : '#3f6fb8'; g.fillRect(i * cs, j * cs, cs + .5, cs + .5); }
    g.strokeStyle = '#d9ecff'; g.lineWidth = Math.max(1, ppm * 1.2);
    g.beginPath();
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { if (solid(i, j)) continue; const x = i * cs, y = j * cs;
      if (solid(i, j - 1)) { g.moveTo(x, y); g.lineTo(x + cs, y); } if (solid(i, j + 1)) { g.moveTo(x, y + cs); g.lineTo(x + cs, y + cs); }
      if (solid(i - 1, j)) { g.moveTo(x, y); g.lineTo(x, y + cs); } if (solid(i + 1, j)) { g.moveTo(x + cs, y); g.lineTo(x + cs, y + cs); } }
    g.stroke();
    g.font = `800 ${Math.max(7, ppm * 3.2)}px "Inter",system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.strokeStyle = '#0a1a3a'; g.lineWidth = Math.max(2, ppm);
    S.ROOMS.forEach(r => { const x = (r.r[0] + r.r[2] / 2) * cs, y = (r.r[1] + r.r[3] / 2) * cs; g.strokeText(r.name, x, y); g.fillText(r.name, x, y); });
    return c;
  };

  root.World2D = W2;
})(typeof window !== 'undefined' ? window : globalThis);
