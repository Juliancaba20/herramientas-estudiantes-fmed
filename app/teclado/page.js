export const metadata = {
  title: 'Teclado Científico',
  description: 'Teclado flotante gratuito para escribir letras griegas y símbolos científicos con un clic. Windows, Linux y Mac.',
};

export default function Teclado() {
  return (
    <main className="page">
      <header className="top">
        <h1>Teclado Científico</h1>
        <p className="sub">Un teclado flotante y de tamaño reducido que queda visible sobre otras aplicaciones. Se hace clic en una letra o un símbolo y se escribe directamente, sin copiar y pegar.</p>
      </header>
      <section className="src" style={{ padding: '2rem 0' }}>
        <h2 className="t" style={{ marginTop: 0 }}>Descarga</h2>
        <p>Disponible para Windows, Linux y Mac. Es gratuito y no recolecta datos personales.</p>
        <a className="btn" href="https://teclado-griego.vercel.app/">Ir a la página de descargas</a>
        <a className="btn" href="https://github.com/Juliancaba20/Teclado-Griego">Código en GitHub</a>
      </section>
    </main>
  );
}
