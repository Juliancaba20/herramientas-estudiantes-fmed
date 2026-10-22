# Anotomía · Prompts por etapa (etapas 17 a 25)

Para usar con Google AI Studio, ChatGPT, Gemini, Claude u otra inteligencia artificial.

## Cómo usarlos

1. **Una conversación nueva por etapa o subetapa.** Las conversaciones largas pierden el hilo.
2. **Adjunte el `.zip` más reciente** del proyecto (el que cerró la etapa anterior).
3. **Pegue primero el «Contexto fijo»** (sección 1) y, en el mismo mensaje o a continuación, el prompt de la etapa (sección 2).
4. **No pase a la siguiente subetapa** hasta probar la actual y dar el visto bueno.
5. **Traiga el resultado a una auditoría** antes de aprobarlo: use el «Prompt de auditoría» (sección 3), preferentemente en otra conversación o con otra IA.
6. Si la IA no puede ejecutar comandos (suele ser el caso en Google AI Studio), el contexto fijo ya le exige una revisión manual. Aun así, ejecute usted `npm install`, `npm run lint` y `npm test` en su PC antes de aprobar.

Una advertencia tomada de la experiencia del proyecto: en la primera prueba en la web, el pizarrón no abría porque faltaban definiciones de variables en `EditorLienzo.jsx`. Por eso los prompts piden de forma explícita revisar variables sin definir e importaciones inexistentes.

---

## 1. Contexto fijo (se pega SIEMPRE primero)

```text
Usted es un ingeniero de software senior que continúa el desarrollo de «Anotomía», una aplicación de notas para estudiantes (principalmente de medicina). Responda siempre en español, con trato formal (usted).

CÓMO ES EL PROYECTO
- Adjunto el .zip completo. La aplicación está en la carpeta apps/notas (Vite + React 19 + JavaScript, sin TypeScript).
- Es una PWA que funciona sin servidor ni cuenta: todos los datos viven en el dispositivo, en IndexedDB (la base se llama «notas-app» a propósito; no la renombre).
- Tiene tres formatos: pizarrón infinito, páginas A4 y tarjetas. Y dos modos de escritura: a mano (mouse, dedo, lápiz) y con teclado.
- Código en src/: almacen/ (IndexedDB), app/ (pantallas y paneles), lienzo/ (motor: cámara, escena, historial, dibujo, renglones), formatos/ (tarjetas, páginas), herramientas/ (texto, símbolos, imágenes), archivos/ (formato .nota, exportar, importar, copias), pwa/ (service worker), estilos/.
- Hay un archivo apps/notas/ESTADO.md con lo hecho, las decisiones y lo pendiente. Léalo completo antes de empezar.
- Pruebas automáticas en apps/notas/tests (npm test) y análisis estático con npm run lint (oxlint).

REGLAS OBLIGATORIAS
1. AUDITORÍA PRIMERO. Antes de escribir código, lea los archivos que va a tocar y los que dependen de ellos. Entregue un informe breve: qué existe hoy (con rutas y líneas), qué va a crear o modificar archivo por archivo, riesgos y supuestos. Si una afirmación sobre el proyecto no salió de haber leído el archivo, declárela como supuesto. No asuma que una función o archivo existe: búsquelo.
2. CAMBIOS QUIRÚRGICOS. Modifique solo lo necesario. No reformatee ni reorganice código ajeno a la tarea. No cambie nombres existentes ni la estructura de carpetas sin necesidad.
3. CONVENCIONES. Clases CSS con prefijo «nt-» y variables con prefijo «--nt-». Colores, tipografías y espaciados desde src/estilos/variables.css. Todos los textos visibles en español formal (usted). Botones táctiles de al menos 44 × 44 px (--nt-toque). Respete prefers-reduced-motion y los atributos aria.
4. SIN DEPENDENCIAS DE SERVIDOR. Nada de cuentas, llamadas a internet ni servicios externos. Todo debe funcionar sin conexión. No agregue una dependencia nueva sin justificarla (peso, licencia, funcionamiento sin conexión) y pedir mi aprobación antes.
5. IDENTIFICADORES. No use crypto.randomUUID() (no existe por http en la red local de desarrollo); use el generador de identificadores que ya tiene el proyecto.
6. DATOS Y COMPATIBILIDAD. Cualquier dato nuevo debe: guardarse en IndexedDB, incluirse en el formato .nota y en el respaldo completo, llevar número de versión, y seguir leyendo sin errores los documentos y archivos antiguos (migración segura, sin pérdida de datos). Toda operación del usuario debe poder deshacerse y rehacerse como una sola acción del historial, salvo que se indique otra cosa.
7. ERRORES. Ante fallos (espacio lleno, archivo dañado, permiso denegado) muestre un mensaje claro en español y nunca pierda contenido ni deje la pantalla en blanco.
8. ALCANCE. Haga SOLO lo que pide la tarea. Si se le ocurre otra idea, anótela en la sección «Ideas para después» de ESTADO.md y no la implemente.

VERIFICACIÓN ANTES DE ENTREGAR
- Si puede ejecutar comandos: npm install, npm run lint (debe quedar sin errores), npm test (todas las pruebas en verde) y npm run build.
- Si NO puede ejecutar comandos, dígalo expresamente y haga una revisión manual archivo por archivo: variables o funciones sin definir (no-undef), importaciones que apunten a archivos o exportaciones inexistentes, props no pasadas entre componentes, ids o claves duplicados, y sintaxis. No diga que algo «se probó» si no lo ejecutó.
- Agregue pruebas automáticas nuevas en tests/ para la lógica nueva (con el mismo estilo de las existentes).

FORMA DE ENTREGA
1. Informe de auditoría (breve).
2. Código: cada archivo creado o modificado, COMPLETO (nunca fragmentos con «…» ni «el resto igual»), con su ruta.
3. Lista de archivos nuevos, modificados y eliminados.
4. ESTADO.md actualizado con: qué se hizo, decisiones tomadas, limitaciones conocidas y qué quedó sin comprobar.
5. Pasos de prueba manual que yo pueda seguir en la PC y en la tablet para verificar el criterio de aceptación.
6. Al final, un resumen que empiece por el resultado: qué quedó funcionando, qué se verificó y cómo, y qué NO se pudo comprobar.
```

---

## 2. Prompts por etapa

En cada prompt, lo que figura entre corchetes lo completa usted si corresponde.

### Etapa 17A · Copiar, cortar, pegar y duplicar

```text
TAREA: Etapa 17A · Copiar, cortar, pegar y duplicar elementos.

Implementar Ctrl+C, Ctrl+X, Ctrl+V y Ctrl+D (y botones equivalentes en la barra, accesibles con el dedo) para cualquier selección: trazos, figuras, textos, imágenes y símbolos.

Requisitos:
- Funciona dentro del mismo documento, entre documentos distintos y entre formatos (pizarrón, tarjetas, páginas A4).
- Al pegar, los elementos reciben identificadores nuevos y aparecen con un leve desplazamiento respecto del original; quedan seleccionados. En páginas A4 se pegan en la página activa; en tarjetas, en la tarjeta activa.
- Las imágenes conservan la referencia al mismo archivo (blobId) sin duplicar su peso; verificar que al eliminar una copia no se borre la imagen de la otra (como ya ocurre con duplicar documentos).
- El portapapeles interno debe convivir con el pegado actual desde Word, la web y el sistema (no romperlo): ya existen _pegar, Ctrl+C de textos con HTML y pegado de imágenes.
- Cada operación es UNA acción en el historial.
- Cortar = copiar + eliminar, también una sola acción.

Criterio de aceptación: se copian 30 elementos mezclados de un pizarrón a una tarjeta y a una página A4, se pegan, se deshace y se rehace todo, y al cerrar y reabrir no hay pérdidas ni elementos huérfanos.
```

### Etapa 17B · Estirar, selección múltiple y lazo

```text
TAREA: Etapa 17B · Estirar trazos y símbolos, selección múltiple y lazo.

Hoy los trazos y símbolos solo se mueven. Implementar:
- Estirar y escalar trazos y símbolos con manijas, con proporción fija si se mantiene Mayús (y con un interruptor táctil para tablet). Los trazos deben escalarse sin deformar el grosor lógico del lápiz (el grosor se mide en unidades del lienzo y debe seguir siendo uniforme con cualquier zoom).
- Selección múltiple: con recuadro de arrastre y con Mayús/Ctrl más clic. Verificar primero qué existe hoy y reutilizarlo.
- Herramienta LAZO: se dibuja un contorno a mano alzada y se seleccionan los elementos dentro (o que lo cortan; elegir y documentar el criterio). Disponible con dedo y lápiz.
- Mover, estirar, copiar y eliminar sobre la selección múltiple, como una sola acción de historial.

Criterio de aceptación: se rodean con el lazo 20 trazos de un pizarrón, se estiran al 150 %, se mueven, se deshace y rehace, y se reabre el documento sin cambios no deseados. Prueba obligatoria en tablet táctil.
```

### Etapa 17C · Agrupar, bloquear, alinear, distribuir e imán

```text
TAREA: Etapa 17C · Agrupar, bloquear, alinear, distribuir, guías e imán.

Implementar:
- Agrupar y desagrupar (Ctrl+G / Ctrl+Mayús+G): el grupo se mueve, escala, copia y elimina como una unidad. Definir el modelo de datos del grupo, subir la versión del formato y migrar documentos antiguos sin pérdida.
- Bloquear y desbloquear elementos (no se pueden mover ni borrar por accidente; icono visible).
- Alinear (izquierda, centro, derecha, arriba, medio, abajo) y distribuir horizontal y verticalmente, sobre selección múltiple.
- Guías inteligentes y imán: líneas de guía al acercarse a los bordes y centros de otros elementos y, si los renglones son cuadriculados, a la cuadrícula. Interruptor para activar o desactivar el imán; no debe alterar nada si está desactivado.
- Todo con deshacer y rehacer.

Criterio de aceptación: se alinean y distribuyen cinco figuras, se agrupan y se mueven como una, se bloquea una figura y no se deja mover, y el documento se reabre idéntico.
```

### Etapa 18A · Búsqueda global

```text
TAREA: Etapa 18A · Búsqueda de texto en todos los documentos.

- Buscar en títulos, texto de bloques, celdas de tablas, etiquetas y materias, sin distinguir mayúsculas ni tildes (reutilizar la normalización que ya usa el buscador de símbolos).
- Índice propio en IndexedDB (almacén nuevo), actualizado de forma incremental cuando el autoguardado persiste cambios; no debe bloquear la interfaz (trabajar por lotes o con requestIdleCallback). Debe poder reconstruirse completo desde cero si se daña o si falta, con un botón de «Reconstruir índice» y una barra de progreso.
- Resultados con fragmento de contexto y el término resaltado; al tocar un resultado se abre el documento y se lleva la vista al lugar exacto (cámara del pizarrón, página A4 o tarjeta correspondiente).
- Incluir los documentos de la papelera solo si el usuario lo activa.
- Pruebas automáticas del índice con fake-indexeddb.

Criterio de aceptación: con 50 documentos de prueba, la búsqueda responde en menos de un segundo y abre el lugar correcto.
```

### Etapa 18B · Buscar dentro del documento

```text
TAREA: Etapa 18B · Buscar dentro del documento abierto (Ctrl+F).

- Barra de búsqueda dentro de los tres formatos con contador «3 de 12», siguiente y anterior, y resaltado de coincidencias en el lienzo.
- Al saltar a una coincidencia se centra la vista en ella (cámara, página o tarjeta).
- No debe modificar los textos ni el historial.
- Preparar la interfaz para que la Etapa 20 agregue «Reemplazar» sin rehacer nada.

Criterio de aceptación: en un documento de 20 páginas A4 se encuentran y recorren todas las coincidencias de una palabra, y en un pizarrón también.
```

### Etapa 18C · Exportar a imagen y a PDF

```text
TAREA: Etapa 18C · Exportar a imagen (PNG/JPG) y a PDF real.

Parte 1, imagen:
- Exportar todo el pizarrón (con un límite de tamaño seguro y aviso si se excede la memoria), una tarjeta, una página A4 o la selección.
- Escala 1×, 2× o 3×; fondo transparente opcional; con o sin renglones.
- Descarga con el mecanismo que ya usa el proyecto (navigator.share o descarga).

Parte 2, PDF:
- PASO PREVIO: haga un breve prototipo comparativo entre (a) una biblioteca ligera de generación de PDF y (b) la impresión nativa actual, y presénteme la comparación (peso agregado a la app, funcionamiento sin conexión, calidad del texto y de los trazos, comportamiento en iPad). NO agregue ninguna dependencia hasta que yo elija.
- Después de mi elección, implementar «Exportar PDF» descargable directamente, con alcance (todo o página actual) y opción de renglones, igual que el modal de impresión actual.

Criterio de aceptación: un pizarrón grande se exporta a PNG y una página A4 a PDF, y ambos se ven bien en la tablet.
```

### Etapa 19 · Paso 1: prototipo de PDF

```text
TAREA: Etapa 19 · PASO 1 · Prototipo de lectura de PDF (NO tocar el código principal de la app).

Cree un prototipo aislado (carpeta prototipos/pdf, fuera de src/) para decidir el método de importación de PDF. Pruebe con PDF.js (u otra opción que justifique):
- Abrir un PDF de 100 páginas y mostrar páginas con desplazamiento vertical continuo, dibujando solo las visibles y liberando memoria de las lejanas.
- Resolución baja al alejar y alta al acercar.
- Medir y reportar: tiempo de apertura, memoria aproximada, fluidez del desplazamiento, y peso agregado a la app.
- Verificar que el procesador (worker) puede servirse localmente y precargarse para funcionar SIN conexión.
- Comparar con la alternativa «convertir cada página a imagen al importar» (más simple pero más pesada).

Entregue: el prototipo, las mediciones, los riesgos para iPad/Safari (memoria) y una RECOMENDACIÓN fundamentada. No avance a la integración hasta que yo lo apruebe.
```

### Etapa 19 · Paso 2: importar y anotar PDF

```text
TAREA: Etapa 19 · PASO 2 · Importar y anotar PDF (usar el método aprobado en el prototipo: [método elegido]).

- Acción «Anotar un PDF» en la biblioteca: elegir un archivo PDF del dispositivo.
- Cada página del PDF es el fondo de una página del documento, con el tamaño real de la página. El PDF original se guarda UNA sola vez en el almacén de archivos (blobs) y las páginas lo referencian.
- Se pueden usar sobre el PDF las mismas herramientas: lápiz, resaltador, borrador, texto, símbolos e imágenes, con deshacer y rehacer.
- Miniaturas laterales para saltar de página; indicador de página activa.
- El .nota y el respaldo completo incluyen el PDF; el medidor de espacio lo cuenta; aviso si supera [tamaño] MB.
- Duplicar el documento no debe duplicar el PDF; eliminarlo (papelera, vaciado) no debe dejar archivos huérfanos ni borrar uno en uso.
- Impresión y exportación del PDF anotado (con las anotaciones incorporadas, usando el método de la Etapa 18C).
- Precarga del procesador de PDF en el service worker para uso sin conexión; actualizar las pruebas de PWA.
- Mensajes claros ante PDF dañado, protegido con contraseña o demasiado grande.

Criterio de aceptación: un PDF de 100 páginas se abre en la tablet sin trabarse, se anotan 10 páginas con lápiz y resaltador, se cierra y reabre sin pérdidas, se exporta anotado y todo funciona sin conexión.
```

### Etapa 20A · Formato de texto

```text
TAREA: Etapa 20A · Formato de texto avanzado (nivel Word, parte 1).

Hoy el tamaño de letra es del bloque completo y el texto se compone alineado a la guía de renglones (composición guiada). Lea con especial cuidado src/herramientas/texto/ (modelo.js, html.js, maquetar.js, pintar.js, editor.js) antes de proponer el cambio de modelo, y presénteme el diseño antes de implementarlo.

Implementar:
- Fuente y tamaño distintos dentro de un mismo bloque (por fragmento). Lista corta de fuentes AUTOALOJADAS (que funcionen sin conexión), incluyendo la serif actual con griego.
- Subíndice y superíndice como formato de fragmento (H₂O, Ca²⁺, x²).
- Justificado, interlineado y sangría configurables.
- Copiar formato (pincel): tomar el formato de un fragmento y aplicarlo a otro.
- Contador de palabras y caracteres (del documento y de la selección).
- Los textos antiguos deben seguir leyéndose idénticos; el pegado desde Word y la web debe aprovechar el nuevo modelo sin romper lo existente.
- La vista de edición, el dibujo en el lienzo y la impresión deben seguir coincidiendo, y la guía de renglones no debe desalinearse.

Criterio de aceptación: se escribe un párrafo con tres fuentes y tamaños, fórmulas con subíndice y superíndice, se justifica, se imprime y se ve igual que en pantalla; los textos de documentos antiguos se ven sin cambios.
```

### Etapa 20B · Estructura: estilos, buscar y reemplazar, enlaces, notas al pie, tabla de contenido

```text
TAREA: Etapa 20B · Estructura del documento (nivel Word, parte 2).

- ESTILOS de párrafo reutilizables (Título, Subtítulo, Definición, Importante, Cita, Texto normal), editables; al cambiar un estilo se actualiza todo el documento. El usuario puede crear estilos propios.
- BUSCAR Y REEMPLAZAR dentro del documento (reemplazar uno o todos; distinguir o no mayúsculas), como una sola acción de historial; reutilizar la barra de la Etapa 18B.
- ENLACES a páginas web en el texto (se abren en una pestaña nueva, con rel seguro). Dejar preparado el tipo de enlace para notas internas (Etapa 23).
- NOTAS AL PIE numeradas automáticamente y colocadas al pie de la página A4 correspondiente.
- TABLA DE CONTENIDO automática en páginas A4, generada de los títulos, con salto directo a cada uno y actualizable.
- SALTOS DE PÁGINA manuales en páginas A4.
- Compatibilidad con documentos antiguos y con el .nota; impresión idéntica a la pantalla.

Criterio de aceptación: un documento A4 de 10 páginas con estilos, tabla de contenido, notas al pie y un reemplazo masivo; al cambiar el estilo «Título» se actualiza todo y se imprime igual.
```

### Etapa 20C · Página y tablas

```text
TAREA: Etapa 20C · Página y tablas avanzadas (nivel Word, parte 3).

- Márgenes configurables por documento; orientación horizontal; tamaños de hoja Carta y A5 además de A4. Cambiarlos no debe mover elementos dibujados a mano de forma incorrecta (definir y documentar el comportamiento; el encabezado, el pie, la numeración y la guía de renglones deben seguir coincidiendo).
- Tablas avanzadas: combinar y dividir celdas, color de fondo de celda, ancho de columna ajustable arrastrando, bordes configurables, alineación vertical. Tablas pegadas desde Word deben conservar lo posible.
- Las tablas respetan los saltos de página.
- Compatibilidad con documentos y .nota antiguos.

Criterio de aceptación: una tabla con celdas combinadas y colores se imprime idéntica; un documento horizontal tamaño Carta se imprime correctamente.
```

### Etapa 21A · Estilos visuales y formas

```text
TAREA: Etapa 21A · Estilos visuales y formas (nivel Canva, parte 1).

- Selector de color con cuentagotas y paletas guardadas por el usuario. NOTA: la función nativa EyeDropper no existe en todos los navegadores (por ejemplo, Safari en iPad); verifique la compatibilidad y proponga una alternativa propia (por ejemplo, tocar sobre una imagen mostrada en un canvas).
- Degradados; fondos de página, tarjeta o pizarrón (color, degradado, imagen).
- Bordes, esquinas redondeadas, sombras y opacidad en formas e imágenes.
- Marcos de imagen (círculo, redondeado).
- Más formas en src/app/formas.js: estrella, hexágono, llave, nube, cilindro, cruz, flecha doblada.
- Biblioteca de ÍCONOS y pegatinas en SVG: solo de creación propia o con licencia libre VERIFICADA; documente la licencia de cada conjunto en un archivo LICENCIAS.md. Prepare 60 a 100 íconos útiles para estudiar (flechas, marcas, signos, íconos simples de anatomía y laboratorio).
- Impresión y exportación respetan todos los estilos nuevos. Cuide el rendimiento del dibujo con sombras.

Criterio de aceptación: se arma una tarjeta con fondo degradado, formas con sombra y un ícono, se imprime igual y la app sigue cargando rápido.
```

### Etapa 21B · Conectores y diseños de tarjeta

```text
TAREA: Etapa 21B · Conectores, diseños de tarjeta y notas del orador.

- CONECTORES: líneas y flechas con extremos anclados a formas; al mover o estirar la forma, el conector la sigue. Opción de línea recta o curva. Si se elimina una forma, el conector queda libre sin errores. Con deshacer y rehacer, copiar y pegar (Etapa 17) y .nota.
- DISEÑOS predefinidos de tarjeta (título, título + contenido, dos columnas, imagen con texto, en blanco): se eligen al crear o al cambiar una tarjeta sin perder su contenido.
- NOTAS DEL ORADOR por tarjeta (campo de texto no impreso por defecto), visibles en modo estudio si se desea.

Criterio de aceptación: se arma un diagrama de 6 formas con conectores, se mueven las formas y los conectores las siguen; se cambia el diseño de una tarjeta sin perder contenido.
```

### Etapa 21C · Plantillas y modo presentación

```text
TAREA: Etapa 21C · Plantillas y modo presentación mejorado.

- PLANTILLAS de documentos: clase, resumen, Cornell, repaso, cuadro comparativo, línea de tiempo (una para cada formato donde corresponda). Se eligen en el selector de formato al crear. Deben ser datos (no código aparte) y no ocupar mucho espacio.
- «GUARDAR COMO PLANTILLA» propia desde cualquier documento; gestión (renombrar, eliminar) de plantillas propias; incluidas en el respaldo completo.
- MODO ESTUDIO: revelar el contenido de una tarjeta por pasos (marcar elementos que aparecen en orden), puntero láser temporal (se desvanece) y temporizador opcional visible.
- Todo en español formal; accesible con teclado y táctil.

Criterio de aceptación: se crea un documento desde una plantilla, se guarda otro como plantilla propia y se reutiliza; se presenta una tarjeta con tres pasos y puntero láser.
```

### Etapa 22A · Doble cara y texto oculto

```text
TAREA: Etapa 22A · Tarjetas de doble cara y texto oculto («cloze»).

- TARJETA DE DOBLE CARA: cada tarjeta puede tener anverso y reverso con contenido propio; en modo estudio se muestra el anverso y se da vuelta al tocar (con una animación breve que respete prefers-reduced-motion). Las tarjetas actuales siguen siendo de una cara sin cambios; la impresión permite imprimir anverso y reverso.
- TEXTO OCULTO: en el editor de texto, marcar un fragmento como «oculto». En edición se ve normal con una marca visual; en modo estudio se tapa y se revela al tocar. Varios fragmentos ocultos en un mismo texto (revelar de a uno o todos).
- Migración sin pérdida del modelo de tarjetas; .nota versionado.

Criterio de aceptación: un mazo de 10 tarjetas de doble cara con texto oculto se estudia en modo estudio, se imprime y se reabre sin pérdidas; las tarjetas antiguas funcionan igual que antes.
```

### Etapa 22B · Oclusión de imagen

```text
TAREA: Etapa 22B · Oclusión de imagen.

- Sobre una imagen insertada, el usuario dibuja máscaras rectangulares (y elípticas) que tapan etiquetas o estructuras, con una etiqueta opcional de texto para cada una.
- Modo estudio: «ocultar una» (se tapa una máscara por vez y las demás se muestran) y «ocultar todas» (se tapan todas y se revelan al tocar una por una).
- Las máscaras pertenecen a la imagen: si se mueve, estira o copia la imagen, las máscaras la acompañan (usar coordenadas relativas a la imagen).
- Funciona en tarjetas y también en pizarrón y páginas (modo estudio de la imagen).
- Con deshacer y rehacer, .nota y respaldo.

Criterio de aceptación: con una imagen anatómica de 10 etiquetas se crean 10 máscaras, se estudia en ambos modos y se reabre sin pérdidas.
```

### Etapa 22C · Repetición espaciada

```text
TAREA: Etapa 22C · Repetición espaciada.

- Al terminar de ver una tarjeta se califica: «Otra vez», «Difícil», «Bien», «Fácil». Un algoritmo sencillo y LOCAL (puede ser una variante de SM-2; justifique la elección y documente los parámetros) calcula la fecha del próximo repaso.
- Almacén nuevo en IndexedDB para el estado de repaso por tarjeta (versión, fecha, intervalo, facilidad, historial resumido). Incluido en .nota y respaldo completo, con migración y lectura de archivos antiguos. Si se duplica una tarjeta o documento, el progreso de la copia empieza de cero.
- Cola diaria «Para repasar hoy» por materia y general; contador visible en la biblioteca; límite diario configurable de tarjetas nuevas.
- Estadísticas simples: tarjetas repasadas hoy, racha de días, porcentaje de aciertos.
- Manejo correcto de fechas (zona horaria y cambio de día), con pruebas automáticas del algoritmo y de los casos límite.

Criterio de aceptación: con un mazo de 20 tarjetas se hace un repaso, se cierra la app y al día siguiente (simulado cambiando la fecha) la cola refleja lo programado; las estadísticas coinciden.
```

### Etapa 23 · Conexiones y organización

```text
TAREA: Etapa 23 · Conexiones y organización (puede subdividirse en 23A enlaces y marcadores, 23B favoritos y calendario, 23C mapas conceptuales; avíseme si propone otra subdivisión).

- ENLACES entre notas: desde un texto (se elige la nota de una lista con buscador) y desde cualquier elemento. Se abren con un toque. Panel «Notas que enlazan aquí».
- Enlaces rotos: si la nota destino se elimina, se importa con otro identificador o se duplica, el enlace se muestra como «nota no disponible» sin errores. Definir y documentar qué pasa al restaurar de la papelera.
- MARCADORES e ÍNDICE dentro del documento: en A4, esquema automático de títulos; en pizarrón, marcadores de ubicación con nombre (la cámara salta al tocarlos); en tarjetas, lista de tarjetas.
- FAVORITOS y notas fijadas en la biblioteca; sección de recientes.
- MAPAS CONCEPTUALES: crear un nodo hijo con un toque desde un nodo (forma con texto) conectado con un conector (usa la Etapa 21B). Mover un nodo no desordena el resto.
- CALENDARIO DE EXÁMENES simple: fechas por materia, cuenta regresiva en la biblioteca. No prometer notificaciones fuera de la app.

Criterio de aceptación: se enlaza una nota con otras tres, se ve el panel de enlaces entrantes, se elimina una nota enlazada sin errores y se crea un mapa conceptual de 8 nodos.
```

### Etapa 24 · Herramientas de precisión

```text
TAREA: Etapa 24 · Herramientas de precisión (prueba obligatoria en tablet real con lápiz).

- REGLA: se muestra sobre el lienzo, se mueve y rota con dos dedos, con marcas en centímetros; al trazar con lápiz junto a su borde, el trazo se pega al borde y queda recto. Se oculta con un botón.
- TRANSPORTADOR y ESCUADRA: se mueven y rotan; permiten leer y trazar ángulos.
- CORRECCIÓN AUTOMÁTICA DE FORMAS: si el usuario mantiene el lápiz quieto un instante (configurable) al final de un trazo, este se convierte en línea, círculo/elipse, rectángulo o triángulo. Se activa y desactiva desde la barra; no debe interferir con la escritura normal. Se puede deshacer para volver al trazo original.
- LÁPICES FAVORITOS: 3 a 5 ajustes (herramienta, color, grosor, opacidad) personalizables y accesibles a un toque; guardados en el almacén de ajustes.
- Todo sin aumentar la latencia del trazo: mida y reporte la latencia antes y después.

Criterio de aceptación: en una tablet con lápiz se traza un diagrama con regla, se miden ángulos con el transportador y se corrigen formas sin retraso perceptible.
```

### Etapa 25 · Paso 1: prototipo de audio

```text
TAREA: Etapa 25 · PASO 1 · Prototipo de grabación de audio (NO tocar el código principal de la app).

En una carpeta aislada (prototipos/audio) pruebe, usando MediaRecorder:
- Grabar 30 minutos de audio y guardarlo en IndexedDB sin bloquear la interfaz; comportamiento al cambiar de aplicación, bloquear la pantalla o recibir una llamada.
- Qué formato genera cada sistema (iPad/Safari y Android/Chrome suelen producir formatos distintos: determine cuáles y si se reproducen en todos).
- Peso aproximado por minuto y estrategia para limitarlo (calidad configurable).
- Permiso del micrófono: flujo y mensajes ante permiso denegado.
- Sincronización: cómo registrar marcas de tiempo confiables y reproducir desde un instante.

Entregue el prototipo, las mediciones, los riesgos y una recomendación. No avance a la integración hasta que yo lo apruebe.
```

### Etapa 25 · Paso 2: audio sincronizado

```text
TAREA: Etapa 25 · PASO 2 · Audio sincronizado con la escritura (según el prototipo aprobado).

- Botón de grabar y pausar en los tres formatos; mientras se graba, cada trazo, texto o elemento creado queda asociado a su marca de tiempo.
- Reproducción: al tocar un elemento se reproduce el audio desde su momento; barra de reproducción con pausa, avance y velocidad (0,75×, 1×, 1,5×, 2×).
- El audio se guarda en el almacén de archivos (blobs); se incluye en el .nota y en el respaldo, con la opción de «Exportar sin audio». El medidor de espacio lo cuenta; aviso al acercarse al límite.
- Manejo de interrupciones: si el sistema corta la grabación, se conserva lo grabado hasta ese momento.
- Aviso claro de privacidad (la grabación queda solo en el dispositivo) y de consentimiento al grabar a otras personas.
- Duplicar y eliminar documentos no deja audios huérfanos ni borra uno en uso.

Criterio de aceptación: se graba una clase de 30 minutos en la tablet, se toca un trazo del minuto 12 y se escucha ese tramo; el .nota se abre en la PC con el audio.
```

---

## 3. Prompt de auditoría posterior (para cada etapa terminada)

Úselo en una conversación nueva, con el `.zip` resultante adjunto.

```text
Actúe como auditor de código. Adjunto el .zip de «Anotomía» al cerrar la etapa [número y nombre]. Responda en español, con trato formal.

1. Lea apps/notas/ESTADO.md y la sección de esta etapa. Liste lo que dice haber hecho.
2. Verifique en el código, archivo por archivo, que cada punto del alcance realmente existe y está conectado (importado, usado, accesible desde la interfaz). Señale lo que está declarado pero no implementado.
3. Busque errores típicos: variables o funciones sin definir, importaciones a archivos o exportaciones inexistentes, props no pasadas entre componentes, ids o claves duplicados, estados que quedan inconsistentes, eventos sin limpiar, fugas de memoria, y llamadas a APIs no disponibles en Safari o en tablet.
4. Verifique la compatibilidad de datos: ¿se versionó el formato?, ¿se leen los documentos y .nota antiguos?, ¿el respaldo completo incluye los datos nuevos?, ¿hay archivos huérfanos al eliminar o duplicar?
5. Verifique las convenciones: prefijos nt- y --nt-, textos en español formal, botones táctiles de al menos 44 px, accesibilidad con teclado y aria, funcionamiento sin conexión.
6. Si puede ejecutar comandos: npm install, npm run lint, npm test y npm run build; informe los resultados reales. Si no puede, dígalo.
7. Entregue un informe que empiece por el veredicto (apta para aprobar, con observaciones, o no apta), seguido de una lista priorizada de problemas con ruta y línea, y la corrección propuesta. No modifique código salvo que se lo pida.
```

## 4. Prompt de retorno cuando algo falla

```text
La etapa [número] no funciona como se esperaba. Adjunto el .zip actual.
Síntoma: [qué ocurre, en qué dispositivo y navegador, pasos para reproducirlo].
Mensaje de error de la consola, si lo hay: [pegar el texto completo].

Haga primero una auditoría de las partes involucradas, identifique la causa raíz con evidencia del código (no una suposición) y corrija solo lo necesario, sin tocar nada fuera del alcance. Entregue los archivos modificados completos, explique la causa y cómo comprobar que quedó resuelto, y agregue una prueba automática que habría detectado el fallo.
```
