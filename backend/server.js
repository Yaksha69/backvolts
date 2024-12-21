require('dotenv').config();

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

// Connect to MongoDB
mongoose.connect(process.env.DB_URI)
    .then(() => {
        const server = app.listen(process.env.PORT, () => {
            console.log('Connected to the database...');
            console.log('Listening on port ', process.env.PORT);
        });

        // WebSocket server initialization
        const wss = new WebSocketServer({ server });

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
        console.log(err);
    });

const requestMapper = '/api/v1';
app.use(requestMapper + '/data', dataRoutes);

app.use((req, res) => {
    res.status(404).json({ error: "No such method exists" });
});
