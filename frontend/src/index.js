import React from 'react';
import ReactDOM from 'react-dom/client';
import './tailwind.css'; // Importa el archivo de estilos limpio desde la misma carpeta src/
import App from './components/App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);