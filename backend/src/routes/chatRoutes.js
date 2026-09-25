const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

router.get('/:ticket_id/mensajes', chatController.obtenerMensajesTicket);
router.post('/:ticket_id/mensajes', chatController.enviarMensaje);

module.exports = router;