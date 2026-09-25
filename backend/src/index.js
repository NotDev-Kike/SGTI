const express = require('express');
const cors = require('cors');
require('dotenv').config();

const ticketRoutes = require('./routes/ticketRoutes');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/tickets', ticketRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Servidor SGTI corriendo en el puerto ${PORT}`);
});