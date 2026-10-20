const express = require('express');
const router = express.Router();
const controller = require('../controllers/microsoftPersonalController');
const { authenticate } = require('../middleware/auth');

router.get('/callback', controller.callback);
router.get('/login', controller.login);
router.get('/login/callback', controller.loginCallback);
router.get('/login/exchange', controller.exchangeLoginCode);
router.use(authenticate);
router.get('/connect', controller.connect);
router.get('/status', controller.status);
router.get('/events', controller.events);
router.get('/messages', controller.messages);
router.post('/events', controller.createEvent);

module.exports = router;
