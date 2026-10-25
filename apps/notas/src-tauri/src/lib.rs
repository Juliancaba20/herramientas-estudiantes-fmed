use tauri::Manager;
use tauri_plugin_fs::FsExt;

// Evento que se avisa a la app cuando se pide abrir un archivo con el programa ya abierto.
#[cfg(desktop)]
const EVENTO_ABRIR: &str = "anotomia://abrir-archivo";

// De la lista de argumentos del programa saca el archivo de Anotomía que se pidió abrir
// (doble clic sobre un .nota o una copia completa), si lo hay.
fn archivo_de_anotomia(args: &[String]) -> Option<String> {
    args.iter()
        .skip(1)
        .find(|a| {
            let minuscula = a.to_lowercase();
            (minuscula.ends_with(".nota") || minuscula.ends_with(".anotomia-respaldo"))
                && std::path::Path::new(a.as_str()).is_file()
        })
        .cloned()
}

// Permite que la app lea ese archivo (el selector de archivos solo autoriza lo que la persona elige en él).
fn autorizar(app: &tauri::AppHandle, ruta: &str) {
    let _ = app.fs_scope().allow_file(ruta);
}

// Archivo con el que se abrió el programa (doble clic en un documento). La app lo consulta al arrancar.
#[tauri::command]
fn archivo_inicial(app: tauri::AppHandle) -> Option<String> {
    let args: Vec<String> = std::env::args().collect();
    let ruta = archivo_de_anotomia(&args)?;
    autorizar(&app, &ruta);
    Some(ruta)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut constructor = tauri::Builder::default();

    // Una sola ventana: si ya está abierto y se hace doble clic en otro documento, se abre en esa misma ventana.
    // Dos ventanas compartirían las mismas notas y podrían pisarse.
    #[cfg(desktop)]
    {
        use tauri::Emitter;
        constructor = constructor.plugin(tauri_plugin_single_instance::init(|app, args, _directorio| {
            if let Some(ventana) = app.get_webview_window("main") {
                let _ = ventana.unminimize();
                let _ = ventana.show();
                let _ = ventana.set_focus();
            }
            if let Some(ruta) = archivo_de_anotomia(&args) {
                autorizar(app, &ruta);
                let _ = app.emit(EVENTO_ABRIR, ruta);
            }
        }));
    }

    constructor = constructor
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init());

    #[cfg(desktop)]
    {
        constructor = constructor
            .plugin(tauri_plugin_persisted_scope::init())
            .plugin(tauri_plugin_process::init());
    }

    constructor
        .setup(|app| {
            #[cfg(desktop)]
            app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
            let _ = app;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![archivo_inicial])
        .run(tauri::generate_context!())
        .expect("No se pudo iniciar Anotomía");
}
