const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const adminRoutes = require('./routes/adminRoutes'); // Opcional si creaste rutas admin adicionales

const app = express();

app.use(cors());
app.use(express.json());

// Endpoints oficiales conectados a Supabase
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/admin', adminRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor backend conectado a Supabase en el puerto ${PORT}`);
});