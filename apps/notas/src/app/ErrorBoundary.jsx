import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { tieneError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { tieneError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error no capturado en la interfaz de Anotomía:', error, errorInfo);
  }

  recargar() {
    window.location.reload();
  }

  render() {
    if (this.state.tieneError) {
      return (
        <div style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: '#f8fafc',
          color: '#1e293b',
          fontFamily: 'var(--nt-fuente-base, system-ui, sans-serif)',
          textAlign: 'center',
        }}>
          <div style={{
            maxWidth: '480px',
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '16px',
            padding: '32px 24px',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08)',
          }}>
            <h1 style={{ fontSize: '20px', margin: '0 0 12px 0', color: '#0f172a' }}>
              Ha ocurrido un inconveniente inesperado
            </h1>
            <p style={{ fontSize: '14px', lineHeight: 1.6, color: '#475569', margin: '0 0 20px 0' }}>
              La interfaz visual ha encontrado un problema. Sus notas y datos locales permanecen a salvo en la memoria de su dispositivo.
            </p>
            {this.state.error?.message && (
              <pre style={{
                background: '#f1f5f9',
                padding: '10px',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#dc2626',
                textAlign: 'left',
                overflowX: 'auto',
                marginBottom: '20px',
                whiteSpace: 'pre-wrap',
              }}>
                {this.state.error.message}
              </pre>
            )}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                type="button"
                className="nt-btn nt-btn--primario"
                style={{ padding: '10px 20px', fontSize: '14px', cursor: 'pointer' }}
                onClick={() => this.recargar()}
              >
                Recargar la aplicación
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
