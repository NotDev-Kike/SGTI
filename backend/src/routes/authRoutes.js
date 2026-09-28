const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.get('/departamentos', authController.listarDepartamentos);
router.post('/login', authController.login);
router.post('/registro', authController.registrar);

module.exports = router;