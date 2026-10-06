const express = require('express');
const router = express.Router();
const controller = require('../controllers/adminYUsuarioController');
const evidenceImageController = require('../controllers/evidenceImageController');
const { requireAdmin, requireManager, requireInfrastructure } = require('../middleware/auth');

// Planificación personal: usuarios finales solo acceden a sus propias tareas y calendario.
router.get('/tareas', controller.listarTareas);
router.post('/tareas', controller.guardarTarea);
router.delete('/tareas/:id', controller.eliminarTarea);
router.get('/calendario', controller.listarCalendario);

router.use(requireAdmin);

// Usuarios y Rectificaciones
router.get('/usuarios', requireManager, controller.listarUsuarios);
router.get('/usuarios/archivo', requireManager, controller.listarUsuariosArchivados);
router.get('/usuarios/archivo/:archivoId', requireManager, controller.leerUsuarioArchivado);
router.get('/usuarios/archivo/:archivoId/imagenes/:imagenId', requireManager, evidenceImageController.leerImagenArchivada);
router.post('/usuarios', requireManager, controller.crearModificarUsuario);
router.patch('/usuarios/:id/desactivar', requireManager, controller.desactivarUsuario);
router.delete('/usuarios/:id', requireManager, controller.eliminarUsuario);

// Tickets de todos (Semáforo y control Admin)
router.get('/tickets/eficiencia', controller.listarEficienciaAdmins);
router.get('/tickets/todos', controller.listarTicketsAdmin);
router.put('/tickets/:id/modificar', controller.moverOResolverTicket);
router.put('/tickets/:id/seguimiento', controller.actualizarSeguimientoTicket);

// Proyectos de TI
router.get('/proyectos-ti', controller.listarProyectos);
router.post('/proyectos-ti', controller.gestionarProyectoTI);
router.delete('/proyectos-ti/:id', controller.eliminarProyectoTI);

// Organización administrativa
router.get('/configuraciones', requireManager, controller.leerConfiguracion);
router.put('/configuraciones', requireManager, controller.guardarConfiguracion);
router.get('/configuraciones/correo/estado', requireManager, controller.estadoCorreo);
router.post('/configuraciones/correo/prueba', requireManager, controller.enviarCorreoPrueba);
router.post('/categorias', requireManager, controller.crearCategoria);
router.put('/categorias/:id', requireManager, controller.modificarCategoria);
router.delete('/categorias/:id', requireManager, controller.eliminarCategoria);
router.get('/infraestructura/inventario', requireInfrastructure, controller.listarInventario);
router.post('/infraestructura/inventario', requireInfrastructure, controller.guardarActivo);
router.put('/infraestructura/inventario/:id', requireInfrastructure, controller.guardarActivo);
router.delete('/infraestructura/inventario/:id', requireInfrastructure, controller.eliminarActivo);
router.get('/infraestructura/entregas', requireInfrastructure, controller.listarEntregas);
router.post('/infraestructura/entregas', requireInfrastructure, controller.guardarEntrega);

module.exports = router;