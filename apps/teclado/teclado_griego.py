"""
Teclado Científico: teclado flotante de letras griegas y símbolos (Windows, macOS y Linux).

- Queda siempre por encima de las demás ventanas.
- Intenta no quitarle el foco a la aplicación en la que se escribe.
- Al hacer clic en una letra, la escribe donde esté el cursor.
- Se mueve arrastrando la barra superior (sin salirse de la pantalla).
- Recuerda la última posición y la última pestaña usadas.
- Al pasar el mouse sobre un símbolo, muestra su nombre en la barra superior.
- Una fila de "usados recientemente" repite los últimos 9 símbolos escritos.
- Modo compacto (botón ▴/▾): deja solo la barra y la fila de recientes.
- Atajo global (Ctrl+Alt+G por defecto, solo Windows y Linux con X11) para
  ocultar o mostrar el teclado. Se puede cambiar en el archivo de configuración.
- El botón "–" lo minimiza a la barra de tareas, como una ventana común;
  se restaura haciendo clic en su ícono de la barra de tareas. La "x" lo cierra.
- Si no puede escribir, avisa en pantalla y copia el símbolo al portapapeles.

Windows: no requiere nada adicional.
macOS / Linux: requiere "pynput" (pip install pynput).
"""

import hashlib
import json
import os
import queue
import re
import subprocess
import sys
import tarfile
import tempfile
import threading
import time
import tkinter as tk
import urllib.request
import webbrowser

VERSION = "1.5"
NOMBRE_APP = "TecladoCientifico"
NOMBRE_APP_ANTERIOR = "TecladoGriego"  # nombre de la carpeta de configuración hasta la v1.3
SISTEMA = sys.platform  # "win32", "darwin" o "linux"


class ErrorEscritura(Exception):
    """No se pudo escribir el carácter en la aplicación activa."""


# ---------------------------------------------------------------------------
# Escritura de caracteres en la aplicación activa
# ---------------------------------------------------------------------------
if SISTEMA == "win32":
    import ctypes
    from ctypes import wintypes

    user32 = ctypes.windll.user32
    INPUT_KEYBOARD = 1
    KEYEVENTF_KEYUP = 0x0002
    KEYEVENTF_UNICODE = 0x0004
    GWL_EXSTYLE = -20
    WS_EX_NOACTIVATE = 0x08000000
    WS_EX_TOPMOST = 0x00000008
    GA_ROOT = 2
    ERROR_ALREADY_EXISTS = 183
    WM_HOTKEY = 0x0312
    ULONG_PTR = ctypes.c_size_t

    class KEYBDINPUT(ctypes.Structure):
        _fields_ = [("wVk", wintypes.WORD), ("wScan", wintypes.WORD),
                    ("dwFlags", wintypes.DWORD), ("time", wintypes.DWORD),
                    ("dwExtraInfo", ULONG_PTR)]

    class MOUSEINPUT(ctypes.Structure):
        _fields_ = [("dx", wintypes.LONG), ("dy", wintypes.LONG),
                    ("mouseData", wintypes.DWORD), ("dwFlags", wintypes.DWORD),
                    ("time", wintypes.DWORD), ("dwExtraInfo", ULONG_PTR)]

    class HARDWAREINPUT(ctypes.Structure):
        _fields_ = [("uMsg", wintypes.DWORD), ("wParamL", wintypes.WORD),
                    ("wParamH", wintypes.WORD)]

    class _INPUT_UNION(ctypes.Union):
        _fields_ = [("ki", KEYBDINPUT), ("mi", MOUSEINPUT), ("hi", HARDWAREINPUT)]

    class INPUT(ctypes.Structure):
        _fields_ = [("type", wintypes.DWORD), ("u", _INPUT_UNION)]

    user32.GetAncestor.argtypes = [wintypes.HWND, wintypes.UINT]
    user32.GetAncestor.restype = wintypes.HWND
    user32.GetWindowLongW.argtypes = [wintypes.HWND, ctypes.c_int]
    user32.GetWindowLongW.restype = ctypes.c_long
    user32.SetWindowLongW.argtypes = [wintypes.HWND, ctypes.c_int, ctypes.c_long]
    user32.SetWindowLongW.restype = ctypes.c_long
    user32.SendInput.argtypes = [wintypes.UINT, ctypes.POINTER(INPUT), ctypes.c_int]
    user32.SendInput.restype = wintypes.UINT
    user32.RegisterHotKey.argtypes = [wintypes.HWND, ctypes.c_int, wintypes.UINT, wintypes.UINT]
    user32.RegisterHotKey.restype = wintypes.BOOL
    user32.GetMessageW.argtypes = [ctypes.POINTER(wintypes.MSG), wintypes.HWND,
                                   wintypes.UINT, wintypes.UINT]
    user32.GetMessageW.restype = ctypes.c_int

    def escribir(texto):
        for caracter in texto:
            codigo = ord(caracter)
            entradas = (INPUT * 2)()
            entradas[0].type = INPUT_KEYBOARD
            entradas[0].u.ki = KEYBDINPUT(0, codigo, KEYEVENTF_UNICODE, 0, 0)
            entradas[1].type = INPUT_KEYBOARD
            entradas[1].u.ki = KEYBDINPUT(0, codigo, KEYEVENTF_UNICODE | KEYEVENTF_KEYUP, 0, 0)
            enviados = user32.SendInput(2, entradas, ctypes.sizeof(INPUT))
            if enviados != 2:
                raise ErrorEscritura("Windows rechazó la entrada de teclado.")

    def evitar_foco(raiz):
        hwnd = user32.GetAncestor(raiz.winfo_id(), GA_ROOT) or raiz.winfo_id()
        estilo = user32.GetWindowLongW(hwnd, GWL_EXSTYLE)
        user32.SetWindowLongW(hwnd, GWL_EXSTYLE, estilo | WS_EX_NOACTIVATE | WS_EX_TOPMOST)

    def activar_dpi():
        """Evita que Windows estire (y desenfoque) la ventana en pantallas con zoom."""
        try:
            ctypes.windll.shcore.SetProcessDpiAwareness(1)
        except Exception:
            try:
                user32.SetProcessDPIAware()
            except Exception:
                pass

    _mutex = None  # se conserva para que Windows no libere el bloqueo

    def instancia_unica():
        """True si es la única copia abierta; False si ya hay otra ejecutándose."""
        global _mutex
        try:
            kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
            kernel32.CreateMutexW.argtypes = [wintypes.LPVOID, wintypes.BOOL, wintypes.LPCWSTR]
            kernel32.CreateMutexW.restype = wintypes.HANDLE
            _mutex = kernel32.CreateMutexW(None, False, "Local\\" + NOMBRE_APP)
            return ctypes.get_last_error() != ERROR_ALREADY_EXISTS
        except Exception:
            return True  # si no se puede comprobar, se deja abrir

    def liberar_instancia():
        """Suelta el bloqueo de instancia única (se usa justo antes de relanzar el programa)."""
        global _mutex
        try:
            if _mutex:
                ctypes.WinDLL("kernel32").CloseHandle(wintypes.HANDLE(_mutex))
        except Exception:
            pass
        _mutex = None

    def avisar_ya_abierto():
        user32.MessageBoxW(None, "El Teclado Científico ya está abierto.\n\n"
                           "Si no lo ve, puede estar oculto: use su atajo "
                           "(por defecto Ctrl+Alt+G) o búsquelo en la barra de tareas.",
                           "Teclado Científico", 0x40)

    def iniciar_atajo(mods, tecla, cola):
        """Registra el atajo global. Los avisos llegan por la cola (hilo aparte)."""
        banderas, codigo = codigo_atajo_windows(mods, tecla)

        def trabajo():
            # El atajo y su bucle de mensajes deben vivir en el mismo hilo.
            if not user32.RegisterHotKey(None, 1, banderas, codigo):
                cola.put(("error", None))
                return
            mensaje = wintypes.MSG()
            while user32.GetMessageW(ctypes.byref(mensaje), None, 0, 0) > 0:
                if mensaje.message == WM_HOTKEY:
                    cola.put(("atajo", None))

        hilo = threading.Thread(target=trabajo, daemon=True)
        hilo.start()
        return hilo

    def limites_virtuales(raiz):
        """Rectángulo que abarca todos los monitores: (x0, y0, x1, y1)."""
        x, y = user32.GetSystemMetrics(76), user32.GetSystemMetrics(77)
        ancho, alto = user32.GetSystemMetrics(78), user32.GetSystemMetrics(79)
        if ancho <= 0 or alto <= 0:
            return None
        return x, y, x + ancho, y + alto

    FUENTE = "Segoe UI"
    ATAJO_PEGAR = "Ctrl+V"

else:
    _teclado = None

    def liberar_instancia():
        pass  # solo Windows usa bloqueo de instancia única

    def escribir(texto):
        global _teclado
        try:
            if _teclado is None:
                from pynput.keyboard import Controller
                _teclado = Controller()
            _teclado.type(texto)
        except Exception as error:  # permisos, Wayland, etc.
            raise ErrorEscritura(str(error) or error.__class__.__name__) from error

    def evitar_foco(raiz):
        # En Linux (X11), las ventanas sin borde no reciben el foco al hacer clic.
        # En macOS se intenta marcar la ventana como "no activable".
        if SISTEMA == "darwin":
            try:
                raiz.tk.call("::tk::unsupported::MacWindowStyle", "style",
                             raiz._w, "plain", "noActivates")
            except tk.TclError:
                pass

    def limites_virtuales(raiz):
        """Rectángulo de pantalla: (x0, y0, x1, y1). En Mac no se limita."""
        if SISTEMA == "darwin":
            return None  # no se detectan de forma fiable varias pantallas
        return 0, 0, raiz.winfo_screenwidth(), raiz.winfo_screenheight()

    def iniciar_atajo(mods, tecla, cola):
        """Atajo global solo en Linux con X11 (devuelve None si no es posible)."""
        if SISTEMA != "linux" or en_wayland():
            return None
        try:
            from pynput import keyboard
            nombres = {"ctrl": "<ctrl>", "alt": "<alt>", "shift": "<shift>", "win": "<cmd>"}
            final = f"<{tecla}>" if len(tecla) > 1 else tecla
            combinacion = "+".join([nombres[m] for m in mods] + [final])
            escucha = keyboard.GlobalHotKeys({combinacion: lambda: cola.put(("atajo", None))})
            escucha.daemon = True
            escucha.start()
            return escucha
        except Exception:
            cola.put(("error", None))
            return None

    FUENTE = "Helvetica Neue" if SISTEMA == "darwin" else "DejaVu Sans"
    ATAJO_PEGAR = "Cmd+V" if SISTEMA == "darwin" else "Ctrl+V"


# ---------------------------------------------------------------------------
# Atajo global (formato de texto: "ctrl+alt+g")
# ---------------------------------------------------------------------------
ATAJO_PREDETERMINADO = "ctrl+alt+g"
_MODIFICADORES = ("ctrl", "alt", "shift", "win")


def analizar_atajo(texto):
    """'ctrl+alt+g' -> (['ctrl', 'alt'], 'g'). Devuelve None si no es válido."""
    if not isinstance(texto, str):
        return None
    partes = [p.strip().lower() for p in texto.split("+")]
    if len(partes) < 2 or "" in partes:
        return None
    *mods, tecla = partes
    if len(set(mods)) != len(mods) or not set(mods) <= set(_MODIFICADORES):
        return None
    es_letra_o_numero = len(tecla) == 1 and tecla.isascii() and tecla.isalnum()
    if not (es_letra_o_numero or re.fullmatch(r"f([1-9]|1[0-2])", tecla)):
        return None
    return mods, tecla


def texto_atajo(mods, tecla):
    """Para mostrar al usuario: 'Ctrl+Alt+G'."""
    return "+".join([m.capitalize() for m in mods] + [tecla.upper()])


def codigo_atajo_windows(mods, tecla):
    """(banderas, código de tecla virtual) para RegisterHotKey de Windows."""
    banderas = 0x4000  # MOD_NOREPEAT: no repite al mantener pulsado
    for m in mods:
        banderas |= {"alt": 0x1, "ctrl": 0x2, "shift": 0x4, "win": 0x8}[m]
    if len(tecla) > 1:  # F1 a F12
        return banderas, 0x70 + int(tecla[1:]) - 1
    return banderas, ord(tecla.upper())


def en_wayland():
    return (os.environ.get("XDG_SESSION_TYPE", "").lower() == "wayland"
            or bool(os.environ.get("WAYLAND_DISPLAY")))


# ---------------------------------------------------------------------------
# Comprobaciones al iniciar (macOS y Linux)
# ---------------------------------------------------------------------------
def accesibilidad_concedida():
    """macOS: ¿tiene el programa el permiso de Accesibilidad?"""
    try:
        import ctypes
        biblioteca = ctypes.cdll.LoadLibrary(
            "/System/Library/Frameworks/ApplicationServices.framework/ApplicationServices")
        biblioteca.AXIsProcessTrusted.restype = ctypes.c_bool
        return bool(biblioteca.AXIsProcessTrusted())
    except Exception:
        return True  # si no se puede comprobar, no se molesta al usuario


def avisos_de_entorno():
    """Lista de avisos para mostrar al iniciar (vacía si todo está en orden)."""
    avisos = []
    if SISTEMA == "linux":
        if en_wayland():
            avisos.append("Está usando Wayland: el teclado puede no escribir en algunas "
                          "aplicaciones. Inicie sesión con Xorg/X11 o pegue el símbolo "
                          "con " + ATAJO_PEGAR + ".")
        try:
            import pynput.keyboard  # noqa: F401
        except Exception:
            avisos.append("Falta el componente «pynput», necesario para escribir. "
                          "Instálelo con: pip install pynput")
    elif SISTEMA == "darwin":
        if not accesibilidad_concedida():
            avisos.append("Falta el permiso de Accesibilidad. Actívelo en Ajustes del "
                          "Sistema > Privacidad y seguridad > Accesibilidad y vuelva "
                          "a abrir el programa.")
    return avisos


# ---------------------------------------------------------------------------
# Configuración guardada (posición y pestaña)
# ---------------------------------------------------------------------------
def ruta_config(nombre=None):
    if SISTEMA == "win32":
        base = os.environ.get("APPDATA") or os.path.expanduser("~")
    elif SISTEMA == "darwin":
        base = os.path.expanduser("~/Library/Application Support")
    else:
        base = os.environ.get("XDG_CONFIG_HOME") or os.path.expanduser("~/.config")
    return os.path.join(base, nombre or NOMBRE_APP, "config.json")


def _leer_config(ruta):
    try:
        with open(ruta, encoding="utf-8") as archivo:
            datos = json.load(archivo)
        return datos if isinstance(datos, dict) else {}
    except (OSError, ValueError):
        return {}


def cargar_config():
    if os.path.exists(ruta_config()):
        return _leer_config(ruta_config())
    # Primera vez tras el cambio de nombre: se aprovecha la configuración anterior
    # (posición, pestaña y atajo) para que el usuario no la pierda.
    return _leer_config(ruta_config(NOMBRE_APP_ANTERIOR))


def guardar_config(datos):
    try:
        ruta = ruta_config()
        os.makedirs(os.path.dirname(ruta), exist_ok=True)
        temporal = ruta + ".tmp"
        with open(temporal, "w", encoding="utf-8") as archivo:
            json.dump(datos, archivo)
        os.replace(temporal, ruta)
    except OSError:
        pass  # si no se puede guardar, el programa sigue funcionando


# ---------------------------------------------------------------------------
# Contenido del teclado
# ---------------------------------------------------------------------------
PAGINAS = {
    "α": list("αβγδεζηθικλμνξοπρσςτυφχψω"),
    "Α": list("ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ"),
    "±": list("↑↓→←↔±≥≤≈°×·²³⁺⁻‰"),  # la μ (micro) está en la primera pestaña
    # Química y medicina: subíndices, superíndices (² ³ ⁺ ⁻ están en "±") y símbolos
    "H₂": list("₀₁₂₃₄₅₆₇₈₉⁰¹⁴⁵⁶⁷⁸⁹⇌≠∞√∑∝"),
}
COLUMNAS = 9
MAX_RECIENTES = 9

# Nombres que se muestran al pasar el mouse (deben ser cortos: caben en la barra)
_GRIEGAS = [  # (minúscula, mayúscula, nombre)
    ("α", "Α", "alfa"), ("β", "Β", "beta"), ("γ", "Γ", "gamma"), ("δ", "Δ", "delta"),
    ("ε", "Ε", "épsilon"), ("ζ", "Ζ", "zeta"), ("η", "Η", "eta"), ("θ", "Θ", "theta"),
    ("ι", "Ι", "iota"), ("κ", "Κ", "kappa"), ("λ", "Λ", "lambda"), ("μ", "Μ", "mu"),
    ("ν", "Ν", "nu"), ("ξ", "Ξ", "xi"), ("ο", "Ο", "ómicron"), ("π", "Π", "pi"),
    ("ρ", "Ρ", "rho"), ("σ", "Σ", "sigma"), ("τ", "Τ", "tau"), ("υ", "Υ", "ípsilon"),
    ("φ", "Φ", "fi (phi)"), ("χ", "Χ", "ji (chi)"), ("ψ", "Ψ", "psi"), ("ω", "Ω", "omega"),
]
NOMBRES = {"ς": "sigma final"}
for _min, _may, _nombre in _GRIEGAS:
    NOMBRES[_min] = _nombre
    NOMBRES[_may] = _nombre + " mayús."
NOMBRES.update({
    "↑": "flecha arriba", "↓": "flecha abajo", "→": "flecha derecha",
    "←": "flecha izquierda", "↔": "flecha doble", "±": "más o menos",
    "≥": "mayor o igual", "≤": "menor o igual", "≈": "aprox. igual",
    "°": "grados", "×": "por (multiplicar)", "·": "punto medio",
    "²": "al cuadrado", "³": "al cubo", "⁺": "superíndice +",
    "⁻": "superíndice −", "‰": "por mil",
    "⇌": "equilibrio", "≠": "distinto de", "∞": "infinito",
    "√": "raíz cuadrada", "∑": "sumatoria", "∝": "proporcional a",
})
for _i, _c in enumerate("₀₁₂₃₄₅₆₇₈₉"):
    NOMBRES[_c] = f"subíndice {_i}"
for _c, _i in zip("⁰¹⁴⁵⁶⁷⁸⁹", (0, 1, 4, 5, 6, 7, 8, 9)):
    NOMBRES[_c] = f"superíndice {_i}"
SIMBOLOS_VALIDOS = {c for pagina in PAGINAS.values() for c in pagina}

FONDO, BARRA, BOTON = "#1e1e2e", "#11111b", "#313244"
HOVER, TEXTO, ACENTO, CERRAR = "#45475a", "#cdd6f4", "#89b4fa", "#f38ba8"
AVISO_FONDO, AVISO_TEXTO = "#45475a", "#f9e2af"
RECIENTE_FONDO, NOMBRE_TEXTO, ASA_TEXTO = "#383852", "#a6adc8", "#6c7086"


def ruta_recurso(nombre):
    """Ubica un archivo junto al programa, también dentro del ejecutable."""
    base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, nombre)


def crear_boton(padre, texto, comando, ancho=3, tamano=12, negrita=False,
                bg=BOTON, fg=TEXTO, hover=HOVER, al_pasar=None):
    """al_pasar(True/False) se llama cuando el mouse entra o sale del botón."""
    fuente = (FUENTE, tamano, "bold") if negrita else (FUENTE, tamano)
    etiqueta = tk.Label(padre, text=texto, width=ancho, font=fuente,
                        bg=bg, fg=fg, cursor="hand2")

    def entrar(evento):
        etiqueta.configure(bg=hover)
        if al_pasar:
            al_pasar(True)

    def salir(evento):
        etiqueta.configure(bg=bg)
        if al_pasar:
            al_pasar(False)

    etiqueta.bind("<Button-1>", lambda e: comando())
    etiqueta.bind("<Enter>", entrar)
    etiqueta.bind("<Leave>", salir)
    return etiqueta


# ---------------------------------------------------------------------------
# Actualización automática (Windows y Linux; en Mac solo se avisa)
# ---------------------------------------------------------------------------
REPO = "Juliancaba20/hipocampus"
URL_VERSIONES = f"https://api.github.com/repos/{REPO}/releases?per_page=30"
PREFIJO_DESCARGA = f"https://github.com/{REPO}/releases/download/"
# Si algún día se renombra el repositorio, GitHub redirige las consultas y las descargas pasan a
# llevar el nombre nuevo: por eso se acepta cualquier dirección de descarga de github.com.
DESCARGA_VALIDA = re.compile(r"^https://github\.com/[\w.-]+/[\w.-]+/releases/download/")
ARCHIVOS_ACTUALIZACION = {"win32": "TecladoCientifico-Windows.exe",
                          "darwin": "TecladoCientifico-Mac.zip",
                          "linux": "TecladoCientifico-Linux.tar.gz"}
# Etiquetas de las versiones del teclado (el repositorio también publica otras cosas, como Anotomía).
ETIQUETA_TECLADO = re.compile(r"^teclado(?:-cient[ií]fico)?-v(\d+(?:\.\d+)*)$", re.IGNORECASE)
ESPERA_RED = 15                      # segundos máximos para cada pedido a internet
LIMITE_DESCARGA = 150 * 1024 * 1024  # el programa pesa unos 15 MB: más que esto no es el programa


def version_a_tupla(texto):
    try:
        return tuple(int(parte) for parte in str(texto).split("."))
    except ValueError:
        return None


def elegir_version(publicaciones, archivo, actual=None):
    """Devuelve los datos de la versión del teclado más nueva que la actual, o None."""
    actual = version_a_tupla(actual or VERSION)
    mejor = None
    if not isinstance(publicaciones, list):
        return None
    for pub in publicaciones:
        if not isinstance(pub, dict) or pub.get("draft") or pub.get("prerelease"):
            continue
        coincide = ETIQUETA_TECLADO.match(str(pub.get("tag_name", "")))
        tupla = version_a_tupla(coincide.group(1)) if coincide else None
        if tupla is None or actual is None or tupla <= actual:
            continue
        if mejor is not None and tupla <= mejor["tupla"]:
            continue
        for activo in pub.get("assets") or []:
            url = str(activo.get("browser_download_url", ""))
            if (activo.get("name") == archivo and activo.get("state", "uploaded") == "uploaded"
                    and DESCARGA_VALIDA.match(url)):
                digest = str(activo.get("digest") or "")
                mejor = {"tupla": tupla, "version": coincide.group(1), "url": url,
                         "tamano": activo.get("size") if isinstance(activo.get("size"), int) else None,
                         "sha256": digest[7:].lower() if digest.startswith("sha256:") else None,
                         "pagina": str(pub.get("html_url") or f"https://github.com/{REPO}/releases")}
                break
    return mejor


def consultar_actualizacion(abrir=None):
    """Pregunta a GitHub si hay una versión nueva. Devuelve sus datos o None."""
    archivo = ARCHIVOS_ACTUALIZACION.get(SISTEMA)
    if not archivo:
        return None
    pedido = urllib.request.Request(URL_VERSIONES, headers={
        "User-Agent": f"TecladoCientifico/{VERSION}", "Accept": "application/vnd.github+json"})
    with (abrir or urllib.request.urlopen)(pedido, timeout=ESPERA_RED) as respuesta:
        publicaciones = json.loads(respuesta.read(4 * 1024 * 1024).decode("utf-8"))
    return elegir_version(publicaciones, archivo)


def ruta_ejecutable():
    """Ruta del programa instalado, o None si se ejecuta como script (no compilado)."""
    if getattr(sys, "frozen", False):
        return os.path.abspath(sys.executable)
    return None


def puede_autoactualizar():
    """Windows y Linux, programa compilado y carpeta con permiso de escritura."""
    ruta = ruta_ejecutable()
    return bool(ruta and SISTEMA in ("win32", "linux") and os.path.isfile(ruta)
                and os.access(os.path.dirname(ruta), os.W_OK))


def descargar_actualizacion(info, carpeta, abrir=None):
    """Descarga y comprueba la versión nueva; devuelve la ruta del ejecutable listo para usar."""
    pedido = urllib.request.Request(info["url"], headers={"User-Agent": f"TecladoCientifico/{VERSION}"})
    descarga = None
    listo = None
    try:
        gestor, descarga = tempfile.mkstemp(prefix="TecladoCientifico-", suffix=".descarga", dir=carpeta)
        huella, total = hashlib.sha256(), 0
        with os.fdopen(gestor, "wb") as salida, \
                (abrir or urllib.request.urlopen)(pedido, timeout=ESPERA_RED) as entrada:
            while True:
                trozo = entrada.read(256 * 1024)
                if not trozo:
                    break
                total += len(trozo)
                if total > LIMITE_DESCARGA:
                    raise ValueError("el archivo descargado es demasiado grande")
                huella.update(trozo)
                salida.write(trozo)
        if info.get("tamano") is not None and total != info["tamano"]:
            raise ValueError("la descarga quedó incompleta")
        if info.get("sha256") and huella.hexdigest() != info["sha256"]:
            raise ValueError("la descarga no coincide con la publicada")
        if SISTEMA == "linux":  # el archivo es un .tar.gz con el programa adentro
            gestor, listo = tempfile.mkstemp(prefix="TecladoCientifico-", suffix=".nuevo", dir=carpeta)
            with tarfile.open(descarga, "r:gz") as paquete, os.fdopen(gestor, "wb") as salida:
                miembro = next((m for m in paquete.getmembers()
                                if m.isfile() and os.path.basename(m.name) == NOMBRE_APP), None)
                if miembro is None:
                    raise ValueError("el paquete no contiene el programa")
                contenido = paquete.extractfile(miembro)
                while True:
                    trozo = contenido.read(256 * 1024)
                    if not trozo:
                        break
                    salida.write(trozo)
            os.chmod(listo, 0o755)
            os.remove(descarga)
            descarga = None
            return listo
        with open(descarga, "rb") as comprobar:
            if comprobar.read(2) != b"MZ":
                raise ValueError("el archivo descargado no es un programa de Windows")
        listo, descarga = descarga, None
        return listo
    except BaseException:
        for resto in (descarga, listo):
            if resto:
                try:
                    os.remove(resto)
                except OSError:
                    pass
        raise


def reemplazar_ejecutable(actual, nuevo):
    """Pone el programa nuevo en el lugar del actual. El actual queda como «.old» hasta que se borre."""
    viejo = actual + ".old"
    try:
        os.remove(viejo)
    except FileNotFoundError:
        pass
    os.replace(actual, viejo)  # un programa en uso se puede renombrar, aunque no borrar
    try:
        os.replace(nuevo, actual)
    except OSError:
        os.replace(viejo, actual)  # si falla, vuelve todo a como estaba
        raise


def borrar_restos():
    """Elimina el programa anterior que quedó como «.old» tras actualizar. True si ya no hay restos."""
    ruta = ruta_ejecutable()
    if not ruta:
        return True
    try:
        os.remove(ruta + ".old")
    except FileNotFoundError:
        pass
    except OSError:
        return False  # todavía en uso: se reintenta más tarde
    return True


def relanzar(ruta):
    """Abre el programa actualizado como proceso independiente."""
    entorno = dict(os.environ)
    entorno["PYINSTALLER_RESET_ENVIRONMENT"] = "1"  # que no reutilice la carpeta temporal de este proceso
    opciones = {"env": entorno, "close_fds": True, "stdin": subprocess.DEVNULL,
                "stdout": subprocess.DEVNULL, "stderr": subprocess.DEVNULL}
    if SISTEMA == "win32":
        opciones["creationflags"] = 0x00000008 | 0x00000200  # DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP
    else:
        opciones["start_new_session"] = True
    subprocess.Popen([ruta, "--actualizado"], **opciones)


# ---------------------------------------------------------------------------
# Interfaz
# ---------------------------------------------------------------------------
class Teclado:
    def __init__(self):
        self.raiz = raiz = tk.Tk()
        raiz.title("Teclado Científico")
        self.poner_icono()
        raiz.overrideredirect(True)
        raiz.attributes("-topmost", True)
        try:
            raiz.attributes("-alpha", 0.96)
        except tk.TclError:
            pass
        raiz.configure(bg=FONDO)

        config = cargar_config()
        pagina_inicial = config.get("pagina") if config.get("pagina") in PAGINAS else "α"
        self.pagina = pagina_inicial
        recientes = config.get("recientes")
        self.recientes = []
        if isinstance(recientes, list):
            for c in recientes:
                if c in SIMBOLOS_VALIDOS and c not in self.recientes:
                    self.recientes.append(c)
        del self.recientes[MAX_RECIENTES:]
        self.minimizado = False
        self.x, self.y = 120, 120
        self.desplazamiento = (0, 0)
        self.trabajo_aviso = None
        self.compacto = False
        self.oculto = False
        self.cola_atajo = queue.SimpleQueue()
        self.escucha_atajo = None
        self.cola_actualizacion = queue.SimpleQueue()
        self.buscar_actualizaciones = config.get("buscar_actualizaciones") is not False
        self.info_actualizacion = None
        self.actualizando = False
        self.forzar_navegador = False
        aviso_atajo = None
        atajo_texto = config.get("atajo", ATAJO_PREDETERMINADO)
        if atajo_texto == "":
            self.atajo = None  # desactivado por el usuario
        else:
            self.atajo = analizar_atajo(atajo_texto)
            if self.atajo is None:
                predeterminado = analizar_atajo(ATAJO_PREDETERMINADO)
                aviso_atajo = (f"El atajo «{atajo_texto}» del archivo de configuración "
                               f"no es válido; se usa {texto_atajo(*predeterminado)}.")
                self.atajo = predeterminado

        self.barra = tk.Frame(raiz, bg=BARRA)
        self.barra.pack(fill="x")
        self.aviso = tk.Label(raiz, text="", bg=AVISO_FONDO, fg=AVISO_TEXTO,
                              font=(FUENTE, 9), justify="left", anchor="w",
                              padx=6, pady=3, cursor="hand2")
        self.aviso.bind("<Button-1>", lambda e: self.ocultar_aviso())
        self.recientes_marco = tk.Frame(raiz, bg=FONDO)
        self.recientes_marco.pack(padx=3, pady=(3, 0), anchor="w")
        self.slots = [self.crear_slot(i) for i in range(MAX_RECIENTES)]
        self.cuadricula = tk.Frame(raiz, bg=FONDO)
        self.cuadricula.pack(padx=3, pady=3)

        self.pestanas = {}
        for nombre in PAGINAS:
            pestana = crear_boton(self.barra, nombre,
                                  lambda n=nombre: self.cambiar_pagina(n),
                                  tamano=10, negrita=True, bg=BARRA)
            pestana.pack(side="left")
            self.pestanas[nombre] = pestana

        # El botón de cerrar se coloca primero para quedar en el extremo derecho
        crear_boton(self.barra, "✕", self.cerrar, tamano=10, negrita=True,
                    bg=BARRA, hover=CERRAR).pack(side="right")
        crear_boton(self.barra, "–", self.minimizar_ventana, tamano=10, negrita=True,
                    bg=BARRA).pack(side="right")
        self.boton_compacto = crear_boton(
            self.barra, "▴", self.alternar_compacto, tamano=10, negrita=True, bg=BARRA,
            al_pasar=lambda dentro: self.mostrar_nombre(
                ("Expandir" if self.compacto else "Modo compacto") if dentro else None))
        self.boton_compacto.pack(side="right")
        self.boton_actualizar = crear_boton(
            self.barra, "↑", self.pulsar_actualizar, tamano=10, negrita=True, bg=BARRA, fg=ACENTO,
            al_pasar=lambda dentro: self.mostrar_nombre(
                f"Actualizar a la versión {self.info_actualizacion['version']}"
                if dentro and self.info_actualizacion else None))
        # width=1: el texto se recorta en vez de agrandar la ventana
        self.asa = tk.Label(self.barra, text="⠿", bg=BARRA, fg=ASA_TEXTO, width=1,
                            cursor="fleur", font=(FUENTE, 10))
        self.asa.pack(side="left", fill="x", expand=True)

        for zona in (self.barra, self.asa):
            zona.bind("<ButtonPress-1>", self.iniciar_arrastre)
            zona.bind("<B1-Motion>", self.arrastrar)
            zona.bind("<ButtonRelease-1>", lambda e: self.guardar())

        self.refrescar_recientes()
        self.fijar_tamano()  # recorre todas las pestañas para medirlas
        self.mostrar(pagina_inicial)
        if config.get("compacto") is True:
            self.aplicar_compacto(True)

        raiz.update_idletasks()
        self.x, self.y = self.limitar(config.get("x"), config.get("y"))
        raiz.geometry(f"+{self.x}+{self.y}")

        raiz.protocol("WM_DELETE_WINDOW", self.cerrar)
        raiz.bind("<Map>", self.al_restaurar)
        raiz.after(100, lambda: evitar_foco(raiz))
        raiz.after(1500, self.mantener_arriba)
        avisos = avisos_de_entorno()
        if aviso_atajo:
            avisos.append(aviso_atajo)
        if avisos:
            raiz.after(400, lambda: self.avisar("\n\n".join(avisos), segundos=20))
        if self.atajo and SISTEMA in ("win32", "linux"):
            self.escucha_atajo = iniciar_atajo(*self.atajo, self.cola_atajo)
        raiz.after(100, self.revisar_atajo)
        raiz.after(500, self.revisar_actualizacion)
        if "--actualizado" in sys.argv[1:]:
            raiz.after(900, lambda: self.avisar(f"Teclado actualizado a la versión {VERSION}.", segundos=8))
            raiz.after(6000, self.limpiar_restos)
        else:
            self.limpiar_restos()
        if self.buscar_actualizaciones and ruta_ejecutable():
            raiz.after(4000, self.buscar_actualizacion)

    # -- ícono ---------------------------------------------------------------
    def poner_icono(self):
        try:
            if SISTEMA == "win32":
                self.raiz.iconbitmap(ruta_recurso("icono.ico"))
            else:
                imagen = tk.PhotoImage(file=ruta_recurso("icono.png"))
                self.raiz.iconphoto(True, imagen)
                self.raiz._imagen_icono = imagen  # evita que se libere de memoria
        except Exception:
            pass  # si falta el ícono, el programa funciona igual

    # -- páginas -------------------------------------------------------------
    def mostrar(self, pagina):
        self.mostrar_nombre(None)
        for hijo in self.cuadricula.winfo_children():
            hijo.destroy()
        for i, caracter in enumerate(PAGINAS[pagina]):
            boton = crear_boton(self.cuadricula, caracter,
                                lambda c=caracter: self.escribir_caracter(c),
                                al_pasar=lambda dentro, c=caracter:
                                self.mostrar_nombre(NOMBRES.get(c) if dentro else None))
            boton.grid(row=i // COLUMNAS, column=i % COLUMNAS, padx=1, pady=1)
        for nombre, etiqueta in self.pestanas.items():
            etiqueta.configure(fg=ACENTO if nombre == pagina else TEXTO)
        self.pagina = pagina

    def cambiar_pagina(self, pagina):
        self.mostrar(pagina)
        if self.compacto:
            self.alternar_compacto(False)  # elegir una pestaña expande el teclado
        else:
            self.guardar()

    # -- modo compacto -------------------------------------------------------
    def aplicar_compacto(self, compacto):
        """Muestra u oculta la cuadrícula (queda solo la barra y los recientes)."""
        self.compacto = compacto
        if compacto:
            self.cuadricula.pack_forget()
        else:
            self.cuadricula.pack(padx=3, pady=3)
        self.recientes_marco.pack_configure(pady=(3, 3) if compacto else (3, 0))
        self.boton_compacto.configure(text="▾" if compacto else "▴")

    def alternar_compacto(self, compacto=None):
        self.aplicar_compacto(not self.compacto if compacto is None else compacto)
        self.mostrar_nombre("Expandir" if self.compacto else "Modo compacto")
        self.raiz.after_idle(self.reajustar)
        self.guardar()

    # -- atajo global: ocultar / mostrar -------------------------------------
    def revisar_atajo(self):
        """Atiende los avisos del hilo del atajo (se consulta cada 100 ms)."""
        try:
            while True:
                tipo, _ = self.cola_atajo.get_nowait()
                if tipo == "atajo":
                    self.alternar_visibilidad()
                elif tipo == "error":
                    self.avisar(f"No se pudo activar el atajo {texto_atajo(*self.atajo)}: "
                                "quizá otra aplicación ya lo usa. Puede cambiarlo en el "
                                f"archivo {ruta_config()}", segundos=15)
        except queue.Empty:
            pass
        self.raiz.after(100, self.revisar_atajo)

    def alternar_visibilidad(self):
        if self.oculto or self.minimizado:
            self.mostrar_ventana()
        else:
            self.guardar()
            self.oculto = True
            self.raiz.withdraw()

    def mostrar_ventana(self):
        estaba_minimizado = self.minimizado
        self.oculto = False
        self.raiz.deiconify()  # si estaba minimizado, al_restaurar completa el trabajo
        if not estaba_minimizado:
            self.raiz.geometry(f"+{self.x}+{self.y}")
            self.raiz.attributes("-topmost", True)
            self.raiz.lift()
            self.raiz.after(80, lambda: evitar_foco(self.raiz))

    def fijar_tamano(self):
        """Todas las pestañas ocupan lo mismo que la más grande (sin saltos de alto)."""
        ancho = alto = 0
        for nombre in PAGINAS:
            self.mostrar(nombre)
            self.raiz.update_idletasks()
            ancho = max(ancho, self.cuadricula.winfo_reqwidth())
            alto = max(alto, self.cuadricula.winfo_reqheight())
        self.cuadricula.configure(width=ancho, height=alto)
        self.cuadricula.grid_propagate(False)
        self.aviso.configure(wraplength=max(ancho - 12, 100))

    def mostrar_nombre(self, nombre):
        """Muestra el nombre del símbolo en la barra (o el asa si no hay ninguno)."""
        if nombre:
            self.asa.configure(text=nombre, fg=NOMBRE_TEXTO, font=(FUENTE, 8))
        else:
            self.asa.configure(text="⠿", fg=ASA_TEXTO, font=(FUENTE, 10))

    # -- fila de recientes ---------------------------------------------------
    def crear_slot(self, indice):
        etiqueta = tk.Label(self.recientes_marco, text="", width=3, font=(FUENTE, 12),
                            bg=BARRA, fg=ACENTO)
        etiqueta.grid(row=0, column=indice, padx=1, pady=1)

        def lleno():
            return indice < len(self.recientes)

        def entrar(evento):
            if lleno():
                etiqueta.configure(bg=HOVER)
                self.mostrar_nombre(NOMBRES.get(self.recientes[indice]))

        def salir(evento):
            etiqueta.configure(bg=RECIENTE_FONDO if lleno() else BARRA)
            self.mostrar_nombre(None)

        def pulsar(evento):
            if lleno():
                # Desde esta fila no se reordena: el símbolo no se mueve bajo el mouse.
                self.escribir_caracter(self.recientes[indice], reordenar=False)

        etiqueta.bind("<Enter>", entrar)
        etiqueta.bind("<Leave>", salir)
        etiqueta.bind("<Button-1>", pulsar)
        return etiqueta

    def refrescar_recientes(self):
        for i, etiqueta in enumerate(self.slots):
            if i < len(self.recientes):
                etiqueta.configure(text=self.recientes[i], bg=RECIENTE_FONDO,
                                   cursor="hand2")
            else:
                etiqueta.configure(text="", bg=BARRA, cursor="arrow")

    def registrar_reciente(self, caracter, reordenar=True):
        if caracter in self.recientes:
            if not reordenar:
                return
            self.recientes.remove(caracter)
        self.recientes.insert(0, caracter)
        del self.recientes[MAX_RECIENTES:]
        self.refrescar_recientes()
        self.guardar()

    # -- escritura y avisos --------------------------------------------------
    def escribir_caracter(self, caracter, reordenar=True):
        self.registrar_reciente(caracter, reordenar)
        try:
            escribir(caracter)
        except Exception:
            self.copiar(caracter)
            self.avisar("No se pudo escribir el símbolo. Quedó copiado: péguelo con "
                        + ATAJO_PEGAR + ".")

    def copiar(self, texto):
        try:
            self.raiz.clipboard_clear()
            self.raiz.clipboard_append(texto)
            self.raiz.update()
        except tk.TclError:
            pass

    def avisar(self, texto, segundos=6):
        if self.trabajo_aviso is not None:
            self.raiz.after_cancel(self.trabajo_aviso)
        self.aviso.configure(text=texto)
        self.aviso.pack(fill="x", padx=3, before=self.recientes_marco)
        self.trabajo_aviso = self.raiz.after(int(segundos * 1000), self.ocultar_aviso)
        self.raiz.after_idle(self.reajustar)

    def ocultar_aviso(self):
        if self.trabajo_aviso is not None:
            self.raiz.after_cancel(self.trabajo_aviso)
            self.trabajo_aviso = None
        self.aviso.pack_forget()
        self.raiz.after_idle(self.reajustar)

    def reajustar(self):
        """Tras cambiar de tamaño, evita que la ventana quede fuera de la pantalla."""
        if self.minimizado or self.oculto:
            return
        self.raiz.update_idletasks()
        self.x, self.y = self.limitar(self.raiz.winfo_x(), self.raiz.winfo_y())
        self.raiz.geometry(f"+{self.x}+{self.y}")

    # -- posición ------------------------------------------------------------
    def limitar(self, x, y):
        """Devuelve (x, y) corregidos para que la ventana quede dentro de la pantalla."""
        x = x if isinstance(x, int) and not isinstance(x, bool) else 120
        y = y if isinstance(y, int) and not isinstance(y, bool) else 120
        limites = limites_virtuales(self.raiz)
        if limites is None:
            return x, y
        x0, y0, x1, y1 = limites
        ancho, alto = self.raiz.winfo_reqwidth(), self.raiz.winfo_reqheight()
        x = max(x0, min(x, x1 - ancho))
        y = max(y0, min(y, y1 - alto))
        return x, y

    def iniciar_arrastre(self, evento):
        self.desplazamiento = (evento.x_root - self.raiz.winfo_x(),
                               evento.y_root - self.raiz.winfo_y())

    def arrastrar(self, evento):
        self.x, self.y = self.limitar(evento.x_root - self.desplazamiento[0],
                                      evento.y_root - self.desplazamiento[1])
        self.raiz.geometry(f"+{self.x}+{self.y}")

    def guardar(self):
        if not self.minimizado and not self.oculto:
            self.x, self.y = self.raiz.winfo_x(), self.raiz.winfo_y()
        guardar_config({"version": VERSION, "x": self.x, "y": self.y,
                        "pagina": self.pagina, "recientes": self.recientes,
                        "compacto": self.compacto,
                        "buscar_actualizaciones": self.buscar_actualizaciones,
                        "atajo": texto_atajo(*self.atajo).lower() if self.atajo else ""})

    # -- actualización automática --------------------------------------------
    def limpiar_restos(self, intento=0):
        if not borrar_restos() and intento < 3:
            self.raiz.after(20000, lambda: self.limpiar_restos(intento + 1))

    def buscar_actualizacion(self):
        """Consulta GitHub en segundo plano (no demora el teclado). Se repite cada 6 horas."""
        def trabajo():
            try:
                info = consultar_actualizacion()
            except Exception:
                info = None  # sin internet o GitHub no responde: se intenta más tarde, sin avisar
            self.cola_actualizacion.put(("consulta", info))
        threading.Thread(target=trabajo, daemon=True).start()
        if self.info_actualizacion is None:
            self.raiz.after(6 * 3600 * 1000, self.buscar_actualizacion)

    def revisar_actualizacion(self):
        """Atiende los resultados del hilo de actualización (se consulta cada 500 ms)."""
        try:
            while True:
                tipo, dato = self.cola_actualizacion.get_nowait()
                if tipo == "consulta" and dato and self.info_actualizacion is None:
                    self.info_actualizacion = dato
                    self.boton_actualizar.pack(side="right", after=self.boton_compacto)
                    self.avisar(f"Hay una versión nueva del teclado ({dato['version']}). "
                                "Haga clic en ↑ para actualizar.", segundos=15)
                elif tipo == "lista":
                    self.terminar_actualizacion(dato)
                elif tipo == "error":
                    self.actualizando = False
                    self.forzar_navegador = True
                    self.avisar("No se pudo actualizar automáticamente. Haga clic en ↑ para abrir "
                                "la página de descarga.", segundos=15)
        except queue.Empty:
            pass
        self.raiz.after(500, self.revisar_actualizacion)

    def pulsar_actualizar(self):
        info = self.info_actualizacion
        if not info or self.actualizando:
            return
        if self.forzar_navegador or not puede_autoactualizar():
            webbrowser.open(info["pagina"])
            self.avisar("Se abrió la página de descarga de la versión nueva en su navegador.", segundos=10)
            return
        self.actualizando = True
        self.avisar(f"Descargando la versión {info['version']}… no cierre el teclado.", segundos=300)

        def trabajo():
            try:
                actual = ruta_ejecutable()
                nuevo = descargar_actualizacion(info, os.path.dirname(actual))
                try:
                    reemplazar_ejecutable(actual, nuevo)
                except BaseException:
                    try:
                        os.remove(nuevo)
                    except OSError:
                        pass
                    raise
                self.cola_actualizacion.put(("lista", actual))
            except Exception:
                self.cola_actualizacion.put(("error", None))
        threading.Thread(target=trabajo, daemon=True).start()

    def terminar_actualizacion(self, ruta):
        """El programa nuevo ya está en su lugar: se abre y este se cierra."""
        self.guardar()
        liberar_instancia()
        try:
            relanzar(ruta)
        except Exception:
            if SISTEMA == "win32":
                instancia_unica()  # no se pudo abrir el nuevo: este sigue funcionando
            self.actualizando = False
            self.avisar("El teclado se actualizó. Ciérrelo y vuelva a abrirlo para usar la versión nueva.",
                        segundos=20)
            return
        self.raiz.destroy()

    # -- minimizar / restaurar / cerrar --------------------------------------
    def minimizar_ventana(self):
        """Minimiza el teclado a la barra de tareas, como una ventana común."""
        self.x, self.y = self.raiz.winfo_x(), self.raiz.winfo_y()
        self.minimizado = True
        # Una ventana sin borde no puede minimizarse ni aparecer en la barra de
        # tareas, así que se le devuelve el borde mientras está minimizada.
        self.raiz.update_idletasks()
        self.raiz.overrideredirect(False)
        self.raiz.iconify()

    def al_restaurar(self, evento):
        """Al volver desde la barra de tareas, se restablece la ventana sin borde."""
        if evento.widget is not self.raiz or not self.minimizado:
            return
        if self.raiz.state() != "normal":
            return
        self.minimizado = False
        self.raiz.overrideredirect(True)
        self.x, self.y = self.limitar(self.x, self.y)
        self.raiz.geometry(f"+{self.x}+{self.y}")
        self.raiz.attributes("-topmost", True)
        self.raiz.after(80, lambda: evitar_foco(self.raiz))

    def mantener_arriba(self):
        if not self.minimizado and not self.oculto:
            self.raiz.attributes("-topmost", True)
            self.raiz.lift()
        self.raiz.after(1500, self.mantener_arriba)

    def cerrar(self):
        self.guardar()
        self.raiz.destroy()

    def ejecutar(self):
        self.raiz.mainloop()


def autodiagnostico():
    """Comprueba que el módulo de escritura esté disponible (lo usa la compilación)."""
    if SISTEMA != "win32":
        try:
            from pynput.keyboard import Controller
            Controller()
        except Exception as error:
            print("ERROR: no se puede escribir:", error)
            return 1
    print("OK")
    return 0


def main():
    if "--version" in sys.argv[1:]:
        print(VERSION)
        return
    if "--autodiagnostico" in sys.argv[1:]:
        sys.exit(autodiagnostico())
    if SISTEMA == "win32":
        activar_dpi()  # debe hacerse antes de crear la ventana
        # Tras una actualización, la copia anterior tarda un instante en cerrarse: se la espera.
        for _ in range(20 if "--actualizado" in sys.argv[1:] else 1):
            if instancia_unica():
                break
            liberar_instancia()
            time.sleep(0.5)
        else:
            avisar_ya_abierto()
            return
    Teclado().ejecutar()


if __name__ == "__main__":
    main()
