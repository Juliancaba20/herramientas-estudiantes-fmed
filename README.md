# Herramientas para estudiantes

Sitio gratuito y sin fines de lucro con herramientas para estudiantes, en especial de medicina. Hecho con Next.js (App Router).

- `/` portada con las herramientas
- `/metodos` catálogo de métodos de estudio con nivel de respaldo
- `/teclado` página del Teclado Científico, con las descargas para Windows, Mac y Linux
- `/contacto` formulario para informar errores o enviar sugerencias (llega por mail)

## Estructura del repositorio

Todo el proyecto vive en este único repositorio:

| Carpeta | Contenido |
|---------|-----------|
| `app/` | El sitio (Next.js, App Router): portada, `metodos/`, `teclado/`, `contacto/` y `api/contacto/` |
| `content/metodos/` | Un archivo JSON por método de estudio |
| `public/teclado/` | Imágenes de la página del teclado |
| `apps/teclado/` | Código y íconos del programa de escritorio (Python) |
| `.github/workflows/compilar-teclado.yml` | Compila el programa para Windows, Mac y Linux al publicar un release `teclado-vX.Y` |

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
| `r` | Qué dice la evidencia |

Para corregir o agregar un método, edite o cree un archivo en esa carpeta y abra un pull request indicando la fuente.

## Teclado Científico

La página está en `app/teclado/`: `page.js` (contenido), `Descargas.js` (enlaces de descarga y número de versión) y `config.js` (repositorio y nombres de los archivos). La página enlaza siempre a la última versión publicada en *Releases*, sea cual sea el nombre de su etiqueta. El programa está en `apps/teclado/`; allí se explica cómo publicar una versión nueva (`apps/teclado/LEEME.md`).

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
