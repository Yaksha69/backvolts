// Simple test to verify server starts correctly
require('dotenv').config();

console.log('🧪 Testing server startup...');
console.log('PORT from env:', process.env.PORT);
console.log('DB_URI set:', !!process.env.DB_URI);

const express = require('express');
const app = express();

app.get('/test', (req, res) => {
    res.json({ message: 'Server is working!', timestamp: new Date().toISOString() });
});

const server = app.listen(process.env.PORT || 7000, () => {
    console.log('✅ Test server running on port:', process.env.PORT || 7000);
    console.log('✅ Test endpoint: /test');
});

// Test for 10 seconds then exit
setTimeout(() => {
    console.log('✅ Server test completed');
    server.close();
    process.exit(0);
}, 10000);
