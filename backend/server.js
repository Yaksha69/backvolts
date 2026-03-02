require('dotenv').config();

console.log('Starting server...');
console.log('PORT:', process.env.PORT);
console.log('DB_URI:', process.env.DB_URI ? 'SET' : 'NOT SET');

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { WebSocketServer } = require('ws');

// Import your data routes
const dataRoutes = require('./routes/dataRoutes');
const Data = require('./models/Data');

const app = express();

app.use(cors({
    origin: '*', // Your frontend URL
    methods: ['GET', 'POST'],
}));

app.use(express.json());

// Define routes before database connection
const requestMapper = '/api/v1';
app.use(requestMapper + '/data', dataRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

app.use((req, res) => {
    res.status(404).json({ error: "No such method exists" });
});

// Connect to MongoDB
mongoose.connect(process.env.DB_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    bufferCommands: false
})
    .then(() => {
        const server = app.listen(process.env.PORT, () => {
            console.log('✅ Connected to the database...');
            console.log('✅ Server listening on port:', process.env.PORT);
            console.log('✅ Health check available at: /health');
            console.log('✅ API available at: /api/v1/data');
        });

        // WebSocket server initialization
        const wss = new WebSocketServer({ server });
        console.log('✅ WebSocket server initialized');

        let lastSentData = null;

        // Send data to all connected WebSocket clients
        const sendDataToClients = async () => {
            try {
                // Fetch last 10 data points from the database, sorted by creation time
                const allData = await Data.find()
                    .sort({ createdAt: -1 })
                    .limit(10);  // Limit to 10 most recent entries
                
                // Reverse the array so it's in chronological order
                const orderedData = allData.reverse();
                
                if (orderedData.length > 0) {
                    wss.clients.forEach(client => {
                        if (client.readyState === client.OPEN) {
                            client.send(JSON.stringify({ type: 'initial', data: orderedData }));
                        }
                    });
                }
            } catch (error) {
                console.error('Error fetching data from database:', error);
            }
        };

        // Send updates for new data
        const sendNewDataToClients = async () => {
            try {
                const latestData = await Data.findOne().sort({ createdAt: -1 });
                
                // Only send if we have new data (comparing timestamps)
                if (latestData && (!lastSentData || latestData.createdAt > lastSentData.createdAt)) {
                    lastSentData = latestData;
                    wss.clients.forEach(client => {
                        if (client.readyState === client.OPEN) {
                            client.send(JSON.stringify({ type: 'update', data: latestData }));
                        }
                    });
                }
            } catch (error) {
                console.error('Error fetching latest data:', error);
            }
        };

        // When a client connects, send initial data and store the last sent data
        wss.on('connection', async (ws) => {
            console.log('Client connected');
            await sendDataToClients();
            // Store the most recent data point
            lastSentData = await Data.findOne().sort({ createdAt: -1 });
        });

        // Update with new data every 500ms
        setInterval(sendNewDataToClients, 500);

    })
    .catch(err => {
        console.log('Database connection error:', err);
        console.log('Server will continue running without database...');
        
        // Start server even if database fails
        const server = app.listen(process.env.PORT, () => {
            console.log('Server running on port ', process.env.PORT);
        });
    });

// Handle process events to prevent early exit
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('SIGTERM', () => {
    console.log('📡 SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('📡 SIGINT received, shutting down gracefully');
    process.exit(0);
});

// Handle any unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.error('❌ Unhandled Promise Rejection:', err);
});
