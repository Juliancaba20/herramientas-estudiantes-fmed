// Textos de las descargas, compartidos por la web (/notas) y por el modal «Instalar» de la app.
// Sin React ni navegador: son solo datos.

export const DESCRIPCION = {
  windows: 'Programa (.exe) para Windows 10 y 11 de 64 bits. Se abre con doble clic y funciona sin conexión.',
  mac: 'Programa (.dmg) para Mac con chip Apple o Intel. Funciona sin conexión.',
  linux: 'Programa (.AppImage) para Linux de 64 bits. Funciona sin conexión.',
  android: 'Aplicación (.apk) para celulares y tablets Android. Funciona sin conexión.',
};

// Pasos de la primera vez. Ninguna de las descargas está firmada por un desarrollador reconocido (el certificado
// cuesta dinero cada año), por eso cada sistema muestra su aviso de seguridad.
export const PRIMERA_VEZ = {
  windows: [
    'Abra el archivo descargado con doble clic.',
    'Si aparece «Windows protegió su PC», elija «Más información» y luego «Ejecutar de todas formas». El programa no tiene firma digital, por eso Windows avisa. Algunos antivirus pueden advertir lo mismo.',
    'Siga los pasos del instalador. Anotomía quedará en el menú Inicio.',
  ],
  mac: [
    'Abra el archivo .dmg descargado y arrastre Anotomía a la carpeta Aplicaciones.',
    'Abra Anotomía desde Aplicaciones. Si macOS dice que no puede comprobar que está libre de software malicioso, cierre el aviso, abra «Ajustes del Sistema», entre en «Privacidad y seguridad», baje hasta el aviso de Anotomía y pulse «Abrir igualmente». Es necesario solo la primera vez.',
  ],
  linux: [
    'Haga ejecutable el archivo: clic derecho, «Propiedades», «Permisos» y marque «Permitir ejecutar como un programa» (o, en la terminal, chmod +x Anotomia-Linux.AppImage).',
    'Ábralo con doble clic. Si no abre, instale FUSE 2 (en Ubuntu y Debian: sudo apt install libfuse2).',
  ],
  android: [
    'Abra el archivo .apk descargado (desde la notificación de descarga o desde la app «Archivos»).',
    'Android pedirá permiso para instalar aplicaciones desde esa fuente (el navegador o «Archivos»): actívelo solo para esta instalación.',
    'Si aparece un aviso de Play Protect porque la aplicación no viene de Play Store, elija «Instalar de todos modos».',
  ],
};

export const DONDE_GUARDA = {
  computadora: 'Sus notas se guardan como archivos .nota en la carpeta que usted elija («Guardar como archivo…»), igual que en Word, y se abren con doble clic. Mientras escribe, el archivo se guarda solo.',
  android: 'Sus notas se guardan dentro de la aplicación. Para tener una copia o pasarla a otro dispositivo, guárdela como archivo .nota desde «Exportar».',
};

export const ACTUALIZACION = {
  computadora: 'Se actualiza sola: el programa avisa cuando hay una versión nueva y la instala cuando usted lo decide.',
  android: 'Para actualizar, descargue de nuevo el archivo desde esta misma página e instálelo encima: sus notas se conservan.',
};

export const NOTAS_DEL_NAVEGADOR = 'Las notas guardadas en el navegador no pasan solas al programa. Antes de instalarlo, abra Anotomía en el navegador, entre en «Copias y espacio» y descargue la copia completa; después, en el programa, use «Abrir…» y elija ese archivo.';
