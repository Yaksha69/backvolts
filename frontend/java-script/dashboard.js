class HeatMonitorDashboard {
    constructor() {
        this.ws = null;
        this.tempChart = null;
        this.humidityChart = null;
        this.heatIndexChart = null;
        this.lightChart = null;
        this.data = [];
        this.maxDataPoints = 20;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        this.init();
    }

    init() {
        this.connectWebSocket();
        this.initCharts();
        this.updateConnectionStatus('connecting');
    }

    connectWebSocket() {
        // Connect to specific Render backend
        const wsUrl = 'wss://backvolts.onrender.com';
        
        try {
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.updateConnectionStatus('connected');
                this.reconnectAttempts = 0;
            };
            
            this.ws.onmessage = (event) => {
                const message = JSON.parse(event.data);
                this.handleMessage(message);
            };
            
            this.ws.onclose = () => {
                console.log('WebSocket disconnected');
                this.updateConnectionStatus('disconnected');
                this.attemptReconnect();
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateConnectionStatus('error');
            };
        } catch (error) {
            console.error('Failed to connect WebSocket:', error);
            this.updateConnectionStatus('error');
            this.attemptReconnect();
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            
            setTimeout(() => {
                this.connectWebSocket();
            }, 3000 * this.reconnectAttempts);
        } else {
            this.updateConnectionStatus('failed');
            this.showAlert('Connection failed. Please refresh the page.', 'error');
        }
    }

    handleMessage(message) {
        if (message.type === 'initial') {
            this.data = message.data;
            this.updateDashboard();
        } else if (message.type === 'update') {
            this.addDataPoint(message.data);
        }
    }

    addDataPoint(newData) {
        this.data.push(newData);
        
        if (this.data.length > this.maxDataPoints) {
            this.data.shift();
        }
        
        this.updateDashboard();
    }

    updateDashboard() {
        if (this.data.length === 0) return;
        
        this.updateCharts();
    }

    initCharts() {
        const tempCtx = document.getElementById('tempChart').getContext('2d');
        const humidityCtx = document.getElementById('humidityChart').getContext('2d');
        const heatIndexCtx = document.getElementById('heatIndexChart').getContext('2d');
        const lightCtx = document.getElementById('lightChart').getContext('2d');
        
        this.tempChart = new Chart(tempCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Temperature (°C)',
                    data: [],
                    borderColor: '#ff6b6b',
                    backgroundColor: 'rgba(255, 107, 107, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false
                    }
                }
            }
        });
        
        this.humidityChart = new Chart(humidityCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Humidity (%)',
                    data: [],
                    borderColor: '#48dbfb',
                    backgroundColor: 'rgba(72, 219, 251, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
        
        this.heatIndexChart = new Chart(heatIndexCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Heat Index (°C)',
                    data: [],
                    borderColor: '#ee5a6f',
                    backgroundColor: 'rgba(238, 90, 111, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false
                    }
                }
            }
        });
        
        this.lightChart = new Chart(lightCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Light Level (%)',
                    data: [],
                    borderColor: '#feca57',
                    backgroundColor: 'rgba(254, 202, 87, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    }

    updateCharts() {
        const labels = this.data.map((_, index) => {
            const date = new Date(this.data[index].createdAt);
            return date.toLocaleTimeString();
        });
        
        const temperatures = this.data.map(d => d.temperature);
        const humidities = this.data.map(d => d.humidity);
        const heatIndexes = this.data.map(d => d.heatIndex);
        const lightLevels = this.data.map(d => d.light);
        
        this.tempChart.data.labels = labels;
        this.tempChart.data.datasets[0].data = temperatures;
        this.tempChart.update();
        
        this.humidityChart.data.labels = labels;
        this.humidityChart.data.datasets[0].data = humidities;
        this.humidityChart.update();
        
        this.heatIndexChart.data.labels = labels;
        this.heatIndexChart.data.datasets[0].data = heatIndexes;
        this.heatIndexChart.update();
        
        this.lightChart.data.labels = labels;
        this.lightChart.data.datasets[0].data = lightLevels;
        this.lightChart.update();
    }

    updateConnectionStatus(status) {
        const statusElement = document.getElementById('connectionStatus');
        const statusDot = statusElement.querySelector('.status-dot');
        const statusText = statusElement.querySelector('.status-text');
        
        statusDot.className = 'status-dot';
        
        switch (status) {
            case 'connected':
                statusDot.classList.add('connected');
                statusText.textContent = 'Connected';
                break;
            case 'connecting':
                statusText.textContent = 'Connecting...';
                break;
            case 'disconnected':
                statusText.textContent = 'Disconnected';
                break;
            case 'error':
                statusText.textContent = 'Connection Error';
                break;
            case 'failed':
                statusText.textContent = 'Connection Failed';
                break;
        }
    }

    showAlert(message, type = 'info') {
        console.log(message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new HeatMonitorDashboard();
});
