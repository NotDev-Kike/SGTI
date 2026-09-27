const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const directChatController = require('../controllers/directChatController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);
router.get('/directo/admins', directChatController.listarAdmins);
router.get('/directo', directChatController.listarConversaciones);
router.post('/directo', directChatController.enviarMensaje);
router.get('/:ticket_id/mensajes', chatController.obtenerMensajesTicket);
router.post('/:ticket_id/mensajes', chatController.enviarMensaje);

module.exports = router;