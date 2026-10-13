/* Impostor 3D · minijuegos de tareas (al estilo del original), dibujados en canvas y pensados para el dedo.
   Tasks.create(H) recibe del juego: snd(nombre, opciones), buzz(patrón), token() y alive(token) -> ¿sigue abierta esta tarea?,
   me() -> { name, look, portrait(size) }. Cada minijuego es fn(body, done). */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => 1 - Math.pow(1 - t, 3);
  const rand = (a, b) => a + Math.random() * (b - a);
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const FONT = s => `700 ${s}px "Chakra Petch","Inter",system-ui,sans-serif`;

  /* ---------- dibujo ---------- */
  function rr(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function screw(g, x, y) { g.fillStyle = '#58637d'; g.beginPath(); g.arc(x, y, 3.2, 0, TAU); g.fill(); g.strokeStyle = '#2a3144'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x - 2, y - 2); g.lineTo(x + 2, y + 2); g.stroke(); }
  function metal(g, x, y, w, h, r, c1, c2) {
    const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, c1 || '#3a445c'); gr.addColorStop(1, c2 || '#232a3b');
    rr(g, x, y, w, h, r); g.fillStyle = gr; g.fill(); g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1.5; g.stroke();
  }
  function bg(g, W, H) {
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#2b344b'); gr.addColorStop(1, '#161c2b');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,255,255,.035)'; g.lineWidth = 1;
    for (let x = 0; x < W; x += 18) { g.beginPath(); g.moveTo(x + .5, 0); g.lineTo(x + .5, H); g.stroke(); }
    for (let y = 0; y < H; y += 18) { g.beginPath(); g.moveTo(0, y + .5); g.lineTo(W, y + .5); g.stroke(); }
    [[9, 9], [W - 9, 9], [9, H - 9], [W - 9, H - 9]].forEach(([a, b]) => screw(g, a, b));
  }
  function txt(g, s, x, y, size, color, align) { g.font = FONT(size); g.textAlign = align || 'center'; g.textBaseline = 'middle'; g.fillStyle = color || '#eef2ff'; g.fillText(s, x, y); }
  function lamp(g, x, y, r, on, color) {
    g.save(); if (on) { g.shadowColor = color; g.shadowBlur = 14; }
    g.fillStyle = on ? color : '#1a1f2c'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.restore();
    g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
    if (on) { g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.arc(x - r * .3, y - r * .3, r * .3, 0, TAU); g.fill(); }
  }
  function btn(g, b, label, opt) {
    opt = opt || {}; const press = opt.down ? 2 : 0, col = opt.color || '#ffb547';
    rr(g, b.x, b.y + 4, b.w, b.h, 12); g.fillStyle = 'rgba(0,0,0,.45)'; g.fill();
    const gr = g.createLinearGradient(0, b.y, 0, b.y + b.h); gr.addColorStop(0, opt.disabled ? '#4a5168' : col); gr.addColorStop(1, opt.disabled ? '#363c50' : shade(col, -.25));
    rr(g, b.x, b.y + press, b.w, b.h, 12); g.fillStyle = gr; g.fill();
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1.5; g.stroke();
    txt(g, label, b.x + b.w / 2, b.y + b.h / 2 + press + 1, opt.size || 15, opt.disabled ? '#9aa3bb' : (opt.ink || '#1d1300'));
  }
  function shade(hex, k) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, gg = n >> 8 & 255, b = n & 255; const f = v => clamp(Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k), 0, 255); return '#' + ((1 << 24) + (f(r) << 16) + (f(gg) << 8) + f(b)).toString(16).slice(1); }
  const hit = (p, b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;

  function create(H) {
    const snd = (n, o) => { try { H.snd(n, o); } catch (e) { /* sin sonido */ } };
    const buzz = p => { try { H.buzz(p); } catch (e) { /* sin vibración */ } };

    /* Monta el lienzo del minijuego: ancho del panel, alto limitado por la pantalla (en horizontal hay poco alto) */
    function mk(body, aspect) {
      const wrap = document.createElement('div'); wrap.className = 'mgStage';
      const cv = document.createElement('canvas'), hintEl = document.createElement('div'); hintEl.className = 'mgHint';
      wrap.append(cv); body.append(wrap, hintEl);
      const availH = Math.max(150, window.innerHeight - (window.innerHeight < 500 ? 92 : 130)), availW = Math.max(240, (body.clientWidth || 340));
      const W = Math.round(Math.min(availW, availH * aspect, 600)), Hh = Math.round(W / aspect);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = W * dpr; cv.height = Hh * dpr; cv.style.width = W + 'px'; cv.style.height = Hh + 'px';
      const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const S = { cv, g, W, H: Hh, finished: false }, tok = H.token();
      S.hint = (t, kind) => { hintEl.textContent = t; hintEl.className = 'mgHint' + (kind ? ' ' + kind : ''); };
      S.win = () => { if (S.finished) return; S.finished = true; wrap.classList.add('won'); buzz([20, 40, 20]); setTimeout(() => body.dispatchEvent(new Event('mgwin')), 380); };
      S.fail = msg => { snd('err'); buzz([50, 40, 50]); wrap.classList.remove('bad'); void wrap.offsetWidth; wrap.classList.add('bad'); if (msg) S.hint(msg, 'bad'); };
      S.pos = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * Hh / r.height }; };
      S.on = h => {
        let id = null;
        cv.addEventListener('pointerdown', e => { if (S.finished || id != null) return; e.preventDefault(); id = e.pointerId; try { cv.setPointerCapture(id); } catch (er) { /* nada */ } h.down && h.down(S.pos(e), e); });
        cv.addEventListener('pointermove', e => { if (e.pointerId !== id) return; h.move && h.move(S.pos(e), e); });
        const end = e => { if (e.pointerId !== id) return; id = null; h.up && h.up(S.pos(e), e); };
        cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
        cv.addEventListener('contextmenu', e => e.preventDefault());
      };
      S.loop = fn => { let last = performance.now(); const f = t => { if (!H.alive(tok)) return; const dt = Math.min(.05, (t - last) / 1000); last = t; fn(dt, t / 1000); requestAnimationFrame(f); }; requestAnimationFrame(f); };
      // para las pruebas automáticas: simula el dedo sobre el lienzo con coordenadas del minijuego
      S.touch = (type, x, y) => { const r = cv.getBoundingClientRect(); cv.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: r.left + x * r.width / W, clientY: r.top + y * r.height / Hh })); };
      S.drag = async (pts, ms) => { const wait = t => new Promise(r => setTimeout(r, t)); S.touch('pointerdown', pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) { await wait(ms || 16); S.touch('pointermove', pts[i][0], pts[i][1]); } await wait(ms || 16); const l = pts[pts.length - 1]; S.touch('pointerup', l[0], l[1]); };
      S.tap = (x, y) => S.drag([[x, y]], 30);
      return S;
    }
    const wait = t => new Promise(r => setTimeout(r, t));

    const T = {};

    /* 1 · Conectar cables: arrastra cada cable hasta el conector de su color */
    T.wires = (body) => {
      const S = mk(body, 1.3), { g, W } = S, Hh = S.H;
      const COLS = [['#ff3b3b', 'rojo'], ['#3b7bff', 'azul'], ['#ffd93b', 'amarillo'], ['#ff4fd8', 'rosa']];
      const L = shuffle([0, 1, 2, 3]), R = shuffle([0, 1, 2, 3]), y = i => Hh * (.2 + i * .2);
      const done = new Set(); let drag = null, sparks = [];
      S.hint('Arrastra cada cable hasta el conector del mismo color.');
      S.on({
        down: p => { const i = [0, 1, 2, 3].find(k => Math.hypot(p.x - 34, p.y - y(k)) < 30 && !done.has(L[k])); if (i != null) { drag = { i, x: p.x, y: p.y }; snd('click'); } },
        move: p => { if (drag) { drag.x = p.x; drag.y = p.y; } },
        up: p => {
          if (!drag) return; const c = L[drag.i], k = [0, 1, 2, 3].find(j => Math.hypot(p.x - (W - 34), p.y - y(j)) < 34);
          if (k != null && R[k] === c) { done.add(c); snd('spark'); buzz(15); for (let s = 0; s < 14; s++) sparks.push({ x: W - 40, y: y(k), vx: rand(-90, 40), vy: rand(-120, 60), t: 0 }); if (done.size === 4) S.win(); }
          else if (k != null) S.fail('Ese no es su color.');
          drag = null;
        }
      });
      S.loop((dt, t) => {
        bg(g, W, Hh);
        metal(g, 6, Hh * .08, 52, Hh * .84, 10); metal(g, W - 58, Hh * .08, 52, Hh * .84, 10);
        const wire = (x1, y1, x2, y2, col) => { g.lineCap = 'round'; g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 15; g.beginPath(); g.moveTo(x1, y1 + 3); g.bezierCurveTo(lerp(x1, x2, .4), y1 + 3, lerp(x1, x2, .6), y2 + 3, x2, y2 + 3); g.stroke(); g.strokeStyle = col; g.lineWidth = 12; g.beginPath(); g.moveTo(x1, y1); g.bezierCurveTo(lerp(x1, x2, .4), y1, lerp(x1, x2, .6), y2, x2, y2); g.stroke(); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 3; g.beginPath(); g.moveTo(x1, y1 - 3); g.bezierCurveTo(lerp(x1, x2, .4), y1 - 3, lerp(x1, x2, .6), y2 - 3, x2, y2 - 3); g.stroke(); };
        for (let i = 0; i < 4; i++) {
          const c = L[i]; if (done.has(c)) wire(48, y(i), W - 48, y(R.indexOf(c)), COLS[c][0]);
          else if (drag && drag.i === i) wire(48, y(i), drag.x, drag.y, COLS[c][0]);
          else { g.fillStyle = COLS[c][0]; rr(g, 40, y(i) - 7, 26, 14, 5); g.fill(); }
          g.fillStyle = COLS[c][0]; rr(g, 12, y(i) - 11, 36, 22, 6); g.fill(); g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 2; g.stroke();
          const r = R[i]; g.fillStyle = COLS[r][0]; rr(g, W - 48, y(i) - 11, 36, 22, 6); g.fill(); g.stroke();
          g.fillStyle = '#0d1018'; rr(g, W - 64, y(i) - 8, 16, 16, 4); g.fill();
          lamp(g, W - 22, y(i) - 22, 5, done.has(r), '#5dff8a');
        }
        if (drag) { g.fillStyle = COLS[L[drag.i]][0]; g.beginPath(); g.arc(drag.x, drag.y, 9, 0, TAU); g.fill(); }
        sparks = sparks.filter(s => (s.t += dt) < .45); sparks.forEach(s => { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 400 * dt; g.fillStyle = `rgba(255,${200 + Math.random() * 55 | 0},120,${1 - s.t / .45})`; g.fillRect(s.x, s.y, 3, 3); });
      });
      S.cv._solve = async () => { for (let i = 0; i < 4; i++) { const k = R.indexOf(L[i]); await S.drag([[34, y(i)], [W / 2, (y(i) + y(k)) / 2], [W - 34, y(k)]]); await wait(60); } };
    };

    /* 2 · Calibrar distribuidor: pulsa cuando la aguja pasa por la zona marcada */
    T.calibrate = (body) => {
      const S = mk(body, 1.45), { g, W } = S, Hh = S.H;
      const rows = [0, 1, 2].map(i => ({ a: rand(0, TAU), sp: [2.2, 3.1, 4][i], tgt: rand(0, TAU), ok: false, col: ['#ffd93b', '#3fe0ff', '#4ef0b8'][i] }));
      let cur = 0, pressed = -1, pressT = 0;
      const ry = i => Hh * (.2 + i * .3), R = Math.min(Hh * .12, 34), bx = W * .58, bw = W * .34, bh = Math.min(42, Hh * .2);
      const inZone = r => { const d = Math.abs(((r.a - r.tgt) % TAU + TAU + Math.PI) % TAU - Math.PI); return d < .32; };
      S.hint('Pulsa "Calibrar" cuando la aguja esté dentro de la zona iluminada.');
      S.on({ down: p => {
        const b = { x: bx, y: ry(cur) - bh / 2, w: bw, h: bh }; if (!hit(p, b)) return; pressed = cur; pressT = .15;
        const r = rows[cur];
        if (inZone(r)) { r.ok = true; snd('note', { f: [523, 659, 784][cur] }); buzz(15); cur++; if (cur === 3) S.win(); }
        else { S.fail('Fuera de la zona. Vuelve a empezar.'); rows.forEach(q => { q.ok = false; }); cur = 0; }
      } });
      S.loop(dt => {
        bg(g, W, Hh); pressT = Math.max(0, pressT - dt);
        rows.forEach((r, i) => {
          if (!r.ok) r.a += r.sp * dt * (i === cur ? 1 : .35);
          const cx = W * .22, cy = ry(i);
          metal(g, cx - R - 12, cy - R - 12, R * 2 + 24, R * 2 + 24, 14);
          g.fillStyle = '#0b0f19'; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
          g.save(); g.shadowColor = r.col; g.shadowBlur = i === cur || r.ok ? 12 : 0; g.strokeStyle = r.ok ? '#4ef0b8' : r.col; g.globalAlpha = i === cur || r.ok ? 1 : .35; g.lineWidth = 7;
          g.beginPath(); g.arc(cx, cy, R - 5, r.tgt - .32, r.tgt + .32); g.stroke(); g.restore();
          g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(r.a) * (R - 4), cy + Math.sin(r.a) * (R - 4)); g.stroke();
          g.fillStyle = '#c9d3ee'; g.beginPath(); g.arc(cx, cy, 4, 0, TAU); g.fill();
          g.fillStyle = 'rgba(0,0,0,.35)'; rr(g, W * .36, cy - 5, W * .18, 10, 5); g.fill();
          g.fillStyle = r.ok ? '#4ef0b8' : r.col; g.globalAlpha = r.ok ? 1 : .3; rr(g, W * .36, cy - 5, W * .18 * (r.ok ? 1 : .25), 10, 5); g.fill(); g.globalAlpha = 1;
          btn(g, { x: bx, y: cy - bh / 2, w: bw, h: bh }, r.ok ? 'OK' : 'CALIBRAR', { disabled: i !== cur && !r.ok, color: r.ok ? '#4ef0b8' : '#ffb547', down: pressed === i && pressT > 0, size: 14 });
        });
      });
      S.cv._solve = async () => { for (let i = 0; i < 3; i++) { for (let k = 0; k < 1500 && !inZone(rows[i]); k++) await wait(4); S.tap(bx + bw / 2, ry(i)); await wait(80); } };
    };

    /* 3 · Descargar datos: pulsa y espera a que los archivos viajen a la nube */
    T.download = (body) => {
      const S = mk(body, 1.65), { g, W } = S, Hh = S.H;
      let st = 'idle', p = 0, files = [], eta = 'Calculando…', etaT = 0;
      const b = { x: W / 2 - 75, y: Hh * .72, w: 150, h: Math.min(44, Hh * .17) };
      S.hint('Pulsa "Descargar" y espera a que termine.');
      S.on({ down: q => { if (st === 'idle' && hit(q, b)) { st = 'run'; snd('click'); S.hint('Descargando… no cierres la ventana.'); } } });
      const folder = (x, y, open, label) => {
        g.fillStyle = '#ffb547'; rr(g, x - 34, y - 26, 30, 10, 3); g.fill(); g.fillStyle = shade('#ffb547', -.12); rr(g, x - 34, y - 20, 68, 46, 6); g.fill();
        if (open) { g.fillStyle = '#ffd27a'; g.beginPath(); g.moveTo(x - 38, y - 6); g.lineTo(x + 38, y - 6); g.lineTo(x + 32, y + 26); g.lineTo(x - 32, y + 26); g.closePath(); g.fill(); }
        txt(g, label, x, y + 42, 12, '#a9b8dc');
      };
      S.loop((dt, t) => {
        bg(g, W, Hh);
        const fy = Hh * .36; folder(W * .2, fy, st === 'run', 'Navegación');
        g.fillStyle = '#dfe9ff'; [[0, 0, 22], [-20, 6, 16], [20, 6, 16]].forEach(([dx, dy, r]) => { g.beginPath(); g.arc(W * .8 + dx, fy + dy - 6, r, 0, TAU); g.fill(); }); rr(g, W * .8 - 36, fy + 2, 72, 22, 11); g.fill(); txt(g, 'Nube', W * .8, fy + 42, 12, '#a9b8dc');
        if (st === 'run') {
          p = Math.min(1, p + dt / 5.5); etaT -= dt; if (etaT <= 0) { etaT = .7; const s = Math.max(0, Math.round((1 - p) * 5.5 + rand(-1, 2))); eta = p > .97 ? 'Casi listo' : `Quedan ${s} s`; }
          if (Math.random() < dt * 6) files.push({ k: 0 });
          if (p >= 1) { st = 'end'; snd('fixed'); S.hint('¡Descarga completada!', 'ok'); S.win(); }
        }
        files = files.filter(f => (f.k += dt / .9) < 1);
        files.forEach(f => { const x = lerp(W * .2, W * .8, f.k), y = fy - Math.sin(f.k * Math.PI) * Hh * .2; g.fillStyle = '#fff'; rr(g, x - 7, y - 9, 14, 18, 2); g.fill(); g.fillStyle = '#7d8bb0'; g.fillRect(x - 4, y - 4, 8, 1.5); g.fillRect(x - 4, y, 8, 1.5); g.fillRect(x - 4, y + 4, 6, 1.5); });
        const bw = W * .7, bx = W * .15, by = Hh * .58;
        g.fillStyle = '#0b0f19'; rr(g, bx, by, bw, 14, 7); g.fill();
        const gr = g.createLinearGradient(bx, 0, bx + bw, 0); gr.addColorStop(0, '#3fe0ff'); gr.addColorStop(1, '#4ef0b8');
        g.fillStyle = gr; rr(g, bx, by, Math.max(14, bw * p), 14, 7); g.fill();
        txt(g, Math.round(p * 100) + '%', bx + bw / 2, by - 12, 13, '#eef2ff'); if (st === 'run') txt(g, eta, bx + bw, by + 26, 11, '#8d99bb', 'right');
        if (st === 'idle') btn(g, b, 'DESCARGAR', { color: '#3fe0ff', size: 15 });
      });
      S.cv._solve = async () => S.tap(b.x + b.w / 2, b.y + b.h / 2);
    };

    /* 4 · Trazar rumbo: lleva la nave por todos los puntos del mapa estelar */
    T.course = (body) => {
      const S = mk(body, 1.8), { g, W } = S, Hh = S.H;
      const pts = Array.from({ length: 5 }, (_, i) => ({ x: lerp(W * .1, W * .9, i / 4), y: Hh * rand(.25, .75) }));
      const stars = Array.from({ length: 60 }, () => ({ x: rand(0, W), y: rand(0, Hh), r: rand(.5, 1.6), p: rand(0, TAU) }));
      let reached = 0, ship = { x: pts[0].x, y: pts[0].y }, drag = false, ang = 0;
      S.hint('Arrastra la nave siguiendo la ruta, de punto en punto.');
      const distSeg = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy), 0, 1); return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t)); };
      S.on({
        down: p => { if (Math.hypot(p.x - ship.x, p.y - ship.y) < 40) { drag = true; snd('click'); } },
        move: p => {
          if (!drag) return; const a = pts[reached], b = pts[reached + 1]; if (!b) return;
          if (distSeg(p, a, b) > 42) { drag = false; ship = { x: a.x, y: a.y }; S.fail('Te has salido de la ruta.'); return; }
          ang = Math.atan2(p.y - ship.y, p.x - ship.x) || ang; ship = { x: p.x, y: p.y };
          if (Math.hypot(p.x - b.x, p.y - b.y) < 20) { reached++; snd('note', { f: 440 + reached * 110 }); buzz(10); if (reached === pts.length - 1) { drag = false; S.win(); } }
        },
        up: () => { if (drag && reached < pts.length - 1) { const a = pts[reached]; ship = { x: a.x, y: a.y }; } drag = false; }
      });
      S.loop((dt, t) => {
        g.fillStyle = '#07122a'; g.fillRect(0, 0, W, Hh);
        const neb = g.createRadialGradient(W * .7, Hh * .3, 10, W * .7, Hh * .3, W * .5); neb.addColorStop(0, 'rgba(139,123,255,.25)'); neb.addColorStop(1, 'transparent'); g.fillStyle = neb; g.fillRect(0, 0, W, Hh);
        stars.forEach(s => { g.globalAlpha = .5 + .5 * Math.sin(t * 2 + s.p); g.fillStyle = '#fff'; g.fillRect(s.x, s.y, s.r, s.r); }); g.globalAlpha = 1;
        for (let i = 0; i < pts.length - 1; i++) {
          g.setLineDash(i < reached ? [] : [6, 7]); g.lineDashOffset = -t * 20; g.strokeStyle = i < reached ? '#4ef0b8' : 'rgba(255,255,255,.55)'; g.lineWidth = i < reached ? 4 : 2.5;
          g.beginPath(); g.moveTo(pts[i].x, pts[i].y); g.lineTo(pts[i + 1].x, pts[i + 1].y); g.stroke();
        }
        g.setLineDash([]);
        pts.forEach((q, i) => { lamp(g, q.x, q.y, i === reached + 1 ? 9 + Math.sin(t * 6) * 2 : 8, i <= reached, i === pts.length - 1 ? '#ffb547' : '#4ef0b8'); });
        g.save(); g.translate(ship.x, ship.y); g.rotate(ang); g.fillStyle = '#e8eefc'; g.beginPath(); g.moveTo(16, 0); g.lineTo(-10, -10); g.lineTo(-5, 0); g.lineTo(-10, 10); g.closePath(); g.fill();
        g.fillStyle = '#3fe0ff'; g.beginPath(); g.arc(3, 0, 3.5, 0, TAU); g.fill();
        if (drag) { g.fillStyle = '#ffb547'; g.beginPath(); g.moveTo(-6, -4); g.lineTo(-16 - Math.random() * 6, 0); g.lineTo(-6, 4); g.fill(); } g.restore();
      });
      S.cv._solve = async () => { const path = [[pts[0].x, pts[0].y]]; for (let i = 1; i < pts.length; i++) for (let k = 1; k <= 8; k++) path.push([lerp(pts[i - 1].x, pts[i].x, k / 8), lerp(pts[i - 1].y, pts[i].y, k / 8)]); await S.drag(path, 12); };
    };

    /* 5 · Iniciar reactor: memoriza la secuencia de la izquierda y repítela a la derecha */
    T.simon = (body) => {
      const S = mk(body, 2.05), { g, W } = S, Hh = S.H;
      const ROUNDS = 4, seq = Array.from({ length: ROUNDS + 1 }, () => Math.floor(Math.random() * 9));
      let round = 1, phase = 'show', showI = 0, showT = .6, lit = -1, litT = 0, inp = 0, press = -1, pressT = 0, flashBad = 0;
      const cell = Math.min((W / 2 - 40) / 3, (Hh - 54) / 3), gap = 6, gx = [W * .25 - 1.5 * cell, W * .75 - 1.5 * cell], gy = 40;
      const rect = (side, k) => ({ x: gx[side] + (k % 3) * cell + gap / 2, y: gy + Math.floor(k / 3) * cell + gap / 2, w: cell - gap, h: cell - gap });
      const NOTES = [262, 294, 330, 349, 392, 440, 494, 523, 587];
      S.hint('Mira la secuencia de la izquierda y repítela en el panel de la derecha.');
      S.on({ down: p => {
        if (phase !== 'input') return; const k = [...Array(9).keys()].find(i => hit(p, rect(1, i))); if (k == null) return;
        press = k; pressT = .2; snd('note', { f: NOTES[k] });
        if (k === seq[inp]) { inp++; if (inp === round) { round++; inp = 0; if (round > ROUNDS) { phase = 'end'; S.win(); } else { phase = 'show'; showI = 0; showT = .8; } } }
        else { S.fail('Secuencia incorrecta. Empezamos de nuevo.'); flashBad = .6; round = 1; inp = 0; phase = 'show'; showI = 0; showT = 1.1; }
      } });
      S.loop(dt => {
        bg(g, W, Hh); pressT = Math.max(0, pressT - dt); litT = Math.max(0, litT - dt); flashBad = Math.max(0, flashBad - dt);
        if (phase === 'show') { showT -= dt; if (showT <= 0) { if (showI < round) { lit = seq[showI++]; litT = .42; snd('note', { f: NOTES[lit], gain: .7 }); showT = .62; } else { phase = 'input'; lit = -1; S.hint('¡Tu turno! Repite la secuencia.'); } } }
        for (let i = 0; i < ROUNDS; i++) lamp(g, W * .25 - (ROUNDS - 1) * 9 + i * 18, 20, 6, i < round - 1, '#4ef0b8');
        for (let i = 0; i < ROUNDS; i++) lamp(g, W * .75 - (ROUNDS - 1) * 9 + i * 18, 20, 6, phase === 'input' && i < inp, '#3fe0ff');
        [0, 1].forEach(side => {
          metal(g, gx[side] - 8, gy - 8, cell * 3 + 16, cell * 3 + 16, 12, '#1d2436', '#121726');
          for (let k = 0; k < 9; k++) {
            const r = rect(side, k), on = side === 0 ? (k === lit && litT > 0) : (k === press && pressT > 0);
            rr(g, r.x, r.y, r.w, r.h, 8); g.fillStyle = flashBad > 0 ? '#5a1622' : on ? '#3f8cff' : side === 0 ? '#0d1220' : '#2a3350'; g.fill();
            if (on) { g.save(); g.shadowColor = '#3f8cff'; g.shadowBlur = 18; g.fill(); g.restore(); }
            g.strokeStyle = 'rgba(255,255,255,.1)'; g.lineWidth = 1.5; g.stroke();
          }
        });
      });
      S.cv._solve = async () => { for (let r = 1; r <= ROUNDS; r++) { for (let k = 0; k < 600 && phase !== 'input'; k++) await wait(10); for (let i = 0; i < r; i++) { const q = rect(1, seq[i]); S.tap(q.x + q.w / 2, q.y + q.h / 2); await wait(60); } } };
    };

    /* 6 · Desbloquear colectores: pulsa del 1 al 10 en orden */
    T.manifolds = (body) => {
      const S = mk(body, 2.2), { g, W } = S, Hh = S.H;
      const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]); let next = 1, bad = 0, pop = {};
      const cw = (W - 40) / 5, ch = Math.min(cw, (Hh - 40) / 2), r = i => ({ x: 20 + (i % 5) * cw + 4, y: Hh / 2 - ch + Math.floor(i / 5) * ch + 4, w: cw - 8, h: ch - 8 });
      S.hint('Pulsa los números del 1 al 10, en orden.');
      S.on({ down: p => {
        const i = nums.findIndex((n, k) => hit(p, r(k))); if (i < 0 || nums[i] < next) return;
        if (nums[i] === next) { pop[i] = .25; snd('note', { f: 330 + next * 40 }); buzz(8); if (++next > 10) S.win(); }
        else { S.fail('Orden incorrecto.'); next = 1; bad = .5; }
      } });
      S.loop(dt => {
        bg(g, W, Hh); bad = Math.max(0, bad - dt);
        nums.forEach((n, i) => {
          const b = r(i), on = n < next, k = pop[i] = Math.max(0, (pop[i] || 0) - dt), s = 1 - k * .4;
          g.save(); g.translate(b.x + b.w / 2, b.y + b.h / 2); g.scale(s, s);
          rr(g, -b.w / 2, -b.h / 2 + 3, b.w, b.h, 10); g.fillStyle = 'rgba(0,0,0,.45)'; g.fill();
          const gr = g.createLinearGradient(0, -b.h / 2, 0, b.h / 2); gr.addColorStop(0, bad ? '#8a2233' : on ? '#3f8cff' : '#d9e1f4'); gr.addColorStop(1, bad ? '#5a1622' : on ? '#2457c9' : '#a9b4cf');
          rr(g, -b.w / 2, -b.h / 2, b.w, b.h, 10); g.fillStyle = gr; g.fill(); if (on) { g.shadowColor = '#3f8cff'; g.shadowBlur = 12; g.fill(); }
          txt(g, String(n), 0, 1, Math.min(26, b.h * .45), on ? '#fff' : '#1c2540'); g.restore();
        });
      });
      S.cv._solve = async () => { for (let n = 1; n <= 10; n++) { const b = r(nums.indexOf(n)); S.tap(b.x + b.w / 2, b.y + b.h / 2); await wait(40); } };
    };

    /* 7 · Escáner médico: quédate quieto mientras te escanean */
    T.scan = (body) => {
      const S = mk(body, 1.6), { g, W } = S, Hh = S.H, me = H.me();
      const size = Math.min(Hh * .58, W * .36), pc = me.portrait ? me.portrait(size) : null;
      const lines = [`ID: ${String(me.name || 'TRIPULANTE').toUpperCase()}`, `ALTURA: ${me.look && me.look.ht ? me.look.ht : 175} cm`, `GRUPO: ${['A+', 'B-', '0+', 'AB+'][(me.name || '').length % 4]}`, `PESO: ${60 + ((me.name || 'x').charCodeAt(0) % 30)} kg`, 'ESTADO: SANO'];
      let p = 0; const DUR = 6.5;
      S.hint('Escaneando… quédate en la plataforma.');
      snd('scan');
      S.loop((dt, t) => {
        if (!S.finished) { p = Math.min(1, p + dt / DUR); if (p >= 1) { S.hint('Escáner completado.', 'ok'); S.win(); } }
        bg(g, W, Hh);
        const cx = W * .28, cy = Hh * .5;
        g.fillStyle = '#0b2a2a'; g.beginPath(); g.ellipse(cx, cy + size * .62, size * .62, size * .16, 0, 0, TAU); g.fill();
        g.strokeStyle = '#4ef0b8'; g.lineWidth = 2; g.beginPath(); g.ellipse(cx, cy + size * .62, size * .62, size * .16, 0, 0, TAU); g.stroke();
        if (pc) { g.save(); g.beginPath(); g.arc(cx, cy, size / 2, 0, TAU); g.clip(); g.drawImage(pc, cx - size / 2, cy - size / 2, size, size); g.restore(); }
        const sy = cy - size / 2 + (Math.sin(t * 2.6) * .5 + .5) * size;
        const beam = g.createLinearGradient(0, sy - 18, 0, sy + 18); beam.addColorStop(0, 'rgba(78,240,184,0)'); beam.addColorStop(.5, 'rgba(78,240,184,.75)'); beam.addColorStop(1, 'rgba(78,240,184,0)');
        g.fillStyle = beam; g.fillRect(cx - size * .62, sy - 18, size * 1.24, 36);
        g.fillStyle = 'rgba(78,240,184,.18)'; g.beginPath(); g.moveTo(cx - size * .62, cy + size * .62); g.lineTo(cx - size * .5, sy); g.lineTo(cx + size * .5, sy); g.lineTo(cx + size * .62, cy + size * .62); g.fill();
        const px = W * .54, pw = W * .42; metal(g, px, Hh * .1, pw, Hh * .8, 12, '#0f1a1a', '#0a1212');
        const shown = Math.floor(p * (lines.length + 1));
        lines.forEach((l, i) => { if (i < shown) txt(g, l, px + 14, Hh * .2 + i * Hh * .11, Math.min(14, pw / 15), '#4ef0b8', 'left'); });
        g.fillStyle = '#123'; rr(g, px + 14, Hh * .8, pw - 28, 10, 5); g.fill(); g.fillStyle = '#4ef0b8'; rr(g, px + 14, Hh * .8, Math.max(10, (pw - 28) * p), 10, 5); g.fill();
      });
      S.cv._solve = async () => {};
    };

    /* 8 · Analizar muestra: inicia el análisis, espera y elige el tubo anómalo */
    T.samples = (body) => {
      const S = mk(body, 1.6), { g, W } = S, Hh = S.H;
      let st = 'idle', fill = 0, wt = 0, bad = Math.floor(Math.random() * 5); const WAIT = 5;
      const b = { x: W / 2 - 80, y: Hh * .8, w: 160, h: Math.min(40, Hh * .15) };
      const tx = i => W * (.18 + i * .16), tubeTop = Hh * .14, tubeH = Hh * .5, tw = Math.min(30, W * .07);
      const pick = i => ({ x: tx(i) - 22, y: tubeTop + tubeH + 10, w: 44, h: Math.min(32, Hh * .13) });
      S.hint('Pulsa "Analizar" para empezar.');
      S.on({ down: p => {
        if (st === 'idle' && hit(p, b)) { st = 'fill'; snd('click'); S.hint('Llenando los tubos…'); return; }
        if (st === 'pick') { const i = [0, 1, 2, 3, 4].find(k => hit(p, pick(k))); if (i == null) return; if (i === bad) { st = 'end'; snd('fixed'); S.hint('Muestra anómala identificada.', 'ok'); S.win(); } else { S.fail('Esa muestra está bien. Fíjate en la roja.'); } }
      } });
      S.loop((dt, t) => {
        bg(g, W, Hh);
        if (st === 'fill') { fill = Math.min(1, fill + dt / 1.6); if (fill >= 1) { st = 'wait'; wt = WAIT; S.hint('Analizando…'); } }
        if (st === 'wait') { wt -= dt; if (wt <= 0) { st = 'pick'; snd('warn'); S.hint('Toca el botón de la muestra anómala (la roja).'); } }
        metal(g, W * .08, tubeTop - 14, W * .84, 12, 6);
        for (let i = 0; i < 5; i++) {
          const x = tx(i), lv = fill * tubeH * .85, red = (st === 'pick' || st === 'end') && i === bad;
          g.fillStyle = 'rgba(200,220,255,.08)'; rr(g, x - tw / 2, tubeTop, tw, tubeH, tw / 2); g.fill();
          g.save(); rr(g, x - tw / 2, tubeTop, tw, tubeH, tw / 2); g.clip();
          g.fillStyle = red ? '#ff3d5e' : '#3fa9ff'; g.fillRect(x - tw / 2, tubeTop + tubeH - lv, tw, lv);
          for (let k = 0; k < 3; k++) { const by = tubeTop + tubeH - ((t * 30 + k * 23 + i * 11) % Math.max(1, lv)); if (lv > 8) { g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.arc(x + Math.sin(t * 3 + k + i) * tw * .2, by, 2.2, 0, TAU); g.fill(); } }
          g.restore(); g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 2; rr(g, x - tw / 2, tubeTop, tw, tubeH, tw / 2); g.stroke();
          if (st === 'pick' || st === 'end') btn(g, pick(i), String(i + 1), { color: red ? '#ff6b81' : '#9fb3d9', size: 14, ink: '#10131c' });
        }
        if (st === 'idle') btn(g, b, 'ANALIZAR', { color: '#3fe0ff' });
        if (st === 'wait') txt(g, `Tiempo restante: ${Math.ceil(wt)} s`, W / 2, Hh * .85, 14, '#ffb547');
      });
      S.cv._solve = async () => { S.tap(b.x + b.w / 2, b.y + b.h / 2); for (let k = 0; k < 1000 && st !== 'pick'; k++) await wait(10); const q = pick(bad); S.tap(q.x + q.w / 2, q.y + q.h / 2); };
    };

    /* 9 · Repostar motor: mantén pulsado hasta llenar el depósito */
    T.fuel = (body) => {
      const S = mk(body, 1.35), { g, W } = S, Hh = S.H;
      let lvl = 0, holding = false, tickT = 0;
      const b = { x: W * .64, y: Hh * .62, w: W * .3, h: Math.min(54, Hh * .22) }, tank = { x: W * .1, y: Hh * .1, w: W * .44, h: Hh * .8 };
      S.hint('Mantén pulsado el botón hasta llenar el depósito.');
      S.on({ down: p => { if (hit(p, b)) { holding = true; buzz(10); } }, up: () => { holding = false; } });
      S.loop((dt, t) => {
        bg(g, W, Hh);
        if (holding && !S.finished) { lvl = Math.min(1, lvl + dt / 3.4); tickT -= dt; if (tickT <= 0) { tickT = .18; snd('pour'); } if (lvl >= 1) { holding = false; snd('fixed'); S.hint('¡Depósito lleno!', 'ok'); S.win(); } }
        metal(g, tank.x - 8, tank.y - 8, tank.w + 16, tank.h + 16, 18);
        g.fillStyle = '#0b0f19'; rr(g, tank.x, tank.y, tank.w, tank.h, 12); g.fill();
        g.save(); rr(g, tank.x, tank.y, tank.w, tank.h, 12); g.clip();
        const top = tank.y + tank.h * (1 - lvl);
        const gr = g.createLinearGradient(0, top, 0, tank.y + tank.h); gr.addColorStop(0, '#ffd23f'); gr.addColorStop(1, '#ff8a1f'); g.fillStyle = gr;
        g.beginPath(); g.moveTo(tank.x, tank.y + tank.h); for (let x = 0; x <= tank.w; x += 6) g.lineTo(tank.x + x, top + Math.sin(t * 5 + x * .08) * (holding ? 4 : 1.5)); g.lineTo(tank.x + tank.w, tank.y + tank.h); g.closePath(); g.fill();
        if (holding) for (let k = 0; k < 5; k++) { g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.arc(tank.x + ((k * 37 + t * 60) % tank.w), tank.y + tank.h - ((t * 80 + k * 41) % Math.max(1, tank.h * lvl)), 2.4, 0, TAU); g.fill(); }
        g.restore();
        for (let k = 1; k < 4; k++) { g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(tank.x + tank.w - 14, tank.y + tank.h * k / 4, 10, 2); }
        txt(g, Math.round(lvl * 100) + '%', tank.x + tank.w / 2, tank.y + tank.h / 2, 22, '#fff');
        lamp(g, b.x + b.w / 2 - 22, Hh * .3, 9, lvl < 1 && !holding, '#ff3d5e'); lamp(g, b.x + b.w / 2 + 22, Hh * .3, 9, lvl >= 1 || holding, '#4ef0b8');
        btn(g, b, holding ? 'LLENANDO' : 'MANTÉN', { color: '#ffb547', down: holding, size: 15 });
      });
      S.cv._solve = async () => { S.touch('pointerdown', b.x + b.w / 2, b.y + b.h / 2); for (let k = 0; k < 600 && !S.finished; k++) await wait(10); S.touch('pointerup', b.x + b.w / 2, b.y + b.h / 2); };
    };

    /* 10 · Alinear motor: sube o baja la palanca hasta que la línea quede centrada */
    T.align = (body) => {
      const S = mk(body, 1.55), { g, W } = S, Hh = S.H;
      const cy = Hh / 2, range = Hh * .38; let off = (Math.random() < .5 ? -1 : 1) * rand(.45, 1), drag = false, locked = false;
      const hx = W * .86, hy = () => cy + off * range;
      S.hint('Arrastra la palanca de la derecha hasta que la línea quede en el centro.');
      S.on({
        down: p => { if (Math.hypot(p.x - hx, p.y - hy()) < 40) { drag = true; snd('click'); } },
        move: p => { if (drag && !locked) off = clamp((p.y - cy) / range, -1, 1); },
        up: () => { if (!drag) return; drag = false; if (Math.abs(off) < .08) { locked = true; off = 0; snd('fixed'); S.hint('Motor alineado.', 'ok'); S.win(); } else S.hint('Todavía no está centrado. Ajusta la palanca.'); }
      });
      S.loop((dt, t) => {
        bg(g, W, Hh);
        const ex = W * .2, ok = Math.abs(off) < .08;
        g.strokeStyle = 'rgba(255,255,255,.18)'; g.setLineDash([5, 6]); g.lineWidth = 2; g.beginPath(); g.moveTo(ex, cy); g.lineTo(W * .78, cy); g.stroke(); g.setLineDash([]);
        const ang = off * .5;
        g.save(); g.translate(ex, cy); g.rotate(ang);
        g.strokeStyle = ok ? '#4ef0b8' : '#ffb547'; g.lineWidth = 3; g.shadowColor = g.strokeStyle; g.shadowBlur = 10; g.beginPath(); g.moveTo(0, 0); g.lineTo(W * .58, 0); g.stroke(); g.shadowBlur = 0;
        metal(g, -46, -26, 92, 52, 14, '#5b6886', '#2c3448'); g.fillStyle = '#1a2030'; for (let k = -2; k <= 2; k++) g.fillRect(k * 14 - 3, -22, 6, 44);
        g.fillStyle = '#ff8a1f'; g.globalAlpha = .6 + Math.sin(t * 20) * .2; g.beginPath(); g.moveTo(-46, -12); g.lineTo(-66 - Math.random() * 8, 0); g.lineTo(-46, 12); g.fill(); g.globalAlpha = 1;
        g.restore();
        g.strokeStyle = '#3a445c'; g.lineWidth = 10; g.lineCap = 'round'; g.beginPath(); g.arc(hx - range * 2.2, cy, range * 2.2, -.42, .42); g.stroke();
        g.strokeStyle = '#4ef0b8'; g.lineWidth = 4; g.beginPath(); g.moveTo(hx - 16, cy); g.lineTo(hx + 16, cy); g.stroke();
        g.fillStyle = drag ? '#ffd27a' : '#ffb547'; g.beginPath(); g.moveTo(hx - 18, hy()); g.lineTo(hx + 14, hy() - 14); g.lineTo(hx + 14, hy() + 14); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 2; g.stroke();
      });
      S.cv._solve = async () => { const y0 = hy(); await S.drag([[hx, y0], [hx, (y0 + cy) / 2], [hx, cy]], 20); };
    };

    /* 11 · Pasar tarjeta: sácala de la cartera y deslízala por el lector a la velocidad justa */
    T.card = (body) => {
      const S = mk(body, 1.75), { g, W } = S, Hh = S.H;
      let st = 'wallet', cx = W * .5, cy = Hh * .78, up = 0, drag = null, msg = 'INTRODUCE LA TARJETA', led = 0, ledT = 0;
      const slotY = Hh * .3, x0 = W * .2, x1 = W * .8, cw = Math.min(120, W * .26), chh = cw * .62;
      S.hint('Toca la cartera para sacar la tarjeta.');
      S.on({
        down: p => {
          if (st === 'wallet' && p.y > Hh * .55) { st = 'rise'; snd('click'); return; }
          if (st === 'ready' && Math.abs(p.x - cx) < cw / 2 + 10 && Math.abs(p.y - cy) < chh / 2 + 14) { drag = { t0: performance.now(), from: cx, dx: p.x - cx }; msg = 'DESLIZA…'; }
        },
        move: p => { if (drag) cx = clamp(p.x - drag.dx, x0, x1); },
        up: () => {
          if (!drag) return; const dt = (performance.now() - drag.t0) / 1000, full = drag.from <= x0 + 6 && cx >= x1 - 6; drag = null;
          if (!full) { msg = 'PASA LA TARJETA ENTERA'; led = -1; snd('err'); }
          else if (dt < .35) { msg = 'DEMASIADO RÁPIDO'; led = -1; snd('err'); buzz(40); }
          else if (dt > 1.6) { msg = 'DEMASIADO LENTO'; led = -1; snd('err'); buzz(40); }
          else { msg = 'ACEPTADA. GRACIAS'; led = 1; snd('fixed'); st = 'end'; S.hint('Tarjeta aceptada.', 'ok'); S.win(); }
          ledT = 1.2; if (st !== 'end') { cx = x0; S.hint('Deslízala de izquierda a derecha, ni muy rápido ni muy lento.'); }
        }
      });
      S.loop((dt, t) => {
        bg(g, W, Hh); ledT = Math.max(0, ledT - dt); if (!ledT && st !== 'end') led = 0;
        if (st === 'rise') { up = Math.min(1, up + dt / .5); cx = lerp(W * .5, x0, ease(up)); cy = lerp(Hh * .78, slotY + chh * .1, ease(up)); if (up >= 1) { st = 'ready'; S.hint('Deslízala de izquierda a derecha, ni muy rápido ni muy lento.'); } }
        metal(g, W * .08, slotY - chh * .55, W * .84, chh * .5, 10, '#46516b', '#2b3246');
        g.fillStyle = '#05070c'; g.fillRect(W * .1, slotY - 6, W * .8, 8);
        g.fillStyle = '#0a1b12'; rr(g, W * .2, Hh * .06, W * .6, Hh * .1, 6); g.fill(); txt(g, msg, W / 2, Hh * .11, Math.min(13, W / 30), led < 0 ? '#ff6b81' : '#4ef0b8');
        lamp(g, W * .86, Hh * .11, 7, led < 0, '#ff3d5e'); lamp(g, W * .92, Hh * .11, 7, led > 0, '#4ef0b8');
        if (st === 'wallet' || st === 'rise') { metal(g, W * .3, Hh * .62, W * .4, Hh * .34, 14, '#6b4a2f', '#3e2a1a'); }
        if (st !== 'wallet') {
          g.save(); g.translate(cx, cy); rr(g, -cw / 2, -chh / 2, cw, chh, 8); const gr = g.createLinearGradient(-cw / 2, 0, cw / 2, 0); gr.addColorStop(0, '#e8eefc'); gr.addColorStop(1, '#b9c6ec'); g.fillStyle = gr; g.fill();
          g.fillStyle = '#3fe0ff'; rr(g, -cw / 2 + 8, -chh / 2 + 8, cw * .28, chh * .4, 4); g.fill(); g.fillStyle = '#ff3d5e'; g.fillRect(-cw / 2, chh * .12, cw, 6);
          g.fillStyle = '#27324d'; g.fillRect(cw * .05, -chh / 2 + 10, cw * .38, 4); g.fillRect(cw * .05, -chh / 2 + 18, cw * .28, 4); g.restore();
        }
        if (st === 'wallet' || st === 'rise') { g.fillStyle = '#5a3d25'; rr(g, W * .3, Hh * .74, W * .4, Hh * .22, 12); g.fill(); txt(g, 'CARTERA', W / 2, Hh * .85, 12, '#d9b892'); }
      });
      S.cv._solve = async () => { S.tap(W / 2, Hh * .8); for (let k = 0; k < 200 && st !== 'ready'; k++) await wait(10); const pts = []; for (let k = 0; k <= 12; k++) pts.push([lerp(x0, x1, k / 12), cy]); await S.drag(pts, 40); };
    };

    /* 12 · Vaciar basura: tira de la palanca hacia abajo y mantenla hasta que caiga todo */
    T.trash = (body) => {
      const S = mk(body, 1.3), { g, W } = S, Hh = S.H;
      const box = { x: W * .12, y: Hh * .08, w: W * .52, h: Hh * .62 }, lx = W * .82, ly0 = Hh * .2, ly1 = Hh * .78;
      const COL = ['#7bc47f', '#c9a36b', '#9fb3d9', '#ff9e6d', '#d8d86b', '#b48cd9'];
      let items = Array.from({ length: 16 }, () => ({ x: rand(box.x + 14, box.x + box.w - 14), y: rand(box.y + box.h * .35, box.y + box.h - 12), r: rand(7, 12), c: COL[Math.floor(Math.random() * COL.length)], vy: 0, a: rand(0, TAU) }));
      let lv = 0, drag = false, open = 0;
      S.hint('Arrastra la palanca hacia abajo y mantenla hasta vaciarlo todo.');
      S.on({ down: p => { if (Math.abs(p.x - lx) < 34 && Math.abs(p.y - lerp(ly0, ly1, lv)) < 34) { drag = true; snd('click'); } }, move: p => { if (drag) lv = clamp((p.y - ly0) / (ly1 - ly0), 0, 1); }, up: () => { drag = false; } });
      S.loop((dt, t) => {
        if (!drag) lv = Math.max(0, lv - dt * 3);
        const want = lv > .9 ? 1 : 0; open = clamp(open + (want ? dt * 3 : -dt * 4), 0, 1);
        if (open > .5 && Math.random() < dt * 8) snd('rumble', { gain: .5 });
        bg(g, W, Hh);
        g.fillStyle = '#0b0f19'; rr(g, box.x, box.y, box.w, box.h, 10); g.fill(); g.strokeStyle = '#5b6886'; g.lineWidth = 4; g.stroke();
        const floor = box.y + box.h;
        items.forEach(it => {
          if (open > .6 || it.y < floor - it.r) { it.vy += 900 * dt; it.y += it.vy * dt; it.a += dt * 3; }
          if (open <= .6 && it.y > floor - it.r && it.y < floor + 4) { it.y = floor - it.r; it.vy = 0; }
          g.save(); g.translate(it.x, it.y); g.rotate(it.a); g.fillStyle = it.c; rr(g, -it.r, -it.r * .7, it.r * 2, it.r * 1.4, 4); g.fill(); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.5; g.stroke(); g.restore();
        });
        items = items.filter(it => it.y < Hh + 30);
        g.fillStyle = '#3a445c'; g.save(); g.translate(box.x, floor); g.rotate(open * 1.2); g.fillRect(0, -5, box.w, 10); g.restore();
        g.fillStyle = '#1b2233'; rr(g, lx - 9, ly0 - 10, 18, ly1 - ly0 + 20, 9); g.fill();
        const hy = lerp(ly0, ly1, lv); g.strokeStyle = '#8a95b3'; g.lineWidth = 8; g.lineCap = 'round'; g.beginPath(); g.moveTo(lx, ly0 - 4); g.lineTo(lx, hy); g.stroke();
        g.fillStyle = drag ? '#ff6b81' : '#ff3d5e'; g.beginPath(); g.arc(lx, hy, 20, 0, TAU); g.fill(); g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 3; g.stroke();
        g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.arc(lx - 6, hy - 6, 6, 0, TAU); g.fill();
        txt(g, `${items.length} restos`, box.x + box.w / 2, Hh * .9, 13, items.length ? '#a9b8dc' : '#4ef0b8');
        if (!items.length && !S.finished) { snd('fixed'); S.hint('¡Vaciado!', 'ok'); S.win(); }
      });
      S.cv._solve = async () => { S.touch('pointerdown', lx, ly0); for (let k = 1; k <= 10; k++) { await wait(16); S.touch('pointermove', lx, lerp(ly0, ly1 + 10, k / 10)); } for (let k = 0; k < 400 && !S.finished; k++) await wait(10); S.touch('pointerup', lx, ly1); };
    };

    /* 13 · Limpiar filtro: arrastra las hojas hasta la rejilla de salida */
    T.leaves = (body) => {
      const S = mk(body, 1.5), { g, W } = S, Hh = S.H;
      const vent = { x: 6, y: Hh * .3, w: W * .13, h: Hh * .4 };
      let leaves = Array.from({ length: 7 }, () => ({ x: rand(W * .4, W * .9), y: rand(Hh * .15, Hh * .85), a: rand(0, TAU), s: rand(.8, 1.2), out: 0, c: ['#6fbf4a', '#a2c93f', '#c9a13f', '#4f9e3a'][Math.floor(Math.random() * 4)] }));
      let drag = null;
      S.hint('Arrastra las hojas hasta la rejilla de la izquierda.');
      S.on({
        down: p => { const l = leaves.filter(q => !q.out).reverse().find(q => Math.hypot(p.x - q.x, p.y - q.y) < 30 * q.s); if (l) { drag = { l, dx: p.x - l.x, dy: p.y - l.y }; snd('click'); } },
        move: p => { if (drag) { drag.l.x = p.x - drag.dx; drag.l.y = p.y - drag.dy; } },
        up: () => { if (!drag) return; const l = drag.l; drag = null; if (l.x < vent.x + vent.w + 10 && l.y > vent.y - 10 && l.y < vent.y + vent.h + 10) { l.out = .001; snd('whoosh'); buzz(10); } }
      });
      const leaf = (l, t) => { g.save(); g.translate(l.x, l.y); g.rotate(l.a + Math.sin(t * 2 + l.a) * .08); g.scale(l.s * (1 - l.out), l.s * (1 - l.out)); g.fillStyle = l.c; g.beginPath(); g.moveTo(-22, 0); g.quadraticCurveTo(0, -16, 22, 0); g.quadraticCurveTo(0, 16, -22, 0); g.fill(); g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-20, 0); g.lineTo(20, 0); g.stroke(); g.restore(); };
      S.loop((dt, t) => {
        bg(g, W, Hh);
        g.fillStyle = 'rgba(255,255,255,.05)'; for (let y = Hh * .1; y < Hh * .9; y += 10) g.fillRect(W * .2, y, W * .75, 1);
        metal(g, vent.x, vent.y, vent.w, vent.h, 8, '#11151f', '#0a0d14');
        for (let k = 0; k < 6; k++) { g.fillStyle = '#2a3144'; g.fillRect(vent.x + 4, vent.y + 8 + k * vent.h / 6.5, vent.w - 8, 4); }
        g.fillStyle = 'rgba(63,224,255,.12)'; for (let k = 0; k < 4; k++) { const x = vent.x + vent.w + ((t * 40 + k * 30) % 60); g.fillRect(x, vent.y + vent.h / 2 - 1 + Math.sin(t * 3 + k) * 8, 14, 2); }
        leaves.forEach(l => { if (l.out) { l.out = Math.min(1, l.out + dt * 3); l.x -= dt * 120; } });
        leaves.filter(l => l.out < 1).forEach(l => leaf(l, t));
        const left = leaves.filter(l => !l.out).length; txt(g, `${left} hojas`, W * .62, Hh * .93, 13, left ? '#a9b8dc' : '#4ef0b8');
        if (!leaves.some(l => l.out < 1) && !S.finished) { snd('fixed'); S.hint('Filtro limpio.', 'ok'); S.win(); }
      });
      S.cv._solve = async () => { for (let n = 0; n < 20; n++) { const l = leaves.filter(q => !q.out).pop(); if (!l) break; await S.drag([[l.x, l.y], [W * .4, l.y], [vent.x + vent.w / 2, vent.y + vent.h / 2]], 14); await wait(30); } };
    };

    /* 14 · Destruir asteroides: toca los asteroides para dispararles antes de que crucen */
    T.asteroids = (body) => {
      const S = mk(body, 1.6), { g, W } = S, Hh = S.H, GOAL = 15;
      const stars = Array.from({ length: 70 }, () => ({ x: rand(0, W), y: rand(0, Hh), r: rand(.5, 1.6), v: rand(8, 30) }));
      let rocks = [], shots = [], boom = [], hits = 0, spawnT = 0, cross = { x: W / 2, y: Hh / 2 };
      S.hint(`Toca los asteroides para destruirlos (${GOAL}).`);
      const mkRock = () => { const r = rand(13, 24), pts = Array.from({ length: 9 }, (_, k) => [Math.cos(k / 9 * TAU) * r * rand(.75, 1.1), Math.sin(k / 9 * TAU) * r * rand(.75, 1.1)]); return { x: W + r, y: rand(r + 10, Hh - r - 10), vx: -rand(50, 95), vy: rand(-18, 18), r, a: 0, va: rand(-2, 2), pts }; };
      S.on({ down: p => {
        cross = { x: p.x, y: p.y }; shots.push({ x: p.x, y: p.y, t: 0 }); snd('click');
        const k = rocks.findIndex(q => Math.hypot(q.x - p.x, q.y - p.y) < q.r + 12);
        if (k >= 0) { const q = rocks.splice(k, 1)[0]; hits++; snd('spark'); buzz(12); for (let i = 0; i < 16; i++) boom.push({ x: q.x, y: q.y, vx: rand(-120, 120), vy: rand(-120, 120), t: 0 }); S.hint(`Destruidos: ${hits}/${GOAL}`); if (hits >= GOAL) { snd('fixed'); S.hint('¡Zona despejada!', 'ok'); S.win(); } }
      } });
      S.loop((dt, t) => {
        g.fillStyle = '#030611'; g.fillRect(0, 0, W, Hh);
        stars.forEach(st => { st.x -= st.v * dt; if (st.x < 0) st.x += W; g.fillStyle = 'rgba(255,255,255,.75)'; g.fillRect(st.x, st.y, st.r, st.r); });
        if (!S.finished && (spawnT -= dt) <= 0) { rocks.push(mkRock()); spawnT = rand(.35, .75); }
        rocks = rocks.filter(q => q.x > -40); rocks.forEach(q => {
          q.x += q.vx * dt; q.y += q.vy * dt; q.a += q.va * dt;
          g.save(); g.translate(q.x, q.y); g.rotate(q.a); g.beginPath(); q.pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath();
          g.fillStyle = '#6b5a4a'; g.fill(); g.strokeStyle = '#a58c72'; g.lineWidth = 2; g.stroke(); g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.arc(q.r * .25, -q.r * .2, q.r * .25, 0, TAU); g.fill(); g.restore();
        });
        shots = shots.filter(s2 => (s2.t += dt) < .14); shots.forEach(s2 => { g.strokeStyle = `rgba(78,240,184,${1 - s2.t / .14})`; g.lineWidth = 3; g.beginPath(); g.moveTo(W / 2, Hh + 4); g.lineTo(s2.x, s2.y); g.stroke(); });
        boom = boom.filter(b => (b.t += dt) < .5); boom.forEach(b => { b.x += b.vx * dt; b.y += b.vy * dt; g.fillStyle = `rgba(255,${180 + Math.random() * 75 | 0},90,${1 - b.t / .5})`; g.fillRect(b.x, b.y, 3, 3); });
        g.strokeStyle = '#4ef0b8'; g.lineWidth = 2; g.beginPath(); g.arc(cross.x, cross.y, 14, 0, TAU); g.moveTo(cross.x - 22, cross.y); g.lineTo(cross.x - 8, cross.y); g.moveTo(cross.x + 8, cross.y); g.lineTo(cross.x + 22, cross.y); g.moveTo(cross.x, cross.y - 22); g.lineTo(cross.x, cross.y - 8); g.moveTo(cross.x, cross.y + 8); g.lineTo(cross.x, cross.y + 22); g.stroke();
        g.fillStyle = 'rgba(0,0,0,.5)'; rr(g, 10, 10, 120, 26, 8); g.fill(); txt(g, `${hits} / ${GOAL}`, 70, 23, 14, '#4ef0b8');
      });
      S.cv._solve = async () => { for (let n = 0; n < 400 && !S.finished; n++) { const q = rocks.find(r => r.x < W - 10 && r.x > 10); if (q) S.tap(q.x + q.vx * .02, q.y); await wait(60); } };
    };

    /* 15 · Activar escudos: toca los hexágonos rojos hasta que el escudo esté completo */
    T.shields = (body) => {
      const S = mk(body, 1.35), { g, W } = S, Hh = S.H, R = Math.min(W, Hh) * .13, cx = W / 2, cy = Hh / 2;
      const cells = [[0, 0]].concat(Array.from({ length: 6 }, (_, k) => [Math.cos(k / 6 * TAU + Math.PI / 6) * R * 1.8, Math.sin(k / 6 * TAU + Math.PI / 6) * R * 1.8])).map(([x, y]) => ({ x: cx + x, y: cy + y, on: Math.random() < .45, pop: 0 }));
      if (cells.every(c => c.on)) cells[2].on = false; if (cells.filter(c => !c.on).length < 3) { cells[4].on = false; cells[6].on = false; }
      const hex = (x, y, r) => { g.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); };
      S.hint('Toca los hexágonos rojos para activar cada sección del escudo.');
      S.on({ down: p => { const c = cells.find(q => Math.hypot(q.x - p.x, q.y - p.y) < R * .95); if (!c || c.on) return; c.on = true; c.pop = .3; snd('note', { f: 520 + cells.filter(q => q.on).length * 60 }); buzz(10); if (cells.every(q => q.on)) { snd('fixed'); S.hint('Escudos activados.', 'ok'); S.win(); } } });
      S.loop((dt, t) => {
        bg(g, W, Hh);
        const lit = cells.filter(c => c.on).length / cells.length;
        g.save(); g.globalAlpha = .25 + lit * .5; g.strokeStyle = '#5aa9ff'; g.lineWidth = 3; g.shadowColor = '#5aa9ff'; g.shadowBlur = 20 * lit; g.beginPath(); g.arc(cx, cy, R * 3.1, 0, TAU); g.stroke(); g.restore();
        cells.forEach(c => {
          c.pop = Math.max(0, c.pop - dt); const r = R * (1 - c.pop * .5);
          hex(c.x, c.y, r); g.fillStyle = c.on ? '#e8f4ff' : '#c4162f'; g.save(); if (c.on) { g.shadowColor = '#5aa9ff'; g.shadowBlur = 18; } else { g.shadowColor = '#ff3d5e'; g.shadowBlur = 10 + Math.sin(t * 6) * 6; } g.fill(); g.restore();
          g.strokeStyle = c.on ? '#5aa9ff' : '#ff8094'; g.lineWidth = 3; g.stroke();
          hex(c.x, c.y, r * .55); g.strokeStyle = c.on ? 'rgba(90,169,255,.6)' : 'rgba(0,0,0,.3)'; g.lineWidth = 2; g.stroke();
        });
      });
      S.cv._solve = async () => { for (const c of cells) if (!c.on) { S.tap(c.x, c.y); await wait(50); } };
    };

    /* Sabotaje de luces: sube las 5 palancas */
    T.switches = (body) => {
      const S = mk(body, 1.8), { g, W } = S, Hh = S.H;
      const st = Array.from({ length: 5 }, () => Math.random() < .5); if (st.every(Boolean)) st[0] = false; if (st.filter(v => !v).length < 2) st[1] = false;
      const anim = st.map(v => v ? 1 : 0), sw = i => ({ x: W * (.12 + i * .18) - 22, y: Hh * .22, w: 44, h: Hh * .56 });
      S.hint('Sube las 5 palancas para restablecer la luz.');
      S.on({ down: p => { const i = [0, 1, 2, 3, 4].find(k => hit(p, sw(k))); if (i == null) return; st[i] = !st[i]; snd('click'); buzz(8); if (st.every(Boolean)) { snd('fixed'); S.win(); } } });
      S.loop(dt => {
        bg(g, W, Hh);
        st.forEach((on, i) => {
          anim[i] = clamp(anim[i] + (on ? dt : -dt) * 8, 0, 1); const b = sw(i);
          metal(g, b.x, b.y, b.w, b.h, 10, '#11151f', '#0a0d14');
          const ky = lerp(b.y + b.h - 26, b.y + 26, ease(anim[i]));
          g.fillStyle = '#6c7896'; g.fillRect(b.x + b.w / 2 - 4, Math.min(ky, b.y + b.h / 2), 8, Math.abs(ky - (b.y + b.h / 2)));
          rr(g, b.x + 4, ky - 14, b.w - 8, 28, 8); g.fillStyle = on ? '#4ef0b8' : '#9aa3bb'; g.fill();
          lamp(g, b.x + b.w / 2, b.y - 12, 7, on, '#4ef0b8');
        });
        const k = st.filter(Boolean).length; g.fillStyle = '#0b0f19'; rr(g, W * .1, Hh * .88, W * .8, 8, 4); g.fill(); g.fillStyle = '#ffd23f'; rr(g, W * .1, Hh * .88, Math.max(8, W * .8 * k / 5), 8, 4); g.fill();
      });
      S.cv._solve = async () => { for (let i = 0; i < 5; i++) if (!st[i]) { const b = sw(i); S.tap(b.x + b.w / 2, b.y + b.h / 2); await wait(40); } };
    };

    /* Teclado de código (comunicaciones y oxígeno): pantalla LED + teclado grande */
    T.code = (body) => {
      const wrap = document.createElement('div'); wrap.className = 'kpad'; body.append(wrap);
      const code = String(Math.floor(10000 + Math.random() * 90000)); let cur = '', fin = false;
      const note = document.createElement('div'); note.className = 'kNote'; note.innerHTML = `<small>CÓDIGO</small><b>${code}</b>`;
      const scr = document.createElement('div'); scr.className = 'kScr'; const pad = document.createElement('div'); pad.className = 'kKeys';
      wrap.append(note, scr, pad);
      const paint = st => { scr.innerHTML = ''; for (let i = 0; i < 5; i++) { const d = document.createElement('span'); d.textContent = cur[i] || ''; scr.append(d); } scr.className = 'kScr' + (st ? ' ' + st : ''); };
      const press = k => {
        if (fin) return; snd('click'); buzz(6);
        if (k === '⌫') cur = cur.slice(0, -1); else if (k === 'C') cur = ''; else if (cur.length < 5) cur += k;
        paint();
        if (cur.length === 5) { if (cur === code) { paint('ok'); snd('fixed'); fin = true; setTimeout(() => body.dispatchEvent(new Event('mgwin')), 350); } else { paint('bad'); snd('err'); buzz([50, 40, 50]); setTimeout(() => { cur = ''; paint(); }, 450); } }
      };
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].forEach(k => { const b = document.createElement('button'); b.textContent = k; b.addEventListener('pointerdown', e => { e.preventDefault(); press(k); }); pad.append(b); });
      paint(); wrap._solve = async () => { for (const c of code) { press(c); await wait(30); } };
    };

    // Adaptador: el juego llama MG[tipo](body, done)
    const MG = {};
    Object.keys(T).forEach(k => { MG[k] = (body, done) => {   // cada minijuego vive en su propia caja: al cerrarlo se va con ella y no deja escuchas colgando
      const box = document.createElement('div'); box.className = 'mgBox'; body.append(box);
      box.addEventListener('mgwin', () => done(), { once: true }); T[k](box);
    }; });
    return MG;
  }

  root.Tasks = { create };
})(typeof window !== 'undefined' ? window : this);
