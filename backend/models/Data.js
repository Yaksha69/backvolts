const mongoose = require('mongoose')

const Schema = mongoose.Schema

const DataSchema = new Schema({
    temperature: {
        type: Number,
        required: true,
    },
    humidity: {
        type: Number,
        required: true
    },
    heatIndex: {
        type: Number,
        required: true
    },
    light: {
        type: Number,
        required: true
    }
    

}, {timestamps: true})

module.exports = mongoose.model('Data', DataSchema)