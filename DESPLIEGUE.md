# Cómo poner Impostor 3D en internet

## Arquitectura profesional: web en Vercel + servidor de juego en Render

```
 Móviles ──HTTPS──▶  Vercel (la web: página, 3D, caras, PWA)   ← CDN mundial, HTTPS, vistas previas por rama
    │
    └────WebSocket──▶ Render (server.js: salas y partidas en tiempo real)
```

- **Vercel** sirve la página desde su CDN: carga muy rápida en cualquier sitio, cabeceras de seguridad, caché,
  app instalable, imagen de vista previa al compartir por WhatsApp y un despliegue automático en cada `git push`.
- **El servidor de juego** (Socket.IO) necesita un proceso siempre encendido que guarde las salas en memoria.
  Las funciones de Vercel no sirven para eso (cada conexión puede ir a una instancia distinta y se cortan por tiempo),
  así que sigue en Render (o Railway/Fly.io). La web de Vercel se conecta a él con la variable `GAME_SERVER_URL`.

### 1. Servidor de juego (Render)
Si ya lo tienes en Render, no hay que tocar nada: anota su URL (p. ej. `https://impostor3d.onrender.com`)
y comprueba que `https://TU-URL/health` responde `{"ok":true,...}`. Si no, sigue la "Opción A" de más abajo.

El servidor acepta conexiones de cualquier `*.vercel.app` y de `localhost`. Si pones un **dominio propio** en Vercel,
añade en Render la variable `ALLOWED_ORIGINS=https://tudominio.com,https://www.tudominio.com`.

### 2. Web (Vercel)
1. vercel.com → "Add New… → Project" → importa el repositorio `impostor3d` de GitHub.
2. Vercel lee `vercel.json` solo (build `npm run build`, carpeta `dist`). No cambies nada de "Build & Output".
3. En "Environment Variables" añade `GAME_SERVER_URL` = la URL de Render, **sin barra final**. Pulsa "Deploy".
4. Abre la URL de Vercel. Arriba verás una pastilla: *Conectando…* → *En línea · 60 ms*. Si pone
   *Despertando el servidor…*, Render estaba dormido: espera hasta un minuto y entra sola.

Cada `git push` a `main` publica una versión nueva; cada rama tiene su propia URL de vista previa.
Si cambias `GAME_SERVER_URL`, vuelve a desplegar (Deployments → ⋯ → Redeploy) para que se aplique.

### Probar en local lo mismo que hace Vercel
```
npm install
npm start                                   # servidor de juego en :3000
GAME_SERVER_URL=http://localhost:3000 npm run build
npx serve dist -l 5000                      # la web "de Vercel" en :5000
npm test                                    # pruebas automáticas (también corren en GitHub Actions)
```

---

## Opción A: todo en Render (servidor de juego, y también sirve la web)

1. **GitHub.** Entra en github.com (crea cuenta si no tienes) → "New repository" → nombre `impostor3d` → "Create repository".
2. **Sube el juego.** Descomprime el zip. En el repositorio: "uploading an existing file" y arrastra el CONTENIDO de la carpeta
   (`server.js`, `package.json`, `package-lock.json`, `render.yaml`, y la carpeta `public`), no la carpeta `impostor3d` en sí.
   Esos archivos deben quedar en la raíz del repositorio. Pulsa "Commit changes".
3. **Render.** Entra en render.com → "Get Started" con tu cuenta de GitHub.
   - "New +" → **Web Service** → elige el repositorio `impostor3d`.
   - Ajustes: *Runtime* Node · *Build Command* `npm install` · *Start Command* `npm start` · *Instance Type* **Free** · región Frankfurt.
   - (Atajo: "New +" → **Blueprint** y elige el repositorio; lee `render.yaml` y lo rellena solo.)
   - "Create Web Service". Tarda 2-4 minutos.
4. **Comprueba.** Arriba verás tu URL, del estilo `https://impostor3d.onrender.com`. Ábrela en el móvil.
   `https://TU-URL/health` debe responder `{"ok":true,...}`.
5. **A jugar.** Cada uno abre la URL, elige su personaje en "¿Quién juega en este móvil?". Uno pulsa **Crear sala**,
   "Copiar enlace para invitar" y lo manda por WhatsApp. Se empieza con 3 o más jugadores (lo ideal son 6-7).

### Plan gratuito: lo que hay que saber
- Tras ~15 minutos sin nadie, el servidor se duerme. La primera visita después tarda 30-60 s en responder. **Ábrelo 5 minutos antes de quedar.**
- La web de Vercel avisa con "Despertando el servidor…" mientras tanto, y entra sola en cuanto responde.
- Para que no se duerma, un monitor gratuito (p. ej. UptimeRobot) que visite `https://TU-URL/health` cada 5 minutos. El plan de pago (7 $/mes) no se duerme.
- Si lo reinicias o lo vuelves a desplegar, las salas abiertas desaparecen (están en memoria).

### Actualizar el juego
Sube los archivos cambiados al repositorio (Add file → Upload files, y sobrescribe). Render lo vuelve a desplegar solo.
Si cambias `public/friends.js` (añadir un amigo, cambiar una altura...) súbele el número a `FRIENDS_VERSION` para que los móviles recojan el cambio.
Para añadir un amigo nuevo a la plantilla: su textura en `public/faces/nombre.jpg` y su entrada en `friends.js`.
Los invitados no necesitan esto: se crean solos desde el móvil con "Soy invitado".

## Opción B: jugar esta noche desde tu ordenador (sin subir nada)
1. Instala Node.js 18 o superior (nodejs.org).
2. En la carpeta del juego: `npm install` y `npm start`.
3. Misma wifi: abre `http://TU_IP_LOCAL:3000` en los móviles (la IP la ves con `ipconfig` en Windows o `ifconfig` en Mac/Linux; si el cortafuegos pregunta, permite Node).
4. Con amigos fuera de tu wifi: instala ngrok (ngrok.com, cuenta gratis) y ejecuta `ngrok http 3000`. Te da un enlace `https://...` para compartir.

## Otras plataformas
Railway, Fly.io o cualquier servidor con Node 18+: `npm install` y `npm start`. El servidor lee el puerto de la variable `PORT`.
Necesita WebSockets (todas las anteriores los admiten).

## Instalarlo como app (pantalla completa, sin barras)
- iPhone (Safari): botón Compartir → "Añadir a pantalla de inicio".
- Android (Chrome): menú ⋮ → "Instalar aplicación" o "Añadir a pantalla de inicio".
En horizontal se juega más cómodo; la vista previa de personajes y los botones funcionan igual en vertical.

## Ajustes y pruebas
Todo lo de la partida se ajusta desde la sala (botón "Ajustes de partida"): tiempos, velocidad, visión, tareas, reuniones, sabotajes, etc. Detalle en el README.
Para probar sin amigos: en los ajustes elige el conjunto **Pruebas**, sube "Jugadores de prueba (bots)" (hasta 9) y empieza la partida tú solo. Con el botón "Herramientas" puedes provocar sabotajes y teletransportarte.

## Lista de comprobación antes de quedar
- [ ] Abre la URL 5 minutos antes (despierta el servidor) y pulsa "Crear sala" para probar.
- [ ] Probad con dos móviles: uno crea la sala y otro entra con el enlace.
- [ ] Cada amigo elige su personaje en el menú; los que no están en la plantilla usan "Soy invitado".
- [ ] Chrome o Safari actualizados. Si sale pantalla negra, el móvil no tiene WebGL activado o es muy antiguo.
- [ ] Si alguien cambia de app o recarga, vuelve solo a su partida (tiene 60 s); si no, "Salir" y entrar de nuevo con el código.

## Problemas frecuentes
| Síntoma | Causa y solución |
|---|---|
| Tarda mucho en abrir | Servidor dormido (plan gratuito). Espera un minuto y recarga. |
| "No existe esa sala" | El código está mal escrito o el servidor se reinició. Crea una sala nueva. |
| "La partida ya ha empezado" | No se puede entrar a mitad de una partida. Esperad a que termine y "Volver a la sala", o crea otra sala. |
| Va a tirones | Cierra otras apps. En móviles muy antiguos juega en 1ª persona y con menos jugadores. |
| El botón de copiar enlace no copia | Sin HTTPS el navegador no deja copiar solo; el juego muestra el enlace para copiarlo a mano. |
| La foto del invitado queda desplazada | Reencuadra: ojos sobre los dos puntos naranjas y la cabeza llenando el óvalo. |

## Sonido
Es un sonido sintetizado en el móvil (no pesa nada). El navegador solo deja sonar tras el primer toque en la pantalla. En el iPhone, el interruptor lateral de silencio puede silenciar el navegador. El botón 🔊 está en el menú, en la sala y en la partida.

## Qué no incluye (por ahora)
Salas que sobrevivan a un reinicio del servidor, más mapas y protección contra tramposos (las posiciones las envía cada móvil; entre amigos sobra). No guarda datos de nadie: las fotos no salen del móvil y las salas viven solo en memoria.
