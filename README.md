# Impostor 3D

Juego tipo Among Us para jugar con amigos desde el navegador (móvil o PC), con vista cenital y vuestras caras.

> Guía completa para ponerlo en internet: **DESPLIEGUE.md** (web en **Vercel** + servidor de juego en Render).

## Novedades 6.1 · reuniones, expulsión, final, fantasmas y mascotas como en el original
- **Inicio de reunión como el original**:
  - "¡REUNIÓN DE EMERGENCIA!" con quien la convoca aporreando el botón de la mesa.
  - "¡CADÁVER REPORTADO!" con el cuerpo y el bocadillo de la calavera.
  - Fondo rojo con estelas y franjas amarillas y negras.
- **Resumen de la reunión**: antes de debatir se ven quienes han muerto en la ronda, con el sello **MUERTO**, y quien la ha convocado con el megáfono.
- **Expulsión con los textos del original**:
  - "X era el impostor." (o "un impostor" si hay más de uno) y "Queda 1 impostor.".
  - "Nadie ha sido expulsado. (Empate)" o "(Saltado)".
- **Pantalla final como el original**:
  - "Victoria" o "Derrota" con letra de ordenador antiguo, luz turquesa si ganas y roja si pierdes.
  - **SALIR** y **OTRA VEZ** en las esquinas; los resultados, más abajo.
  - Si los impostores se desconectan, gana la tripulación (y al revés).
- **Fantasmas como en el original**:
  - Pueden mirar las cámaras, el Admin y los signos vitales (sin encender la luz roja de las cámaras).
  - Nuevo botón **Acechar**: sigues a un jugador vivo; cada toque pasa al siguiente y al moverte lo dejas.
- **Ajustes como los del original**: volumen de los efectos, tamaño del joystick, **texto para daltónicos** (el nombre del color en la nave, en las reuniones y en el chat) y temblor de pantalla.
- **Mascotas**:
  - 4 nuevas: hámster, ovni, cangrejo y calamar.
  - Se asustan en la animación de muerte de su dueño.
  - **Se quedan llorando donde murió** (o junto a la mesa si lo expulsaron) hasta el final de la partida.
- **Detalles del mapa**: ventiladores que giran en Motores, Oxígeno, Eléctrica y Almacén; luces de aviso del reactor; mancha de sangre bajo los cadáveres.
- Arreglado: la luz roja de las cámaras ya se apaga cuando la última persona deja de mirarlas.

## Novedades 6.0 · sabotajes, Admin, tareas y sala de espera como en el original
- **La sala de espera es una nave**, como el lobby del original:
  - Te mueves por ella con tus amigos.
  - En el **portátil** el anfitrión cambia los ajustes.
  - En el **armario** te cambias de color, ropa y cara.
  - "Empezar" está abajo a la derecha.
- **Sabotajes como en The Skeld**:
  - **Puertas**: cierran 10 s, cada sala tiene su propia recarga y **se pueden cerrar varias a la vez**. Mientras estén cerradas no hay otros sabotajes, pero sí se puede pulsar el botón de emergencia, y la reunión las abre.
  - **Reactor y oxígeno**: 30 s.
  - **Escáner de mano del reactor**: dice "MANTÉN PARA DETENER LA FUSIÓN" y "ESPERANDO AL SEGUNDO USUARIO".
  - **Teclado del oxígeno**: parpadea OK o MAL.
  - **Luces**: unas 5 veces menos visión.
  - **En la lista de tareas de todos** aparece "Arreglar luces (%)", "Comunicaciones saboteadas", "Fusión del reactor en Xs"…, parpadeando en rojo y amarillo.
  - **Comunicaciones caídas**: cámaras, Admin y registro de puertas ponen "[COMUNICACIONES DESACTIVADAS]" y el mapa no marca las tareas.
- **Admin**: en cada sala salen tantos tripulantes grises como gente haya, sin decir quién. Los pasillos no cuentan; los que están en una rejilla y los cuerpos, sí.
- **Tareas comunes, largas y cortas** como en el original: por defecto 1 común (la misma para todos), 1 larga y 2 cortas. Se configura en la sala.
- **El impostor ya no tiene tareas** (salvo en el modo pruebas, para probar los minijuegos).
- La rejilla de Eléctrica está arriba a la izquierda, detrás del tabique.

## Novedades 5.9 · muertes, cuerpos, rejillas y fantasmas como en el original
Hecho con las imágenes y los datos de la wiki de Among Us:
- **Cuatro animaciones de muerte al azar**, las del original:
  - Cuchillo: un brazo sale de la cabeza del impostor.
  - Cuello: le gira el casco.
  - Lengua: con pincho.
  - Pistola: te tira al suelo y dispara.
  - Todas sobre el fondo rosa con llamaradas rojas. Solo las ve la víctima.
- **El cadáver del original**: la mitad de abajo tumbada, con el corte a la vista y el hueso asomando.
- **Matar como en el juego**:
  - Las paredes lo impiden (las puertas no).
  - El impostor salta hasta la víctima.
  - Al empezar la recarga es de 10 s y dentro de la rejilla se para.
- **Rejillas**: dentro salen flechas hacia las rejillas conectadas y se sale con el mismo botón.
- **Fantasmas**: van 1,2 veces más rápido y en la reunión ven la tableta rajada.
- **Barra de tareas** arriba del todo, gris y verde, con "TAREAS TOTALES COMPLETADAS".
- **Comunicaciones saboteadas**: la barra se pone verde oscuro y la lista lo dice.

## Novedades 5.8 · votación, sabotaje y cámaras como en el original
- **La votación es la tableta del original**:
  - Marco gris con botón, pantalla azul y el título "¿Quién es el impostor?".
  - Tarjetas en dos columnas con el casco y la cara de cada uno, y la pegatina "HE VOTADO".
  - Los eliminados salen tachados en gris y el megáfono marca a quien convocó.
  - Para votar se elige con ✖ / ✔. Abajo están "Saltar voto" y "La votación empieza/termina en: Xs".
  - Al empezar sale el círculo verde de **"¡A DEBATIR!"** con dos tripulantes cara a cara.
  - En el resultado, los votos aparecen como tripulantes en miniatura (grises si son anónimos).
- **Sabotaje desde el mapa, como en el juego**:
  - El botón de sabotaje abre el mapa en rojo con un icono en cada sala: luces, reactor, oxígeno, comunicaciones y las puertas de las 7 salas que las tienen.
  - Se puede seguir andando con el mapa abierto.
  - Un toque recién abierto no cuenta, así no se marca nada sin querer.
  - La recarga se ve en los iconos.
- **Cámaras**:
  - Las cuatro del original, en su orden: pasillo de Navegación, de Admin, de Enfermería y de Seguridad.
  - Monitor con marco y más campo de visión.
  - Estática si se sabotean las comunicaciones.
  - Los fantasmas no encienden la luz roja.
- **Sin zoom en la partida.**
- **Móvil en horizontal**:
  - Menú, editor y sala de espera a dos columnas.
  - En la partida solo queda la rueda de ajustes; dentro están el sonido, la pantalla completa y salir.
  - Administración, signos vitales y chat caben en pantalla.

## Novedades 5.7.1 · nadie aparece encajado
- **La web y el servidor de juego comprueban que tienen el mismo mapa.** Si la página es antigua, se recarga sola; si el servidor aún se está actualizando (Render tarda unos minutos tras cada cambio), te avisa en vez de meterte en una partida con las mesas y paredes descolocadas.
- **Nunca te quedas encajado**: si por lo que sea apareces dentro de una mesa, un aparato o una pared, el juego te saca al hueco libre más cercano. Al empezar, todos aparecen en corro alrededor de la mesa, sin pisar los bancos.
- **Ningún aparato tapa una puerta** (Admin, Comunicaciones, motores y Eléctrica) y los bots recorren todo el mapa.
- El botón de emergencia se puede pulsar desde un poco más lejos.

## Novedades 5.7 · el mapa de The Skeld calcado del plano
- **El mapa es el del original**: cada sala, pasillo y tabique está calcado del plano oficial de The Skeld, con sus formas (esquinas en diagonal, el reactor en cruz, la Eléctrica con su tabique...), sus tamaños y sus puertas. Navegación tiene una sola entrada, como en el juego.
- **Cada tarea, rejilla, cámara y terminal está donde en el original**: los cables del pasillo de Seguridad y Admin, el lector de tarjetas junto a la mesa de Admin, los bidones al fondo del Almacén, las cuatro camas de Enfermería...
- **Suelos con los colores de cada sala** (Admin granate, Seguridad verde, Reactor morado, Escudos y Armería beis...) y **mesas azules con bancos** en la Cafetería, con el botón de emergencia en la del centro.
- **Animaciones de las tareas visuales como en el juego**: al destruir asteroides, los cañones de fuera de Armería disparan; al vaciar la basura del Almacén, sale despedida al espacio; al activar los escudos, se encienden por fuera de la nave; el escáner médico te recorre con anillos verdes.
- **Minijuegos más fieles**: la tarjeta es el carné verde con tu cara y tu nombre ("Mala lectura", "Demasiado rápido"...), los láseres de los asteroides salen de las dos esquinas, el combustible cae por el tubo y los escudos lanzan una onda al completarse.
- La visión es algo mayor para ir con la escala del mapa.

## Novedades 5.6 · la cara se amolda y todas las tareas de The Skeld
- **Las tareas son aparatos en la pared**, como en el original: cuadros de cables, lectores de tarjeta, terminales de datos, distribuidor con diales, panel de desvío con 8 palancas, depósitos de combustible, trampilla de basura, filtro de oxígeno, paneles del reactor y de escudos... Si no hay pared detrás, van sobre un pedestal. El escáner médico es una plataforma en el suelo. Los paneles de sabotaje (luces, teclados de oxígeno, rueda de comunicaciones, escáneres de mano del reactor) también.
- **Velocidad fija** como en el original: el joystick solo marca la dirección; aunque lo muevas poco, el personaje va siempre a la misma velocidad.
- **Ajustes del móvil** (botón de rueda en el menú y en la partida): joystick a la derecha con los botones a la izquierda, vibración, sonido y ayuda de teclas.
- **El impostor no hace tareas** en las partidas con amigos: tiene una lista de tareas falsas para disimular, como en el juego (sí puede arreglar sabotajes). En el modo pruebas sigue pudiendo hacerlas para probar los minijuegos.
- **La cara se amolda al visor**: con foto, el visor toma la forma de la cara (un poco más alto que ancho) y se ve la cara entera, de la frente a la barbilla, sin deformarla y con un sombreado de esfera, como si estuviera sobre la cabeza. Sin foto se queda el visor ancho del original.
- **Eléctrica como en el original**: al entrar (abajo a la derecha) está el panel de las luces en un gran tabique que separa la entrada de la parte de atrás, donde están los cables, el distribuidor, desviar energía y la rejilla.
- **Todas las tareas de The Skeld**:
  - Descargar datos también en Eléctrica.
  - Aceptar energía en los dos motores, Navegación, Oxígeno, Seguridad, Escudos, Armería y Comunicaciones.
  - Cables también en Seguridad (6 sitios, como en el juego).
  - Nueva tarea **Limpiar rejilla**: abres la rejilla y quitas la suciedad. Sale en la cafetería, administración, enfermería, navegación o escudos.

## Novedades 5.5 · caras bien visibles
- **Visor mucho más grande** en los crewmates: la cara ocupa casi todo el frente del casco, con un encuadre cerrado (ojos, nariz y boca) y un poco más de brillo y contraste.
- El reflejo del cristal se queda en una esquina y ya no cruza la cara.
- Personajes un poco más grandes en el mapa y retratos (menú, sala, reuniones) con la cara llenando el círculo.

## Novedades 5.4 · tareas como en el original
- **Tareas por partes como en The Skeld**:
  - Cables: tres cuadros seguidos (Eléctrica o Almacén → Administración o Cafetería → Navegación).
  - Combustible: llenar el bidón, motor superior, volver a llenarlo y motor inferior.
  - Alinear motores: superior y después inferior.
  - Basura: la de la Cafetería o el conducto de Oxígeno, y después el Almacén.
- **Nueva tarea "Estabilizar dirección"** en Navegación: arrastra la mira al centro.
- **Comunicaciones** se arreglan girando la rueda de frecuencia hasta que la señal quede limpia (antes era un código; el código se queda para el oxígeno, como en el original).
- **Duraciones y reglas del original**:
  - Analizar muestra: 60 s, y puedes irte y volver.
  - Escáner médico: 10 s.
  - Iniciar reactor: 5 rondas.
  - Asteroides: 20.
  - Descarga y subida de datos: unos 8 s, con la estimación de tiempo absurda.
  - Desviar energía: 8 palancas.
- Cables con los cuatro colores del original y las franjas de peligro.

## Novedades 5.3 · The Skeld a su tamaño
- **Mapa a la escala del original**: antes medía el doble y las salas se veían enormes. Ahora todo se escribe en las coordenadas de The Skeld (las rejillas están en sus posiciones reales) y se pasa a metros con 1 unidad = 2,2 m, así que salas, pasillos y distancias guardan la proporción del juego.
- Distribución revisada: cafetería octogonal con sus 3 salidas, pasillo de arriba hasta el motor superior con la enfermería debajo, pasillo oeste con el reactor a un lado y seguridad al otro, eléctrica y almacén abajo, pasillo de administración, pasillo derecho de armería a escudos con oxígeno y las dos puertas de Navegación, y comunicaciones bajo el pasillo de escudos.
- Cámara más cerca (como en el juego), distancias de matar a la escala nueva (corta, media y larga) y radio de uso más corto.
- Arreglado: el aviso del sabotaje de comunicaciones decía que se arreglaba en Navegación (es en Comunicaciones), y el botón Usar elegía el registro de puertas en lugar del panel de luces cuando los dos estaban cerca.

## Novedades 5.2 · el mapa de The Skeld
- **El mapa tiene la forma de The Skeld**: cafetería octogonal arriba en el centro, motor superior e inferior a la izquierda con el reactor entre ellos, seguridad y enfermería junto al pasillo oeste, eléctrica y almacén abajo, administración a la derecha del pasillo de la cafetería, oxígeno y armería arriba a la derecha, la cabina de Navegación en punta con ventanas, escudos abajo a la derecha y comunicaciones debajo del pasillo de escudos.
- **Paredes en diagonal** como en el original (el mapa ya no es una cuadrícula: son polígonos). Las puertas salen solas donde un pasillo toca una sala, y las cierra el sabotaje de puertas.
- Tareas, paneles, rejillas (con las mismas conexiones que en The Skeld), cámaras y muebles colocados en su sala como en el juego. "Desviar energía" está en Eléctrica.
- El mapa pequeño, el mapa grande y el panel de administración muestran la nueva forma.
- **Importante**: el servidor de juego usa el mismo `shared.js` (choques, puertas y bots), así que hay que redesplegarlo.

## Novedades 5.1 · el mapa lleno y las pantallas del original
- **Salas llenas como en The Skeld**: mesas redondas con taburetes en la cafetería, motores gigantes con llama, reactor azul que gira con sus tuberías, camas en la enfermería, generador y armarios en Eléctrica, montañas de cajas y barriles en el almacén, mesa del mapa con holograma y sofá en Administración, sillas y mandos de pilotaje en Navegación, árbol y botellas en Oxígeno, cañón en Armería, generador de escudos, torre de antena en Comunicaciones...
- **Paredes con detalles** según la sala (ventanas al espacio, pantallas, cuadros eléctricos, estanterías, tuberías, botiquines, botellas de oxígeno) y suelo con rejillas, marcas y sombra junto a las paredes. Los muebles tapan a quien pasa por detrás.
- **Pantallas como el original**: "¡Shhhhh!" al empezar, "Tripulante"/"Impostor" con tu equipo en fila y las caras en el visor, escena de muerte sobre fondo rojo, aviso de reunión con rayos, votación en una tablet, y "Victoria"/"Derrota" con los ganadores en fila antes de las estadísticas y el MVP.
- **Mapa grande** al tocar el minimapa (o tecla M): salas, tus tareas pendientes con "!", los sabotajes y tu crewmate.
- Barra verde de **tareas completadas** como en el juego.

## Novedades 5.0 · ahora sí, como Among Us
- **Todo en 2D plano, como el original**: se ha quitado el motor 3D. El mapa se ve desde arriba con suelos de cada sala, paredes con frente, ventana de Navegación, rejillas, mesa de emergencia y consolas dibujadas como en The Skeld.
- **Crewmates de verdad** (alubia con mochila, piernas que andan, contorno negro) con **tu cara dentro del visor**. Sin foto se ve el visor azul clásico. Los fantasmas flotan con cola, los cuerpos salen partidos con el hueso.
- **Los 12 colores de Among Us** (rojo, azul, verde, rosa, naranja, amarillo, negro, blanco, morado, marrón, cian y lima). Eliges tu color en el editor y el servidor te lo da si está libre en la sala.
- **Editor por pestañas**: Tu foto (color y altura), Sombrero (sombrero, bufanda/capa/pajarita), Traje (equipaciones de fútbol con dorsal) y Mascota.
- **Visión como el original**: círculo de luz con línea de visión y el resto en sombra; con las luces saboteadas casi no ves (el impostor sí).
- Mapa pequeño azul, cámaras, expulsión al espacio, aviso de reunión con quien la convoca y botones de acción cuadrados como en el juego.
- Se mantiene todo lo anterior: caras de tus amigos, tareas por pasos, tareas visuales (con opción para quitarlas), el impostor arregla sabotajes y hace tareas falsas, votarte a ti mismo, tareas de fantasma, chat de fantasmas y pantalla final con MVP.
- **Importante**: el servidor de juego (Render) debe actualizarse con este código (elección de color y reglas).

## Novedades 4.4 · fallos arreglados y reglas como el original
- **Tu foto, lo primero**: el editor abre en la pestaña **Tu foto** (al crear un personaje con "Con mis fotos", con "+ Nuevo" o si aún no tiene foto). Antes se abría en *Fútbol* y los botones de cámara/galería quedaban escondidos.
- **Reglas del original**: no se puede pulsar el botón de emergencia durante un sabotaje (salvo puertas); las luces y las comunicaciones siguen saboteadas después de una reunión (el reactor, el oxígeno y las puertas se reinician); el impostor fantasma puede seguir saboteando; los fantasmas tienen su propio chat que solo leen otros fantasmas; el primer asesinato de la partida tarda como mucho 10 s.
- **Fallos arreglados**: la reconexión ya no caduca en partidas de más de 15 minutos; el anfitrión que se reconecta en la pantalla final conserva "Volver a la sala"; si el anfitrión se desconecta en la sala o al final, otro jugador pasa a serlo; no se puede empezar una partida contando a jugadores desconectados; si el último impostor se va durante una reunión, la tripulación gana al momento; los menús de sabotaje y de pruebas ya no se quedan abiertos entre partidas; una tarea terminada cuenta aunque cierres el minijuego enseguida; al morir durante un apagón o con las comunicaciones caídas dejas de sufrir sus efectos; el impostor que se mete en una rejilla deja de sujetar el panel del reactor; al reconectar no se pierden reuniones de emergencia.

## Novedades 4.3 · más juego para todos
- **El impostor puede arreglar sabotajes** (luces, comunicaciones, oxígeno y reactor). Sus tareas son falsas: no las puede hacer (desde la 5.6; antes sí).
- **Puedes votarte a ti mismo** en las reuniones.
- **Tareas visuales**: cuando un tripulante hace el escáner médico, los asteroides, la basura o los escudos, los demás lo ven (haz verde sobre él, rayos desde Armería, basura cayendo, cúpula azul del escudo). Si lo ves con tus ojos, es inocente; el impostor puede hacer la tarea, pero no se ve nada. Se puede desactivar en los ajustes de la sala (*Tareas visuales*).
- **Los fantasmas siguen haciendo tareas**, que cuentan para la victoria de la tripulación.
- **Pantalla de resultados**: el **MVP** de la partida, quién era impostor, asesinatos y sabotajes de cada impostor, tareas hechas por cada jugador, votos al impostor y cuerpos reportados.

## Novedades 4.2 · tareas por pasos
Como en el original, algunas tareas tienen varios pasos en salas distintas y hay que hacerlos en orden. La lista muestra solo el paso que toca y cuántos llevas (por ejemplo *Subir datos · Administración (1/2)*); el "!" y el anillo del suelo solo aparecen en la consola del paso actual, y el servidor no acepta un paso antes que el anterior.

| Tarea | Pasos |
|---|---|
| Descargar y subir datos | Descargar datos en Cafetería, Comunicaciones, Armería o Navegación (te toca una) → Subir datos en Administración |
| Repostar motores | Llenar el bidón en el Almacén → Repostar el motor superior → Repostar el motor inferior |
| Desviar energía | Subir la palanca de tu sala en el Reactor → Aceptar la energía en esa sala (Navegación, Escudos, Oxígeno o Seguridad) |

Cada paso cuenta en la barra de tareas; "Tareas por tripulante" cuenta cada tarea entera (una tarea por pasos vale por una).

## Novedades 4.1 · caras bien visibles
- En la partida las cabezas con foto van más grandes (estilo cabezón) y **siempre giran hacia la cámara** (hasta ~90°) levantando un poco la cara.
- Cámara más baja (~46°) y más cerca, para ver las caras de frente en lugar de desde arriba.

## Novedades 4.0 · cámara cenital y visión real
- **Una sola cámara, desde arriba** (inclinada ~55° y siempre mirando al norte), como en el original: se acabaron la 1ª y la 3ª persona y el arrastrar para girar. Los personajes van más grandes y, cuando te paras, se giran hacia la cámara para que **siempre se os vean las caras**.
- **Control directo**: el personaje va hacia donde empujas el joystick (o WASD/flechas). Botón de lupa (o tecla **Z** / rueda del ratón) para alejar o acercar la cámara.
- **Visión limitada de verdad**: solo ves un círculo a tu alrededor; las paredes y las puertas cerradas cortan la vista (niebla de guerra calculada con rayos y aplicada en el shader de todo el escenario). Fuera de tu visión el mapa queda en penumbra y **los jugadores y cuerpos que no ves no aparecen** (tampoco puedes reportar ni matar a quien no ves).
- El ajuste **Visión** de la sala ahora cuenta de verdad: 1× ≈ 7,5 m de radio; el impostor ve más (1,25× por defecto) y, con el **apagón**, la tripulación apenas ve a 2 m mientras el impostor sigue viendo bien. Los fantasmas lo ven todo.
- Las paredes que quedan entre la cámara y tú se abren en un círculo para que nunca te tapen; paredes más bajas y sin techo.
- Las cámaras de seguridad siguen viendo a todo el que pasa por sus pasillos, aunque tú no tengas visión directa.

## Novedades 3.1 · personajes vivos, mascotas y luces
- **Animación de los personajes**: brazos y piernas que se balancean al andar, rebote suave, un leve vaivén en reposo, giros suaves y los fantasmas flotan con las piernas colgando.
- **Rejillas animadas**: el impostor gira y se hunde al entrar, salta al salir y la tapa se abre y se cierra.
- **Muerte con más impacto**: la víctima sale despedida girando y agitando los brazos; onda roja en el suelo, el doble de sangre, un charco que se extiende y el hueso, como en el original.
- **Mascotas** que te siguen por la nave dando saltitos: perrito, gatito, robot, minitripulante (del color de tu ropa), pollito y dron.
- El editor permite quitar la **mochila** (Víctor ya puede quitársela), elegir zapatillas o sandalias y, en las caras con foto, el volumen del pelo y si es rizado.
- **Votación**: una tarjeta destacada dice quién encontró el cuerpo y de quién era (o quién convocó la reunión), y su tarjeta lleva el sello "LO ENCONTRÓ"/"CONVOCÓ".
- **Iluminación**: una luz de color real en cada sala que tiñe el suelo, las paredes y a los jugadores. Con el sabotaje de luces parpadean y se apagan (y vuelven parpadeando); en las crisis todo late en rojo.
- **Tareas nuevas**: *Destruir asteroides* en Armería (toca 15 asteroides) y *Activar escudos* en Escudos (toca los hexágonos rojos).

## Novedades 3.0 · mapa tipo The Skeld, ropa y fútbol
- **Mapa nuevo inspirado en The Skeld**: 14 salas (Cafetería, Motor superior e inferior, Reactor, Seguridad, Enfermería, Eléctrica, Almacén, Administración, Comunicaciones, Escudos, Navegación, Oxígeno y Armería) unidas solo por pasillos largos. Eléctrica es una sala sin salida y hay rutas separadas a cada lado de la nave.
- **Escenario premium**: suelo propio en cada sala, techo con lámparas, paredes con la luz de su sala, marcos de puerta iluminados, compuertas blindadas, ventanal al espacio en Navegación y decoración con volumen (núcleo del reactor animado, motores, camilla, mesas con taburetes, sillón del piloto y cajas).
- **Consolas 3D distintas para cada tarea** (escáner médico con haz que sube y baja, depósito de combustible, ordenador con gráfica, filtro con ventilador...) con un anillo en el suelo cuando la tarea es tuya. Paneles de sabotaje con franjas de aviso y terminales con pantalla.
- **Minijuegos a pantalla completa** con aspecto de dispositivo y la sala indicada; mientras están abiertos la escena de fondo apenas se repinta, para que vayan fluidos.
- **Ropa**: equipaciones de **Real Madrid, FC Barcelona, Atlético de Madrid, España** y portero (colores de cada club, sin escudos), con **dorsal** y **nombre en la espalda**; prendas nuevas (sudadera con capucha, chaqueta y corbata, polo, camisa de cuadros, tirantes); **13 sombreros** (gorra hacia atrás, vaquero, copa, fiesta, corona, boina, auriculares, vikingo, pescador, halo...) y accesorios (bufanda, cadena de oro, capa, pajarita). El editor va por pestañas: Cuerpo, Cara, Ropa, Fútbol y Extras.
- Pruebas automáticas del mapa: desde la cafetería se llega a todo, las salas solo se tocan a través de pasillos y la decoración no bloquea nada.

## Novedades 2.2 · tareas como en el original
Cada consola tiene ahora su propio minijuego animado (en `public/tasks.js`), pensado para el dedo y con sonido y vibración:

| Tarea | Sala | Cómo se hace |
|---|---|---|
| Conectar cables | Eléctrica | Arrastra cada cable hasta el conector de su color |
| Calibrar distribuidor | Eléctrica | Pulsa "Calibrar" cuando la aguja pase por la zona iluminada (3 diales) |
| Descargar / subir datos | Varias salas → Administración | Pulsa "Descargar" (o "Subir") y mira cómo viajan los archivos |
| Trazar rumbo | Navegación | Lleva la nave de punto en punto sin salirte de la ruta |
| Iniciar reactor | Reactor | Memoriza la secuencia y repítela (4 rondas) |
| Desbloquear colectores | Reactor | Pulsa del 1 al 10 en orden |
| Escáner médico | Enfermería | Quédate en la plataforma mientras te escanea (sale tu cara y tus datos) |
| Analizar muestra | Enfermería | Inicia el análisis, espera y elige el tubo anómalo |
| Llenar bidón / repostar motor | Almacén → motores | Mantén pulsado hasta llenar el bidón o el depósito |
| Desviar / aceptar energía | Reactor → una sala | Sube la palanca de la sala que te toca; allí pulsa "Aceptar" |
| Alinear motor | Motor superior | Mueve la palanca hasta centrar la línea del motor |
| Pasar tarjeta | Administración | Saca la tarjeta y deslízala por el lector, ni rápido ni lento |
| Vaciar basura | Almacén | Baja la palanca y mantenla hasta que caiga todo |
| Limpiar filtro | Oxígeno | Arrastra las hojas hasta la rejilla |
| Destruir asteroides | Armería | Toca los asteroides antes de que crucen la pantalla (15) |
| Activar escudos | Escudos | Toca los hexágonos rojos hasta completar el escudo |

Los paneles de sabotaje también cambian: palancas para las luces y teclado con pantalla LED para comunicaciones y oxígeno.

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
- Los amigos de plantilla (Benjamín, Cristian, Pablo, Jaime, Santi, Víctor, José) llevan su **cara real**: la foto se recorta sin fondo, se alinea (ojos, barbilla, ancho de mejillas) a una cabeza común y y se ve dentro del visor de su crewmate. Cada uno tiene su color de Among Us.
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
4. El móvil calcula la cabeza (textura esférica), la previsualiza en su crewmate y la guarda. Pulsa "Jugar con este personaje".
Las fotos no salen del móvil: a la sala solo se envía la textura de la cabeza. Con luz uniforme, sin gafas de sol ni gorra y con la cabeza entera en la foto sale mejor.
Se guarda en el navegador y se comparte con "Copiar código" / "Importar código".

## Controles
- PC: WASD o flechas para moverte, E usar, R reportar, Q matar, G sabotaje, F rejilla, Z (o la rueda) acercar/alejar.
- Móvil: pon el pulgar izquierdo en cualquier sitio para moverte (vas hacia donde empujas), botones a la derecha.

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
| Comunicaciones | La tripulación pierde la lista de tareas y el minimapa | Panel de Comunicaciones: introducir un código |
| Puertas | Cierra las puertas de una sala 12 s | Se abren solas |
| Reactor (crisis, 45 s) | Si no se arregla, ganan los impostores | Dos jugadores mantienen a la vez los dos paneles del Reactor |
| Oxígeno (crisis, 50 s) | Si no se arregla, ganan los impostores | Introducir el código en los dos depuradores (Oxígeno y Administración) |
Los paneles se iluminan en rojo y salen marcados en el minimapa. Una reunión (por cuerpo reportado) anula el sabotaje.

### Ventilaciones (solo el impostor; botón "Ventilación" o tecla F)
Hay 11 rejillas en cuatro redes, como en el original: Reactor-Motor superior-Motor inferior · Enfermería-Seguridad-Eléctrica · Cafetería-Administración · Navegación-Armería-Escudos.
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
| **Cámaras de seguridad** | Seguridad | 4 vistas en directo del mapa (pasillo de motores, pasillo sur, pasillo de Administración y pasillo de Navegación), a pantalla completa y sin el HUD encima (en el móvil en vertical se apilan en una columna). Mientras alguien mira, **la luz roja de las cámaras parpadea para todos** |
| **Panel de administración** | Administración | Cuánta gente hay en cada sala, con puntos de su color (no la posición exacta). Un impostor dentro de una ventilación no aparece |
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
