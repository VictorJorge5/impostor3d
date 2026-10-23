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
    let sh = look.am ? H * .58 : H * .64, sw = sh * aspect; const cy = look.am ? H * .46 : H * .5; if (sw > W * .98) { sw = W * .98; sh = sw / aspect; }   // la cara entera, de la frente a la barbilla, sin deformarla
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
    if (look.f) visor(g, dir * bw * .07, top + h * .37, bw * .41, h * .285, look, lw);   // con foto: el visor toma la forma de la cara y la cara se amolda a él
    else visor(g, dir * bw * .12, top + h * .32, bw * .52, h * .24, look, lw);   // sin foto: el visor ancho del original
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
      g.save(); g.clip(); g.fillStyle = '#222'; g.fill(); if ('filter' in g) g.filter = 'brightness(1.08) contrast(1.1) saturate(1.1)';
      g.drawImage(fc.im, fc.sx, fc.sy, fc.sw, fc.sh, cx - rx, cy - ry, rx * 2, ry * 2); if ('filter' in g) g.filter = 'none';
      const sh = g.createRadialGradient(cx - rx * .15, cy - ry * .2, Math.min(rx, ry) * .35, cx, cy, Math.max(rx, ry) * 1.02); sh.addColorStop(0, 'rgba(255,255,255,.06)'); sh.addColorStop(.6, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(10,20,30,.45)'); g.fillStyle = sh; g.fill(); g.restore();   // sombreado de esfera: la cara se ve curvada, como sobre una cabeza
    } else {
      const gr = g.createLinearGradient(0, cy - ry, 0, cy + ry); gr.addColorStop(0, '#c6ecf5'); gr.addColorStop(.55, '#86c3d7'); gr.addColorStop(1, '#4b8aa3'); g.fillStyle = gr; g.fill();
    }
    g.lineWidth = lw * 1.1; g.strokeStyle = OUT; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = Math.max(1, lw * .8); g.beginPath(); g.ellipse(cx, cy, rx * .86, ry * .82, 0, fc ? -2.35 : -2.5, fc ? -1.95 : -1.6); g.stroke();   // brillo pequeño en la esquina: no tapa la cara
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
  // cadáver del original: la mitad de abajo tumbada hacia delante, con el corte a la vista y el hueso asomando
  W2.body = (g, x, y, h, color, dir) => {
    const col = color || '#c51111', lw = Math.max(1.2, h * .045), d = dir < 0 ? -1 : 1;
    g.save(); g.translate(x, y); g.scale(d, 1); g.lineJoin = 'round'; g.strokeStyle = OUT; g.lineWidth = lw;
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(h * .02, 0, h * .5, h * .09, 0, 0, TAU); g.fill();
    // piernas (hacia abajo a la derecha)
    g.fillStyle = shade(col, -.25); rrect(g, h * .02, -h * .2, h * .2, h * .2, h * .07); g.fill(); g.stroke(); rrect(g, h * .2, -h * .2, h * .2, h * .2, h * .07); g.fill(); g.stroke();
    // cuerpo
    g.fillStyle = col; rrect(g, -h * .34, -h * .52, h * .74, h * .42, h * .19); g.fill(); g.stroke();
    g.fillStyle = shade(col, -.3); rrect(g, -h * .3, -h * .2, h * .66, h * .08, h * .04); g.fill();
    g.fillStyle = 'rgba(255,255,255,.22)'; rrect(g, -h * .08, -h * .48, h * .36, h * .07, h * .035); g.fill();
    // mochila
    g.fillStyle = shade(col, -.15); rrect(g, h * .02, -h * .62, h * .28, h * .16, h * .06); g.fill(); g.stroke();
    // el corte: anillos del mismo color, cada vez más oscuros
    g.fillStyle = shade(col, -.35); g.beginPath(); g.ellipse(-h * .34, -h * .31, h * .13, h * .21, 0, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = shade(col, -.55); g.beginPath(); g.ellipse(-h * .34, -h * .31, h * .085, h * .14, 0, 0, TAU); g.fill();
    g.fillStyle = shade(col, -.72); g.beginPath(); g.ellipse(-h * .34, -h * .31, h * .04, h * .065, 0, 0, TAU); g.fill();
    // hueso
    g.fillStyle = '#f1ead9'; rrect(g, -h * .62, -h * .34, h * .28, h * .065, h * .03); g.fill(); g.stroke();
    g.beginPath(); g.arc(-h * .63, -h * .35, h * .045, 0, TAU); g.fill(); g.stroke(); g.beginPath(); g.arc(-h * .63, -h * .28, h * .045, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = '#f1ead9'; rrect(g, -h * .6, -h * .34, h * .2, h * .065, h * .03); g.fill();
    g.restore();
  };

  // la mancha de sangre bajo el cadáver (siempre la misma para cada cuerpo)
  W2.splat = (g, x, y, h, seed) => {
    const rnd = i => { const v = Math.sin((seed + i) * 78.233) * 43758.5453; return v - Math.floor(v); };
    g.save(); g.fillStyle = 'rgba(122,8,20,.8)'; g.beginPath(); g.ellipse(x - h * .1, y - h * .05, h * .42, h * .13, 0, 0, TAU); g.fill();
    for (let i = 0; i < 7; i++) { const a = rnd(i) * TAU, r = h * (.35 + rnd(i + 9) * .4); g.beginPath(); g.ellipse(x - h * .1 + Math.cos(a) * r, y - h * .05 + Math.sin(a) * r * .32, h * (.03 + rnd(i + 3) * .05), h * (.02 + rnd(i + 5) * .03), a, 0, TAU); g.fill(); }
    g.restore();
  };
  // mascotas (S.OPT.pet): perrito, gatito, robot, minitripulante, pollito, dron, hámster, ovni, cangrejo y calamar
  // mood: 'sad' = llora junto a su dueño muerto; 'scared' = da un salto del susto (en la animación de muerte)
  W2.pet = (g, x, y, h, type, color, t, mv, dir, mood) => {
    dir = dir < 0 ? -1 : 1; const lw = Math.max(1, h * .07), hop = mv ? -Math.abs(Math.sin(t * 12)) * h * .15 : mood === 'scared' ? -Math.abs(Math.sin(t * 9)) * h * .45 : 0;
    g.save(); g.translate(x, y + hop); g.scale(dir, 1); if (mood === 'sad') g.scale(1, .92 + Math.sin(t * 7) * .02); g.lineJoin = 'round'; g.strokeStyle = OUT; g.lineWidth = lw;
    const E = (cx, cy, rx, ry, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.fill(); g.stroke(); };
    const eye = (cx, cy) => { g.fillStyle = '#111'; g.beginPath(); g.arc(cx, cy, h * .05, 0, TAU); g.fill(); };
    switch (type) {
      case 1: E(0, -h * .32, h * .42, h * .28, '#b07a45'); E(h * .32, -h * .56, h * .24, h * .22, '#b07a45'); E(h * .2, -h * .72, h * .08, h * .14, '#7a4f28'); eye(h * .4, -h * .6); E(-h * .45, -h * .45, h * .08, h * .05, '#b07a45'); break;
      case 2: E(0, -h * .3, h * .4, h * .26, '#8d8f99'); E(h * .3, -h * .55, h * .24, h * .22, '#8d8f99'); [[.18, -.78], [.42, -.78]].forEach(([a, b]) => { g.fillStyle = '#8d8f99'; g.beginPath(); g.moveTo(a * h - h * .07, -h * .66); g.lineTo(a * h, b * h); g.lineTo(a * h + h * .07, -h * .66); g.fill(); g.stroke(); }); eye(h * .4, -h * .57); break;
      case 3: g.fillStyle = '#b8c2d6'; rrect(g, -h * .3, -h * .62, h * .6, h * .52, h * .1); g.fill(); g.stroke(); g.fillStyle = '#3fe0ff'; rrect(g, -h * .12, -h * .52, h * .36, h * .16, h * .05); g.fill(); g.beginPath(); g.moveTo(0, -h * .62); g.lineTo(0, -h * .82); g.stroke(); E(0, -h * .85, h * .05, h * .05, '#ff3d5e'); break;
      case 4: g.scale(dir, 1); crew(g, 0, 0, h * .9, { color, dir, mv, ph: t * 12, t }); break;
      case 5: E(0, -h * .32, h * .3, h * .28, '#ffd84a'); g.fillStyle = '#ff9a1f'; g.beginPath(); g.moveTo(h * .28, -h * .38); g.lineTo(h * .44, -h * .33); g.lineTo(h * .28, -h * .28); g.fill(); eye(h * .14, -h * .42); break;
      case 6: { const fy = -h * .9 + Math.sin(t * 3) * h * .08; g.fillStyle = '#5d6780'; rrect(g, -h * .3, fy, h * .6, h * .2, h * .08); g.fill(); g.stroke(); g.strokeStyle = '#c9d2e6'; g.lineWidth = lw * .8; const s = Math.sin(t * 40) * h * .25; g.beginPath(); g.moveTo(-s, fy - h * .06); g.lineTo(s, fy - h * .06); g.stroke(); E(h * .14, fy + h * .1, h * .05, h * .05, '#4ef0b8'); break; }
      case 7: E(0, -h * .3, h * .36, h * .3, '#e0913f'); E(h * .06, -h * .22, h * .2, h * .16, '#fbe3c0'); E(-h * .16, -h * .58, h * .09, h * .08, '#e0913f'); E(h * .18, -h * .58, h * .09, h * .08, '#e0913f'); eye(h * .16, -h * .4); g.fillStyle = '#f39aa0'; g.beginPath(); g.arc(h * .3, -h * .32, h * .04, 0, TAU); g.fill(); break;   // hámster
      case 8: { const fy = -h * .55 + Math.sin(t * 2.5) * h * .1; E(0, fy - h * .12, h * .2, h * .18, '#9ff7c4'); g.fillStyle = '#a6aebd'; g.beginPath(); g.ellipse(0, fy, h * .45, h * .13, 0, 0, TAU); g.fill(); g.stroke(); for (let i = 0; i < 3; i++) { g.fillStyle = Math.floor(t * 4 + i) % 3 ? '#ffd23f' : '#ff5b5b'; g.beginPath(); g.arc(-h * .25 + i * h * .25, fy + h * .02, h * .045, 0, TAU); g.fill(); } g.fillStyle = 'rgba(160,255,200,.18)'; g.beginPath(); g.moveTo(-h * .16, fy + h * .1); g.lineTo(h * .16, fy + h * .1); g.lineTo(h * .3, 0); g.lineTo(-h * .3, 0); g.fill(); break; }   // ovni
      case 9: { E(0, -h * .24, h * .38, h * .2, '#e5483a'); const cl = Math.sin(t * 6) * .3; [-1, 1].forEach(sd => { g.save(); g.translate(sd * h * .4, -h * .36); g.rotate(sd * (.4 + cl)); E(0, -h * .08, h * .12, h * .1, '#e5483a'); g.restore(); }); for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-h * .2 + i * h * .2, -h * .1); g.lineTo(-h * .26 + i * h * .2, 0); g.stroke(); } g.lineWidth = lw * .8; g.beginPath(); g.moveTo(-h * .08, -h * .4); g.lineTo(-h * .1, -h * .52); g.moveTo(h * .1, -h * .4); g.lineTo(h * .12, -h * .52); g.stroke(); E(-h * .1, -h * .55, h * .05, h * .05, '#fff'); E(h * .12, -h * .55, h * .05, h * .05, '#fff'); break; }   // cangrejo
      case 10: { g.fillStyle = '#9b5de5'; for (let i = 0; i < 4; i++) { const wv = Math.sin(t * 6 + i) * h * .05; g.beginPath(); g.moveTo(-h * .22 + i * h * .14, -h * .25); g.quadraticCurveTo(-h * .26 + i * h * .14 + wv, -h * .05, -h * .2 + i * h * .14 + wv, 0); g.lineTo(-h * .14 + i * h * .14, -h * .25); g.fill(); g.stroke(); } E(0, -h * .45, h * .3, h * .3, '#9b5de5'); eye(h * .08, -h * .48); eye(h * .2, -h * .48); break; }   // calamar
    }
    if (mood === 'sad') {   // lágrimas que caen
      g.fillStyle = '#7fd3ff'; g.strokeStyle = OUT; g.lineWidth = lw * .5;
      for (let i = 0; i < 4; i++) { const f = (t * 1.1 + i * .25) % 1, sd = i % 2 ? -1 : 1, tx = h * (.15 + .22 * f) * sd + h * .1, ty = -h * .62 + f * h * .5; g.globalAlpha = Math.min(1, (1 - f) * 1.6); g.beginPath(); g.moveTo(tx, ty - h * .12); g.quadraticCurveTo(tx + h * .1, ty, tx, ty + h * .06); g.quadraticCurveTo(tx - h * .1, ty, tx, ty - h * .12); g.fill(); g.stroke(); }
      g.globalAlpha = 1;
    }
    if (mood === 'scared') { g.scale(dir, 1); g.fillStyle = '#ff2a2a'; g.strokeStyle = OUT; g.lineWidth = lw * .7; g.font = `900 ${Math.round(h * .55)}px Arial Black, sans-serif`; g.textAlign = 'center'; g.strokeText('!', 0, -h * 1.05); g.fillText('!', 0, -h * 1.05); }
    g.restore();
  };

  // el cuerpo de pie (la mitad de abajo con el hueso hacia arriba), como en "¡Cadáver reportado!"
  W2.bodyUp = (g, x, y, h, color) => {
    const col = color || '#c51111', lw = Math.max(1.5, h * .045);
    g.save(); g.translate(x, y); g.lineJoin = 'round'; g.strokeStyle = OUT; g.lineWidth = lw;
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(0, 0, h * .42, h * .08, 0, 0, TAU); g.fill();
    g.fillStyle = shade(col, -.15); rrect(g, h * .22, -h * .62, h * .2, h * .36, h * .07); g.fill(); g.stroke();   // mochila
    g.fillStyle = col; rrect(g, -h * .3, -h * .3, h * .24, h * .3, h * .08); g.fill(); g.stroke(); rrect(g, h * .02, -h * .3, h * .24, h * .3, h * .08); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(-h * .34, -h * .66); g.lineTo(-h * .34, -h * .26); g.quadraticCurveTo(-h * .34, -h * .16, -h * .24, -h * .16); g.lineTo(h * .2, -h * .16); g.quadraticCurveTo(h * .3, -h * .16, h * .3, -h * .26); g.lineTo(h * .3, -h * .66); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = shade(col, -.35); g.beginPath(); g.ellipse(-h * .02, -h * .66, h * .32, h * .09, 0, 0, TAU); g.fill(); g.stroke();   // el corte
    g.fillStyle = shade(col, -.6); g.beginPath(); g.ellipse(-h * .02, -h * .66, h * .2, h * .05, 0, 0, TAU); g.fill();
    g.fillStyle = '#f1ead9'; rrect(g, -h * .06, -h * .95, h * .09, h * .3, h * .04); g.fill(); g.stroke();   // hueso
    g.beginPath(); g.arc(-h * .07, -h * .96, h * .055, 0, TAU); g.fill(); g.stroke(); g.beginPath(); g.arc(h * .04, -h * .96, h * .055, 0, TAU); g.fill(); g.stroke();
    rrect(g, -h * .05, -h * .95, h * .07, h * .2, h * .03); g.fill();
    g.restore();
  };

  // "¡Reunión de emergencia!" / "¡Cadáver reportado!": fondo rojo con estelas, franja blanca con el título,
  // franjas amarillas y negras abajo, y el tripulante pulsando el botón (o el cuerpo con el bocadillo de la calavera)
  W2.meetingScene = (g, w, h, k, o) => {
    const rnd = i => { const v = Math.sin(i * 57.3 + 1.7) * 43758.5453; return v - Math.floor(v); }, t = k * 2.2;
    const bandY = h * .2, bandH = h * .17, stripeY = h * .84;
    const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#3d0005'); bg.addColorStop(.5, '#8a0510'); bg.addColorStop(1, '#3d0005');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 46; i++) {   // estelas horizontales que pasan a toda velocidad
      const y = h * rnd(i), len = w * (.2 + rnd(i + 50) * .7), sp = w * (1.2 + rnd(i + 99) * 1.6), span = w * 2.4, x = ((rnd(i + 7) * span - t * sp) % span + span) % span - w * .7;
      g.fillStyle = ['#c3121f', '#ff3a3a', '#6e0710', '#e8505a'][i % 4]; g.globalAlpha = .55 + rnd(i + 3) * .45; g.fillRect(x, y, len, Math.max(1, h * (.003 + rnd(i + 11) * .008)));
    }
    g.globalAlpha = 1;
    // franja blanca con el título (entra de golpe)
    const bk = Math.min(1, k * 6), bh = bandH * bk;
    g.fillStyle = '#fff'; g.fillRect(0, bandY + (bandH - bh) / 2, w, bh);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, bandY + (bandH + bh) / 2 - h * .008, w, h * .008);
    if (bk >= 1) {
      const fs = Math.min(bandH * .72, w / Math.max(10, o.title.length) * 1.55); g.font = `italic 900 ${Math.round(fs)}px "Arial Black", Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      const sc = 1 + Math.max(0, .25 - k) * 1.6; g.save(); g.translate(w / 2, bandY + bandH / 2); g.scale(sc, sc);
      g.lineJoin = 'round'; g.lineWidth = fs * .16; g.strokeStyle = '#5a0008'; g.strokeText(o.title, 0, 0); g.fillStyle = '#e0141e'; g.fillText(o.title, 0, 0);
      g.fillStyle = 'rgba(255,255,255,.28)'; g.save(); g.beginPath(); g.rect(-w, -fs, w * 2, fs * .42); g.clip(); g.fillText(o.title, 0, 0); g.restore(); g.restore();
    }
    // franjas de peligro
    g.fillStyle = '#111'; g.fillRect(0, stripeY, w, h - stripeY); g.fillStyle = '#ffd400'; const sw = h * .12, off = (t * sw * .6) % (sw * 2);
    for (let x = -sw * 2 - off; x < w + sw * 2; x += sw * 2) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + sw, stripeY); g.lineTo(x + sw * 2, stripeY); g.lineTo(x + sw, h); g.closePath(); g.fill(); }
    const cx = w * .5, rise = Math.min(1, k * 4), ease = 1 - Math.pow(1 - rise, 3);
    if (o.kind === 'body') {
      const v = o.victim || { color: '#c51111' }, sz = h * .34, by = h * 1.25 - ease * h * .28;
      W2.bodyUp(g, cx, by, sz, v.color);
      // bocadillo con la calavera
      const pop = Math.max(0, Math.min(1, (k - .18) * 6)), bx = cx - sz * .05, byy = h * .53, r = h * .085 * (pop < 1 ? pop * 1.1 : 1);
      if (pop > 0) {
        g.save(); g.lineJoin = 'round'; g.strokeStyle = OUT; g.lineWidth = Math.max(2, sz * .03); g.fillStyle = '#c9cdd6';
        g.beginPath(); g.ellipse(bx, byy, r * 1.15, r, 0, 0, TAU); g.fill(); g.stroke();
        g.beginPath(); g.moveTo(bx - r * .2, byy + r * .9); g.lineTo(bx - r * .05, byy + r * 1.45); g.lineTo(bx + r * .25, byy + r * .85); g.fill(); g.stroke();
        g.fillStyle = '#c9cdd6'; g.beginPath(); g.ellipse(bx, byy, r * 1.1, r * .94, 0, 0, TAU); g.fill();
        g.fillStyle = '#eceef2'; g.beginPath(); g.arc(bx, byy - r * .12, r * .55, 0, TAU); g.fill(); g.stroke(); rrect(g, bx - r * .3, byy + r * .2, r * .6, r * .32, r * .08); g.fill(); g.stroke();
        g.strokeStyle = '#333'; g.lineWidth = Math.max(2, r * .09); g.lineCap = 'round';
        for (const ex of [-.22, .22]) { const X = bx + ex * r, Y = byy - r * .15, d = r * .11; g.beginPath(); g.moveTo(X - d, Y - d); g.lineTo(X + d, Y + d); g.moveTo(X + d, Y - d); g.lineTo(X - d, Y + d); g.stroke(); }
        g.lineWidth = Math.max(1.5, r * .05); for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(bx + i * r * .14, byy + r * .24); g.lineTo(bx + i * r * .14, byy + r * .48); g.stroke(); }
        g.restore();
      }
    } else {
      // la mesa azul con el botón; el tripulante se asoma por detrás y lo aporrea
      const c = o.caller || { color: '#c51111', look: {} }, sz = h * .44, ty = h * 1.02, press = k > .22 && k < .5 ? Math.abs(Math.sin((k - .22) * 22)) : 0;
      crew(g, cx - sz * .05, ty - sz * .22 + (1 - ease) * sz * .8 + press * sz * .03, sz, { color: c.color, look: c.look, dir: 1, t });
      g.save(); g.lineJoin = 'round'; g.strokeStyle = OUT; g.lineWidth = Math.max(2, h * .008);
      const tw = Math.min(w * .26, h * .62); g.fillStyle = '#3f63c9'; g.beginPath(); g.moveTo(cx - tw, h); g.quadraticCurveTo(cx - tw * .8, ty - sz * .36, cx, ty - sz * .38); g.quadraticCurveTo(cx + tw * .8, ty - sz * .36, cx + tw, h); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#2c4796'; g.beginPath(); g.moveTo(cx - tw * .92, h); g.quadraticCurveTo(cx - tw * .74, ty - sz * .25, cx, ty - sz * .27); g.quadraticCurveTo(cx + tw * .74, ty - sz * .25, cx + tw * .92, h); g.closePath(); g.fill();
      // el botón (cuadro de peligro, botón rojo y la tapa de cristal abierta)
      const bx = cx + tw * .2, by = ty - sz * .3, bs = sz * .42;
      g.save(); g.translate(bx, by); g.scale(1, .45); g.rotate(Math.PI / 4);
      g.fillStyle = '#ffd400'; g.fillRect(-bs / 2, -bs / 2, bs, bs); g.strokeRect(-bs / 2, -bs / 2, bs, bs); g.fillStyle = '#111'; for (let i = -2; i <= 2; i++) { g.save(); g.beginPath(); g.rect(-bs / 2, -bs / 2, bs, bs); g.clip(); g.translate(i * bs * .3, 0); g.rotate(.8); g.fillRect(-bs * .05, -bs, bs * .1, bs * 2); g.restore(); }
      g.restore();
      g.fillStyle = '#b8101d'; g.beginPath(); g.ellipse(bx, by + (press ? sz * .01 : 0), bs * .26, bs * .13, 0, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = 'rgba(190,225,255,.55)'; g.beginPath(); g.moveTo(bx + bs * .3, by); g.lineTo(bx + bs * .45, by - bs * .7); g.lineTo(bx + bs * .55, by - bs * .62); g.lineTo(bx + bs * .42, by + bs * .05); g.closePath(); g.fill(); g.stroke();
      // la mano del tripulante golpeando el botón, con el estallido
      if (k > .18) {
        const hy = by - sz * .06 - (1 - press) * sz * .08;
        g.strokeStyle = OUT; g.lineWidth = bs * .2; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx + sz * .12, ty - sz * .62); g.quadraticCurveTo(bx - bs * .5, hy - bs * .5, bx - bs * .05, hy); g.stroke(); g.strokeStyle = c.color; g.lineWidth = bs * .12; g.stroke();   // el brazo
        g.strokeStyle = OUT; g.lineWidth = Math.max(2, h * .008); g.fillStyle = c.color; g.beginPath(); g.ellipse(bx - bs * .05, hy, bs * .3, bs * .17, -.2, 0, TAU); g.fill(); g.stroke();
        if (press > .7) { g.fillStyle = '#ffde3a'; g.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, rr = i % 2 ? bs * .3 : bs * .62; g.lineTo(bx + Math.cos(a) * rr, by + Math.sin(a) * rr * .6); } g.closePath(); g.globalAlpha = .9; g.fill(); g.globalAlpha = 1; }
      }
      g.restore();
    }
  };

  // retrato para menús, sala y reuniones: busto del crewmate con la cara grande en el visor
  W2.bust = (c, look, color) => {
    const s = c.width, g = c.getContext('2d'); g.clearRect(0, 0, s, s);
    const col = color || '#c51111', lw = s * .035;
    g.save(); g.lineJoin = 'round'; g.strokeStyle = OUT; g.lineWidth = lw;
    g.fillStyle = col; g.beginPath(); g.moveTo(s * .12, s * 1.05); g.lineTo(s * .12, s * .45); g.arc(s * .5, s * .45, s * .38, Math.PI, 0); g.lineTo(s * .88, s * 1.05); g.closePath(); g.fill();
    g.save(); g.clip(); { const gr = g.createLinearGradient(s * .12, 0, s * .5, 0); gr.addColorStop(0, shade(col, -.4)); gr.addColorStop(.45, shade(col, -.2)); gr.addColorStop(1, col); g.fillStyle = gr; g.globalAlpha = .55; g.fillRect(0, 0, s * .5, s); } g.restore(); g.stroke();
    visor(g, s * .53, s * .53, s * .36, s * .34, look || {}, lw);   // la cara ocupa casi todo el retrato
    hat(g, look || {}, s * .52, s * .08, s * .76, s * .9, lw);
    g.restore();
    if (look && look.f) { const im = imgFor(look.f); if (!im.complete) im.addEventListener('load', () => W2.bust(c, look, color), { once: true }); }
  };


  /* ---------- escenas de pantalla completa (intro, victoria, muerte) ---------- */
  // fila de crewmates como en la presentación del original: tú delante en el centro y el resto detrás a los lados
  // list = [{ color, look, name, ghost, nameColor }], el primero va en el centro
  W2.lineup = (g, w, h, list, o) => {
    o = o || {}; const base = h * (o.base || .9), H0 = Math.min(h * (o.hmax || .4), w * (h > w ? .3 : .2)), sp = Math.min(w * .9 / Math.max(2, list.length), H0 * .8), k0 = o.k == null ? 1 : o.k;
    const gl = g.createRadialGradient(w / 2, base, 0, w / 2, base, w * .5); gl.addColorStop(0, o.glow || 'rgba(110,200,255,.55)'); gl.addColorStop(1, 'rgba(0,0,0,0)');
    g.save(); g.fillStyle = gl; g.beginPath(); g.ellipse(w / 2, base, w * .5, h * .16, 0, 0, TAU); g.fill(); g.restore();
    const slots = list.map((p, k) => { const s = Math.ceil(k / 2), side = k === 0 ? 0 : k % 2 ? -1 : 1; return { p, s, side }; });
    slots.sort((a, b) => b.s - a.s).forEach(({ p, s, side }) => {
      const sz = H0 * (1 - s * .07), x = w / 2 + side * s * sp, y = base - s * h * .03, a = Math.max(0, Math.min(1, k0 * 1.6 - s * .12));
      if (a <= 0) return;
      g.save(); g.globalAlpha = a; g.translate(0, (1 - a) * h * .05);
      g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(x, y, sz * .3, sz * .06, 0, 0, TAU); g.fill();
      crew(g, x, y, sz, { color: p.color, look: p.look, dir: side > 0 ? -1 : 1, ghost: p.ghost, alpha: p.ghost ? .55 : null, t: o.t || 0 });
      if (p.name && o.names !== false) W2.name(g, x, o.namesBelow ? y + sz * .1 : y - sz * (p.look && p.look.t ? 1.26 : 1.06), p.name, p.nameColor || '#fff', Math.max(11, Math.min(18, sz * .11)));
      g.restore();
    });
  };
  // "¡Shhhhh!": el crewmate del jugador pide silencio antes de saber su papel
  W2.shh = (g, w, h, p, k) => {
    const bg = g.createRadialGradient(w * .4, h * .5, 0, w * .4, h * .5, Math.max(w, h) * .7); bg.addColorStop(0, '#2a1240'); bg.addColorStop(1, '#05030a'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const sz = Math.min(h * .62, w * .42), x = w * (w > h ? .36 : .5), y = h * (w > h ? .82 : .62), pop = Math.min(1, k / .25), s2 = .85 + .15 * (1 - Math.pow(1 - pop, 3));
    g.save(); g.translate(x, y); g.scale(s2, s2); crew(g, 0, 0, sz, { color: p.color, look: p.look, dir: 1, t: k });
    g.restore();
    const fs = Math.min(w * (w > h ? .1 : .15), h * .18), tx = w > h ? w * .7 : w * .5, ty = w > h ? h * .5 : h * .2;
    g.save(); g.translate(tx, ty); g.rotate(-.08); g.font = `900 italic ${fs}px "Chakra Petch","Inter",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.lineWidth = fs * .16; g.strokeStyle = '#000'; const txt = '¡Shhhhh!'.slice(0, Math.max(2, Math.ceil(Math.min(1, k / .7) * 8)));
    g.strokeText(txt, 0, 0); g.fillStyle = '#ff2e4d'; g.fillText(txt, 0, 0); g.restore();
  };
  // escena de tu muerte: el impostor te ataca sobre fondo rojo, como en el original
  // escena de tu muerte, como en el original: fondo rosa con llamaradas rojas y una de las animaciones (cuchillo, cuello,
  // lengua o pistola). k va de 0 a 1.
  W2.KILLS = ['knife', 'neck', 'tongue', 'gun'];
  W2.killScene = (g, w, h, killer, victim, k, kind) => {
    const rnd = i => { const v = Math.sin(i * 91.7 + 3.1) * 43758.5453; return v - Math.floor(v); }, t = k * 2.4;
    g.fillStyle = '#f3c6ca'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 10; i++) {   // llamaradas rojas que pasan a toda velocidad
      const y = h * (.06 + i * .1) + (rnd(i) - .5) * h * .05, len = w * (.55 + rnd(i + 9) * .6), sp = w * (1.1 + rnd(i + 3)), span = w * 2.2;
      const x0 = ((rnd(i + 5) * span - t * sp) % span + span) % span - w * .6, th = h * (.025 + rnd(i + 7) * .05);
      g.fillStyle = i % 3 ? '#c4121f' : '#8f0a16'; g.beginPath(); g.moveTo(x0, y);
      for (let q = 0; q <= 12; q++) g.lineTo(x0 + len * q / 12, y - th * (1 - q / 14) * (q % 2 ? 1.7 : .6));
      for (let q = 12; q >= 0; q--) g.lineTo(x0 + len * q / 12, y + th * (1 - q / 14) * (q % 2 ? .7 : 1.6));
      g.closePath(); g.fill();
    }
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = Math.max(1.5, h * .007);
    for (let i = 0; i < 16; i++) { const y = h * rnd(i + 20), len = w * (.08 + rnd(i + 30) * .25), span = w * 1.6, x = ((rnd(i + 40) * span - t * w * 2.4) % span + span) % span - w * .3; g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y); g.stroke(); }
    if (!killer || !victim) return;
    kind = kind || 'knife';
    const sz = Math.min(h * .42, w * .22), base = h * .72, kx = w * .42, vx = kx + sz * .62, lw = Math.max(1.5, sz * .045);
    const seg = (a, b) => Math.max(0, Math.min(1, (k - a) / (b - a)));
    const dieAt = { knife: .6, neck: .62, tongue: .55, gun: .74 }[kind], dead = k >= dieAt, kd = seg(dieAt, dieAt + .12);
    const half = (x, y, top, rot, dx, dy) => {   // la mitad de arriba o de abajo del tripulante (para partirlo)
      g.save(); g.beginPath(); top ? g.rect(x - sz, y - sz * 2, sz * 2, sz * 1.48) : g.rect(x - sz, y - sz * .52, sz * 2, sz); g.clip();
      g.translate(x + (dx || 0), y - sz * .52 + (dy || 0)); g.rotate(rot || 0); g.translate(-x, -(y - sz * .52));
      crew(g, x, y, sz, { color: victim.color, look: victim.look, dir: 1, t }); g.restore();
    };
    const blood = (x, y, n, sp) => { g.fillStyle = shade(victim.color, -.2); for (let i = 0; i < n; i++) { const a = -Math.PI * (.15 + rnd(i + 60) * .7), r = sz * (.15 + rnd(i + 70) * .5) * sp; g.beginPath(); g.ellipse(x + Math.cos(a) * r, y + Math.sin(a) * r, sz * .04, sz * .03, a, 0, TAU); g.fill(); } };
    // el impostor (tiembla un poco al principio, como en el original)
    const shake = k < .25 ? Math.sin(t * 60) * sz * .01 : 0;
    if (kind !== 'tongue' || k < .14 || k > .62) crew(g, kx + shake, base, sz, { color: killer.color, look: killer.look, dir: 1, t });
    else {   // la cabeza del impostor se abre en una boca enorme con dientes
      crew(g, kx, base, sz, { color: killer.color, look: killer.look, dir: 1, t });
      const mx = kx + sz * .18, my = base - sz * .72, op = seg(.14, .24) * (1 - seg(.55, .62));
      g.save(); g.strokeStyle = OUT; g.lineWidth = lw; g.fillStyle = '#5b0b14'; g.beginPath(); g.ellipse(mx, my, sz * .22, sz * .2 * op + 1, 0, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#fff'; for (let i = 0; i < 6; i++) { const tx = mx - sz * .18 + i * sz * .072; g.beginPath(); g.moveTo(tx, my - sz * .2 * op); g.lineTo(tx + sz * .035, my - sz * .2 * op + sz * .07); g.lineTo(tx + sz * .07, my - sz * .2 * op); g.fill(); g.beginPath(); g.moveTo(tx, my + sz * .2 * op); g.lineTo(tx + sz * .035, my + sz * .2 * op - sz * .07); g.lineTo(tx + sz * .07, my + sz * .2 * op); g.fill(); }
      g.restore();
    }
    // la víctima
    if (!dead) {
      if (kind === 'neck' && k > .3) { half(vx, base, false); half(vx, base, true, -seg(.3, .58) * 2.2, 0, 0); }   // le gira la cabeza
      else if (kind === 'gun' && k > .2) { g.save(); g.translate(vx + sz * .1, base); g.rotate(seg(.2, .3) * Math.PI / 2); crew(g, 0, 0, sz, { color: victim.color, look: victim.look, dir: 1, t }); g.restore(); }   // la tira al suelo
      else crew(g, vx, base, sz, { color: victim.color, look: victim.look, dir: 1, t });
    } else {
      W2.body(g, vx + sz * .25, base, sz, victim.color, 1);
      if (kd < 1) blood(vx, base - sz * .45, 14, kd * 2);
      if (kind === 'knife' || kind === 'gun') { const f = seg(dieAt, dieAt + .35); half(vx + f * sz * 1.4, base, true, f * 3, 0, -Math.sin(f * Math.PI) * sz * .7 + f * sz * .4); }   // la parte de arriba sale volando
      if (kind === 'knife') { g.save(); g.translate(vx + sz * .2, base - sz * .55); g.fillStyle = '#d8dee8'; g.strokeStyle = OUT; g.lineWidth = lw; g.beginPath(); g.moveTo(0, -sz * .3); g.lineTo(sz * .05, -sz * .05); g.lineTo(-sz * .05, -sz * .05); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#3b6b3b'; rrect(g, -sz * .07, -sz * .05, sz * .14, sz * .05, sz * .02); g.fill(); g.stroke(); rrect(g, -sz * .03, 0, sz * .06, sz * .12, sz * .02); g.fill(); g.stroke(); g.restore(); }
    }
    // la mascota de la víctima se asusta (como en el original)
    if (victim.look && victim.look.pet) { const ps = sz * .4; W2.pet(g, vx + sz * .75, base, ps, victim.look.pet, victim.color, t, false, -1, k > dieAt - .1 ? 'scared' : null); }
    // los ataques
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
    if (kind === 'knife' && k > .22 && k < dieAt) {   // un brazo sale de su cabeza y apuñala
      const r = seg(.22, .34), st = Math.abs(Math.sin((k - .34) * 60)) * sz * .12 * (k > .34 ? 1 : 0);
      const hx = kx + (vx - kx) * r * .95, hy = base - sz * (1.05 + .25 * Math.sin(r * Math.PI)) + st;
      g.strokeStyle = OUT; g.lineWidth = sz * .17; g.beginPath(); g.moveTo(kx, base - sz * .95); g.quadraticCurveTo(kx + sz * .2, base - sz * 1.45, hx, hy); g.stroke();
      g.strokeStyle = killer.color; g.lineWidth = sz * .12; g.stroke();
      g.fillStyle = '#e5ebf3'; g.strokeStyle = OUT; g.lineWidth = lw; g.beginPath(); g.moveTo(hx + sz * .02, hy); g.lineTo(hx + sz * .08, hy + sz * .3); g.lineTo(hx - sz * .04, hy + sz * .05); g.closePath(); g.fill(); g.stroke();
    }
    if (kind === 'neck' && k > .2 && k < dieAt) {   // la mano le agarra el casco
      const r = seg(.2, .3), hx = kx + (vx - kx) * r, hy = base - sz * .78;
      g.strokeStyle = OUT; g.lineWidth = sz * .16; g.beginPath(); g.moveTo(kx + sz * .1, base - sz * .5); g.quadraticCurveTo(kx + sz * .3, base - sz * 1.1, hx, hy); g.stroke(); g.strokeStyle = killer.color; g.lineWidth = sz * .11; g.stroke();
      g.fillStyle = killer.color; g.strokeStyle = OUT; g.lineWidth = lw; for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(hx - sz * .05 + i * sz * .055, hy - sz * .06 + Math.abs(i - 1.5) * sz * .03, sz * .035, sz * .09, -.3 + i * .2, 0, TAU); g.fill(); g.stroke(); }
    }
    if (kind === 'tongue' && k > .26 && k < .56) {   // la lengua con pincho atraviesa el casco
      const r = seg(.26, .34) * (1 - seg(.5, .56)), mx = kx + sz * .3, my = base - sz * .72, tx = mx + (vx + sz * .1 - mx) * r, ty = my + (base - sz * .7 - my) * r;
      g.strokeStyle = OUT; g.lineWidth = sz * .07; g.beginPath(); g.moveTo(mx, my); g.lineTo(tx, ty); g.stroke(); g.strokeStyle = '#e88aa8'; g.lineWidth = sz * .045; g.stroke();
      g.fillStyle = '#f2f2f2'; g.strokeStyle = OUT; g.lineWidth = lw; g.beginPath(); g.moveTo(tx + sz * .12, ty); g.lineTo(tx - sz * .02, ty - sz * .05); g.lineTo(tx - sz * .02, ty + sz * .05); g.closePath(); g.fill(); g.stroke();
    }
    if (kind === 'gun' && k > .38) {   // saca la pistola y dispara
      const r = seg(.38, .5), gx = kx + sz * .3 + r * sz * .2, gy = base - sz * .45 + (1 - r) * sz * .2;
      g.save(); g.translate(gx, gy); g.rotate(.5 * r); g.fillStyle = '#8d96a5'; g.strokeStyle = OUT; g.lineWidth = lw; rrect(g, 0, -sz * .05, sz * .3, sz * .09, sz * .02); g.fill(); g.stroke(); rrect(g, 0, 0, sz * .08, sz * .16, sz * .02); g.fill(); g.stroke();
      if (k > .7 && k < .8) { g.fillStyle = '#fff3a0'; g.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, rr = i % 2 ? sz * .08 : sz * .2; g.lineTo(sz * .34 + Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); g.fill(); }
      g.restore();
    }
    g.restore();
  };


  // mesa de la cafetería: banco azul partido en cuatro tramos y tablero redondo (con el botón de emergencia en la del centro)
  W2.roundTable = (g, x, y, r, sc, lw, button) => {
    const ry = .78, ring = (rad, a0, a1) => { g.beginPath(); g.ellipse(x, y, rad, rad * ry, 0, a0, a1); };
    g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.ellipse(x, y + sc * .25, r * 1.08, r * ry * 1.08, 0, 0, TAU); g.fill();
    for (let k = 0; k < 4; k++) {   // bancos
      const a0 = k * TAU / 4 + .22, a1 = (k + 1) * TAU / 4 - .22;
      g.beginPath(); g.ellipse(x, y, r, r * ry, 0, a0, a1); g.ellipse(x, y, r * .74, r * .74 * ry, 0, a1, a0, true); g.closePath();
      g.fillStyle = '#2f5d99'; g.fill(); g.strokeStyle = OUT; g.lineWidth = lw; g.stroke();
      g.beginPath(); g.ellipse(x, y - sc * .18, r * .96, r * .96 * ry, 0, a0 + .04, a1 - .04); g.ellipse(x, y - sc * .18, r * .78, r * .78 * ry, 0, a1 - .04, a0 + .04, true); g.closePath(); g.fillStyle = '#4f86c9'; g.fill();
    }
    const rt = r * .6, hh = sc * .35;   // tablero
    g.fillStyle = '#2b4f86'; g.beginPath(); g.ellipse(x, y, rt, rt * ry, 0, 0, Math.PI); g.lineTo(x - rt, y - hh); g.ellipse(x, y - hh, rt, rt * ry, 0, Math.PI, 0, true); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = lw; g.stroke();
    g.fillStyle = '#4a82c6'; g.beginPath(); g.ellipse(x, y - hh, rt, rt * ry, 0, 0, TAU); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(160,205,255,.55)'; g.lineWidth = lw * .9; g.beginPath(); g.ellipse(x, y - hh, rt * .8, rt * .8 * ry, 0, 0, TAU); g.stroke();
    if (button) {   // botón de emergencia con su cúpula de cristal
      g.fillStyle = '#9aa4b8'; g.beginPath(); g.ellipse(x, y - hh, rt * .42, rt * .34, 0, 0, TAU); g.fill(); g.strokeStyle = OUT; g.lineWidth = lw; g.stroke();
      g.fillStyle = '#e8132e'; g.beginPath(); g.ellipse(x, y - hh - sc * .08, rt * .28, rt * .22, 0, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = 'rgba(200,235,255,.35)'; g.beginPath(); g.ellipse(x, y - hh - sc * .2, rt * .4, rt * .4, 0, Math.PI, 0); g.fill();
      g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.ellipse(x - rt * .12, y - hh - sc * .3, rt * .1, rt * .05, -.4, 0, TAU); g.fill();
    } else { g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.ellipse(x - rt * .3, y - hh - rt * .25, rt * .3, rt * .1, -.3, 0, TAU); g.fill(); }
  };

  /* ---------- mapa ---------- */
  const THEME = {   // los suelos de cada sala con los colores del plano original
    cafeteria: ['#c3bfb2', '#b4b0a3', 'checker'], reactor: ['#8c86b6', '#7f79a9', 'plates'], electrica: ['#8e8a6e', '#817d62', 'hazard'],
    enfermeria: ['#b9c5cf', '#abb7c1', 'tiles'], motores: ['#73767e', '#686b73', 'grate'], motorinf: ['#73767e', '#686b73', 'grate'],
    navegacion: ['#8f9bb0', '#828ea3', 'plates'], almacen: ['#8f969f', '#838a93', 'tiles'], seguridad: ['#5d9483', '#538877', 'plates'],
    administracion: ['#8e5d68', '#82525d', 'checker'], comunicaciones: ['#6f8d96', '#64828b', 'tiles'], escudos: ['#d4cab0', '#c7bda3', 'plates'],
    oxigeno: ['#8ea699', '#829a8d', 'tiles'], armeria: ['#d6ccb3', '#c9bfa6', 'plates']
  };
  const CORR = ['#92a3b4', '#8596a7', 'corr'];
  const WALL = { face: '#b9c2d5', face2: '#a1abc2', base: '#5a6582', cap: '#39415a', capHi: '#4b5573', void: '#0b0e1a', stripe: '#d7deeb' };
  const FACE_H = 2.4, CAP = .7;   // alto del frente de las paredes y grosor del borde, en metros
  let M = null;   // datos del mapa calculados una vez
  W2.init = shared => {
    S = shared; const MW = S.MAPW, MH = S.MAPH;
    const stars = []; for (let k = 0; k < 1400; k++) { const x = Math.random() * (MW + 40) - 20, z = Math.random() * (MH + 40) - 20; if (!S.isSolid(x, z)) continue; stars.push({ x, y: z, r: Math.random() * .25 + .06, a: Math.random() * .6 + .2 }); }
    // caminos fijos en metros (se dibujan con la cámara aplicada como transformación)
    const path = pts => { const p = new Path2D(); pts.forEach(([x, z], i) => i ? p.lineTo(x, z) : p.moveTo(x, z)); p.closePath(); return p; };
    const polys = S.POLYS.map(p => ({ room: p.room, box: p.box, path: path(p.pts), theme: (p.room && THEME[p.room]) || CORR }));
    const floorAll = new Path2D(); S.POLYS.forEach(p => floorAll.addPath(path(p.pts)));
    const solidClip = new Path2D(); solidClip.rect(-200, -200, MW + 400, MH + 400); solidClip.addPath(floorAll);
    // detalles del suelo (rejillas y manchas) en sitios fijos
    const marks = []; for (let z = 2; z < MH; z += 4) for (let x = 2; x < MW; x += 4) { const h = ((Math.round(x) * 2654435761) ^ (Math.round(z) * 40503)) >>> 0; if (h % 7 > 1) continue; const px = x + (h >> 4) % 20 / 10 - 1, pz = z + (h >> 9) % 20 / 10 - 1; if (!S.isSolid(px - 1, pz - 1) && !S.isSolid(px + 1, pz + 1)) marks.push({ x: px, z: pz, k: h % 7, a: (h % 10) / 3 }); }
    M = { MW, MH, stars, polys, floorAll, solidClip, marks, pats: null };
    W2._mini = null; try { W2._mini = W2.miniMap(1); } catch (e) {}
  };
  // baldosas de cada tipo de suelo: una imagen de 4 x 4 m (8 x 8 el ajedrezado) que se repite
  function floorPattern(g, th) {
    const k = th.join('|'); M.pats = M.pats || {}; if (M.pats[k]) return M.pats[k];
    const P = 16, n = th[2] === 'checker' ? 2 : 1, c = document.createElement('canvas'); c.width = c.height = 4 * P * n; const q = c.getContext('2d'), cs = 4 * P;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = i * cs, y = j * cs; q.fillStyle = th[2] === 'checker' && (i + j) % 2 ? th[1] : th[0]; q.fillRect(x, y, cs, cs);
      q.strokeStyle = 'rgba(40,46,64,.28)'; q.lineWidth = 1.2;
      switch (th[2]) {
        case 'tiles': q.beginPath(); for (let k2 = 0; k2 <= 4; k2++) { q.moveTo(x + k2 * cs / 4, y); q.lineTo(x + k2 * cs / 4, y + cs); q.moveTo(x, y + k2 * cs / 4); q.lineTo(x + cs, y + k2 * cs / 4); } q.stroke(); break;
        case 'plates': for (const [a, b2] of [[0, 0], [.5, 0], [0, .5], [.5, .5]]) q.strokeRect(x + a * cs + 2, y + b2 * cs + 2, cs / 2 - 4, cs / 2 - 4); break;
        case 'grate': q.beginPath(); for (let k2 = 0; k2 <= 8; k2++) { q.moveTo(x, y + k2 * cs / 8); q.lineTo(x + cs, y + k2 * cs / 8); } q.stroke(); break;
        case 'wood': q.beginPath(); for (let k2 = 0; k2 <= 6; k2++) { q.moveTo(x, y + k2 * cs / 6); q.lineTo(x + cs, y + k2 * cs / 6); } q.moveTo(x + cs * .3, y); q.lineTo(x + cs * .3, y + cs / 6); q.moveTo(x + cs * .7, y + cs / 6); q.lineTo(x + cs * .7, y + cs / 3); q.stroke(); break;
        case 'hazard': q.strokeRect(x, y, cs, cs); q.fillStyle = 'rgba(0,0,0,.06)'; q.fillRect(x + cs * .1, y + cs * .1, cs * .8, cs * .8); break;
        case 'checker': q.strokeRect(x, y, cs, cs); break;
        default: q.beginPath(); q.moveTo(x + cs / 2, y); q.lineTo(x + cs / 2, y + cs); q.moveTo(x, y + cs / 2); q.lineTo(x + cs, y + cs / 2); q.stroke(); q.strokeRect(x, y, cs, cs);
      }
    }
    const pat = g.createPattern(c, 'repeat'); if (pat.setTransform && typeof DOMMatrix !== 'undefined') pat.setTransform(new DOMMatrix().scale(1 / P)); return (M.pats[k] = pat);
  }

  // dibuja el mapa visible. v = { cx, cy (centro en metros), sc (px por metro), w, h (px) }; o = estado (puertas, tareas, sabotaje...)
  W2.drawMap = (g, v, o) => {
    const sc = v.sc, x0 = v.cx - v.w / 2 / sc, x1 = v.cx + v.w / 2 / sc, z0 = v.cy - v.h / 2 / sc, z1 = v.cy + v.h / 2 / sc, t = o.t || 0;
    const seen = (bx0, bz0, bx1, bz1, m) => bx1 > x0 - m && bx0 < x1 + m && bz1 > z0 - m && bz0 < z1 + m + FACE_H;
    g.fillStyle = WALL.void; g.fillRect(0, 0, v.w, v.h);
    g.save(); g.translate(v.w / 2 - v.cx * sc, v.h / 2 - v.cy * sc); g.scale(sc, sc);
    const lw = Math.max(1.5, sc * .09) / sc;
    // estrellas fuera de la nave
    g.fillStyle = '#fff'; for (const st of M.stars) { if (st.x < x0 || st.x > x1 || st.y < z0 || st.y > z1) continue; g.globalAlpha = st.a; g.fillRect(st.x, st.y, st.r, st.r); } g.globalAlpha = 1;
    // suelos
    for (const p of M.polys) { if (!seen(p.box[0], p.box[1], p.box[2], p.box[3], 2)) continue; g.fillStyle = floorPattern(g, p.theme); g.fill(p.path); }
    // marcas del suelo y sombra junto a las paredes
    g.save(); g.clip(M.floorAll);
    for (const m of M.marks) { if (m.x < x0 - 2 || m.x > x1 + 2 || m.z < z0 - 2 || m.z > z1 + 2) continue;
      if (m.k === 0) { g.fillStyle = 'rgba(40,46,64,.35)'; g.strokeStyle = 'rgba(30,36,56,.55)'; g.lineWidth = lw * .6; rrect(g, m.x, m.z, 1.1, .7, .1); g.fill(); g.stroke(); g.beginPath(); for (let k = 1; k < 4; k++) { g.moveTo(m.x + k * .27, m.z + .12); g.lineTo(m.x + k * .27, m.z + .58); } g.stroke(); }
      else { g.fillStyle = 'rgba(40,46,64,.12)'; g.beginPath(); g.ellipse(m.x, m.z, .8, .45, m.a, 0, TAU); g.fill(); } }
    g.lineCap = 'square';
    for (const w of S.WALLS) { if (!seen(Math.min(w.a[0], w.b[0]), Math.min(w.a[1], w.b[1]), Math.max(w.a[0], w.b[0]), Math.max(w.a[1], w.b[1]), 3)) continue;
      g.strokeStyle = w.n[1] < -.3 ? 'rgba(10,14,30,.26)' : 'rgba(10,14,30,.16)'; g.lineWidth = w.n[1] < -.3 ? 1.6 : 1; g.beginPath(); g.moveTo(w.a[0], w.a[1]); g.lineTo(w.b[0], w.b[1]); g.stroke(); }
    g.restore();
    // paredes: borde oscuro por fuera y, en las del norte, el frente de la pared con sus detalles
    g.save(); g.clip(M.solidClip, 'evenodd');
    const vis = []; for (const w of S.WALLS) if (seen(Math.min(w.a[0], w.b[0]), Math.min(w.a[1], w.b[1]), Math.max(w.a[0], w.b[0]), Math.max(w.a[1], w.b[1]), 3)) vis.push(w);
    g.lineCap = 'square'; g.strokeStyle = WALL.cap; g.lineWidth = CAP * 2;
    g.beginPath(); for (const w of vis) { g.moveTo(w.a[0], w.a[1]); g.lineTo(w.b[0], w.b[1]); } g.stroke();
    g.lineCap = 'butt'; g.strokeStyle = OUT; g.lineWidth = lw;
    g.beginPath(); for (const w of vis) { g.moveTo(w.a[0] + w.n[0] * CAP, w.a[1] + w.n[1] * CAP); g.lineTo(w.b[0] + w.n[0] * CAP, w.b[1] + w.n[1] * CAP); } g.stroke();
    for (const w of vis) {
      if (w.n[1] >= -.3) continue;
      const flat = Math.abs(w.n[1]) > .9, ext = flat ? CAP : 0, dx = Math.sign(w.b[0] - w.a[0]) || 1, ax = w.a[0] - dx * ext, bx = w.b[0] + dx * ext, ay = w.a[1], by = w.b[1];
      // borde de arriba
      g.fillStyle = WALL.cap; g.beginPath(); g.moveTo(ax, ay - FACE_H); g.lineTo(bx, by - FACE_H); g.lineTo(bx, by - FACE_H - CAP); g.lineTo(ax, ay - FACE_H - CAP); g.closePath(); g.fill();
      g.fillStyle = WALL.capHi; g.beginPath(); g.moveTo(ax, ay - FACE_H - CAP); g.lineTo(bx, by - FACE_H - CAP); g.lineTo(bx, by - FACE_H - CAP * .65); g.lineTo(ax, ay - FACE_H - CAP * .65); g.closePath(); g.fill();
      // frente
      const gr = g.createLinearGradient(0, Math.min(ay, by) - FACE_H, 0, Math.min(ay, by)); gr.addColorStop(0, WALL.face); gr.addColorStop(.8, WALL.face2); gr.addColorStop(.8, WALL.base); gr.addColorStop(1, WALL.base);
      g.fillStyle = gr; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.lineTo(bx, by - FACE_H); g.lineTo(ax, ay - FACE_H); g.closePath(); g.fill();
      g.fillStyle = WALL.stripe; g.beginPath(); g.moveTo(ax, ay - FACE_H * .82); g.lineTo(bx, by - FACE_H * .82); g.lineTo(bx, by - FACE_H * .77); g.lineTo(ax, ay - FACE_H * .77); g.closePath(); g.fill();
      if (flat) { const L = Math.abs(bx - ax), n = Math.max(1, Math.round(L / 4)), sw = (bx - ax) / n;
        for (let k = 0; k < n; k++) { const fx = Math.min(ax + k * sw, ax + (k + 1) * sw), h = ((Math.round(fx * 4) * 73856093) ^ (Math.round(ay * 4) * 19349663)) >>> 0;
          g.fillStyle = 'rgba(30,36,56,.25)'; g.fillRect(fx, ay - FACE_H * .75, lw * .5, FACE_H * .55);
          wallDetail(g, w.room, h, fx, ay - FACE_H, Math.abs(sw), FACE_H, 1, lw, t); } }
      g.strokeStyle = OUT; g.lineWidth = lw; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.moveTo(ax, ay - FACE_H); g.lineTo(bx, by - FACE_H); g.moveTo(ax, ay - FACE_H - CAP); g.lineTo(bx, by - FACE_H - CAP); g.stroke();
    }
    // la cabina de Navegación tiene ventanas al espacio
    for (const w of vis) { if (w.room !== 'navegacion' || w.n[0] < .3) continue; const k = CAP * 1.6;
      g.fillStyle = '#05081a'; g.beginPath(); g.moveTo(w.a[0], w.a[1]); g.lineTo(w.b[0], w.b[1]); g.lineTo(w.b[0] + w.n[0] * k, w.b[1] + w.n[1] * k); g.lineTo(w.a[0] + w.n[0] * k, w.a[1] + w.n[1] * k); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = lw; g.stroke();
      g.fillStyle = 'rgba(140,200,255,.6)'; for (let q = 1; q < 8; q++) { const u = q / 8; g.fillRect(w.a[0] + (w.b[0] - w.a[0]) * u + w.n[0] * k * ((q * 37) % 7) / 8, w.a[1] + (w.b[1] - w.a[1]) * u + w.n[1] * k * ((q * 53) % 7) / 8, .12, .12); } }
    g.restore();
    // borde del suelo
    g.strokeStyle = OUT; g.lineWidth = lw; g.lineCap = 'round'; g.beginPath(); for (const w of S.WALLS) { if (w.n[1] < -.3) continue; g.moveTo(w.a[0], w.a[1]); g.lineTo(w.b[0], w.b[1]); } g.stroke();
    // puertas cerradas (sabotaje)
    (o.doorsRooms || []).flatMap(id => S.DOORS[id] || []).forEach(d => {
      g.lineCap = 'butt'; g.strokeStyle = OUT; g.lineWidth = .9; g.beginPath(); g.moveTo(d[0], d[1]); g.lineTo(d[2], d[3]); g.stroke();
      g.strokeStyle = '#6f7a91'; g.lineWidth = .75; g.stroke(); g.strokeStyle = '#f2b800'; g.lineWidth = .3; g.setLineDash([.45, .45]); g.stroke(); g.setLineDash([]);
    });
    g.restore();
  };

  // detalles en el frente de las paredes, según la sala: tuberías, pantallas, cuadros eléctricos, estanterías...
  const WALLSET = {
    cafeteria: ['window', 'lamp', 'window', 'screen', 'window', 'poster'], motores: ['pipes', 'fan', 'gauge', 'pipes', 'grille', 'fan'], motorinf: ['pipes', 'fan', 'gauge', 'pipes', 'grille', 'fan'],
    reactor: ['pipes', 'beacon', 'gauge', 'warn', 'beacon', 'screen'], seguridad: ['screen', 'screen', 'lamp', 'screen'], enfermeria: ['cross', 'cabinet', 'screen', 'lamp'],
    electrica: ['ebox', 'fan', 'wires', 'ebox'], almacen: ['shelf', 'shelf', 'warn', 'fan', 'shelf'], administracion: ['screen', 'poster', 'lamp', 'cabinet'],
    comunicaciones: ['screen', 'ebox', 'screen', 'wires'], escudos: ['hex', 'hex', 'lamp', 'hex'], navegacion: ['screen', 'gauge', 'lamp', 'screen'],
    oxigeno: ['tanks', 'fan', 'tanks', 'pipes', 'fan', 'lamp'], armeria: ['window', 'warn', 'screen', 'window']
  };
  function wallDetail(g, roomId, h, fx, fy, fw, fh, sc, lw, t) {
    const rm = roomId, set = rm ? WALLSET[rm] : null;
    const kind = set ? set[h % set.length] : 'pipes', cx = fx + fw / 2, top = fy + fh * .26, hh = fh * .5;
    const P = () => { g.fill(); g.stroke(); }, R = (x0, y0, w, h2, c, r) => { g.fillStyle = c; rrect(g, x0, y0, w, h2, r == null ? sc * .08 : r); P(); };
    g.save(); g.strokeStyle = OUT; g.lineWidth = lw * .8;
    switch (kind) {
      case 'fan': {   // ventilador que gira detrás de su rejilla redonda
        const fr = Math.min(fw * .26, hh * .55), fy2 = top + hh * .45; R(cx - fr * 1.25, fy2 - fr * 1.25, fr * 2.5, fr * 2.5, '#5c667f', sc * .12);
        g.fillStyle = '#20263a'; g.beginPath(); g.arc(cx, fy2, fr, 0, TAU); P();
        g.save(); g.translate(cx, fy2); g.rotate(t * 7 + h); g.fillStyle = '#9aa4b8'; for (let k = 0; k < 4; k++) { g.rotate(TAU / 4); g.beginPath(); g.ellipse(fr * .48, 0, fr * .46, fr * .18, .35, 0, TAU); g.fill(); } g.restore();
        g.fillStyle = '#c8d0de'; g.beginPath(); g.arc(cx, fy2, fr * .18, 0, TAU); P();
        g.strokeStyle = 'rgba(200,210,225,.55)'; g.lineWidth = lw * .5; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(cx - fr * .95, fy2 + k * fr * .38); g.lineTo(cx + fr * .95, fy2 + k * fr * .38); g.stroke(); }
        break; }
      case 'beacon': {   // luz de aviso del reactor que gira (roja y amarilla)
        const by = top + hh * .3, br = Math.min(fw * .14, hh * .32); R(cx - br * 1.3, by + br * .6, br * 2.6, br * .6, '#4a5370', sc * .06);
        const on = .5 + .5 * Math.sin(t * 6 + h); g.fillStyle = `rgb(${200 + on * 55 | 0},${40 + on * 50 | 0},30)`; g.beginPath(); g.arc(cx, by + br * .6, br, Math.PI, 0); g.closePath(); P();
        const gr = g.createRadialGradient(cx, by + br * .3, 0, cx, by + br * .3, br * 4); gr.addColorStop(0, `rgba(255,70,40,${.45 * on})`); gr.addColorStop(1, 'rgba(255,70,40,0)'); g.fillStyle = gr; g.beginPath(); g.arc(cx, by + br * .3, br * 4, 0, TAU); g.fill();
        break; }
      case 'pipes': [.36, .56].forEach((k, n) => { g.fillStyle = n ? '#7d879c' : '#9aa4b8'; g.fillRect(fx, fy + fh * k, fw, fh * .09); g.beginPath(); g.moveTo(fx, fy + fh * k); g.lineTo(fx + fw, fy + fh * k); g.moveTo(fx, fy + fh * (k + .09)); g.lineTo(fx + fw, fy + fh * (k + .09)); g.stroke(); });
        R(fx + fw * .3, fy + fh * .32, sc * .25, fh * .36, '#5c667f', sc * .05); if (!rm && h % 3 === 0) { R(cx + fw * .1, top - fh * .05, fw * .22, fh * .1, '#fff6c8', sc * .05); } break;
      case 'window': R(fx + fw * .12, top - fh * .04, fw * .76, hh * 1.05, '#0a1430', sc * .2); g.fillStyle = 'rgba(200,225,255,.85)'; for (let k = 0; k < 6; k++) { const sx = fx + fw * (.18 + ((h >> k) % 64) / 64 * .64), sy = top + hh * (((h >> (k + 3)) % 32) / 32) * .9; g.fillRect(sx, sy, sc * .1, sc * .1); }
        g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.moveTo(fx + fw * .2, top); g.lineTo(fx + fw * .4, top); g.lineTo(fx + fw * .25, top + hh); g.lineTo(fx + fw * .15, top + hh); g.fill(); break;
      case 'screen': { R(cx - fw * .22, top, fw * .44, hh * .8, '#1d2436', sc * .12); const c = ['#3ad0ff', '#4ef0b8', '#ffd23f'][h % 3]; g.strokeStyle = c; g.lineWidth = lw * .7; g.beginPath(); for (let k = 0; k <= 8; k++) { const xx = cx - fw * .17 + k * fw * .34 / 8, yy = top + hh * .4 + Math.sin(k * 1.3 + t * 2 + h) * hh * .18; k ? g.lineTo(xx, yy) : g.moveTo(xx, yy); } g.stroke(); break; }
      case 'lamp': { const gr = g.createRadialGradient(cx, top + hh * .2, 0, cx, top + hh * .2, fw * .45); gr.addColorStop(0, 'rgba(255,248,200,.55)'); gr.addColorStop(1, 'rgba(255,248,200,0)'); g.fillStyle = gr; g.fillRect(fx, fy, fw, fh * .8); R(cx - fw * .14, top, fw * .28, hh * .3, '#fff6c8', sc * .1); break; }
      case 'poster': R(cx - fw * .15, top - fh * .03, fw * .3, hh * .95, ['#c51111', '#132ed1', '#117f2d'][h % 3], sc * .05); g.fillStyle = '#fff'; g.beginPath(); g.ellipse(cx, top + hh * .4, fw * .07, hh * .26, 0, 0, TAU); g.fill(); break;
      case 'gauge': R(cx - fw * .17, top + hh * .05, fw * .34, hh * .7, '#5c667f', sc * .1); g.fillStyle = '#e9eef5'; g.beginPath(); g.arc(cx, top + hh * .4, Math.min(fw * .12, hh * .3), 0, TAU); P(); g.strokeStyle = '#c4162f'; g.lineWidth = lw; g.beginPath(); g.moveTo(cx, top + hh * .4); { const a = -2.4 + Math.sin(t + h) * .6 + (h % 4) * .5; g.lineTo(cx + Math.cos(a) * fw * .1, top + hh * .4 + Math.sin(a) * fw * .1); } g.stroke(); break;
      case 'grille': R(cx - fw * .22, top + hh * .1, fw * .44, hh * .6, '#3e465c', sc * .06); g.strokeStyle = '#1b1f2b'; for (let k = 1; k < 5; k++) { g.beginPath(); g.moveTo(cx - fw * .18, top + hh * (.1 + k * .12)); g.lineTo(cx + fw * .18, top + hh * (.1 + k * .12)); g.stroke(); } break;
      case 'warn': { g.save(); rrect(g, fx, top + hh * .55, fw, hh * .22, 0); g.clip(); g.fillStyle = '#f2b800'; g.fillRect(fx, top + hh * .55, fw, hh * .22); g.fillStyle = '#1b1f2b'; for (let k = -fw; k < fw * 2; k += fw / 5) { g.beginPath(); g.moveTo(fx + k, top + hh * .55); g.lineTo(fx + k + fw / 10, top + hh * .55); g.lineTo(fx + k, top + hh * .77); g.lineTo(fx + k - fw / 10, top + hh * .77); g.fill(); } g.restore(); break; }
      case 'cross': R(cx - fw * .18, top, fw * .36, hh * .8, '#e9eef5', sc * .1); g.fillStyle = '#e8132e'; g.fillRect(cx - fw * .04, top + hh * .12, fw * .08, hh * .56); g.fillRect(cx - fw * .12, top + hh * .32, fw * .24, hh * .16); break;
      case 'cabinet': R(cx - fw * .3, top - fh * .04, fw * .6, hh * 1.25, '#c8d0de', sc * .08); g.beginPath(); g.moveTo(cx, top - fh * .04); g.lineTo(cx, top + hh * 1.2); g.stroke(); R(cx - fw * .06, top + hh * .5, fw * .04, hh * .2, '#5c667f', 0); R(cx + fw * .02, top + hh * .5, fw * .04, hh * .2, '#5c667f', 0); break;
      case 'ebox': R(cx - fw * .2, top - fh * .02, fw * .4, hh * .95, '#8a94aa', sc * .08); g.fillStyle = '#ffd23f'; g.beginPath(); g.moveTo(cx, top + hh * .15); g.lineTo(cx + fw * .09, top + hh * .5); g.lineTo(cx - fw * .09, top + hh * .5); g.closePath(); P();
        g.strokeStyle = ['#ff3b3b', '#3b7bff', '#ffd93b'][h % 3]; g.lineWidth = lw; g.beginPath(); g.moveTo(cx + fw * .1, top + hh * .92); g.quadraticCurveTo(cx + fw * .2, top + hh * 1.3, cx + fw * .35, top + hh * 1.12); g.stroke(); break;
      case 'wires': ['#ff3b3b', '#3b7bff', '#ffd93b', '#ff4fd8'].forEach((c, k) => { g.strokeStyle = c; g.lineWidth = lw * .9; g.beginPath(); g.moveTo(fx, top + hh * (.2 + k * .1)); g.quadraticCurveTo(cx, top + hh * (.6 + k * .12), fx + fw, top + hh * (.2 + k * .1)); g.stroke(); }); break;
      case 'shelf': [.15, .62].forEach(k => { R(fx + fw * .08, top + hh * k, fw * .84, hh * .08, '#6b4a2a', 0); }); [[.15, .15], [.4, .15], [.62, .62], [.2, .62]].forEach(([a, k], n) => R(fx + fw * a, top + hh * k - hh * .3, fw * .18, hh * .3, ['#a57a46', '#b5884f', '#3f7ab0', '#946b3c'][n], sc * .04)); break;
      case 'hex': for (let k = 0; k < 3; k++) { const hx = cx + (k - 1) * fw * .25, hy = top + hh * .4 + (k % 2) * hh * .2, rr = Math.min(fw * .11, hh * .3); g.fillStyle = Math.sin(t * 2 + k + h) > 0 ? '#5aa9ff' : '#3d4560'; g.beginPath(); for (let q = 0; q < 6; q++) { const a = q / 6 * TAU; g.lineTo(hx + Math.cos(a) * rr, hy + Math.sin(a) * rr); } g.closePath(); P(); } break;
      case 'tanks': [-.18, .18].forEach(k => { R(cx + k * fw - fw * .1, top - fh * .04, fw * .2, hh * 1.15, '#3dbb68', fw * .1); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(cx + k * fw - fw * .06, top + hh * .05, fw * .04, hh * .9); }); break;
    }
    g.restore();
  }
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
    { const b = S.BUTTON; if (vis(b.x, b.z, 4)) W2.roundTable(g, X(b.x), Y(b.z), S.TABLE_R * sc, sc, lw, true); }
    // decoración (el juego la puede ordenar con los personajes para que tape a quien pasa por detrás)
    if (!o.noDecor) S.DECOR.forEach(d => { if (vis(d.x, d.z, (d.len || d.w || d.r * 2) + 4)) W2.drawDecor(g, v, d, t); });
    // aparatos de las tareas (en la pared si la hay detrás), con el contorno amarillo del original en las que te tocan
    S.STATIONS.forEach(st => {
      if (!vis(st.x, st.z, 4) || st.type === 'ventclean') { if (st.type === 'ventclean' && o.hl && o.hl.has(st.id) && vis(st.x, st.z, 3)) { const x = X(st.x), y = Y(st.z); outline(g, { x: x - sc * 1.1, y: y - sc * .8, w: sc * 2.2, h: sc * 1.6 }, o.use === st.id ? '#ffe14d' : 'rgba(255,225,77,.6)', lw * (o.use === st.id ? 2.4 : 1.4)); } return; }
      const bx = device(g, st.type, st.x, st.z, X, Y, sc, t, lw, st), hl = o.hl && o.hl.has(st.id), near = o.use === st.id;
      if (hl) outline(g, bx, near ? '#ffe14d' : 'rgba(255,225,77,.6)', lw * (near ? 2.6 : 1.5), near ? null : [sc * .3, sc * .22]);
    });
    // paneles de sabotaje (parpadean en rojo cuando hay que arreglarlos)
    S.PANELS.forEach(pn => {
      if (!vis(pn.x, pn.z, 4)) return; pn.need = o.sabPanels && o.sabPanels.has(pn.id);
      const bx = device(g, pn.type, pn.x, pn.z, X, Y, sc, t, lw, pn);
      if (pn.need) outline(g, bx, Math.sin(t * 8) > 0 ? '#ff2e4d' : 'rgba(255,46,77,.45)', lw * 2.2);
    });
    // terminales de información
    S.INFO.forEach(it => {
      if (!vis(it.x, it.z, 4)) return; const near = o.use === 'info:' + it.id;
      const bx = it.id === 'admin' ? (() => { const x = X(it.x), y = Y(it.z); g.save(); g.strokeStyle = OUT; g.lineWidth = lw; g.fillStyle = '#4a5370'; rrect(g, x - sc * .7, y - sc * .9, sc * 1.4, sc * 1, sc * .2); g.fill(); g.stroke(); g.fillStyle = '#3ad0ff'; rrect(g, x - sc * .5, y - sc * .75, sc, sc * .45, sc * .08); g.fill(); g.stroke(); g.restore(); return { x: x - sc * .85, y: y - sc * 1.05, w: sc * 1.7, h: sc * 1.3 }; })()
        : device(g, it.id === 'cams' ? 'camsdesk' : it.id, it.x, it.z, X, Y, sc, t, lw, it);
      if (near) outline(g, bx, '#ffe14d', lw * 2.4);
    });
    // cámaras de seguridad en la pared (luz roja cuando alguien mira)
    S.CAMERAS.forEach(c => { const x = X(c.pos[0]), y = Y(c.pos[2]); if (x < -40 || y < -40 || x > v.w + 40 || y > v.h + 40) return; g.fillStyle = '#3b4258'; rrect(g, x - sc * .35, y - sc * .9, sc * .7, sc * .45, sc * .1); P(); g.fillStyle = o.camOn && Math.sin(t * 8) > 0 ? '#ff1d3a' : '#4a1018'; g.beginPath(); g.arc(x + sc * .2, y - sc * .8, sc * .1, 0, TAU); g.fill(); });
  };

  // base de un mueble para ordenarlo con los personajes (su borde sur)
  W2.decorBase = d => d.z + (d.w ? d.h / 2 : d.len ? d.r * .55 : d.r * .55);
  // muebles de The Skeld en vista cenital "de frente": se ve la tapa y la cara sur, con el trazo negro del original
  W2.drawDecor = (g, v, d, t) => {
    const sc = v.sc, X = x => (x - v.cx) * sc + v.w / 2, Y = y => (y - v.cy) * sc + v.h / 2, x = X(d.x), y = Y(d.z), lw = Math.max(1.2, sc * .08);
    g.save(); g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = OUT; g.lineWidth = lw;
    const P = () => { g.fill(); g.stroke(); };
    const R = (x0, y0, w, h, c, r) => { g.fillStyle = c; rrect(g, x0, y0, w, h, r == null ? sc * .12 : r); P(); };
    const E = (cx, cy, rx, ry, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); P(); };
    const shadow = (cx, cy, rx, ry) => { g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.fill(); };
    // caja con tapa y frente: footprint centrado en (cx, cy) de w x h px y alto hh px
    const block = (cx, cy, w, h, hh, top, front, r) => { R(cx - w / 2, cy + h / 2 - hh, w, hh, front, r); R(cx - w / 2, cy - h / 2 - hh, w, h, top, r); };
    const crate = (cx, cy, s2, hh, c) => { block(cx, cy, s2, s2 * .8, hh, shade(c, .12), shade(c, -.18), sc * .1);
      g.strokeStyle = shade(c, -.45); g.lineWidth = lw * .8; g.beginPath(); g.moveTo(cx - s2 / 2 + lw, cy - s2 * .4 - hh + lw); g.lineTo(cx + s2 / 2 - lw, cy + s2 * .4 - hh - lw); g.moveTo(cx + s2 / 2 - lw, cy - s2 * .4 - hh + lw); g.lineTo(cx - s2 / 2 + lw, cy + s2 * .4 - hh - lw); g.stroke();
      g.beginPath(); g.moveTo(cx - s2 / 2, cy + s2 * .4 - hh * .5); g.lineTo(cx + s2 / 2, cy + s2 * .4 - hh * .5); g.stroke(); g.strokeStyle = OUT; g.lineWidth = lw; };
    const W = (d.w || 0) * sc, H = (d.h || 0) * sc, r = (d.r || 0) * sc;
    switch (d.kind) {
      case 'table': {   // mesa redonda azul de la cafetería con su banco curvo alrededor, como en el original
        W2.roundTable(g, x, y, r, sc, lw, false); break; }
      case 'engine': {   // motor gigante con la tobera hacia fuera de la nave
        const L = d.len * sc, Rr = r, top = y - Rr * 1.7, hgt = Rr * 2;
        shadow(x, y + Rr * .35, L * .55, Rr * .45);
        // soportes
        R(x - L * .32, y - Rr * .2, sc * .9, Rr * .5, '#3e465c'); R(x + L * .22, y - Rr * .2, sc * .9, Rr * .5, '#3e465c');
        // tobera y llama
        const fl = .75 + Math.sin(t * 23) * .12 + Math.sin(t * 37) * .08, nx = x - L / 2;
        g.fillStyle = `rgba(255,150,40,${.55 * fl})`; g.beginPath(); g.ellipse(nx - Rr * 1.05 * fl, top + hgt / 2, Rr * 1.0 * fl, Rr * .55, 0, 0, TAU); g.fill();
        g.fillStyle = `rgba(255,236,140,${.85 * fl})`; g.beginPath(); g.ellipse(nx - Rr * .7 * fl, top + hgt / 2, Rr * .6 * fl, Rr * .32, 0, 0, TAU); g.fill();
        g.fillStyle = '#4a5268'; g.beginPath(); g.moveTo(nx + sc * .2, top + hgt * .12); g.lineTo(nx - Rr * .55, top - hgt * .02); g.lineTo(nx - Rr * .55, top + hgt * 1.02); g.lineTo(nx + sc * .2, top + hgt * .88); g.closePath(); P();
        // cuerpo cilíndrico
        const gr = g.createLinearGradient(0, top, 0, top + hgt); gr.addColorStop(0, '#dfe5f0'); gr.addColorStop(.35, '#aeb8cb'); gr.addColorStop(.8, '#7b859c'); gr.addColorStop(1, '#5c667e');
        g.fillStyle = gr; rrect(g, nx, top, L, hgt, Rr * .45); P();
        g.fillStyle = 'rgba(40,46,66,.35)'; for (let k = 1; k < 6; k++) if (k !== 3) g.fillRect(nx + k * L / 6 - sc * .18, top + lw, sc * .36, hgt - lw * 2);
        // ventana roja del núcleo
        const gl = .65 + Math.sin(t * 6) * .25; R(x - sc * 1.2, top + hgt * .28, sc * 2.4, hgt * .44, `rgb(${200 + gl * 55 | 0},${60 + gl * 60 | 0},40)`, sc * .2);
        g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(x - sc * 1, top + hgt * .32, sc * 1.2, hgt * .07);
        // tapa delantera
        E(nx + L, top + hgt / 2, Rr * .4, hgt * .5, '#8a94aa'); E(nx + L, top + hgt / 2, Rr * .2, hgt * .26, '#5c667e');
        // tuberías que suben a la pared
        { const rm = S.ROOMS.find(q => q.id === d.room), wy = rm ? Y(Math.min(...rm.poly.map(q => q[1]))) : top - sc * 3; g.lineWidth = lw; for (const k of [-.25, .2]) { R(x + L * k - sc * .3, wy - sc * .2, sc * .6, top - wy + sc * .4, '#8c96ab', sc * .2); g.fillStyle = '#5c667f'; g.fillRect(x + L * k - sc * .4, wy + (top - wy) * .5, sc * .8, sc * .25); } }
        break; }
      case 'core': {   // reactor: núcleo azul que gira, con tuberías hasta la pared
        const wx = X(d.x - 3.4);
        g.lineWidth = lw; [-.6, 0, .6].forEach((k, i) => { R(wx, y + k * r - sc * (.35 + i * .05), x - wx, sc * .7, i === 1 ? '#7d879c' : '#6b7590', sc * .3); });
        shadow(x, y + sc * .3, r * 1.35, r * .95);
        E(x, y, r * 1.3, r * .95, '#3d4560'); g.fillStyle = '#ffd23f'; for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; g.beginPath(); g.arc(x + Math.cos(a) * r * 1.12, y + Math.sin(a) * r * .82, sc * .12, 0, TAU); g.fill(); }
        const ht = r * .9; g.fillStyle = '#5a6585'; g.beginPath(); g.ellipse(x, y - sc * .2, r * .82, r * .58, 0, 0, Math.PI); g.lineTo(x - r * .82, y - ht); g.ellipse(x, y - ht, r * .82, r * .58, 0, Math.PI, 0, true); g.closePath(); P();
        g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x - r * .6, y - ht, r * .25, ht);
        E(x, y - ht, r * .82, r * .58, '#2a3150');
        const gl = .75 + Math.sin(t * 3) * .2, rg = g.createRadialGradient(x, y - ht, 0, x, y - ht, r * .7); rg.addColorStop(0, `rgba(200,250,255,${gl})`); rg.addColorStop(.6, `rgba(70,170,255,${gl * .8})`); rg.addColorStop(1, 'rgba(40,90,200,.3)');
        g.fillStyle = rg; g.beginPath(); g.ellipse(x, y - ht, r * .66, r * .46, 0, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(220,250,255,.8)'; g.lineWidth = lw * 1.2; for (let k = 0; k < 3; k++) { const a = t * 1.6 + k / 3 * TAU; g.beginPath(); g.moveTo(x, y - ht); g.lineTo(x + Math.cos(a) * r * .6, y - ht + Math.sin(a) * r * .42); g.stroke(); }
        break; }
      case 'bed': {
        const hh = sc * .55; shadow(x, y + H * .4, W * .55, H * .35);
        R(x - W / 2, y - H / 2 - hh + H, W, hh, '#8a94aa'); R(x - W / 2, y - H / 2 - hh, W, H, '#eef2f8');
        R(x - W / 2 + sc * .15, y - H / 2 - hh + sc * .15, W * .26, H - sc * .3, '#bfe6f2', sc * .2);
        R(x - W / 2 + W * .38, y - H / 2 - hh, W * .62, H, '#3fb6c4'); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x - W / 2 + W * .38, y - H / 2 - hh + lw, W * .62 - lw, H * .2);
        break; }
      case 'desk': {   // mesa con monitores (seguridad, comunicaciones)
        const hh = sc * .8; shadow(x, y + H * .3, W * .55, H * .4);
        block(x, y, W, H, hh, '#7d879c', '#4a5370');
        const n = Math.max(2, Math.round(d.w / 1.7)), mw = W / n * .78;
        for (let k = 0; k < n; k++) { const mx = x - W / 2 + (k + .5) * W / n; R(mx - sc * .08, y - H / 2 - hh - sc * .5, sc * .16, sc * .5, '#2b3245', sc * .04);
          R(mx - mw / 2, y - H / 2 - hh - sc * 1.55, mw, sc * 1.1, '#1d2436', sc * .1); g.fillStyle = d.room === 'seguridad' ? '#6f9a83' : '#3ad0ff'; g.globalAlpha = .6 + Math.sin(t * 2 + k) * .15; g.fillRect(mx - mw / 2 + sc * .12, y - H / 2 - hh - sc * 1.43, mw - sc * .24, sc * .86); g.globalAlpha = 1;
          g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(mx - mw / 2 + sc * .2, y - H / 2 - hh - sc * 1.3, mw * .4, sc * .08); }
        R(x - W * .3, y - H / 2 - hh + H * .35, W * .6, H * .3, '#2b3245', sc * .06);
        break; }
      case 'rack': {   // armario de servidores con luces
        const hh = sc * 2.3; shadow(x, y + H * .4, W * .6, H * .4);
        block(x, y, W, H, hh, '#5b6580', '#2b3245');
        for (let rI = 0; rI < 5; rI++) for (let c = 0; c < 4; c++) { const on = Math.sin(t * (3 + c) + rI * 7 + c) > .2; g.fillStyle = on ? ['#4ef0b8', '#ffd23f', '#3ad0ff', '#ff4f6b'][(rI + c) % 4] : '#1b2030'; g.fillRect(x - W / 2 + sc * .3 + c * (W - sc * .6) / 4, y + H / 2 - hh + sc * .35 + rI * hh * .17, sc * .22, sc * .12); }
        break; }
      case 'gen': {   // generador de Eléctrica
        const hh = sc * 1.5; shadow(x, y + H * .4, W * .6, H * .4);
        block(x, y, W, H, hh, '#9aa4b8', '#6b7590');
        g.save(); rrect(g, x - W / 2, y + H / 2 - hh * .45, W, hh * .22, 0); g.clip(); g.fillStyle = '#f2b800'; g.fillRect(x - W / 2, y + H / 2 - hh * .45, W, hh * .22); g.fillStyle = '#1b1f2b'; for (let k = -W; k < W * 2; k += sc * .7) { g.beginPath(); g.moveTo(x - W / 2 + k, y + H / 2 - hh * .45); g.lineTo(x - W / 2 + k + sc * .35, y + H / 2 - hh * .45); g.lineTo(x - W / 2 + k - sc * .1, y + H / 2 - hh * .23); g.lineTo(x - W / 2 + k - sc * .45, y + H / 2 - hh * .23); g.fill(); } g.restore();
        g.fillStyle = '#ffd23f'; g.beginPath(); const bx = x, by = y + H / 2 - hh * .75; g.moveTo(bx + sc * .1, by - sc * .35); g.lineTo(bx - sc * .2, by + sc * .05); g.lineTo(bx, by + sc * .05); g.lineTo(bx - sc * .1, by + sc * .35); g.lineTo(bx + sc * .2, by - sc * .05); g.lineTo(bx, by - sc * .05); g.closePath(); P();
        g.strokeStyle = '#1b1f2b'; g.lineWidth = lw * 1.4; g.beginPath(); g.moveTo(x + W / 2, y - hh * .3); g.bezierCurveTo(x + W / 2 + sc * 1.2, y, x + W / 2 + sc * .4, y + sc * 1.5, x + W / 2 + sc * 1.6, y + sc * 1.2); g.stroke();
        break; }
      case 'cratepile': {   // montaña de cajas del almacén
        const s2 = sc * 1.9, hh = sc * 1.6, ox = x - W / 2, oy = y - H / 2, cs2 = ['#a57a46', '#946b3c', '#b5884f', '#8c6a3f'];
        shadow(x, y + H * .25, W * .58, H * .45);
        [[.18, .25, 0], [.5, .22, 1], [.82, .28, 2], [.3, .72, 3], [.7, .75, 0]].forEach(([a, b2, c]) => crate(ox + a * W, oy + b2 * H + s2 * .4, s2, hh, cs2[c]));
        crate(ox + .5 * W, oy + .5 * H + s2 * .4 - hh, s2 * .9, hh * .9, cs2[2]);
        break; }
      case 'crates': { const s2 = r * .95, hh = sc * 1.2; shadow(x, y + r * .3, r * 1.2, r * .6); crate(x - r * .5, y - r * .1, s2, hh, '#a57a46'); crate(x + r * .55, y + r * .05, s2, hh, '#946b3c'); crate(x, y + r * .45, s2, hh, '#b5884f'); break; }
      case 'barrel': {
        const hh = sc * 1.3; shadow(x, y + r * .3, r * 1.1, r * .55);
        g.fillStyle = '#3f7ab0'; g.beginPath(); g.ellipse(x, y, r, r * .55, 0, 0, Math.PI); g.lineTo(x - r, y - hh); g.ellipse(x, y - hh, r, r * .55, 0, Math.PI, 0, true); g.closePath(); P();
        g.strokeStyle = '#2b5579'; [.3, .7].forEach(k => { g.beginPath(); g.ellipse(x, y - hh * k, r, r * .55, 0, 0, Math.PI); g.stroke(); }); g.strokeStyle = OUT;
        E(x, y - hh, r, r * .55, '#5b98cc'); E(x + r * .3, y - hh, r * .16, r * .1, '#2b5579');
        break; }
      case 'cans': { shadow(x, y + r * .2, r * 1.3, r * .5); [[-.6, -.2], [.55, -.25], [0, .3]].forEach(([a, b2]) => { const cx = x + a * r, cy = y + b2 * r; block(cx, cy, r * .75, r * .45, sc * .85, '#e23b3b', '#b22222', sc * .1); R(cx - r * .12, cy - r * .22 - sc * .85 - sc * .2, r * .24, sc * .22, '#3b4258', sc * .05); }); break; }
      case 'sofa': {
        const hh = sc * .7; shadow(x, y + H * .3, W * .55, H * .45);
        R(x - W / 2, y - H / 2 - hh * 1.9, W, hh * 1.3, '#5b3f8c'); block(x, y, W, H, hh, '#7a58b0', '#4c3478');
        R(x - W / 2 - sc * .2, y - H / 2 - hh * 1.4, sc * .55, H + hh * 1.1, '#6a4a9e'); R(x + W / 2 - sc * .35, y - H / 2 - hh * 1.4, sc * .55, H + hh * 1.1, '#6a4a9e');
        break; }
      case 'plant': {
        const big = d.big, ph = big ? sc * 2.2 : sc * 1.1, pr = big ? r * .55 : r * .8;
        shadow(x, y + sc * .15, pr * 1.3, pr * .55);
        g.fillStyle = '#7a5a3a'; g.beginPath(); g.moveTo(x - pr, y - pr * .9); g.lineTo(x + pr, y - pr * .9); g.lineTo(x + pr * .75, y); g.lineTo(x - pr * .75, y); g.closePath(); P();
        if (big) { R(x - sc * .15, y - ph - pr * .6, sc * .3, ph, '#6b4a2a', sc * .1); }
        const lv = big ? [[0, -1.25, 1], [-.65, -.95, .75], [.65, -.95, .75], [-.35, -1.6, .7], [.4, -1.6, .7]] : [[0, -1.1, .7], [-.45, -.85, .5], [.45, -.85, .5]];
        const sway = Math.sin(t * 1.3) * sc * .05;
        lv.forEach(([a, b2, k], i) => E(x + a * r + sway * b2, y - pr * .9 + b2 * (big ? r * 1.4 : r), r * k * .7, r * k * .55, i % 2 ? '#2f9e57' : '#3dbb68'));
        g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.ellipse(x - r * .2, y - pr * .9 - (big ? r * 2 : r * 1.25), r * .25, r * .1, -.4, 0, TAU); g.fill();
        break; }
      case 'radio': {   // torre de comunicaciones con antena parabólica
        const hh = sc * 1.4; shadow(x, y + H * .4, W * .7, H * .45);
        block(x, y, W, H, hh, '#7d879c', '#4a5370');
        for (let k = 0; k < 3; k++) { g.fillStyle = Math.sin(t * 4 + k * 2) > 0 ? '#4ef0b8' : '#1b2030'; g.fillRect(x - W / 2 + sc * .3 + k * sc * .45, y + H / 2 - hh * .6, sc * .25, sc * .15); }
        R(x - sc * .1, y - H / 2 - hh - sc * 1.8, sc * .2, sc * 1.8, '#5c667f', sc * .05);
        g.save(); g.translate(x, y - H / 2 - hh - sc * 1.9); g.rotate(Math.sin(t * .7) * .4); g.fillStyle = '#d5dcea'; g.beginPath(); g.ellipse(0, 0, sc * .9, sc * .45, -.5, 0, TAU); P(); g.fillStyle = '#9aa4b8'; g.beginPath(); g.arc(0, 0, sc * .14, 0, TAU); P(); g.restore();
        break; }
      case 'shieldgen': {   // generador de escudos: hexágono que brilla
        shadow(x, y + sc * .2, r * 1.2, r * .75);
        const hex = (rr, yy) => { g.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + Math.PI / 6; g.lineTo(x + Math.cos(a) * rr, yy + Math.sin(a) * rr * .68); } g.closePath(); };
        g.fillStyle = '#3d4560'; hex(r * 1.1, y); P();
        const gl = .5 + Math.sin(t * 2.4) * .3; g.fillStyle = `rgba(90,169,255,${gl})`; hex(r * .85, y - sc * .1); g.fill();
        R(x - r * .35, y - sc * 2.2, r * .7, sc * 2.2, '#6b7590', sc * .2); E(x, y - sc * 2.2, r * .35, r * .22, '#9aa4b8');
        g.fillStyle = `rgba(160,220,255,${.4 + gl * .5})`; g.beginPath(); g.ellipse(x, y - sc * 2.2, r * .22, r * .14, 0, 0, TAU); g.fill();
        break; }
      case 'turret': {   // cañón de la armería apuntando al espacio
        shadow(x, y + sc * .2, r * 1.15, r * .75);
        E(x, y, r * 1.05, r * .72, '#3d4560'); const a0 = -Math.PI / 2 + Math.sin(t * .8) * .5;
        g.save(); g.translate(x, y - sc * .9); g.rotate(a0 + Math.PI / 2);
        R(-sc * .32, -r * 1.9, sc * .64, r * 1.6, '#7d879c', sc * .2); R(-sc * .45, -r * 2.05, sc * .9, sc * .45, '#5c667f', sc * .12);
        g.restore();
        E(x, y - sc * .9, r * .7, r * .5, '#9aa4b8'); E(x, y - sc * .9, r * .32, r * .22, '#c4162f');
        break; }
      case 'console': {   // mesa de mandos de Navegación junto a la ventana
        const hh = sc * .9; shadow(x, y + H * .3, W * .7, H * .45);
        block(x, y, W, H, hh, '#5c667f', '#3b4258');
        for (let k = 0; k < 6; k++) { g.fillStyle = Math.sin(t * 3 + k * 1.7) > -.2 ? ['#ffd23f', '#4ef0b8', '#ff4f6b', '#3ad0ff'][k % 4] : '#1b2030'; g.fillRect(x - W * .3, y - H / 2 - hh + sc * .3 + k * (H - sc * .6) / 6, W * .22, sc * .2); }
        R(x + W * .02, y - H / 2 - hh + sc * .25, W * .38, H * .4, '#1d2436', sc * .08); g.fillStyle = '#3ad0ff'; g.globalAlpha = .55; g.fillRect(x + W * .07, y - H / 2 - hh + sc * .35, W * .28, H * .4 - sc * .2); g.globalAlpha = 1;
        break; }
      case 'tank': {   // depósito alto (reactor) o botella de oxígeno
        const hh = sc * (d.o2 ? 2 : 2.6), c = d.o2 ? '#3dbb68' : '#9aa4b8'; shadow(x, y + r * .3, r * 1.15, r * .55);
        g.fillStyle = c; g.beginPath(); g.ellipse(x, y, r, r * .55, 0, 0, Math.PI); g.lineTo(x - r, y - hh); g.ellipse(x, y - hh, r, r * .55, 0, Math.PI, 0, true); g.closePath(); P();
        g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(x - r * .65, y - hh, r * .25, hh); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x + r * .45, y - hh, r * .4, hh);
        g.fillStyle = d.o2 ? '#e9eef5' : '#f2b800'; g.fillRect(x - r, y - hh * .55, r * 2, sc * .3); g.strokeRect(x - r, y - hh * .55, r * 2, sc * .3);
        E(x, y - hh, r, r * .55, shade(c, .2)); E(x, y - hh, r * .3, r * .18, '#5c667f');
        break; }
      case 'admintable': {   // mesa del mapa de Administración con el holograma de la nave
        const hh = sc * .9; shadow(x, y + H * .35, W * .58, H * .5);
        block(x, y, W, H, hh, '#5c667f', '#3e465c');
        g.fillStyle = '#123a5a'; rrect(g, x - W * .44, y - H / 2 - hh + H * .1, W * .88, H * .8, sc * .12); g.fill(); g.stroke();
        if (W2._mini) { g.globalAlpha = .6 + Math.sin(t * 3) * .1; g.drawImage(W2._mini, x - W * .42, y - H / 2 - hh + H * .14, W * .84, H * .72); g.globalAlpha = 1; }
        const hg = g.createLinearGradient(0, y - H / 2 - hh - sc * 1.6, 0, y - H / 2 - hh + H * .5); hg.addColorStop(0, 'rgba(90,200,255,0)'); hg.addColorStop(1, 'rgba(90,200,255,.22)'); g.fillStyle = hg;
        g.beginPath(); g.moveTo(x - W * .44, y - H / 2 - hh + H * .5); g.lineTo(x + W * .44, y - H / 2 - hh + H * .5); g.lineTo(x + W * .32, y - H / 2 - hh - sc * 1.6); g.lineTo(x - W * .32, y - H / 2 - hh - sc * 1.6); g.fill();
        break; }
      case 'chair': {
        shadow(x, y + sc * .1, r * .9, r * .5);
        R(x - sc * .1, y - sc * .6, sc * .2, sc * .6, '#2b3245', sc * .05);
        if (d.rot) R(x - r * 1.05, y - sc * .6 - r * 1.05, r * .5, r * 1.25, '#2b3654', sc * .2); else R(x - r * .75, y - sc * .6 - r * 1.15, r * 1.5, r * .55, '#2b3654', sc * .2);
        g.fillStyle = '#3b4a73'; rrect(g, x - r * .7, y - sc * .6 - r * .55, r * 1.4, r * 1.0, r * .35); P(); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x - r * .5, y - sc * .6 - r * .45, r * .9, r * .15);
        break; }
    }
    g.restore();
  };
  /* ---------- aparatos de las tareas ----------
     Como en el original, casi todas las tareas son aparatos colgados en la pared (cuadros de cables, lectores, terminales...).
     Si hay una pared justo detrás de la consola, el aparato se dibuja en esa pared; si no, va sobre un pedestal en el suelo. */
  function wallAnchor(x, z) {   // altura (z) de la pared norte que queda justo detrás del punto, o null
    let best = null;
    for (const w of S.WALLS) {
      if (w.n[1] > -.5) continue; const x0 = Math.min(w.a[0], w.b[0]), x1 = Math.max(w.a[0], w.b[0]); if (x < x0 + .7 || x > x1 - .7) continue;
      const k = (x - w.a[0]) / ((w.b[0] - w.a[0]) || 1), wz = w.a[1] + (w.b[1] - w.a[1]) * k, d = z - wz;
      if (d > .2 && d < 2.9 && (!best || d < z - best)) best = wz;
    }
    return best;
  }
  W2.anchor = o => (o._wz === undefined ? (o._wz = wallAnchor(o.x, o.z)) : o._wz);
  // lo que se ve en la cara del aparato, dentro del rectángulo (bx, by, bw, bh) en píxeles
  function face(g, type, bx, by, bw, bh, sc, t, lw, st) {
    const P = () => { g.fill(); g.stroke(); }, R = (x, y, w, h, c, r) => { g.fillStyle = c; rrect(g, x, y, w, h, r == null ? Math.min(w, h) * .12 : r); P(); };
    const cx = bx + bw / 2, cy = by + bh / 2, glow = .55 + Math.sin(t * 2.4 + bx) * .15;
    const scr = (x, y, w, h, c) => { R(x, y, w, h, '#0d1b33', Math.min(w, h) * .1); g.save(); rrect(g, x, y, w, h, 0); g.clip(); g.fillStyle = c; g.globalAlpha = glow * .35; g.fillRect(x, y, w, h); g.globalAlpha = 1; return { x, y, w, h }; };
    switch (type) {
      case 'wires': {   // cuadro eléctrico abierto con los cuatro cables cruzados
        R(bx, by, bw, bh, '#8a94aa'); R(bx + bw * .1, by + bh * .1, bw * .8, bh * .68, '#1b1f2b');
        ['#e8101b', '#1f3fff', '#ffe600', '#ff2fe0'].forEach((c, k) => { g.strokeStyle = c; g.lineWidth = Math.max(1.5, bh * .06); g.beginPath(); const y0 = by + bh * (.2 + k * .15), y1 = by + bh * (.2 + ((k * 3 + 1) % 4) * .15); g.moveTo(bx + bw * .16, y0); g.bezierCurveTo(cx, y0, cx, y1, bx + bw * .84, y1); g.stroke(); });
        g.strokeStyle = OUT; g.lineWidth = lw; g.fillStyle = '#ffd23f'; g.beginPath(); g.moveTo(cx, by + bh * .8); g.lineTo(cx + bw * .1, by + bh * .95); g.lineTo(cx - bw * .1, by + bh * .95); g.closePath(); P(); break; }
      case 'download': case 'upload': {   // terminal con una carpeta y la barra de progreso
        R(bx, by, bw, bh, '#4a5370'); scr(bx + bw * .1, by + bh * .1, bw * .8, bh * .6, '#3ad0ff'); g.restore();
        g.fillStyle = '#ffb547'; g.fillRect(bx + bw * .2, by + bh * .22, bw * .22, bh * .18); g.fillStyle = '#fff'; g.fillRect(bx + bw * .5, by + bh * .26, bw * .3, bh * .04); g.fillRect(bx + bw * .5, by + bh * .34, bw * .2, bh * .04);
        g.fillStyle = '#4ef0b8'; g.fillRect(bx + bw * .2, by + bh * .52, bw * .6 * ((t * .2 + bx * .01) % 1), bh * .07);
        R(bx + bw * .06, by + bh * .78, bw * .88, bh * .14, '#5c667f'); break; }
      case 'card': {   // lector de tarjetas con su ranura y luces
        R(bx + bw * .22, by, bw * .56, bh, '#3b4258'); R(bx + bw * .3, by + bh * .12, bw * .4, bh * .22, '#0a1b12'); g.fillStyle = '#4ef0b8'; g.fillRect(bx + bw * .34, by + bh * .2, bw * .3, bh * .05);
        g.fillStyle = '#05070c'; g.fillRect(bx + bw * .26, by + bh * .5, bw * .48, bh * .06);
        g.fillStyle = Math.sin(t * 3) > 0 ? '#4ef0b8' : '#ff3d5e'; g.beginPath(); g.arc(bx + bw * .62, by + bh * .78, bh * .06, 0, TAU); g.fill(); break; }
      case 'calibrate': {   // distribuidor: tres diales de colores
        R(bx, by, bw, bh, '#5c667f');
        ['#ffd93b', '#3fe0ff', '#4ef0b8'].forEach((c, k) => { const yy = by + bh * (.2 + k * .3), r = Math.min(bw * .17, bh * .12); g.fillStyle = '#1b1f2b'; g.beginPath(); g.arc(bx + bw * .3, yy, r, 0, TAU); P(); g.strokeStyle = c; g.lineWidth = r * .35; g.beginPath(); g.arc(bx + bw * .3, yy, r * .7, 0, TAU); g.stroke(); g.strokeStyle = '#fff'; g.lineWidth = Math.max(1, r * .2); g.beginPath(); g.moveTo(bx + bw * .3, yy); const a = t * (1.5 + k) + k; g.lineTo(bx + bw * .3 + Math.cos(a) * r * .8, yy + Math.sin(a) * r * .8); g.stroke(); g.strokeStyle = OUT; g.lineWidth = lw; R(bx + bw * .55, yy - r * .5, bw * .3, r, '#2a3144'); });
        break; }
      case 'divert': {   // panel de energía con ocho palancas
        R(bx, by, bw, bh, '#5c667f'); for (let k = 0; k < 8; k++) { const xx = bx + bw * (.12 + k * .108); g.fillStyle = '#1b1f2b'; g.fillRect(xx, by + bh * .15, bw * .05, bh * .65); g.fillStyle = k === 2 ? '#ffd23f' : '#c8d0de'; g.fillRect(xx - bw * .02, by + bh * (k === 2 ? .2 : .66), bw * .09, bh * .1); } break; }
      case 'accept': {   // caja de conexiones con el rayo
        R(bx + bw * .15, by, bw * .7, bh, '#5c667f'); g.fillStyle = '#ffd23f'; g.beginPath(); g.moveTo(cx + bw * .05, by + bh * .15); g.lineTo(cx - bw * .14, by + bh * .55); g.lineTo(cx, by + bh * .55); g.lineTo(cx - bw * .05, by + bh * .85); g.lineTo(cx + bw * .14, by + bh * .45); g.lineTo(cx, by + bh * .45); g.closePath(); P(); break; }
      case 'align': {   // pantalla del motor con la línea de salida
        R(bx, by, bw, bh, '#4a5370'); const s = scr(bx + bw * .08, by + bh * .1, bw * .62, bh * .75, '#4ef0b8'); g.strokeStyle = '#4ef0b8'; g.lineWidth = Math.max(1, lw * .8); g.beginPath(); g.moveTo(s.x + s.w * .1, s.y + s.h / 2); g.lineTo(s.x + s.w * .9, s.y + s.h / 2 + Math.sin(t) * s.h * .25); g.stroke(); g.restore(); g.strokeStyle = OUT; g.lineWidth = lw;
        R(bx + bw * .76, by + bh * .15, bw * .14, bh * .7, '#2a3144'); R(bx + bw * .72, by + bh * (.4 + Math.sin(t) * .15), bw * .22, bh * .12, '#ffb547'); break; }
      case 'fuel': {   // depósito naranja con su indicador
        R(bx + bw * .15, by, bw * .7, bh * .9, '#ef7d0d', bw * .2); g.fillStyle = '#c45f00'; g.fillRect(bx + bw * .15, by + bh * .3, bw * .7, bh * .08);
        g.fillStyle = '#e9eef5'; g.beginPath(); g.arc(cx, by + bh * .6, bw * .15, 0, TAU); P(); g.strokeStyle = '#c4162f'; g.beginPath(); g.moveTo(cx, by + bh * .6); g.lineTo(cx + bw * .1, by + bh * .53); g.stroke(); g.strokeStyle = OUT; R(cx - bw * .06, by + bh * .9, bw * .12, bh * .1, '#5c667f'); break; }
      case 'fillcan': {   // surtidor con manguera y bidones
        R(bx + bw * .1, by, bw * .45, bh * .95, '#c62828'); R(bx + bw * .17, by + bh * .1, bw * .3, bh * .2, '#0a1b12'); g.fillStyle = '#ffd23f'; g.fillRect(bx + bw * .2, by + bh * .16, bw * .22, bh * .06);
        g.strokeStyle = '#1b1f2b'; g.lineWidth = Math.max(2, bh * .05); g.beginPath(); g.moveTo(bx + bw * .55, by + bh * .35); g.quadraticCurveTo(bx + bw * .85, by + bh * .4, bx + bw * .78, by + bh * .75); g.stroke(); g.strokeStyle = OUT; g.lineWidth = lw;
        R(bx + bw * .62, by + bh * .65, bw * .3, bh * .33, '#e23b3b'); break; }
      case 'trash': {   // trampilla de la basura con su palanca
        R(bx, by, bw * .8, bh, '#6c7a5c'); R(bx + bw * .1, by + bh * .2, bw * .6, bh * .5, '#2f3826'); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(bx + bw * .1, by + bh * .2, bw * .6, bh * .08);
        R(bx + bw * .84, by + bh * .1, bw * .1, bh * .7, '#9aa4b8'); g.fillStyle = '#ff3d5e'; g.beginPath(); g.arc(bx + bw * .89, by + bh * .14, bw * .09, 0, TAU); P(); break; }
      case 'leaves': {   // filtro de oxígeno: rejilla con hojas detrás
        R(bx, by, bw, bh, '#5c667f'); R(bx + bw * .1, by + bh * .12, bw * .8, bh * .72, '#173a22');
        for (let k = 0; k < 5; k++) { g.fillStyle = ['#6fbf4a', '#a2c93f', '#4f9e3a'][k % 3]; g.beginPath(); g.ellipse(bx + bw * (.22 + k * .14), by + bh * (.3 + (k % 2) * .3), bw * .07, bh * .05, k, 0, TAU); g.fill(); }
        g.fillStyle = 'rgba(30,36,56,.7)'; for (let k = 1; k < 6; k++) g.fillRect(bx + bw * .1, by + bh * (.12 + k * .12), bw * .8, bh * .03); break; }
      case 'simon': {   // arranque del reactor: dos cuadrículas de 3 x 3
        R(bx, by, bw, bh, '#4a5370'); [0, 1].forEach(side => { for (let k = 0; k < 9; k++) { const on = side === 0 && Math.floor(t * 2) % 9 === k; g.fillStyle = on ? '#3f8cff' : side ? '#2a3350' : '#0d1220'; g.fillRect(bx + bw * (.08 + side * .48 + (k % 3) * .13), by + bh * (.15 + Math.floor(k / 3) * .24), bw * .11, bh * .2); } }); break; }
      case 'manifolds': {   // teclado de los colectores: 2 x 5 botones
        R(bx, by, bw, bh, '#4a5370'); for (let k = 0; k < 10; k++) { g.fillStyle = k < Math.floor(t) % 11 ? '#3f8cff' : '#d9e1f4'; g.fillRect(bx + bw * (.08 + (k % 5) * .17), by + bh * (.22 + Math.floor(k / 5) * .36), bw * .14, bh * .28); } break; }
      case 'shields': {   // panel de hexágonos
        R(bx, by, bw, bh, '#3d4560'); for (let k = 0; k < 7; k++) { const a = k / 6 * TAU, rr = k ? Math.min(bw, bh) * .25 : 0, hx = cx + Math.cos(a) * rr, hy = cy + Math.sin(a) * rr, r = Math.min(bw, bh) * .11; g.fillStyle = Math.sin(t * 2 + k) > 0 ? '#e8f4ff' : '#c4162f'; g.beginPath(); for (let q = 0; q < 6; q++) { const b = q / 6 * TAU; g.lineTo(hx + Math.cos(b) * r, hy + Math.sin(b) * r); } g.closePath(); P(); } break; }
      case 'samples': {   // analizador con los cinco tubos
        R(bx, by, bw, bh, '#d5dcea'); R(bx + bw * .08, by + bh * .08, bw * .84, bh * .2, '#1b2a44'); for (let k = 0; k < 5; k++) { R(bx + bw * (.12 + k * .16), by + bh * .36, bw * .1, bh * .5, k === 2 ? '#ff3d5e' : '#3fa9ff', bw * .05); } break; }
      case 'asteroids': {   // pantalla de tiro con asteroides
        R(bx, by, bw, bh, '#4a5370'); const s = scr(bx + bw * .08, by + bh * .1, bw * .84, bh * .8, '#4ef0b8'); g.fillStyle = '#a58c72'; for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(s.x + ((k * .27 + t * .15) % 1) * s.w, s.y + s.h * (.25 + (k % 3) * .25), s.h * .07, 0, TAU); g.fill(); } g.strokeStyle = '#4ef0b8'; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, s.h * .18, 0, TAU); g.stroke(); g.restore(); g.strokeStyle = OUT; g.lineWidth = lw; break; }
      case 'course': {   // mapa estelar con la ruta
        R(bx, by, bw, bh, '#4a5370'); const s = scr(bx + bw * .08, by + bh * .1, bw * .84, bh * .8, '#7f9cff'); g.setLineDash([3, 3]); g.strokeStyle = '#fff'; g.lineWidth = 1.2; g.beginPath(); for (let k = 0; k < 5; k++) { const xx = s.x + s.w * (.1 + k * .2), yy = s.y + s.h * (.3 + (k % 2) * .4); k ? g.lineTo(xx, yy) : g.moveTo(xx, yy); } g.stroke(); g.setLineDash([]); g.restore(); g.strokeStyle = OUT; g.lineWidth = lw; break; }
      case 'steering': {   // pantalla de navegación con la mira
        R(bx, by, bw, bh, '#4a5370'); const s = scr(bx + bw * .08, by + bh * .1, bw * .84, bh * .8, '#7fc4ff'); g.strokeStyle = '#7fc4ff'; g.lineWidth = 1.2; g.beginPath(); g.arc(cx, cy, s.h * .35, 0, TAU); g.moveTo(cx - s.h * .35, cy); g.lineTo(cx + s.h * .35, cy); g.moveTo(cx, cy - s.h * .35); g.lineTo(cx, cy + s.h * .35); g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.arc(cx + Math.sin(t) * s.h * .2, cy + Math.cos(t * .7) * s.h * .15, 2.2, 0, TAU); g.fill(); g.restore(); g.strokeStyle = OUT; g.lineWidth = lw; break; }
      // paneles de sabotaje
      case 'switches': { R(bx, by, bw, bh, '#8a94aa'); for (let k = 0; k < 5; k++) { const xx = bx + bw * (.12 + k * .16); g.fillStyle = '#1b1f2b'; g.fillRect(xx, by + bh * .3, bw * .1, bh * .45); g.fillStyle = '#c8d0de'; g.fillRect(xx - bw * .02, by + bh * (k % 2 ? .62 : .32), bw * .14, bh * .12); g.fillStyle = st && st.need ? '#ff2e4d' : '#4ef0b8'; g.beginPath(); g.arc(xx + bw * .05, by + bh * .16, bh * .05, 0, TAU); g.fill(); } break; }
      case 'code': { R(bx + bw * .18, by, bw * .64, bh, '#3b4258'); R(bx + bw * .26, by + bh * .08, bw * .48, bh * .18, st && st.need ? '#3a0a12' : '#0a1b12'); for (let k = 0; k < 12; k++) { g.fillStyle = '#d9e1f4'; g.fillRect(bx + bw * (.28 + (k % 3) * .15), by + bh * (.33 + Math.floor(k / 3) * .15), bw * .11, bh * .11); } break; }
      case 'dial': { R(bx, by, bw, bh, '#4a5370'); scr(bx + bw * .06, by + bh * .15, bw * .5, bh * .7, '#4ef0b8'); g.restore(); g.fillStyle = '#c8d0de'; g.beginPath(); g.arc(bx + bw * .77, cy, Math.min(bw * .16, bh * .3), 0, TAU); P(); g.fillStyle = '#ff3d5e'; g.fillRect(bx + bw * .76, cy - bh * .25, bw * .03, bh * .14); break; }
      case 'holdPanel': { R(bx + bw * .15, by, bw * .7, bh, '#2b3245'); g.fillStyle = st && st.need ? 'rgba(255,60,80,.8)' : 'rgba(120,200,255,.75)'; g.beginPath(); g.ellipse(cx, by + bh * .6, bw * .16, bh * .22, 0, 0, TAU); g.fill(); for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(cx - bw * .12 + k * bw * .08, by + bh * .3, bw * .03, bh * .12, 0, 0, TAU); g.fill(); } break; }
      default: { R(bx, by, bw, bh, '#4a5370'); scr(bx + bw * .1, by + bh * .1, bw * .8, bh * .65, type === 'vitals' ? '#4ef0b8' : '#3ad0ff'); g.restore(); g.strokeStyle = type === 'vitals' ? '#4ef0b8' : '#7fb8ff'; g.lineWidth = 1.4; g.beginPath(); for (let k = 0; k <= 10; k++) { const xx = bx + bw * (.15 + k * .07), yy = by + bh * .42 + (type === 'vitals' && k === 5 ? -bh * .15 : Math.sin(k + t * 3) * bh * .04); k ? g.lineTo(xx, yy) : g.moveTo(xx, yy); } g.stroke(); g.strokeStyle = OUT; g.lineWidth = lw; }
    }
  }
  // dibuja el aparato de una consola (o panel o terminal) y devuelve su rectángulo para resaltarlo
  function device(g, type, ox, oz, X, Y, sc, t, lw, st) {
    const wz = wallAnchor_cached(st, ox, oz), x = X(ox);
    g.save(); g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = OUT; g.lineWidth = lw;
    let box;
    if (type === 'scan') {   // escáner médico: plataforma en el suelo con el arco de luz
      const y = Y(oz); g.fillStyle = '#5e6b85'; g.beginPath(); g.ellipse(x, y - sc * .2, sc * 1.1, sc * .6, 0, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = 'rgba(78,240,184,.55)'; g.beginPath(); g.ellipse(x, y - sc * .22, sc * .75, sc * .38, 0, 0, TAU); g.fill();
      g.fillStyle = '#3a4258'; rrect(g, x + sc * .85, y - sc * 2.1, sc * .3, sc * 1.9, sc * .1); g.fill(); g.stroke(); rrect(g, x - sc * .5, y - sc * 2.25, sc * 1.6, sc * .3, sc * .1); g.fill(); g.stroke();
      box = { x: x - sc * 1.25, y: y - sc * 2.4, w: sc * 2.6, h: sc * 2.75 };
    } else if (wz != null) {   // en la pared
      const fy = Y(wz), bw = (type === 'card' || type === 'accept' || type === 'code' || type === 'holdPanel' ? 1.2 : 1.7) * sc, bh = 1.55 * sc, by = fy - FACE_H * sc + .35 * sc;
      g.fillStyle = 'rgba(0,0,0,.25)'; rrect(g, x - bw / 2 + sc * .08, by + sc * .1, bw, bh, sc * .12); g.fill();
      face(g, type, x - bw / 2, by, bw, bh, sc, t, lw, st);
      box = { x: x - bw / 2 - sc * .15, y: by - sc * .15, w: bw + sc * .3, h: bh + sc * .3 };
    } else {   // en el suelo, sobre un pedestal
      const y = Y(oz), bw = 1.5 * sc, bh = 1.2 * sc;
      g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.ellipse(x, y, sc * .9, sc * .3, 0, 0, TAU); g.fill();
      g.fillStyle = '#3e465c'; rrect(g, x - sc * .5, y - sc * .9, sc, sc * .9, sc * .12); g.fill(); g.stroke();
      face(g, type, x - bw / 2, y - sc * .9 - bh, bw, bh, sc, t, lw, st);
      box = { x: x - bw / 2 - sc * .15, y: y - sc * .9 - bh - sc * .15, w: bw + sc * .3, h: bh + sc * 1.25 };
    }
    g.restore(); return box;
  }
  const wallAnchor_cached = (o, x, z) => (o && o._wz !== undefined ? o._wz : o ? (o._wz = wallAnchor(x, z)) : wallAnchor(x, z));
  const outline = (g, b, color, w, dash) => { g.save(); g.strokeStyle = color; g.lineWidth = w; if (dash) g.setLineDash(dash); rrect(g, b.x, b.y, b.w, b.h, Math.min(b.w, b.h) * .15); g.stroke(); g.restore(); };

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
    const c = document.createElement('canvas'); c.width = Math.round(S.MAPW * ppm); c.height = Math.round(S.MAPH * ppm);
    const g = c.getContext('2d'); g.fillStyle = '#0a1a3a'; g.fillRect(0, 0, c.width, c.height); g.scale(ppm, ppm);
    S.POLYS.forEach(p => { g.fillStyle = p.room ? '#5b8fd9' : '#3f6fb8'; g.beginPath(); p.pts.forEach(([x, z], i) => i ? g.lineTo(x, z) : g.moveTo(x, z)); g.closePath(); g.fill(); });
    g.strokeStyle = '#d9ecff'; g.lineWidth = 1.2; g.lineCap = 'round'; g.beginPath(); S.WALLS.forEach(w => { g.moveTo(w.a[0], w.a[1]); g.lineTo(w.b[0], w.b[1]); }); g.stroke();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.font = `800 ${Math.max(6, ppm * 2.3)}px "Inter",system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.strokeStyle = '#0a1a3a'; g.lineWidth = Math.max(2, ppm); g.lineJoin = 'round';
    S.ROOMS.forEach(r => { const x = r.c[0] * ppm, y = r.c[1] * ppm; g.strokeText(r.name, x, y); g.fillText(r.name, x, y); });
    return c;
  };

  root.World2D = W2;
})(typeof window !== 'undefined' ? window : globalThis);
