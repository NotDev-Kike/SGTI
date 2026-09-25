const express = require('express');
const router = express.Router();
const {
  crearTicket,
  obtenerTickets,
  resolverTicket,
  obtenerHistorialLogs
} = require('../controllers/ticketController');

router.post('/crear', crearTicket);
router.get('/listar', obtenerTickets);
router.put('/resolver/:id', resolverTicket);
router.get('/historial', obtenerHistorialLogs);

module.exports = router;