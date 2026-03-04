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
            lastAlertTimes: {},
            customAlerts: [], // Custom temperature/heat index alerts
            scheduledAlerts: [] // Time-based scheduled alerts
        };
        
        // Self-ping settings
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

        // Add phone number event listeners
        document.getElementById('addPhoneNumber').addEventListener('click', () => this.addPhoneNumber());
        document.getElementById('newPhoneNumber').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addPhoneNumber();
        });
        
        // Custom and scheduled alert event listeners
        document.getElementById('addCustomAlert').addEventListener('click', () => this.addCustomAlert());
        document.getElementById('addScheduledAlert').addEventListener('click', () => this.addScheduledAlert());

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
        document.getElementById('cooldownMinutes').value = this.smsSettings.cooldownMinutes;
        document.getElementById('enableAlerts').checked = this.smsSettings.enableAlerts;
        
        this.renderPhoneNumbersList();
        this.renderCustomAlerts();
        this.renderScheduledAlerts();
    }

    saveSmsSettings() {
        this.smsSettings.enableAlerts = document.getElementById('enableAlerts').checked;
        this.smsSettings.thresholds.caution = document.getElementById('cautionAlert').checked;
        this.smsSettings.thresholds.extremeCaution = document.getElementById('extremeCautionAlert').checked;
        this.smsSettings.thresholds.danger = document.getElementById('dangerAlert').checked;
        this.smsSettings.thresholds.extremeDanger = document.getElementById('extremeDangerAlert').checked;
        this.smsSettings.cooldownMinutes = parseInt(document.getElementById('cooldownMinutes').value);
        
        // Save custom and scheduled alerts from form inputs
        this.saveCustomAlertsFromForm();
        this.saveScheduledAlertsFromForm();

        // Save to backend instead of localStorage
        this.saveSmsSettings();
    }

    saveCustomAlertsFromForm() {
        const container = document.getElementById('customAlertsContainer');
        const rows = container.querySelectorAll('.custom-alert-row');
        
        this.smsSettings.customAlerts = [];
        rows.forEach((row, index) => {
            const type = row.querySelector('select:nth-child(1)').value;
            const condition = row.querySelector('select:nth-child(2)').value;
            const value = parseFloat(row.querySelector('input[type="number"]').value);
            const message = row.querySelector('input[type="text"]').value;
            
            this.smsSettings.customAlerts.push({
                id: Date.now() + index,
                type,
                condition,
                value,
                message
            });
        });
    }

    saveScheduledAlertsFromForm() {
        const container = document.getElementById('scheduledAlertsContainer');
        const rows = container.querySelectorAll('.scheduled-alert-row');
        
        this.smsSettings.scheduledAlerts = [];
        rows.forEach((row, index) => {
            const time = row.querySelector('input[type="time"]').value;
            const message = row.querySelector('input[type="text"]').value;
            
            this.smsSettings.scheduledAlerts.push({
                id: Date.now() + index,
                time,
                message
            });
        });
    }

    loadSmsSettings() {
        this.fetchSmsSettings();
    }

    async fetchSmsSettings() {
        try {
            const response = await fetch('https://backvolts.onrender.com/api/v1/sms-settings');
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.smsSettings = {
                        phoneNumbers: data.data.phoneNumbers || [],
                        enableAlerts: data.data.enableAlerts || false,
                        thresholds: data.data.thresholds || {
                            caution: true,
                            extremeCaution: true,
                            danger: true,
                            extremeDanger: true
                        },
                        cooldownMinutes: data.data.cooldownMinutes || 30,
                        lastAlertTimes: data.data.lastAlertTimes || {},
                        customAlerts: data.data.customAlerts || [],
                        scheduledAlerts: data.data.scheduledAlerts || []
                    };
                    console.log('✅ SMS settings loaded from backend:', this.smsSettings);
                }
            }
        } catch (error) {
            console.error('❌ Error loading SMS settings:', error);
            // Set default values if backend fails
            this.setDefaultSmsSettings();
        }
    }

    async saveSmsSettings() {
        try {
            const response = await fetch('https://backvolts.onrender.com/api/v1/sms-settings', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    phoneNumbers: this.smsSettings.phoneNumbers,
                    enableAlerts: this.smsSettings.enableAlerts,
                    thresholds: this.smsSettings.thresholds,
                    cooldownMinutes: this.smsSettings.cooldownMinutes,
                    customAlerts: this.smsSettings.customAlerts,
                    scheduledAlerts: this.smsSettings.scheduledAlerts
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    console.log('✅ SMS settings saved to backend');
                    this.closeSmsModal();
                    this.showAlert('SMS settings saved successfully!', 'success');
                } else {
                    console.error('❌ Backend error:', data.message);
                    this.showAlert('Failed to save SMS settings: ' + data.message, 'error');
                }
            } else {
                console.error('❌ HTTP error:', response.status);
                this.showAlert('Failed to save SMS settings', 'error');
            }
        } catch (error) {
            console.error('❌ Error saving SMS settings:', error);
            this.showAlert('Failed to save SMS settings', 'error');
        }
    }

    setDefaultSmsSettings() {
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

        // Check custom alerts
        this.checkCustomAlerts(latestData);
        
        // Check scheduled alerts
        this.checkScheduledAlerts(latestData);
    }

    checkCustomAlerts(data) {
        this.smsSettings.customAlerts.forEach(alert => {
            let shouldTrigger = false;
            
            // Get the appropriate value based on metric
            const currentValue = alert.metric === 'temperature' ? data.temperature : data.heatIndex;
            
            // Check condition
            if (alert.condition === 'greater') {
                shouldTrigger = currentValue >= alert.value;
            } else if (alert.condition === 'less') {
                shouldTrigger = currentValue <= alert.value;
            } else if (alert.condition === 'equal') {
                shouldTrigger = currentValue === alert.value;
            }

            if (shouldTrigger && this.shouldSendAlert(`custom_${alert.id}`)) {
                const message = alert.message
                    .replace('{temp}', data.temperature)
                    .replace('{heatIndex}', data.heatIndex)
                    .replace('{humidity}', data.humidity)
                    .replace('{light}', this.getLightCategory(data.light));
                
                this.sendSms(message);
                this.updateLastAlertTime(`custom_${alert.id}`);
            }
        });
    }

    checkScheduledAlerts(data) {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        this.smsSettings.scheduledAlerts.forEach(alert => {
            if (alert.time === currentTime && this.shouldSendAlert(`scheduled_${alert.id}`)) {
                const message = alert.message
                    .replace('{temp}', data.temperature)
                    .replace('{heatIndex}', data.heatIndex)
                    .replace('{humidity}', data.humidity)
                    .replace('{light}', this.getLightCategory(data.light));
                
                this.sendSms(message);
                this.updateLastAlertTime(`scheduled_${alert.id}`);
            }
        });
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
            row.innerHTML = '<span>' + phoneNumber + '</span><span><button class="btn-remove" data-index="' + index + '" title="Remove"><i class="bi bi-trash"></i></button></span>';
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

    // Custom Alert Management
    addCustomAlert() {
        // Create modal for structured input
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 10000;
            display: flex;
            justify-content: center;
            align-items: center;
        `;
        
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            max-width: 500px;
            width: 90%;
        `;
        
        modalContent.innerHTML = '<h3 style="margin: 0 0 20px 0; color: #2c3e50;">Add Custom Alert</h3>' +
            '<div style="margin-bottom: 15px;"><label style="display: block; margin-bottom: 5px; font-weight: 600;">Metric:</label><select id="alertMetric" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"><option value="temperature">Temperature</option><option value="heatIndex">Heat Index</option></select></div>' +
            '<div style="margin-bottom: 15px;"><label style="display: block; margin-bottom: 5px; font-weight: 600;">Condition:</label><select id="alertCondition" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"><option value="greater">Greater than or equal to (≥)</option><option value="less">Less than or equal to (≤)</option><option value="equal">Equal to (=)</option></select></div>' +
            '<div style="margin-bottom: 15px;"><label style="display: block; margin-bottom: 5px; font-weight: 600;">Value:</label><input type="number" id="alertValue" placeholder="Enter value" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"></div>' +
            '<div style="margin-bottom: 20px;"><label style="display: block; margin-bottom: 5px; font-weight: 600;">Message:</label><textarea id="alertMessage" placeholder="Enter message (use {temp}, {heatIndex}, {humidity}, {light} as variables)" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; min-height: 60px; resize: vertical;"></textarea></div>' +
            '<div style="display: flex; gap: 10px; justify-content: flex-end;"><button onclick="window.dashboard.saveCustomAlertFromModal()" style="padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer;">Save</button><button onclick="window.dashboard.closeCustomAlertModal()" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">Cancel</button></div>';
        
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        // Store modal reference
        this.customAlertModal = modal;
    }

    saveCustomAlertFromModal() {
        const metric = document.getElementById('alertMetric').value;
        const condition = document.getElementById('alertCondition').value;
        const value = parseFloat(document.getElementById('alertValue').value);
        const message = document.getElementById('alertMessage').value;
        
        if (!metric || !condition || isNaN(value) || !message) {
            alert('Please fill in all fields');
            return;
        }
        
        const alert = {
            id: Date.now(),
            metric,
            condition,
            value,
            message
        };
        
        this.smsSettings.customAlerts.push(alert);
        this.renderCustomAlerts();
        this.closeCustomAlertModal();
        this.showAlert('Custom alert added!', 'success');
    }

    closeCustomAlertModal() {
        if (this.customAlertModal) {
            document.body.removeChild(this.customAlertModal);
            this.customAlertModal = null;
        }
    }

    editCustomAlert(id) {
        const alert = this.smsSettings.customAlerts.find(a => a.id === id);
        if (!alert) return;
        
        // Create edit modal with pre-filled values
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 10000;
            display: flex;
            justify-content: center;
            align-items: center;
        `;
        
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            max-width: 500px;
            width: 90%;
        `;
        
        modalContent.innerHTML = `
            <h3 style="margin: 0 0 20px 0; color: #2c3e50;">Edit Custom Alert</h3>
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Metric:</label>
                <select id="editAlertMetric" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    <option value="temperature" ${alert.metric === 'temperature' ? 'selected' : ''}>Temperature</option>
                    <option value="heatIndex" ${alert.metric === 'heatIndex' ? 'selected' : ''}>Heat Index</option>
                </select>
            </div>
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Condition:</label>
                <select id="editAlertCondition" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    <option value="greater" ${alert.condition === 'greater' ? 'selected' : ''}>Greater than or equal to (≥)</option>
                    <option value="less" ${alert.condition === 'less' ? 'selected' : ''}>Less than or equal to (≤)</option>
                    <option value="equal" ${alert.condition === 'equal' ? 'selected' : ''}>Equal to (=)</option>
                </select>
            </div>
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Value:</label>
                <input type="number" id="editAlertValue" value="${alert.value}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Message:</label>
                <textarea id="editAlertMessage" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; min-height: 60px; resize: vertical;">${alert.message}</textarea>
            </div>
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button onclick="window.dashboard.updateCustomAlertFromModal(${id})" style="padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer;">Update</button>
                <button onclick="window.dashboard.closeCustomAlertModal()" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">Cancel</button>
            </div>
        `;
        
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        // Store modal reference
        this.customAlertModal = modal;
    }

    updateCustomAlertFromModal(id) {
        const metric = document.getElementById('editAlertMetric').value;
        const condition = document.getElementById('editAlertCondition').value;
        const value = parseFloat(document.getElementById('editAlertValue').value);
        const message = document.getElementById('editAlertMessage').value;
        
        if (!metric || !condition || isNaN(value) || !message) {
            alert('Please fill in all fields');
            return;
        }
        
        const alertIndex = this.smsSettings.customAlerts.findIndex(a => a.id === id);
        if (alertIndex !== -1) {
            this.smsSettings.customAlerts[alertIndex] = {
                id,
                metric,
                condition,
                value,
                message
            };
        }
        
        this.renderCustomAlerts();
        this.closeCustomAlertModal();
        this.showAlert('Custom alert updated!', 'success');
    }

    removeCustomAlert(id) {
        if (confirm('Are you sure you want to delete this custom alert?')) {
            this.smsSettings.customAlerts = this.smsSettings.customAlerts.filter(alert => alert.id !== id);
            this.renderCustomAlerts();
            this.showAlert('Custom alert deleted!', 'success');
        }
    }

    renderCustomAlerts() {
        const container = document.getElementById('customAlertsContainer');
        if (!container) {
            console.error('Custom alerts container not found!');
            return;
        }

        container.innerHTML = '';

        if (!this.smsSettings.customAlerts || this.smsSettings.customAlerts.length === 0) {
            container.innerHTML = '<p style="color: #6c757d; font-style: italic;">No custom alerts configured</p>';
            return;
        }

        this.smsSettings.customAlerts.forEach(alert => {
            const item = document.createElement('div');
            item.className = 'custom-alert-item';
            item.innerHTML =
                '<div class="custom-alert-info">' +
                '<div class="custom-alert-condition">' + alert.metric + ' ' + alert.condition + ' ' + alert.value + '</div>' +
                '<div class="custom-alert-message">' + alert.message + '</div>' +
                '</div>' +
                '<div class="custom-alert-actions">' +
                '<button class="btn-edit" onclick="window.dashboard.editCustomAlert(' + alert.id + ')"><i class="bi bi-pencil"></i></button>' +
                '<button class="btn-delete" onclick="window.dashboard.removeCustomAlert(' + alert.id + ')"><i class="bi bi-trash"></i></button>' +
                '</div>';

            container.appendChild(item);
        });
    }

// ... (rest of the code remains the same)
    // Scheduled Alert Management
    addScheduledAlert() {
        // Create modal for structured input
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 10000;
            display: flex;
            justify-content: center;
            align-items: center;
        `;
        
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            max-width: 500px;
            width: 90%;
        `;
        
        modalContent.innerHTML = '<h3 style="margin: 0 0 20px 0; color: #2c3e50;">Add Scheduled Alert</h3>' +
            '<div style="margin-bottom: 15px;"><label style="display: block; margin-bottom: 5px; font-weight: 600;">Time:</label><input type="time" id="alertTime" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"></div>' +
            '<div style="margin-bottom: 20px;"><label style="display: block; margin-bottom: 5px; font-weight: 600;">Message:</label><textarea id="alertMessage" placeholder="Enter message (use {temp}, {heatIndex}, {humidity}, {light} as variables)" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; min-height: 60px; resize: vertical;"></textarea></div>' +
            '<div style="display: flex; gap: 10px; justify-content: flex-end;"><button onclick="window.dashboard.saveScheduledAlertFromModal()" style="padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer;">Save</button><button onclick="window.dashboard.closeScheduledAlertModal()" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">Cancel</button></div>';
        
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        // Store modal reference
        this.scheduledAlertModal = modal;
    }

    saveScheduledAlertFromModal() {
        const time = document.getElementById('alertTime').value;
        const message = document.getElementById('alertMessage').value;
        
        if (!time || !message) {
            alert('Please fill in all fields');
            return;
        }
        
        const alert = {
            id: Date.now(),
            time,
            message
        };
        
        this.smsSettings.scheduledAlerts.push(alert);
        this.renderScheduledAlerts();
        this.closeScheduledAlertModal();
        this.showAlert('Scheduled alert added!', 'success');
    }

    closeScheduledAlertModal() {
        if (this.scheduledAlertModal) {
            document.body.removeChild(this.scheduledAlertModal);
            this.scheduledAlertModal = null;
        }
    }

    removeScheduledAlert(id) {
        if (confirm('Are you sure you want to delete this scheduled alert?')) {
            this.smsSettings.scheduledAlerts = this.smsSettings.scheduledAlerts.filter(alert => alert.id !== id);
            this.renderScheduledAlerts();
            this.showAlert('Scheduled alert deleted!', 'success');
        }
    }

    editScheduledAlert(id) {
        const alert = this.smsSettings.scheduledAlerts.find(a => a.id === id);
        if (!alert) return;
        
        // Create edit modal with pre-filled values
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 10000;
            display: flex;
            justify-content: center;
            align-items: center;
        `;
        
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            max-width: 500px;
            width: 90%;
        `;
        
        modalContent.innerHTML = '<h3 style="margin: 0 0 20px 0; color: #2c3e50;">Edit Scheduled Alert</h3>' +
            '<div style="margin-bottom: 15px;"><label style="display: block; margin-bottom: 5px; font-weight: 600;">Time:</label><input type="time" id="editAlertTime" value="' + alert.time + '" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"></div>' +
            '<div style="margin-bottom: 20px;"><label style="display: block; margin-bottom: 5px; font-weight: 600;">Message:</label><textarea id="editAlertMessage" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; min-height: 60px; resize: vertical;">' + alert.message + '</textarea></div>' +
            '<div style="display: flex; gap: 10px; justify-content: flex-end;"><button onclick="window.dashboard.updateScheduledAlertFromModal(' + alert.id + ')" style="padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer;">Update</button><button onclick="window.dashboard.closeScheduledAlertModal()" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">Cancel</button></div>';
        
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        // Store modal reference
        this.scheduledAlertModal = modal;
    }

    updateScheduledAlertFromModal(id) {
        const time = document.getElementById('editAlertTime').value;
        const message = document.getElementById('editAlertMessage').value;
        
        if (!time || !message) {
            alert('Please fill in all fields');
            return;
        }
        
        const alertIndex = this.smsSettings.scheduledAlerts.findIndex(a => a.id === id);
        if (alertIndex !== -1) {
            this.smsSettings.scheduledAlerts[alertIndex] = {
                id,
                time,
                message
            };
        }
        
        this.renderScheduledAlerts();
        this.closeScheduledAlertModal();
        this.showAlert('Scheduled alert updated!', 'success');
    }

    renderScheduledAlerts() {
        const container = document.getElementById('scheduledAlertsContainer');
        if (!container) {
            console.error('Scheduled alerts container not found!');
            return;
        }
        
        container.innerHTML = '';

        if (!this.smsSettings.scheduledAlerts || this.smsSettings.scheduledAlerts.length === 0) {
            container.innerHTML = '<p style="color: #6c757d; font-style: italic;">No scheduled alerts configured</p>';
            return;
        }

        this.smsSettings.scheduledAlerts.forEach(alert => {
            const item = document.createElement('div');
            item.className = 'custom-alert-item';
            item.innerHTML =
                '<div class="custom-alert-info">' +
                '<div class="custom-alert-condition">' + alert.time + '</div>' +
                '<div class="custom-alert-message">' + alert.message + '</div>' +
                '</div>' +
                '<div class="custom-alert-actions">' +
                '<button class="btn-edit" onclick="window.dashboard.editScheduledAlert(' + alert.id + ')"><i class="bi bi-pencil"></i></button>' +
                '<button class="btn-delete" onclick="window.dashboard.removeScheduledAlert(' + alert.id + ')"><i class="bi bi-trash"></i></button>' +
                '</div>';

            container.appendChild(item);
        });
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

    // Self-ping to keep server awake
    startSelfPing() {
        // Ping every 5 minutes (300,000 milliseconds)
        this.pingInterval = setInterval(() => {
            this.pingServer();
        }, 300000);
        
        // Also ping immediately on start
        this.pingServer();
        console.log('🔄 Self-ping started - server will stay awake');
    }

    async pingServer() {
        try {
            const response = await fetch(this.pingUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                console.log('📡 Server ping successful - keeping server awake');
            } else {
                console.log('⚠️ Server ping warning:', response.status);
            }
        } catch (error) {
            console.log('❌ Server ping failed:', error.message);
        }
    }

    stopSelfPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
            console.log('⏹️ Self-ping stopped');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const dashboard = new HeatMonitorDashboard();
    
    // Expose dashboard to window for global access
    window.dashboard = dashboard;
});
