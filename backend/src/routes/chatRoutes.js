const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const directChatController = require('../controllers/directChatController');
const evidenceImageController = require('../controllers/evidenceImageController');
const { authenticate } = require('../middleware/auth');
const { parseEvidenceImages, validarImagenes } = require('../middleware/uploadEvidenceImages');

router.use(authenticate);
router.get('/imagenes/:image_id', evidenceImageController.leerImagen);
router.get('/directo/admins', directChatController.listarAdmins);
router.get('/directo', directChatController.listarConversaciones);
router.post('/directo', parseEvidenceImages, validarImagenes, directChatController.enviarMensaje);
router.get('/:ticket_id/imagenes', chatController.leerImagenTicket);
router.get('/:ticket_id/mensajes', chatController.obtenerMensajesTicket);
router.post('/:ticket_id/mensajes', parseEvidenceImages, validarImagenes, chatController.enviarMensaje);

module.exports = router;