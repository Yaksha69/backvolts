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
        this.pollingInterval = null;
        this.usePolling = false;

        this.smsSettings = {
            phoneNumbers: [],
            enableAlerts: false,
            thresholds: {
                caution: true,
                extremeCaution: true,
                danger: true,
                extremeDanger: true
            },
            cooldownMinutes: 30,
            lastAlertTimes: {},
            customAlerts: [],
            scheduledAlerts: []
        };

        this.pingInterval = null;
        this.pingUrl = 'https://backvolts.onrender.com/api/v1/data/all';

        this.init();
    }

    init() {
        this.connectWebSocket();
        this.initCharts();
        this.initSmsModal();
        this.loadSmsSettings();
        this.startSelfPing();
        this.updateConnectionStatus('connecting');
    }

    connectWebSocket() {
        const wsUrl = 'wss://backvolts.onrender.com';
        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.updateConnectionStatus('connected');
                this.reconnectAttempts = 0;
                this.usePolling = false;
                if (this.pollingInterval) {
                    clearInterval(this.pollingInterval);
                    this.pollingInterval = null;
                }
            };

            this.ws.onmessage = (event) => {
                const message = JSON.parse(event.data);
                this.handleMessage(message);
            };

            this.ws.onclose = () => {
                console.log('WebSocket disconnected');
                this.updateConnectionStatus('disconnected');
                this.startPolling();
                this.attemptReconnect();
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateConnectionStatus('error');
                this.startPolling();
            };
        } catch (error) {
            console.error('Failed to connect WebSocket:', error);
            this.updateConnectionStatus('error');
            this.startPolling();
            this.attemptReconnect();
        }
    }

    startPolling() {
        if (this.pollingInterval) return;

        console.log('Starting polling fallback');
        this.usePolling = true;
        this.updateConnectionStatus('connected');

        this.pollingInterval = setInterval(() => {
            this.fetchLatestData();
        }, 2000);

        this.fetchLatestData();
    }

    async fetchLatestData() {
        try {
            const response = await fetch('https://backvolts.onrender.com/api/v1/data/all');
            if (!response.ok) {
                console.error('API Response not OK:', response.status);
                return;
            }

            const data = await response.json();
            if (data && data.length > 0) {
                const latestData = data[data.length - 1];
                if (this.data.length === 0 ||
                    new Date(latestData.createdAt) > new Date(this.data[this.data.length - 1].createdAt)) {

                    this.data.push(latestData);
                    if (this.data.length > this.maxDataPoints) this.data.shift();
                    this.updateDashboard();
                }
            }
        } catch (error) {
            console.error('Polling error:', error);
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            setTimeout(() => this.connectWebSocket(), 3000 * this.reconnectAttempts);
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
        if (this.data.length > this.maxDataPoints) this.data.shift();
        this.updateDashboard();
    }

    updateDashboard() {
        if (!this.data.length) return;
        this.updateCharts();
        this.checkHeatIndexAlerts();
    }

    initCharts() {
        const tempCtx = document.getElementById('tempChart').getContext('2d');
        const humidityCtx = document.getElementById('humidityChart').getContext('2d');
        const heatIndexCtx = document.getElementById('heatIndexChart').getContext('2d');
        const lightCtx = document.getElementById('lightChart').getContext('2d');

        const chartOptions = (label, borderColor, bgColor, yMax) => ({
            type: 'line',
            data: { labels: [], datasets: [{ label, data: [], borderColor, backgroundColor: bgColor, tension: 0.4, fill: true }] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, max: yMax } }
            }
        });

        this.tempChart = new Chart(tempCtx, chartOptions('Temperature (°C)', '#ff6b6b', 'rgba(255,107,107,0.1)', 50));
        this.humidityChart = new Chart(humidityCtx, chartOptions('Humidity (%)', '#48dbfb', 'rgba(72,219,251,0.1)', 50));
        this.heatIndexChart = new Chart(heatIndexCtx, chartOptions('Heat Index (°C)', '#ee5a6f', 'rgba(238,90,111,0.1)', 25));
        this.lightChart = new Chart(lightCtx, chartOptions('Light Level (%)', '#feca57', 'rgba(254,202,87,0.1)', 50));
    }

    updateCharts() {
        const labels = this.data.map(d => new Date(d.createdAt).toLocaleTimeString());
        const temperatures = this.data.map(d => d.temperature);
        const humidities = this.data.map(d => d.humidity);
        const heatIndexes = this.data.map(d => d.heatIndex);
        const lightLevels = this.data.map(d => d.light);

        const updateChart = (chart, data, range) => {
            chart.data.labels = labels;
            chart.data.datasets[0].data = data;
            chart.options.scales.y.min = range.min;
            chart.options.scales.y.max = range.max;
            chart.update();
        };

        const getRange = arr => ({ min: Math.min(...arr) - 2, max: Math.max(...arr) + 2 });

        updateChart(this.tempChart, temperatures, getRange(temperatures));
        updateChart(this.humidityChart, humidities, getRange(humidities));
        updateChart(this.heatIndexChart, heatIndexes, getRange(heatIndexes));
        updateChart(this.lightChart, lightLevels, getRange(lightLevels));
    }

    updateConnectionStatus(status) {
        const el = document.getElementById('connectionStatus');
        const dot = el.querySelector('.status-dot');
        const text = el.querySelector('.status-text');
        dot.className = 'status-dot';

        switch (status) {
            case 'connected': dot.classList.add('connected'); text.textContent = 'Connected'; break;
            case 'connecting': text.textContent = 'Connecting...'; break;
            case 'disconnected': text.textContent = 'Disconnected'; break;
            case 'error': text.textContent = 'Connection Error'; break;
            case 'failed': text.textContent = 'Connection Failed'; break;
        }
    }

    showAlert(message, type = 'info') { console.log(message); }

    // SMS / Alerts methods
    initSmsModal() { /* your modal init code here */ }
    loadSmsSettings() { /* fetch from backend */ }
    checkHeatIndexAlerts() { /* your alerts logic */ }

    // More methods (custom alerts, scheduled alerts, phone numbers)
    // For brevity, you can reuse your original functions here
}

// Initialize dashboard
window.dashboard = new HeatMonitorDashboard();