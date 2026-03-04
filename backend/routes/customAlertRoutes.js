const express = require('express')
const router = express.Router()

const {
    getCustomAlerts,
    addCustomAlert,
    updateCustomAlert,
    deleteCustomAlert
} = require('../controllers/customAlertController')

// GET REQUEST - Get all custom alerts
router.get('/', getCustomAlerts)

// POST REQUEST - Add new custom alert
router.post('/', addCustomAlert)

// PUT REQUEST - Update custom alert
router.put('/:id', updateCustomAlert)

// DELETE REQUEST - Delete custom alert
router.delete('/:id', deleteCustomAlert)

module.exports = router
