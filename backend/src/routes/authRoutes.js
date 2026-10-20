const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate, requireManager } = require('../middleware/auth');

router.get('/departamentos', authController.listarDepartamentos);
router.get('/configuracion-publica', authController.configuracionPublica);
router.post('/login', authController.login);
router.post('/registro', authenticate, requireManager, authController.registrar);
router.post('/logout', authenticate, async (req, res) => {
  const db = require('../config/db');
  await db.query('UPDATE sesiones_usuario SET conectado=FALSE, ultima_actividad=CURRENT_TIMESTAMP WHERE usuario_id=$1 AND conectado=TRUE', [req.user.id]).catch(() => {});
  res.json({ success: true });
});

module.exports = router;
