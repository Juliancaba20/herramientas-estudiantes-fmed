import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Tipografías propias (sin depender de Google Fonts, para que funcionen sin conexión)
import '@fontsource/figtree/latin-400.css';
import '@fontsource/figtree/latin-500.css';
import '@fontsource/figtree/latin-600.css';
import '@fontsource/figtree/latin-700.css';
import '@fontsource/figtree/latin-400-italic.css';
import '@fontsource/figtree/latin-700-italic.css';
import '@fontsource/newsreader/latin-500.css';
import '@fontsource/newsreader/latin-600.css';
import './estilos/variables.css';
import './estilos/tema.css';
import './estilos/biblioteca.css';
import './estilos/editor.css';
import './estilos/impresion.css';
import App from './app/App.jsx';
import { iniciarPWA } from './pwa/pwa.js';

iniciarPWA();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
