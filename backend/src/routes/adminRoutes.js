const express = require('express');
const router = express.Router();
const controller = require('../controllers/adminYUsuarioController');

// Usuarios y Rectificaciones
router.get('/usuarios', controller.listarUsuarios);
router.post('/usuarios', controller.crearModificarUsuario);
router.delete('/usuarios/:id', controller.eliminarUsuario);

// Tickets de todos (Semáforo y control Admin)
router.get('/tickets/todos', controller.listarTicketsAdmin);
router.put('/tickets/:id/modificar', controller.moverOResolverTicket);

// Proyectos de TI
router.get('/proyectos-ti', controller.listarProyectos);
router.post('/proyectos-ti', controller.gestionarProyectoTI);
router.delete('/proyectos-ti/:id', controller.eliminarProyectoTI);

// Organización administrativa
router.get('/tareas', controller.listarTareas);
router.post('/tareas', controller.guardarTarea);
router.delete('/tareas/:id', controller.eliminarTarea);
router.get('/calendario', controller.listarCalendario);
router.get('/configuraciones', controller.leerConfiguracion);
router.put('/configuraciones', controller.guardarConfiguracion);

module.exports = router;