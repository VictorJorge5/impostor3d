// Mapa y reglas compartidas entre servidor y cliente
(function (root) {
  const CELL = 4, W = 44, H = 30, WALL_H = 3, TASKS_PER = 4, TABLE_R = 1.8;

  const COLORS = [
    ['Rojo', '#e53935'], ['Azul', '#1e88e5'], ['Verde', '#43a047'], ['Amarillo', '#fdd835'],
    ['Naranja', '#fb8c00'], ['Morado', '#8e24aa'], ['Rosa', '#ec407a'], ['Cian', '#00acc1'],
    ['Marrón', '#6d4c41'], ['Blanco', '#eceff1']
  ];

  // Distribución inspirada en The Skeld: 14 salas unidas por pasillos largos.
  // A la izquierda los motores, el reactor y seguridad; en el centro cafetería, administración y almacén; a la derecha armería, oxígeno, navegación, escudos y comunicaciones.
  // r = [x, y, ancho, alto] en celdas
  const ROOMS = [
    { id: 'cafeteria',      name: 'Cafetería',       r: [17, 1, 9, 7],  c: '#5f5f6b' },
    { id: 'motores',        name: 'Motor superior',  r: [1, 2, 7, 6],   c: '#474c6e' },
    { id: 'enfermeria',     name: 'Enfermería',      r: [11, 6, 5, 4],  c: '#3c6e64' },
    { id: 'seguridad',      name: 'Seguridad',       r: [12, 11, 4, 4], c: '#5a3d4a' },
    { id: 'reactor',        name: 'Reactor',         r: [1, 11, 5, 6],  c: '#6e4747' },
    { id: 'motorinf',       name: 'Motor inferior',  r: [1, 21, 7, 6],  c: '#474c6e' },
    { id: 'electrica',      name: 'Eléctrica',       r: [11, 16, 4, 4], c: '#6e6a3c' },
    { id: 'almacen',        name: 'Almacén',         r: [16, 19, 7, 8], c: '#6e5c3c' },
    { id: 'administracion', name: 'Administración',  r: [24, 13, 6, 5], c: '#4f466e' },
    { id: 'comunicaciones', name: 'Comunicaciones',  r: [26, 26, 5, 3], c: '#3c5e6e' },
    { id: 'escudos',        name: 'Escudos',         r: [33, 21, 6, 5], c: '#3c4e7e' },
    { id: 'navegacion',     name: 'Navegación',      r: [37, 11, 6, 7], c: '#3c5c7e' },
    { id: 'oxigeno',        name: 'Oxígeno',         r: [28, 9, 4, 3],  c: '#3c6e5a' },
    { id: 'armeria',        name: 'Armería',         r: [30, 1, 6, 6],  c: '#6e4c3c' }
  ];
  const CORRIDORS = [
    [8, 3, 9, 2],    // motor superior → cafetería (pasa por la enfermería)
    [12, 5, 2, 1],   // entrada de la enfermería
    [8, 6, 2, 17],   // pasillo oeste: motor superior → motor inferior
    [6, 13, 2, 2],   // entrada del reactor
    [10, 12, 2, 2],  // entrada de seguridad
    [8, 23, 8, 2],   // pasillo sur: motor inferior → almacén
    [12, 20, 2, 3],  // entrada de eléctrica (sala sin salida)
    [20, 8, 2, 11],  // cafetería → almacén
    [22, 14, 2, 2],  // entrada de administración
    [26, 3, 4, 2],   // cafetería → armería
    [33, 7, 2, 8],   // armería → navegación
    [32, 10, 1, 1],  // entrada de oxígeno
    [35, 13, 2, 2],  // entrada de navegación
    [39, 18, 2, 5],  // navegación → escudos
    [23, 23, 10, 2], // almacén → escudos
    [27, 25, 2, 1]   // entrada de comunicaciones
  ];

  const grid = Array.from({ length: H }, () => Array(W).fill(true));
  const carve = r => { for (let j = r[1]; j < r[1] + r[3]; j++) for (let i = r[0]; i < r[0] + r[2]; i++) grid[j][i] = false; };
  CORRIDORS.forEach(carve);
  ROOMS.forEach(x => carve(x.r));

  const roomAt = (i, j) => ROOMS.find(m => i >= m.r[0] && i < m.r[0] + m.r[2] && j >= m.r[1] && j < m.r[1] + m.r[3]);

  // [nombre, sala, celdaX, celdaY, tipo de minijuego]
  const STATIONS = [   // [nombre, sala, i, j, minijuego (public/tasks.js)]
    ['Conectar cables',        'electrica',      14, 16, 'wires'],
    ['Calibrar distribuidor',  'electrica',      11, 16, 'calibrate'],
    ['Descargar datos',        'comunicaciones', 30, 28, 'download'],
    ['Trazar rumbo',           'navegacion',     42, 14, 'course'],
    ['Iniciar reactor',        'reactor',        1,  11, 'simon'],
    ['Desbloquear colectores', 'reactor',        1,  16, 'manifolds'],
    ['Escáner médico',         'enfermeria',     14, 8,  'scan'],
    ['Analizar muestra',       'enfermeria',     11, 9,  'samples'],
    ['Repostar motor',         'motorinf',       1,  22, 'fuel'],
    ['Alinear motor',          'motores',        2,  2,  'align'],
    ['Pasar tarjeta',          'administracion', 29, 13, 'card'],
    ['Vaciar basura',          'almacen',        22, 26, 'trash'],
    ['Limpiar filtro',         'oxigeno',        28, 9,  'leaves'],
    ['Destruir asteroides',    'armeria',        31, 1,  'asteroids'],
    ['Activar escudos',        'escudos',        35, 21, 'shields']
  ].map((s, id) => ({ id, name: s[0], room: s[1], i: s[2], j: s[3], type: s[4] }));

  const cellPos = o => ({ x: (o.i + 0.5) * CELL, z: (o.j + 0.5) * CELL });
  // Paneles donde la tripulación arregla los sabotajes
  const PANELS = [
    { id: 'luces',    name: 'Panel de luces',            room: 'electrica',      i: 14, j: 19, type: 'switches' },
    { id: 'coms',     name: 'Panel de comunicaciones',   room: 'comunicaciones', i: 26, j: 28, type: 'code' },
    { id: 'reactorA', name: 'Control del reactor',       room: 'reactor',        i: 3,  j: 11, type: 'holdPanel' },
    { id: 'reactorB', name: 'Control del reactor',       room: 'reactor',        i: 3,  j: 16, type: 'holdPanel' },
    { id: 'o2a',      name: 'Depurador de oxígeno',      room: 'oxigeno',        i: 31, j: 11, type: 'code' },
    { id: 'o2b',      name: 'Depurador de oxígeno',      room: 'administracion', i: 24, j: 17, type: 'code' }
  ];
  // Terminales de información (las puede usar cualquier jugador vivo; las desactiva el sabotaje de comunicaciones salvo los signos vitales)
  const INFO = [
    { id: 'cams',    name: 'Cámaras de seguridad',    short: 'Cámaras', room: 'seguridad',      i: 15, j: 11 },
    { id: 'admin',   name: 'Panel de administración', short: 'Admin',   room: 'administracion', i: 26, j: 15 },
    { id: 'vitals',  name: 'Signos vitales',          short: 'Vitales', room: 'enfermeria',     i: 15, j: 9 },
    { id: 'doorlog', name: 'Registro de puertas',     short: 'Puertas', room: 'electrica',      i: 11, j: 19 }
  ];
  // Cámaras de seguridad: posición (x, altura, z) y punto al que miran
  const CAMERAS = [
    { id: 0, name: 'Pasillo de motores',   pos: [38.5, 2.6, 27],  look: [36, 1.0, 62] },
    { id: 1, name: 'Pasillo sur',          pos: [62, 2.6, 93.5],  look: [38, 1.0, 96] },
    { id: 2, name: 'Pasillo de Admin',     pos: [87.5, 2.6, 34],  look: [84, 1.0, 62] },
    { id: 3, name: 'Pasillo de Navegación', pos: [133.5, 2.6, 30], look: [136, 1.0, 54] }
  ];
  // Red de ventilaciones (solo las usa el impostor): dos grupos de salas conectadas
  const VENTS = [
    { id: 0,  room: 'reactor',        i: 2,  j: 13, links: [1, 2] },
    { id: 1,  room: 'motores',        i: 6,  j: 7,  links: [0] },
    { id: 2,  room: 'motorinf',       i: 6,  j: 21, links: [0] },
    { id: 3,  room: 'enfermeria',     i: 11, j: 6,  links: [4, 5] },
    { id: 4,  room: 'seguridad',      i: 13, j: 14, links: [3, 5] },
    { id: 5,  room: 'electrica',      i: 13, j: 17, links: [3, 4] },
    { id: 6,  room: 'cafeteria',      i: 25, j: 1,  links: [7] },
    { id: 7,  room: 'administracion', i: 28, j: 17, links: [6] },
    { id: 8,  room: 'navegacion',     i: 38, j: 11, links: [9, 10] },
    { id: 9,  room: 'armeria',        i: 35, j: 2,  links: [8] },
    { id: 10, room: 'escudos',        i: 37, j: 25, links: [8] }
  ];
  // Puertas de cada sala: las celdas de suelo pegadas a su borde
  const DOORS = {};
  ROOMS.forEach(rm => {
    const [x0, y0, w, h] = rm.r, cells = new Set();
    for (let j = y0; j < y0 + h; j++) for (let i = x0; i < x0 + w; i++) for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + a, nj = j + b, inside = ni >= x0 && ni < x0 + w && nj >= y0 && nj < y0 + h;
      if (!inside && nj >= 0 && nj < H && ni >= 0 && ni < W && !grid[nj][ni]) cells.add(ni + ',' + nj);
    }
    DOORS[rm.id] = [...cells].map(k => k.split(',').map(Number));
  });
  let closedCells = new Set();
  const setDoors = roomId => { closedCells = new Set(roomId && DOORS[roomId] ? DOORS[roomId].map(c => c[0] + ',' + c[1]) : []); };
  const isClosedCell = (x, z) => closedCells.size > 0 && closedCells.has(Math.floor(x / CELL) + ',' + Math.floor(z / CELL));

  const stationPos = st => ({ x: (st.i + 0.5) * CELL, z: (st.j + 0.5) * CELL });
  // Decoración con volumen (no se puede atravesar): x, z en metros y radio de choque. El cliente dibuja cada tipo.
  const DECOR = [
    { kind: 'core',   room: 'reactor',    x: 14,  z: 54,  r: 2.4 },
    { kind: 'table',  room: 'cafeteria',  x: 75,  z: 12,  r: 1.45 },
    { kind: 'table',  room: 'cafeteria',  x: 97,  z: 25,  r: 1.45 },
    { kind: 'bed',    room: 'enfermeria', x: 52,  z: 38.6, r: 1.25 },
    { kind: 'chair',  room: 'navegacion', x: 160, z: 58,  r: 1.1, rot: -Math.PI / 2 },
    { kind: 'crates', room: 'almacen',    x: 90,  z: 78.5, r: 1.5 },
    { kind: 'crates', room: 'almacen',    x: 66.5, z: 105.5, r: 1.3 },
    { kind: 'engine', room: 'motores',    x: 17,  z: 21,  r: 1.6, len: 7 },
    { kind: 'engine', room: 'motorinf',   x: 17,  z: 99,  r: 1.6, len: 7 }
  ];
  const BUTTON = { x: 86, z: 18 }; // mesa de la cafetería

  const isSolid = (x, z) => {
    const i = Math.floor(x / CELL), j = Math.floor(z / CELL);
    if (i < 0 || j < 0 || i >= W || j >= H) return true;
    return grid[j][i];
  };
  const blocked = (x, z, r) => {
    r = r || 0.45;
    if (isSolid(x - r, z - r) || isSolid(x + r, z - r) || isSolid(x - r, z + r) || isSolid(x + r, z + r)) return true;
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
      } else { dx = x - d.x; dz = z - d.z; if (dx * dx + dz * dz < (d.r + r) * (d.r + r)) return true; }
    }
    if (closedCells.size && (isClosedCell(x - r, z - r) || isClosedCell(x + r, z - r) || isClosedCell(x - r, z + r) || isClosedCell(x + r, z + r))) return true;
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
  const LOOK_SIZES = { s: SKINS.length, h: OPT.hair.length, hc: HAIR_COLORS.length, b: OPT.beard.length, g: OPT.glasses.length, t: OPT.hat.length, tc: CLOTHES.length, sh: CLOTHES.length, pa: CLOTHES.length, bd: OPT.build.length, ej: OPT.brows.length, hv: 4, hr: 2, ss: 2, mo: 2, ml: OPT.sleeve.length, pl: OPT.pants.length, ac: OPT.acc.length, tp: OPT.top.length, kit: OPT.kit.length, num: 100, nn: 2, pet: OPT.pet.length };
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

  const api = { DECOR, KITS, INFO, CAMERAS, SETTINGS, PRESETS, normalizeSettings, cellPos, PANELS, VENTS, DOORS, setDoors, isClosedCell, colors, SKINS, HAIR_COLORS, CLOTHES, OPT, randomLook, cleanLook, CELL, W, H, WALL_H, TASKS_PER, TABLE_R, COLORS, ROOMS, CORRIDORS, grid, roomAt, STATIONS, stationPos, BUTTON, isSolid, blocked, spawnPos };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Shared = api;
})(this);
