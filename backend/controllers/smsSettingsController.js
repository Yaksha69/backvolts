const SmsSettings = require('../models/SmsSettings');

const getSmsSettings = async (req, res) => {
    console.log('📋 GET /api/v1/sms-settings - Request received');
    
    try {
        let smsSettings = await SmsSettings.findOne();
        
        if (!smsSettings) {
            // Create default settings if none exist
            smsSettings = new SmsSettings({
                phoneNumbers: [],
                enableAlerts: false,
                thresholds: {
                    caution: true,
                    extremeCaution: true,
                    danger: true,
                    extremeDanger: true
                },
                cooldownMinutes: 30,
                lastAlertTimes: new Map(),
                customAlerts: [],
                scheduledAlerts: []
            });
            await smsSettings.save();
        }
        
        res.status(200).json({
            success: true,
            data: smsSettings,
            message: 'SMS settings retrieved successfully'
        });
        
        console.log('✅ SMS settings sent:', smsSettings);
    } catch (error) {
        console.error('❌ Error getting SMS settings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve SMS settings',
            message: error.message
        });
    }
};

const updateSmsSettings = async (req, res) => {
    console.log('📝 PUT /api/v1/sms-settings - Request received');
    console.log('📋 Body:', req.body);
    
    try {
        const {
            phoneNumbers,
            enableAlerts,
            thresholds,
            cooldownMinutes,
            customAlerts,
            scheduledAlerts
        } = req.body;
        
        let smsSettings = await SmsSettings.findOne();
        
        if (!smsSettings) {
            // Create new settings if none exist
            smsSettings = new SmsSettings({
                phoneNumbers: phoneNumbers || [],
                enableAlerts: enableAlerts || false,
                thresholds: thresholds || {
                    caution: true,
                    extremeCaution: true,
                    danger: true,
                    extremeDanger: true
                },
                cooldownMinutes: cooldownMinutes || 30,
                lastAlertTimes: new Map(),
                customAlerts: customAlerts || [],
                scheduledAlerts: scheduledAlerts || []
            });
        } else {
            // Update existing settings
            if (phoneNumbers !== undefined) smsSettings.phoneNumbers = phoneNumbers;
            if (enableAlerts !== undefined) smsSettings.enableAlerts = enableAlerts;
            if (thresholds !== undefined) smsSettings.thresholds = thresholds;
            if (cooldownMinutes !== undefined) smsSettings.cooldownMinutes = cooldownMinutes;
            if (customAlerts !== undefined) smsSettings.customAlerts = customAlerts;
            if (scheduledAlerts !== undefined) smsSettings.scheduledAlerts = scheduledAlerts;
        }
        
        smsSettings.updatedAt = new Date();
        await smsSettings.save();
        
        console.log('✅ SMS settings updated:', smsSettings);
        
        res.status(200).json({
            success: true,
            data: smsSettings,
            message: 'SMS settings updated successfully'
        });
        
    } catch (error) {
        console.error('❌ Error updating SMS settings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update SMS settings',
            message: error.message
        });
    }
};

const addCustomAlert = async (req, res) => {
    console.log('➕ POST /api/v1/sms-settings/custom-alert - Request received');
    console.log('📋 Body:', req.body);
    
    try {
        const { metric, condition, value, message } = req.body;
        
        if (!metric || !condition || !message || value === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: metric, condition, value, message'
            });
        }
        
        let smsSettings = await SmsSettings.findOne();
        
        if (!smsSettings) {
            // Create default settings if none exist
            smsSettings = new SmsSettings({
                phoneNumbers: [],
                enableAlerts: false,
                thresholds: {
                    caution: true,
                    extremeCaution: true,
                    danger: true,
                    extremeDanger: true
                },
                cooldownMinutes: 30,
                lastAlertTimes: new Map(),
                customAlerts: [],
                scheduledAlerts: []
            });
        }
        
        // Generate unique ID
        const id = Date.now();
        
        const newAlert = {
            id,
            metric,
            condition,
            value: parseFloat(value),
            message
        };
        
        smsSettings.customAlerts.push(newAlert);
        smsSettings.updatedAt = new Date();
        await smsSettings.save();
        
        console.log('✅ Custom alert added:', newAlert);
        
        res.status(201).json({
            success: true,
            data: newAlert,
            message: 'Custom alert added successfully'
        });
        
    } catch (error) {
        console.error('❌ Error adding custom alert:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add custom alert',
            message: error.message
        });
    }
};

const updateCustomAlert = async (req, res) => {
    console.log('✏️ PUT /api/v1/sms-settings/custom-alert/:id - Request received');
    console.log('📋 Body:', req.body);
    
    try {
        const { id, metric, condition, value, message } = req.body;
        
        if (!id || !metric || !condition || !message || value === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: id, metric, condition, value, message'
            });
        }
        
        let smsSettings = await SmsSettings.findOne();
        
        if (!smsSettings) {
            return res.status(404).json({
                success: false,
                error: 'SMS settings not found'
            });
        }
        
        const alertIndex = smsSettings.customAlerts.findIndex(alert => alert.id === parseInt(id));
        
        if (alertIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Custom alert not found'
            });
        }
        
        // Update the alert
        smsSettings.customAlerts[alertIndex] = {
            id: parseInt(id),
            metric,
            condition,
            value: parseFloat(value),
            message
        };
        
        smsSettings.updatedAt = new Date();
        await smsSettings.save();
        
        console.log('✅ Custom alert updated:', smsSettings.customAlerts[alertIndex]);
        
        res.status(200).json({
            success: true,
            data: smsSettings.customAlerts[alertIndex],
            message: 'Custom alert updated successfully'
        });
        
    } catch (error) {
        console.error('❌ Error updating custom alert:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update custom alert',
            message: error.message
        });
    }
};

const deleteCustomAlert = async (req, res) => {
    console.log('🗑️ DELETE /api/v1/sms-settings/custom-alert/:id - Request received');
    console.log('📋 ID:', req.params.id);
    
    try {
        const { id } = req.params;
        
        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'Missing alert ID'
            });
        }
        
        let smsSettings = await SmsSettings.findOne();
        
        if (!smsSettings) {
            return res.status(404).json({
                success: false,
                error: 'SMS settings not found'
            });
        }
        
        const alertIndex = smsSettings.customAlerts.findIndex(alert => alert.id === parseInt(id));
        
        if (alertIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Custom alert not found'
            });
        }
        
        const deletedAlert = smsSettings.customAlerts.splice(alertIndex, 1)[0];
        smsSettings.updatedAt = new Date();
        await smsSettings.save();
        
        console.log('✅ Custom alert deleted:', deletedAlert);
        
        res.status(200).json({
            success: true,
            message: 'Custom alert deleted successfully'
        });
        
    } catch (error) {
        console.error('❌ Error deleting custom alert:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete custom alert',
            message: error.message
        });
    }
};

const addScheduledAlert = async (req, res) => {
    console.log('⏰ POST /api/v1/sms-settings/scheduled-alert - Request received');
    console.log('📋 Body:', req.body);
    
    try {
        const { time, message } = req.body;
        
        if (!time || !message) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: time, message'
            });
        }
        
        let smsSettings = await SmsSettings.findOne();
        
        if (!smsSettings) {
            // Create default settings if none exist
            smsSettings = new SmsSettings({
                phoneNumbers: [],
                enableAlerts: false,
                thresholds: {
                    caution: true,
                    extremeCaution: true,
                    danger: true,
                    extremeDanger: true
                },
                cooldownMinutes: 30,
                lastAlertTimes: new Map(),
                customAlerts: [],
                scheduledAlerts: []
            });
        }
        
        // Generate unique ID
        const id = Date.now();
        
        const newAlert = {
            id,
            time,
            message
        };
        
        smsSettings.scheduledAlerts.push(newAlert);
        smsSettings.updatedAt = new Date();
        await smsSettings.save();
        
        console.log('✅ Scheduled alert added:', newAlert);
        
        res.status(201).json({
            success: true,
            data: newAlert,
            message: 'Scheduled alert added successfully'
        });
        
    } catch (error) {
        console.error('❌ Error adding scheduled alert:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add scheduled alert',
            message: error.message
        });
    }
};

const updateScheduledAlert = async (req, res) => {
    console.log('✏️ PUT /api/v1/sms-settings/scheduled-alert/:id - Request received');
    console.log('📋 Body:', req.body);
    
    try {
        const { id, time, message } = req.body;
        
        if (!id || !time || !message) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: id, time, message'
            });
        }
        
        let smsSettings = await SmsSettings.findOne();
        
        if (!smsSettings) {
            return res.status(404).json({
                success: false,
                error: 'SMS settings not found'
            });
        }
        
        const alertIndex = smsSettings.scheduledAlerts.findIndex(alert => alert.id === parseInt(id));
        
        if (alertIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Scheduled alert not found'
            });
        }
        
        // Update the alert
        smsSettings.scheduledAlerts[alertIndex] = {
            id: parseInt(id),
            time,
            message
        };
        
        smsSettings.updatedAt = new Date();
        await smsSettings.save();
        
        console.log('✅ Scheduled alert updated:', smsSettings.scheduledAlerts[alertIndex]);
        
        res.status(200).json({
            success: true,
            data: smsSettings.scheduledAlerts[alertIndex],
            message: 'Scheduled alert updated successfully'
        });
        
    } catch (error) {
        console.error('❌ Error updating scheduled alert:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update scheduled alert',
            message: error.message
        });
    }
};

const deleteScheduledAlert = async (req, res) => {
    console.log('🗑️ DELETE /api/v1/sms-settings/scheduled-alert/:id - Request received');
    console.log('📋 ID:', req.params.id);
    
    try {
        const { id } = req.params;
        
        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'Missing alert ID'
            });
        }
        
        let smsSettings = await SmsSettings.findOne();
        
        if (!smsSettings) {
            return res.status(404).json({
                success: false,
                error: 'SMS settings not found'
            });
        }
        
        const alertIndex = smsSettings.scheduledAlerts.findIndex(alert => alert.id === parseInt(id));
        
        if (alertIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Scheduled alert not found'
            });
        }
        
        const deletedAlert = smsSettings.scheduledAlerts.splice(alertIndex, 1)[0];
        smsSettings.updatedAt = new Date();
        await smsSettings.save();
        
        console.log('✅ Scheduled alert deleted:', deletedAlert);
        
        res.status(200).json({
            success: true,
            message: 'Scheduled alert deleted successfully'
        });
        
    } catch (error) {
        console.error('❌ Error deleting scheduled alert:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete scheduled alert',
            message: error.message
        });
    }
};

module.exports = {
    getSmsSettings,
    updateSmsSettings,
    addCustomAlert,
    updateCustomAlert,
    deleteCustomAlert,
    addScheduledAlert,
    updateScheduledAlert,
    deleteScheduledAlert
};
