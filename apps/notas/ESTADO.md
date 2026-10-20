# ESTADO del proyecto · Anotomía (app de notas para estudiantes)

Última actualización: 20 de octubre de 2026 (auditoría de las etapas 0 a 14 y correcciones posteriores)

## Etapas
- [x] Etapa 0 · Preparación del entorno (aprobada)
- [x] Etapa 1 · Diseño visual (aprobada)
- [x] Etapa 2 · Base del proyecto y almacenamiento (aprobada)
- [x] Etapa 3 · Biblioteca de documentos (aprobada)
- [x] Etapa 4 · Motor de lienzo (aprobada)
- [x] Etapa 5 · Escritura a mano (aprobada; grosor ajustado para mantenerse uniforme con cualquier zoom)
- [x] Etapa 6 · Texto con teclado (aprobada)
- [x] Etapa 7 · Pizarrón infinito completo (aprobada)
- [x] Etapa 8 · Renglones (aprobada)
- [x] Etapa 9 · Tarjetas (aprobada: fichas de estudio, navegación, duplicado e impresión)
- [x] Etapa 10 · Páginas A4 (aprobada: hojas continuas verticales, paginación, navegación, duplicado e impresión en hojas A4 con/sin renglones)
- [x] Etapa 11 · Imágenes y símbolos (aprobada: inserción en los 3 formatos, recorte y redimensionado, duplicación sin huérfanos, catálogo estándar de más de 250 símbolos en 5 categorías, pestañas, búsqueda sin tildes, atajo Alt+S y áreas táctiles de 44 px)
- [x] Etapa 12 · Archivos y copias de seguridad (aprobada: formato .nota autónomo con imágenes en Base64, compresión Gzip transparente, exportación en biblioteca y en los 3 editores con navigator.share/descarga, importación por botón y arrastre con resolución de duplicados y transacción atómica por archivo (corregido en la auditoría: antes era solo por documento), impresión de pizarrón encuadrado en A4, recordatorios periódicos configurables, medidor de espacio y File System Access API)
- [x] Etapa 13 · Modo instalable y uso sin conexión (aprobada: PWA con precarga en Service Worker, fuentes autoalojadas y actualización con guardado previo)
- [x] Etapa 14 · Pulido, accesibilidad, rendimiento y materias/etiquetas (implementada y verificada: 194 pruebas)
- [~] Etapa 15 · Publicación en la web (en curso: la app está integrada en la web en `/notas/app/index.html`; falta probar la instalación en PC, Android e iPad por HTTPS y habilitar el botón en `/notas`)
- [ ] Etapa 16 (opcional)

## Decisiones tomadas
- Nombre de la app: **Anotomía** (anotar + anatomía). Pendiente: comprobar que no choque con otra marca o app.
- La base de datos interna sigue llamándose `notas-app` a propósito, para no perder datos ya guardados.
- Vite + React 19 + JavaScript. Almacenamiento en IndexedDB, sin servidor ni cuenta.
- Clases CSS con prefijo `nt-` y variables con prefijo `--nt-` (para copiar a la web sin conflictos).
- Los identificadores no usan `crypto.randomUUID()` porque no existe por http en red local (la tablet en desarrollo).
- Los elementos (texto, trazo, imagen, símbolo) se guardan en un almacén aparte, indexados por documento.
- Las tipografías (Figtree, Newsreader, Caveat) son provisorias; se reemplazan por las de la web.

- La papelera es temporal: lo que lleva más de 30 días se elimina solo al abrir la app.
- Duplicar copia el documento y todos sus elementos en una sola operación.
- Orden y vista (cuadrícula/lista) de la biblioteca se recuerdan entre sesiones.
- Carpetas y etiquetas: implementadas en la Etapa 14 bajo el modelo de materias de un solo nivel con color + etiquetas libres.

## Motor de lienzo (Etapa 4)
- `src/lienzo/`: camara.js, geometria.js, historial.js, escena.js, dibujo.js, motor.js (clase `Lienzo`, sin React).
- Editor en `src/app/EditorLienzo.jsx`; lo usan pizarrón y tarjetas (las tarjetas se separan en la Etapa 9). Páginas A4 sigue con marcador de posición hasta la Etapa 10.
- Gestos: rueda = zoom en el cursor; pellizco de 2 dedos = zoom y mover; herramienta Mano, barra espaciadora o botón central = mover; marco de selección; Shift suma a la selección.
- Atajos de herramienta: Alt+V, Alt+H, Alt+P, Alt+M, Alt+B, Alt+T, Alt+R, Alt+E, Alt+L, Alt+A; Alt+G (renglones). En documentos con teclado, las letras sin modificador escriben; en modo solo a mano se conservan los atajos sin Alt. Ctrl+Z / Ctrl+Y (deshacer, rehacer); Supr; Ctrl+A; Esc.
- Deshacer y rehacer sin límite: cada acción guarda los elementos antes y después (`{id, antes, despues}`).
- Solo se dibujan los elementos visibles. Pendiente para la Etapa 7 si hace falta: índice espacial para decenas de miles de elementos.
- La cámara se guarda en el documento (`config.camara`) sin cambiar su fecha de modificación.
- Trazos y símbolos se mueven pero aún no se redimensionan (se decide en las etapas 5 y 6).

## Escritura a mano (Etapa 5)
- Herramientas: lápiz (P), resaltador (M), borrador (B). Colores, grosor y opacidad; los ajustes se recuerdan entre sesiones (almacén `ajustes`, clave `lienzo.ajustes`).
- Entrada única por eventos de puntero (mouse, dedo, lápiz). Presión solo con lápiz y solo en el lápiz opaco: grosor = elegido × (0,35 + 1,3 × presión).
- El grosor elegido es el que se ve en pantalla al escribir; en el mundo se guarda dividido por el zoom.
- Trazo suavizado con curvas por puntos medios y simplificado al soltar (Douglas-Peucker).
- Borrador: «trazo completo» o «por zona» (corta el trazo en tramos). Solo borra trazos, no figuras.
- Rechazo de palma: al detectar un lápiz (incluso flotando cerca), el dedo pasa a mover el lienzo; los toques durante el trazo se descartan; si la palma llega antes que el lápiz, gana el lápiz. Se puede activar «Dibujar con el dedo».
- Baja latencia: al empezar a escribir se guarda la escena ya dibujada en un lienzo auxiliar y solo se redibuja el trazo en curso; `desynchronized: true` donde el navegador lo permite.
- Bloqueo de gestos del navegador: `touch-action: none`, `preventDefault` en toques y eventos de gestos de Safari, `overscroll-behavior: none`.
- Por afinar según la prueba en tablet: umbral de palma (`e.width > 40`), suavizado, rango de presión, tamaño de las manijas.

## Texto con teclado (Etapa 6)
- Código en `src/herramientas/texto/`: estilo.js (medidas comunes), modelo.js (datos), html.js (HTML ↔ modelo), maquetar.js (cortes de línea, listas, tablas), pintar.js (dibujo en canvas + caché), editor.js (campo editable), tabla.js (operaciones de tabla). Interfaz: `src/app/BarraTexto.jsx`.
- Datos de un texto: `{ bloques, tamano, color }`. Bloque: párrafo, título 1-3, viñeta o número (con nivel 0-2), o tabla. Fragmentos con negrita, cursiva, subrayado, tachado, color y resaltado. Los textos antiguos `{ contenido }` se siguen leyendo.
- Dos vistas con las mismas medidas: al escribir, un campo editable (`contenteditable`) con teclado, corrector y selección nativos; al terminar, el texto se dibuja en el lienzo con su orden de capas (puede quedar entre trazos y figuras). El CSS del editor sale de `estilo.js`, así ambas vistas no se desalinean.
- Texto por cuadro: clic o toque crea un texto; arrastrar define el ancho; clic sobre un texto lo edita. Con Seleccionar: doble clic/doble toque o Enter edita el seleccionado. Esc o «Listo» termina (queda seleccionado); tocar el lienzo también termina.
- Escritura directa: en documentos que permiten teclado, las letras abren una sesión en el cursor visible, que inicia en el centro y se mueve al tocar/clicar; se conserva el punto de inserción al alternar con trazos a mano. Las teclas de herramienta usan Alt para no interceptar letras escritas.
- Composición guiada: el texto directo queda vinculado al paso de la guía activa; líneas, títulos, filas de tablas y sus alturas se calculan en múltiplos del interlineado. El texto por cuadro conserva composición libre y ambos pueden convivir.
- Se puede ensanchar con las asas laterales; el alto lo calcula el contenido. El tamaño de letra es del bloque completo (los títulos dan la jerarquía); no hay tamaños distintos dentro de un mismo texto.
- Atajos: Ctrl+B/I/U (nativos), Ctrl+Mayús+X tachado, +7 numerada, +8 viñetas, +L/E/R alineación, +0/1/2/3 normal y títulos, Tab/Mayús+Tab sangría en listas y celdas en tablas, Esc terminar. Ctrl+Z/Y dentro del texto son los del navegador.
- Pegado: desde Word, Google Docs o la web se convierte a lo que el modelo conoce (nada del HTML original se copia). Pegar fuera de un texto crea uno nuevo; Ctrl+C con textos seleccionados copia HTML y texto plano.
- Tablas simples: insertar 3×3, fila/columna ± , fila de encabezado y quitar tabla; columnas de igual ancho; el contenido de la celda es solo texto en línea.
- Seguridad de datos: mientras se escribe, cada ~0,5 s se pasa lo escrito a la escena (sin tocar el historial) y el autoguardado también lo recoge al ocultar la pestaña o salir. Al terminar queda una sola acción en el historial.
- Modo de escritura del documento: «Solo a mano» oculta Texto; «Solo con teclado» oculta lápiz, resaltador y borrador (antes el modo se guardaba pero no tenía efecto).
- Por afinar según la prueba en tablet: que el teclado en pantalla se abra al tocar (se enfoca en el mismo toque), el desplazamiento de la vista cuando el teclado tapa el texto, y el tamaño de los botones de la barra.
- Limitaciones conocidas: deshacer dentro del texto (Ctrl+Z) no revierte las operaciones de tabla hechas con la barra (usar «Deshacer» de la app tras terminar); sin justificado; sin enlaces ni imágenes (Etapa 11); tablas pegadas se limitan a 200 filas × 12 columnas; los símbolos científicos llegan en la Etapa 11.

## Pizarrón infinito completo (Etapa 7)
- Formas básicas: rectángulo, elipse, triángulo, rombo, línea y flecha, desde el botón «Formas» del riel (atajos R, E, L, A). Mayús al arrastrar: cuadrado/círculo exactos, o línea en múltiplos de 45°. Las líneas y flechas se editan con dos asas, una por extremo (`datos.volteoX/volteoY` guardan la dirección).
- Estilo de figuras (`PanelFigura.jsx`, `motor.estiloFiguras`): borde, relleno (o sin relleno) y grosor; cambia las figuras seleccionadas (queda en el historial) y las que se creen después. Las figuras nuevas ya no salen con colores rotativos: usan el último estilo elegido (borde azul, sin relleno, grosor 3 al empezar). El grosor se guarda en unidades del mundo, como el lápiz.
- Minimapa (`lienzo/minimapa.js`, `app/Minimapa.jsx`): aparece cuando hay contenido, muestra todo el pizarrón y el recuadro de la vista; tocar o arrastrar mueve la vista sin cambiar el zoom. Se oculta con el botón de mapa de la barra de zoom (se recuerda en los ajustes). Los trazos se dibujan todos juntos en un solo recorrido, así no pesa con miles de elementos.
- «Volver al contenido»: aparece cuando no queda nada del contenido a la vista y lleva a «Ver todo».
- Cambio posterior (a pedido): el grosor del lápiz y del resaltador, el borde de las figuras y el tamaño del texto nuevo son del mundo, no de la pantalla: se crean igual con cualquier zoom (al acercar se ven más grandes). Antes se dividían por el zoom para verse iguales en pantalla.
- Rendimiento: con la vista alejada (menos de 50 %) los trazos se dibujan simplificados y los menores a medio píxel se omiten; `escena.limites()` queda en caché hasta que cambia la escena. Con el criterio de uso real (nunca habrá miles de figuras a la vez en pantalla) se dio por bueno: con 2120 trazos en pantalla cada cuadro tardó entre 5 y 26 ms en el navegador de prueba (sin aceleración gráfica), y unos 4 ms a tamaño real. No hizo falta índice espacial.
- Prueba de «clase completa» (navegador real): texto, 2 figuras, 120 trazos a mano y 2000 generados; se guardó, se recargó la página y se reabrió con 2123 elementos idénticos (misma huella de todos los datos). El panel de pruebas ahora tiene «+ 1000 trazos», «+ 5000 trazos» y muestra el tiempo del cuadro.
- Ojo al probar: el minimapa y el panel de pruebas están por encima del lienzo; un trazo que empieza debajo de ellos no se dibuja (es lo esperado; se ocultan con sus botones).
- Fuera de esta etapa (anotado para después): copiar, pegar y duplicar elementos del pizarrón; estirar trazos y símbolos; las «Pruebas» se quitan al final.

## Renglones (Etapa 8)
- Capa de fondo independiente (`lienzo/renglones.js`): se dibuja debajo de todo, en el espacio del mundo (se mueve y escala con la vista) y no toca ningún elemento. Es el módulo que reutilizarán tarjetas y páginas A4.
- Estilos: rayado, cuadriculado, puntos y liso. Se configuran: separación (16 a 96), color (6), intensidad (5 a 100 %), interruptor general y modo de visibilidad. Se guardan en el documento (`documento.renglones`), no en los ajustes globales; los documentos anteriores se completan solos con los valores por defecto.
- Visibilidad: «Siempre visibles», «Aparecen un momento» (1 o 2 s, con fundido de entrada y de salida, al activarlos) u «Ocultos». En los dos últimos, «Mostrar ahora» y cualquier cambio de estilo hacen aparecer la guía un instante para ver el efecto. Atajo: Alt+G cuando se permite teclado; G en modo solo a mano.
- Con la vista muy alejada la guía se desvanece sola (menos de 5 px entre renglones, 9 en puntos) para no formar una mancha.
- Alinear al renglón (apagado por defecto): acomoda a la guía las figuras nuevas, el texto nuevo (su primer renglón se apoya en el renglón) y lo que se mueva o se estire con las asas. En el rayado solo cuenta la altura; en cuadriculado y puntos, ambos ejes. Los trazos a mano nunca se acomodan, pero viajan con la selección. Mayús desactiva el alineado al estirar.
- Los puntos de orientación fijos de las etapas anteriores se reemplazaron por esta capa: con «Liso» el fondo queda en blanco.
- Verificado en navegador real con un pizarrón de 1004 elementos: encender, apagar, cambiar de estilo, de visibilidad y de alineado no altera ningún dato (misma huella antes y después), y la configuración se conserva al cerrar y reabrir.
- El texto guiado se vuelve a maquetar y alinear cuando cambia la separación de la guía. Incluir o no los renglones al imprimir sigue siendo independiente de esa métrica.

## Tarjetas (Etapa 9)
- Formato propio de fichas de estudio (`src/formatos/tarjetas.js`, `src/formatos/EditorTarjetas.jsx`).
- Medidas de tarjeta configurables: 16:9 (1120×630), 4:3 (960×720), A6 (740×520), A5 (1040×740).
- Cada tarjeta es una ficha enmarcada en el lienzo con su fondo, sombra y renglones delimitados a la tarjeta física.
- Navegación ágil: botones anterior/siguiente, chips de acceso directo numerados, renombrado directo, agregar nueva tarjeta, duplicar con elementos y confirmación al eliminar.
- Los elementos pertenecen a cada tarjeta a través de `el.contenedor = tarjetaId`.
- Impresión y exportación (`src/estilos/impresion.css`): modal de impresión que permite elegir alcance (todas las fichas o ficha actual) y si incluir o no los renglones/cuadrícula al imprimir o exportar a PDF.
- Grosor del trazo: se guarda en unidades del lienzo (no se divide por el zoom), igual que en el pizarrón: al acercar la vista el trazo se ve más grande y al alejarla, más fino.

## Páginas A4 (Etapa 10)
- Formato propio de hojas verticales continuas (`src/formatos/paginas.js`, `src/formatos/EditorPaginas.jsx`).
- Medidas estándar internacionales A4 a 96 DPI: 794 × 1123 px (210 × 297 mm), con separación visual entre páginas consecutivas (50 px).
- Cada página cuenta con marco visual, sombra proyectada suave, delimitación de renglones independiente por hoja e indicador del número de página.
- El motor de lienzo asigna dinámicamente el contenedor de página (`el.contenedor`) según la coordenada vertical en el mundo de cada trazo, figura o bloque de texto.
- Navegación ágil entre páginas:
  - Botones anterior/siguiente (↑ / ↓) y selector numérico de chips directos para saltar a cualquier hoja.
  - Botón «Ajustar ancho» y «Encuadrar pág.» para visualizar la hoja A4 con zoom ideal en cualquier pantalla o tablet.
  - Indicador dinámico de página activa que se actualiza automáticamente al desplazarse verticalmente.
  - Agregar nueva hoja (+ Página) al final del documento.
  - Duplicar página actual con clonación íntegra de sus elementos desplazados a la nueva hoja.
  - Eliminar página con reubicación/desplazamiento vertical de las páginas y elementos subsiguientes.
- Impresión y exportación (`src/estilos/impresion.css`): modal de impresión que permite elegir el alcance (todo el documento o solo la página actual) y la opción de incluir o no los renglones/cuadrícula al imprimir o guardar en PDF.
- Prototipo de paginación: la fragmentación nativa en columnas mantuvo el caret en la página 9 mientras una inserción anterior repaginó el flujo de 9 a 10 páginas, pero solo produjo páginas horizontales. Integrarla con las hojas verticales, la cámara y la tinta por página requeriría cambiar la geometría compartida, así que se eligió la alternativa de páginas fijas.
- Desborde manual: al seleccionar un bloque de texto que rebasa el margen inferior aparece una acción para mover el bloque completo a la página siguiente; no lo divide ni lo mueve automáticamente. Si supera el área útil de una hoja, se indica que hay que dividirlo en varios cuadros. El movimiento y la creación de página se deshacen/rehacen juntos.

## Estructura
- `src/almacen/`: modelo.js (datos), db.js (IndexedDB), documentos.js, elementos.js, ajustes.js, persistencia.js, autoguardado.js, pendientes.js
- `src/app/`: App.jsx (navegación), EditorLienzo.jsx, EditorPaginas.jsx, EditorComun.jsx, BarraTexto.jsx, MenuFormas.jsx, MenuRenglones.jsx, PanelFigura.jsx, Minimapa.jsx, Biblioteca.jsx, SelectorFormato.jsx, Papelera.jsx, Modal.jsx, utiles.js
- `src/formatos/`: tarjetas.js, EditorTarjetas.jsx, TiraTarjetas.jsx, historialTarjetas.js, estudio.js, EstudioTarjetas.jsx, impresion.js (Etapa 9 y bloque A); paginas.js, EditorPaginas.jsx (Etapa 10)
- `src/estilos/`: variables.css, tema.css, biblioteca.css, editor.css, impresion.css
- `src/herramientas/texto/`: texto con teclado (Etapa 6).
- `tests/`: pruebas automáticas (`npm test`): almacenamiento, lienzo, escritura, texto, pizarrón, renglones, tarjetas y páginas A4

## Ideas para después
- Búsqueda de texto dentro de todos los documentos
- Sincronización opcional entre dispositivos
- Plantillas de documentos
- Exportación a imagen
- Audio asociado a las notas
- Reconocimiento de escritura a mano
- Copiar, pegar y duplicar elementos del pizarrón (Ctrl+C, Ctrl+V, Ctrl+D)
- Estirar trazos y símbolos (hoy solo se mueven)

## Bloque A (parcial, hecho con Claude)
- Hecho: grosor del lápiz/resaltador en unidades del lienzo (igual con cualquier zoom); agregar, duplicar y eliminar páginas ahora se deshacen y rehacen; la página de un elemento se decide por su posición; tarjetas con medidas físicas reales (5 unidades = 1 mm, A6 148×105, A5 210×148), tamaño personalizado en mm (solo lógica), reordenar tarjetas y distribución 1/2/4/6 por hoja (solo lógica, con pruebas); utilidades de impresión nuevas en `src/formatos/impresion.js` (aún sin conectar a la pantalla).
- Tarea A4 (completada y comprobada):
  - Extracción y pureza: función `construirHojasPaginas` en `src/formatos/impresion.js` que arma las hojas A4, escala el tamaño del canvas con `factor = factorResolucion(cantidadDePaginas)` (ANCHO_A4 × factor por ALTO_A4 × factor) y asigna el título del documento y de la hoja usando `textContent` (seguridad contra inyección HTML).
  - Conexión en `EditorPaginas.jsx`: llamada a `construirHojasPaginas`, paso de `dpr: factor` a `dibujar` manteniendo ancho/alto en unidades de lienzo, lectura de renglones actualizados desde `docRef.current.renglones`, y disparo de impresión mediante `imprimirContenedor` para liberar memoria tras imprimir.
  - Estilos de impresión en `src/estilos/impresion.css`: directiva `@page { size: A4 portrait; margin: 0; }` dentro de `@media print`, cada hoja `.nt-pagina-impresa` a 210mm × 297mm con `break-after: page`, `position: relative`, `overflow: hidden`, y `:last-child` con `break-after: auto` para prevenir páginas en blanco. Rótulo de página en posición absoluta sobre el margen.
  - Pruebas: prueba con JSDOM agregada a `tests/paginas.test.mjs` que valida cantidad de hojas, dimensiones de canvas escaladas por factor y escape de HTML en títulos (113 pruebas pasando).
- Tarea A5 (completada y comprobada):
  - Conexión de `construirHojasTarjetas` en `src/formatos/EditorTarjetas.jsx` para la impresión de tarjetas de estudio, usando `factorResolucion(tarjetasAImprimir.length, { alto: 2, medio: 2, bajo: 1.5 })` y `dpr = factor`.
  - `dibujarEn` dibuja cada tarjeta con su marco `(0, 0, med.ancho, med.alto)`, tomando los elementos de la escena activa si corresponde o de `todosElementosRef.current`, y leyendo los renglones desde `docRef.current.renglones`.
  - Modal de impresión actualizado en `EditorTarjetas.jsx`: añadidos el selector «Tarjetas por hoja» (1, 2, 4, 6) y la casilla de verificación «Marcas de corte», ambos persistidos en `doc.config` mediante `guardarCambioConfig`.
  - Eliminados estilos y código obsoletos (`nt-ficha-impresa`, `nt-impresion-tarjetas`) y eliminado el uso de `innerHTML` con títulos (los títulos se insertan con `textContent` en `construirHojasTarjetas`).
  - Estilos en `src/estilos/impresion.css`: `.nt-hoja-tarjetas` a 210 mm × 297 mm en `display: grid` con `break-after: page` (y `break-after: auto` en `:last-child`); `.nt-celda-tarjeta` centrada en ambos ejes; `.nt-tarjeta-impresa` con `position: relative` y canvas al 100%; borde fino gris únicamente cuando no hay marcas (`:not(.nt-tarjeta-impresa--marcas)`); `.nt-tarjeta-impresa__rotulo` en 7 pt gris centrado; marcas de corte en L `.nt-marca` de 4 mm en las cuatro esquinas con `print-color-adjust: exact`.
  - Pruebas en `tests/tarjetas.test.mjs`: verificación de normalización y persistencia de `porHoja` y `marcasDeCorte`, y comprobación de que 12 tarjetas A6 generen exactamente 12, 6, 3 y 2 hojas según la distribución seleccionada (115 pruebas pasando).
- Tarea A6 (completada y comprobada):
  - Búsqueda y revisión de todas las llamadas a `medidasTarjeta` en el proyecto (`src/formatos/EditorTarjetas.jsx`, `src/formatos/tarjetas.js`, etc.) pasando consistentemente el segundo argumento (`cfg.personalizado` o `cfgRef.current.personalizado`).
  - `SelectorFormato.jsx`: opción «Personalizado» en el selector de formato de tarjeta con campos numéricos para ancho y alto en mm (rango 40 a 400 mm, valores iniciales 150 y 100 mm). Persistencia de `tamano: 'personalizado'` y `personalizado: { anchoMm, altoMm }` en `doc.config`. Normalización y acotado inmediato con `normalizarPersonalizado` (onBlur y submit).
  - Editor de tarjetas (`EditorTarjetas.jsx`): menú desplegable «Tamaño» en la barra superior que permite alternar entre 16:9, 4:3, A6, A5 y personalizado (con sus dos campos numéricos en mm). Al cambiar: se actualiza `cfg` mediante `guardarCambioConfig`, se aplica el nuevo marco al motor (`motor.setMarco`) y se re-encuadra (`encuadrar`) para visualización íntegra sin mover ni alterar ningún elemento.
  - Validación exhaustiva con `normalizarPersonalizado`: descarta vacíos, caracteres no numéricos y acota valores al rango válido [40, 400] mm.
  - Pruebas en `tests/tarjetas.test.mjs`: verificación de la normalización del tamaño personalizado, conservación de la configuración al normalizarla, y preservación íntegra de elementos y dimensiones al alternar entre personalizado y estándar (118 pruebas pasando).
- Tarea A7 (completada y comprobada):
  - Componente `Miniatura` (`src/formatos/TiraTarjetas.jsx`): dibuja tarjetas pequeñas en canvas mediante `dibujar` (`zoom = anchoMiniatura / med.ancho`, fondo blanco automático con `marcoDocumento: null` y renglones actuales de `docRef.current.renglones`). Acepta `obtenerLista(id)` y número de revisión `rev`.
  - Función `obtenerLista(id)` en `EditorTarjetas.jsx`: devuelve la escena en vivo `motorRef.current.escena.lista()` para la tarjeta activa y los elementos en `todosElementosRef.current` para las demás tarjetas. `rev` se incrementa automáticamente al cambiar de tarjeta, al pasar el estado a `'guardado'` (para actualizar las miniaturas tras editar), al duplicar, agregar, eliminar y reordenar fichas.
  - Tira lateral (`TiraTarjetas`): columna vertical a la izquierda del lienzo con una miniatura por tarjeta, número y título debajo, tarjeta activa resaltada con borde azul, y botones «+ Agregar» y «Duplicar» que reutilizan los métodos existentes del editor.
  - Visibilidad de la tira: visible por defecto en pantallas de 900 px o más; conmutador en la cabecera mediante el botón «Tira». Al alternar la tira, el `ResizeObserver` sobre el contenedor del lienzo ajusta el canvas de inmediato.
  - Vista cuadrícula (`CuadriculaTarjetas`): botón «Cuadrícula» en la cabecera que abre un panel modal a pantalla completa con todas las tarjetas en rejilla adaptable. Al tocar una tarjeta o presionar Enter se selecciona y se cierra el panel.
  - Reordenamiento por arrastre: implementado en tira y cuadrícula mediante eventos de puntero (`pointerdown`, `pointermove`, `pointerup`, `pointercancel` con `setPointerCapture`), prescindiendo de la API HTML Drag and Drop incompatible con iPad. Asa con icono de agarre y `touch-action: none`. Muestra indicador visual de destino durante el arrastre (`.nt-linea-caida` y contorno de destino). Al soltar, se reordena con `moverTarjeta` y `guardarCambioConfig`, manteniendo invariable el `id` de la tarjeta activa.
  - Accesibilidad: cada tarjeta es un elemento interactivo enfocable (`role="button"`, `tabIndex={0}`, etiquetas aria descriptivas en español). `Enter` selecciona; `Alt + flechas` desplaza la tarjeta una posición en la lista.
  - Limitación conocida: por diseño y especificación, no se conserva el historial de deshacer/rehacer al cambiar de tarjeta (cada tarjeta mantiene su escena activa independiente).
  - Pruebas automáticas: función pura `calcularDestinoArrastre` en 1D (tira) y 2D (cuadrícula), y preservación de orden y tarjeta activa con `moverTarjeta` en `tests/tarjetas.test.mjs` (121 pruebas pasando).

## Bloque A: cierre (17 de octubre de 2026)
- **Error corregido (pérdida de datos):** el autoguardado de las tarjetas seguía guardando la escena de la tarjeta con la que se abrió el documento; lo escrito en las demás tarjetas no llegaba a IndexedDB. Ahora el guardado consulta siempre la escena vigente del motor (`src/almacen/pendientes.js`, función `guardarPendientesDeEscena(obtenerEscena, almacen, trasGuardar)`). Lo usan las tarjetas, las páginas A4 y el pizarrón. Si algo falla, los pendientes vuelven a la escena de la que salieron.
- Al cambiar de tarjeta ya no queda ninguna suscripción de la escena anterior; antes de cambiar se vacía el autoguardado.
- **Documentos antiguos de tarjetas:** al cargar, lo que no pertenece a ninguna tarjeta pasa, una sola vez, a la primera (`asignarHuerfanos`). Desapareció el tratamiento especial de «primera tarjeta».
- **Deshacer y rehacer en tarjetas:** agregar, duplicar y eliminar tarjetas se deshacen y rehacen (`src/formatos/historialTarjetas.js`). Funciona cuando la tarjeta activa no tiene nada propio que deshacer (el motor consulta `historialExtra`). El contenido de una tarjeta eliminada se conserva en la operación y vuelve al deshacer. Una acción nueva sobre cualquier tarjeta descarta lo que había por rehacer. Limitación: el historial de cada tarjeta se sigue perdiendo al cambiar de tarjeta.
- **Miniaturas:** se redibuja solo la miniatura de la tarjeta que cambió (revisión por tarjeta); cambiar de tarjeta, renombrar y reordenar ya no redibujan todas.
- **Modo estudio** (`EstudioTarjetas.jsx`, lógica en `estudio.js`): botón «Estudiar». Pantalla completa (si el navegador la permite), una tarjeta por pantalla, solo lectura. Flechas, Re Pág/Av Pág, Inicio/Fin, toque o clic en los tercios laterales, deslizamiento y botones. «n de total» y botón Salir; Esc sale (si hay pantalla completa, Esc la cierra y con ella el modo).
- **Impresión:** en `impresion.css` se oculta explícitamente el lienzo del editor (y minimapa, tira, paneles y modo estudio) al imprimir.
- **Limpieza:** se quitaron los paneles de prueba de `EditorLienzo.jsx` y `Biblioteca.jsx` y sus estilos, y `metadata.json`. Los generadores de datos de prueba del motor (`generarFiguras`, `generarTrazos`, `borrarTodo`) se conservan porque los usan las pruebas automáticas.
- Pruebas: 135 (antes 121). Sin comprobar en navegador real: modo estudio (pantalla completa y deslizamiento en tablet), deshacer de tarjetas, miniaturas e impresión.

## Imágenes y símbolos (Etapa 11 · 18 de octubre de 2026)
- **Imágenes de punta a punta (pizarrón, tarjetas y páginas A4):**
  - Inserción por archivo, pegado del portapapeles y arrastre directo (`motor.insertarImagen`, `_arrastrarArchivo`, `_soltarArchivo`, `_pegar`).
  - Reducción y compresión automática (`procesar.js`): límite de 2400 px y 4 MB mediante `dimensionesReducidas`, generando WebP/JPEG optimizados.
  - Almacenamiento en almacén `blobs` de IndexedDB con `guardarBlob` y recuento de referencias en memoria con `prepararImagenes` en `recursos.js` para visualización sincrónica sin parpadeos.
  - Deshacer y rehacer completamente funcionales para inserción, desplazamiento, redimensionado (8 manijas) y recorte (`recortarImagen`, `iniciarRecorteImagen`, `terminarRecorteImagen`).
  - Control de recorte en `PanelImagen.jsx` con deslizadores táctiles y botón «Restablecer» asegurados a un área mínima de 44 px para tablets.
  - Impresión de tarjetas y páginas A4 probada y asegurada con `prepararImagenes` antes de armar los canvas de impresión (`impresion.js`).
  - Duplicación de documentos, páginas y tarjetas comprobada: preservan la referencia al `blobId` sin duplicar peso innecesario. Al eliminar una copia, la otra conserva su imagen intacta.
  - Papelera y eliminación sin huérfanos: `borrarDocumentoDefinitivo` y `vaciarPapelera` verifican los elementos restantes en IndexedDB antes de eliminar blobs, asegurando que no queden datos huérfanos ni se borren blobs en uso por otros documentos.
  - Control de errores robusto con mensajes claros en español ante archivos dañados o tipos no admitidos (`Use una imagen PNG, JPEG o WebP.` / `El archivo de imagen está dañado o no se puede leer.`).
- **Símbolos científicos (catálogo, panel y teclado):**
  - Catálogo estándar ampliado a más de 250 símbolos científicos útiles (`src/herramientas/simbolos/catalogo.js`), estructurado en 5 categorías (`griego`, `matematicas`, `flechas`, `ciencias`, `subsuper`) y sin ningún carácter duplicado (comprobado con `Set`).
  - Cada símbolo incluye nombre en español y términos sinónimos sin acentos para coincidencia instantánea en la búsqueda.
  - Panel flotante `SelectorSimbolos.jsx` con pestañas de categoría, buscador insensible a tildes y mayúsculas, y sección «Más usados» recordada entre sesiones en el almacén `ajustes` (clave `simbolos.frecuencia`).
  - Botones del panel de símbolos dimensionados a 44 × 44 px (mínimo táctil ergonómico para tablets).
  - Inserción de símbolos preserva el cursor activo del editor de texto y admite escritura directa si no había texto abierto.
  - Atajo de teclado `Alt+S` para abrir/cerrar el selector de símbolos, reflejado en el botón de la barra de texto (`Símbolos científicos (Alt+S)`).
- **Pruebas automáticas:** 156 pruebas pasando (21 pruebas nuevas para reducción de imágenes, duplicado sin huérfanos, eliminación en papelera, integridad del catálogo de 250+ símbolos, búsqueda insensible a tildes y registro de frecuencia).
- **Sin comprobar:** prueba física en iPad/tablet real (se verificó con emulación táctil en JSDOM/Vite).

## Archivos y copias de seguridad (Etapa 12 · 18 de octubre de 2026)
- **Capa modular de archivos (`src/archivos/`):**
  - Desacople estricto entre almacenamiento interno (`src/almacen/`, centrado en IndexedDB) y operaciones con archivos externos (`src/archivos/`: `formato.js`, `exportar.js`, `importar.js`, `copias.js`).
- **Formato propio «.nota»:**
  - Contenedor autónomo, robusto e interoperable en JSON UTF-8 con recursos binarios (imágenes) codificados en Base64.
  - Compresión y descompresión transparente con streams nativos (`CompressionStream('gzip')` y `DecompressionStream('gzip')`), con fallback a texto plano si el entorno no los soporta.
  - Encabezado con identificador de aplicación (`anotomia`), versión del formato (`versionArchivo: 1`), marca temporal de exportación y tipo de paquete (`documento` o `coleccion`).
  - Función de migración entre versiones (`migrarArchivo`), preparada con tabla extensible `MIGRACIONES`.
- **Exportación flexible:**
  - Exportación individual desde la biblioteca (menú `⋯`) y desde los tres editores (Pizarrón, Tarjetas y Páginas A4) con botón dedicado en la cabecera superior.
  - Soporte de hoja nativa de compartir del sistema (`navigator.share` con archivos) para iPads y móviles, con fallback automático a descarga clásica por enlace Blob temporal.
  - Exportación completa de la biblioteca consolidada en un único archivo `.anotomia-respaldo`.
- **Importación segura y atómica:**
  - Importación accesible mediante botón «Importar» en la cabecera y mediante arrastre directo (Drag & Drop) sobre la biblioteca con indicación visual de área de caída.
  - Validación de seguridad exhaustiva: todo archivo externo se trata como no confiable. Saneamiento de títulos (eliminación de scripts y tags HTML), validación de rangos numéricos finitos, saneamiento de bloques de texto enriquecido, figuras, trazos e imágenes.
  - Transacción atómica en IndexedDB (`documentos`, `elementos`, `blobs`): si cualquier elemento o recurso falla, la operación se revierte por completo sin dejar datos huérfanos ni registros parciales.
  - Detección y resolución de colisiones por ID: modal interactivo que permite elegir «Reemplazar», «Conservar ambos» (asignando nuevo ID con sufijo `(copia)` y remapeando identificadores de elementos) u «Omitir», con opción de aplicar la decisión a todos los archivos siguientes.
- **Exportación a PDF e impresión de pizarrón:**
  - Incorporada la función `construirHojasPizarron` en `src/formatos/impresion.js` y estilos en `src/estilos/impresion.css`.
  - Encuadre automático del contenido en hoja A4 estándar (794 × 1123 px), con opción de incluir o no renglones/cuadrícula.
- **Copias de seguridad y almacenamiento local:**
  - Recordatorio periódico de respaldo configurable (0: Nunca, 7, 14 o 30 días, por defecto 14 días). Solo avisa en la biblioteca cuando han transcurrido los días configurados y existen documentos con modificaciones posteriores a la última copia, sin interrumpir la escritura en los editores.
  - Medidor visual de almacenamiento (`navigator.storage.estimate`): barra de porcentaje usada/disponible en el modal de copias, con alerta destacada cuando el uso supera el 80 %.
  - Integración con File System Access API (`showDirectoryPicker`) en navegadores compatibles (Chrome, Edge), permitiendo al usuario seleccionar una carpeta local para guardar copias de respaldo directas. En navegadores sin soporte, se oculta el botón y se explica que la copia es por descarga manual.
  - Mensaje claro sobre privacidad y soberanía de datos: las notas viven en el dispositivo local y no se suben a ningún servidor.
- **Pruebas automáticas:** 167 pruebas pasando (11 pruebas nuevas en `tests/archivos.test.mjs` que validan ida y vuelta con texto, trazos, figuras e imágenes, archivos corruptos, versiones desconocidas, resolución de duplicados en las tres variantes, importación atómica, respaldos y recordatorios).
- **Sin comprobar:** prueba física en iPad/tablet real (se verificó con emulación en navegadores y suite completa de tests automatizados).

## Auditoría posterior a la Etapa 12 (18 de octubre de 2026)
- **Corregido:** cancelar la hoja de «Compartir» se tomaba como copia exitosa y apagaba el recordatorio. Ahora `intentarCompartirArchivo` devuelve `'cancelado'`, no se registra copia y se avisa que no se guardó nada (copias, exportación desde la biblioteca).
- **Corregido:** la importación de un respaldo ahora es atómica por archivo (una sola transacción): si un documento falla, no se guarda ninguno. (`persistirLoteImportado` en `src/archivos/importar.js`.)
- **Corregido:** omitir un duplicado se contaba como importado (se comparaba con `'omitir'` en vez de `'omitido'`).
- **Corregido:** la configuración del documento importado (`config`) no se saneaba. Ahora `sanearConfigImportada` valida cámara, cantidad de páginas (máx. 500), tarjetas (máx. 500) y tamaño personalizado, descarta claves peligrosas y números no finitos; los elementos tienen límites de coordenadas y tamaños.
- **Corregido:** las imágenes cuyo recurso no viene en el archivo se omiten y se informa cuántas.
- **Corregido:** el recordatorio de copia ya no aparece el primer día de uso (si nunca hubo copia, cuenta desde la nota más antigua).
- **Limpieza:** se eliminaron `metadata.json` (declaraba una capacidad de Gemini) y `.env.example`; el `README.md` era la plantilla de Google AI Studio. Se quitó código duplicado en `copias.js` (reutiliza `prepararRecursosDeElementos`). Pruebas: 173.
- **Pendiente (decidir o probar):** (1) ~~Tipografías desde Google Fonts~~: resuelto en la Etapa 13 (autoalojadas). (2) Probar en iPad real: compartir/descargar en Safari (puede perderse el gesto del usuario tras procesar el archivo), selector de archivos con extensión `.nota`, impresión y modo estudio. (3) La paginación de la Etapa 10 (páginas fijas con desborde manual) la eligió una IA por el resultado de un prototipo: confirmar que es la decisión deseada. (4) Advertencias de lint restantes (6): exportación de constantes en `EditorComun.jsx`, `setState` en un efecto de `Papelera.jsx` y dependencias de dos `useEffect` de los editores (no se tocaron para no reiniciar los motores). (5) El servidor de desarrollo escucha en toda la red (`host 0.0.0.0`, `allowedHosts: true`): solo para uso en casa.

## Etapa 13 · Modo instalable y uso sin conexión (implementada el 19 de octubre de 2026)
**Qué se hizo**
- `public/manifest.webmanifest` (nombre, colores azules, `display: standalone`, rutas relativas) e íconos propios en `public/iconos/` (192, 512, «maskable» 512 y `apple-touch-icon` 180). El `favicon.svg` era el logo de Vite: se reemplazó por el de Anotomía y se eliminó `icons.svg` (sobrante).
- `index.html`: enlaces al manifiesto y al ícono de iPad, metaetiquetas de app instalable y **sin Google Fonts**.
- **Tipografías autoalojadas** con Fontsource (Figtree 400/500/600/700 e itálicas 400/700; Newsreader 500/600, solo subconjunto latino), importadas en `src/main.jsx`. `Caveat` (`--nt-fuente-mano`) no se usa en el código, así que no se incluyó.
- **Service worker** (`sw/sw.plantilla.js` + `sw/generar.mjs`): el plugin de Vite escribe `dist/sw.js` al compilar, con la lista de archivos y una huella del contenido (si cambia cualquier archivo, cambia la versión). Precarga todo al instalar, sirve desde la copia local (la navegación abre `index.html`), borra cachés viejas al activar y solo toca archivos propios. **No se actualiza solo.**
- **Actualización controlada** (`src/pwa/gestor.js`, `src/app/AvisoPWA.jsx`): aviso «Hay una versión nueva» con «Actualizar ahora / Más tarde». Antes de recargar se pide a todos los editores abiertos guardar lo pendiente (evento `anotomia:guardar-todo`, atendido por `crearAutoguardado`) y se espera a que termine. Busca versiones nuevas al volver a la app y cada hora.
- **Instrucciones de instalación** (`src/app/ModalInstalar.jsx`, enlace «Instalar la app» en el pie de la biblioteca) para PC, Android e iPad, con botón «Instalar ahora» cuando el navegador lo permite, y advertencia sobre Safari y el borrado de datos.
- `base: './'` en Vite: la app funciona igual en la raíz o en una subcarpeta (p. ej. `/notas`).
- Pruebas: 187 (14 nuevas: generación del SW, comportamiento del SW simulado —instalación, activación, sin conexión, no tocar lo ajeno—, manifiesto e íconos, gestor de instalación/actualización y guardado previo a actualizar).

**Cómo probar (aceptación)**
1. En la PC: `npm run build` y luego `npm run preview` (abre en `http://localhost:4173`; `localhost` cuenta como sitio seguro). Instalar desde la barra de direcciones, cerrar, desconectar internet y abrir la app instalada: debe verse y permitir crear/editar notas.
2. Probar la actualización: cambiar cualquier texto, volver a compilar, y con la app abierta debe aparecer el aviso; al pulsar «Actualizar ahora» la app se recarga sin perder lo escrito.
3. Tablets: **requieren HTTPS**. Hace falta una publicación de prueba que no esté enlazada desde la web (por ejemplo un proyecto aparte en Vercel con el contenido de `dist/`). Android: Chrome → «Instalar aplicación». iPad: Safari → Compartir → «Agregar a pantalla de inicio».
4. En DevTools (Application → Service Workers / Cache Storage) comprobar que `anotomia-<huella>` contiene los archivos y que, al actualizar, la caché anterior desaparece.

**Cosas a tener en cuenta**
- `sw.js` debe servirse **sin caché** (Vite preview y Vercel lo hacen por defecto); si un hosting lo cachea, las actualizaciones no se detectarán.
- Etapa 15 (publicar en la web): resuelto sin tocar el código de la app. Se publica como sitio estático en `/notas/app/index.html` (el registro `./sw.js` y todas las rutas relativas dependen de que la dirección esté dentro de `/notas/app/`); `/notas/app` redirige a esa dirección (`next.config.mjs` de la web). La app no usa el diseño ni los estilos de la web.
- No se pudo probar en un navegador real en este entorno: la lógica se verificó con pruebas automáticas y con un servidor de producción (todos los archivos precargados responden 200). La aceptación en dispositivos queda a cargo de usted.
- Idea para después: asociar los archivos `.nota` a la app instalada (`file_handlers` del manifiesto, solo PC) para abrirlos con doble clic.

## Auditoría y consolidación de robustez (20 de octubre de 2026)
- **Salvaguarda de tinta ante cierre de pestaña / segundo plano:** se incorporó `finalizarGestoEnCurso()` en `src/lienzo/motor.js`, que consolida trazos y modificaciones en curso ante eventos `pagehide` y `visibilitychange`, o llamadas de guardado previo. Tanto el autoguardado como la salida de los tres editores (`EditorLienzo`, `EditorPaginas`, `EditorTarjetas`) ejecutan esta consolidación antes de persistir a IndexedDB.
- **Detección y aviso de cuota agotada:** `autoguardado.js` ahora identifica `QuotaExceededError` (y errores DOM análogos) y transiciona al estado específico `'error-espacio'`, mostrando en pantalla «Sin espacio en el dispositivo» para advertir oportunamente al estudiante sin perder los datos en memoria.
- **Entrada con teclado y barra espaciadora:** en documentos en modo teclado o con cursor visible, la barra espaciadora inicia la escritura directa de manera fluida en vez de retener la herramienta en paneo.
- **Ergonomía táctil:** botones de la barra de texto `.nt-bt` actualizados a una dimensión mínima de 44 × 44 px (`var(--nt-toque, 44px)`), garantizando comodidad táctil para tablets e iPads.
- **Exportación tolerante a notas dañadas:** `exportarDocumento` envuelve la lectura de elementos en control de excepciones para que notas con registros corruptos puedan respaldarse sin interrumpir la exportación.
- **Pruebas automáticas:** 190 pruebas pasando (3 nuevas en `tests/almacen.test.mjs` y `tests/escritura.test.mjs`).

## Etapa 14 · Pulido, accesibilidad, rendimiento y materias/etiquetas (20 de octubre de 2026)
- **Parte A (Pendientes de etapas anteriores):**
  - Páginas A4: encabezado y pie opcionales configurables por documento (texto libre y numeración «Página N de M»), visualizados en el lienzo y en la impresión (`construirHojasPaginas`).
  - Páginas A4: botón en la barra superior para activar/desactivar flujo automático de texto entre hojas (`flujoAutomatico`), y continuidad exacta de la numeración en listas partidas entre hojas consecutivas (`partirTextoPorDesborde`).
  - Escritura con teclado: cursor visible de inserción en azul, continuidad debajo o en el mismo texto al pulsar Esc sin crear cuadros superfluos, e inicio de escritura con barra espaciadora en modo teclado.
- **Parte B (Manejo de errores y tolerancia a fallos):**
  - Espacio lleno: captura de `QuotaExceededError` en todas las transacciones de IndexedDB con aviso visual destacado en pantalla, conservando el contenido en memoria y sugiriendo exportar copia de seguridad.
  - Documentos dañados aislados con marca `_danado: true`, permitiendo eliminarlos o exportar sus datos crudos sin bloquear la carga de la biblioteca.
  - Pantalla de Error Boundary con botón de recarga para prevenir pantallas en blanco ante excepciones inesperadas.
- **Parte C (Accesibilidad y ergonomía):**
  - Dimensionamiento de botones y áreas de toque a un mínimo ergonómico de 44 × 44 px (`--nt-toque: 44px`).
  - Navegación lógica con teclado, atributos `aria-label`, modales con gestión de escape y foco, y compatibilidad con `prefers-reduced-motion`.
- **Parte D (Ayuda y textos):**
  - Pantalla de bienvenida modal (se muestra una única vez al iniciar la app), diálogo de ayuda organizado por pestañas (atajos de teclado, gestos y lápiz, formatos de notas) y redacción uniforme en español formal (*usted*).
- **Parte E (Rendimiento):**
  - Listado de biblioteca optimizado: solo lee metadatos de documentos sin cargar elementos en memoria.
  - Renderizado por lotes y simplificación de trazos a escala reducida en el motor de dibujo.
- **Parte F (Materias y etiquetas):**
  - Implementado el modelo de **Materias de un solo nivel con color identificativo + etiquetas libres**.
  - Módulo `src/almacen/carpetas.js` con funciones transaccionales: `listarCarpetas`, `guardarCarpeta`, `eliminarCarpeta`, `moverDocumentoACarpeta`, `asignarEtiquetasDocumento`.
  - Barra de materias en la biblioteca con contador de notas en vivo por materia, pestañas «Todas», «Sin materia», y materias personalizadas con selector de 8 colores del sistema.
  - Al eliminar una materia, sus notas pasan a «Sin materia» de manera segura, sin riesgo de pérdida de datos.
  - Etiquetas libres (`#tag`) con barra de filtros rápidos en la biblioteca, edición por nota y búsqueda integral por título, materia o etiqueta.
  - Respaldo completo (`.anotomia-respaldo`) e importación atómica que empaquetan y restauran las materias y sus colores.
- **Pruebas automáticas:** 194 pruebas pasando al 100 % (4 pruebas nuevas en `tests/carpetas.test.mjs`).

## Auditoría de las etapas 0 a 14 y correcciones (20 de octubre de 2026)
- **Resultado de la auditoría:** pruebas, compilación y lint correctos (0 errores); todo lo declarado en las etapas 13 y 14 existe en el código. Sin comprobar en dispositivos reales: lápiz en tablet, modo estudio, impresión, compartir en Safari, instalación y uso sin conexión en PC, Android e iPad.
- **Almacenamiento persistente automático:** antes solo se pedía con el botón «Proteger datos». Ahora la biblioteca lo pide una vez por sesión en cuanto hay al menos una nota (`asegurarPersistencia` en `src/almacen/persistencia.js`). El botón sigue disponible si el navegador lo niega.
- **Carpeta de copias recordada** (Chrome y Edge; Chrome en Android desde la versión 132): la carpeta elegida se guarda en los ajustes y las copias siguientes la reutilizan sin abrir el selector. Si el navegador pide permiso de nuevo, se resuelve con un toque. Hay opciones «Elegir otra carpeta» y «Olvidar» (`resolverCarpetaDeCopias` y afines en `src/archivos/copias.js`). Safari, iPad y Firefox no admiten esta función: allí la copia sigue siendo manual (descargar o «Guardar en Archivos»).
- **Limpieza:** se eliminó `public/icons.svg` (sobrante que figuraba como eliminado en la Etapa 13).
- **Pruebas:** 200 (6 nuevas en `tests/persistencia.test.mjs`).
- **Pendiente de decidir (no se tocó):** copia automática al cerrar la app; paquete de 505 KB (150 KB comprimido), aceptable gracias al service worker; 7 advertencias de lint menores.
