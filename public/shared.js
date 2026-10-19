// Mapa y reglas compartidas entre servidor y cliente
(function (root) {
  // El mapa se define con polígonos en metros (como The Skeld, con paredes en diagonal). CELL es la rejilla gruesa
  // que usan los bots para buscar caminos; las colisiones y la vista usan una rejilla fina de 25 cm.
  const MAPW = 188, MAPH = 122, CELL = 2, W = MAPW / CELL, H = Math.ceil(MAPH / CELL), WALL_H = 3, TASKS_PER = 4, TABLE_R = 1.8;

  const COLORS = [   // los colores de Among Us
    ['Rojo', '#c51111'], ['Azul', '#132ed1'], ['Verde', '#117f2d'], ['Rosa', '#ed54ba'], ['Naranja', '#ef7d0d'], ['Amarillo', '#f5f557'],
    ['Negro', '#3f474e'], ['Blanco', '#d6e0f0'], ['Morado', '#6b2fbb'], ['Marrón', '#71491e'], ['Cian', '#38fedc'], ['Lima', '#50ef39']
  ];

  // The Skeld visto desde arriba. Salas (polígonos en metros, x a la derecha y z hacia abajo) y pasillos (rectángulos).
  // Donde un pasillo toca una sala queda una puerta; el resto de los bordes son paredes.
  const ROOMS = [
    { id: 'cafeteria',      name: 'Cafetería',      poly: [[84, 4], [100, 4], [108, 12], [108, 28], [100, 36], [84, 36], [76, 28], [76, 12]] },
    { id: 'motores',        name: 'Motor superior', poly: [[8, 8], [30, 8], [30, 36], [14, 36], [8, 30]] },
    { id: 'enfermeria',     name: 'Enfermería',     poly: [[44, 26], [62, 26], [62, 40], [58, 44], [44, 44]] },
    { id: 'seguridad',      name: 'Seguridad',      poly: [[30, 50], [44, 50], [44, 62], [40, 66], [30, 66]] },
    { id: 'reactor',        name: 'Reactor',        poly: [[6, 42], [20, 42], [20, 78], [6, 78], [2, 72], [2, 48]] },
    { id: 'motorinf',       name: 'Motor inferior', poly: [[14, 84], [30, 84], [30, 112], [8, 112], [8, 90]] },
    { id: 'electrica',      name: 'Eléctrica',      poly: [[46, 76], [64, 76], [64, 94], [46, 94]] },
    { id: 'almacen',        name: 'Almacén',        poly: [[70, 72], [100, 72], [100, 104], [92, 112], [70, 112]] },
    { id: 'administracion', name: 'Administración', poly: [[104, 50], [122, 50], [126, 54], [126, 72], [104, 72]] },
    { id: 'comunicaciones', name: 'Comunicaciones', poly: [[112, 103], [130, 103], [130, 118], [112, 118]] },
    { id: 'escudos',        name: 'Escudos',        poly: [[150, 82], [168, 82], [172, 86], [172, 104], [166, 110], [150, 110]] },
    { id: 'navegacion',     name: 'Navegación',     poly: [[156, 40], [172, 40], [184, 50], [184, 58], [172, 68], [156, 68]] },
    { id: 'oxigeno',        name: 'Oxígeno',        poly: [[112, 35], [130, 35], [130, 45], [112, 45]] },
    { id: 'armeria',        name: 'Armería',        poly: [[122, 4], [140, 4], [146, 10], [146, 30], [122, 30]] }
  ];
  const rect = (x, z, w, h) => [[x, z], [x + w, z], [x + w, z + h], [x, z + h]];
  const CORRIDORS = [
    [30, 15, 46, 6],    // motor superior → cafetería
    [48, 21, 6, 5],     // entrada de la enfermería
    [22, 36, 6, 48],    // pasillo oeste: motor superior → motor inferior
    [20, 56, 2, 8],     // entrada del reactor
    [28, 54, 2, 8],     // entrada de seguridad
    [30, 99, 40, 6],    // pasillo sur: motor inferior → almacén
    [52, 94, 6, 5],     // entrada de eléctrica
    [89, 36, 6, 36],    // cafetería → almacén
    [95, 58, 9, 6],     // entrada de administración
    [108, 14, 14, 6],   // cafetería → armería
    [134, 30, 6, 27],   // armería → navegación
    [140, 51, 16, 6],
    [130, 38, 4, 6],    // entrada de oxígeno
    [100, 92, 50, 6],   // almacén → escudos
    [118, 98, 6, 5],    // entrada de comunicaciones
    [158, 68, 6, 14]    // navegación → escudos
  ].map(r => rect(r[0], r[1], r[2], r[3]));
  const POLYS = ROOMS.map(r => ({ room: r.id, pts: r.poly })).concat(CORRIDORS.map(pts => ({ room: null, pts })));
  const inPoly = (x, z, pts) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, zi] = pts[i], [xj, zj] = pts[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
  POLYS.forEach(p => { const xs = p.pts.map(q => q[0]), zs = p.pts.map(q => q[1]); p.box = [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)]; });
  ROOMS.forEach(r => {   // centro de la sala (para el nombre en el mapa y el panel de administración)
    let a = 0, cx = 0, cz = 0; const P = r.poly; for (let i = 0; i < P.length; i++) { const [x0, z0] = P[i], [x1, z1] = P[(i + 1) % P.length], k = x0 * z1 - x1 * z0; a += k; cx += (x0 + x1) * k; cz += (z0 + z1) * k; }
    r.c = [cx / (3 * a), cz / (3 * a)];
  });
  // rejilla fina: 1 = suelo
  const RES = 0.25, RW = Math.round(MAPW / RES), RH = Math.round(MAPH / RES), floor = new Uint8Array(RW * RH), roomIx = new Uint8Array(RW * RH);
  POLYS.forEach(p => { const ri = p.room ? ROOMS.findIndex(r => r.id === p.room) + 1 : 0;
    for (let j = Math.floor(p.box[1] / RES); j < Math.ceil(p.box[3] / RES); j++) for (let i = Math.floor(p.box[0] / RES); i < Math.ceil(p.box[2] / RES); i++) {
      if (i < 0 || j < 0 || i >= RW || j >= RH) continue; if (inPoly((i + .5) * RES, (j + .5) * RES, p.pts)) { floor[j * RW + i] = 1; if (ri) roomIx[j * RW + i] = ri; } } });
  const isFloor = (x, z) => { const i = Math.floor(x / RES), j = Math.floor(z / RES); return i >= 0 && j >= 0 && i < RW && j < RH && floor[j * RW + i] === 1; };
  const roomAtPos = (x, z) => { const i = Math.floor(x / RES), j = Math.floor(z / RES); if (i < 0 || j < 0 || i >= RW || j >= RH) return undefined; const k = roomIx[j * RW + i]; return k ? ROOMS[k - 1] : undefined; };
  const roomAt = (i, j) => roomAtPos((i + .5) * CELL, (j + .5) * CELL);
  const grid = Array.from({ length: H }, (_, j) => Array.from({ length: W }, (_, i) => !isFloor((i + .5) * CELL, (j + .5) * CELL)));
  // paredes y puertas: cada borde de polígono menos los tramos que comparte con otro polígono
  const WALLS = [], DOORS = {}; ROOMS.forEach(r => { DOORS[r.id] = []; });
  POLYS.forEach((p, pi) => {
    const P = p.pts;
    for (let e = 0; e < P.length; e++) {
      const a = P[e], b = P[(e + 1) % P.length], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz, L = Math.sqrt(L2), cut = [];
      POLYS.forEach((q, qi) => { if (qi === pi) return; const Q = q.pts;
        for (let f = 0; f < Q.length; f++) { const c = Q[f], d = Q[(f + 1) % Q.length];
          if (Math.abs(dx * (c[1] - a[1]) - dz * (c[0] - a[0])) > 1e-6 || Math.abs(dx * (d[1] - a[1]) - dz * (d[0] - a[0])) > 1e-6) continue;
          const t0 = ((c[0] - a[0]) * dx + (c[1] - a[1]) * dz) / L2, t1 = ((d[0] - a[0]) * dx + (d[1] - a[1]) * dz) / L2, lo = Math.max(0, Math.min(t0, t1)), hi = Math.min(1, Math.max(t0, t1));
          if (hi - lo > 1e-6) { cut.push([lo, hi]); if (p.room && q.room !== p.room) DOORS[p.room].push([a[0] + dx * lo, a[1] + dz * lo, a[0] + dx * hi, a[1] + dz * hi]); } } });
      cut.sort((u, v) => u[0] - v[0]); let t = 0; const pieces = [];
      for (const [lo, hi] of cut) { if (lo > t + 1e-6) pieces.push([t, lo]); t = Math.max(t, hi); } if (t < 1 - 1e-6) pieces.push([t, 1]);
      let nx = dz / L, nz = -dx / L; const mx = a[0] + dx / 2, mz = a[1] + dz / 2; if (inPoly(mx + nx * .1, mz + nz * .1, P)) { nx = -nx; nz = -nz; }   // normal hacia fuera (la pared)
      pieces.forEach(([lo, hi]) => WALLS.push({ a: [a[0] + dx * lo, a[1] + dz * lo], b: [a[0] + dx * hi, a[1] + dz * hi], n: [nx, nz], room: p.room }));
    }
  });

  // [nombre, sala, x, z (metros), minijuego (public/tasks.js), cadena, paso]. Las tareas con cadena van por pasos, como en el
  // original: primero descargas los datos y luego los subes. Si un paso tiene varias consolas, a cada uno le toca una.
  const STATIONS = [
    ['Conectar cables',        'electrica',      60, 77,  'wires'],
    ['Calibrar distribuidor',  'electrica',      49, 77,  'calibrate'],
    ['Descargar datos',        'comunicaciones', 127, 115, 'download', 'datos', 0],
    ['Trazar rumbo',           'navegacion',     181, 54, 'course'],
    ['Iniciar reactor',        'reactor',        8,  70,  'simon'],
    ['Desbloquear colectores', 'reactor',        8,  46,  'manifolds'],
    ['Escáner médico',         'enfermeria',     52, 40,  'scan'],
    ['Analizar muestra',       'enfermeria',     46, 36,  'samples'],
    ['Repostar motor inferior', 'motorinf',      12, 92,  'fuel', 'combustible', 2],
    ['Alinear motor',          'motores',        26, 12,  'align'],
    ['Pasar tarjeta',          'administracion', 123, 60, 'card'],
    ['Vaciar basura',          'almacen',        90, 108, 'trash'],
    ['Limpiar filtro',         'oxigeno',        114, 37, 'leaves'],
    ['Destruir asteroides',    'armeria',        136, 8,  'asteroids'],
    ['Activar escudos',        'escudos',        169, 95, 'shields'],
    ['Subir datos',            'administracion', 107, 53, 'upload', 'datos', 1],
    ['Descargar datos',        'cafeteria',      92, 6.5, 'download', 'datos', 0],
    ['Descargar datos',        'armeria',        125, 27, 'download', 'datos', 0],
    ['Descargar datos',        'navegacion',     159, 43, 'download', 'datos', 0],
    ['Llenar bidón',           'almacen',        74, 108, 'fillcan', 'combustible', 0],
    ['Repostar motor superior', 'motores',       12, 28,  'fuel', 'combustible', 1],
    ['Desviar energía',        'electrica',      62, 84,  'divert', 'energia', 0],
    ['Aceptar energía',        'navegacion',     175, 62, 'accept', 'energia', 1],
    ['Aceptar energía',        'escudos',        155, 107, 'accept', 'energia', 1],
    ['Aceptar energía',        'oxigeno',        115, 43, 'accept', 'energia', 1],
    ['Aceptar energía',        'seguridad',      42, 55,  'accept', 'energia', 1]
  ].map((s, id) => ({ id, name: s[0], room: s[1], x: s[2], z: s[3], type: s[4], chain: s[5] || null, step: s[6] || 0 }));
  // Tareas que se reparten: cada una es una lista de pasos y cada paso una lista de consolas posibles
  const CHAINS = {};
  STATIONS.forEach(s => { if (!s.chain) return; const c = CHAINS[s.chain] || (CHAINS[s.chain] = []); (c[s.step] || (c[s.step] = [])).push(s.id); });
  const TASK_UNITS = STATIONS.filter(s => !s.chain).map(s => [[s.id]]).concat(Object.values(CHAINS));
  const pickUnit = u => u.map(opts => opts[Math.floor(Math.random() * opts.length)]);
  // Paso anterior de cada consola dentro de las tareas de un jugador (hay que hacerlo antes): { id: idAnterior }
  const taskPrev = ids => {
    const prev = {};
    ids.forEach(id => { const s = STATIONS[id]; if (!s || !s.chain || !s.step) return; const p = ids.find(q => STATIONS[q] && STATIONS[q].chain === s.chain && STATIONS[q].step === s.step - 1); if (p != null) prev[id] = p; });
    return prev;
  };

  const cellPos = o => ({ x: o.x, z: o.z });
  // Paneles donde la tripulación arregla los sabotajes
  const PANELS = [
    { id: 'luces',    name: 'Panel de luces',            room: 'electrica',      x: 48,  z: 91 },
    { id: 'coms',     name: 'Panel de comunicaciones',   room: 'comunicaciones', x: 114, z: 115 },
    { id: 'reactorA', name: 'Control del reactor',       room: 'reactor',        x: 14,  z: 45 },
    { id: 'reactorB', name: 'Control del reactor',       room: 'reactor',        x: 14,  z: 75 },
    { id: 'o2a',      name: 'Depurador de oxígeno',      room: 'oxigeno',        x: 127, z: 37 },
    { id: 'o2b',      name: 'Depurador de oxígeno',      room: 'administracion', x: 108, z: 70 }
  ];
  PANELS.forEach(p => { p.type = p.id === 'luces' ? 'switches' : p.id.startsWith('reactor') ? 'holdPanel' : 'code'; });
  // Terminales de información (las puede usar cualquier jugador vivo; las desactiva el sabotaje de comunicaciones salvo los signos vitales)
  const INFO = [
    { id: 'cams',    name: 'Cámaras de seguridad',    short: 'Cámaras', room: 'seguridad',      x: 40,  z: 52 },
    { id: 'admin',   name: 'Panel de administración', short: 'Admin',   room: 'administracion', x: 115, z: 62 },
    { id: 'vitals',  name: 'Signos vitales',          short: 'Vitales', room: 'enfermeria',     x: 59,  z: 40.5 },
    { id: 'doorlog', name: 'Registro de puertas',     short: 'Puertas', room: 'electrica',      x: 60,  z: 91 }
  ];
  // Cámaras de seguridad: posición en la pared (x, altura, z) y centro de lo que se ve
  const CAMERAS = [
    { id: 0, name: 'Pasillo de motores',    pos: [25, 2.6, 36.6],  look: [26, 1.0, 60] },
    { id: 1, name: 'Pasillo sur',           pos: [44, 2.6, 99.6],  look: [48, 1.0, 102] },
    { id: 2, name: 'Pasillo de Admin',      pos: [92, 2.6, 36.6],  look: [94, 1.0, 58] },
    { id: 3, name: 'Pasillo de Navegación', pos: [137, 2.6, 30.6], look: [142, 1.0, 48] }
  ];
  // Red de ventilaciones (solo las usa el impostor), como en The Skeld
  const VENTS = [
    { id: 0,  room: 'reactor',        x: 17,  z: 48,  links: [1] },
    { id: 1,  room: 'motores',        x: 26,  z: 32,  links: [0] },
    { id: 2,  room: 'reactor',        x: 17,  z: 72,  links: [3] },
    { id: 3,  room: 'motorinf',       x: 26,  z: 88,  links: [2] },
    { id: 4,  room: 'enfermeria',     x: 46,  z: 30,  links: [5, 6] },
    { id: 5,  room: 'seguridad',      x: 40,  z: 60,  links: [4, 6] },
    { id: 6,  room: 'electrica',      x: 49,  z: 84,  links: [4, 5] },
    { id: 7,  room: 'cafeteria',      x: 105, z: 22,  links: [8, 9] },
    { id: 8,  room: 'administracion', x: 122, z: 69,  links: [7, 9] },
    { id: 9,  room: null,             x: 137, z: 44,  links: [7, 8] },
    { id: 10, room: 'armeria',        x: 143, z: 18,  links: [11] },
    { id: 11, room: 'navegacion',     x: 169, z: 46,  links: [10] },
    { id: 12, room: 'navegacion',     x: 164, z: 63,  links: [13] },
    { id: 13, room: 'escudos',        x: 163, z: 106, links: [12] }
  ];
  // puertas cerradas por sabotaje: tramos de puerta de la sala elegida
  let closedDoors = [];
  const setDoors = roomId => { closedDoors = roomId && DOORS[roomId] ? DOORS[roomId] : []; };
  const segDist = (x, z, s) => { const dx = s[2] - s[0], dz = s[3] - s[1], L2 = dx * dx + dz * dz, t = Math.max(0, Math.min(1, ((x - s[0]) * dx + (z - s[1]) * dz) / L2)); return Math.hypot(x - s[0] - dx * t, z - s[1] - dz * t); };
  const isClosedCell = (x, z) => closedDoors.length > 0 && closedDoors.some(s => segDist(x, z, s) < .35);

  const stationPos = st => ({ x: st.x, z: st.z });
  // Decoración con volumen (no se puede atravesar), x, z en metros. Choque: r = círculo, w/h = rectángulo, len = motor (rectángulo len x 2r).
  // El cliente dibuja cada tipo. Las salas van llenas como en The Skeld: mesas, motores, reactor, camas, cajas, plantas...
  const DECOR = [
    { kind: 'table',     room: 'cafeteria',      x: 84,  z: 12,  r: 2.6 },
    { kind: 'table',     room: 'cafeteria',      x: 100, z: 12,  r: 2.6 },
    { kind: 'table',     room: 'cafeteria',      x: 84,  z: 28,  r: 2.6 },
    { kind: 'table',     room: 'cafeteria',      x: 100, z: 28,  r: 2.6 },
    { kind: 'engine',    room: 'motores',        x: 17,  z: 22,  r: 3.4, len: 12 },
    { kind: 'cans',      room: 'motores',        x: 12,  z: 11.5, r: 1 },
    { kind: 'engine',    room: 'motorinf',       x: 17,  z: 98,  r: 3.4, len: 12 },
    { kind: 'cans',      room: 'motorinf',       x: 13,  z: 108, r: 1 },
    { kind: 'core',      room: 'reactor',        x: 9,   z: 60,  r: 3 },
    { kind: 'desk',      room: 'seguridad',      x: 35,  z: 51,  w: 4, h: 1.6 },
    { kind: 'chair',     room: 'seguridad',      x: 36,  z: 54,  r: .8 },
    { kind: 'rack',      room: 'seguridad',      x: 32,  z: 64,  w: 2.4, h: 1.8 },
    { kind: 'bed',       room: 'enfermeria',     x: 58,  z: 28.6, w: 3, h: 1.5 },
    { kind: 'bed',       room: 'enfermeria',     x: 58,  z: 33.6, w: 3, h: 1.5 },
    { kind: 'gen',       room: 'electrica',      x: 55,  z: 78,  w: 3, h: 1.6 },
    { kind: 'rack',      room: 'electrica',      x: 63,  z: 90.5, w: 1.6, h: 2.4 },
    { kind: 'cratepile', room: 'almacen',        x: 84,  z: 88,  w: 6, h: 4.4 },
    { kind: 'crates',    room: 'almacen',        x: 76,  z: 95,  r: 1.5 },
    { kind: 'barrel',    room: 'almacen',        x: 74,  z: 76,  r: 1 },
    { kind: 'barrel',    room: 'almacen',        x: 97,  z: 80,  r: 1 },
    { kind: 'cans',      room: 'almacen',        x: 81,  z: 108, r: .9 },
    { kind: 'sofa',      room: 'administracion', x: 113, z: 70.6, w: 4, h: 1.4 },
    { kind: 'plant',     room: 'administracion', x: 119, z: 52.4, r: .8 },
    { kind: 'plant',     room: 'administracion', x: 105.6, z: 67, r: .8 },
    { kind: 'desk',      room: 'comunicaciones', x: 121, z: 116.4, w: 2.8, h: 1.4 },
    { kind: 'radio',     room: 'comunicaciones', x: 128, z: 106, w: 2, h: 2.4 },
    { kind: 'shieldgen', room: 'escudos',        x: 160, z: 96,  r: 2 },
    { kind: 'crates',    room: 'escudos',        x: 154, z: 86,  r: 1.1 },
    { kind: 'barrel',    room: 'escudos',        x: 167, z: 89,  r: .9 },
    { kind: 'chair',     room: 'navegacion',     x: 176, z: 50.5, r: 1.1, rot: -Math.PI / 2 },
    { kind: 'chair',     room: 'navegacion',     x: 176, z: 57.5, r: 1.1, rot: -Math.PI / 2 },
    { kind: 'console',   room: 'navegacion',     x: 165, z: 41.6, w: 4, h: 1.4 },
    { kind: 'console',   room: 'navegacion',     x: 169, z: 64.6, w: 4, h: 1.4 },
    { kind: 'plant',     room: 'oxigeno',        x: 121, z: 40,  r: 1.4, big: 1 },
    { kind: 'tank',      room: 'oxigeno',        x: 126, z: 43,  r: .8, o2: 1 },
    { kind: 'turret',    room: 'armeria',        x: 131, z: 12,  r: 2 },
    { kind: 'crates',    room: 'armeria',        x: 143, z: 27,  r: 1.2 },
    { kind: 'rack',      room: 'armeria',        x: 124, z: 8,   w: 1.6, h: 2.6 }
  ];
  const BUTTON = { x: 92, z: 20 }; // mesa de la cafetería

  const isSolid = (x, z) => !isFloor(x, z);
  const blocked = (x, z, r) => {
    r = r || 0.45;
    if (isSolid(x - r, z - r) || isSolid(x + r, z - r) || isSolid(x - r, z + r) || isSolid(x + r, z + r) || isSolid(x, z - r) || isSolid(x, z + r) || isSolid(x - r, z) || isSolid(x + r, z)) return true;
    let dx = x - BUTTON.x, dz = z - BUTTON.z;
    if (dx * dx + dz * dz < (TABLE_R + r) * (TABLE_R + r)) return true;
    for (const st of STATIONS) {
      const p = stationPos(st); dx = x - p.x; dz = z - p.z;
      if (dx * dx + dz * dz < (0.8 + r) * (0.8 + r)) return true;
    }
    for (const pn of PANELS.concat(INFO)) {
      const p = cellPos(pn); dx = x - p.x; dz = z - p.z;
      if (dx * dx + dz * dz < (0.8 + r) * (0.8 + r)) return true;
    }
    for (const d of DECOR) {
      if (d.len) {   // cilindro tumbado a lo largo del eje x (motores)
        if (Math.abs(x - d.x) < d.len / 2 + r && Math.abs(z - d.z) < d.r + r) return true;
      } else if (d.w) {
        if (Math.abs(x - d.x) < d.w / 2 + r && Math.abs(z - d.z) < d.h / 2 + r) return true;
      } else { dx = x - d.x; dz = z - d.z; if (dx * dx + dz * dz < (d.r + r) * (d.r + r)) return true; }
    }
    if (closedDoors.length && (isClosedCell(x - r, z - r) || isClosedCell(x + r, z - r) || isClosedCell(x - r, z + r) || isClosedCell(x + r, z + r) || isClosedCell(x, z))) return true;
    return false;
  };
  const spawnPos = (i, n) => {
    const a = (i / n) * Math.PI * 2;
    const x = BUTTON.x + Math.cos(a) * 5, z = BUTTON.z + Math.sin(a) * 5;
    return { x, z, ry: Math.atan2(BUTTON.x - x, BUTTON.z - z) };
  };

  // ---- apariencia de los personajes ----
  const SKINS = ['#f6d7b8', '#efc29b', '#e0a97d', '#c68863', '#a86b44', '#7d4a2b', '#5a3520', '#3b2416'];
  const HAIR_COLORS = ['#1a1a1a', '#3b2a1a', '#6b4423', '#a0522d', '#d9a441', '#e8d28a', '#b0b0b0', '#c0392b', '#2e6bd6', '#8e44ad'];
  const CLOTHES = ['#e53935', '#1e88e5', '#43a047', '#fdd835', '#fb8c00', '#8e24aa', '#ec407a', '#00acc1', '#6d4c41', '#eceff1', '#263238', '#9e9e9e'];
  const OPT = {
    hair: ['Calvo', 'Corto', 'Pinchos', 'Largo', 'Moño', 'Cresta', 'Rizos', 'Rapado', 'Media melena'],
    beard: ['Sin barba', 'Barba corta', 'Barba', 'Bigote', 'Perilla'],
    glasses: ['Sin gafas', 'Redondas', 'Cuadradas', 'De sol'],
    hat: ['Nada', 'Gorra', 'Gorro', 'Cinta', 'Gorra hacia atrás', 'Sombrero vaquero', 'Sombrero de copa', 'Gorro de fiesta', 'Corona', 'Boina', 'Auriculares', 'Casco vikingo', 'Gorro de pescador', 'Halo'],
    top: ['Camiseta', 'Sudadera con capucha', 'Chaqueta y corbata', 'Polo', 'Camisa de cuadros', 'Camiseta de tirantes'],
    kit: ['Ninguna', 'Real Madrid', 'FC Barcelona', 'Atlético de Madrid', 'España', 'Portero'],
    build: ['Delgado', 'Normal', 'Corpulento', 'Atlético'],
    brows: ['Normales', 'Finas', 'Gruesas'],
    sleeve: ['Larga', 'Corta'],
    pants: ['Largo', 'Corto'],
    acc: ['Nada', 'Bandolera', 'Bufanda', 'Cadena de oro', 'Capa', 'Pajarita'],
    pet: ['Ninguna', 'Perrito', 'Gatito', 'Robot', 'Minitripulante', 'Pollito', 'Dron']
  };
  const LOOK_SIZES = { col: 12, s: SKINS.length, h: OPT.hair.length, hc: HAIR_COLORS.length, b: OPT.beard.length, g: OPT.glasses.length, t: OPT.hat.length, tc: CLOTHES.length, sh: CLOTHES.length, pa: CLOTHES.length, bd: OPT.build.length, ej: OPT.brows.length, hv: 4, hr: 2, ss: 2, mo: 2, ml: OPT.sleeve.length, pl: OPT.pants.length, ac: OPT.acc.length, tp: OPT.top.length, kit: OPT.kit.length, num: 100, nn: 2, pet: OPT.pet.length };
  // Equipaciones (colores de cada club, sin escudos): camiseta, raya, rayas verticales, ribete, mangas, pantalón, medias y color del dorsal
  const KITS = [null,
    { shirt: '#f4f4f2', alt: null,      trim: '#c9a227', sleeve: '#f4f4f2', shorts: '#f4f4f2', socks: '#f4f4f2', num: '#1b2a5b', edge: '#c9a227', boots: '#111111' },
    { shirt: '#a50044', alt: '#004d98', trim: '#edbb00', sleeve: '#a50044', shorts: '#0b2d6b', socks: '#0b2d6b', num: '#edbb00', edge: '#0b2d6b', boots: '#f2f2f2' },
    { shirt: '#cb3524', alt: '#ffffff', trim: '#1d3a8a', sleeve: '#cb3524', shorts: '#1d3a8a', socks: '#cb3524', num: '#1d3a8a', edge: '#ffffff', boots: '#111111' },
    { shirt: '#c60b1e', alt: null,      trim: '#ffc400', sleeve: '#c60b1e', shorts: '#0d1e4a', socks: '#0d1e4a', num: '#ffc400', edge: '#0d1e4a', boots: '#ffc400' },
    { shirt: '#c8ff2e', alt: null,      trim: '#111111', sleeve: '#c8ff2e', shorts: '#111111', socks: '#c8ff2e', num: '#111111', edge: '#ffffff', boots: '#ff4f00' }
  ];
  const HEX = /^#[0-9a-fA-F]{6}$/, FACE_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, FACE_PATH = /^faces\/[a-z0-9_-]{1,24}\.(jpg|png)$/;
  const COLOR_KEYS = ['cs', 'ch', 'ct', 'csh', 'cp', 'cz', 'cl']; // colores libres (anulan la paleta)
  const randomLook = () => {
    const r = n => Math.floor(Math.random() * n), o = {};
    for (const k in LOOK_SIZES) o[k] = r(LOOK_SIZES[k]);
    o.b = Math.random() < 0.55 ? 0 : r(LOOK_SIZES.b);
    o.g = Math.random() < 0.65 ? 0 : 1 + r(3);
    o.t = Math.random() < 0.7 ? 0 : 1 + r(3);
    o.ht = 155 + r(41); o.hv = 0; o.hr = 0; o.ss = 0; o.mo = 0;
    o.ml = Math.random() < 0.7 ? 0 : 1; o.pl = Math.random() < 0.8 ? 0 : 1; o.ac = Math.random() < 0.8 ? 0 : 1 + r(OPT.acc.length - 1);
    o.t = Math.random() < 0.65 ? 0 : 1 + r(OPT.hat.length - 1); o.tp = Math.random() < 0.55 ? 0 : r(OPT.top.length);
    o.pet = Math.random() < 0.7 ? 0 : 1 + r(OPT.pet.length - 1); o.kit = Math.random() < 0.82 ? 0 : 1 + r(OPT.kit.length - 1); o.num = o.kit ? 1 + r(23) : 0; o.nn = 0;
    return o;
  };
  const cleanLook = l => {
    if (!l || typeof l !== 'object') return randomLook();
    const o = {};
    for (const k in LOOK_SIZES) { const v = l[k]; o[k] = Number.isInteger(v) && v >= 0 && v < LOOK_SIZES[k] ? v : 0; }
    o.ht = Number.isFinite(+l.ht) ? Math.max(140, Math.min(210, Math.round(+l.ht))) : 175;
    for (const k of COLOR_KEYS) if (typeof l[k] === 'string' && HEX.test(l[k])) o[k] = l[k].toLowerCase();
    if (typeof l.fh === 'string' && FACE_PATH.test(l.fh)) o.fh = l.fh;
    if (typeof l.f === 'string' && l.f.length <= 90000 && (FACE_RE.test(l.f) || FACE_PATH.test(l.f))) { o.f = l.f; if (l.am) o.am = 1; }   // am = textura esférica (invitados con fotos)
    return o;
  };
  const colors = l => ({ shoes: l.cz || '#1b1b20', skin: l.cs || SKINS[l.s], hair: l.ch || HAIR_COLORS[l.hc], hat: l.ct || CLOTHES[l.tc], shirt: l.csh || CLOTHES[l.sh], pants: l.cp || CLOTHES[l.pa] });


  // ---- ajustes de la partida (los configura el anfitrión en la sala, como en Among Us) ----
  const num = (g, k, label, min, max, step, def, unit, hint) => ({ g, k, label, t: 'num', min, max, step, def, unit: unit || '', hint: hint || '' });
  const bool = (g, k, label, def, hint) => ({ g, k, label, t: 'bool', def, hint: hint || '' });
  const sel = (g, k, label, opts, def, hint) => ({ g, k, label, t: 'sel', opts, def, hint: hint || '' });
  const SETTINGS = [
    num('Partida', 'impostors', 'Impostores', 1, 3, 1, 1, '', 'Como máximo, menos de la mitad de los jugadores'),
    num('Partida', 'killCd', 'Enfriamiento de matar', 5, 60, 5, 20, ' s'),
    bool('Partida', 'infoTools', 'Terminales de información', true, 'Cámaras, panel de administración, signos vitales y registro de puertas'),
    sel('Partida', 'killRange', 'Distancia de matar', [['corta', 'Corta'], ['media', 'Media'], ['larga', 'Larga']], 'media'),
    num('Jugadores', 'speed', 'Velocidad de movimiento', 0.5, 3, 0.25, 1, '×'),
    num('Jugadores', 'visCrew', 'Visión de la tripulación', 0.25, 3, 0.25, 1, '×'),
    num('Jugadores', 'visImp', 'Visión del impostor', 0.25, 3, 0.25, 1.25, '×'),
    num('Reuniones', 'emergencies', 'Reuniones de emergencia por jugador', 0, 9, 1, 1),
    num('Reuniones', 'emergencyCd', 'Enfriamiento del botón de emergencia', 0, 60, 5, 10, ' s', 'Tras empezar y tras cada reunión'),
    num('Reuniones', 'discuss', 'Tiempo de discusión', 0, 120, 5, 15, ' s', 'Solo se puede hablar; con 0 se vota directamente'),
    num('Reuniones', 'voteTime', 'Tiempo de votación', 10, 300, 5, 60, ' s'),
    bool('Reuniones', 'confirmEjects', 'Confirmar expulsiones', true, 'Revela si el expulsado era impostor'),
    bool('Reuniones', 'anonVotes', 'Votos anónimos', false, 'Solo se ve cuántos votos recibió cada uno'),
    num('Tareas', 'tasksPer', 'Tareas por tripulante', 1, 8, 1, 4),
    num('Tareas', 'commonTasks', 'Tareas comunes', 0, 2, 1, 1, '', 'Las mismas para todos los tripulantes'),
    bool('Tareas', 'visualTasks', 'Tareas visuales', true, 'Los demás ven el escáner médico, los asteroides, la basura y los escudos: hacerlas delante de alguien demuestra que eres inocente'),
    sel('Tareas', 'taskbar', 'Barra de progreso de tareas', [['siempre', 'Siempre'], ['reuniones', 'Solo tras las reuniones'], ['nunca', 'Nunca']], 'siempre'),
    num('Sabotajes', 'sabCd', 'Enfriamiento de sabotajes', 5, 60, 5, 30, ' s'),
    num('Sabotajes', 'reactorTime', 'Tiempo para arreglar el reactor', 15, 120, 5, 45, ' s'),
    num('Sabotajes', 'o2Time', 'Tiempo para arreglar el oxígeno', 15, 120, 5, 50, ' s'),
    num('Sabotajes', 'doorTime', 'Duración de las puertas cerradas', 5, 30, 1, 12, ' s'),
    bool('Sabotajes', 'sabLuces', 'Permitir sabotaje de luces', true),
    bool('Sabotajes', 'sabComs', 'Permitir sabotaje de comunicaciones', true),
    bool('Sabotajes', 'sabPuertas', 'Permitir cierre de puertas', true),
    bool('Sabotajes', 'sabReactor', 'Permitir sabotaje del reactor', true),
    bool('Sabotajes', 'sabO2', 'Permitir sabotaje de oxígeno', true),
    bool('Sabotajes', 'vents', 'Ventilaciones del impostor', true),
    bool('Pruebas', 'testMode', 'Modo pruebas', false, 'Permite empezar con 1 jugador y la partida no termina sola (salvo por una crisis). El anfitrión puede terminar la prueba.'),
    num('Pruebas', 'bots', 'Jugadores de prueba (bots)', 0, 9, 1, 0, '', 'Solo con el modo pruebas. Caminan, hacen tareas, votan y los impostores matan'),
    sel('Pruebas', 'hostRole', 'Mi rol en el modo pruebas', [['azar', 'Al azar'], ['impostor', 'Impostor'], ['tripulante', 'Tripulante']], 'azar')
  ];
  const PRESETS = {
    clasico: { name: 'Clásico', set: {} },
    rapido:  { name: 'Rápido', set: { killCd: 10, sabCd: 10, reactorTime: 25, o2Time: 25, doorTime: 8, discuss: 5, voteTime: 20, emergencyCd: 0, tasksPer: 2 } },
    pruebas: { name: 'Pruebas', set: { killCd: 5, sabCd: 5, reactorTime: 20, o2Time: 20, doorTime: 6, discuss: 0, voteTime: 15, emergencyCd: 0, tasksPer: 2, testMode: true } }
  };
  // Devuelve siempre un conjunto completo y válido: lo que no es válido se corrige o se pone por defecto
  const normalizeSettings = src => {
    src = src && typeof src === 'object' ? src : {}; const out = {};
    for (const d of SETTINGS) {
      let v = src[d.k];
      if (d.t === 'num') { v = Number(v); if (!Number.isFinite(v)) v = d.def; v = Math.min(d.max, Math.max(d.min, Math.round((v - d.min) / d.step) * d.step + d.min)); v = Math.round(v * 100) / 100; }
      else if (d.t === 'bool') v = v === undefined ? d.def : !!v;
      else v = d.opts.some(o => o[0] === v) ? v : d.def;
      out[d.k] = v;
    }
    return out;
  };

  const VISUAL_TASKS = ['scan', 'asteroids', 'trash', 'shields'];   // tareas que se ven desde fuera
  const api = { VISUAL_TASKS, CHAINS, TASK_UNITS, pickUnit, taskPrev, DECOR, KITS, INFO, CAMERAS, SETTINGS, PRESETS, normalizeSettings, cellPos, PANELS, VENTS, DOORS, WALLS, POLYS, inPoly, roomAtPos, segDist, MAPW, MAPH, setDoors, isClosedCell, colors, SKINS, HAIR_COLORS, CLOTHES, OPT, randomLook, cleanLook, CELL, W, H, WALL_H, TASKS_PER, TABLE_R, COLORS, ROOMS, CORRIDORS, grid, roomAt, STATIONS, stationPos, BUTTON, isSolid, blocked, spawnPos };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Shared = api;
})(this);
