// Mapa y reglas compartidas entre servidor y cliente
(function (root) {
  // El mapa se define con polígonos en metros (como The Skeld, con paredes en diagonal). CELL es la rejilla gruesa
  // que usan los bots para buscar caminos; las colisiones y la vista usan una rejilla fina de 25 cm.
  const MAPW = 114, MAPH = 66, CELL = 1, W = MAPW / CELL, H = Math.ceil(MAPH / CELL), WALL_H = 3, TASKS_PER = 4, TABLE_R = 2.3;

  const COLORS = [   // los colores de Among Us
    ['Rojo', '#c51111'], ['Azul', '#132ed1'], ['Verde', '#117f2d'], ['Rosa', '#ed54ba'], ['Naranja', '#ef7d0d'], ['Amarillo', '#f5f557'],
    ['Negro', '#3f474e'], ['Blanco', '#d6e0f0'], ['Morado', '#6b2fbb'], ['Marrón', '#71491e'], ['Cian', '#38fedc'], ['Lima', '#50ef39']
  ];

  // The Skeld visto desde arriba, calcado del plano oficial: cada punto se escribe en píxeles del plano (604 × 340) y
  // U() lo pasa a metros de este juego (1 px = 0,2 m; un pasillo mide ~5 m y un crewmate 2,2).
  const K = 0.2, U = (x, y) => [+((x - 15) * K).toFixed(2), +((y - 5) * K).toFixed(2)];
  const P = pts => pts.map(q => U(q[0], q[1]));
  const ROOMS = [
    { id: 'cafeteria',      name: 'Cafetería',      poly: P([[249, 38], [275, 12], [357, 12], [395, 50], [395, 126], [358, 159], [281, 159], [249, 126]]) },
    { id: 'armeria',        name: 'Armería',        poly: P([[421, 43], [455, 43], [481, 70], [481, 112], [435, 112], [421, 98]]) },
    { id: 'oxigeno',        name: 'Oxígeno',        poly: P([[383, 146], [403, 121], [431, 121], [431, 167], [383, 167]]) },
    { id: 'navegacion',     name: 'Navegación',     poly: P([[531, 126], [558, 126], [574, 141], [574, 165], [559, 186], [531, 186]]) },
    { id: 'escudos',        name: 'Escudos',        poly: P([[434, 225], [482, 225], [482, 266], [454, 294], [420, 294], [420, 241]]) },
    { id: 'comunicaciones', name: 'Comunicaciones', poly: P([[349, 277], [416, 277], [416, 314], [404, 327], [362, 327], [349, 314]]) },
    { id: 'administracion', name: 'Administración', poly: P([[354, 174], [422, 174], [422, 221], [410, 234], [354, 234]]) },
    { id: 'almacen',        name: 'Almacén',        poly: P([[284, 207], [344, 207], [344, 327], [291, 327], [264, 298], [264, 227]]) },
    // con el gran tabique del panel de luces: la puerta da a la parte de delante y los cables están detrás
    { id: 'electrica',      name: 'Eléctrica',      poly: P([[196, 189], [264, 189], [264, 205], [248, 222], [248, 249], [235, 262], [217, 262], [217, 271], [196, 271], [196, 228], [231, 228], [231, 223], [196, 223]]) },
    { id: 'enfermeria',     name: 'Enfermería',     poly: P([[185, 102], [241, 102], [241, 136], [264, 158], [264, 176], [196, 176], [185, 162]]) },
    { id: 'seguridad',      name: 'Seguridad',      poly: P([[141, 135], [150, 126], [169, 126], [178, 135], [178, 195], [141, 195]]) },
    { id: 'reactor',        name: 'Reactor',        poly: P([[26, 127], [44, 112], [63, 112], [63, 133], [84, 133], [84, 196], [63, 196], [63, 218], [44, 218], [26, 204]]) },
    { id: 'motores',        name: 'Motor superior', poly: P([[77, 66], [95, 52], [140, 52], [140, 121], [77, 121]]) },
    { id: 'motorinf',       name: 'Motor inferior', poly: P([[77, 212], [140, 212], [140, 282], [95, 282], [77, 270]]) }
  ];
  const rect = (x0, y0, x1, y1) => P([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);   // en píxeles del plano: esquina de arriba a la izquierda y de abajo a la derecha
  const CORRIDORS = [
    [140, 68, 249, 96],    // motor superior → cafetería (pasa por encima de la enfermería)
    [200, 96, 222, 102],   // entrada de la enfermería
    [100, 121, 122, 212],  // pasillo de los motores
    [84, 146, 100, 178],   // entrada del reactor
    [122, 153, 141, 178],  // entrada de seguridad
    [140, 233, 185, 261],  // motor inferior → eléctrica
    [163, 261, 185, 271],
    [163, 271, 264, 297],  // pasillo de eléctrica → almacén
    [311, 159, 331, 207],  // cafetería → almacén
    [331, 175, 354, 201],  // pasillo de administración
    [395, 69, 421, 95],    // cafetería → armería
    [444, 112, 463, 124],  // armería → pasillo derecho
    [495, 144, 531, 169],  // entrada de navegación
    [344, 241, 420, 267],  // almacén → escudos
    [388, 267, 408, 277]   // entrada de comunicaciones
  ].map(r => rect(r[0], r[1], r[2], r[3])).concat([
    // el pasillo derecho: de oxígeno y armería baja hacia navegación y escudos
    P([[431, 124], [495, 124], [495, 191], [464, 191], [464, 225], [442, 225], [442, 166], [474, 166], [474, 151], [431, 151]])
  ]);
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
    ['Conectar cables',        'electrica',      236, 193, 'wires', 'cables', 0],
    ['Calibrar distribuidor',  'electrica',      204, 193, 'calibrate'],
    ['Descargar datos',        'comunicaciones', 362, 282, 'download', 'datos', 0],
    ['Trazar rumbo',           'navegacion',     553, 130, 'course'],
    ['Iniciar reactor',        'reactor',        52, 212,  'simon'],
    ['Desbloquear colectores', 'reactor',        52, 117,  'manifolds'],
    ['Escáner médico',         'enfermeria',     206, 160, 'scan'],
    ['Analizar muestra',       'enfermeria',     236, 166, 'samples'],
    ['Repostar motor inferior', 'motorinf',      86, 218,  'fuel', 'combustible', 3],
    ['Alinear motor superior', 'motores',        133, 58,  'align', 'alinear', 0],
    ['Pasar tarjeta',          'administracion', 414, 204, 'card'],
    ['Vaciar basura',          'almacen',        334, 318, 'trash', 'basura', 1],
    ['Limpiar filtro',         'oxigeno',        396, 159, 'leaves'],
    ['Destruir asteroides',    'armeria',        440, 80,  'asteroids'],
    ['Activar escudos',        'escudos',        472, 252, 'shields'],
    ['Subir datos',            'administracion', 368, 178, 'upload', 'datos', 1],
    ['Descargar datos',        'cafeteria',      340, 16,  'download', 'datos', 0],
    ['Descargar datos',        'armeria',        430, 48,  'download', 'datos', 0],
    ['Descargar datos',        'navegacion',     537, 130, 'download', 'datos', 0],
    ['Llenar bidón',           'almacen',        300, 320, 'fillcan', 'combustible', 0],
    ['Repostar motor superior', 'motores',       86, 115,  'fuel', 'combustible', 1],
    ['Desviar energía',        'electrica',      252, 193, 'divert', 'energia', 0],
    ['Aceptar energía',        'navegacion',     553, 182, 'accept', 'energia', 1],
    ['Aceptar energía',        'escudos',        430, 288, 'accept', 'energia', 1],
    ['Aceptar energía',        'oxigeno',        402, 125, 'accept', 'energia', 1],
    ['Aceptar energía',        'seguridad',      172, 190, 'accept', 'energia', 1],
    // como en The Skeld: los cables se arreglan en tres cuadros seguidos, el combustible se llena dos veces,
    // los dos motores se alinean y la basura de la cafetería o el conducto de oxígeno se vacían luego en el almacén
    ['Conectar cables',        'almacen',        300, 212, 'wires', 'cables', 0],
    ['Conectar cables',        'administracion', 385, 178, 'wires', 'cables', 1],
    ['Conectar cables',        'cafeteria',      284, 16,  'wires', 'cables', 1],
    ['Conectar cables',        'navegacion',     537, 182, 'wires', 'cables', 2],
    ['Alinear motor inferior', 'motorinf',       132, 276, 'align', 'alinear', 1],
    ['Llenar bidón',           'almacen',        314, 320, 'fillcan', 'combustible', 2],
    ['Vaciar basura',          'cafeteria',      388, 102, 'trash', 'basura', 0],
    ['Vaciar conducto',        'oxigeno',        424, 161, 'trash', 'basura', 0],
    ['Estabilizar dirección',  'navegacion',     567, 154, 'steering'],
    // el resto de las tareas de The Skeld
    ['Descargar datos',        'electrica',      220, 193, 'download', 'datos', 0],
    ['Aceptar energía',        'motores',        112, 56,  'accept', 'energia', 1],
    ['Aceptar energía',        'motorinf',       116, 278, 'accept', 'energia', 1],
    ['Aceptar energía',        'armeria',        474, 104, 'accept', 'energia', 1],
    ['Aceptar energía',        'comunicaciones', 411, 304, 'accept', 'energia', 1],
    ['Conectar cables',        'seguridad',      146, 147, 'wires', 'cables', 2],
    // limpiar una rejilla: se hace encima de la rejilla y no estorba el paso
    ['Limpiar rejilla',        'cafeteria',      380, 128, 'ventclean', 'rejilla', 0],
    ['Limpiar rejilla',        'administracion', 362, 226, 'ventclean', 'rejilla', 0],
    ['Limpiar rejilla',        'enfermeria',     194, 148, 'ventclean', 'rejilla', 0],
    ['Limpiar rejilla',        'navegacion',     562, 139, 'ventclean', 'rejilla', 0],
    ['Limpiar rejilla',        'escudos',        446, 250, 'ventclean', 'rejilla', 0]
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
    at({ id: 'luces',    name: 'Panel de luces',          room: 'electrica' },      206, 231),   // nada más entrar, en el tabique
    at({ id: 'coms',     name: 'Panel de comunicaciones', room: 'comunicaciones' }, 411, 285),
    at({ id: 'reactorA', name: 'Control del reactor',     room: 'reactor' },        74, 137),
    at({ id: 'reactorB', name: 'Control del reactor',     room: 'reactor' },        74, 191),
    at({ id: 'o2a',      name: 'Depurador de oxígeno',    room: 'oxigeno' },        420, 125),
    at({ id: 'o2b',      name: 'Depurador de oxígeno',    room: 'administracion' }, 414, 180)
  ];
  PANELS.forEach(p => { p.type = p.id === 'luces' ? 'switches' : p.id === 'coms' ? 'dial' : p.id.startsWith('reactor') ? 'holdPanel' : 'code'; });
  // Terminales de información (las puede usar cualquier jugador vivo; las desactiva el sabotaje de comunicaciones salvo los signos vitales)
  const INFO = [
    at({ id: 'cams',    name: 'Cámaras de seguridad',    short: 'Cámaras', room: 'seguridad' },      160, 130),
    at({ id: 'admin',   name: 'Panel de administración', short: 'Admin',   room: 'administracion' }, 388, 224),
    at({ id: 'vitals',  name: 'Signos vitales',          short: 'Vitales', room: 'enfermeria' },     256, 169),
    at({ id: 'doorlog', name: 'Registro de puertas',     short: 'Puertas', room: 'electrica' },      237, 252)
  ];
  // Cámaras de seguridad: posición en la pared (x, altura, z) y centro de lo que se ve
  const cam = (id, name, px, py, lx, ly) => { const p = U(px, py), l = U(lx, ly); return { id, name, pos: [p[0], 2.6, p[1]], look: [l[0], 1, l[1]] }; };
  // las cuatro cámaras de The Skeld, en el orden del monitor de Seguridad: arriba el pasillo de Armería a Escudos y el de
  // Admin, Cafetería y Almacén; abajo el de Enfermería y Motor superior y el de Seguridad y Reactor
  const CAMERAS = [
    cam(0, 'Pasillo de Navegación', 486, 127, 468, 168),
    cam(1, 'Pasillo de Admin',      328, 168, 330, 190),
    cam(2, 'Pasillo de Enfermería', 190, 70,  205, 86),
    cam(3, 'Pasillo de Seguridad',  92, 149,  111, 165)
  ];
  // Red de ventilaciones (solo las usa el impostor), donde están en The Skeld
  const VENTS = [
    at({ id: 0,  room: 'reactor',        links: [1] },    56, 123),
    at({ id: 1,  room: 'motores',        links: [0] },    110, 113),
    at({ id: 2,  room: 'reactor',        links: [3] },    56, 205),
    at({ id: 3,  room: 'motorinf',       links: [2] },    102, 275),
    at({ id: 4,  room: 'enfermeria',     links: [5, 6] }, 194, 148),
    at({ id: 5,  room: 'seguridad',      links: [4, 6] }, 152, 186),
    at({ id: 6,  room: 'electrica',      links: [4, 5] }, 207, 250),
    at({ id: 7,  room: 'cafeteria',      links: [8, 9] }, 380, 128),
    at({ id: 8,  room: 'administracion', links: [7, 9] }, 362, 226),
    at({ id: 9,  room: null,             links: [7, 8] }, 484, 182),
    at({ id: 10, room: 'armeria',        links: [11] },   462, 100),
    at({ id: 11, room: 'navegacion',     links: [10] },   562, 139),
    at({ id: 12, room: 'navegacion',     links: [13] },   556, 177),
    at({ id: 13, room: 'escudos',        links: [12] },   446, 250)
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
    D({ kind: 'table',     room: 'cafeteria',      r: 2.3 },  278, 48),
    D({ kind: 'table',     room: 'cafeteria',      r: 2.3 },  343, 48),
    D({ kind: 'table',     room: 'cafeteria',      r: 2.3 },  278, 116),
    D({ kind: 'table',     room: 'cafeteria',      r: 2.3 },  343, 116),
    D({ kind: 'engine',    room: 'motores',        r: 2.8, len: 7.4 },  101, 86),
    D({ kind: 'engine',    room: 'motorinf',       r: 2.8, len: 7.4 },  101, 247),
    D({ kind: 'core',      room: 'reactor',        r: 2.4 },  42, 165),
    D({ kind: 'bed',       room: 'enfermeria',     w: 2.4, h: 1.2 }, 194, 111),
    D({ kind: 'bed',       room: 'enfermeria',     w: 2.4, h: 1.2 }, 194, 127),
    D({ kind: 'bed',       room: 'enfermeria',     w: 2.4, h: 1.2 }, 232, 111),
    D({ kind: 'bed',       room: 'enfermeria',     w: 2.4, h: 1.2 }, 232, 127),
    D({ kind: 'cratepile', room: 'almacen',        w: 6.4, h: 5.6 }, 302, 265),
    D({ kind: 'barrel',    room: 'almacen',        r: 1.2 },  277, 236),
    D({ kind: 'crates',    room: 'almacen',        r: 1.2 },  280, 296),
    D({ kind: 'admintable', room: 'administracion', w: 5, h: 2.4 }, 388, 208),   // la gran mesa del mapa, en el centro
    D({ kind: 'desk',      room: 'comunicaciones', w: 4, h: 1.1 }, 382, 319),
    D({ kind: 'shieldgen', room: 'escudos',        r: 1.2 },  474, 235),
    D({ kind: 'chair',     room: 'navegacion',     r: 1, rot: -Math.PI / 2 }, 553, 156),
    D({ kind: 'turret',    room: 'armeria',        r: 1.6 },  456, 62)
  ];
  const BUTTON = (([x, z]) => ({ x, z }))(U(310, 82)); // mesa de la cafetería
  // por dónde se ven desde fuera las tareas visuales: el cañón de Armería, la escotilla de la basura del Almacén y los escudos
  const pt = (x, y, o) => { const [mx, mz] = U(x, y); return Object.assign({ x: mx, z: mz }, o); };
  const WEAPON_GUN = pt(480, 44, { dx: .75, dz: -.66 }), TRASH_OUT = pt(334, 331), SHIELD_OUT = pt(470, 262);

  const isSolid = (x, z) => !isFloor(x, z);
  // ¿hay una pared entre dos puntos? (para matar: las paredes lo impiden, las puertas no, como en el original)
  const wallBetween = (x0, z0, x1, z1) => { const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / .25); for (let k = 1; k < n; k++) if (isSolid(x0 + (x1 - x0) * k / n, z0 + (z1 - z0) * k / n)) return true; return false; };
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
  // el punto libre más cercano (por si algo deja a alguien dentro de una mesa o de una pared)
  const freeNear = (x, z) => {
    if (!blocked(x, z)) return { x, z };
    for (let d = .25; d < 12; d += .25) for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d; if (!blocked(px, pz)) return { x: px, z: pz }; }
    return { x: BUTTON.x, z: BUTTON.z + TABLE_R + 1.2 };
  };
  const spawnPos = (i, n) => {
    const a = (i / n) * Math.PI * 2 + .3, p = freeNear(BUTTON.x + Math.cos(a) * 4.8, BUTTON.z + Math.sin(a) * 4.2);   // en corro alrededor de la mesa, sin pisar los bancos
    return { x: p.x, z: p.z, ry: Math.atan2(BUTTON.x - p.x, BUTTON.z - p.z) };
  };
  // huella del mapa: la web y el servidor de juego tienen que tener el mismo, o las mesas y paredes no coinciden
  const MAP_VER = (() => { const str = JSON.stringify([ROOMS.map(r => r.poly), CORRIDORS, STATIONS.map(s => [s.x, s.z]), DECOR.map(d => [d.x, d.z]), BUTTON, TABLE_R]); let h = 5381; for (let i = 0; i < str.length; i++) h = (h * 33 + str.charCodeAt(i)) >>> 0; return h.toString(36); })();

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
  const api = { wallBetween, MAP_VER, freeNear, WEAPON_GUN, TRASH_OUT, SHIELD_OUT, VISUAL_TASKS, CHAINS, TASK_UNITS, pickUnit, taskPrev, DECOR, KITS, INFO, CAMERAS, SETTINGS, PRESETS, normalizeSettings, cellPos, PANELS, VENTS, DOORS, WALLS, POLYS, inPoly, roomAtPos, segDist, MAPW, MAPH, setDoors, isClosedCell, colors, SKINS, HAIR_COLORS, CLOTHES, OPT, randomLook, cleanLook, CELL, W, H, WALL_H, TASKS_PER, TABLE_R, COLORS, ROOMS, CORRIDORS, grid, roomAt, STATIONS, stationPos, BUTTON, isSolid, blocked, spawnPos };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Shared = api;
})(this);
