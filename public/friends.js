// Plantilla de amigos: se carga automáticamente en el selector de personajes.
// f = textura de la cabeza generada a partir de su foto (public/faces/<nombre>.jpg).
// Si editas a un amigo desde el juego (por ejemplo su altura), esos cambios se respetan.
// Sube FRIENDS_VERSION cuando añadas amigos o cambies algo aquí.
window.FRIENDS_VERSION = 9;
window.FRIENDS = [
  { id: 'f_benjamin', name: 'Benjamín', look: {
    f: 'faces/benjamin.jpg', fh: 'faces/benjamin_h.png',
    ht: 170, bd: 1,                       // 170 cm, complexión normal
    cs: '#ad846b', ch: '#1b1814',         // piel y pelo (cuello, brazos, orejas)
    sh: 10, csh: '#141414', ml: 1,        // polo negro de manga corta
    pa: 10, cp: '#3b4048', pl: 1,         // bermudas gris marengo
    cz: '#1b1b20',                        // zapatillas oscuras
    ac: 1                                 // bandolera cruzada
  } },
  { id: 'f_cristian', name: 'Cristian', look: {
    f: 'faces/cristian.jpg', fh: 'faces/cristian_h.png',
    ht: 185, bd: 2,                       // 185 cm, complexión robusta
    cs: '#c48a68', ch: '#292423',
    sh: 10, csh: '#16161a', ml: 1,        // camiseta negra holgada de manga corta
    pa: 10, cp: '#6f7c72', pl: 1,         // bermudas vaqueras gris verdoso
    cz: '#d8d8d2'                         // zapatillas blancas
  } },
  { id: 'f_pablo', name: 'Pablo', look: {
    f: 'faces/pablo.jpg', fh: 'faces/pablo_h.png',
    ht: 190, bd: 3,                       // 190 cm, delgado y musculado (atlético)
    cs: '#ae6f5b', ch: '#37292b',
    sh: 10, csh: '#141416', ml: 1, cl: '#e6e6e6',   // camiseta negra con el logo blanco en el pecho
    pa: 10, cp: '#2b303a', pl: 0,         // pantalón largo oscuro (no se ve en la foto)
    cz: '#1b1b20'                         // zapatillas oscuras (no se ven en la foto)
  } },
  { id: 'f_jaime', name: 'Jaime', look: {
    f: 'faces/jaime.jpg', fh: 'faces/jaime_h.png',
    ht: 180, bd: 0,                       // 180 cm, complexión delgada
    cs: '#b98f7c', ch: '#2a1f18',         // piel clara, pelo castaño oscuro
    sh: 10, csh: '#25232f', ml: 0,        // prenda oscura de cuello alto (en la foto solo se ve el cuello)
    pa: 10, cp: '#2b3040', pl: 0,         // pantalón oscuro (no se ve en la foto)
    cz: '#1b1b20'                         // zapatillas oscuras (no se ven en la foto)
  } },
  { id: 'f_santi', name: 'Santi', look: {
    f: 'faces/santi.jpg', fh: 'faces/santi_h.png',
    ht: 175, bd: 0,                       // 175 cm, complexión delgada
    cs: '#b98a73', ch: '#2b2220', hv: 2, hr: 1,   // pelo oscuro rizado con mucho volumen y flequillo (gafas redondas incluidas en la foto)
    sh: 10, csh: '#a3121e', ml: 0,        // sudadera roja de manga larga
    pa: 10, cp: '#27303e', pl: 0,         // pantalón oscuro (no se ve en la foto)
    cz: '#1b1b20'                         // zapatillas oscuras (no se ven en la foto)
  } },
  { id: 'f_victor', name: 'Víctor', look: {
    f: 'faces/victor.jpg', fh: 'faces/victor_h.png',
    ht: 183, bd: 2,                       // 183 cm, complexión corpulenta
    cs: '#c49a84', ch: '#2b201c',         // piel (brazos y piernas) y pelo
    sh: 10, csh: '#d9ccc4', ml: 1,        // camiseta holgada beige de manga corta
    pa: 10, cp: '#bfa98d', pl: 1,         // bermudas caqui
    cz: '#18181b', ss: 1,                 // sandalias negras
    mo: 1, ac: 1                          // mochila y riñonera cruzada
  } },
  { id: 'f_jose', name: 'José', look: {
    f: 'faces/jose.jpg', fh: 'faces/jose_h.png',
    ht: 178, bd: 0,                       // 178 cm, complexión delgada
    cs: '#cf9d88', ch: '#2d231e',         // piel y pelo oscuro
    sh: 10, csh: '#1c2230', ml: 0,        // plumífero azul marino (como en su foto con barba)
    pa: 10, cp: '#2a2f3a', pl: 0,         // pantalón oscuro (no se ve en las fotos)
    cz: '#1b1b20'                         // zapatillas oscuras (no se ven en las fotos)
  } }
];
