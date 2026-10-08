# Herramientas para estudiantes

Sitio gratuito y sin fines de lucro con herramientas para estudiantes, en especial de medicina. Hecho con Next.js (App Router).

- `/` portada con las herramientas
- `/metodos` catálogo de métodos de estudio con nivel de respaldo
- `/teclado` página del Teclado Científico, con las descargas para Windows, Mac y Linux

## Estructura del repositorio

Todo el proyecto vive en este único repositorio:

| Carpeta | Contenido |
|---------|-----------|
| `app/` | El sitio (Next.js, App Router): portada, `metodos/` y `teclado/` |
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

La página está en `app/teclado/`: `page.js` (contenido), `Descargas.js` (detección del sistema y de la última versión) y `config.js` (repositorio y versión de respaldo). El programa está en `apps/teclado/`; allí se explica cómo publicar una versión nueva (`apps/teclado/LEEME.md`).

## Publicación

Vercel detecta Next.js sin configuración adicional. Para que las vistas previas al compartir el enlace usen el dominio propio, defina la variable de entorno `NEXT_PUBLIC_SITE_URL` (por defecto usa `https://herramientas-estudiantes-fmed.vercel.app`).
