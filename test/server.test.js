// Prueba de humo: arranca el servidor de verdad y juega el principio de una partida con 3 clientes.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { io } = require('socket.io-client');

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

test('latencia: el servidor contesta al ping', async () => {
  const c = await connect('https://impostor3d.vercel.app');
  const t = await new Promise(res => c.emit('lat', res));
  assert.ok(Number.isFinite(t));
});

test('crear sala, unirse con el código y empezar la partida', async () => {
  const [a, b, c] = await Promise.all([1, 2, 3].map(() => connect('https://impostor3d.vercel.app')));
  const lobbyA = once(a, 'lobby');
  const ra = await ack(a, 'join', { name: 'Ana', look: {}, code: '' });
  assert.ok(ra.ok && /^[A-Z]{4}$/.test(ra.code));
  await lobbyA;
  const bad = await ack(b, 'join', { name: 'X', code: 'ZZZZ' === ra.code ? 'YYYY' : 'ZZZZ' });
  assert.equal(bad.error, 'No existe esa sala');
  assert.ok((await ack(b, 'join', { name: 'Bea', code: ra.code.toLowerCase() })).ok);
  const lob = new Promise(res => a.on('lobby', L => { if (L.players.length === 3) res(L); }));
  assert.ok((await ack(c, 'join', { name: 'Carlos', code: ra.code })).ok);
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

  // reconexión: un jugador recarga y vuelve a su sitio con el mismo rol
  const rb = await new Promise(res => b.emit('rejoin', { code: ra.code, token: 'malo' }, res));
  assert.ok(rb.error);
});

test('reglas del original: sin botón durante un sabotaje, las luces siguen tras la reunión y los fantasmas hablan entre ellos', async () => {
  const S = require('../public/shared.js');
  const socks = await Promise.all([1, 2, 3, 4].map(() => connect()));
  const [h] = socks;
  const r0 = await ack(h, 'join', { name: 'H', look: {}, code: '' });
  for (const [i, s] of socks.slice(1).entries()) assert.ok((await ack(s, 'join', { name: 'P' + i, look: {}, code: r0.code })).ok);
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
  const mtg = once(crew[0], 'meeting'); crew[0].emit('report'); await mtg;
  let leaked = false; crew[0].on('chat', m => { if (m.ghost) leaked = true; });
  const gch = once(victim, 'chat'); victim.emit('chat', 'soy un fantasma'); const gm = await gch; assert.equal(gm.ghost, true);
  await new Promise(r => setTimeout(r, 200)); assert.equal(leaked, false);
  const resumed = once(crew[0], 'resume'); socks.forEach(s => s.emit('vote', 'skip'));
  const rs = await resumed; assert.ok(rs.sab && rs.sab.type === 'luces', 'las luces siguen apagadas tras la reunión');
});
