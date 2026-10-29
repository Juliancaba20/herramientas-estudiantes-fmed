"""Pruebas de la actualización automática del Teclado Científico (no necesitan internet).

Uso (desde apps/teclado):   python -m unittest pruebas.probar_actualizacion -v
En Linux sin pantalla:      xvfb-run -a python -m unittest pruebas.probar_actualizacion -v
"""
import hashlib
import io
import json
import os
import sys
import tarfile
import tempfile
import time
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import teclado_griego as tg  # noqa: E402

def leer(ruta, modo="r"):
    with open(ruta, modo) as f:
        return f.read()


def escribir(ruta, texto):
    with open(ruta, "w") as f:
        f.write(texto)


URL = tg.PREFIJO_DESCARGA + "teclado-v1.5/"


def publicacion(etiqueta, archivo, contenido=b"", **extra):
    activo = {"name": archivo, "state": "uploaded", "browser_download_url": URL + archivo,
              "size": len(contenido), "digest": "sha256:" + hashlib.sha256(contenido).hexdigest()}
    pub = {"tag_name": etiqueta, "draft": False, "prerelease": False, "html_url": "https://github.com/x/y/releases/tag/" + etiqueta,
           "assets": [activo]}
    pub.update(extra)
    return pub


class Respuesta(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


class Versiones(unittest.TestCase):
    ARCH = "TecladoCientifico-Windows.exe"

    def test_elige_la_mas_nueva_y_compara_numeros(self):
        pubs = [publicacion("teclado-v1.9", self.ARCH), publicacion("teclado-v1.10", self.ARCH),
                publicacion("Teclado-científico-v1.4", self.ARCH)]
        self.assertEqual(tg.elegir_version(pubs, self.ARCH, "1.4")["version"], "1.10")

    def test_no_ofrece_la_misma_ni_una_anterior(self):
        pubs = [publicacion("teclado-v1.5", self.ARCH), publicacion("teclado-v1.2", self.ARCH)]
        self.assertIsNone(tg.elegir_version(pubs, self.ARCH, "1.5"))

    def test_ignora_otras_publicaciones_borradores_y_pruebas(self):
        pubs = [publicacion("notas-ultima", self.ARCH), publicacion("teclado-v2.0", self.ARCH, draft=True),
                publicacion("teclado-v2.1", self.ARCH, prerelease=True), publicacion("v9", self.ARCH),
                publicacion("teclado-v1.0-beta", self.ARCH)]
        self.assertIsNone(tg.elegir_version(pubs, self.ARCH, "1.4"))

    def test_exige_el_archivo_del_sistema_y_una_url_del_repositorio(self):
        self.assertIsNone(tg.elegir_version([publicacion("teclado-v1.5", "otro.exe")], self.ARCH, "1.4"))
        pub = publicacion("teclado-v1.5", self.ARCH)
        pub["assets"][0]["browser_download_url"] = "https://sitio-ajeno.com/" + self.ARCH
        self.assertIsNone(tg.elegir_version([pub], self.ARCH, "1.4"))

    def test_acepta_el_repositorio_renombrado_pero_solo_en_github(self):
        pub = publicacion("teclado-v9.0", self.ARCH)
        pub["assets"][0]["browser_download_url"] = "https://github.com/Juliancaba20/hipocampus/releases/download/teclado-v9.0/" + self.ARCH
        self.assertEqual(tg.elegir_version([pub], self.ARCH, "1.4")["version"], "9.0")
        pub["assets"][0]["browser_download_url"] = "https://github.com.falso.com/a/b/releases/download/x/" + self.ARCH
        self.assertIsNone(tg.elegir_version([pub], self.ARCH, "1.4"))
        pub["assets"][0]["browser_download_url"] = "http://github.com/a/b/releases/download/x/" + self.ARCH
        self.assertIsNone(tg.elegir_version([pub], self.ARCH, "1.4"))

    def test_datos_invalidos_no_rompen(self):
        self.assertIsNone(tg.elegir_version({"a": 1}, self.ARCH, "1.4"))
        self.assertIsNone(tg.elegir_version([None, 3, {"tag_name": None}], self.ARCH, "1.4"))

    def test_consulta_con_respuesta_simulada(self):
        cuerpo = json.dumps([publicacion("teclado-v9.0", tg.ARCHIVOS_ACTUALIZACION[tg.SISTEMA], b"abc")]).encode()
        info = tg.consultar_actualizacion(abrir=lambda pedido, timeout: Respuesta(cuerpo))
        self.assertEqual(info["version"], "9.0")
        self.assertEqual(info["sha256"], hashlib.sha256(b"abc").hexdigest())


class Descarga(unittest.TestCase):
    def setUp(self):
        self.carpeta = tempfile.mkdtemp()
        self.sistema = tg.SISTEMA

    def tearDown(self):
        tg.SISTEMA = self.sistema

    def info(self, contenido):
        return {"url": URL + "x", "tamano": len(contenido), "sha256": hashlib.sha256(contenido).hexdigest()}

    def abrir(self, contenido):
        return lambda pedido, timeout: Respuesta(contenido)

    def test_windows_descarga_y_verifica(self):
        tg.SISTEMA = "win32"
        datos = b"MZ" + b"\x00" * 5000
        ruta = tg.descargar_actualizacion(self.info(datos), self.carpeta, self.abrir(datos))
        self.assertEqual(leer(ruta, "rb"), datos)

    def test_rechaza_huella_distinta_tamano_distinto_y_no_ejecutable(self):
        tg.SISTEMA = "win32"
        datos = b"MZ" + b"\x01" * 100
        malo = dict(self.info(datos), sha256="0" * 64)
        with self.assertRaises(ValueError):
            tg.descargar_actualizacion(malo, self.carpeta, self.abrir(datos))
        with self.assertRaises(ValueError):
            tg.descargar_actualizacion(dict(self.info(datos), tamano=5), self.carpeta, self.abrir(datos))
        pagina = b"<html>no soy un programa</html>"
        with self.assertRaises(ValueError):
            tg.descargar_actualizacion(self.info(pagina), self.carpeta, self.abrir(pagina))
        self.assertEqual(os.listdir(self.carpeta), [])  # no deja archivos a medias

    def test_corte_de_red_no_deja_restos(self):
        tg.SISTEMA = "win32"

        def falla(pedido, timeout):
            raise OSError("sin conexión")
        with self.assertRaises(OSError):
            tg.descargar_actualizacion(self.info(b"MZ"), self.carpeta, falla)
        self.assertEqual(os.listdir(self.carpeta), [])

    def test_linux_extrae_el_programa_del_paquete(self):
        tg.SISTEMA = "linux"
        crudo = io.BytesIO()
        with tarfile.open(fileobj=crudo, mode="w:gz") as paquete:
            programa = b"#!/bin/sh\necho nuevo\n"
            miembro = tarfile.TarInfo("TecladoCientifico")
            miembro.size = len(programa)
            paquete.addfile(miembro, io.BytesIO(programa))
        datos = crudo.getvalue()
        ruta = tg.descargar_actualizacion(self.info(datos), self.carpeta, self.abrir(datos))
        self.assertEqual(leer(ruta, "rb"), programa)
        self.assertTrue(os.access(ruta, os.X_OK))
        self.assertEqual(len(os.listdir(self.carpeta)), 1)


class Reemplazo(unittest.TestCase):
    def test_reemplaza_y_conserva_el_anterior_como_old(self):
        carpeta = tempfile.mkdtemp()
        actual, nuevo = os.path.join(carpeta, "Teclado.exe"), os.path.join(carpeta, "nuevo.tmp")
        escribir(actual, "viejo")
        escribir(nuevo, "nuevo")
        tg.reemplazar_ejecutable(actual, nuevo)
        self.assertEqual(leer(actual), "nuevo")
        self.assertEqual(leer(actual + ".old"), "viejo")

    def test_si_falla_vuelve_todo_atras(self):
        carpeta = tempfile.mkdtemp()
        actual = os.path.join(carpeta, "Teclado.exe")
        escribir(actual, "viejo")
        with self.assertRaises(OSError):
            tg.reemplazar_ejecutable(actual, os.path.join(carpeta, "no-existe.tmp"))
        self.assertEqual(leer(actual), "viejo")
        self.assertFalse(os.path.exists(actual + ".old"))


@unittest.skipUnless(os.environ.get("DISPLAY"), "requiere pantalla (en Linux: xvfb-run -a …)")
@unittest.skipUnless(sys.platform == "linux", "la simulación completa se prueba en Linux")
class Integracion(unittest.TestCase):
    """Simula un programa compilado: encuentra la versión nueva, descarga, reemplaza y relanza."""

    def test_flujo_completo(self):
        carpeta = tempfile.mkdtemp()
        exe = os.path.join(carpeta, "TecladoCientifico")
        escribir(exe, "#!/bin/sh\necho viejo\n")
        os.chmod(exe, 0o755)
        crudo = io.BytesIO()
        with tarfile.open(fileobj=crudo, mode="w:gz") as paquete:
            programa = b"#!/bin/sh\necho nuevo\n"
            miembro = tarfile.TarInfo("TecladoCientifico")
            miembro.size = len(programa)
            paquete.addfile(miembro, io.BytesIO(programa))
        paquete_tar = crudo.getvalue()
        api = json.dumps([publicacion("teclado-v9.0", "TecladoCientifico-Linux.tar.gz", paquete_tar)]).encode()

        def falso_urlopen(pedido, timeout=None):
            url = pedido.full_url if hasattr(pedido, "full_url") else pedido
            return Respuesta(api if "api.github.com" in url else paquete_tar)

        lanzados = []
        guardado = (urllib_abrir := tg.urllib.request.urlopen, tg.relanzar, getattr(sys, "frozen", None), sys.executable)
        tg.urllib.request.urlopen = falso_urlopen
        tg.relanzar = lanzados.append
        sys.frozen, sys.executable = True, exe
        try:
            app = tg.Teclado()
            app.buscar_actualizacion()
            fin = time.time() + 10
            while time.time() < fin and app.info_actualizacion is None:
                app.raiz.update()
                time.sleep(0.05)
            self.assertIsNotNone(app.info_actualizacion, "no encontró la versión nueva")
            self.assertTrue(app.boton_actualizar.winfo_ismapped() or app.raiz.update() is None)
            app.pulsar_actualizar()
            fin = time.time() + 10
            while time.time() < fin and not lanzados:
                try:
                    app.raiz.update()
                except tg.tk.TclError:
                    break  # la ventana se cerró: terminó la actualización
                time.sleep(0.05)
            self.assertEqual(lanzados, [exe])
            self.assertEqual(leer(exe), "#!/bin/sh\necho nuevo\n")
            self.assertEqual(leer(exe + ".old"), "#!/bin/sh\necho viejo\n")
            self.assertTrue(tg.borrar_restos())
            self.assertFalse(os.path.exists(exe + ".old"))
        finally:
            tg.urllib.request.urlopen, tg.relanzar, frozen, sys.executable = guardado
            if frozen is None:
                del sys.frozen
            else:
                sys.frozen = frozen


if __name__ == "__main__":
    unittest.main()
