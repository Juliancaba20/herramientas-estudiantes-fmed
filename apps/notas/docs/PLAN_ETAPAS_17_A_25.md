# Anotomía · Plan de crecimiento: etapas 17 a 25

Versión 1 · 21 de octubre de 2026 · Continúa el plan original (etapas 0 a 16).

## 0. Propósito y criterio de diseño

Anotomía debe ser una alternativa real a GoodNotes, Notability, OneNote, Word, PowerPoint y Canva **para estudiantes**, sin servidor ni cuenta. No se busca copiar todo lo que hacen esas aplicaciones, sino reunir tres cosas:

1. **Lo que hacen las aplicaciones de notas** (GoodNotes, Notability): anotar sobre PDF, lazo de selección, regla, audio sincronizado.
2. **Lo básico de Word, PowerPoint y Canva** que el estudiante extraña a diario: estilos, buscar y reemplazar, alinear, plantillas, fondos, formas.
3. **Funciones propias para estudiar medicina**, que ninguna aplicación grande resuelve bien: oclusión de imagen, texto oculto, repetición espaciada, enlaces entre notas.

## 1. Reglas de trabajo (las mismas del plan original)

- Una etapa por vez, en orden. No se pasa a la siguiente hasta que usted pruebe y dé el visto bueno.
- Antes de programar, **auditoría del código existente** (nunca se programa a ciegas).
- Al cerrar cada etapa: proyecto completo en `.zip`, `ESTADO.md` actualizado y pruebas automáticas en verde (`npm test` y `npm run lint`).
- Las etapas grandes se subdividen en pasos (se indica en cada una).
- Toda idea nueva va a «Ideas para después» y no interrumpe la etapa en curso.
- **Condición previa:** cerrar la Etapa 15 (publicación y prueba en PC, Android e iPad) antes de comenzar la 17. La Etapa 16 (instalador de PC) es opcional y puede hacerse antes o después.
- Todo dato nuevo debe incluirse en el formato `.nota` y en el respaldo completo, con número de versión y lectura de archivos antiguos.

> **Nota sobre los archivos probables.** Los nombres de archivos de cada etapa salen del inventario del proyecto (zip `notas5`), pero **no se leyó su contenido completo**. Son hipótesis a confirmar en la auditoría previa de cada etapa.

## 2. Resumen

| Etapa | Nombre | Inspirada en | Complejidad | Dependencia | Riesgo principal |
|---|---|---|---|---|---|
| 17 | Edición esencial del lienzo | GoodNotes, PowerPoint, Canva | Alta | 15 | Modelo de datos (grupos) y deshacer |
| 18 | Búsqueda global y exportación | OneNote, Notion, Canva | Media | 17 | Rendimiento del índice; PDF sin servidor |
| 19 | PDF: importar y anotar | GoodNotes, Notability | Muy alta | 18 | Memoria en iPad/Safari |
| 20 | Texto y A4 al nivel de Word | Word | Muy alta | 17 | Maquetación y guía de renglones |
| 21 | Diseño visual y plantillas | Canva, PowerPoint | Alta | 17, 20 | Tamaño de la app y licencias de íconos |
| 22 | Estudio de medicina | Anki, Quizlet | Alta | 21 | Cambio del modelo de tarjetas |
| 23 | Conexiones y organización | Obsidian, Notion, OneNote | Media | 21, 22 | Enlaces rotos al borrar o duplicar |
| 24 | Herramientas de precisión | GoodNotes | Media | 17 | Sensación del lápiz en tablet real |
| 25 | Audio sincronizado | Notability | Muy alta | 18 | Formatos de audio en iPad y peso de los archivos |

Complejidad relativa, como en el plan original. Las etapas 19, 20 y 25 son las más difíciles: se empiezan siempre con un prototipo.

---

## Etapa 17 · Edición esencial del lienzo

**Objetivo.** Que mover, copiar y ordenar contenido sea tan fluido como en PowerPoint o GoodNotes.

**Alcance**
- Copiar, cortar, pegar y duplicar (Ctrl+C, Ctrl+X, Ctrl+V, Ctrl+D y botones táctiles) para cualquier selección: trazos, figuras, textos, imágenes y símbolos.
- Pegar dentro del mismo documento, entre documentos y entre formatos (pizarrón, tarjetas, páginas). Las imágenes conservan su referencia sin duplicar peso. En A4 se pega en la página activa.
- Selección múltiple y **lazo a mano alzada**: rodear elementos para seleccionarlos.
- **Estirar trazos y símbolos** con las manijas (hoy solo se mueven), con proporción fija si se mantiene Mayús.
- Agrupar y desagrupar; bloquear y desbloquear elementos.
- Alinear (izquierda, centro, derecha, arriba, medio, abajo) y distribuir (horizontal y vertical).
- **Guías inteligentes e imán** a otros elementos y, si hay renglones cuadriculados, a la cuadrícula. Se activan y desactivan.
- Cada operación es una sola acción en el historial (deshacer y rehacer).

**Fuera de alcance:** copiar entre dispositivos (se hace con archivos `.nota`), transformaciones por rotación libre.

**Archivos probables (a confirmar):** `src/lienzo/motor.js`, `historial.js`, `escena.js`, `geometria.js`, `src/app/EditorLienzo.jsx`, `EditorComun.jsx`, `PanelFigura.jsx`, `src/formatos/EditorTarjetas.jsx` y `EditorPaginas.jsx`, `src/almacen/modelo.js`.

**Riesgos.** Los grupos cambian el modelo de datos: hay que subir la versión del formato y leer los archivos viejos. El pegado debe generar identificadores nuevos (sin `crypto.randomUUID()`, que no existe por http en red local).

**Subdivisión sugerida**
- 17A: copiar, cortar, pegar y duplicar.
- 17B: estirar trazos y símbolos, selección múltiple y lazo.
- 17C: agrupar, bloquear, alinear, distribuir, guías e imán.

**Criterio de aceptación.** En PC y en tablet: se copian 30 elementos mixtos de un pizarrón a una tarjeta y a una página A4; se estiran un trazo y un símbolo; se alinean y distribuyen cinco figuras; se agrupan y se mueven como una; todo se deshace y rehace sin fallas y se reabre el documento sin pérdidas.

---

## Etapa 18 · Búsqueda global y exportación

**Objetivo.** Encontrar cualquier cosa entre cientos de notas y sacar el contenido en formatos estándar.

**Alcance**
- **Búsqueda en todos los documentos:** títulos, texto de los bloques, tablas, etiquetas y materias. Resultados con fragmento y acceso directo al lugar exacto (cámara centrada en el pizarrón, página, tarjeta).
- Índice propio en IndexedDB, actualizado de forma incremental con el autoguardado, sin bloquear la interfaz; reconstruible desde cero si se daña.
- **Buscar dentro del documento abierto** (Ctrl+F) con coincidencias resaltadas.
- **Exportar a imagen** (PNG o JPG): todo el pizarrón, una tarjeta, una página o la selección; escala 1×, 2× o 3×; fondo transparente opcional.
- **Exportar a PDF real** descargable, sin depender del diálogo de imprimir. Antes de elegir el método se hace un pequeño prototipo comparando una biblioteca ligera de PDF contra la impresión nativa (peso de la app, funcionamiento sin conexión, calidad).

**Fuera de alcance:** búsqueda dentro de la escritura a mano (requiere reconocimiento de escritura).

**Archivos probables:** `src/almacen/` (nuevo `indice.js`), `src/app/Biblioteca.jsx`, `src/archivos/exportar.js`, `src/formatos/impresion.js`, `src/estilos/impresion.css`.

**Riesgos.** Rendimiento del índice con muchos documentos; tamaño máximo de los lienzos al exportar a imagen (límites de memoria en iPad).

**Subdivisión sugerida:** 18A búsqueda global; 18B buscar en el documento; 18C imagen y PDF.

**Criterio de aceptación.** Con 50 documentos de prueba, la búsqueda responde en menos de un segundo y abre el lugar correcto; se exporta un pizarrón grande a PNG y una página A4 a PDF, y ambos se ven bien en la tablet.

---

## Etapa 19 · PDF: importar y anotar

**Objetivo.** Poder abrir las diapositivas o guías de la facultad y escribir encima, como en GoodNotes.

**Paso previo obligatorio: prototipo.** Se prueba una biblioteca de lectura de PDF (por ejemplo PDF.js) con un PDF de 100 páginas en una tablet real, midiendo memoria, velocidad y funcionamiento sin conexión. Si el resultado no es estable, se simplifica (por ejemplo, convertir cada página a imagen al importar) antes de seguir.

**Alcance**
- Nueva acción «Anotar un PDF» en la biblioteca.
- Cada página del PDF es el fondo de una página del documento, con el tamaño real de esa página. El PDF original se guarda **una sola vez** en el almacén de archivos (blobs) y las páginas lo referencian.
- Sobre el PDF se usan las mismas herramientas: lápiz, resaltador, borrador, texto, símbolos e imágenes.
- Dibujo solo de las páginas visibles; baja resolución al alejar y alta al acercar; liberación de memoria de las páginas lejanas.
- Miniaturas laterales para saltar de página.
- El `.nota` incluye el PDF; el respaldo y el medidor de espacio lo cuentan.
- Aviso por tamaño excesivo (por ejemplo, más de 100 MB).
- **Exportar el PDF anotado** (las anotaciones se incorporan a las páginas). Depende del método elegido en la Etapa 18.
- Opcional, si el prototipo lo permite: resaltar el texto propio del PDF.

**Fuera de alcance:** rellenar formularios PDF, firmar, editar el texto original del PDF.

**Archivos probables:** nuevo `src/formatos/pdf.js` y `EditorPdf.jsx` (o extensión de `EditorPaginas.jsx`), `src/almacen/blobs.js`, `src/archivos/formato.js`, `src/pwa/` (precarga del procesador de PDF), `vite.config.js`.

**Riesgos.** Memoria en iPad y Safari; el procesador de PDF debe precargarse en el Service Worker para funcionar sin conexión; archivos `.nota` muy pesados.

**Criterio de aceptación.** Un PDF de 100 páginas se abre en la tablet sin trabarse, se anotan 10 páginas con lápiz y resaltador, se cierra y reabre sin pérdidas, se exporta anotado, y todo funciona sin conexión.

---

## Etapa 20 · Texto y páginas A4 al nivel de Word

**Objetivo.** Que un resumen largo pueda escribirse y maquetarse sin extrañar Word.

**Advertencia.** Hoy el tamaño de letra es del bloque completo y el texto se compone alineado a la guía de renglones. Permitir tamaños y fuentes distintos dentro de un mismo texto toca la maquetación y la guía. Por eso se subdivide y se prueba en cada paso.

**20A · Formato de texto**
- Fuente y tamaño distintos dentro de un mismo bloque (lista corta de fuentes autoalojadas, para que funcionen sin conexión).
- Subíndice y superíndice como formato (por ejemplo H₂O, Ca²⁺).
- Justificado, interlineado y sangría configurables.
- **Copiar formato** (el pincel).
- Contador de palabras y caracteres.

**20B · Estructura**
- **Estilos de párrafo reutilizables** (Título, Subtítulo, Definición, Importante, Cita): cambiar un estilo actualiza todo el documento.
- **Buscar y reemplazar** dentro del documento.
- Enlaces (a páginas web, y más adelante a otras notas).
- Notas al pie.
- **Tabla de contenido automática** a partir de los títulos, con salto directo.
- Saltos de página manuales.

**20C · Página y tablas**
- Márgenes configurables, hoja horizontal y otros tamaños (Carta, A5).
- Tablas avanzadas: combinar celdas, color de celda, ancho de columna, bordes.

**Fuera de alcance:** control de cambios, columnas de periódico, combinación de correspondencia.

**Archivos probables:** `src/herramientas/texto/` (`modelo.js`, `html.js`, `maquetar.js`, `pintar.js`, `editor.js`, `tabla.js`, `estilo.js`), `src/app/BarraTexto.jsx`, `src/formatos/paginas.js`, `EditorPaginas.jsx`, `src/estilos/impresion.css`.

**Riesgos.** Que el texto de pantalla, el del lienzo y el de la impresión dejen de coincidir; que la guía de renglones se desalinee. Los textos antiguos deben seguir leyéndose.

**Criterio de aceptación.** Un resumen de 20 páginas con estilos, tabla de contenido, tablas con celdas combinadas y notas al pie se ve e imprime idéntico; cambiar el estilo «Título» actualiza todo el documento.

---

## Etapa 21 · Diseño visual y plantillas

**Objetivo.** Notas atractivas, estilo Canva y PowerPoint, sin salir de la app.

**21A · Estilos visuales y formas**
- Selector de color con **cuentagotas** y paletas guardadas. (La función nativa de cuentagotas no existe en todos los navegadores, en particular en Safari; hay que verificarlo y prever una alternativa propia.)
- Degradados, fondos de página o tarjeta (color, degradado, imagen).
- Bordes, esquinas redondeadas, sombras y opacidad para formas e imágenes.
- Marcos de imagen (círculo, redondeado).
- Más formas: estrella, hexágono, llave, nube, cilindro, cruz, flecha doblada.
- Biblioteca de **íconos y pegatinas** propios (SVG). Deben ser de elaboración propia o de licencia libre verificada.

**21B · Conectores y diseños**
- **Conectores** entre formas: líneas y flechas ancladas que siguen a la forma al moverla.
- Diseños predefinidos de tarjeta (título, dos columnas, imagen con texto).
- Notas del orador en las tarjetas.

**21C · Plantillas y presentación**
- **Plantillas de documentos** (clase, resumen, Cornell, repaso, cuadro comparativo, línea de tiempo) y «Guardar como plantilla» propia.
- Modo estudio mejorado: **revelar contenido por pasos**, puntero láser y temporizador.

**Archivos probables:** `src/app/formas.js`, `MenuFormas.jsx`, `PanelFigura.jsx`, `src/lienzo/dibujo.js`, `src/estilos/variables.css`, `src/formatos/estudio.js`, `EstudioTarjetas.jsx`, `src/app/SelectorFormato.jsx`.

**Riesgos.** Peso de la aplicación (debe seguir cargando rápido y funcionar sin conexión); licencias de los íconos; rendimiento del dibujo con sombras.

**Criterio de aceptación.** Se arma una tarjeta con fondo degradado, formas con sombra y un conector que sigue a las formas al moverlas; se crea un documento desde una plantilla y se guarda una plantilla propia.

---

## Etapa 22 · Estudio de medicina

**Objetivo.** El diferenciador de Anotomía: estudiar activamente desde las propias notas.

**Alcance**
- **Tarjeta de doble cara** (anverso y reverso) que se da vuelta.
- **Texto oculto («cloze»)**: marcar palabras de un texto como ocultas; en modo estudio se tapan y se revelan al tocar.
- **Oclusión de imagen**: sobre una imagen anatómica se dibujan máscaras sobre las etiquetas; modos «ocultar una» y «ocultar todas»; se revela al tocar.
- **Repetición espaciada**: al terminar una tarjeta se califica (otra vez, difícil, bien, fácil) y un algoritmo sencillo y local programa el próximo repaso.
- Cola diaria «para repasar hoy» y contador en la biblioteca; estadísticas simples (tarjetas repasadas, racha).
- Repasos por materia.
- Los datos de repaso se incluyen en `.nota` y en el respaldo completo.

**Fuera de alcance:** importar o exportar mazos de Anki, sincronización del progreso entre dispositivos.

**Archivos probables:** `src/formatos/tarjetas.js`, `estudio.js`, `EstudioTarjetas.jsx`, `src/almacen/` (nuevo almacén de repasos), `src/archivos/formato.js`, `src/app/Biblioteca.jsx`.

**Riesgos.** Cambia el modelo de tarjetas; hay que migrar sin perder las existentes. Un mal diseño de los datos de repaso es costoso de corregir después.

**Subdivisión sugerida:** 22A doble cara y texto oculto; 22B oclusión de imagen; 22C repetición espaciada.

**Criterio de aceptación.** Con una imagen anatómica de 10 etiquetas se estudia por oclusión; con un mazo de 20 tarjetas se hace un repaso, se cierra la app, y al día siguiente la cola refleja lo programado.

---

## Etapa 23 · Conexiones y organización

**Objetivo.** Que las notas formen una red de conocimiento, no archivos aislados.

**Alcance**
- **Enlaces entre notas** (desde texto y desde elementos), con panel de «notas que enlazan aquí».
- Tratamiento seguro de enlaces rotos al eliminar o importar (aviso, nunca error).
- **Marcadores e índice** dentro del documento: en A4, esquema automático de títulos; en pizarrón, marcadores de ubicación; en tarjetas, lista.
- **Favoritos y notas fijadas** en la biblioteca; recientes.
- **Mapas conceptuales**: crear un nodo hijo con un toque, con conectores (depende de la Etapa 21B).
- **Calendario de exámenes** simple por materia con cuenta regresiva. Las notificaciones fuera de la app no están garantizadas en todos los dispositivos, por lo que no se prometen.

**Archivos probables:** `src/almacen/`, `src/app/Biblioteca.jsx`, `src/herramientas/texto/`, `src/lienzo/minimapa.js`.

**Riesgos.** Enlaces que apuntan a documentos duplicados, eliminados o importados con otro identificador.

**Criterio de aceptación.** Se enlaza una nota con otras tres, se ve el panel de enlaces entrantes, se elimina una de las notas enlazadas sin errores y se crea un mapa conceptual de 8 nodos.

---

## Etapa 24 · Herramientas de precisión

**Objetivo.** Dibujos y esquemas prolijos a mano alzada.

**Alcance**
- **Regla** movible y rotable, con marcas en centímetros, para trazar líneas rectas junto a su borde.
- **Transportador** y escuadra.
- **Corrección automática de formas**: al mantener el lápiz quieto al final de un trazo, se convierte en línea, círculo, rectángulo o triángulo. Se activa y desactiva.
- **Lápices favoritos**: 3 a 5 ajustes personalizables a un toque.

**Limitación a tener en cuenta.** Hasta donde sé, las páginas web no reciben el gesto de doble toque del Apple Pencil, por lo que no se prevén atajos con ese gesto.

**Archivos probables:** `src/lienzo/motor.js`, `dibujo.js`, `geometria.js`, `src/app/EditorLienzo.jsx`.

**Riesgos.** Sensación del lápiz y latencia en tablet real; esta etapa se prueba obligatoriamente con lápiz.

**Criterio de aceptación.** En una tablet con lápiz se traza un diagrama con regla, se miden ángulos con el transportador y se corrigen formas sin que el trazo se retrase.

---

## Etapa 25 · Audio sincronizado

**Objetivo.** Grabar la clase mientras se escribe y, después, tocar un trazo para escuchar lo que se decía en ese momento.

**Paso previo obligatorio: prototipo** en una tablet real para comprobar la grabación de audio, el formato resultante en cada sistema (iPad y Android no generan los mismos formatos) y el permiso del micrófono.

**Alcance**
- Botón de grabar en los tres formatos; cada trazo o texto queda asociado a su marca de tiempo.
- Reproducción tocando un elemento (salta al momento) y barra de reproducción con velocidad.
- Audio guardado en el almacén de archivos; incluido en `.nota` y en el respaldo, con la opción de **exportar sin audio** por su peso.
- El medidor de espacio refleja el audio.
- Aviso claro de privacidad: la grabación queda solo en el dispositivo.

**Archivos probables:** nuevo `src/herramientas/audio/`, `src/almacen/blobs.js`, `src/archivos/`, `src/lienzo/escena.js`.

**Riesgos.** Compatibilidad de formatos entre sistemas, duración máxima, espacio ocupado, grabación interrumpida por el sistema al cambiar de aplicación.

**Criterio de aceptación.** Se graba una clase de 30 minutos en la tablet, se toca un trazo del minuto 12 y se escucha ese tramo; el `.nota` se abre en la PC con el audio.

---

## 3. Ideas que quedan fuera de este plan

- Sincronización opcional entre dispositivos y cuentas.
- Reconocimiento de escritura a mano (y, con él, búsqueda dentro de la escritura).
- Importar y exportar mazos de Anki.
- Colaboración en tiempo real.
- Publicación en App Store.

## 4. Cómo usar el documento de prompts

El archivo `PROMPTS_POR_ETAPA.md` contiene un **contexto fijo** (se pega siempre primero) y un prompt específico por etapa o subetapa. Cada prompt exige auditoría previa, entrega de archivos completos, pruebas y actualización de `ESTADO.md`.
