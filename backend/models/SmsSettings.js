const mongoose = require('mongoose');

const smsSettingsSchema = new mongoose.Schema({
    phoneNumbers: [{
        type: String,
        required: true
    }],
    enableAlerts: {
        type: Boolean,
        default: false
    },
    thresholds: {
        caution: { type: Boolean, default: true },
        extremeCaution: { type: Boolean, default: true },
        danger: { type: Boolean, default: true },
        extremeDanger: { type: Boolean, default: true }
    },
    cooldownMinutes: {
        type: Number,
        default: 30,
        min: 1,
        max: 1440
    },
    lastAlertTimes: {
        type: Map,
        of: String,
        default: new Map()
    },
    customAlerts: [{
        id: {
            type: Number,
            required: true
        },
        metric: {
            type: String,
            enum: ['temperature', 'heatIndex'],
            required: true
        },
        condition: {
            type: String,
            enum: ['greater', 'less', 'equal'],
            required: true
        },
        value: {
            type: Number,
            required: true
        },
        message: {
            type: String,
            required: true
        }
    }],
    scheduledAlerts: [{
        id: {
            type: Number,
            required: true
        },
        time: {
            type: String,
            required: true
        },
        message: {
            type: String,
            required: true
        }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Create a compound index for unique IDs within customAlerts
smsSettingsSchema.path('customAlerts.id').index({ unique: true });
smsSettingsSchema.path('scheduledAlerts.id').index({ unique: true });

module.exports = mongoose.model('SmsSettings', smsSettingsSchema);
