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
            thresholds: {
                caution: true,
                extremeCaution: true,
                danger: true,
                extremeDanger: true
            },
            cooldownMinutes: 30,
            lastAlertTimes: {}
        };
        
        this.init();
    }

    init() {
        this.connectWebSocket();
        this.initCharts();
        this.initSmsModal();
        this.loadSmsSettings();
        this.updateConnectionStatus('connecting');
    }

    connectWebSocket() {
        // Connect to correct backend URL
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
        this.updateConnectionStatus('connected'); // Show as connected even with polling
        
        // Poll for new data every 2 seconds
        this.pollingInterval = setInterval(() => {
            this.fetchLatestData();
        }, 2000);
        
        // Initial data fetch
        this.fetchLatestData();
    }

    async fetchLatestData() {
        try {
            console.log('🔄 Fetching data from API...');
            const response = await fetch('https://backvolts.onrender.com/api/v1/data/all');
            
            console.log('📊 Response status:', response.status);
            console.log('📊 Response headers:', response.headers);
            
            if (!response.ok) {
                console.error('❌ API Response not OK:', response.status, response.statusText);
                const errorText = await response.text();
                console.error('❌ Error response body:', errorText);
                return;
            }
            
            const data = await response.json();
            console.log('📊 Received data:', data.length, 'records');
            
            if (data && data.length > 0) {
                // Get only the latest data point
                const latestData = data[data.length - 1];
                console.log('📊 Latest data:', latestData);
                
                // Only update if this is new data
                if (this.data.length === 0 || 
                    new Date(latestData.createdAt) > new Date(this.data[this.data.length - 1].createdAt)) {
                    
                    this.data.push(latestData);
                    if (this.data.length > this.maxDataPoints) {
                        this.data.shift();
                    }
                    console.log('✅ Dashboard updated with new data');
                    this.updateDashboard();
                } else {
                    console.log('📊 No new data to update');
                }
            } else {
                console.log('📊 No data available from API');
            }
        } catch (error) {
            console.error('❌ Polling error:', error);
            console.error('❌ Error details:', error.message, error.stack);
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
        this.checkHeatIndexAlerts();
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
                        beginAtZero: false,
                        max: 50 // Half of typical max temperature range
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
                        max: 50 // Half of 100% range
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
                        beginAtZero: false,
                        max: 25 // Half of typical max heat index range
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
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.parsed.y;
                                const category = value < 20 ? 'Dark' : value < 60 ? 'Cloudy' : 'Sunny';
                                return `${value}% (${category})`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 50, // Half of 100% range
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
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
        
        // Dynamic scaling to prevent lines from reaching top or bottom
        const tempRange = this.getDynamicRange(temperatures);
        const humidityRange = this.getDynamicRange(humidities);
        const heatIndexRange = this.getDynamicRange(heatIndexes);
        const lightRange = this.getDynamicRange(lightLevels);
        
        this.tempChart.data.labels = labels;
        this.tempChart.data.datasets[0].data = temperatures;
        this.tempChart.options.scales.y.min = tempRange.min;
        this.tempChart.options.scales.y.max = tempRange.max;
        this.tempChart.update();
        
        this.humidityChart.data.labels = labels;
        this.humidityChart.data.datasets[0].data = humidities;
        this.humidityChart.options.scales.y.min = humidityRange.min;
        this.humidityChart.options.scales.y.max = humidityRange.max;
        this.humidityChart.update();
        
        this.heatIndexChart.data.labels = labels;
        this.heatIndexChart.data.datasets[0].data = heatIndexes;
        this.heatIndexChart.options.scales.y.min = heatIndexRange.min;
        this.heatIndexChart.options.scales.y.max = heatIndexRange.max;
        this.heatIndexChart.update();
        
        this.lightChart.data.labels = labels;
        this.lightChart.data.datasets[0].data = lightLevels;
        this.lightChart.options.scales.y.min = lightRange.min;
        this.lightChart.options.scales.y.max = lightRange.max;
        
        // Update chart title to show current light condition
        if (lightLevels.length > 0) {
            const currentLight = lightLevels[lightLevels.length - 1];
            const currentCategory = this.getLightCategory(currentLight);
            const icon = currentCategory === 'Dark' ? '🌙' : currentCategory === 'Cloudy' ? '☁️' : '☀️';
            this.lightChart.options.plugins.title = {
                display: true,
                text: `${icon} ${currentCategory} (${currentLight}%)`,
                font: {
                    size: 14,
                    weight: 'bold'
                },
                color: '#2c3e50',
                padding: {
                    bottom: 10
                }
            };
        }
        
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

    // SMS Modal and Alert Methods
    initSmsModal() {
        const modal = document.getElementById('smsModal');
        const btn = document.getElementById('smsSettingsBtn');
        const span = document.getElementsByClassName('close')[0];
        const cancelBtn = document.getElementById('cancelSmsSettings');
        const saveBtn = document.getElementById('saveSmsSettings');
        const testBtn = document.getElementById('testSms');
        const addBtn = document.getElementById('addPhoneNumber');

        btn.onclick = () => this.openSmsModal();
        span.onclick = () => this.closeSmsModal();
        cancelBtn.onclick = () => this.closeSmsModal();
        saveBtn.onclick = () => this.saveSmsSettings();
        testBtn.onclick = () => this.testSms();
        addBtn.onclick = () => this.addPhoneNumber();

        // Handle Enter key in phone number input
        document.getElementById('newPhoneNumber').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addPhoneNumber();
            }
        });

        window.onclick = (event) => {
            if (event.target === modal) {
                this.closeSmsModal();
            }
        };
    }

    openSmsModal() {
        const modal = document.getElementById('smsModal');
        modal.style.display = 'block';
        this.populateSmsForm();
    }

    closeSmsModal() {
        const modal = document.getElementById('smsModal');
        modal.style.display = 'none';
    }

    populateSmsForm() {
        this.renderPhoneNumbersList();
        document.getElementById('enableAlerts').checked = this.smsSettings.enableAlerts;
        document.getElementById('cautionAlert').checked = this.smsSettings.thresholds.caution;
        document.getElementById('extremeCautionAlert').checked = this.smsSettings.thresholds.extremeCaution;
        document.getElementById('dangerAlert').checked = this.smsSettings.thresholds.danger;
        document.getElementById('extremeDangerAlert').checked = this.smsSettings.thresholds.extremeDanger;
        document.getElementById('cooldownMinutes').value = this.smsSettings.cooldownMinutes;
    }

    saveSmsSettings() {
        this.smsSettings.enableAlerts = document.getElementById('enableAlerts').checked;
        this.smsSettings.thresholds.caution = document.getElementById('cautionAlert').checked;
        this.smsSettings.thresholds.extremeCaution = document.getElementById('extremeCautionAlert').checked;
        this.smsSettings.thresholds.danger = document.getElementById('dangerAlert').checked;
        this.smsSettings.thresholds.extremeDanger = document.getElementById('extremeDangerAlert').checked;
        this.smsSettings.cooldownMinutes = parseInt(document.getElementById('cooldownMinutes').value);

        localStorage.setItem('smsSettings', JSON.stringify(this.smsSettings));
        this.showAlert('SMS settings saved successfully!', 'success');
        this.closeSmsModal();
    }

    loadSmsSettings() {
        const saved = localStorage.getItem('smsSettings');
        if (saved) {
            this.smsSettings = JSON.parse(saved);
        }
    }

    async testSms() {
        const testMessage = 'Test message from Heat Monitor Dashboard';
        await this.sendSms(testMessage);
        this.showAlert('Test SMS sent!', 'success');
    }

    checkHeatIndexAlerts() {
        if (!this.smsSettings.enableAlerts || this.data.length === 0) return;

        const latestData = this.data[this.data.length - 1];
        
        // Check if data is recent (within last 10 minutes)
        if (!this.isDataRecent(latestData.createdAt)) {
            console.log('Skipping SMS alert - data is too old:', new Date(latestData.createdAt));
            return;
        }

        const heatIndex = latestData.heatIndex;
        const temp = latestData.temperature;
        const humidity = latestData.humidity;
        const lightCategory = this.getLightCategory(latestData.light);

        let alertLevel = null;
        let message = '';

        if (heatIndex >= 42 && this.smsSettings.thresholds.extremeDanger) {
            alertLevel = 'extremeDanger';
            message = `[EMERGENCY] Heat index: ${heatIndex}°C | Temp: ${temp}°C | Humidity: ${humidity}% | Light: ${lightCategory}\nExtreme heat. Stay inside, monitor everyone for heat illness, and act immediately if needed.`;
        } else if (heatIndex >= 40 && this.smsSettings.thresholds.danger) {
            alertLevel = 'danger';
            message = `[EMERGENCY] Heat index: ${heatIndex}°C | Temp: ${temp}°C | Humidity: ${humidity}% | Light: ${lightCategory}\nSevere heat. Stay indoors, hydrate often, and avoid outdoor activity.`;
        } else if (heatIndex >= 35 && this.smsSettings.thresholds.extremeCaution) {
            alertLevel = 'extremeCaution';
            message = `[ALERT] Heat index: ${heatIndex}°C | Temp: ${temp}°C | Humidity: ${humidity}% | Light: ${lightCategory}\nHigh heat. Minimize outdoor activity, drink water, and watch children, seniors, and pets.`;
        } else if (heatIndex >= 27 && this.smsSettings.thresholds.caution) {
            alertLevel = 'caution';
            message = `[ALERT] Heat index: ${heatIndex}°C | Temp: ${temp}°C | Humidity: ${humidity}% | Light: ${lightCategory}\nHeat rising. Stay hydrated, take breaks in shade, and limit outdoor activity.`;
        }

        if (alertLevel && this.shouldSendAlert(alertLevel)) {
            this.sendSms(message);
            this.updateLastAlertTime(alertLevel);
        }
    }

    shouldSendAlert(alertLevel) {
        if (!this.smsSettings.lastAlertTimes[alertLevel]) {
            return true;
        }

        const lastAlertTime = new Date(this.smsSettings.lastAlertTimes[alertLevel]);
        const now = new Date();
        const cooldownMs = this.smsSettings.cooldownMinutes * 60 * 1000;

        return (now - lastAlertTime) > cooldownMs;
    }

    updateLastAlertTime(alertLevel) {
        this.smsSettings.lastAlertTimes[alertLevel] = new Date().toISOString();
        localStorage.setItem('smsSettings', JSON.stringify(this.smsSettings));
    }

    async sendSms(message) {
        if (this.smsSettings.phoneNumbers.length === 0) {
            console.warn('No phone numbers configured');
            return;
        }

        try {
            const response = await fetch('https://backvolts.onrender.com/api/v1/sms/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    phone_number: this.smsSettings.phoneNumbers.join(','),
                    message: message
                })
            });

            if (!response.ok) {
                console.error('SMS sending failed:', response.status, response.statusText);
            } else {
                console.log('SMS sent successfully');
            }
        } catch (error) {
            console.error('Error sending SMS:', error);
        }
    }

    // Phone Number Management Methods
    renderPhoneNumbersList() {
        const listContainer = document.getElementById('phoneNumbersList');
        listContainer.innerHTML = '';

        this.smsSettings.phoneNumbers.forEach((phoneNumber, index) => {
            const row = document.createElement('div');
            row.className = 'phone-number-row';
            row.innerHTML = `
                <span>${phoneNumber}</span>
                <span><button class="btn-remove" data-index="${index}">Remove</button></span>
            `;
            listContainer.appendChild(row);
        });

        // Add event listeners to remove buttons
        listContainer.querySelectorAll('.btn-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.removePhoneNumber(index);
            });
        });
    }

    addPhoneNumber() {
        const input = document.getElementById('newPhoneNumber');
        const phoneNumber = input.value.trim();

        if (phoneNumber && !this.smsSettings.phoneNumbers.includes(phoneNumber)) {
            this.smsSettings.phoneNumbers.push(phoneNumber);
            input.value = '';
            this.renderPhoneNumbersList();
        }
    }

    removePhoneNumber(index) {
        this.smsSettings.phoneNumbers.splice(index, 1);
        this.renderPhoneNumbersList();
    }

    // Light level categorization
    getLightCategory(lightValue) {
        if (lightValue < 20) return 'Dark';
        if (lightValue < 60) return 'Cloudy';
        return 'Sunny';
    }

    getLightNumericValue(category) {
        switch(category) {
            case 'Dark': return 0;
            case 'Cloudy': return 50;
            case 'Sunny': return 100;
            default: return 50;
        }
    }

    // Data freshness check
    isDataRecent(dataTimestamp) {
        const dataTime = new Date(dataTimestamp);
        const now = new Date();
        const timeDiffMinutes = (now - dataTime) / (1000 * 60);
        
        // Return true if data is less than 10 minutes old
        return timeDiffMinutes < 10;
    }

    // Dynamic scaling to prevent lines from reaching top or bottom
    getDynamicRange(dataArray) {
        if (dataArray.length === 0) return { min: 0, max: 100 };
        
        const maxValue = Math.max(...dataArray);
        const minValue = Math.min(...dataArray);
        const range = maxValue - minValue;
        
        // Add 20-30% buffer above and below the data range
        const buffer = Math.max(range * 0.3, 5);
        const dynamicMin = Math.max(minValue - buffer, 0); // Don't go below 0 for most metrics
        const dynamicMax = maxValue + buffer;
        
        // Ensure minimum reasonable ranges
        const minRange = 10;
        if (dynamicMax - dynamicMin < minRange) {
            const center = (dynamicMax + dynamicMin) / 2;
            return {
                min: center - minRange / 2,
                max: center + minRange / 2
            };
        }
        
        // Special handling for temperature and heat index (can be negative)
        if (dataArray.includes(this.data.find(d => d.temperature)?.temperature || 0) || 
            dataArray.includes(this.data.find(d => d.heatIndex)?.heatIndex || 0)) {
            return {
                min: minValue - buffer,
                max: maxValue + buffer
            };
        }
        
        return {
            min: Math.max(dynamicMin, 0),
            max: dynamicMax
        };
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new HeatMonitorDashboard();
});
