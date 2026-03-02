# Heat Monitor System

A comprehensive heat monitoring system that tracks temperature, humidity, heat index, and light levels using ESP32 and provides real-time visualization through a web dashboard.

## 🌡️ Features

- **Real-time Sensor Monitoring**: Temperature, humidity, heat index, and light level tracking
- **Web Dashboard**: Modern, responsive dashboard with live data visualization
- **Heat Alerts**: Automated SMS alerts based on heat index thresholds
- **Data Persistence**: MongoDB backend for historical data storage
- **WebSocket Communication**: Real-time updates between backend and frontend
- **Mobile Responsive**: Works seamlessly on desktop and mobile devices

## 📋 System Components

### Backend (Node.js + Express)
- RESTful API for sensor data
- WebSocket server for real-time updates
- MongoDB integration for data persistence
- CORS enabled for frontend communication

### Frontend (HTML/CSS/JavaScript)
- Real-time sensor data display
- Interactive charts using Chart.js
- Heat alert system
- Connection status indicator
- Responsive design

### ESP32 Device
- DHT22 temperature and humidity sensor
- Light sensor (analog)
- LCD display for local monitoring
- WiFi connectivity
- SMS alert system via iProg SMS API

## 🚀 Setup Instructions

### Backend Setup

1. **Install Dependencies**
   ```bash
   cd backend
   npm install
   ```

2. **Environment Configuration**
   Create a `.env` file in the backend directory:
   ```
   DB_URI=mongodb://localhost:27017/heat_monitor
   PORT=3001
   ```

3. **Start Backend Server**
   ```bash
   npm start
   ```

### Frontend Setup

1. **Serve the Frontend**
   The frontend can be served using any static web server. For example, using Python:
   ```bash
   cd frontend
   python -m http.server 8080
   ```
   Or using Node.js:
   ```bash
   npx serve frontend -p 8080
   ```

2. **Access Dashboard**
   Open your browser and navigate to `http://localhost:8080`

### ESP32 Setup

1. **Install Arduino Libraries**
   - DHT sensor library
   - ArduinoJson library
   - LiquidCrystal I2C library

2. **Configure WiFi and Backend URL**
   Update the following in `esp32_heat_monitor.ino`:
   ```cpp
   const char* ssid = "your_wifi_name";
   const char* password = "your_wifi_password";
   String backendUrl = "http://your-backend-server.com"; // Your backend server IP/domain
   ```

3. **Upload to ESP32**
   - Connect your ESP32 to your computer
   - Select the correct board and port in Arduino IDE
   - Upload the sketch

## 📊 Dashboard Features

### Sensor Cards
- **Temperature**: Current temperature with trend indicator
- **Humidity**: Current humidity percentage with trend
- **Heat Index**: Calculated heat index with alert level
- **Light Level**: Current light level with status (SUNNY/CLOUDY/DARK)

### Real-time Charts
- Temperature & Heat Index trend graph
- Humidity & Light level trend graph
- Auto-updating every 500ms

### Alert System
- **Normal**: Heat Index < 27°C
- **Caution**: Heat Index 27-32°C
- **Extreme Caution**: Heat Index 32-41°C
- **Danger**: Heat Index 41-54°C
- **Extreme Danger**: Heat Index > 54°C

## 🔧 API Endpoints

### POST /api/v1/data/new
Accepts sensor data in JSON format:
```json
{
  "temperature": 25.5,
  "humidity": 60,
  "heatIndex": 27.2,
  "light": 75
}
```

### GET /api/v1/data/all
Returns all stored sensor data.

## 📱 SMS Alerts

The system automatically sends SMS alerts when heat index thresholds are exceeded. Configure your SMS settings in the ESP32 code:

```cpp
String apiToken = "your_iprog_sms_token";
String phoneNumbers = "639761700936,639275778126";
```

## 🛠️ Technologies Used

### Backend
- Node.js
- Express.js
- MongoDB with Mongoose
- WebSocket (ws library)
- CORS

### Frontend
- HTML5
- CSS3 with modern features
- JavaScript (ES6+)
- Chart.js for data visualization
- WebSocket API

### Hardware
- ESP32 microcontroller
- DHT22 sensor
- 16x2 LCD with I2C
- Light sensor (photoresistor)
- Breadboard and jumper wires

## 📈 Data Flow

1. **ESP32** reads sensor data every 2 seconds
2. **ESP32** sends data to backend every 10 seconds via HTTP POST
3. **Backend** stores data in MongoDB
4. **Backend** broadcasts new data to connected WebSocket clients
5. **Frontend** receives updates and displays them in real-time

## 🔍 Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   - Ensure backend is running on correct port
   - Check CORS settings
   - Verify firewall settings

2. **ESP32 Cannot Connect to WiFi**
   - Check WiFi credentials
   - Ensure ESP32 is within range
   - Verify network settings

3. **Data Not Displaying**
   - Check browser console for errors
   - Verify backend API is accessible
   - Ensure MongoDB is running

4. **SMS Alerts Not Working**
   - Verify iProg SMS API token
   - Check phone number format
   - Ensure ESP32 has internet connectivity

## 📄 License

This project is open source and available under the MIT License.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

For support and questions, please open an issue in the repository.
