const express = require('express');
const cors = require('cors');
const { requireInternalNetwork } = require('./middleware/internalNetwork');
require('dotenv').config();

const app = express();

const allowedOrigins = String(process.env.FRONTEND_URL || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    // Requests without an Origin header are typically health checks or local tools.
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin) || origin.endsWith('.app.github.dev')) {
      return callback(null, true);
    }
    return callback(new Error('Origen no permitido por CORS'));
  },
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
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
