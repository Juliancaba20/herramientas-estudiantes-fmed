import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  REPO, PROGRAMAS, ETIQUETA_ULTIMA, urlDescarga, urlApiUltima, urlActualizaciones,
  esProgramaEscritorio, esProgramaDeComputadora, detectarSistema, programaQueAdmite, ofertaDeInstalacion,
  consultarPublicacion, hayProgramaPublicado,
} from '../src/pwa/escritorio.js';

const UA = {
  win11: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
  win10firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0',
  winArm: 'Mozilla/5.0 (Windows NT 10.0; ARM64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  win7: 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
  win81: 'Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
  win32bits: 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
  win32enWow: 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  ipadEscritorio: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  android: 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  linux: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  linuxArm: 'Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  chromebook: 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
};
const nav = (userAgent, maxTouchPoints = 0) => ({ userAgent, maxTouchPoints });

test('detectarSistema reconoce cada sistema, incluido el iPad que se presenta como Mac', () => {
  assert.equal(detectarSistema(nav(UA.win11)), 'windows');
  assert.equal(detectarSistema(nav(UA.mac)), 'mac');
  assert.equal(detectarSistema(nav(UA.ipadEscritorio, 5)), 'ios');
  assert.equal(detectarSistema(nav(UA.ipad, 5)), 'ios');
  assert.equal(detectarSistema(nav(UA.iphone, 5)), 'ios');
  assert.equal(detectarSistema(nav(UA.android, 5)), 'android');
  assert.equal(detectarSistema(nav(UA.linux)), 'linux');
  assert.equal(detectarSistema(nav(UA.chromebook)), 'otro');
  assert.equal(detectarSistema(undefined), null);
  assert.equal(detectarSistema({}), null);
});

test('cada sistema que admite un programa recibe el suyo', () => {
  assert.equal(programaQueAdmite(nav(UA.win11)), 'windows');
  assert.equal(programaQueAdmite(nav(UA.win10firefox)), 'windows');
  assert.equal(programaQueAdmite(nav(UA.winArm)), 'windows');
  assert.equal(programaQueAdmite(nav(UA.win11, 10)), 'windows', 'una tablet con Windows también usa el programa');
  assert.equal(programaQueAdmite(nav(UA.win32enWow)), 'windows', 'navegador de 32 bits sobre Windows de 64');
  assert.equal(programaQueAdmite(nav(UA.mac)), 'mac');
  assert.equal(programaQueAdmite(nav(UA.linux)), 'linux');
  assert.equal(programaQueAdmite(nav(UA.android, 5)), 'android');
});

test('lo que no admite programa queda con la versión web', () => {
  for (const [nombre, ua, tactiles] of [
    ['Windows 7', UA.win7, 0], ['Windows 8.1', UA.win81, 0], ['Windows de 32 bits', UA.win32bits, 0],
    ['iPad', UA.ipad, 5], ['iPad con sitio de escritorio', UA.ipadEscritorio, 5], ['iPhone', UA.iphone, 5],
    ['Linux con ARM', UA.linuxArm, 0], ['Chromebook', UA.chromebook, 0],
  ]) {
    assert.equal(programaQueAdmite(nav(ua, tactiles)), null, nombre);
    assert.deepEqual(ofertaDeInstalacion({ nav: nav(ua, tactiles), win: {} }), { tipo: 'web' }, nombre);
  }
  assert.deepEqual(ofertaDeInstalacion({ nav: undefined, win: {} }), { tipo: 'web' }, 'sin datos del navegador se ofrece la web');
});

test('la oferta es el programa del sistema y nunca la instalación web', () => {
  assert.deepEqual(ofertaDeInstalacion({ nav: nav(UA.win11), win: {} }), { tipo: 'programa', plataforma: 'windows' });
  assert.deepEqual(ofertaDeInstalacion({ nav: nav(UA.mac), win: {} }), { tipo: 'programa', plataforma: 'mac' });
  assert.deepEqual(ofertaDeInstalacion({ nav: nav(UA.linux), win: {} }), { tipo: 'programa', plataforma: 'linux' });
  assert.deepEqual(ofertaDeInstalacion({ nav: nav(UA.android, 5), win: {} }), { tipo: 'programa', plataforma: 'android' });
});

test('dentro del programa no se ofrece descargar nada', () => {
  for (const marca of [{ isTauri: true }, { __TAURI_INTERNALS__: {} }, { __TAURI__: {} }]) {
    assert.equal(esProgramaEscritorio(marca), true);
    assert.deepEqual(ofertaDeInstalacion({ nav: nav(UA.win11), win: marca }), { tipo: 'instalado' });
  }
  assert.equal(esProgramaEscritorio({}), false);
  assert.equal(esProgramaEscritorio(undefined), false);
});

test('el programa de computadora tiene archivos reales; el de Android no', () => {
  const tauri = { __TAURI_INTERNALS__: {} };
  assert.equal(esProgramaDeComputadora(tauri, nav(UA.win11)), true);
  assert.equal(esProgramaDeComputadora(tauri, nav(UA.mac)), true);
  assert.equal(esProgramaDeComputadora(tauri, nav(UA.linux)), true);
  assert.equal(esProgramaDeComputadora(tauri, nav(UA.android, 5)), false);
  assert.equal(esProgramaDeComputadora({}, nav(UA.win11)), false, 'en un navegador no hay archivos reales');
});

test('las direcciones de descarga son fijas y no dependen de la etiqueta de cada versión', () => {
  assert.deepEqual(Object.keys(PROGRAMAS), ['windows', 'mac', 'linux', 'android']);
  for (const [clave, p] of Object.entries(PROGRAMAS)) {
    assert.equal(urlDescarga(clave), `https://github.com/${REPO}/releases/download/${ETIQUETA_ULTIMA}/${p.archivo}`);
    assert.ok(p.archivo.endsWith(p.tipo), `${p.archivo} debe terminar en ${p.tipo}`);
  }
  assert.equal(urlApiUltima, `https://api.github.com/repos/${REPO}/releases/tags/${ETIQUETA_ULTIMA}`);
  assert.equal(urlActualizaciones, `https://github.com/${REPO}/releases/download/${ETIQUETA_ULTIMA}/latest.json`);
});

test('consultarPublicacion distingue sin publicar, publicado y sin conexión', async () => {
  const resp = (status, cuerpo) => async () => ({ status, ok: status >= 200 && status < 300, json: async () => cuerpo });
  assert.equal((await consultarPublicacion(resp(404, {}))).estado, 'sin-publicar');
  const ok = await consultarPublicacion(resp(200, { name: 'Anotomía - versión 1.4', assets: [{ name: 'Anotomia-Windows.exe' }, { name: 'latest.json' }] }));
  assert.equal(ok.estado, 'publicado');
  assert.equal(ok.version, '1.4');
  assert.equal(hayProgramaPublicado(ok, 'windows'), true);
  assert.equal(hayProgramaPublicado(ok, 'android'), false, 'falta el .apk en la publicación');
  const caido = await consultarPublicacion(async () => { throw new Error('sin red'); });
  assert.equal(caido.estado, 'publicado');
  assert.equal(hayProgramaPublicado(caido, 'mac'), true, 'si no se pudo consultar, el enlace se muestra igual');
  assert.equal((await consultarPublicacion(resp(403, {}))).estado, 'publicado', 'límite de GitHub');
});

// El nombre del archivo y la etiqueta fija viven en la app y en el flujo de compilación; la web importa el mismo módulo.
const leer = (ruta) => { const u = new URL(ruta, import.meta.url); return existsSync(u) ? readFileSync(u, 'utf-8') : null; };

test('la web usa el mismo módulo que la app y los flujos de compilación usan los mismos nombres', () => {
  const web = leer('../../../app/notas/Descargas.js');
  const flujo = leer('../../../.github/workflows/compilar-notas.yml');
  const flujoAndroid = leer('../../../.github/workflows/compilar-notas-android.yml');
  if (web === null || flujo === null) return; // la app se probó fuera del repositorio completo
  assert.match(web, /from '\.\.\/\.\.\/apps\/notas\/src\/pwa\/escritorio\.js'/, 'la web no debe repetir las constantes');
  assert.ok(flujo.includes(`ETIQUETA_ULTIMA: ${ETIQUETA_ULTIMA}`), 'el flujo debe publicar en la misma etiqueta fija');
  for (const clave of ['windows', 'mac', 'linux']) assert.ok(flujo.includes(PROGRAMAS[clave].archivo), `el flujo debe producir ${PROGRAMAS[clave].archivo}`);
  assert.ok(flujo.includes('latest.json'));
  assert.ok(flujoAndroid.includes(PROGRAMAS.android.archivo), 'el flujo de Android debe producir el .apk con el mismo nombre');
  assert.ok(flujoAndroid.includes(ETIQUETA_ULTIMA));
});

test('el programa de escritorio no registra el service worker ni muestra «Instalar»', () => {
  const pwa = leer('../src/pwa/pwa.js');
  assert.match(pwa, /produccion:\s*import\.meta\.env\.PROD && !esProgramaEscritorio\(\)/);
});

test('la configuración de Tauri conserva los datos, deja pasar el arrastre y activa las actualizaciones', () => {
  const texto = leer('../src-tauri/tauri.conf.json');
  if (texto === null) return;
  const c = JSON.parse(texto);
  const ventana = c.app.windows[0];
  assert.equal(ventana.dragDropEnabled, false, 'sin esto Windows bloquea arrastrar archivos .nota a la ventana');
  assert.equal(ventana.useHttpsScheme, true, 'fija el origen de IndexedDB: cambiarlo después dejaría las notas inaccesibles');
  assert.equal(c.identifier, 'io.github.juliancaba20.anotomia', 'el identificador fija la carpeta de datos: no debe cambiar entre versiones');
  assert.equal(c.bundle.windows.nsis.installMode, 'currentUser');
  assert.equal(c.bundle.createUpdaterArtifacts, true);
  assert.equal(c.plugins.updater.endpoints[0], urlActualizaciones, 'el actualizador debe leer el mismo latest.json que publica el flujo');
  assert.deepEqual(c.bundle.fileAssociations[0].ext, ['nota']);
});

test('los permisos de computadora y de Android están separados (el actualizador no existe en Android)', () => {
  const pc = leer('../src-tauri/capabilities/principal.json');
  const android = leer('../src-tauri/capabilities/android.json');
  if (pc === null || android === null) return;
  const permisosPc = JSON.parse(pc).permissions;
  const permisosAndroid = JSON.parse(android).permissions;
  assert.ok(permisosPc.includes('updater:default') && permisosPc.includes('process:allow-restart'));
  assert.ok(!permisosAndroid.some((p) => p.startsWith('updater') || p.startsWith('process')));
  assert.deepEqual(JSON.parse(android).platforms, ['android']);
});
