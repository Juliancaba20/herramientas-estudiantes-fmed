import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const ruta = new URL('../../../scripts/generar-latest-notas.mjs', import.meta.url);
const hay = existsSync(ruta);
const modulo = hay ? await import(ruta.href) : null;
const base = 'https://github.com/x/y/releases/download/notas-ultima';

test('latest.json incluye cada sistema que tiene firma y apunta a la dirección fija', { skip: !hay }, () => {
  const l = modulo.construirLatest({
    version: '1.2.0', notas: 'mejoras', urlBase: base, fecha: new Date('2026-10-25T12:00:00Z'),
    firmas: { 'Anotomia-Windows.exe': ' firmaWin\n', 'Anotomia-Mac.app.tar.gz': 'firmaMac', 'Anotomia-Linux.AppImage': 'firmaLinux' },
  });
  assert.equal(l.version, '1.2.0');
  assert.equal(l.pub_date, '2026-10-25T12:00:00.000Z');
  assert.deepEqual(Object.keys(l.platforms).sort(), ['darwin-aarch64', 'darwin-x86_64', 'linux-x86_64', 'windows-aarch64', 'windows-x86_64']);
  assert.deepEqual(l.platforms['windows-x86_64'], { signature: 'firmaWin', url: `${base}/Anotomia-Windows.exe` });
  assert.equal(l.platforms['darwin-aarch64'].url, l.platforms['darwin-x86_64'].url, 'un solo programa de Mac sirve para los dos chips');
});

test('si un sistema no se compiló, no aparece (y sus usuarios no reciben un enlace roto)', { skip: !hay }, () => {
  const l = modulo.construirLatest({ version: '1.2.0', urlBase: base, firmas: { 'Anotomia-Windows.exe': 'f' } });
  assert.deepEqual(Object.keys(l.platforms).sort(), ['windows-aarch64', 'windows-x86_64']);
});

test('sin ninguna firma no se arma nada', { skip: !hay }, () => {
  assert.throws(() => modulo.construirLatest({ version: '1.2.0', urlBase: base, firmas: {} }), /ningún programa firmado/);
});
