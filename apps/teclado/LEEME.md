# Teclado Científico (programa de escritorio)

Teclado flotante para escribir letras griegas y símbolos con un clic. Funciona en Windows, Mac y Linux. La página de descargas es parte del sitio: `app/teclado/` en la raíz de este repositorio (ruta `/teclado`).

## Contenido de esta carpeta

- `teclado_griego.py`: el programa.
- `icono.png`, `icono.ico`, `icono.icns`: íconos para cada sistema.
- La compilación automática está en `.github/workflows/compilar-teclado.yml` (raíz del repositorio).

## Publicar una versión nueva

1. Modifique `teclado_griego.py` y actualice la constante `VERSION` (por ejemplo `"1.5"`). Suba el cambio a GitHub.
2. En GitHub: *Releases > Draft a new release*. En *Choose a tag* escriba `teclado-v1.5` (la etiqueta debe empezar con `teclado-v` y terminar con el número de versión), elija *Create new tag* y luego *Publish release*.
3. Espere unos 5 minutos y revise la pestaña *Actions*: deben aparecer tres tareas en verde (Windows, macOS, Linux). Al terminar, los tres archivos quedan adjuntos al release: `TecladoCientifico-Windows.exe`, `TecladoCientifico-Mac.zip` y `TecladoCientifico-Linux.tar.gz`.
4. La página `/teclado` enlaza siempre a la última versión publicada y toma el número de la etiqueta. No hay que editar nada en el sitio.

Notas:
- La compilación usa el código que existe **en el momento de crear la etiqueta**. Por eso conviene subir primero el cambio del programa (paso 1) y recién después publicar el release.
- Si un release quedó mal (archivos con otro nombre o de una versión equivocada), bórrelo junto con su etiqueta (*Releases > Delete*, y luego *Tags* para borrar la etiqueta) y vuelva a crearlo.
- También puede ejecutar la compilación a mano desde *Actions > Compilar Teclado Científico > Run workflow*, eligiendo una etiqueta existente.

## Uso del teclado

- **Escribir:** haga clic en un símbolo y se escribe donde esté el cursor. Al pasar el mouse por encima, la barra superior muestra su nombre.
- **Recientes:** la fila de arriba repite los últimos 9 símbolos usados.
- **Modo compacto:** el botón `▴` deja solo la barra y la fila de recientes; `▾` lo expande (elegir una pestaña también lo expande).
- **Ocultar y mostrar:** con el atajo **Ctrl+Alt+G** (solo Windows y Linux con X11). Si el teclado no aparece, pruebe el atajo: puede estar oculto.
- **Si no puede escribir** (por ejemplo, en un programa que se ejecuta como administrador), el teclado lo avisa y copia el símbolo para pegarlo con Ctrl+V.

### Cambiar el atajo

El programa guarda su configuración en un archivo `config.json`:

- Windows: `%APPDATA%\TecladoCientifico\config.json`
- Mac: `~/Library/Application Support/TecladoCientifico/config.json`
- Linux: `~/.config/TecladoCientifico/config.json`

Con el programa cerrado, edite la línea `"atajo"`. Formato: modificadores (`ctrl`, `alt`, `shift`, `win`) más una letra, número o tecla F1 a F12, unidos con `+`; por ejemplo `"ctrl+shift+k"` o `"ctrl+alt+f9"`. Con `""` el atajo queda desactivado.

## Importante

- La versión de Windows es la más probable que funcione sin ajustes. Las de Mac y Linux no pudieron probarse y deben considerarse en prueba.
- Si una de las tres compilaciones falla, las otras igualmente se publican.
- Mac: la aplicación se compila para chips M1 o posteriores. En Mac con procesador Intel no funcionará.
- Linux: solo funciona en X11; en Wayland el sistema suele bloquear la escritura en otras aplicaciones.
