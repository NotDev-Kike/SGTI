const express = require('express');
const router = express.Router();
const controller = require('../controllers/remoteAssistanceController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate);
router.get('/mias', controller.listarPropias);
router.post('/', controller.solicitar);
router.get('/', requireAdmin, controller.listarPendientes);
router.patch('/:id/tomar', requireAdmin, controller.tomar);
router.patch('/:id/finalizar', requireAdmin, controller.finalizar);
router.patch('/:id/cancelar', controller.cancelar);

module.exports = router;
