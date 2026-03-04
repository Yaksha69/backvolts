const express = require('express')
const router = express.Router()

const {
    getSmsSettings,
    updateSmsSettings,
    addCustomAlert,
    updateCustomAlert,
    deleteCustomAlert,
    addScheduledAlert,
    updateScheduledAlert,
    deleteScheduledAlert
} = require('../controllers/smsSettingsController')

// GET REQUEST - Get SMS settings
router.get('/', getSmsSettings)

// PUT REQUEST - Update SMS settings
router.put('/', updateSmsSettings)

// Custom Alerts
router.post('/custom-alert', addCustomAlert)
router.put('/custom-alert/:id', updateCustomAlert)
router.delete('/custom-alert/:id', deleteCustomAlert)

// Scheduled Alerts
router.post('/scheduled-alert', addScheduledAlert)
router.put('/scheduled-alert/:id', updateScheduledAlert)
router.delete('/scheduled-alert/:id', deleteScheduledAlert)

module.exports = router
