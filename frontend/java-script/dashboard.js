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

        // SMS settings
        this.smsSettings = {
            phoneNumbers: [],
            enableAlerts: false,
            thresholds: { caution: true, extremeCaution: true, danger: true, extremeDanger: true },
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
        this.fetchSmsSettings();
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
            console.error('WebSocket connection failed:', error);
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
        this.pollingInterval = setInterval(() => this.fetchLatestData(), 2000);
        this.fetchLatestData();
    }

    async fetchLatestData() {
        try {
            const response = await fetch('https://backvolts.onrender.com/api/v1/data/all');
            if (!response.ok) return console.error('API response not OK', response.status);
            const data = await response.json();
            if (!data || data.length === 0) return;
            const latestData = data[data.length - 1];
            if (this.data.length === 0 || new Date(latestData.createdAt) > new Date(this.data[this.data.length - 1].createdAt)) {
                this.data.push(latestData);
                if (this.data.length > this.maxDataPoints) this.data.shift();
                this.updateDashboard();
            }
        } catch (error) {
            console.error('Polling error:', error);
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
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
        if (this.data.length === 0) return;
        this.updateCharts();
        this.checkHeatIndexAlerts();
    }

    getDynamicRange(values) {
        const min = Math.min(...values) - 5;
        const max = Math.max(...values) + 5;
        return { min, max };
    }

    getLightCategory(value) {
        if (value < 20) return 'Dark';
        if (value < 60) return 'Cloudy';
        return 'Sunny';
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

    // ====== SMS SETTINGS ======
    initSmsModal() {
        const modal = document.getElementById('smsModal');
        const btn = document.getElementById('smsSettingsBtn');
        const span = modal.querySelector('.close');
        btn.onclick = () => this.openSmsModal();
        span.onclick = () => this.closeSmsModal();
        document.getElementById('cancelSmsSettings').onclick = () => this.closeSmsModal();
        document.getElementById('saveSmsSettings').onclick = () => this.sendSmsSettingsToBackend();
        document.getElementById('testSms').onclick = () => this.testSms();
        document.getElementById('addPhoneNumber').onclick = () => this.addPhoneNumber();
        window.onclick = e => { if (e.target === modal) this.closeSmsModal(); };
    }

    openSmsModal() { document.getElementById('smsModal').style.display = 'block'; }
    closeSmsModal() { document.getElementById('smsModal').style.display = 'none'; }

    async fetchSmsSettings() {
        try {
            const res = await fetch('https://backvolts.onrender.com/api/v1/sms-settings');
            if (!res.ok) return;
            const data = await res.json();
            if (data.success) this.smsSettings = data.data;
        } catch (e) { console.error('SMS fetch error', e); }
    }

    async sendSmsSettingsToBackend() {
        try {
            const res = await fetch('https://backvolts.onrender.com/api/v1/sms-settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.smsSettings)
            });
            if (res.ok) this.showAlert('SMS settings saved!', 'success');
        } catch (e) { console.error('SMS save error', e); }
    }

    async testSms() {
        if (!this.smsSettings.phoneNumbers.length) return;
        try {
            await fetch('https://backvolts.onrender.com/api/v1/sms/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone_number: this.smsSettings.phoneNumbers.join(','),
                    message: 'Test message from Heat Monitor Dashboard'
                })
            });
            this.showAlert('Test SMS sent!', 'success');
        } catch (e) { console.error('SMS test error', e); }
    }

    addPhoneNumber() {
        const input = document.getElementById('newPhoneNumber');
        const num = input.value.trim();
        if (!num || this.smsSettings.phoneNumbers.includes(num)) return;
        this.smsSettings.phoneNumbers.push(num);
        input.value = '';
    }

    removePhoneNumber(index) { this.smsSettings.phoneNumbers.splice(index, 1); }

    // ====== CHARTS ======
    initCharts() {
        const createChart = (ctx, label, color) => new Chart(ctx, {
            type: 'line',
            data: { labels: [], datasets: [{ label, data: [], borderColor: color, backgroundColor: `${color}33`, fill: true }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });

        this.tempChart = createChart(document.getElementById('tempChart').getContext('2d'), 'Temperature (°C)', '#ff6b6b');
        this.humidityChart = createChart(document.getElementById('humidityChart').getContext('2d'), 'Humidity (%)', '#48dbfb');
        this.heatIndexChart = createChart(document.getElementById('heatIndexChart').getContext('2d'), 'Heat Index (°C)', '#ee5a6f');
        this.lightChart = createChart(document.getElementById('lightChart').getContext('2d'), 'Light Level (%)', '#feca57');
    }

    updateCharts() {
        if (!this.data.length) return;
        const labels = this.data.map(d => new Date(d.createdAt).toLocaleTimeString());
        const temp = this.data.map(d => d.temperature);
        const hum = this.data.map(d => d.humidity);
        const hi = this.data.map(d => d.heatIndex);
        const light = this.data.map(d => d.light);

        const update = (chart, data) => { chart.data.labels = labels; chart.data.datasets[0].data = data; chart.update(); };
        update(this.tempChart, temp);
        update(this.humidityChart, hum);
        update(this.heatIndexChart, hi);
        update(this.lightChart, light);
    }

    startSelfPing() {
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => fetch(this.pingUrl).catch(() => {}), 10000);
    }

    checkHeatIndexAlerts() { /* simplified for brevity */ }
}

window.dashboard = new HeatMonitorDashboard();