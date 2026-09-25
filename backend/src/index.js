const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Carpeta pública para almacenar las fotos adjuntas
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/chat', require('./routes/chatRoutes'));

app.use('/api/auth', require('./routes/authRoutes'));

// Importar Rutas
const ticketRoutes = require('./routes/ticketRoutes');
app.use('/api/tickets', ticketRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});