// En la versión final no se abre la ventana negra de consola de Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    anotomia_lib::run()
}
