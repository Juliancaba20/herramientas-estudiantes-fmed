import { useRef } from 'react';
import { Boton } from './EditorComun.jsx';

export default function InsertarImagen({ motorRef }) {
  const entrada = useRef(null);
  return (
    <>
      <input ref={entrada} type="file" accept="image/jpeg,image/png,image/webp" hidden
        onChange={(e) => { const archivo = e.target.files?.[0]; if (archivo) motorRef.current?.insertarImagen(archivo); e.target.value = ''; }} />
      <Boton icono="imagen" nombre="Insertar imagen desde el dispositivo" alPulsar={() => entrada.current?.click()} />
    </>
  );
}