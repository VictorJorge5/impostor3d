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
    const xs = rm.poly.map(q => q[0]), zs = rm.poly.map(q => q[1]), pts = [];
    for (let z = Math.min(...zs) + 1; z < Math.max(...zs); z += 2) for (let x = Math.min(...xs) + 1; x < Math.max(...xs); x += 2) if ([[0, 0], [.7, 0], [-.7, 0], [0, .7], [0, -.7]].every(([a, b]) => S.inPoly(x + a, z + b, rm.poly))) pts.push([x, z]);
    const n = pts.filter(p => ok([p])).length;
    assert.ok(n >= pts.length * 0.65, `${rm.name}: solo ${n}/${pts.length} puntos accesibles`);
  });
});

test('el mapa es el de The Skeld: cada sala tiene sus puertas y cada objeto está en su sala', () => {
  const doors = { cafeteria: 3, motores: 2, motorinf: 2, almacen: 3, escudos: 2, navegacion: 2, armeria: 2, reactor: 1, seguridad: 1, enfermeria: 1, electrica: 1, administracion: 1, comunicaciones: 1, oxigeno: 1 };
  for (const id in doors) assert.equal(S.DOORS[id].length, doors[id], 'puertas de ' + id);
  S.STATIONS.concat(S.PANELS, S.INFO, S.VENTS).forEach(o => { const rm = S.roomAtPos(o.x, o.z); assert.equal(rm && rm.id, o.room || undefined, (o.name || 'rejilla ' + o.id)); });
  S.VENTS.forEach(v => v.links.forEach(l => assert.ok(S.VENTS[l].links.includes(v.id), 'rejillas conectadas en los dos sentidos')));
});

test('la decoración está dentro de su sala y lejos de los objetos interactivos', () => {
  const objs = S.STATIONS.map(stt => S.stationPos(stt)).concat(S.PANELS.map(S.cellPos), S.INFO.map(S.cellPos), S.VENTS.map(S.cellPos), [S.BUTTON]);
  S.DECOR.forEach(d => {
    const rm = S.roomAt(Math.floor(d.x / S.CELL), Math.floor(d.z / S.CELL));
    assert.ok(rm && rm.id === d.room, `${d.kind} en ${d.room}`);
    // distancia del objeto al borde de la decoración: hay sitio para ponerse delante y usarlo
    const hw = d.w ? d.w / 2 : d.len ? d.len / 2 : 0, hh = d.w ? d.h / 2 : d.len ? d.r : 0;
    const gap = o => (hw ? Math.hypot(Math.max(0, Math.abs(o.x - d.x) - hw), Math.max(0, Math.abs(o.z - d.z) - hh)) : Math.hypot(o.x - d.x, o.z - d.z) - d.r);
    objs.forEach(o => assert.ok(gap(o) > 1.5, `${d.kind} (${d.x},${d.z}) demasiado cerca de (${o.x},${o.z})`));
    // tampoco tapa el anillo de salida alrededor de la mesa
    for (let k = 0; k < 10; k++) { const sp = S.spawnPos(k, 10); assert.ok(!S.blocked(sp.x, sp.z), 'salida ' + k); }
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
  S.STATIONS.concat(S.PANELS, S.INFO).forEach(o => { const rm = S.roomAtPos(o.x, o.z); assert.ok(rm && rm.id === o.room && !S.isSolid(o.x, o.z), `${o.name} en ${o.room}`); });
  assert.equal(S.roomAtPos(S.BUTTON.x, S.BUTTON.z).id, 'cafeteria');
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
