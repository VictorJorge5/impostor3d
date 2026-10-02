// Mapa y reglas compartidas entre servidor y cliente
(function (root) {
  const CELL = 4, W = 30, H = 22, WALL_H = 4.5, TASKS_PER = 4, TABLE_R = 1.8;

  const COLORS = [
    ['Rojo', '#e53935'], ['Azul', '#1e88e5'], ['Verde', '#43a047'], ['Amarillo', '#fdd835'],
    ['Naranja', '#fb8c00'], ['Morado', '#8e24aa'], ['Rosa', '#ec407a'], ['Cian', '#00acc1'],
    ['Marrón', '#6d4c41'], ['Blanco', '#eceff1']
  ];

  // r = [x, y, ancho, alto] en celdas
  const ROOMS = [
    { id: 'reactor',    name: 'Reactor',    r: [1, 1, 7, 6],   c: '#6e4747' },
    { id: 'electrica',  name: 'Eléctrica',  r: [22, 1, 7, 6],  c: '#6e6a3c' },
    { id: 'enfermeria', name: 'Enfermería', r: [1, 15, 7, 6],  c: '#3c6e64' },
    { id: 'motores',    name: 'Motores',    r: [22, 15, 7, 6], c: '#474c6e' },
    { id: 'cafeteria',  name: 'Cafetería',  r: [11, 8, 8, 6],  c: '#5f5f6b' },
    { id: 'navegacion', name: 'Navegación', r: [11, 1, 8, 4],  c: '#3c5c7e' },
    { id: 'almacen',    name: 'Almacén',    r: [11, 17, 8, 4], c: '#6e5c3c' }
  ];
  const CORRIDORS = [
    [3, 6, 2, 6], [3, 10, 8, 2], [25, 6, 2, 6], [19, 10, 8, 2], [3, 11, 2, 5], [25, 11, 2, 5],
    [14, 4, 2, 5], [14, 13, 2, 5], [7, 2, 5, 2], [18, 2, 5, 2], [7, 18, 5, 2], [18, 18, 5, 2]
  ];

  const grid = Array.from({ length: H }, () => Array(W).fill(true));
  const carve = r => { for (let j = r[1]; j < r[1] + r[3]; j++) for (let i = r[0]; i < r[0] + r[2]; i++) grid[j][i] = false; };
  CORRIDORS.forEach(carve);
  ROOMS.forEach(x => carve(x.r));

  const roomAt = (i, j) => ROOMS.find(m => i >= m.r[0] && i < m.r[0] + m.r[2] && j >= m.r[1] && j < m.r[1] + m.r[3]);

  // [nombre, sala, celdaX, celdaY, tipo de minijuego]
  const STATIONS = [
    ['Conectar cables',       'electrica',  25, 3,  'wires'],
    ['Calibrar distribuidor', 'electrica',  23, 5,  'seq'],
    ['Descargar datos',       'navegacion', 13, 2,  'hold'],
    ['Introducir rumbo',      'navegacion', 16, 2,  'code'],
    ['Iniciar reactor',       'reactor',    2,  2,  'seq'],
    ['Reparar cableado',      'reactor',    6,  5,  'wires'],
    ['Escáner médico',        'enfermeria', 2,  17, 'hold'],
    ['Analizar muestra',      'enfermeria', 6,  19, 'code'],
    ['Repostar motor',        'motores',    24, 17, 'hold'],
    ['Alinear motor',         'motores',    27, 19, 'seq'],
    ['Registrar inventario',  'almacen',    13, 19, 'code'],
    ['Vaciar basura',         'almacen',    16, 19, 'hold'],
    ['Cables de la cafetería','cafeteria',  12, 9,  'wires']
  ].map((s, id) => ({ id, name: s[0], room: s[1], i: s[2], j: s[3], type: s[4] }));

  const cellPos = o => ({ x: (o.i + 0.5) * CELL, z: (o.j + 0.5) * CELL });
  // Paneles donde la tripulación arregla los sabotajes
  const PANELS = [
    { id: 'luces',    name: 'Panel de luces',            room: 'electrica',  i: 27, j: 5,  type: 'switches' },
    { id: 'coms',     name: 'Panel de comunicaciones',   room: 'navegacion', i: 12, j: 4,  type: 'code' },
    { id: 'reactorA', name: 'Control del reactor',       room: 'reactor',    i: 1,  j: 4,  type: 'holdPanel' },
    { id: 'reactorB', name: 'Control del reactor',       room: 'motores',    i: 28, j: 16, type: 'holdPanel' },
    { id: 'o2a',      name: 'Depurador de oxígeno',      room: 'navegacion', i: 18, j: 1,  type: 'code' },
    { id: 'o2b',      name: 'Depurador de oxígeno',      room: 'almacen',    i: 11, j: 20, type: 'code' }
  ];
  // Terminales de información (las puede usar cualquier jugador vivo; las desactiva el sabotaje de comunicaciones salvo los signos vitales)
  const INFO = [
    { id: 'cams',    name: 'Cámaras de seguridad',    short: 'Cámaras', room: 'almacen',    i: 12, j: 17 },
    { id: 'admin',   name: 'Panel de administración', short: 'Admin',   room: 'cafeteria',  i: 18, j: 12 },
    { id: 'vitals',  name: 'Signos vitales',          short: 'Vitales', room: 'enfermeria', i: 5,  j: 15 },
    { id: 'doorlog', name: 'Registro de puertas',     short: 'Puertas', room: 'electrica',  i: 23, j: 1 }
  ];
  // Cámaras de seguridad: posición (x, altura, z) y punto al que miran
  const CAMERAS = [
    { id: 0, name: 'Pasillo oeste',  pos: [13, 3.7, 41],  look: [46, 1.0, 44] },
    { id: 1, name: 'Pasillo este',   pos: [107, 3.7, 41], look: [74, 1.0, 44] },
    { id: 2, name: 'Cafetería',      pos: [75, 3.9, 33],  look: [58, 0.8, 46] },
    { id: 3, name: 'Pasillo norte',  pos: [60, 3.7, 19],  look: [60, 1.0, 34] }
  ];
  // Red de ventilaciones (solo las usa el impostor): dos grupos de salas conectadas
  const VENTS = [
    { id: 0, room: 'reactor',    i: 5,  j: 1,  links: [1] },
    { id: 1, room: 'navegacion', i: 17, j: 4,  links: [0, 2] },
    { id: 2, room: 'electrica',  i: 28, j: 1,  links: [1, 3] },
    { id: 3, room: 'cafeteria',  i: 18, j: 8,  links: [2] },
    { id: 4, room: 'cafeteria',  i: 12, j: 13, links: [5] },
    { id: 5, room: 'enfermeria', i: 1,  j: 20, links: [4, 6] },
    { id: 6, room: 'almacen',    i: 18, j: 17, links: [5, 7] },
    { id: 7, room: 'motores',    i: 23, j: 20, links: [6] }
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
  const BUTTON = { x: 60, z: 44 }; // mesa de la cafetería

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
    hat: ['Nada', 'Gorra', 'Gorro', 'Cinta'],
    build: ['Delgado', 'Normal', 'Corpulento', 'Atlético'],
    brows: ['Normales', 'Finas', 'Gruesas'],
    sleeve: ['Larga', 'Corta'],
    pants: ['Largo', 'Corto'],
    acc: ['Nada', 'Bandolera']
  };
  const LOOK_SIZES = { s: SKINS.length, h: OPT.hair.length, hc: HAIR_COLORS.length, b: OPT.beard.length, g: OPT.glasses.length, t: OPT.hat.length, tc: CLOTHES.length, sh: CLOTHES.length, pa: CLOTHES.length, bd: OPT.build.length, ej: OPT.brows.length, hv: 4, hr: 2, ss: 2, mo: 2, ml: OPT.sleeve.length, pl: OPT.pants.length, ac: OPT.acc.length };
  const HEX = /^#[0-9a-fA-F]{6}$/, FACE_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, FACE_PATH = /^faces\/[a-z0-9_-]{1,24}\.(jpg|png)$/;
  const COLOR_KEYS = ['cs', 'ch', 'ct', 'csh', 'cp', 'cz', 'cl']; // colores libres (anulan la paleta)
  const randomLook = () => {
    const r = n => Math.floor(Math.random() * n), o = {};
    for (const k in LOOK_SIZES) o[k] = r(LOOK_SIZES[k]);
    o.b = Math.random() < 0.55 ? 0 : r(LOOK_SIZES.b);
    o.g = Math.random() < 0.65 ? 0 : 1 + r(3);
    o.t = Math.random() < 0.7 ? 0 : 1 + r(3);
    o.ht = 155 + r(41); o.hv = 0; o.hr = 0; o.ss = 0; o.mo = 0;
    o.ml = Math.random() < 0.7 ? 0 : 1; o.pl = Math.random() < 0.8 ? 0 : 1; o.ac = Math.random() < 0.85 ? 0 : 1;
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

  const api = { INFO, CAMERAS, SETTINGS, PRESETS, normalizeSettings, cellPos, PANELS, VENTS, DOORS, setDoors, isClosedCell, colors, SKINS, HAIR_COLORS, CLOTHES, OPT, randomLook, cleanLook, CELL, W, H, WALL_H, TASKS_PER, TABLE_R, COLORS, ROOMS, CORRIDORS, grid, roomAt, STATIONS, stationPos, BUTTON, isSolid, blocked, spawnPos };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Shared = api;
})(this);
