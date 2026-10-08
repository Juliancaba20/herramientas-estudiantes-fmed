# Herramientas para estudiantes

Sitio gratuito y sin fines de lucro con herramientas para estudiantes, en especial de medicina. Hecho con Next.js (App Router).

- `/` portada con las herramientas
- `/metodos` catálogo de métodos de estudio con nivel de respaldo
- `/teclado` página del Teclado Científico, con las descargas para Windows, Mac y Linux (los instaladores se publican como *Releases* del repositorio [Teclado-Griego](https://github.com/Juliancaba20/Teclado-Griego); la página enlaza siempre a la última versión)

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

La página está en `app/teclado/` (`page.js` con el contenido y `Descargas.js` con la detección del sistema y la versión). Las imágenes están en `public/teclado/`. Si cambia el repositorio de los instaladores, edite la constante `REPO` en `app/teclado/Descargas.js` y los enlaces de `page.js`.

## Publicación

Vercel detecta Next.js sin configuración adicional. Para que las vistas previas al compartir el enlace usen el dominio propio, defina la variable de entorno `NEXT_PUBLIC_SITE_URL` (por defecto usa `https://herramientas-estudiantes-fmed.vercel.app`).
