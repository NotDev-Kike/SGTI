const express = require('express');
const router = express.Router();
const ticketAdvancedController = require('../controllers/ticketAdvancedController');
const upload = require('../middleware/upload');

// Rutas avanzadas
router.get('/filtrar', ticketAdvancedController.obtenerTicketsAvanzado);
router.put('/:ticket_id/reasignar', ticketAdvancedController.reasignarTicket);
router.get('/reportes/exportar', ticketAdvancedController.exportarReportesCSV);

module.exports = router;