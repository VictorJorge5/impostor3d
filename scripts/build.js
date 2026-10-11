// Genera la web estática para Vercel en dist/:
//  - copia public/
//  - añade el cliente de Socket.IO (misma versión que el servidor)
//  - escribe config.js con la dirección del servidor de tiempo real (GAME_SERVER_URL)
//  - pone la versión al service worker y la URL absoluta a la imagen para compartir
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'public');
const OUT = path.join(ROOT, 'dist');

const server = String(process.env.GAME_SERVER_URL || '').trim().replace(/\/+$/, '');
if (server && !/^https?:\/\/[^\s/]+$/i.test(server)) {
  console.error(`GAME_SERVER_URL no es válido: "${server}" (ejemplo: https://impostor3d.onrender.com)`);
  process.exit(1);
}
const prodHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || '';
const site = String(process.env.SITE_URL || (prodHost ? 'https://' + prodHost : '')).replace(/\/+$/, '');

fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(SRC, OUT, { recursive: true });
fs.mkdirSync(path.join(OUT, 'vendor'), { recursive: true });
fs.copyFileSync(path.join(path.dirname(require.resolve('socket.io')), '..', 'client-dist', 'socket.io.min.js'), path.join(OUT, 'vendor', 'socket.io.min.js'));

fs.writeFileSync(path.join(OUT, 'config.js'),
  `// Generado en el build (scripts/build.js). No editar: cambia GAME_SERVER_URL en Vercel.\nwindow.I3D_CONFIG = ${JSON.stringify({ server })};\n`);

// versión = huella de todo lo publicado, para que el service worker renueve la caché solo cuando cambie algo
const hash = crypto.createHash('sha1');
(function walk(dir) {
  for (const f of fs.readdirSync(dir).sort()) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p); else if (f !== 'sw.js') hash.update(f).update(fs.readFileSync(p));
  }
})(OUT);
const version = hash.digest('hex').slice(0, 12);
const swPath = path.join(OUT, 'sw.js');
fs.writeFileSync(swPath, fs.readFileSync(swPath, 'utf8').replace('__BUILD__', version));

if (site) {
  const idx = path.join(OUT, 'index.html');
  fs.writeFileSync(idx, fs.readFileSync(idx, 'utf8')
    .replace('content="og-image.png"', `content="${site}/og-image.png"`)
    .replace('<meta property="og:type"', `<meta property="og:url" content="${site}/">\n<link rel="canonical" href="${site}/">\n<meta property="og:type"`));
}

console.log(`dist/ listo · versión ${version} · servidor de juego: ${server || '(el mismo dominio)'}${site ? ' · web: ' + site : ''}`);
if (!server && process.env.VERCEL) console.warn('AVISO: falta GAME_SERVER_URL; en Vercel la página no tiene servidor de juego propio.');
