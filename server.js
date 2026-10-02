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
const KILL_RANGES = { corta: 3.5, media: 5.5, larga: 8 };
const killCdMs = r => ms(r.set.killCd), sabCdMs = r => ms(r.set.sabCd), sabFirstMs = r => ms(Math.min(r.set.sabCd, 20));
const sabMs = (r, t) => t === 'puertas' ? ms(r.set.doorTime) : t === 'reactor' ? ms(r.set.reactorTime) : t === 'o2' ? ms(r.set.o2Time) : 0;
const sabEnabled = (r, t) => ({ luces: r.set.sabLuces, coms: r.set.sabComs, puertas: r.set.sabPuertas, reactor: r.set.sabReactor, o2: r.set.sabO2 })[t];
// Lo que necesita saber el cliente de los ajustes
const clientCfg = r => ({
  speed: r.set.speed, visCrew: r.set.visCrew, visImp: r.set.visImp, killRange: KILL_RANGES[r.set.killRange], taskbar: r.set.taskbar, test: r.set.testMode, vents: r.set.vents, info: r.set.infoTools,
  sabs: { luces: r.set.sabLuces, coms: r.set.sabComs, puertas: r.set.sabPuertas, reactor: r.set.sabReactor, o2: r.set.sabO2 },
  times: { reactor: r.set.reactorTime, o2: r.set.o2Time, doors: r.set.doorTime }
});
const app = express();
app.set('trust proxy', 1);
app.get('/health', (req, res) => res.json({ ok: true, rooms: rooms.size }));
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, file) => {   // la página y la plantilla de amigos siempre frescas; el resto (caras, imágenes) en caché
    if (/\.(html|js)$/.test(file) && !/three/.test(file)) res.setHeader('Cache-Control', 'no-cache');
    else res.setHeader('Cache-Control', 'public, max-age=86400');
  }
}));
const server = http.createServer(app);
const io = new Server(server);

const REPORT_RANGE = 7, TASK_RANGE = 5.5, BUTTON_RANGE = 5.5;
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
const pub = r => list(r).map(p => ({ id: p.id, name: p.name, color: p.color, look: p.look, alive: p.alive, x: p.x, z: p.z, ry: p.ry, vent: p.vent == null ? null : p.vent }));
const emitLobby = r => io.to(r.code).emit('lobby', {
  code: r.code, hostId: r.hostId, settings: r.set,
  players: list(r).map(p => ({ id: p.id, name: p.name, color: p.color, look: p.look, offline: !!p.offline, bot: !!p.isBot }))
});

function placeSpawns(r) {
  const ps = list(r);
  ps.forEach((p, i) => { const s = S.spawnPos(i, ps.length); p.x = s.x; p.z = s.z; p.ry = s.ry; });
}

function winner(r) {
  if (r.set.testMode) return null;                  // en modo pruebas la partida no termina sola
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
  r.state = 'end';
  r.endInfo = { winner: w, reason: reason || null, hostId: r.hostId, roles: list(r).map(p => ({ id: p.id, name: p.name, color: p.color, look: p.look, role: p.role })) };
  io.to(r.code).emit('end', { winner: w, reason: reason || null, hostId: r.hostId, roles: list(r).map(p => ({ id: p.id, name: p.name, color: p.color, look: p.look, role: p.role })) });
}
function checkWin(r) {
  if (r.state !== 'play') return;
  const w = winner(r);
  if (w) endGame(r, w);
}

function doKill(r, killer, t) {
  t.alive = false; clearHolds(r, t.id);
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
  r.state = 'play'; r.bodies = []; r.bodySeq = 0; r.doneTasks = 0; r.shownDone = 0; r.sab = null; r.doorLog = []; r.camViewers = new Set(); r.camN = 0;
  r.sabReadyAt = now + sabFirstMs(r); r.emReadyAt = now + ms(set.emergencyCd);
  const ps = shuffle(list(r));
  let nImp = Math.min(set.impostors, Math.floor((ps.length - 1) / 2));
  if (set.testMode) {                                // en pruebas vale cualquier reparto
    nImp = Math.min(set.impostors, ps.length);
    const hi = ps.findIndex(p => p.id === r.hostId);
    if (set.hostRole === 'impostor') { nImp = Math.max(1, nImp); if (hi > 0) [ps[0], ps[hi]] = [ps[hi], ps[0]]; }
    else if (set.hostRole === 'tripulante') { nImp = Math.min(nImp, ps.length - 1); if (hi >= 0 && hi < ps.length - 1) [ps[ps.length - 1], ps[hi]] = [ps[hi], ps[ps.length - 1]]; }
  } else nImp = Math.max(1, nImp);
  const ids = S.STATIONS.map(q => q.id);
  const common = shuffle(ids.slice()).slice(0, Math.min(set.commonTasks || 0, set.tasksPer)); r.common = common;
  ps.forEach((p, i) => {
    p.role = i < nImp ? 'impostor' : 'crew';
    p.alive = true; p.done = []; p.vote = null; p.emergencies = set.emergencies; p.vent = null;
    p.killReadyAt = now + killCdMs(r);
    p.tasks = common.concat(shuffle(ids.filter(q => !common.includes(q))).slice(0, set.tasksPer - common.length));
  });
  r.totalTasks = ps.filter(p => p.role === 'crew').length * set.tasksPer;
  placeSpawns(r); settleRooms(r);
  const imps = ps.filter(p => p.role === 'impostor').map(p => p.id);
  for (const p of ps) {
    io.to(p.id).emit('start', {
      role: p.role, tasks: p.tasks, mates: p.role === 'impostor' ? imps : [],
      players: pub(r), total: set.taskbar === 'nunca' ? 0 : r.totalTasks, killCd: killCdMs(r), sabCd: p.role === 'impostor' ? sabFirstMs(r) : 0,
      emCd: ms(set.emergencyCd), emerg: set.emergencies, cfg: clientCfg(r), common, impCount: imps.length
    });
  }
}

function startMeeting(r, caller, kind, body) {
  r.state = 'meeting'; r.bodies = []; clearCams(r);
  if (r.sab) endSab(r, false);
  list(r).forEach(p => { p.vent = null; p.vote = null; });
  const victim = body ? r.players.get(body.pid) : null, dMs = ms(r.set.discuss), vMs = ms(r.set.voteTime), now = Date.now();
  r.meetingPhase = dMs > 0 ? 'discuss' : 'vote'; r.discussEnds = now + dMs; r.meetingEnds = now + dMs + vMs;
  r.meetingCaller = caller.id; r.meetingKind = kind; r.meetingVictimName = victim ? victim.name : null; r.lastResult = null;
  io.to(r.code).emit('meeting', {
    caller: caller.id, kind, victimName: victim ? victim.name : null, victimColor: victim ? victim.color : null,
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
  alive.forEach(p => {
    if (p.vote === null || p.vote === 'skip') skips++;
    else tally[p.vote] = (tally[p.vote] || 0) + 1;
  });
  let top = null, max = 0, tie = false;
  for (const [id, n] of Object.entries(tally)) {
    if (n > max) { max = n; top = id; tie = false; } else if (n === max) tie = true;
  }
  let info = null;
  if (top && !tie && max > skips) {
    const e = r.players.get(top);
    if (e) { e.alive = false; info = { id: e.id, name: e.name, color: e.color, impostor: r.set.confirmEjects ? e.role === 'impostor' : null }; }
  }
  r.state = 'result';
  const anon = r.set.anonVotes;
  r.lastResult = {
    ejected: info, anon, confirm: r.set.confirmEjects, ms: RESULT_MS, impLeft: r.set.confirmEjects ? list(r).filter(q => q.role === 'impostor' && q.alive).length : null,
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
    list(r).forEach(p => { p.killReadyAt = now + killCdMs(r); p.vent = null; p.path = []; });
    r.sabReadyAt = now + sabFirstMs(r); r.emReadyAt = now + ms(r.set.emergencyCd);
    io.to(r.code).emit('resume', { players: pub(r), killCd: killCdMs(r), sabCd: sabFirstMs(r), emCd: ms(r.set.emergencyCd) });
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
function sabState(r) { if (r.sab) io.to(r.code).emit('sabState', { holds: r.sab.holds, done: [...r.sab.done] }); }
function clearHolds(r, pid) {
  if (!r.sab) return; let ch = false;
  for (const k of Object.keys(r.sab.holds)) if (r.sab.holds[k] === pid) { delete r.sab.holds[k]; ch = true; }
  if (ch) sabState(r);
}


// ---------- herramientas de información: registro de puertas y cámaras ----------
const roomIdAt = p => { const rm = S.roomAt(Math.floor(p.x / S.CELL), Math.floor(p.z / S.CELL)); return rm ? rm.id : null; };
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
  if (!p.alive) return 'Los fantasmas no usan los terminales';
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
  if (humans(r).length === 0) { clearTimeout(r.timer); clearTimeout(r.phaseTimer); if (r.sab) clearTimeout(r.sab.timer); rooms.delete(r.code); return; }
  if (r.hostId === p.id) { const all = humans(r), next = all.find(q => !q.offline) || all[0]; r.hostId = next.id; }
  if (r.state === 'lobby') return emitLobby(r);
  io.to(r.code).emit('left', { id: p.id, hostId: r.hostId });
  if (p.role === 'crew') {
    r.totalTasks -= p.tasks.length; r.doneTasks -= p.done.length;
    if (r.set.taskbar === 'siempre') emitProgress(r);
  }
  if (r.state === 'play') checkWin(r);
  else if (r.state === 'meeting' && r.meetingPhase === 'vote' && allVoted(r)) resolveMeeting(r);
}
// Estado completo para quien vuelve a entrar en mitad de la partida
function snapshot(r, p) {
  const s = {
    state: r.state, hostId: r.hostId, common: r.common || [], role: p.role, tasks: p.tasks, done: p.done, alive: p.alive, vote: p.vote, emerg: p.emergencies,
    mates: p.role === 'impostor' ? list(r).filter(q => q.role === 'impostor').map(q => q.id) : [],
    players: pub(r), bodies: r.bodies, total: r.set.taskbar === 'nunca' ? 0 : r.totalTasks, doneN: r.set.taskbar === 'siempre' ? r.doneTasks : (r.shownDone || 0), killCd: Math.max(0, (p.killReadyAt || 0) - Date.now()),
    sab: sabInfo(r), cam: r.camViewers ? r.camViewers.size : 0, vent: p.vent == null ? null : p.vent, cfg: clientCfg(r), emCd: Math.max(0, (r.emReadyAt || 0) - Date.now()),
    sabCd: p.role === 'impostor' ? (r.sabReadyAt === Infinity ? -1 : Math.max(0, (r.sabReadyAt || 0) - Date.now())) : 0
  };
  if (r.state === 'meeting' || r.state === 'result') s.meeting = {
    ends: Math.max(0, (r.meetingEnds || 0) - Date.now()), phase: r.meetingPhase, discussLeft: r.meetingPhase === 'discuss' ? Math.max(0, r.discussEnds - Date.now()) : 0, caller: r.meetingCaller, kind: r.meetingKind, victimName: r.meetingVictimName,
    voted: list(r).filter(q => q.alive && q.vote !== null).map(q => q.id)
  };
  if (r.state === 'result') s.result = r.lastResult;
  if (r.state === 'end') s.end = r.endInfo;
  return s;
}

io.on('connection', sock => {
  let room = null, me = null;

  sock.on('join', (data, cb) => {
    cb = typeof cb === 'function' ? cb : () => {};
    if (room) return cb({ error: 'Ya estás en una sala' });
    const name = String((data && data.name) || '').trim().slice(0, 12) || 'Jugador';
    let r;
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
    const used = new Set(list(r).map(p => p.color));
    let color = 0; while (used.has(color)) color++;
    me = { id: sock.id, name, color, look: S.cleanLook(data && data.look), x: S.BUTTON.x, z: S.BUTTON.z + 5, ry: 0, alive: true, role: null, tasks: [], done: [], vote: null, emergencies: 1, killReadyAt: 0, vent: null, token: crypto.randomBytes(12).toString('hex'), offline: false, lastChat: 0 };
    r.players.set(sock.id, me);
    room = r;
    sock.join(r.code);
    cb({ ok: true, id: sock.id, code: r.code, token: me.token });
    syncBots(r); emitLobby(r);
  });

  // El anfitrión cambia un ajuste (o aplica un preset) en la sala
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
    if (dist(me, t) > KILL_RANGES[room.set.killRange]) return;
    doKill(room, me, t);
  });

  sock.on('task', id => {
    if (!room || room.state !== 'play' || me.role !== 'crew') return;
    if (!me.tasks.includes(id) || me.done.includes(id)) return;
    const st = S.STATIONS[id];
    if (!st) return;
    const sp = S.stationPos(st);
    if (Math.hypot(me.x - sp.x, me.z - sp.z) > TASK_RANGE) return;
    me.done.push(id);
    room.doneTasks++;
    sock.emit('taskDone', id);
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
    if (room.sab && SABS[room.sab.type].crisis) return sock.emit('toast', 'No se puede convocar una reunión durante una crisis');
    if (dist(me, S.BUTTON) > BUTTON_RANGE) return;
    if (Date.now() < room.emReadyAt) return sock.emit('toast', `El botón se está recargando (${Math.ceil((room.emReadyAt - Date.now()) / 1000 / TS)} s)`);
    me.emergencies--;
    startMeeting(room, me, 'button', null);
  });


  // El impostor provoca un sabotaje
  sock.on('sabotage', d => {
    if (!room || room.state !== 'play' || !me.alive || me.role !== 'impostor' || me.vent != null || !d) return;
    const cfg = SABS[d.type]; if (!cfg) return;
    if (!sabEnabled(room, d.type)) return sock.emit('toast', 'Ese sabotaje está desactivado en esta partida');
    if (room.sab) return sock.emit('toast', 'Ya hay un sabotaje en marcha');
    if (Date.now() < room.sabReadyAt) return sock.emit('toast', 'El sabotaje se está recargando');
    let roomId = null;
    if (d.type === 'puertas') { roomId = String(d.room || ''); if (!S.ROOMS.some(q => q.id === roomId)) return; }
    startSab(room, d.type, roomId);
  });
  // Modo pruebas: el anfitrión provoca cualquier sabotaje sin importar su rol ni la recarga
  sock.on('testSabotage', d => {
    if (!room || room.hostId !== sock.id || !room.set.testMode || room.state !== 'play' || !d || !SABS[d.type] || room.sab) return;
    let roomId = null;
    if (d.type === 'puertas') { roomId = String(d.room || ''); if (!S.ROOMS.some(q => q.id === roomId)) return; }
    startSab(room, d.type, roomId);
  });
  // La tripulación arregla un panel (luces, comunicaciones, oxígeno)
  sock.on('fix', d => {
    if (!room || room.state !== 'play' || !me.alive || me.role !== 'crew' || !room.sab || !d) return;
    const cfg = SABS[room.sab.type], id = String(d.panel || '');
    if (!cfg.panels || !cfg.panels.includes(id) || cfg.mode === 'simul') return;
    const pn = S.PANELS.find(q => q.id === id); if (!pn || dist(me, S.cellPos(pn)) > TASK_RANGE + 0.5) return;
    if (cfg.mode === 'any') return endSab(room, true);
    room.sab.done.add(id); sabState(room);
    if (cfg.panels.every(q => room.sab.done.has(q))) endSab(room, true);
  });
  // Reactor: dos jugadores mantienen los dos paneles a la vez
  sock.on('hold', d => {
    if (!room || room.state !== 'play' || !me.alive || me.role !== 'crew' || !room.sab || !d) return;
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
      me.vent = v.id; me.x = vp.x; me.z = vp.z; me.mv = 0;
      io.to(room.code).emit('ventfx', { x: vp.x, z: vp.z, out: false });
    } else if (d.action === 'move') {
      const cur = me.vent == null ? null : S.VENTS[me.vent], nx = S.VENTS[+d.id];
      if (!cur || !nx || !cur.links.includes(nx.id)) return;
      const vp = S.cellPos(nx); me.vent = nx.id; me.x = vp.x; me.z = vp.z;
    } else if (d.action === 'exit') {
      if (me.vent == null) return;
      const v = S.VENTS[me.vent], vp = S.cellPos(v); me.vent = null;
      io.to(room.code).emit('ventfx', { x: vp.x, z: vp.z, out: true });
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
    if (d && d.on) { if (infoBlock(room, me, 'cams')) return; room.camViewers.add(me.id); } else room.camViewers.delete(me.id);
    emitCam(room);
  });

  sock.on('chat', text => {
    if (!room || room.state !== 'meeting' || !me.alive) return;
    text = String(text || '').trim().slice(0, 140);
    if (!text || Date.now() - me.lastChat < 500) return;
    me.lastChat = Date.now();
    io.to(room.code).emit('chat', { id: me.id, name: me.name, color: me.color, text });
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
    list(room).forEach(p => { p.alive = true; p.role = null; p.tasks = []; p.done = []; p.vote = null; });
    io.to(room.code).emit('toLobby');
    emitLobby(room);
  });

  // Si se cae la conexión (cambiar de app, recargar la página...) se conserva su sitio un minuto
  sock.on('disconnect', () => {
    if (!room || !me || room.players.get(sock.id) !== me) return;
    const r = room, p = me;
    p.offline = true; p.mv = 0; clearHolds(r, p.id); if (r.camViewers) { r.camViewers.delete(p.id); emitCam(r); }
    io.to(r.code).emit('presence', { id: p.id, offline: true, name: p.name });
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
      r.players.delete(old); p.id = sock.id; r.players.set(p.id, p);
      if (r.hostId === old) r.hostId = p.id;
      r.bodies.forEach(b => { if (b.pid === old) b.pid = p.id; });
      list(r).forEach(q => { if (q.vote === old) q.vote = p.id; });
      io.to(r.code).emit('idchange', { from: old, to: p.id });
      if (oldSock) oldSock.disconnect(true);
    }
    sock.join(r.code); room = r; me = p;
    cb({ ok: true, id: p.id, code: r.code, token: p.token, state: r.state });
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
    WALK.push([i, j]); walkSet.add(i + ',' + j);
  }
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
  r.players.set(id, { id, isBot: true, name, color, look: S.randomLook(), x: S.BUTTON.x, z: S.BUTTON.z + 5, ry: 0, alive: true, role: null, tasks: [], done: [], vote: null, emergencies: 0, killReadyAt: 0, vent: null, offline: false, lastChat: 0, mv: 0, path: [] });
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
    const left = p.tasks.filter(t => !p.done.includes(t));
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
