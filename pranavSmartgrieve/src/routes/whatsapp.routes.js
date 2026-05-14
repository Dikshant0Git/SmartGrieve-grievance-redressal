const express = require('express');
const router = express.Router();
const {handleWebhookVerification,handleIncomingMessage} = require('../controllers/whatsapp.controller.js');

// GET for the handshake, POST for the messages
router.get('/webhook', handleWebhookVerification);
router.post('/webhook', handleIncomingMessage);

module.exports = router;