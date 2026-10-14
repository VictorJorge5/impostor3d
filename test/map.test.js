// El mapa sigue siendo jugable: desde la cafetería se llega a todas las tareas, paneles, terminales y ventilaciones,
// y la decoración no tapa ningún pasillo.
const { test } = require('node:test');
const assert = require('node:assert');
const S = require('../public/shared.js');

const STEP = 0.5;
function reachable() {
  const W = S.W * S.CELL, H = S.H * S.CELL, seen = new Set(), q = [];
  const key = (i, j) => i + ',' + j;
  const start = S.spawnPos(0, 8), si = Math.round(start.x / STEP), sj = Math.round(start.z / STEP);
  assert.ok(!S.blocked(si * STEP, sj * STEP), 'el punto de salida está libre');
  seen.add(key(si, sj)); q.push([si, sj]);
  for (let h = 0; h < q.length; h++) {
    const [i, j] = q[h];
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + a, nj = j + b, k = key(ni, nj);
      if (seen.has(k) || ni < 0 || nj < 0 || ni * STEP > W || nj * STEP > H || S.blocked(ni * STEP, nj * STEP)) continue;
      seen.add(k); q.push([ni, nj]);
    }
  }
  return pts => pts.some(([x, z]) => seen.has(key(Math.round(x / STEP), Math.round(z / STEP))));
}
const near = (p, d) => { const out = []; for (let a = 0; a < 32; a++) out.push([p.x + Math.cos(a / 32 * 6.283) * d, p.z + Math.sin(a / 32 * 6.283) * d]); return out; };

test('todas las tareas, paneles y terminales se pueden usar', () => {
  const ok = reachable();
  S.STATIONS.forEach(st => assert.ok(ok(near(S.stationPos(st), 3)), 'tarea ' + st.name));
  S.PANELS.forEach(pn => assert.ok(ok(near(S.cellPos(pn), 3)), 'panel ' + pn.name));
  S.INFO.forEach(t => assert.ok(ok(near(S.cellPos(t), 3)), 'terminal ' + t.name));
  S.VENTS.forEach(v => assert.ok(ok(near(S.cellPos(v), 2.5)), 'ventilación ' + v.id));
  assert.ok(ok(near(S.BUTTON, 3.5)), 'botón de emergencia');
});

test('se puede entrar en todas las salas', () => {
  const ok = reachable();
  S.ROOMS.forEach(rm => {
    const pts = []; for (let j = rm.r[1]; j < rm.r[1] + rm.r[3]; j++) for (let i = rm.r[0]; i < rm.r[0] + rm.r[2]; i++) pts.push([(i + .5) * S.CELL, (j + .5) * S.CELL]);
    const n = pts.filter(p => ok([p])).length;
    assert.ok(n >= pts.length * 0.75, `${rm.name}: solo ${n}/${pts.length} celdas accesibles`);
  });
});

test('la decoración está dentro de su sala y lejos de los objetos interactivos', () => {
  const objs = S.STATIONS.map(stt => S.stationPos(stt)).concat(S.PANELS.map(S.cellPos), S.INFO.map(S.cellPos), S.VENTS.map(S.cellPos), [S.BUTTON]);
  S.DECOR.forEach(d => {
    const rm = S.roomAt(Math.floor(d.x / S.CELL), Math.floor(d.z / S.CELL));
    assert.ok(rm && rm.id === d.room, `${d.kind} en ${d.room}`);
    objs.forEach(o => assert.ok(Math.hypot(o.x - d.x, o.z - d.z) > d.r + (d.len ? d.len / 2 : 0) + 1.2 || (d.len && Math.abs(o.z - d.z) > d.r + 2), `${d.kind} (${d.x},${d.z}) demasiado cerca de (${o.x},${o.z})`));
  });
});

test('las equipaciones y el dorsal se guardan y se validan', () => {
  const l = S.cleanLook({ kit: 2, num: 10, tp: 1, t: 8, ac: 4, nn: 1 });
  assert.equal(l.kit, 2); assert.equal(l.num, 10); assert.equal(l.tp, 1); assert.equal(l.t, 8); assert.equal(l.ac, 4); assert.equal(l.nn, 1);
  const bad = S.cleanLook({ kit: 99, num: 150, t: -1 });
  assert.equal(bad.kit, 0); assert.equal(bad.num, 0); assert.equal(bad.t, 0);
  assert.equal(S.KITS.length, S.OPT.kit.length);
});

test('como en The Skeld: las salas solo se comunican por pasillos', () => {
  for (let j = 0; j < S.H; j++) for (let i = 0; i < S.W; i++) {
    const a = S.roomAt(i, j); if (!a || S.grid[j][i]) continue;
    for (const [di, dj] of [[1, 0], [0, 1]]) { const b = S.roomAt(i + di, j + dj); if (b && b.id !== a.id) assert.fail(`${a.name} y ${b.name} se tocan en (${i},${j})`); }
  }
});

test('cada tarea, panel y terminal está en la sala que indica', () => {
  S.STATIONS.concat(S.PANELS, S.INFO, S.VENTS).forEach(o => { const rm = S.roomAt(o.i, o.j); assert.ok(rm && rm.id === o.room && !S.grid[o.j][o.i], `${o.name || 'ventilación ' + o.id} en ${o.room}`); });
  const btn = S.roomAt(Math.floor(S.BUTTON.x / S.CELL), Math.floor(S.BUTTON.z / S.CELL)); assert.equal(btn.id, 'cafeteria');
});

test('tareas por pasos: cada cadena tiene todos sus pasos y se encadenan en orden', () => {
  const seen = new Set();
  S.TASK_UNITS.forEach(u => u.forEach(opts => { assert.ok(opts.length > 0); opts.forEach(id => { assert.ok(!seen.has(id), 'consola repetida ' + id); seen.add(id); }); }));
  assert.equal(seen.size, S.STATIONS.length, 'todas las consolas se pueden repartir');
  assert.ok(Object.keys(S.CHAINS).length >= 3, 'hay al menos 3 tareas por pasos');
  for (const u of Object.values(S.CHAINS)) for (let n = 0; n < 20; n++) {
    const ids = S.pickUnit(u), pv = S.taskPrev(ids.concat([0, 1]));
    assert.equal(ids.length, u.length);
    ids.forEach((id, k) => { assert.equal(S.STATIONS[id].step, k); assert.equal(pv[id], k ? ids[k - 1] : undefined); });
  }
  const dl = S.CHAINS.datos; assert.ok(dl[0].length > 1 && S.STATIONS[dl[1][0]].room === 'administracion', 'datos: se descargan en varias salas y se suben en Admin');
});
