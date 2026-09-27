const express = require('express');
const router = express.Router();
const controller = require('../controllers/adminYUsuarioController');

// Usuarios y Rectificaciones
router.post('/usuarios', controller.crearModificarUsuario);
router.delete('/usuarios/:id', controller.eliminarUsuario);

// Tickets de todos (Semáforo y control Admin)
router.get('/tickets/todos', controller.listarTicketsAdmin);
router.put('/tickets/:id/modificar', controller.moverOResolverTicket);

// Proyectos de TI
router.post('/proyectos-ti', controller.gestionarProyectoTI);

// Chat directo
router.post('/chat-directo', controller.enviarChatDirecto);

module.exports = router;