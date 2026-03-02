const { response } = require('express')
const Data = require('../models/Data')
const mongoose = require('mongoose')


const addData = async(req, res) =>{
    console.log('📝 POST /api/v1/data/new - Request received');
    console.log('📝 Body:', req.body);
    
    const {temperature, humidity, heatIndex, light} = req.body

    try{
        const new_data = await Data.create({temperature, humidity, heatIndex, light})
        console.log('✅ Data saved successfully:', new_data);
        res.status(200).json(new_data)
    }catch(err){
        console.error('❌ Error saving data:', err);
        res.status(500).json({error: err.message})
    }
}

const  getAllData = async(req, res) =>{
    console.log('📋 GET /api/v1/data/all - Request received');
    
    try{
        const data = await Data.find({})
        console.log('✅ Found', data.length, 'data records');
        res.status(200).json(data)
    }catch(err){
        console.error('❌ Error fetching data:', err);
        res.status(500).json({error: err.message})
    }
}

/*const  getData = async(req, res) =>{ 
    const data =   await Data.find({createdAt: })
    res.status(200).json(data)
}*/


module.exports = {
    addData,
    getAllData,
}
