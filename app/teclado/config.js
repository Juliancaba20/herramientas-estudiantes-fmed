// Repositorio único del proyecto: el sitio y el programa del teclado viven aquí.
export const REPO = 'Juliancaba20/herramientas-estudiantes-fmed';

// Nombres de los archivos que genera la compilación (.github/workflows/compilar-teclado.yml).
export const ARCHIVOS = {
  windows: 'TecladoCientifico-Windows.exe',
  mac: 'TecladoCientifico-Mac.zip',
  linux: 'TecladoCientifico-Linux.tar.gz',
};

export const urlRepo = `https://github.com/${REPO}`;

// Enlace que siempre apunta a la última versión publicada, sin importar cómo se llame la etiqueta.
export const urlUltima = (archivo) => `${urlRepo}/releases/latest/download/${archivo}`;
