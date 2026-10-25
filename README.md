# Herramientas para estudiantes

Sitio gratuito y sin fines de lucro con herramientas para estudiantes, en especial de medicina. Hecho con Next.js (App Router).

- `/` portada con las herramientas
- `/metodos` catálogo de métodos de estudio con nivel de respaldo (lo básico de cada uno)
- `/metodos/<método>` página de cada método con la información completa (se genera sola desde `content/metodos/`)
- `/teclado` página del Teclado Científico, con las descargas para Windows, Mac y Linux
- `/notas` página de Anotomía, la app de notas: muestra todas las versiones a la vista, como el Teclado (Windows .exe, Mac .dmg, Linux .AppImage, Android .apk y la versión online) con la de su dispositivo resaltada; la app está en `/notas/app/index.html`
- `/contacto` formulario para informar errores o enviar sugerencias (llega por mail)

## Estructura del repositorio

Todo el proyecto vive en este único repositorio:

| Carpeta | Contenido |
|---------|-----------|
| `app/` | El sitio (Next.js, App Router): portada, `metodos/`, `teclado/`, `notas/`, `contacto/` y `api/contacto/` |
| `apps/notas/` | Código de Anotomía (Vite + React) y, en `apps/notas/src-tauri/`, los programas de Windows, Mac, Linux y Android (Tauri) |
| `public/notas/app/` | Anotomía ya compilada (se genera sola en cada `npm run build`; no se sube) |
| `scripts/` | `publicar-notas.mjs`, que compila Anotomía y la copia a `public/` |
| `content/metodos/` | Un archivo JSON por método de estudio |
| `public/teclado/` | Imágenes de la página del teclado |
| `apps/teclado/` | Código y íconos del programa de escritorio (Python) |
| `.github/workflows/compilar-teclado.yml` | Compila el programa para Windows, Mac y Linux al publicar un release `teclado-vX.Y` |
| `.github/workflows/compilar-notas.yml` | Compila Anotomía para Windows, Mac y Linux, firma las actualizaciones y publica en `notas-ultima` al subir una etiqueta `notas-vX.Y` |
| `.github/workflows/compilar-notas-android.yml` | Compila y firma el .apk de Anotomía para Android con la misma etiqueta |
| `scripts/generar-latest-notas.mjs` | Arma el `latest.json` que consultan los programas para actualizarse |

Para sumar otra herramienta: una carpeta nueva en `app/` para su página y, si tiene programa propio, otra en `apps/`.

## Desarrollo

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # compila y valida el sitio
```

## Contenido de los métodos

Cada método es un archivo JSON en `content/metodos/` (el prefijo numérico fija el orden).

| Campo | Descripción |
|-------|-------------|
| `n` | Nombre |
| `q` | Descripción en una línea |
| `l` | Respaldo: 0 variable, 1 limitado, 2 moderado, 3 sólido |
| `t` | Situaciones: `poco`, `memorizar`, `comprender`, `grupo` |
| `e` | Esfuerzo |
| `u` | Para qué sirve |
| `p` | Pasos (lista) |
| `f` | Dónde falla |
| `r` | Qué dice la evidencia (resumen) |
| `x` | Ejemplo aplicado a medicina (opcional) |
| `c` | Consejos para aplicarlo mejor (lista, opcional) |
| `d` | Datos de la investigación: estudios, tamaños de muestra y de efecto (lista, opcional) |
| `m` | Métodos que combinan bien: identificadores, es decir el nombre del archivo sin el número ni `.json` (lista, opcional) |
| `s` | Fuentes: lista de objetos `{ "t": "cita", "u": "enlace opcional" }` (opcional) |

Para corregir o agregar un método, edite o cree un archivo en esa carpeta y abra un pull request indicando la fuente.

## Teclado Científico

La página está en `app/teclado/`: `page.js` (contenido), `Descargas.js` (enlaces de descarga y número de versión) y `config.js` (repositorio y nombres de los archivos). La página enlaza siempre a la última versión publicada en *Releases*, sea cual sea el nombre de su etiqueta. El programa está en `apps/teclado/`; allí se explica cómo publicar una versión nueva (`apps/teclado/LEEME.md`).

## Anotomía (app de notas)

Son dos cosas separadas:

- `/notas` (`app/notas/page.js`): página de presentación, con el tema azul (`data-tema="notas"` en `app/globals.css`). La constante `DISPONIBLE` de ese archivo decide si muestra el aviso «en desarrollo» (`false`) o las descargas (`true`, componente `app/notas/Descargas.js`).
- `/notas/app/index.html`: la app en sí, un sitio estático independiente (Vite + React) que no comparte estilos ni diseño con el resto de la web. Su código está en `apps/notas/` (ver `apps/notas/ESTADO.md`) y lo que se publica es su compilación, `public/notas/app/`. La dirección `/notas/app` redirige a `/notas/app/index.html` (`next.config.mjs`).

### Programas de Anotomía (Windows, Mac, Linux y Android)

Qué se ofrece a cada dispositivo (regla en `apps/notas/src/pwa/escritorio.js`). La página `/notas` muestra todas las versiones y resalta la del dispositivo («Recomendado para su equipo»); el modal «Instalar» de la app, que se abre desde la propia app, ofrece solo la que corresponde:

| Dispositivo | Única descarga |
|---|---|
| Windows 10 u 11 de 64 bits | `Anotomia-Windows.exe` |
| Mac (chip Apple o Intel) | `Anotomia-Mac.dmg` |
| Linux de 64 bits (x86_64) | `Anotomia-Linux.AppImage` |
| Android | `Anotomia-Android.apk` |
| iPad, iPhone, Chromebook, Windows 7/8 o de 32 bits, Linux con ARM | instalación de la versión web (PWA), desde `/notas/app/index.html#instalar` |

Si el programa de un sistema todavía no está publicado, la página y el modal lo avisan y ofrecen la versión web mientras tanto. Dentro de los programas no se registra el service worker ni aparece «Instalar».

**Cómo trabajan con los archivos.** En Windows, Mac y Linux las notas son archivos `.nota` reales, como en Word: «Guardar como archivo…» (menú de la nota o botón de exportar del editor) elige dónde, y desde ese momento cada cambio se escribe también en ese archivo (con una espera de menos de un segundo; no hay que acordarse de guardar). Ctrl+S fuerza el guardado. «Abrir…» abre archivos del disco, y el doble clic sobre un `.nota` abre Anotomía con ese documento (si el programa ya estaba abierto, lo abre en la misma ventana). Al cerrar un documento que todavía no es un archivo, el programa ofrece guardarlo. La biblioteca interna sigue siendo la copia de trabajo: si un archivo se borra o se mueve, la nota no se pierde, y el programa lo avisa al abrirse. En Android las notas se guardan dentro de la aplicación y «Exportar» guarda una copia donde la persona elija.

**Publicar una versión nueva** (la misma etiqueta compila todos los sistemas):

1. Subir los cambios de `apps/notas/` al repositorio.
2. Crear y subir una etiqueta con el número de versión: `git tag notas-v1.1` y `git push origin notas-v1.1`.
3. En la pestaña *Actions* corren «Compilar Anotomía (Windows, Mac y Linux)» y «Compilar Anotomía para Android (.apk)» (la primera vez tardan 10 a 20 minutos). Al terminar reemplazan los archivos de la publicación fija `notas-ultima`, y la web enlaza siempre a esa dirección: no hay que tocar la web. Si un sistema falla, los demás se publican igual.

Para probar la compilación sin publicar nada: *Actions > (el flujo) > Run workflow*; los archivos quedan adjuntos a esa ejecución.

#### Actualizaciones automáticas (preparar una sola vez)

Los programas de Windows, Mac y Linux buscan versiones nuevas al abrirse (y cada 6 horas), avisan, guardan todo y se reinician solos al instalarlas. Cada versión va firmada con una clave propia (no es el certificado de pago de Windows ni de Apple: SmartScreen y Gatekeeper siguen avisando la primera vez). Preparación:

1. En una terminal, dentro de `apps/notas`: `npx --yes @tauri-apps/cli@2.12.4 signer generate -w anotomia-actualizaciones.key`. Pide una contraseña (elíjala y anótela). Crea dos archivos: `anotomia-actualizaciones.key` (privada) y `anotomia-actualizaciones.key.pub` (pública).
2. Abrir el `.key.pub`, copiar todo su contenido y pegarlo en `apps/notas/src-tauri/tauri.conf.json`, reemplazando `REEMPLAZAR_CON_LA_CLAVE_PUBLICA_DEL_ACTUALIZADOR` (campo `plugins > updater > pubkey`).
3. En GitHub: *Settings > Secrets and variables > Actions > New repository secret*. Crear `TAURI_SIGNING_PRIVATE_KEY` (todo el contenido del archivo `.key`) y `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (la contraseña).
4. **Guardar el archivo `.key` y la contraseña en un lugar seguro y no subirlos nunca al repositorio** (el `.gitignore` ya los excluye). Si se pierden, los programas ya instalados no podrán actualizarse más y habría que pedir que vuelvan a descargarlos.

Hasta completar los pasos 2 y 3, las etiquetas `notas-v…` fallan a propósito con un mensaje claro (publicar sin la clave dejaría programas que nunca podrían actualizarse); las ejecuciones manuales de prueba sí compilan, sin actualizador.

#### Anotomía para Android (.apk)

Android solo instala un `.apk` firmado y solo lo actualiza si siempre lo firma la misma clave. Preparación única:

1. Crear la clave (hace falta Java; viene con Android Studio): `keytool -genkeypair -v -keystore anotomia.jks -alias anotomia -keyalg RSA -keysize 2048 -validity 10000`. Pide una contraseña.
2. Convertirla a texto. En Windows (PowerShell): `[Convert]::ToBase64String([IO.File]::ReadAllBytes("anotomia.jks")) | Set-Clipboard`. En Mac o Linux: `base64 -w0 anotomia.jks`.
3. En GitHub, crear estos secretos: `ANDROID_KEYSTORE_BASE64` (el texto anterior), `ANDROID_KEYSTORE_PASSWORD` (contraseña del paso 1), `ANDROID_KEY_ALIAS` (`anotomia`) y `ANDROID_KEY_PASSWORD` (la misma contraseña, salvo que haya puesto otra para la clave).
4. Guardar `anotomia.jks` y las contraseñas en un lugar seguro (mismo cuidado que la otra clave).

El programa de Android no se actualiza solo: para actualizar se descarga el `.apk` nuevo desde `/notas` y se instala encima (las notas se conservan). Esta es la parte menos probada del proyecto: no se pudo compilar un `.apk` durante el desarrollo, y es probable que la primera ejecución del flujo pida un ajuste.

Para publicar una versión nueva de la app basta con subir los archivos modificados de `apps/notas/` al repositorio, como cualquier otro cambio de la web: en cada despliegue, `npm run build` compila Anotomía (`scripts/publicar-notas.mjs`) y después el sitio, así que Vercel siempre publica la última versión de la app. `public/notas/app/` se genera solo y no se sube a GitHub. Para probar el resultado en su PC: `npm run build` y luego `npm start`. Para recompilar solo la app: `npm run publicar:notas`.

## Formulario de contacto

`/contacto` envía el mensaje a `app/api/contacto/route.js`, que lo reenvía por mail con [Resend](https://resend.com) (plan gratuito). Para activarlo:

1. Crear una cuenta en Resend y generar una clave en *API Keys*.
2. En Vercel, *Settings > Environment Variables*, cargar `RESEND_API_KEY` (la clave) y `CONTACT_TO` (el correo donde se quieren recibir los mensajes). Hay un ejemplo en `.env.example`.
3. Volver a desplegar (*Deployments > Redeploy*).

Sin un dominio verificado en Resend, el remitente es `onboarding@resend.dev` y los mensajes solo pueden llegar al correo con el que se creó la cuenta de Resend. Si la persona deja su correo, al responder el mail se contesta directamente a ella.

## Íconos e imagen para compartir

Siguen las convenciones de Next.js en `app/`: `icon.svg` y `favicon.ico` (pestaña del navegador), `apple-icon.png` (pantalla de inicio del iPhone) y `opengraph-image.jpg` / `twitter-image.jpg` (vista previa al compartir el enlace, 1200 × 630). El logo del encabezado es `app/Logo.js`, el mismo dibujo que `icon.svg`.

## Publicación

Vercel detecta Next.js sin configuración adicional. Para que las vistas previas al compartir el enlace usen el dominio propio, defina la variable de entorno `NEXT_PUBLIC_SITE_URL` (por defecto usa `https://herramientas-estudiantes-fmed.vercel.app`).
