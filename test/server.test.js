// Prueba de humo: arranca el servidor de verdad y juega el principio de una partida con 3 clientes.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { io } = require('socket.io-client');
const MAP_VER = require('../public/shared.js').MAP_VER;

const PORT = 3900 + Math.floor(Math.random() * 90);
const URL = `http://127.0.0.1:${PORT}`;
let srv;
const clients = [];

before(async () => {
  srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT: String(PORT), TIME_SCALE: '0.05' }, stdio: 'pipe' });
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('El servidor no arranca')), 8000);
    srv.stdout.on('data', d => { if (String(d).includes('Impostor 3D')) { clearTimeout(t); res(); } });
  });
});
after(() => { clients.forEach(c => c.close()); srv.kill('SIGKILL'); });

const connect = origin => new Promise((res, rej) => {
  const c = io(URL, { transports: ['websocket'], extraHeaders: origin ? { Origin: origin } : {}, forceNew: true });
  clients.push(c); c.on('connect', () => res(c)); c.on('connect_error', rej);
});
const ack = (c, ev, data) => new Promise(res => c.emit(ev, data, res));
const once = (c, ev) => new Promise(res => c.once(ev, res));

test('/health responde y permite CORS', async () => {
  const r = await fetch(URL + '/health');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('access-control-allow-origin'), '*');
  const j = await r.json();
  assert.equal(j.ok, true);
});

test('sirve la página, la configuración y el cliente de Socket.IO', async () => {
  for (const f of ['/', '/config.js', '/vendor/socket.io.min.js', '/sw.js', '/manifest.webmanifest', '/og-image.png']) {
    const r = await fetch(URL + f); assert.equal(r.status, 200, f);
  }
});

test('CORS: acepta *.vercel.app y rechaza otros dominios', async () => {
  const ok = await fetch(`${URL}/socket.io/?EIO=4&transport=polling`, { headers: { Origin: 'https://impostor3d.vercel.app' } });
  assert.equal(ok.headers.get('access-control-allow-origin'), 'https://impostor3d.vercel.app');
  const bad = await fetch(`${URL}/socket.io/?EIO=4&transport=polling`, { headers: { Origin: 'https://malo.example.com' } });
  assert.notEqual(bad.headers.get('access-control-allow-origin'), 'https://malo.example.com');
});

test('reparto de tareas como el original: 1 común igual para todos, 1 larga y 2 cortas', async () => {
  const S = require('../public/shared.js');
  const cs = await Promise.all([1, 2, 3, 4].map(() => connect()));
  const r0 = await ack(cs[0], 'join', { mapVer: MAP_VER, name: 'A', look: {}, code: '' });
  for (const c of cs.slice(1)) await ack(c, 'join', { mapVer: MAP_VER, name: 'B', look: {}, code: r0.code });
  const st = cs.map(c => once(c, 'start')); cs[0].emit('start'); const ds = await Promise.all(st);
  const crew = ds.filter(d => d.role === 'crew'), kindOf = id => S.UNIT_KIND[S.TASK_UNITS.findIndex(u => u.some(o => o.includes(id)))];
  crew.forEach(d => {
    const units = new Set(d.tasks.map(id => S.TASK_UNITS.findIndex(u => u.some(o => o.includes(id)))));
    const kinds = [...units].map(k => S.UNIT_KIND[k]).sort().join(',');
    assert.equal(kinds, 'common,long,short,short', 'tipos de tarea');
  });
  const com = crew.map(d => d.tasks.filter(id => kindOf(id) === 'common').join());
  assert.ok(com.every(c => c === com[0]), 'la común es la misma para todos');
});

test('puertas como en The Skeld: varias salas a la vez, no impiden el botón y bloquean los otros sabotajes', async () => {
  const S = require('../public/shared.js');
  const cs = await Promise.all([1, 2, 3, 4].map(() => connect()));
  const r0 = await ack(cs[0], 'join', { mapVer: MAP_VER, name: 'A', look: {}, code: '' });
  for (const c of cs.slice(1)) await ack(c, 'join', { mapVer: MAP_VER, name: 'B', look: {}, code: r0.code });
  const st = cs.map(c => once(c, 'start')); cs[0].emit('start'); const ds = await Promise.all(st);
  const imp = cs[ds.findIndex(d => d.role === 'impostor')], crew = cs.filter(c => c !== imp);
  await new Promise(r => setTimeout(r, 1200));   // recarga inicial del sabotaje (acortada en las pruebas)
  let d1 = once(crew[0], 'doors'); imp.emit('sabotage', { type: 'puertas', room: 'cafeteria' }); await d1;
  d1 = once(crew[0], 'doors'); imp.emit('sabotage', { type: 'puertas', room: 'almacen' }); const dd = await d1;
  assert.deepEqual(Object.keys(dd.closed).sort(), ['almacen', 'cafeteria'], 'dos salas cerradas a la vez');
  const t = once(imp, 'toast'); imp.emit('sabotage', { type: 'luces' }); assert.match(await t, /puertas/, 'con puertas cerradas no hay otros sabotajes');
  crew[0].emit('move', { x: S.BUTTON.x, z: S.BUTTON.z + 3, ry: 0, mv: 0 }); await new Promise(r => setTimeout(r, 100));
  const m = once(crew[0], 'meeting'); crew[0].emit('emergency'); assert.ok(await m, 'el botón funciona con las puertas cerradas');
});

test('la web y el servidor tienen que llevar el mismo mapa', async () => {
  const c = await connect();
  const old = await ack(c, 'join', { name: 'Viejo', look: {}, code: '' });
  assert.ok(old.error && old.reload, 'una página sin la huella del mapa no puede entrar');
  const bad = await ack(c, 'join', { mapVer: 'otro', name: 'Viejo', look: {}, code: '' });
  assert.ok(bad.error && bad.reload);
  const ok = await ack(c, 'join', { mapVer: MAP_VER, name: 'Nuevo', look: {}, code: '' });
  assert.ok(ok.ok); assert.equal(ok.mapVer, MAP_VER);
  const h = await (await fetch(URL + '/health')).json(); assert.equal(h.mapVer, MAP_VER);
});

test('latencia: el servidor contesta al ping', async () => {
  const c = await connect('https://impostor3d.vercel.app');
  const t = await new Promise(res => c.emit('lat', res));
  assert.ok(Number.isFinite(t));
});

test('crear sala, unirse con el código y empezar la partida', async () => {
  const [a, b, c] = await Promise.all([1, 2, 3].map(() => connect('https://impostor3d.vercel.app')));
  const lobbyA = once(a, 'lobby');
  const ra = await ack(a, 'join', { mapVer: MAP_VER, name: 'Ana', look: {}, code: '' });
  assert.ok(ra.ok && /^[A-Z]{4}$/.test(ra.code));
  await lobbyA;
  const bad = await ack(b, 'join', { mapVer: MAP_VER, name: 'X', code: 'ZZZZ' === ra.code ? 'YYYY' : 'ZZZZ' });
  assert.equal(bad.error, 'No existe esa sala');
  assert.ok((await ack(b, 'join', { mapVer: MAP_VER, name: 'Bea', code: ra.code.toLowerCase() })).ok);
  const lob = new Promise(res => a.on('lobby', L => { if (L.players.length === 3) res(L); }));
  assert.ok((await ack(c, 'join', { mapVer: MAP_VER, name: 'Carlos', code: ra.code })).ok);
  const L = await lob;
  assert.equal(L.players.length, 3);
  assert.equal(L.hostId, ra.id);

  const starts = [a, b, c].map(s => once(s, 'start'));
  a.emit('start');
  const st = await Promise.all(starts);
  const roles = st.map(s => s.role);
  assert.equal(roles.filter(r => r === 'impostor').length, 1);
  assert.equal(roles.filter(r => r === 'crew').length, 2);
  st.forEach(s => assert.equal(s.players.length, 3));

  // el impostor solo tiene tareas falsas (fuera del modo pruebas); la tripulación sí las hace
  const S = require('../public/shared.js'), socks = [a, b, c];
  const tryTask = async (k) => { const s = st[k], id = s.tasks.find(i => S.taskPrev(s.tasks)[i] == null), p = S.stationPos(S.STATIONS[id]);
    socks[k].emit('move', { x: p.x, z: p.z + 1, ry: 0, mv: 0 }); await new Promise(r => setTimeout(r, 80));
    let got = false; socks[k].once('taskDone', () => { got = true; }); socks[k].emit('task', id); await new Promise(r => setTimeout(r, 250)); return got; };
  assert.equal(st[roles.indexOf('impostor')].tasks.length, 0, 'el impostor no tiene tareas fuera del modo pruebas');
  { const c = socks[roles.indexOf('impostor')]; let got = false; c.once('taskDone', () => { got = true; }); c.emit('task', st[roles.indexOf('crew')].tasks[0]); await new Promise(r => setTimeout(r, 250)); assert.equal(got, false, 'ni puede hacer las de otro'); }
  assert.equal(await tryTask(roles.indexOf('crew')), true, 'la tripulación sí');

  // reconexión: un jugador recarga y vuelve a su sitio con el mismo rol
  const rb = await new Promise(res => b.emit('rejoin', { code: ra.code, token: 'malo' }, res));
  assert.ok(rb.error);
});

test('reglas del original: sin botón durante un sabotaje, las luces siguen tras la reunión y los fantasmas hablan entre ellos', async () => {
  const S = require('../public/shared.js');
  const socks = await Promise.all([1, 2, 3, 4].map(() => connect()));
  const [h] = socks;
  const r0 = await ack(h, 'join', { mapVer: MAP_VER, name: 'H', look: {}, code: '' });
  for (const [i, s] of socks.slice(1).entries()) assert.ok((await ack(s, 'join', { mapVer: MAP_VER, name: 'P' + i, look: {}, code: r0.code })).ok);
  const starts = socks.map(s => once(s, 'start')); h.emit('start'); const st = await Promise.all(starts);
  const imp = socks[st.findIndex(s => s.role === 'impostor')], crew = socks.filter(s => s !== imp);
  const at = (s, p) => s.emit('move', { x: p.x, z: p.z, ry: 0, mv: 0 });
  // el impostor apaga las luces cuando se le pasa la recarga del sabotaje
  await new Promise(r => setTimeout(r, 1200));
  const sab = once(crew[0], 'sabotage'); imp.emit('sabotage', { type: 'luces' }); await sab;
  // con las luces apagadas no se puede pulsar el botón de emergencia
  at(crew[0], S.BUTTON); await new Promise(r => setTimeout(r, 100));
  const t = once(crew[0], 'toast'); crew[0].emit('emergency'); assert.match(await t, /sabotaje/);
  // el impostor mata a un tripulante y otro reporta: tras la reunión las luces siguen apagadas
  const victim = crew[2], vPos = { x: S.BUTTON.x + 6, z: S.BUTTON.z + 2 };
  at(victim, vPos); at(imp, { x: vPos.x + 1, z: vPos.z }); await new Promise(r => setTimeout(r, 200));
  const killed = once(crew[0], 'killed'); imp.emit('kill', victim.id); await killed;
  // chat de fantasmas: lo recibe el fantasma, no los vivos
  at(crew[0], { x: vPos.x, z: vPos.z + 1 }); await new Promise(r => setTimeout(r, 100));
  const mtg = once(crew[0], 'meeting'); crew[0].emit('report'); const md = await mtg;
  assert.deepEqual(md.dead, [victim.id], 'el resumen de la reunión trae a quien ha muerto en la ronda');
  // los fantasmas pueden usar los terminales (solo les frena la distancia)
  const dl = await ack(victim, 'infoDoorlog', {}); assert.ok(dl.error && !/fantasma/i.test(dl.error), dl.error);
  let leaked = false; crew[0].on('chat', m => { if (m.ghost) leaked = true; });
  const gch = once(victim, 'chat'); victim.emit('chat', 'soy un fantasma'); const gm = await gch; assert.equal(gm.ghost, true);
  await new Promise(r => setTimeout(r, 200)); assert.equal(leaked, false);
  const resumed = once(crew[0], 'resume'); socks.forEach(s => s.emit('vote', 'skip'));
  const rs = await resumed; assert.ok(rs.sab && rs.sab.type === 'luces', 'las luces siguen apagadas tras la reunión');
  // la mascota del muerto se queda donde murió
  const vp = rs.players.find(q => q.id === victim.id); assert.ok(vp.pet && Math.hypot(vp.pet.x - vPos.x, vp.pet.z - vPos.z) < 1.5, 'la mascota se queda junto al sitio de la muerte');
});

test('si el impostor se va, gana la tripulación (como en el original)', async () => {
  const socks = await Promise.all([1, 2, 3, 4].map(() => connect()));
  const [h] = socks;
  const r0 = await ack(h, 'join', { mapVer: MAP_VER, name: 'H', look: {}, code: '' });
  for (const [i, s] of socks.slice(1).entries()) assert.ok((await ack(s, 'join', { mapVer: MAP_VER, name: 'P' + i, look: {}, code: r0.code })).ok);
  const starts = socks.map(s => once(s, 'start')); h.emit('start'); const st = await Promise.all(starts);
  const ii = st.findIndex(s => s.role === 'impostor'), other = socks[(ii + 1) % socks.length];
  const end = once(other, 'end'); socks[ii].emit('leave'); const e = await end;
  assert.equal(e.winner, 'crew'); assert.equal(e.reason, 'disconnect:impostor');
});

test('modo pruebas con 3 jugadores: si quedan un impostor y un tripulante, gana el impostor', async () => {
  const S = require('../public/shared.js');
  const socks = await Promise.all([1, 2, 3].map(() => connect()));
  const [h] = socks;
  const r0 = await ack(h, 'join', { mapVer: MAP_VER, name: 'H', look: {}, code: '' });
  for (const [i, s] of socks.slice(1).entries()) assert.ok((await ack(s, 'join', { mapVer: MAP_VER, name: 'P' + i, look: {}, code: r0.code })).ok);
  const lob = once(h, 'lobby'); h.emit('settings', { all: { testMode: true, impostors: 1 } }); await lob;
  const starts = socks.map(s => once(s, 'start')); h.emit('start'); const st = await Promise.all(starts);
  const imp = socks[st.findIndex(s => s.role === 'impostor')], victim = socks.find(s => s !== imp);
  const at = (s, p) => s.emit('move', { x: p.x, z: p.z, ry: 0, mv: 0 });
  const vPos = { x: S.BUTTON.x + 6, z: S.BUTTON.z + 2 };
  at(victim, vPos); at(imp, { x: vPos.x + 1, z: vPos.z }); await new Promise(r => setTimeout(r, 1500));
  const end = once(h, 'end'); imp.emit('kill', victim.id); const e = await end;
  assert.equal(e.winner, 'impostor');
});
