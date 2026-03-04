//comments

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

        this.apiBase = 'https://backvolts.onrender.com/api/v1';
        this.pingInterval = null;
        this.pingUrl = `${this.apiBase}/data/all`;

        this.init();
    }

    startSelfPing() {
        if (this.pingInterval) return;

        const ping = async () => {
            try {
                await fetch(this.pingUrl, {
                    method: 'GET',
                    cache: 'no-store',
                });
            } catch (error) {
                console.warn('Self-ping failed:', error);
            }
        };

        // Initial ping to wake backend (e.g., Render free tier)
        ping();

        // Repeat periodically to keep backend warm
        this.pingInterval = setInterval(ping, 5 * 60 * 1000);

        // Clear interval when page is about to be unloaded
        window.addEventListener('beforeunload', () => {
            if (this.pingInterval) {
                clearInterval(this.pingInterval);
                this.pingInterval = null;
            }
        });
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
            const response = await fetch(`${this.apiBase}/data/all`);
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

        // Update light status badge (Dark / Cloudy / Sunny)
        const latestLight = lightLevels[lightLevels.length - 1];
        const lightStatusEl = document.getElementById('lightStatusLabel');
        if (lightStatusEl && typeof latestLight === 'number') {
            let label = 'Unknown';
            if (latestLight < 30) label = 'Dark';
            else if (latestLight < 70) label = 'Cloudy';
            else label = 'Sunny';
            lightStatusEl.textContent = `(${label})`;
        }
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

    showAlert(message, type = 'info') { console.log(type.toUpperCase() + ':', message); }

    // =========================
    // SMS / Alerts methods
    // =========================

    initSmsModal() {
        const modal = document.getElementById('smsModal');
        const openBtn = document.getElementById('smsSettingsBtn');
        const closeIcon = modal.querySelector('.close');
        const cancelBtn = document.getElementById('cancelSmsSettings');
        const saveBtn = document.getElementById('saveSmsSettings');
        const testBtn = document.getElementById('testSms');

        const phoneInput = document.getElementById('newPhoneNumber');
        const addPhoneBtn = document.getElementById('addPhoneNumber');
        const phoneList = document.getElementById('phoneNumbersList');
        const enableAlertsCheckbox = document.getElementById('enableAlerts');
        const cooldownInput = document.getElementById('cooldownMinutes');
        const customAlertsContainer = document.getElementById('customAlertsContainer');
        const addCustomAlertBtn = document.getElementById('addCustomAlert');
        const scheduledAlertsContainer = document.getElementById('scheduledAlertsContainer');
        const addScheduledAlertBtn = document.getElementById('addScheduledAlert');

        if (!modal || !openBtn) return;

        const openModal = () => {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            this.renderPhoneNumbers(phoneList);
            enableAlertsCheckbox.checked = this.smsSettings.enableAlerts;
            cooldownInput.value = this.smsSettings.cooldownMinutes;
            this.renderCustomAlerts(customAlertsContainer);
            this.renderScheduledAlerts(scheduledAlertsContainer);
        };

        const closeModal = () => {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        };

        openBtn.addEventListener('click', openModal);
        closeIcon.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);

        window.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.style.display !== 'none') {
                closeModal();
            }
        });

        addPhoneBtn.addEventListener('click', () => {
            const raw = phoneInput.value.trim();
            if (!raw) return;

            if (this.smsSettings.phoneNumbers.includes(raw)) {
                this.showAlert('Phone number already added', 'info');
                return;
            }

            this.smsSettings.phoneNumbers.push(raw);
            phoneInput.value = '';
            this.renderPhoneNumbers(phoneList);
            this.persistSmsSettings();
        });

        enableAlertsCheckbox.addEventListener('change', () => {
            this.smsSettings.enableAlerts = enableAlertsCheckbox.checked;
            this.persistSmsSettings();
        });

        cooldownInput.addEventListener('change', () => {
            const value = parseInt(cooldownInput.value, 10);
            if (!isNaN(value) && value > 0) {
                this.smsSettings.cooldownMinutes = value;
                this.persistSmsSettings();
            }
        });

        saveBtn.addEventListener('click', () => {
            this.persistSmsSettings();
            this.showAlert('SMS settings saved', 'info');
            closeModal();
        });

        testBtn.addEventListener('click', () => {
            this.showAlert('Test SMS would be sent here (hook up backend API).', 'info');
        });

        // Custom alerts
        if (addCustomAlertBtn) {
            addCustomAlertBtn.addEventListener('click', () => {
                const condition = prompt('Enter alert condition (e.g. heatIndex > 35):');
                if (!condition) return;
                const message = prompt('Enter SMS message to send:');
                if (!message) return;

                this.smsSettings.customAlerts.push({
                    id: Date.now().toString(),
                    condition,
                    message,
                });

                this.renderCustomAlerts(customAlertsContainer);
                this.persistSmsSettings();
            });
        }

        // Scheduled alerts
        if (addScheduledAlertBtn) {
            addScheduledAlertBtn.addEventListener('click', () => {
                const time = prompt('Enter time (HH:MM, 24h) for the alert:');
                if (!time) return;
                const message = prompt('Enter SMS message to send at that time:');
                if (!message) return;

                this.smsSettings.scheduledAlerts.push({
                    id: Date.now().toString(),
                    time,
                    message,
                });

                this.renderScheduledAlerts(scheduledAlertsContainer);
                this.persistSmsSettings();
            });
        }
    }

    renderPhoneNumbers(listEl) {
        if (!listEl) return;
        listEl.innerHTML = '';

        if (!this.smsSettings.phoneNumbers.length) {
            const emptyRow = document.createElement('div');
            emptyRow.className = 'phone-number-row';
            emptyRow.innerHTML = '<span>No numbers added yet</span><span></span>';
            listEl.appendChild(emptyRow);
            return;
        }

        this.smsSettings.phoneNumbers.forEach((number, index) => {
            const row = document.createElement('div');
            row.className = 'phone-number-row';

            const numberSpan = document.createElement('span');
            numberSpan.textContent = number;

            const actionSpan = document.createElement('span');
            const removeBtn = document.createElement('button');
            removeBtn.className = 'btn-remove';
            removeBtn.textContent = 'Remove';
            removeBtn.addEventListener('click', () => {
                this.smsSettings.phoneNumbers.splice(index, 1);
                this.renderPhoneNumbers(listEl);
                this.persistSmsSettings();
            });

            actionSpan.appendChild(removeBtn);
            row.appendChild(numberSpan);
            row.appendChild(actionSpan);

            listEl.appendChild(row);
        });
    }

    renderCustomAlerts(container) {
        if (!container) return;
        container.innerHTML = '';

        if (!this.smsSettings.customAlerts.length) {
            const empty = document.createElement('div');
            empty.className = 'custom-alert-item';
            empty.innerHTML = '<div class="custom-alert-info"><span class="custom-alert-condition">No custom alerts yet</span></div>';
            container.appendChild(empty);
            return;
        }

        this.smsSettings.customAlerts.forEach((alert, index) => {
            const item = document.createElement('div');
            item.className = 'custom-alert-item';

            const info = document.createElement('div');
            info.className = 'custom-alert-info';

            const cond = document.createElement('div');
            cond.className = 'custom-alert-condition';
            cond.textContent = alert.condition;

            const msg = document.createElement('div');
            msg.className = 'custom-alert-message';
            msg.textContent = alert.message;

            info.appendChild(cond);
            info.appendChild(msg);

            const actions = document.createElement('div');
            actions.className = 'custom-alert-actions';

            const editBtn = document.createElement('button');
            editBtn.className = 'btn-edit';
            editBtn.textContent = 'Edit';
            editBtn.addEventListener('click', () => {
                const newCondition = prompt('Edit condition:', alert.condition);
                if (!newCondition) return;
                const newMessage = prompt('Edit message:', alert.message);
                if (!newMessage) return;
                this.smsSettings.customAlerts[index] = {
                    ...alert,
                    condition: newCondition,
                    message: newMessage,
                };
                this.renderCustomAlerts(container);
                this.persistSmsSettings();
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn-delete';
            deleteBtn.textContent = 'Delete';
            deleteBtn.addEventListener('click', () => {
                this.smsSettings.customAlerts.splice(index, 1);
                this.renderCustomAlerts(container);
                this.persistSmsSettings();
            });

            actions.appendChild(editBtn);
            actions.appendChild(deleteBtn);

            item.appendChild(info);
            item.appendChild(actions);

            container.appendChild(item);
        });
    }

    renderScheduledAlerts(container) {
        if (!container) return;
        container.innerHTML = '';

        if (!this.smsSettings.scheduledAlerts.length) {
            const empty = document.createElement('div');
            empty.className = 'custom-alert-item';
            empty.innerHTML = '<div class="custom-alert-info"><span class="custom-alert-condition">No scheduled alerts yet</span></div>';
            container.appendChild(empty);
            return;
        }

        this.smsSettings.scheduledAlerts.forEach((alert, index) => {
            const item = document.createElement('div');
            item.className = 'custom-alert-item';

            const info = document.createElement('div');
            info.className = 'custom-alert-info';

            const cond = document.createElement('div');
            cond.className = 'custom-alert-condition';
            cond.textContent = `At ${alert.time}`;

            const msg = document.createElement('div');
            msg.className = 'custom-alert-message';
            msg.textContent = alert.message;

            info.appendChild(cond);
            info.appendChild(msg);

            const actions = document.createElement('div');
            actions.className = 'scheduled-alert-actions';

            const editBtn = document.createElement('button');
            editBtn.className = 'btn-edit';
            editBtn.textContent = 'Edit';
            editBtn.addEventListener('click', () => {
                const newTime = prompt('Edit time (HH:MM, 24h):', alert.time);
                if (!newTime) return;
                const newMessage = prompt('Edit message:', alert.message);
                if (!newMessage) return;
                this.smsSettings.scheduledAlerts[index] = {
                    ...alert,
                    time: newTime,
                    message: newMessage,
                };
                this.renderScheduledAlerts(container);
                this.persistSmsSettings();
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn-delete';
            deleteBtn.textContent = 'Delete';
            deleteBtn.addEventListener('click', () => {
                this.smsSettings.scheduledAlerts.splice(index, 1);
                this.renderScheduledAlerts(container);
                this.persistSmsSettings();
            });

            actions.appendChild(editBtn);
            actions.appendChild(deleteBtn);

            item.appendChild(info);
            item.appendChild(actions);

            container.appendChild(item);
        });
    }

    async loadSmsSettings() {
        // 1) Try loading from backend API
        try {
            const res = await fetch(`${this.apiBase}/sms-settings`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
            });

            if (res.ok) {
                const remote = await res.json();
                this.smsSettings = {
                    ...this.smsSettings,
                    ...remote,
                    thresholds: { ...this.smsSettings.thresholds, ...(remote.thresholds || {}) },
                };
                // Mirror into localStorage for faster reloads / offline
                localStorage.setItem('heatMonitorSmsSettings', JSON.stringify(this.smsSettings));
                return;
            }
        } catch (e) {
            console.warn('Failed to load SMS settings from backend, falling back to localStorage', e);
        }

        // 2) Fallback to localStorage
        try {
            const raw = localStorage.getItem('heatMonitorSmsSettings');
            if (!raw) return;

            const parsed = JSON.parse(raw);
            this.smsSettings = {
                ...this.smsSettings,
                ...parsed,
                thresholds: { ...this.smsSettings.thresholds, ...(parsed.thresholds || {}) },
            };
        } catch (e) {
            console.warn('Failed to load SMS settings from localStorage', e);
        }
    }

    async persistSmsSettings() {
        // Save locally first so UI feels instant
        try {
            localStorage.setItem('heatMonitorSmsSettings', JSON.stringify(this.smsSettings));
        } catch (e) {
            console.warn('Failed to save SMS settings to localStorage', e);
        }

        // Then push to backend so it’s stored in DB
        try {
            await fetch(`${this.apiBase}/sms-settings`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify(this.smsSettings),
            });
        } catch (e) {
            console.warn('Failed to persist SMS settings to backend', e);
        }
    }

    checkHeatIndexAlerts() {
        if (!this.smsSettings.enableAlerts) return;
        // Placeholder: hook into backend SMS sending here based on this.data / thresholds.
    }
}

// Initialize dashboard
window.dashboard = new HeatMonitorDashboard();