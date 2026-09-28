const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate, requireManager } = require('../middleware/auth');

router.get('/departamentos', authController.listarDepartamentos);
router.post('/login', authController.login);
router.post('/registro', authenticate, requireManager, authController.registrar);

module.exports = router;