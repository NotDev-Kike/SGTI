const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate, requireManager } = require('../middleware/auth');
const { hashToken, registrarEvento } = require('../services/auditService');

router.get('/departamentos', authController.listarDepartamentos);
router.get('/administradores', authenticate, authController.listarAdministradoresPorDepartamento);
router.get('/configuracion-publica', authController.configuracionPublica);
router.post('/login', authController.login);
router.post('/registro', authenticate, requireManager, authController.registrar);
router.post('/logout', authenticate, async (req, res) => {
  const db = require('../config/db');
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  await db.query('UPDATE sesiones_usuario SET conectado=FALSE, ultima_actividad=CURRENT_TIMESTAMP WHERE usuario_id=$1 AND token_hash=$2 AND conectado=TRUE', [req.user.id, hashToken(token)]).catch(() => {});
  await registrarEvento({ req, evento: 'sesion.cierre', entidad: 'usuario', entidadId: req.user.id, detalle: { motivo: 'Cierre de sesión solicitado por el usuario' } });
  res.json({ success: true });
});

module.exports = router;
