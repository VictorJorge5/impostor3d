# Impostor 3D

Juego tipo Among Us para jugar con amigos desde el navegador (móvil o PC), en 1ª o 3ª persona.

> Guía completa para ponerlo en internet: **DESPLIEGUE.md** (web en **Vercel** + servidor de juego en Render).

## Novedades 2.1 · diseño premium para móvil
- **Nueva identidad visual**: tipografías propias (Chakra Petch e Inter, servidas desde la web, sin Google), fondo espacial animado, tarjetas de cristal, botones con brillo y animaciones de entrada.
- **Pantalla de carga** con el logo mientras se descarga el motor 3D.
- **Menú**: tu personaje destacado, carrusel deslizable para elegir quién juega, "Crear partida" como acción principal y caja de código grande.
- **Guía "Cómo se juega"** (botón ?) que se abre sola la primera vez, y botón para **instalar la app** en Android.
- **Sala**: código en formato ticket (toca para copiar), jugadores en cuadrícula con su color, corona de anfitrión, huecos libres y botón de empezar fijo abajo.
- **HUD de partida**: botones de acción redondos con iconos (Usar, Reportar, Matar, Sabotaje, Rejilla) siempre en su sitio y que se encienden cuando se pueden usar, con cuenta atrás encima; **joystick flotante** que aparece donde pones el pulgar; lista de tareas plegable con contador; barra de iconos (vista, sonido, pantalla completa, salir); aviso para girar el móvil.
- **Gráficos**: paredes con paneles de nave y franja de luz, suelo con relieve, luz ambiental de cielo y suelo, sombras bajo los personajes, antialiasing y viñeta.
- Pantalla final con tarjetas de rol y menús (sabotaje, tareas, ajustes) con el mismo estilo.

## Novedades 2.0
- **Despliegue en Vercel**: la web va por el CDN de Vercel (carga rápida, HTTPS, cabeceras de seguridad, despliegue en cada push) y se conecta al servidor de tiempo real indicado en `GAME_SERVER_URL`.
- **Estado de la conexión** siempre visible (*Conectando… · Despertando el servidor… · En línea · 45 ms · Sin conexión*). En partida solo aparece si hay problemas.
- **Invitar amigos** abre el menú de compartir del móvil (WhatsApp, Telegram…) y el enlace muestra una vista previa con imagen. Tocar el código lo copia.
- **Enlace de invitación** con aviso "Te han invitado a la sala ABCD"; el código se escribe solo en mayúsculas e Intro entra.
- **Pantalla siempre encendida** en la sala y en la partida, **vibración** en los momentos clave (rol, muerte, reunión, sabotaje, tarea, voto, final) y botón de **pantalla completa** en horizontal (Android/PC).
- **Calidad gráfica adaptativa**: si el móvil va a menos de ~40 fps baja la resolución interna, y la sube si va sobrado.
- **App instalable y arranque instantáneo** (service worker): three.js, caras e iconos quedan guardados en el móvil.
- Servidor: CORS para la web de Vercel, `/health` con jugadores conectados, medición de ping y aviso a los jugadores antes de reiniciar.
- **Pruebas automáticas** (`npm test`) y GitHub Actions en cada push.

## Probarlo en tu ordenador
1. Instala Node.js 18 o superior.
2. En esta carpeta: `npm install` y luego `npm start`.
3. Abre http://localhost:3000, pulsa "Crear sala" y pasa el código (o el enlace) a tus amigos.
   Para jugar en la misma wifi, ellos entran a `http://TU_IP_LOCAL:3000`.

## Jugar por internet con amigos (gratis)
- **Servidor de juego** en Render.com ("Web Service" o Blueprint con `render.yaml`): build `npm install`, start `npm start`.
- **Web** en Vercel: importa el repositorio y define `GAME_SERVER_URL` con la URL de Render. Lo demás lo lee de `vercel.json`.
- También vale solo Render: su propia URL sirve la página y el juego.

## Personajes
- Los amigos de plantilla (Benjamín, Cristian, Pablo, Jaime, Santi, Víctor, José) llevan su **cara real**: la foto se recorta sin fondo, se alinea (ojos, barbilla, ancho de mejillas) a una cabeza común y se proyecta sobre una cabeza 3D. El **relieve** (nariz, cejas, labios, mentón) sale de los puntos faciales 3D de su propia foto. Lleva orejas, y los laterales y la nuca continúan con su piel y pelo (con degradado si lo llevan). El cuerpo lleva su ropa, complexión y altura.
- Están en `public/friends.js`; las texturas en `public/faces/<nombre>.jpg` y los relieves en `public/faces/<nombre>_h.png`.
- Altura editable: en "Cambiar personaje" hay un deslizador y una casilla en cm. Lo que edites a mano se respeta.
- Extras de ropa: manga o pantalón cortos, sandalias (`ss`), mochila (`mo`), bandolera (`ac`), logo en el pecho (`cl`), pelo con volumen (`hv`) y rizado (`hr`).
- Cualquier jugador puede crear su personaje desde el móvil: "Subir foto" o usar el creador de rasgos. "Jugador aleatorio" genera uno al azar. También se comparten con "Copiar código" / "Importar código".
- Para añadir un amigo a la plantilla: guarda su textura en `public/faces/`, añade su entrada en `friends.js` y sube `FRIENDS_VERSION`.

## Invitados (crear un personaje con 3 fotos)
Cualquiera que no esté en la plantilla puede crearse el suyo desde su móvil:
1. En el menú, "Soy invitado: crear mi personaje con fotos".
2. Pone su nombre y su altura (deslizador o casilla en cm), elige complexión y colores de ropa.
3. Hace 3 fotos, cada una con la cámara o desde la galería: de frente (obligatoria), giro de 45° a su derecha y giro de 45° a su izquierda (las dos últimas son opcionales, mejoran los lados de la cabeza).
   Para cada foto se ajusta con un óvalo guía (arrastrar, pellizcar para el zoom, control de inclinación). De frente, los ojos van sobre los dos puntos naranjas.
4. El móvil calcula la cabeza (textura esférica), la previsualiza en 3D y la guarda. Pulsa "Jugar con este personaje".
Las fotos no salen del móvil: a la sala solo se envía la textura de la cabeza. Con luz uniforme, sin gafas de sol ni gorra y con la cabeza entera en la foto sale mejor.
Se guarda en el navegador y se comparte con "Copiar código" / "Importar código".

## Controles
- PC: WASD mover, clic + ratón para mirar, E usar, R reportar, Q matar, V cambiar de vista.
- Móvil: joystick izquierdo para moverte, arrastra el resto de la pantalla para mirar, botones a la derecha.

## Ajustes de partida (como en Among Us)
En la sala, el anfitrión abre **"Ajustes de partida"**: ve todos los valores con deslizadores, interruptores y desplegables, y los demás jugadores los ven en solo lectura y se actualizan al instante.
No se pueden cambiar con la partida en marcha. Los últimos ajustes del anfitrión se recuerdan y se aplican al crear la siguiente sala.

**Conjuntos:** *Clásico* (valores por defecto) · *Rápido* (matar 10 s, sabotajes 10 s, crisis 25 s, discusión 5 s, votación 20 s, 2 tareas) · *Pruebas* (tiempos muy cortos, 2 tareas y modo pruebas activado).

| Ajuste | Valor por defecto | Rango |
|---|---|---|
| **Partida** | | |
| Impostores | 1 | 1 a 3 |
| Enfriamiento de matar | 20 s | 5 a 60 s |
| Terminales de información (cámaras, admin, vitales, puertas) | Sí | Sí / No |
| Distancia de matar | Media | Corta / Media / Larga |
| **Jugadores** | | |
| Velocidad de movimiento | 1× | 0.5 a 3× |
| Visión de la tripulación | 1× | 0.25 a 3× |
| Visión del impostor | 1.25× | 0.25 a 3× |
| **Reuniones** | | |
| Reuniones de emergencia por jugador | 1 | 0 a 9 |
| Enfriamiento del botón de emergencia | 10 s | 0 a 60 s |
| Tiempo de discusión | 15 s | 0 a 120 s |
| Tiempo de votación | 60 s | 10 a 300 s |
| Confirmar expulsiones | Sí | Sí / No |
| Votos anónimos | No | Sí / No |
| **Tareas** | | |
| Tareas por tripulante | 4 | 1 a 8 |
| Tareas comunes (las mismas para todos, marcadas con ★) | 1 | 0 a 2 |
| Barra de progreso de tareas | Siempre | Siempre / Solo tras las reuniones / Nunca |
| **Sabotajes** | | |
| Enfriamiento de sabotajes | 30 s | 5 a 60 s |
| Tiempo para arreglar el reactor | 45 s | 15 a 120 s |
| Tiempo para arreglar el oxígeno | 50 s | 15 a 120 s |
| Duración de las puertas cerradas | 12 s | 5 a 30 s |
| Permitir sabotaje de luces | Sí | Sí / No |
| Permitir sabotaje de comunicaciones | Sí | Sí / No |
| Permitir cierre de puertas | Sí | Sí / No |
| Permitir sabotaje del reactor | Sí | Sí / No |
| Permitir sabotaje de oxígeno | Sí | Sí / No |
| Ventilaciones del impostor | Sí | Sí / No |
| **Pruebas** | | |
| Modo pruebas | No | Sí / No |
| Jugadores de prueba (bots) | 0 | 0 a 9 |
| Mi rol en el modo pruebas | Al azar | Al azar / Impostor / Tripulante |

**Modo pruebas** (grupo "Pruebas"): permite empezar con **1 jugador**, la partida no termina sola (salvo si una crisis no se arregla) y el anfitrión tiene los botones "Herramientas" y "Terminar prueba". Con "Mi rol" eliges ser impostor o tripulante.

**Jugadores de prueba (bots):** con el modo pruebas activo puedes añadir hasta 9 bots que rellenan la sala (aparecen marcados con "· prueba"). Caminan por el mapa, los tripulantes hacen tareas, reportan cuerpos que ven cerca y votan; los impostores matan. Así se prueba una partida entera con un solo móvil. Si entra una persona y la sala está llena, se quita un bot.

**Herramientas de prueba** (botón "Herramientas", solo anfitrión y solo en modo pruebas):
- *Provocar un sabotaje* al instante, sin esperas y aunque seas tripulante: así puedes probar tú solo cómo se arregla cada uno (las luces, las comunicaciones y el oxígeno se arreglan en solitario; el reactor necesita a dos personas).
- *Teletransportarme* a cualquier sala.

Para pruebas automáticas existe la variable de entorno `TIME_SCALE` (por ejemplo `TIME_SCALE=0.2 npm start` divide todos los tiempos por 5). No hace falta para jugar.

## Reglas
- 3 a 10 jugadores (ideal 6-7). 1 impostor (2 opcional con 5 o más).
- Los tripulantes hacen 4 tareas cada uno. Ganan al completar todas o al expulsar a los impostores.
- Los impostores eliminan (enfriamiento ajustable, 20 s por defecto) y ganan al igualar en número a la tripulación, o si una crisis no se arregla a tiempo.
- Cada jugador tiene 1 reunión de emergencia (botón rojo de la mesa de la cafetería). No se puede convocar durante una crisis.
- Los fantasmas siguen haciendo tareas, ven a todos y atraviesan las paredes.

### Sabotajes (solo el impostor, con recarga de 30 s; botón "Sabotaje" o tecla G)
| Sabotaje | Efecto | Cómo se arregla |
|---|---|---|
| Luces | La tripulación casi no ve | Panel de la Eléctrica: poner los 5 interruptores en ON |
| Comunicaciones | La tripulación pierde la lista de tareas y el minimapa | Panel de Navegación: introducir un código |
| Puertas | Cierra las puertas de una sala 12 s | Se abren solas |
| Reactor (crisis, 45 s) | Si no se arregla, ganan los impostores | Dos jugadores mantienen a la vez los paneles del Reactor y de Motores |
| Oxígeno (crisis, 50 s) | Si no se arregla, ganan los impostores | Introducir el código en los dos depuradores (Navegación y Almacén) |
Los paneles se iluminan en rojo y salen marcados en el minimapa. Una reunión (por cuerpo reportado) anula el sabotaje.

### Ventilaciones (solo el impostor; botón "Ventilación" o tecla F)
Hay 8 rejillas en el suelo, en dos redes: Reactor-Navegación-Eléctrica-Cafetería (NE) y Cafetería (SO)-Enfermería-Almacén-Motores.
Dentro de una ventilación nadie te ve: no puedes matar, sabotear ni moverte por el mapa, solo viajar a las rejillas conectadas o salir. Si alguien está cerca verá un anillo al entrar o salir.


### Reuniones y votación (como en Among Us)
- **Pantalla:** "¿Quién es el impostor?" con una **tarjeta por jugador** (su cara y su nombre) y una barra de tiempo. Primero va la **discusión** (no se puede votar) y después la **votación**.
- **Votar:** toca la tarjeta de quien creas que es el impostor y confirma con **✓** (o cancela con **✕**). **"Saltar voto"** también pide confirmación. No se puede votar a uno mismo ni a un eliminado.
- **"HA VOTADO":** cuando alguien vota, su tarjeta recibe un sello (sin decir a quién ha votado).
- **Chat:** botón 💬 arriba a la izquierda, con un contador de mensajes sin leer. En pantallas anchas el chat va fijo a la derecha.
- **Resultado:** bajo cada tarjeta aparecen **las caras de quienes la han votado**, y en "Saltar voto" las de quienes se han saltado el voto. Con **votos anónimos** salen solo puntos grises con el recuento. El expulsado se marca en rojo y después viene la animación de expulsión.

### Terminales de información (cualquier jugador vivo; botón "Usar" junto al terminal)
| Terminal | Dónde | Qué da |
|---|---|---|
| **Cámaras de seguridad** | Almacén | 4 vistas en directo del mapa 3D (pasillos oeste, este y norte, y la cafetería), a pantalla completa y sin el HUD encima (en el móvil en vertical se apilan en una columna). Mientras alguien mira, **la luz roja de las cámaras parpadea para todos** |
| **Panel de administración** | Cafetería | Cuánta gente hay en cada sala, con puntos de su color (no la posición exacta). Un impostor dentro de una ventilación no aparece |
| **Signos vitales** | Enfermería | Todos los jugadores con su electrocardiograma: VIVO o MUERTO en directo |
| **Registro de puertas** | Eléctrica | Quién ha entrado o salido de cada sala y hace cuántos segundos (se ignoran los rebotes en el umbral; las ventilaciones no dejan rastro) |

Mientras usas un terminal no puedes moverte (y sigues siendo vulnerable). Los fantasmas no los usan. El **sabotaje de comunicaciones** deja sin señal a las cámaras, al panel y al registro de puertas (los signos vitales siguen funcionando). Una reunión apaga las cámaras. Se pueden desactivar en los ajustes.

## Animaciones y sonido
- **Inicio:** pantalla de rol con tu equipo (el impostor ve a sus compañeros; la tripulación, a todos) y cuántos impostores hay.
- **Muerte:** la víctima cae hacia atrás, salpica sangre y aparece el cuerpo; el impostor se lanza hacia ella y nota un destello; la víctima ve la pantalla "ELIMINADO" con quién la ha matado.
- **Reuniones:** aviso a pantalla completa ("¡CUERPO REPORTADO!" o "REUNIÓN DE EMERGENCIA") y, tras los votos, la **expulsión**: el personaje sale despedido por el espacio y se escribe si era impostor y cuántos quedan (según los ajustes).
- **Sonido:** todo sintetizado en el propio móvil (no hay archivos de audio): intro de tripulación y de impostor, muerte, reunión, expulsión, tareas, sabotajes, puertas, ventilaciones, cámaras, victoria y derrota, la sirena de las crisis y el zumbido de las cámaras. Lo que pasa lejos suena más bajo y un limitador evita que se distorsione si suenan varios a la vez. Botón 🔊/🔇 en el menú, en la sala y en la partida; se recuerda.

## Reconexión
Si un jugador cambia de app, pierde la conexión o recarga la página, vuelve solo a su partida con su personaje, rol y tareas (tiene 60 s). Hay botones "Salir" en la sala y en la partida.
