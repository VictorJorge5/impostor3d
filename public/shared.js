// Mapa y reglas compartidas entre servidor y cliente
(function (root) {
  // El mapa se define con polígonos en metros (como The Skeld, con paredes en diagonal). CELL es la rejilla gruesa
  // que usan los bots para buscar caminos; las colisiones y la vista usan una rejilla fina de 25 cm.
  const MAPW = 102, MAPH = 55, CELL = 1, W = MAPW / CELL, H = Math.ceil(MAPH / CELL), WALL_H = 3, TASKS_PER = 4, TABLE_R = 1.8;

  const COLORS = [   // los colores de Among Us
    ['Rojo', '#c51111'], ['Azul', '#132ed1'], ['Verde', '#117f2d'], ['Rosa', '#ed54ba'], ['Naranja', '#ef7d0d'], ['Amarillo', '#f5f557'],
    ['Negro', '#3f474e'], ['Blanco', '#d6e0f0'], ['Morado', '#6b2fbb'], ['Marrón', '#71491e'], ['Cian', '#38fedc'], ['Lima', '#50ef39']
  ];

  // The Skeld visto desde arriba. Todo se escribe en las unidades del juego original (x a la derecha, y hacia arriba, con
  // las rejillas en sus coordenadas reales) y U() lo pasa a metros de este juego: 1 unidad = 2,2 m (un crewmate mide ~0,9).
  const K = 2.2, U = (x, y) => [+((x + 25.6) * K).toFixed(2), +((6.7 - y) * K).toFixed(2)];
  const P = pts => pts.map(q => U(q[0], q[1]));
  const ROOMS = [
    { id: 'cafeteria',      name: 'Cafetería',      poly: P([[-3.8, 5.7], [4.2, 5.7], [6, 3.9], [6, 0], [4.2, -1.8], [-3.8, -1.8], [-5.6, 0], [-5.6, 3.9]]) },
    { id: 'armeria',        name: 'Armería',        poly: P([[7.6, 5.2], [11, 5.2], [12.2, 4], [12.2, -0.6], [7.6, -0.6]]) },
    { id: 'oxigeno',        name: 'Oxígeno',        poly: P([[4.4, -2.4], [8.8, -2.4], [8.8, -4.7], [4.4, -4.7]]) },
    { id: 'navegacion',     name: 'Navegación',     poly: P([[14.2, -1.6], [17.2, -1.6], [19.6, -4], [19.6, -5.6], [17.2, -8], [14.2, -8]]) },
    { id: 'escudos',        name: 'Escudos',        poly: P([[7.4, -10.4], [12.4, -10.4], [12.4, -14.6], [10.8, -16.2], [7.4, -16.2]]) },
    { id: 'comunicaciones', name: 'Comunicaciones', poly: P([[1.8, -14.6], [6.8, -14.6], [6.8, -18], [1.8, -18]]) },
    { id: 'administracion', name: 'Administración', poly: P([[1.8, -6], [6.2, -6], [7.2, -7], [7.2, -10.4], [1.8, -10.4]]) },
    { id: 'almacen',        name: 'Almacén',        poly: P([[-6.2, -6.6], [0.8, -6.6], [0.8, -14.2], [-1.2, -16.2], [-6.2, -16.2]]) },
    { id: 'electrica',      name: 'Eléctrica',      poly: P([[-11.6, -6.4], [-7, -6.4], [-7, -8.6], [-10, -8.6], [-10, -9.6], [-7, -9.6], [-7, -11.4], [-11.6, -11.4]]) },   // con el tabique en medio, como en el original
    { id: 'enfermeria',     name: 'Enfermería',     poly: P([[-11.2, -1.6], [-6.8, -1.6], [-6.8, -4.6], [-7.8, -5.6], [-11.2, -5.6]]) },
    { id: 'seguridad',      name: 'Seguridad',      poly: P([[-15.2, -4.8], [-11.9, -4.8], [-11.9, -8.9], [-15.2, -8.9]]) },
    { id: 'reactor',        name: 'Reactor',        poly: P([[-23.4, -0.8], [-20.2, -0.8], [-20.2, -9], [-23.4, -9], [-24.6, -7.6], [-24.6, -2.2]]) },
    { id: 'motores',        name: 'Motor superior', poly: P([[-19.6, 3.4], [-13.2, 3.4], [-13.2, -3.6], [-18.2, -3.6], [-19.6, -2.2]]) },
    { id: 'motorinf',       name: 'Motor inferior', poly: P([[-18.2, -9.6], [-13.2, -9.6], [-13.2, -16.2], [-19.6, -16.2], [-19.6, -11]]) }
  ];
  const rect = (x0, y0, x1, y1) => P([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);   // en unidades: esquina de arriba a la izquierda y de abajo a la derecha
  const CORRIDORS = [
    [-13.2, 2.8, -5.6, 1],      // motor superior → cafetería (pasa por encima de la enfermería)
    [-9.6, 1, -8, -1.6],        // entrada de la enfermería
    [-17.6, -3.6, -15.6, -9.6], // pasillo oeste: motor superior → motor inferior
    [-20.2, -4.4, -17.6, -6],   // entrada del reactor
    [-15.6, -5.6, -15.2, -7],   // entrada de seguridad
    [-13.2, -12.6, -6.2, -14.4],// pasillo sur: motor inferior → almacén
    [-8.6, -11.4, -7.2, -12.6],  // entrada de eléctrica (abajo a la derecha)
    [-1.4, -1.8, 0.4, -6.6],    // cafetería → almacén
    [0.4, -4.4, 3.2, -6],       // pasillo de administración
    [6, 3.4, 7.6, 1.6],         // cafetería → armería
    [9.4, -0.6, 11.2, -10.4],   // pasillo derecho: armería → escudos
    [8.8, -3, 9.4, -4.2],       // entrada de oxígeno
    [11.2, -2.6, 14.2, -4.4],   // a Navegación (puerta de arriba)
    [11.2, -6.2, 14.2, -8],     // a Navegación (puerta de abajo)
    [0.8, -12.2, 7.4, -14],     // almacén → escudos
    [3.8, -14, 5.6, -14.6]      // entrada de comunicaciones
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
    ['Conectar cables',        'electrica',      -7.7, -6.85, 'wires', 'cables', 0],
    ['Calibrar distribuidor',  'electrica',      -10.9, -6.85, 'calibrate'],
    ['Descargar datos',        'comunicaciones', 6.3, -16.4,    'download', 'datos', 0],
    ['Trazar rumbo',           'navegacion',     18.8, -4.8,  'course'],
    ['Iniciar reactor',        'reactor',        -22.6, -8.3, 'simon'],
    ['Desbloquear colectores', 'reactor',        -22.6, -1.5, 'manifolds'],
    ['Escáner médico',         'enfermeria',     -9, -4.6,    'scan'],
    ['Analizar muestra',       'enfermeria',     -7.4, -2.2,  'samples'],
    ['Repostar motor inferior', 'motorinf',      -18.6, -11.2, 'fuel', 'combustible', 3],
    ['Alinear motor superior', 'motores',        -13.8, -0.4, 'align', 'alinear', 0],
    ['Pasar tarjeta',          'administracion', 6.6, -8.2,   'card'],
    ['Vaciar basura',          'almacen',        -1, -15.2,   'trash', 'basura', 1],
    ['Limpiar filtro',         'oxigeno',        5, -2.9,     'leaves'],
    ['Destruir asteroides',    'armeria',        10, 2.2,     'asteroids'],
    ['Activar escudos',        'escudos',        11.8, -12.4, 'shields'],
    ['Subir datos',            'administracion', 2.4, -7.4,   'upload', 'datos', 1],
    ['Descargar datos',        'cafeteria',      0.2, 5.1,    'download', 'datos', 0],
    ['Descargar datos',        'armeria',        8.2, 0,      'download', 'datos', 0],
    ['Descargar datos',        'navegacion',     14.8, -2.2,  'download', 'datos', 0],
    ['Llenar bidón',           'almacen',        -5.6, -15.6, 'fillcan', 'combustible', 0],
    ['Repostar motor superior', 'motores',       -18.6, -2.4, 'fuel', 'combustible', 1],
    ['Desviar energía',        'electrica',      -7.5, -7.9,  'divert', 'energia', 0],
    ['Aceptar energía',        'navegacion',     17.2, -7.2,  'accept', 'energia', 1],
    ['Aceptar energía',        'escudos',        8, -15.6,    'accept', 'energia', 1],
    ['Aceptar energía',        'oxigeno',        5.2, -4.25,     'accept', 'energia', 1],
    ['Aceptar energía',        'seguridad',      -14.6, -8.4, 'accept', 'energia', 1],
    // como en The Skeld: los cables se arreglan en tres cuadros seguidos, el combustible se llena dos veces,
    // los dos motores se alinean y la basura de la cafetería o el conducto de oxígeno se vacían luego en el almacén
    ['Conectar cables',        'almacen',        -4, -6.95,   'wires', 'cables', 0],
    ['Conectar cables',        'administracion', 5, -6.4,     'wires', 'cables', 1],
    ['Conectar cables',        'cafeteria',      -1.6, 5.2,   'wires', 'cables', 1],
    ['Conectar cables',        'navegacion',     16, -7.6,    'wires', 'cables', 2],
    ['Alinear motor inferior', 'motorinf',       -13.8, -11,  'align', 'alinear', 1],
    ['Llenar bidón',           'almacen',        -4.4, -15.6, 'fillcan', 'combustible', 2],
    ['Vaciar basura',          'cafeteria',      1.6, -1.2,   'trash', 'basura', 0],
    ['Vaciar conducto',        'oxigeno',        7.2, -4.3,   'trash', 'basura', 0],
    ['Estabilizar dirección',  'navegacion',     18.2, -3.4,  'steering'],
    // el resto de las tareas de The Skeld
    ['Descargar datos',        'electrica',      -7.5, -10.05, 'download', 'datos', 0],
    ['Aceptar energía',        'motores',        -14, -2.8,   'accept', 'energia', 1],
    ['Aceptar energía',        'motorinf',       -14, -15.5,  'accept', 'energia', 1],
    ['Aceptar energía',        'armeria',        11.6, -0.1,  'accept', 'energia', 1],
    ['Aceptar energía',        'comunicaciones', 2.7, -15.1,  'accept', 'energia', 1],
    ['Conectar cables',        'seguridad',      -12.4, -8.4, 'wires', 'cables', 2],
    // limpiar una rejilla: se hace encima de la rejilla y no estorba el paso
    ['Limpiar rejilla',        'cafeteria',      4.26, -0.28, 'ventclean', 'rejilla', 0],
    ['Limpiar rejilla',        'administracion', 2.54, -9.59, 'ventclean', 'rejilla', 0],
    ['Limpiar rejilla',        'enfermeria',     -10.61, -4.18, 'ventclean', 'rejilla', 0],
    ['Limpiar rejilla',        'navegacion',     16.01, -3.17, 'ventclean', 'rejilla', 0],
    ['Limpiar rejilla',        'escudos',        9.5, -14.3,  'ventclean', 'rejilla', 0]
  ].map((s, id) => ({ id, name: s[0], room: s[1], x: U(s[2], s[3])[0], z: U(s[2], s[3])[1], type: s[4], chain: s[5] || null, step: s[6] || 0, noBlock: s[4] === 'ventclean' }));
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
  const at = (o, x, y) => { const [mx, mz] = U(x, y); o.x = mx; o.z = mz; return o; };
  const PANELS = [
    at({ id: 'luces',    name: 'Panel de luces',          room: 'electrica' },      -9.3, -10),   // nada más entrar, en el tabique
    at({ id: 'coms',     name: 'Panel de comunicaciones', room: 'comunicaciones' }, 2.7, -16.4),
    at({ id: 'reactorA', name: 'Control del reactor',     room: 'reactor' },        -20.9, -1.5),
    at({ id: 'reactorB', name: 'Control del reactor',     room: 'reactor' },        -20.9, -8.3),
    at({ id: 'o2a',      name: 'Depurador de oxígeno',    room: 'oxigeno' },        7.5, -2.85),
    at({ id: 'o2b',      name: 'Depurador de oxígeno',    room: 'administracion' }, 6.6, -9.8)
  ];
  PANELS.forEach(p => { p.type = p.id === 'luces' ? 'switches' : p.id === 'coms' ? 'dial' : p.id.startsWith('reactor') ? 'holdPanel' : 'code'; });
  // Terminales de información (las puede usar cualquier jugador vivo; las desactiva el sabotaje de comunicaciones salvo los signos vitales)
  const INFO = [
    at({ id: 'cams',    name: 'Cámaras de seguridad',    short: 'Cámaras', room: 'seguridad' },      -12.7, -5.3),
    at({ id: 'admin',   name: 'Panel de administración', short: 'Admin',   room: 'administracion' }, 4.5, -9.4),
    at({ id: 'vitals',  name: 'Signos vitales',          short: 'Vitales', room: 'enfermeria' },     -7.3, -3.6),
    at({ id: 'doorlog', name: 'Registro de puertas',     short: 'Puertas', room: 'electrica' },      -11.1, -10.7)
  ];
  // Cámaras de seguridad: posición en la pared (x, altura, z) y centro de lo que se ve
  const cam = (id, name, px, py, lx, ly) => { const p = U(px, py), l = U(lx, ly); return { id, name, pos: [p[0], 2.6, p[1]], look: [l[0], 1, l[1]] }; };
  const CAMERAS = [
    cam(0, 'Pasillo de motores',    -16.6, -3.75, -16.6, -6.4),
    cam(1, 'Pasillo de Enfermería', -9.4, 2.65,   -9.4, 1.4),
    cam(2, 'Pasillo de Admin',      -0.5, -1.95,  -0.2, -4.6),
    cam(3, 'Pasillo de Navegación', 10.3, -0.75,  11.4, -4.8)
  ];
  // Red de ventilaciones (solo las usa el impostor), en las coordenadas de The Skeld
  const VENTS = [
    at({ id: 0,  room: 'reactor',        links: [1] },    -21.88, -3.06),
    at({ id: 1,  room: 'motores',        links: [0] },    -15.29, 2.52),
    at({ id: 2,  room: 'reactor',        links: [3] },    -20.8, -6.9),
    at({ id: 3,  room: 'motorinf',       links: [2] },    -15.25, -13.73),
    at({ id: 4,  room: 'enfermeria',     links: [5, 6] }, -10.61, -4.18),
    at({ id: 5,  room: 'seguridad',      links: [4, 6] }, -12.53, -6.9),
    at({ id: 6,  room: 'electrica',      links: [4, 5] }, -9.77, -8.03),
    at({ id: 7,  room: 'cafeteria',      links: [8, 9] }, 4.26, -0.28),
    at({ id: 8,  room: 'administracion', links: [7, 9] }, 2.54, -9.59),
    at({ id: 9,  room: null,             links: [7, 8] }, 10.3, -6.44),
    at({ id: 10, room: 'armeria',        links: [11] },   8.82, 3.32),
    at({ id: 11, room: 'navegacion',     links: [10] },   16.01, -3.17),
    at({ id: 12, room: 'navegacion',     links: [13] },   16.01, -6.38),
    at({ id: 13, room: 'escudos',        links: [12] },   9.5, -14.3)
  ];
  // puertas cerradas por sabotaje: tramos de puerta de la sala elegida
  let closedDoors = [];
  const setDoors = roomId => { closedDoors = roomId && DOORS[roomId] ? DOORS[roomId] : []; };
  const segDist = (x, z, s) => { const dx = s[2] - s[0], dz = s[3] - s[1], L2 = dx * dx + dz * dz, t = Math.max(0, Math.min(1, ((x - s[0]) * dx + (z - s[1]) * dz) / L2)); return Math.hypot(x - s[0] - dx * t, z - s[1] - dz * t); };
  const isClosedCell = (x, z) => closedDoors.length > 0 && closedDoors.some(s => segDist(x, z, s) < .35);

  const stationPos = st => ({ x: st.x, z: st.z });
  // Decoración con volumen (no se puede atravesar), x, z en metros. Choque: r = círculo, w/h = rectángulo, len = motor (rectángulo len x 2r).
  // El cliente dibuja cada tipo. Las salas van llenas como en The Skeld: mesas, motores, reactor, camas, cajas, plantas...
  const D = (o, x, y) => at(o, x, y);
  const DECOR = [
    D({ kind: 'table',     room: 'cafeteria',      r: 1.6 },  -2.6, 3.9),
    D({ kind: 'table',     room: 'cafeteria',      r: 1.6 },  2.8, 3.9),
    D({ kind: 'table',     room: 'cafeteria',      r: 1.6 },  -2.6, 0.2),
    D({ kind: 'table',     room: 'cafeteria',      r: 1.6 },  2.6, 0.4),
    D({ kind: 'engine',    room: 'motores',        r: 2.8, len: 7.4 },  -17.9, 0.4),
    D({ kind: 'engine',    room: 'motorinf',       r: 2.8, len: 7.4 },  -17.9, -13.3),
    D({ kind: 'cans',      room: 'motorinf',       r: .9 },   -16.6, -15.6),
    D({ kind: 'core',      room: 'reactor',        r: 2.7 },  -22.9, -4.9),
    D({ kind: 'desk',      room: 'seguridad',      w: 2.6, h: 1.2 }, -14.2, -5.25),
    D({ kind: 'bed',       room: 'enfermeria',     w: 3, h: 1.4 },   -10.4, -2.4),
    D({ kind: 'cratepile', room: 'almacen',        w: 5.6, h: 4 },   -2.8, -10.4),
    D({ kind: 'crates',    room: 'almacen',        r: 1.3 },  -5.3, -7.6),
    D({ kind: 'barrel',    room: 'almacen',        r: .9 },   0, -7.5),
    D({ kind: 'cans',      room: 'almacen',        r: .8 },   -2.7, -15.7),
    D({ kind: 'admintable', room: 'administracion', w: 4.2, h: 2 }, 4.5, -8.1),   // la gran mesa del mapa, en el centro
    D({ kind: 'plant',     room: 'administracion', r: .7 },   6.6, -6.9),
    D({ kind: 'desk',      room: 'comunicaciones', w: 2.4, h: 1.1 }, 4.4, -17.65),
    D({ kind: 'shieldgen', room: 'escudos',        r: 1.2 },  8.3, -11.3),
    D({ kind: 'chair',     room: 'navegacion',     r: 1, rot: -Math.PI / 2 }, 17.3, -5.2),
    D({ kind: 'turret',    room: 'armeria',        r: 1.6 },  10.8, 3.9),
    D({ kind: 'crates',    room: 'armeria',        r: 1 },    8.2, 4.5)
  ];
  const BUTTON = (([x, z]) => ({ x, z }))(U(0.1, 2.05)); // mesa de la cafetería

  const isSolid = (x, z) => !isFloor(x, z);
  const blocked = (x, z, r) => {
    r = r || 0.45;
    if (isSolid(x - r, z - r) || isSolid(x + r, z - r) || isSolid(x - r, z + r) || isSolid(x + r, z + r) || isSolid(x, z - r) || isSolid(x, z + r) || isSolid(x - r, z) || isSolid(x + r, z)) return true;
    let dx = x - BUTTON.x, dz = z - BUTTON.z;
    if (dx * dx + dz * dz < (TABLE_R + r) * (TABLE_R + r)) return true;
    for (const st of STATIONS) {
      if (st.noBlock) continue;
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
    const x = BUTTON.x + Math.cos(a) * 3.5, z = BUTTON.z + Math.sin(a) * 3.5;
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
