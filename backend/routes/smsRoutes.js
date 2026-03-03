const express = require('express')
const router = express.Router()

const { sendSms } = require('../controllers/smsController')

// POST REQUEST - Send SMS
router.post('/send', sendSms)

module.exports = router
