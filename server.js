const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const S = require('./public/shared.js');

const PORT = process.env.PORT || 3000;
const crypto = require('crypto');
const rooms = new Map();
const TS = Number(process.env.TIME_SCALE) || 1;      // solo para pruebas automáticas: acorta todos los tiempos
const ms = sec => Math.round(sec * 1000 * TS);
// mode: 'any' = un jugador arregla un panel | 'both' = hay que completar los dos paneles | 'simul' = mantener los dos a la vez
const SABS = {
  luces:   { name: 'Luces',          panels: ['luces'],                mode: 'any' },
  coms:    { name: 'Comunicaciones', panels: ['coms'],                 mode: 'any' },
  puertas: { name: 'Puertas' },
  reactor: { name: 'Reactor',        panels: ['reactorA', 'reactorB'], mode: 'simul', crisis: true },
  o2:      { name: 'Oxígeno',        panels: ['o2a', 'o2b'],           mode: 'both',  crisis: true }
};
const KILL_RANGES = { corta: 2.4, media: 3.8, larga: 5.5 };   // en metros; 1 unidad de The Skeld = 2,2 m (corta 1,1 · media 1,7 · larga 2,5)
const killCdMs = r => ms(r.set.killCd), firstKillMs = r => ms(Math.min(r.set.killCd, 10)), sabCdMs = r => ms(r.set.sabCd), sabFirstMs = r => ms(Math.min(r.set.sabCd, 20));
const sabMs = (r, t) => t === 'puertas' ? ms(r.set.doorTime) : t === 'reactor' ? ms(r.set.reactorTime) : t === 'o2' ? ms(r.set.o2Time) : 0;
const sabEnabled = (r, t) => ({ luces: r.set.sabLuces, coms: r.set.sabComs, puertas: r.set.sabPuertas, reactor: r.set.sabReactor, o2: r.set.sabO2 })[t];
// Lo que necesita saber el cliente de los ajustes
const clientCfg = r => ({
  visual: r.set.visualTasks !== false, speed: r.set.speed, visCrew: r.set.visCrew, visImp: r.set.visImp, killRange: KILL_RANGES[r.set.killRange], taskbar: r.set.taskbar, test: r.set.testMode, vents: r.set.vents, info: r.set.infoTools,
  sabs: { luces: r.set.sabLuces, coms: r.set.sabComs, puertas: r.set.sabPuertas, reactor: r.set.sabReactor, o2: r.set.sabO2 },
  times: { reactor: r.set.reactorTime, o2: r.set.o2Time, doors: r.set.doorTime }, sabCd: r.set.sabCd
});
// Orígenes que pueden conectarse desde otra web (la página publicada en Vercel). Por defecto: cualquier *.vercel.app y localhost.
// Para un dominio propio: ALLOWED_ORIGINS=https://impostor3d.es,https://www.impostor3d.es  ·  ALLOWED_ORIGINS=* abre a cualquiera.
const EXTRA_ORIGINS = String(process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);
const originOk = o => !o || EXTRA_ORIGINS.includes('*') || EXTRA_ORIGINS.includes(o) ||
  /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(o) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);
const STARTED = Date.now();
const SIO_CLIENT = path.join(path.dirname(require.resolve('socket.io')), '..', 'client-dist', 'socket.io.min.js');
const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.get('/health', (req, res) => {   // también sirve para "despertar" el servidor desde la página de Vercel
  res.set({ 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
  res.json({ ok: true, mapVer: S.MAP_VER, rooms: rooms.size, players: [...rooms.values()].reduce((n, r) => n + humans(r).length, 0), uptime: Math.round((Date.now() - STARTED) / 1000) });
});
// el cliente de Socket.IO con la misma versión que el servidor (la página de Vercel lleva su propia copia, generada en el build)
app.get('/vendor/socket.io.min.js', (req, res) => res.sendFile(SIO_CLIENT));
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, file) => {   // la página y la plantilla de amigos siempre frescas; el resto (caras, imágenes) en caché
    if (/\.(html|js|webmanifest)$/.test(file)) res.setHeader('Cache-Control', 'no-cache');
    else res.setHeader('Cache-Control', 'public, max-age=86400');
  }
}));
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: (o, cb) => cb(null, originOk(o)), methods: ['GET', 'POST'] },
  pingInterval: 20000, pingTimeout: 25000, maxHttpBufferSize: 1e6
});

const REPORT_RANGE = 7, TASK_RANGE = 5.5, BUTTON_RANGE = 6.5;
const RESULT_MS = ms(8), MAX_PLAYERS = 10, MIN_PLAYERS = 3, GRACE_MS = 60000, MAX_ROOMS = 300;

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const genCode = () => {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; let c;
  do { c = Array.from({ length: 4 }, () => abc[Math.floor(Math.random() * abc.length)]).join(''); } while (rooms.has(c));
  return c;
};
const list = r => [...r.players.values()];
const humans = r => list(r).filter(p => !p.isBot);
const pub = r => list(r).map(p => ({ id: p.id, name: p.name, color: p.color, look: p.look, alive: p.alive, x: p.x, z: p.z, ry: p.ry, vent: p.vent == null ? null : p.vent, pet: p.alive ? null : p.petAt || null }));
const emitLobby = r => io.to(r.code).emit('lobby', {
  code: r.code, hostId: r.hostId, settings: r.set,
  players: list(r).map(p => ({ id: p.id, name: p.name, color: p.color, look: p.look, offline: !!p.offline, bot: !!p.isBot, lx: p.lx, lz: p.lz }))
});
// la nave de la sala de espera (como el lobby del original): 26 x 15 m; cada uno aparece en un sitio libre del centro
const SHIP = { w: 26, h: 15 };
const SHIP_SPOTS = [[13, 6], [11, 8], [15, 8], [5, 5.5], [21, 5.5], [13, 10.5], [9.5, 11], [16.5, 12], [3, 8], [23, 8]];   // sitios libres de la nave de la sala de espera (como en la web)
const shipSpawn = (p, r) => { const used = r ? list(r).filter(q => q !== p && q.lx != null).map(q => [q.lx, q.lz]) : []; const free = SHIP_SPOTS.filter(([x, z]) => !used.some(([a, b]) => Math.hypot(a - x, b - z) < 1.5)); const [x, z] = (free.length ? free : SHIP_SPOTS)[0]; p.lx = x + Math.random() * .6 - .3; p.lz = z + Math.random() * .4 - .2; p.ldir = 1; p.lmv = 0; };

function placeSpawns(r) {
  const ps = list(r);
  ps.forEach((p, i) => { const s = S.spawnPos(i, ps.length); p.x = s.x; p.z = s.z; p.ry = s.ry; });
}

function winner(r) {
  if (r.set.testMode && (r.startN || 0) < MIN_PLAYERS) return null;   // en pruebas con 1 o 2 jugadores no termina sola; con 3 o más, como una partida normal
  const ps = list(r);
  const imp = ps.filter(p => p.role === 'impostor' && p.alive).length;
  const crew = ps.filter(p => p.role === 'crew' && p.alive).length;
  if (imp === 0) return 'crew';
  if (r.totalTasks > 0 && r.doneTasks >= r.totalTasks) return 'crew';
  if (imp >= crew) return 'impostor';
  return null;
}
function endGame(r, w, reason) {
  clearCams(r); clearTimeout(r.timer); clearTimeout(r.phaseTimer);
  if (r.sab) { clearTimeout(r.sab.timer); r.sab = null; }
  openDoors(r, true);
  r.state = 'end';
  r.endInfo = { winner: w, reason: reason || null, hostId: r.hostId, roles: endStats(r), mvp: mvpOf(r, reason === 'test' ? null : w) };
  io.to(r.code).emit('end', r.endInfo);
}
// Resultados: lo que hizo cada uno en la partida y el jugador más valioso del equipo ganador
function endStats(r) {
  return list(r).map(p => {
    const st = p.st || {};
    return { id: p.id, name: p.name, color: p.color, look: p.look, role: p.role, alive: p.alive, kills: st.kills || 0, tasks: (p.done || []).length, total: (p.tasks || []).length, reports: st.reports || 0, calls: st.calls || 0, votesOk: st.votesOk || 0, sabs: st.sabs || 0 };
  });
}
function mvpScore(p) {
  const st = p.st || {};
  return p.role === 'impostor' ? (st.kills || 0) * 4 + (st.sabs || 0) + (p.alive ? 2 : 0)
    : (p.done || []).length + (st.votesOk || 0) * 3 + (st.reports || 0) * 2 + (p.alive ? 1 : 0);
}
function mvpOf(r, w) {
  const team = list(r).filter(p => p.role && (w === 'crew' || w === 'impostor' ? p.role === w : true));
  let best = null, bs = -1; team.forEach(p => { const s = mvpScore(p); if (s > bs) { bs = s; best = p; } });
  return best && bs > 0 ? best.id : null;
}
function checkWin(r) {
  if (r.state !== 'play') return;
  const w = winner(r);
  if (w) endGame(r, w);
}

function doKill(r, killer, t) {
  t.alive = false; t.petAt = { x: t.x, z: t.z }; (r.roundDead = r.roundDead || []).push(t.id); clearHolds(r, t.id); killer.st = killer.st || {}; killer.st.kills = (killer.st.kills || 0) + 1;
  killer.x = t.x; killer.z = t.z;   // como en el original, el impostor salta hasta la víctima
  killer.killReadyAt = Date.now() + killCdMs(r);
  const body = { id: ++r.bodySeq, pid: t.id, color: t.color, look: t.look, x: t.x, z: t.z };
  r.bodies.push(body);
  io.to(r.code).emit('killed', { victim: t.id, body, by: killer.id });
  if (r.camViewers) { r.camViewers.delete(t.id); emitCam(r); }
  if (!killer.isBot) io.to(killer.id).emit('killCd', killCdMs(r));
  checkWin(r);
}
function emitProgress(r) {
  if (r.set.taskbar === 'nunca') return;
  r.shownDone = r.doneTasks; io.to(r.code).emit('progress', { done: r.shownDone, total: r.totalTasks });
}
function startGame(r) {
  humans(r).filter(p => p.offline).forEach(p => dropPlayer(r, p));
  const set = r.set, now = Date.now();
  r.state = 'play'; r.roundDead = []; r.bodies = []; r.bodySeq = 0; r.doneTasks = 0; r.shownDone = 0; r.sab = null; openDoors(r, true); r.doorReady = {}; r.doorLog = []; r.camViewers = new Set(); r.camN = 0;
  r.sabReadyAt = now + sabFirstMs(r); r.emReadyAt = now + ms(set.emergencyCd);
  const ps = shuffle(list(r)); r.startN = ps.length;
  let nImp = Math.min(set.impostors, Math.floor((ps.length - 1) / 2));
  if (set.testMode) {                                // en pruebas vale cualquier reparto
    nImp = Math.min(set.impostors, ps.length);
    const hi = ps.findIndex(p => p.id === r.hostId);
    if (set.hostRole === 'impostor') { nImp = Math.max(1, nImp); if (hi > 0) [ps[0], ps[hi]] = [ps[hi], ps[0]]; }
    else if (set.hostRole === 'tripulante') { nImp = Math.min(nImp, ps.length - 1); if (hi >= 0 && hi < ps.length - 1) [ps[ps.length - 1], ps[hi]] = [ps[hi], ps[ps.length - 1]]; }
  } else nImp = Math.max(1, nImp);
  // se reparten "tareas" (una consola suelta o una cadena de pasos); cada paso cuenta en la barra
  // como en el original: las comunes son las mismas para todos; cada uno recibe además sus largas y sus cortas
  const ofKind = kd => shuffle(S.TASK_UNITS.map((u, k) => k).filter(k => S.UNIT_KIND[k] === kd));
  const common = ofKind('common').slice(0, set.commonTasks).flatMap(k => S.pickUnit(S.TASK_UNITS[k])); r.common = common;
  if (!set.commonTasks && !set.longTasks && !set.shortTasks) set.shortTasks = 1;   // siempre hay al menos una tarea
  ps.forEach((p, i) => {
    p.role = i < nImp ? 'impostor' : 'crew';
    p.alive = true; p.petAt = null; p.done = []; p.vote = null; p.emergencies = set.emergencies; p.vent = null; p.killLeft = null; p.st = {}; p.fx = null;
    p.killReadyAt = now + firstKillMs(r);
    // el impostor no tiene tareas (salvo en el modo pruebas, para poder probar los minijuegos): así nadie espera por él
    p.tasks = p.role === 'impostor' && !set.testMode ? [] : common.concat(ofKind('long').slice(0, set.longTasks).concat(ofKind('short').slice(0, set.shortTasks)).flatMap(k => S.pickUnit(S.TASK_UNITS[k])));
  });
  r.totalTasks = ps.filter(p => p.role === 'crew').reduce((n, p) => n + p.tasks.length, 0);
  placeSpawns(r); settleRooms(r);
  const imps = ps.filter(p => p.role === 'impostor').map(p => p.id);
  for (const p of ps) {
    io.to(p.id).emit('start', {
      role: p.role, tasks: p.tasks, mates: p.role === 'impostor' ? imps : [],
      players: pub(r), total: set.taskbar === 'nunca' ? 0 : r.totalTasks, killCd: firstKillMs(r), sabCd: p.role === 'impostor' ? sabFirstMs(r) : 0,
      emCd: ms(set.emergencyCd), emerg: set.emergencies, cfg: clientCfg(r), common, impCount: imps.length
    });
  }
}

function startMeeting(r, caller, kind, body) {
  r.state = 'meeting'; r.bodies = []; clearCams(r);
  caller.st = caller.st || {}; if (kind === 'body') caller.st.reports = (caller.st.reports || 0) + 1; else caller.st.calls = (caller.st.calls || 0) + 1;
  if (r.sab && SABS[r.sab.type].crisis) endSab(r, false);   // como en el original: luces y comunicaciones siguen tras la reunión
  openDoors(r);   // y la reunión abre todas las puertas
  list(r).forEach(p => { p.vent = null; p.vote = null; p.fx = null; });
  const victim = body ? r.players.get(body.pid) : null, dMs = ms(r.set.discuss), vMs = ms(r.set.voteTime), now = Date.now();
  r.meetingPhase = dMs > 0 ? 'discuss' : 'vote'; r.discussEnds = now + dMs; r.meetingEnds = now + dMs + vMs;
  r.meetingCaller = caller.id; r.meetingKind = kind; r.meetingVictimName = victim ? victim.name : null; r.meetingVictim = victim ? victim.id : null; r.meetingDead = r.roundDead || []; r.roundDead = []; r.lastResult = null;
  io.to(r.code).emit('meeting', {
    caller: caller.id, kind, victim: victim ? victim.id : null, victimName: victim ? victim.name : null, victimColor: victim ? victim.color : null, dead: r.meetingDead,
    ends: dMs + vMs, discuss: dMs, vote: vMs
  });
  if (r.set.taskbar === 'reuniones') emitProgress(r);
  clearTimeout(r.timer); clearTimeout(r.phaseTimer);
  if (dMs > 0) r.phaseTimer = setTimeout(() => {
    if (r.state !== 'meeting' || r.meetingPhase !== 'discuss') return;
    r.meetingPhase = 'vote'; io.to(r.code).emit('meetingPhase', { phase: 'vote' });
  }, dMs);
  r.timer = setTimeout(() => resolveMeeting(r), dMs + vMs);
  scheduleBotVotes(r, dMs, vMs);
}

function resolveMeeting(r) {
  if (r.state !== 'meeting') return;
  clearTimeout(r.timer); clearTimeout(r.phaseTimer);
  const alive = list(r).filter(p => p.alive);
  const tally = {}; let skips = 0;
  alive.forEach(p => {   // votar a un impostor cuenta para el MVP de la tripulación
    const vt = p.vote && p.vote !== 'skip' ? r.players.get(p.vote) : null;
    if (vt && vt.role === 'impostor' && p.role === 'crew') { p.st = p.st || {}; p.st.votesOk = (p.st.votesOk || 0) + 1; }
    if (p.vote === null || p.vote === 'skip') skips++;   // como en el original: quien no vota cuenta como "saltar"
    else tally[p.vote] = (tally[p.vote] || 0) + 1;
  });
  let top = null, max = 0, tie = false;
  for (const [id, n] of Object.entries(tally)) {
    if (n > max) { max = n; top = id; tie = false; } else if (n === max) tie = true;
  }
  let info = null;
  if (top && !tie && max > skips) {
    const e = r.players.get(top);
    if (e) { e.alive = false; e.petAt = S.freeNear(S.BUTTON.x + (Math.random() * 8 - 4), S.BUTTON.z + 4 + Math.random() * 2); info = { id: e.id, name: e.name, color: e.color, impostor: r.set.confirmEjects ? e.role === 'impostor' : null }; }
  }
  r.state = 'result';
  const anon = r.set.anonVotes;
  r.lastResult = {
    ejected: info, tie: !info && tie, anon, confirm: r.set.confirmEjects, ms: RESULT_MS, impLeft: r.set.confirmEjects ? list(r).filter(q => q.role === 'impostor' && q.alive).length : null,
    votes: anon ? null : alive.map(p => ({ from: p.id, to: p.vote || 'skip' })),
    counts: anon ? Object.assign({}, tally, { skip: skips }) : null
  };
  io.to(r.code).emit('meetingResult', r.lastResult);
  r.timer = setTimeout(() => {
    const w = winner(r);
    if (w) return endGame(r, w);
    r.state = 'play';
    placeSpawns(r); settleRooms(r);
    const now = Date.now();
    list(r).forEach(p => { p.killReadyAt = now + killCdMs(r); p.vent = null; p.killLeft = null; p.path = []; });
    if (!r.sab) r.sabReadyAt = now + sabFirstMs(r); r.emReadyAt = now + ms(r.set.emergencyCd);
    io.to(r.code).emit('resume', { players: pub(r), killCd: killCdMs(r), sabCd: r.sab ? -1 : sabFirstMs(r), emCd: ms(r.set.emergencyCd), sab: sabInfo(r), doors: doorInfo(r) });
  }, RESULT_MS);
}

function allVoted(r) { return list(r).filter(p => p.alive).every(p => p.vote !== null); }


// ---------- sabotajes ----------
function sabInfo(r) {
  const s = r.sab; if (!s) return null; const cfg = SABS[s.type];
  return { type: s.type, room: s.room, ends: s.endsAt ? Math.max(0, s.endsAt - Date.now()) : 0, panels: cfg.panels || [], mode: cfg.mode || null, crisis: !!cfg.crisis, holds: s.holds, done: [...s.done] };
}
function startSab(r, type, roomId) {
  const cfg = SABS[type], dur = sabMs(r, type);
  r.sab = { type, room: roomId, endsAt: dur ? Date.now() + dur : 0, done: new Set(), holds: {}, timer: null };
  r.sabReadyAt = Infinity;
  if (dur) r.sab.timer = setTimeout(() => {
    if (!r.sab || r.sab.type !== type || r.state !== 'play') return;
    if (cfg.crisis) endGame(r, 'impostor', 'sabotage:' + type); else endSab(r, true);
  }, dur);
  if (type === 'coms') clearCams(r);
  io.to(r.code).emit('sabotage', sabInfo(r));
}
function endSab(r, fixed) {
  if (!r.sab) return;
  clearTimeout(r.sab.timer); const type = r.sab.type; r.sab = null; r.sabReadyAt = Date.now() + sabCdMs(r);
  io.to(r.code).emit('sabotageEnd', { type, fixed, cd: sabCdMs(r) });
}
// puertas (como en The Skeld): cada sala se cierra por su cuenta y se pueden cerrar varias a la vez; mientras haya puertas
// cerradas no se puede provocar otro sabotaje (ni al revés), pero sí pulsar el botón de emergencia
const DOOR_CD = 10;   // segundos que tarda en poder volver a cerrarse una sala después de abrirse
function doorInfo(r) { const now = Date.now(), closed = {}, ready = {}; for (const [k, d] of Object.entries(r.doors || {})) closed[k] = Math.max(0, d.until - now); for (const [k, t] of Object.entries(r.doorReady || {})) if (t > now) ready[k] = t - now; return { closed, ready }; }
function emitDoors(r) { io.to(r.code).emit('doors', doorInfo(r)); }
function closeDoors(r, roomId) {
  const dur = ms(r.set.doorTime); r.doors = r.doors || {};
  r.doors[roomId] = { until: Date.now() + dur, timer: setTimeout(() => { if (!r.doors || !r.doors[roomId]) return; delete r.doors[roomId]; r.doorReady[roomId] = Date.now() + ms(DOOR_CD); emitDoors(r); }, dur) };
  emitDoors(r);
}
function openDoors(r, silent) { for (const d of Object.values(r.doors || {})) clearTimeout(d.timer); const had = r.doors && Object.keys(r.doors).length; r.doors = {}; if (had && !silent) emitDoors(r); }
function sabState(r) { if (r.sab) io.to(r.code).emit('sabState', { holds: r.sab.holds, done: [...r.sab.done] }); }
function clearHolds(r, pid) {
  if (!r.sab) return; let ch = false;
  for (const k of Object.keys(r.sab.holds)) if (r.sab.holds[k] === pid) { delete r.sab.holds[k]; ch = true; }
  if (ch) sabState(r);
}


// ---------- herramientas de información: registro de puertas y cámaras ----------
const roomIdAt = p => { const rm = S.roomAtPos(p.x, p.z); return rm ? rm.id : null; };
function logDoor(r, p, kind, room) { r.doorLog.push({ t: Date.now(), pid: p.id, name: p.name, color: p.color, kind, room }); if (r.doorLog.length > 80) r.doorLog.shift(); }
function trackRooms(r, now) {   // anota cuando alguien entra o sale de una sala (con un pequeño margen para no anotar rebotes en el umbral)
  if (!r.doorLog) r.doorLog = [];
  for (const p of list(r)) {
    const cur = roomIdAt(p);
    if (!p.alive || p.vent != null || p.roomNow === undefined) { p.roomNow = cur; p.roomCand = cur; continue; }
    if (cur === p.roomNow) { p.roomCand = cur; continue; }
    if (cur !== p.roomCand) { p.roomCand = cur; p.roomSince = now; continue; }
    if (now - p.roomSince >= 200) { if (p.roomNow) logDoor(r, p, 'sale', p.roomNow); if (cur) logDoor(r, p, 'entra', cur); p.roomNow = cur; }
  }
}
function settleRooms(r) { list(r).forEach(p => { p.roomNow = roomIdAt(p); p.roomCand = p.roomNow; }); }
function emitCam(r) { const n = r.camViewers ? r.camViewers.size : 0; if (n !== r.camN) { r.camN = n; io.to(r.code).emit('camState', { n }); } }
function clearCams(r) { if (r.camViewers && r.camViewers.size) { r.camViewers.clear(); } emitCam(r); }
// ¿puede este jugador usar ahora esa terminal? (devuelve el motivo si no)
function infoBlock(r, p, tool) {
  if (!r || !p) return 'No estás en una sala';
  if (r.state !== 'play') return 'Ahora no se puede';
  if (!r.set.infoTools) return 'Los terminales de información están desactivados en esta partida';
  const t = S.INFO.find(q => q.id === tool); if (!t) return 'Terminal desconocido';
  if (dist(p, S.cellPos(t)) > 5.5) return 'Estás demasiado lejos del terminal';
  if (tool !== 'vitals' && r.sab && r.sab.type === 'coms') return 'Sin señal: comunicaciones caídas';
  return null;
}

// Quita a un jugador de la sala de forma definitiva (salir, o caducar la reconexión)
function dropPlayer(r, p) {
  clearTimeout(p.dropTimer); clearHolds(r, p.id); if (r.camViewers) { r.camViewers.delete(p.id); emitCam(r); }
  if (!r.players.has(p.id)) return;
  r.players.delete(p.id);
  if (humans(r).length === 0) { clearTimeout(r.timer); clearTimeout(r.phaseTimer); if (r.sab) clearTimeout(r.sab.timer); openDoors(r, true); rooms.delete(r.code); return; }
  if (r.hostId === p.id) { const all = humans(r), next = all.find(q => !q.offline) || all[0]; r.hostId = next.id; }
  if (r.state === 'lobby') return emitLobby(r);
  io.to(r.code).emit('left', { id: p.id, hostId: r.hostId });
  if (p.role === 'crew') {
    r.totalTasks -= p.tasks.length; r.doneTasks -= p.done.length;
    if (r.set.taskbar === 'siempre') emitProgress(r);
  }
  const why = p.role === 'impostor' ? 'disconnect:impostor' : 'disconnect:crew';   // como en el original: si se van, gana el otro bando
  if (r.state === 'play') { const w = winner(r); if (w) endGame(r, w, why); }
  else if ((r.state === 'meeting' || r.state === 'result') && winner(r)) endGame(r, winner(r), why);
  else if (r.state === 'meeting' && r.meetingPhase === 'vote' && allVoted(r)) resolveMeeting(r);
}
// Estado completo para quien vuelve a entrar en mitad de la partida
function snapshot(r, p) {
  const s = {
    state: r.state, hostId: r.hostId, common: r.common || [], role: p.role, tasks: p.tasks, done: p.done, alive: p.alive, vote: p.vote, emerg: p.emergencies,
    mates: p.role === 'impostor' ? list(r).filter(q => q.role === 'impostor').map(q => q.id) : [],
    players: pub(r), bodies: r.bodies, total: r.set.taskbar === 'nunca' ? 0 : r.totalTasks, doneN: r.set.taskbar === 'siempre' ? r.doneTasks : (r.shownDone || 0), killCd: Math.max(0, (p.killReadyAt || 0) - Date.now()),
    sab: sabInfo(r), doors: doorInfo(r), cam: r.camViewers ? r.camViewers.size : 0, vent: p.vent == null ? null : p.vent, cfg: clientCfg(r), emCd: Math.max(0, (r.emReadyAt || 0) - Date.now()),
    sabCd: p.role === 'impostor' ? (r.sabReadyAt === Infinity ? -1 : Math.max(0, (r.sabReadyAt || 0) - Date.now())) : 0
  };
  if (r.state === 'meeting' || r.state === 'result') s.meeting = {
    ends: Math.max(0, (r.meetingEnds || 0) - Date.now()), phase: r.meetingPhase, discussLeft: r.meetingPhase === 'discuss' ? Math.max(0, r.discussEnds - Date.now()) : 0, caller: r.meetingCaller, kind: r.meetingKind, victim: r.meetingVictim, victimName: r.meetingVictimName, dead: r.meetingDead || [],
    voted: list(r).filter(q => q.alive && q.vote !== null).map(q => q.id)
  };
  if (r.state === 'result') s.result = r.lastResult;
  if (r.state === 'end') s.end = Object.assign({}, r.endInfo, { hostId: r.hostId });
  return s;
}

io.on('connection', sock => {
  let room = null, me = null;
  sock.on('lat', cb => { if (typeof cb === 'function') cb(Date.now()); });   // el cliente mide su latencia (ping)

  sock.on('join', (data, cb) => {
    cb = typeof cb === 'function' ? cb : () => {};
    if (room) return cb({ error: 'Ya estás en una sala' });
    const name = String((data && data.name) || '').trim().slice(0, 12) || 'Jugador';
    let r;
    if (!data || data.mapVer !== S.MAP_VER) return cb({ error: 'Tu página es de otra versión del juego. Recarga la página para jugar.', reload: true });
    if (data && data.code) {
      r = rooms.get(String(data.code).toUpperCase().trim());
      if (!r) return cb({ error: 'No existe esa sala' });
      if (r.state !== 'lobby') return cb({ error: 'La partida ya ha empezado' });
      if (r.players.size >= MAX_PLAYERS) trimBots(r, MAX_PLAYERS - 1);
      if (r.players.size >= MAX_PLAYERS) return cb({ error: 'La sala está llena' });
    } else {
      if (rooms.size >= MAX_ROOMS) return cb({ error: 'Servidor lleno, prueba en unos minutos' });
      r = { code: genCode(), hostId: sock.id, players: new Map(), state: 'lobby', set: S.normalizeSettings({}), bodies: [], bodySeq: 0, timer: null, totalTasks: 0, doneTasks: 0, camViewers: new Set(), camN: 0, doorLog: [] };
      rooms.set(r.code, r);
    }
    const used = new Set(list(r).map(p => p.color)), look = S.cleanLook(data && data.look);
    let color = used.has(look.col) ? 0 : look.col; while (used.has(color)) color++;   // el color que eligió, si está libre (como en Among Us)
    const sp = S.freeNear(S.BUTTON.x, S.BUTTON.z + 5);
    me = { id: sock.id, name, color, look, x: sp.x, z: sp.z, ry: 0, alive: true, role: null, tasks: [], done: [], vote: null, emergencies: 1, killReadyAt: 0, vent: null, token: crypto.randomBytes(12).toString('hex'), offline: false, lastChat: 0 };
    shipSpawn(me, r); r.players.set(sock.id, me);
    room = r;
    sock.join(r.code);
    cb({ ok: true, id: sock.id, code: r.code, token: me.token, mapVer: S.MAP_VER });
    syncBots(r); emitLobby(r);
  });

  // El anfitrión cambia un ajuste (o aplica un preset) en la sala
  // en la sala de espera cada uno anda por la nave y se puede cambiar en el armario
  sock.on('lmove', m => {
    if (!room || room.state !== 'lobby' || !m) return; const x = +m.x, z = +m.z; if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    me.lx = Math.max(1, Math.min(SHIP.w - 1, x)); me.lz = Math.max(1, Math.min(SHIP.h - 1, z)); me.ldir = m.dir < 0 ? -1 : 1; me.lmv = m.mv ? 1 : 0;
  });
  sock.on('lobbyLook', d => {
    if (!room || room.state !== 'lobby' || !d) return;
    const look = S.cleanLook(d.look), used = new Set(list(room).filter(q => q !== me).map(q => q.color));
    if (typeof d.name === 'string' && d.name.trim()) me.name = d.name.trim().slice(0, 12);
    me.look = look; if (!used.has(look.col)) me.color = look.col;
    emitLobby(room);
  });
  sock.on('settings', d => {
    if (!room || room.hostId !== sock.id || room.state !== 'lobby' || !d || typeof d !== 'object') return;
    if (d.preset !== undefined) { const p = S.PRESETS[String(d.preset)]; if (!p) return; room.set = S.normalizeSettings(p.set); }
    else if (d.all && typeof d.all === 'object') room.set = S.normalizeSettings(d.all);
    else if (typeof d.k === 'string' && S.SETTINGS.some(q => q.k === d.k)) room.set = S.normalizeSettings(Object.assign({}, room.set, { [d.k]: d.v }));
    else return;
    syncBots(room); emitLobby(room);
  });
  // Modo pruebas: el anfitrión da la prueba por terminada
  sock.on('endTest', () => {
    if (!room || room.hostId !== sock.id || !room.set.testMode || !['play', 'meeting', 'result'].includes(room.state)) return;
    endGame(room, 'crew', 'test');
  });

  sock.on('start', () => {
    if (!room || room.hostId !== sock.id || room.state !== 'lobby') return;
    const minP = room.set.testMode ? 1 : MIN_PLAYERS;
    humans(room).filter(p => p.offline).forEach(p => dropPlayer(room, p));   // los desconectados no cuentan
    if (!rooms.has(room.code)) return;
    if (room.players.size < minP) return sock.emit('toast', `Hacen falta al menos ${minP} jugadores`);
    startGame(room);
  });

  sock.on('move', m => {
    if (!room || room.state !== 'play' || !m) return;
    const x = +m.x, z = +m.z, ry = +m.ry;
    if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(ry)) return;
    if (me.vent != null) return;                      // dentro de una ventilación no se mueve por el mapa
    me.x = x; me.z = z; me.ry = ry; me.mv = m.mv ? 1 : 0;
    if (room.sab && Object.values(room.sab.holds).includes(me.id)) {
      for (const [pid, who] of Object.entries(room.sab.holds)) if (who === me.id) { const pn = S.PANELS.find(q => q.id === pid); if (!pn || dist(me, S.cellPos(pn)) > 6.5) clearHolds(room, me.id); }
    }
  });

  sock.on('kill', tid => {
    if (!room || room.state !== 'play' || !me.alive || me.role !== 'impostor' || me.vent != null) return;
    const now = Date.now();
    if (now < me.killReadyAt) return;
    const t = room.players.get(tid);
    if (!t || !t.alive || t.role === 'impostor') return;
    if (dist(me, t) > KILL_RANGES[room.set.killRange] || S.wallBetween(me.x, me.z, t.x, t.z)) return;   // no se mata a través de las paredes
    doKill(room, me, t);
  });

  sock.on('task', id => {
    // también los fantasmas de la tripulación. El impostor solo tiene tareas falsas, como en el original
    // (en el modo pruebas sí puede hacerlas, para probar los minijuegos; allí no suman a la barra)
    if (!room || room.state !== 'play' || !me.role) return;
    if (me.role === 'impostor' && !room.set.testMode) return;
    if (!me.tasks.includes(id) || me.done.includes(id)) return;
    const pv = S.taskPrev(me.tasks)[id]; if (pv != null && !me.done.includes(pv)) return;   // las tareas por pasos van en orden
    const st = S.STATIONS[id];
    if (!st) return;
    const sp = S.stationPos(st);
    if (Math.hypot(me.x - sp.x, me.z - sp.z) > TASK_RANGE) return;
    me.done.push(id);
    sock.emit('taskDone', id);
    if (me.role !== 'crew') return;
    room.doneTasks++;
    if (room.set.taskbar === 'siempre') emitProgress(room);
    checkWin(room);
  });

  sock.on('report', () => {
    if (!room || room.state !== 'play' || !me.alive || me.vent != null) return;
    let best = null, bd = REPORT_RANGE;
    for (const b of room.bodies) { const d = dist(me, b); if (d < bd) { bd = d; best = b; } }
    if (best) startMeeting(room, me, 'body', best);
  });

  sock.on('emergency', () => {
    if (!room || room.state !== 'play' || !me.alive || me.vent != null || me.emergencies < 1) return;
    if (room.sab) return sock.emit('toast', 'No se puede convocar una reunión durante un sabotaje');   // las puertas cerradas no lo impiden
    if (dist(me, S.BUTTON) > BUTTON_RANGE) return;
    if (Date.now() < room.emReadyAt) return sock.emit('toast', `El botón se está recargando (${Math.ceil((room.emReadyAt - Date.now()) / 1000 / TS)} s)`);
    me.emergencies--;
    startMeeting(room, me, 'button', null);
  });


  // El impostor provoca un sabotaje
  sock.on('sabotage', d => {
    // el impostor fantasma también puede sabotear (como en el original), pero no matar ni usar rejillas
    if (!room || room.state !== 'play' || me.role !== 'impostor' || me.vent != null || !d) return;
    const cfg = SABS[d.type]; if (!cfg) return;
    if (!sabEnabled(room, d.type)) return sock.emit('toast', 'Ese sabotaje está desactivado en esta partida');
    if (room.sab) return sock.emit('toast', 'Ya hay un sabotaje en marcha');
    me.st = me.st || {};
    if (d.type === 'puertas') {
      const roomId = String(d.room || ''); if (!S.ROOMS.some(q => q.id === roomId)) return;
      if (room.doors && room.doors[roomId]) return sock.emit('toast', 'Esas puertas ya están cerradas');
      if (Date.now() < (room.doorReady[roomId] || 0)) return sock.emit('toast', 'Esas puertas se están recargando');
      me.st.sabs = (me.st.sabs || 0) + 1; return closeDoors(room, roomId);
    }
    if (room.doors && Object.keys(room.doors).length) return sock.emit('toast', 'Espera a que se abran las puertas');
    if (Date.now() < room.sabReadyAt) return sock.emit('toast', 'El sabotaje se está recargando');
    me.st.sabs = (me.st.sabs || 0) + 1;
    startSab(room, d.type, null);
  });
  // Tareas visuales: el resto ve el escáner, los asteroides, la basura o los escudos mientras un tripulante los hace
  sock.on('taskfx', d => {
    if (!room || room.state !== 'play' || !d) return;
    const id = +d.id, st = S.STATIONS[id];
    if (!d.on) { if (me.fx === id) { me.fx = null; io.to(room.code).emit('taskfx', { pid: me.id, st: id, on: false }); } return; }
    if (!st || !S.VISUAL_TASKS.includes(st.type) || room.set.visualTasks === false || !me.alive || me.role !== 'crew' || !me.tasks.includes(id)) return;
    if (dist(me, S.stationPos(st)) > TASK_RANGE) return;
    me.fx = id; io.to(room.code).emit('taskfx', { pid: me.id, st: id, on: true });
  });
  // Modo pruebas: el anfitrión provoca cualquier sabotaje sin importar su rol ni la recarga
  sock.on('testSabotage', d => {
    if (!room || room.hostId !== sock.id || !room.set.testMode || room.state !== 'play' || !d || !SABS[d.type] || room.sab) return;
    if (d.type === 'puertas') { const roomId = String(d.room || ''); if (!S.ROOMS.some(q => q.id === roomId) || (room.doors && room.doors[roomId])) return; return closeDoors(room, roomId); }
    startSab(room, d.type, null);
  });
  // Cualquiera vivo arregla un panel (luces, comunicaciones, oxígeno): también el impostor, para disimular
  sock.on('fix', d => {
    if (!room || room.state !== 'play' || !me.alive || !me.role || !room.sab || !d) return;
    const cfg = SABS[room.sab.type], id = String(d.panel || '');
    if (!cfg.panels || !cfg.panels.includes(id) || cfg.mode === 'simul') return;
    const pn = S.PANELS.find(q => q.id === id); if (!pn || dist(me, S.cellPos(pn)) > TASK_RANGE + 0.5) return;
    if (cfg.mode === 'any') return endSab(room, true);
    room.sab.done.add(id); sabState(room);
    if (cfg.panels.every(q => room.sab.done.has(q))) endSab(room, true);
  });
  // Reactor: dos jugadores mantienen los dos paneles a la vez
  sock.on('hold', d => {
    if (!room || room.state !== 'play' || !me.alive || !me.role || !room.sab || !d) return;
    const cfg = SABS[room.sab.type], id = String(d.panel || '');
    if (cfg.mode !== 'simul' || !cfg.panels.includes(id)) return;
    if (d.on) {
      const pn = S.PANELS.find(q => q.id === id); if (!pn || dist(me, S.cellPos(pn)) > TASK_RANGE + 0.5) return;
      clearHolds(room, me.id); room.sab.holds[id] = me.id;
    } else if (room.sab.holds[id] === me.id) delete room.sab.holds[id];
    sabState(room);
    const who = cfg.panels.map(q => room.sab.holds[q]);
    if (who.every(Boolean) && new Set(who).size === who.length) endSab(room, true);
  });
  // Ventilaciones del impostor
  sock.on('vent', d => {
    if (!room || room.state !== 'play' || !me.alive || me.role !== 'impostor' || !d) return;
    if (!room.set.vents) return sock.emit('toast', 'Las ventilaciones están desactivadas en esta partida');
    if (d.action === 'enter') {
      const v = S.VENTS[+d.id]; if (!v || me.vent != null) return;
      const vp = S.cellPos(v); if (dist(me, vp) > 4.8) return;
      me.vent = v.id; me.x = vp.x; me.z = vp.z; me.mv = 0; clearHolds(room, me.id);
      me.killLeft = Math.max(0, me.killReadyAt - Date.now());   // dentro de la rejilla la recarga de matar se para
      io.to(room.code).emit('ventfx', { id: me.id, x: vp.x, z: vp.z, out: false });
    } else if (d.action === 'move') {
      const cur = me.vent == null ? null : S.VENTS[me.vent], nx = S.VENTS[+d.id];
      if (!cur || !nx || !cur.links.includes(nx.id)) return;
      const vp = S.cellPos(nx); me.vent = nx.id; me.x = vp.x; me.z = vp.z;
    } else if (d.action === 'exit') {
      if (me.vent == null) return;
      const v = S.VENTS[me.vent], vp = S.cellPos(v); me.vent = null;
      if (me.killLeft != null) { me.killReadyAt = Date.now() + me.killLeft; sock.emit('killCd', me.killLeft); me.killLeft = null; }
      io.to(room.code).emit('ventfx', { id: me.id, x: vp.x, z: vp.z, out: true });
    } else return;
    me.roomNow = roomIdAt(me); me.roomCand = me.roomNow;
    sock.emit('ventState', { id: me.vent, x: me.x, z: me.z });
  });


  // Terminales de información
  sock.on('infoDoorlog', (d, cb) => {
    cb = typeof cb === 'function' ? cb : () => {};
    const err = infoBlock(room, me, 'doorlog'); if (err) return cb({ error: err });
    const now = Date.now();
    cb({ ok: true, log: (room.doorLog || []).slice(-30).reverse().map(e => ({ pid: e.pid, name: e.name, color: e.color, kind: e.kind, room: e.room, ago: now - e.t })) });
  });
  sock.on('camera', d => {   // quien mira las cámaras hace parpadear la luz roja de las cámaras para todos
    if (!room || !me) return;
    // los fantasmas pueden mirar, pero no encienden la luz roja (como en el original)
    if (d && d.on) { if (infoBlock(room, me, 'cams') || !me.alive) return; room.camViewers.add(me.id); } else room.camViewers.delete(me.id);
    emitCam(room);
  });

  sock.on('chat', text => {
    // Los vivos hablan en las reuniones; los fantasmas hablan entre ellos en cualquier momento y solo les leen otros fantasmas
    if (!room || !me || !me.role || (me.alive && room.state !== 'meeting') || !['play', 'meeting', 'result'].includes(room.state)) return;
    text = String(text || '').trim().slice(0, 140);
    if (!text || Date.now() - (me.lastChat || 0) < 500) return;
    me.lastChat = Date.now();
    const m = { id: me.id, name: me.name, color: me.color, text, ghost: !me.alive };
    if (me.alive) io.to(room.code).emit('chat', m); else list(room).filter(q => !q.alive && !q.isBot).forEach(q => io.to(q.id).emit('chat', m));
  });

  sock.on('vote', target => {
    if (!room || room.state !== 'meeting' || !me.alive || me.vote !== null) return;
    if (room.meetingPhase !== 'vote') return sock.emit('toast', 'Todavía no se puede votar: es el tiempo de discusión');
    if (target !== 'skip') { const t = room.players.get(target); if (!t || !t.alive) return; }
    me.vote = target;
    io.to(room.code).emit('voted', { id: me.id });
    if (allVoted(room)) resolveMeeting(room);
  });

  sock.on('again', () => {
    if (!room || room.hostId !== sock.id || room.state !== 'end') return;
    room.state = 'lobby';
    list(room).forEach(p => { p.alive = true; p.role = null; p.tasks = []; p.done = []; p.vote = null; p.lx = null; });
    list(room).forEach(p => shipSpawn(p, room));
    io.to(room.code).emit('toLobby');
    emitLobby(room);
  });

  // Si se cae la conexión (cambiar de app, recargar la página...) se conserva su sitio un minuto
  sock.on('disconnect', () => {
    if (!room || !me || room.players.get(sock.id) !== me) return;
    const r = room, p = me;
    p.offline = true; p.mv = 0; clearHolds(r, p.id); if (r.camViewers) { r.camViewers.delete(p.id); emitCam(r); }
    io.to(r.code).emit('presence', { id: p.id, offline: true, name: p.name });
    if ((r.state === 'lobby' || r.state === 'end') && r.hostId === p.id) {   // el anfitrión se ha ido: otro puede empezar o volver a jugar
      const next = humans(r).find(q => !q.offline); if (next) { r.hostId = next.id; if (r.state === 'end') io.to(r.code).emit('left', { id: null, hostId: r.hostId }); }
    }
    if (r.state === 'lobby') emitLobby(r);
    p.dropTimer = setTimeout(() => dropPlayer(r, p), GRACE_MS);
  });

  sock.on('leave', () => {
    if (!room || !me) return;
    const r = room, p = me; room = null; me = null; sock.leave(r.code);
    dropPlayer(r, p);
  });

  sock.on('rejoin', (d, cb) => {
    cb = typeof cb === 'function' ? cb : () => {};
    if (room) return cb({ error: 'Ya estás en una sala' });
    const r = rooms.get(String((d && d.code) || '').toUpperCase().trim()), tok = String((d && d.token) || '');
    const p = r && tok ? list(r).find(q => q.token === tok) : null;
    if (!p) return cb({ error: 'La sesión ha caducado' });
    clearTimeout(p.dropTimer); p.offline = false;
    const old = p.id;
    if (old !== sock.id) {
      const oldSock = io.sockets.sockets.get(old);
      clearHolds(r, old); if (r.camViewers && r.camViewers.delete(old)) emitCam(r); p.fx = null;   // lo que dejaba colgado el socket viejo
      r.players.delete(old); p.id = sock.id; r.players.set(p.id, p);
      if (r.hostId === old) r.hostId = p.id;
      r.bodies.forEach(b => { if (b.pid === old) b.pid = p.id; });
      if (r.meetingCaller === old) r.meetingCaller = p.id; if (r.meetingVictim === old) r.meetingVictim = p.id;
      list(r).forEach(q => { if (q.vote === old) q.vote = p.id; });
      io.to(r.code).emit('idchange', { from: old, to: p.id });
      if (oldSock) oldSock.disconnect(true);
    }
    sock.join(r.code); room = r; me = p;
    cb({ ok: true, id: p.id, code: r.code, token: p.token, state: r.state, mapVer: S.MAP_VER });
    if (r.state === 'lobby') emitLobby(r); else sock.emit('resync', snapshot(r, p));
    io.to(r.code).emit('presence', { id: p.id, offline: false, name: p.name });
  });
});


// ---------- jugadores de prueba (bots): solo en modo pruebas ----------
const BOT_NAMES = ['Álex', 'Marta', 'Pablo', 'Lucía', 'Dani', 'Sara', 'Iván', 'Nuria', 'Hugo', 'Carla', 'Raúl', 'Irene'];
const WALK = []; const walkSet = new Set();
(() => {   // celdas por las que pueden andar (sin atravesar consolas, paneles ni la mesa)
  const props = S.STATIONS.concat(S.PANELS, S.INFO).map(q => S.cellPos(q));
  for (let j = 0; j < S.H; j++) for (let i = 0; i < S.W; i++) {
    if (S.grid[j][i]) continue; const x = (i + .5) * S.CELL, z = (j + .5) * S.CELL;
    if (props.some(p => Math.hypot(p.x - x, p.z - z) < 2.2) || Math.hypot(S.BUTTON.x - x, S.BUTTON.z - z) < 3.4) continue;
    if (S.blocked(x, z, 1)) continue;   // decoración y bordes: los bots no se quedan pegados
    WALK.push([i, j]); walkSet.add(i + ',' + j);
  }
  // solo la zona conectada más grande: un bot nunca elige un rincón al que no puede llegar
  const comp = new Map(); let best = null;
  for (const [i, j] of WALK) { const k0 = i + ',' + j; if (comp.has(k0)) continue; const q = [[i, j]], cells = []; comp.set(k0, cells);
    while (q.length) { const c = q.pop(); cells.push(c); for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = [c[0] + dx, c[1] + dz], k = n[0] + ',' + n[1]; if (walkSet.has(k) && !comp.has(k)) { comp.set(k, cells); q.push(n); } } }
    if (!best || cells.length > best.length) best = cells; }
  WALK.length = 0; walkSet.clear(); best.forEach(c => { WALK.push(c); walkSet.add(c[0] + ',' + c[1]); });
})();
const cellOf = p => [Math.floor(p.x / S.CELL), Math.floor(p.z / S.CELL)];
function bfsPath(a, b) {
  const key = c => c[0] + ',' + c[1], prev = new Map([[key(a), null]]), q = [a];
  for (let h = 0; h < q.length; h++) {
    const c = q[h]; if (c[0] === b[0] && c[1] === b[1]) break;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = [c[0] + dx, c[1] + dz], k = key(n); if (walkSet.has(k) && !prev.has(k)) { prev.set(k, c); q.push(n); } }
  }
  if (!prev.has(key(b))) return []; const path = []; for (let c = b; c && key(c) !== key(a); c = prev.get(key(c))) path.unshift(c); return path;
}
function addBot(r) {
  const used = new Set(list(r).map(p => p.color)); let color = 0; while (used.has(color)) color++;
  const names = new Set(list(r).map(p => p.name)); const name = BOT_NAMES.find(n => !names.has(n)) || 'Bot' + (r.players.size + 1);
  const id = 'bot_' + crypto.randomBytes(4).toString('hex');
  r.players.set(id, { id, isBot: true, name, color, look: S.randomLook(), x: S.BUTTON.x, z: S.BUTTON.z + 5, ry: 0, alive: true, role: null, tasks: [], done: [], vote: null, emergencies: 0, killReadyAt: 0, vent: null, offline: false, lastChat: 0, mv: 0, path: [] }); shipSpawn(r.players.get(id), r);
}
function trimBots(r, keep) { const bots = list(r).filter(p => p.isBot); while (r.players.size > keep && bots.length) r.players.delete(bots.pop().id); }
function syncBots(r) {   // en la sala, el número de bots sigue al ajuste (solo con modo pruebas)
  if (r.state !== 'lobby') return;
  const want = r.set.testMode ? Math.min(r.set.bots, MAX_PLAYERS - humans(r).length) : 0;
  let have = list(r).filter(p => p.isBot).length;
  while (have < want) { addBot(r); have++; }
  while (have > want) { const b = list(r).filter(p => p.isBot).pop(); r.players.delete(b.id); have--; }
}
function botTick(r, p, now, dt) {
  if (p.path && p.path.length) {
    const [ci, cj] = p.path[0], tx = (ci + .5) * S.CELL, tz = (cj + .5) * S.CELL, dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz), step = 3.2 * r.set.speed * dt;
    if (d <= step) { p.x = tx; p.z = tz; p.path.shift(); } else { p.x += dx / d * step; p.z += dz / d * step; }
    p.ry = Math.atan2(dx, dz); p.mv = 1;
  } else {
    p.mv = 0;
    if (now >= (p.pauseUntil || 0)) { const to = WALK[Math.floor(Math.random() * WALK.length)]; p.path = bfsPath(cellOf(p), to); p.pauseUntil = now + 400 + Math.random() * 2600 * TS; }
  }
  if (p.role === 'crew') {
    if (!p.nextTaskAt) p.nextTaskAt = now + ms(12 + Math.random() * 28);
    const pv = S.taskPrev(p.tasks), left = p.tasks.filter(t => !p.done.includes(t) && (pv[t] == null || p.done.includes(pv[t])));
    if (now >= p.nextTaskAt && left.length) {
      p.done.push(left[Math.floor(Math.random() * left.length)]); r.doneTasks++; p.nextTaskAt = now + ms(12 + Math.random() * 28);
      if (r.set.taskbar === 'siempre') emitProgress(r); checkWin(r); if (r.state !== 'play') return;
    }
  } else if (p.role === 'impostor' && now >= p.killReadyAt) {
    const prey = list(r).filter(q => q.alive && q.role !== 'impostor');
    const t = prey.find(q => dist(p, q) < KILL_RANGES[r.set.killRange] * 0.9 && !prey.some(w => w !== q && dist(w, q) < 8));   // solo mata si no hay testigos cerca
    if (t) { doKill(r, p, t); if (r.state !== 'play') return; p.path = []; }
  }
  if (p.role === 'crew' && r.bodies.length && Math.random() < 0.08) {   // los bots "ven" un cuerpo a unos 10 m
    const b = r.bodies.find(q => dist(p, q) < 10); if (b) startMeeting(r, p, 'body', b);
  }
}
function scheduleBotVotes(r, dMs, vMs) {
  r.meetingId = (r.meetingId || 0) + 1; const mid = r.meetingId;
  list(r).filter(p => p.isBot && p.alive).forEach(p => setTimeout(() => {
    if (r.state !== 'meeting' || r.meetingId !== mid || !p.alive || p.vote !== null) return;
    const others = list(r).filter(q => q.alive && q.id !== p.id && !(p.role === 'impostor' && q.role === 'impostor'));
    p.vote = Math.random() < (p.role === 'impostor' ? .3 : .55) || !others.length ? 'skip' : others[Math.floor(Math.random() * others.length)].id;
    io.to(r.code).emit('voted', { id: p.id }); if (allVoted(r)) resolveMeeting(r);
  }, dMs + Math.min(600 + Math.random() * Math.max(300, vMs * .6), vMs * .85)));   // siempre dentro de la ventana de votación
}
setInterval(() => {
  const now = Date.now();
  for (const r of rooms.values()) if (r.state === 'play') for (const p of list(r)) if (p.isBot && p.alive && r.state === 'play') botTick(r, p, now, 0.1);
}, 100);

// posiciones en la nave de la sala de espera, 10 veces por segundo
setInterval(() => {
  for (const r of rooms.values()) if (r.state === 'lobby' && r.players.size > 1) io.to(r.code).emit('lpos', list(r).map(p => [p.id, +(p.lx || 0).toFixed(2), +(p.lz || 0).toFixed(2), p.ldir || 1, p.lmv || 0]));
}, 100);
// difusión de posiciones ~15 veces por segundo
setInterval(() => {
  const nowT = Date.now();
  for (const r of rooms.values()) {
    if (r.state !== 'play') continue;
    trackRooms(r, nowT);
    io.to(r.code).emit('pos', list(r).map(p => [p.id, +p.x.toFixed(2), +p.z.toFixed(2), +p.ry.toFixed(2), p.mv ? 1 : 0, p.vent == null ? 0 : 1]));
  }
}, 66);

server.listen(PORT, () => console.log(`Impostor 3D en http://localhost:${PORT}`));

// Al reiniciar o redesplegar se avisa a los jugadores antes de cerrar (las salas viven en memoria)
let closing = false;
function shutdown() {
  if (closing) return; closing = true;
  io.emit('toast', 'El servidor se está reiniciando. Vuelve a entrar en un minuto.');
  setTimeout(() => { io.close(); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); }, 800);
}
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
