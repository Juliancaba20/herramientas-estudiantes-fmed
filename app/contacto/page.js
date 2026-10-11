import Formulario from './Formulario';

export const metadata = {
  title: 'Informar un problema o sugerir una mejora',
  description: 'Envíe un error que encontró o una sugerencia para mejorar el sitio.',
  robots: { index: false },
};

export default function Contacto() {
  return (
    <main className="page">
      <header className="top">
        <h1>Errores y sugerencias</h1>
        <p className="sub">Cuéntenos qué encontró o qué mejoraría. El mensaje llega directamente a quien mantiene el sitio.</p>
      </header>
      <section className="form-wrap">
        <Formulario />
      </section>
    </main>
  );
}
