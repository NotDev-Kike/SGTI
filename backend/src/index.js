const express = require('express');
const cors = require('cors');
const { requireInternalNetwork } = require('./middleware/internalNetwork');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', true);
app.use(requireInternalNetwork);

app.use('/api/chat', require('./routes/chatRoutes'));
app.use('/api/asistencia-remota', require('./routes/remoteAssistanceRoutes'));

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/microsoft', require('./routes/microsoftPersonalRoutes'));

// Importar Rutas
const ticketRoutes = require('./routes/ticketRoutes');
app.use('/api/tickets', ticketRoutes);
app.use('/api/admin', require('./middleware/auth').authenticate, require('./routes/adminRoutes'));

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`Servidor corriendo en http://${HOST}:${PORT}`);
  require('./services/emailService').iniciarRecordatoriosCorreo();
});
