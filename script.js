// ============================================================
// CONFIGURATION GLOBALE
// ============================================================
const CONFIG = {
    MQTT_BROKER: 'wss://test.mosquitto.org:8081',
    MQTT_TOPICS: {
        LED: 'iot/device/led',
        TEMP: 'iot/device/temperature',
        COMMAND: 'iot/device/command'
    },
    SIMULATION_INTERVAL: 5000 // 5 secondes
};

// ============================================================
// ÉTAT GLOBAL DE L'APPLICATION
// ============================================================
const APP_STATE = {
    currentView: 'auth',
    currentUser: null,
    currentDevice: null,
    isAdmin: false,
    simulationActive: true,
    mqttClient: null,
    simulationTimer: null,
    logs: []
};

// ============================================================
// GESTION DU localStorage (Simulation BDD)
// ============================================================
class StorageManager {
    // Initialiser le localStorage avec des données par défaut
    static init() {
        if (!localStorage.getItem('users')) {
            localStorage.setItem('users', JSON.stringify([]));
        }
        if (!localStorage.getItem('mqtt_logs')) {
            localStorage.setItem('mqtt_logs', JSON.stringify([]));
        }
    }

    // Récupérer tous les utilisateurs
    static getUsers() {
        return JSON.parse(localStorage.getItem('users')) || [];
    }

    // Ajouter un nouvel utilisateur
    static addUser(email, username, password) {
        const users = this.getUsers();
        if (users.some(u => u.email === email || u.username === username)) {
            return { success: false, message: 'Email ou pseudo déjà utilisé' };
        }
        users.push({ email, username, password });
        localStorage.setItem('users', JSON.stringify(users));
        return { success: true, message: 'Utilisateur créé avec succès' };
    }

    // Vérifier l'authentification
    static authenticate(userInput, password) {
        const users = this.getUsers();
        const user = users.find(u => (u.email === userInput || u.username === userInput) && u.password === password);
        return user || null;
    }

    // Supprimer un utilisateur
    static deleteUser(email) {
        let users = this.getUsers();
        users = users.filter(u => u.email !== email);
        localStorage.setItem('users', JSON.stringify(users));
    }

    // Ajouter un log MQTT
    static addLog(message) {
        const logs = JSON.parse(localStorage.getItem('mqtt_logs')) || [];
        const timestamp = new Date().toLocaleTimeString('fr-FR');
        logs.unshift({ message, timestamp });
        // Garder seulement les 50 derniers logs
        if (logs.length > 50) logs.pop();
        localStorage.setItem('mqtt_logs', JSON.stringify(logs));
        APP_STATE.logs = logs;
    }

    // Récupérer les logs
    static getLogs() {
        return JSON.parse(localStorage.getItem('mqtt_logs')) || [];
    }
}

// ============================================================
// GESTION MQTT
// ============================================================
class MQTTManager {
    static connect() {
        try {
            const clientId = `web_client_${Date.now()}`;
            APP_STATE.mqttClient = new Paho.MQTT.Client(CONFIG.MQTT_BROKER, 8081, clientId);
            
            APP_STATE.mqttClient.onConnectionLost = () => {
                console.log('Connexion MQTT perdue');
                StorageManager.addLog('❌ Connexion MQTT perdue');
            };

            APP_STATE.mqttClient.onMessageArrived = (message) => {
                this.handleMessage(message);
            };

            APP_STATE.mqttClient.connect({
                onSuccess: () => {
                    console.log('Connecté au broker MQTT');
                    StorageManager.addLog('✅ Connecté au broker MQTT');
                    APP_STATE.mqttClient.subscribe(CONFIG.MQTT_TOPICS.TEMP);
                },
                onFailure: () => {
                    console.log('Broker MQTT indisponible');
                    StorageManager.addLog('⚠️ Mode simulation activé (Pas de broker)');
                }
            });
        } catch (error) {
            console.log('MQTT non disponible, mode simulation', error);
            StorageManager.addLog('⚠️ Mode simulation activé');
        }
    }

    static publish(topic, message) {
        if (APP_STATE.mqttClient && APP_STATE.mqttClient.isConnected()) {
            const msg = new Paho.MQTT.Message(message);
            msg.destinationName = topic;
            APP_STATE.mqttClient.send(msg);
        }
        StorageManager.addLog(`📤 [${topic}] ${message}`);
    }

    static handleMessage(message) {
        const topic = message.destinationName;
        const payload = message.payloadString;
        StorageManager.addLog(`📥 [${topic}] ${payload}`);
        
        if (topic === CONFIG.MQTT_TOPICS.TEMP) {
            updateTemperatureGauge(parseFloat(payload));
        }
    }
}

// ============================================================
// SIMULATION IoT
// ============================================================
function startSimulation() {
    if (APP_STATE.simulationTimer) clearInterval(APP_STATE.simulationTimer);
    
    APP_STATE.simulationTimer = setInterval(() => {
        if (!APP_STATE.simulationActive) return;

        // Simuler température (15-35°C)
        const tempValue = (Math.random() * 20 + 15).toFixed(1);
        updateTemperatureGauge(tempValue);
        StorageManager.addLog(`🤖 Température simulée: ${tempValue}°C`);

        // Simuler un message de capteur
        MQTTManager.publish(CONFIG.MQTT_TOPICS.TEMP, tempValue);
    }, CONFIG.SIMULATION_INTERVAL);
}

function stopSimulation() {
    if (APP_STATE.simulationTimer) {
        clearInterval(APP_STATE.simulationTimer);
        APP_STATE.simulationTimer = null;
    }
}

// ============================================================
// MISE À JOUR UI - JAUGE TEMPÉRATURE
// ============================================================
function updateTemperatureGauge(value) {
    const percentage = Math.max(0, Math.min(100, (value - 15) / 20 * 100));
    document.getElementById('tempGauge').style.height = percentage + '%';
    document.getElementById('tempValue').textContent = value + '°C';
    
    let status = '🔵 Température normale';
    if (value < 18) status = '❄️ Froid';
    else if (value > 28) status = '🔥 Chaud';
    
    document.getElementById('tempStatus').textContent = status;
}

// ============================================================
// SYSTÈME DE NAVIGATION
// ============================================================
function showView(viewName) {
    // Masquer toutes les vues
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    
    // Afficher la vue demandée
    document.getElementById(viewName + 'View').classList.add('active');
    APP_STATE.currentView = viewName;

    // Actions spécifiques par vue
    if (viewName === 'dashboard') {
        startSimulation();
        refreshLogs();
    } else if (viewName === 'admin') {
        populateAdminTable();
    } else {
        stopSimulation();
    }
}

function navigateToDevice(deviceName) {
    APP_STATE.currentDevice = deviceName;
    document.getElementById('deviceTitle').textContent = `Dashboard - ${deviceName.charAt(0).toUpperCase() + deviceName.slice(1)}`;
    showView('dashboard');
}

// ============================================================
// AUTHENTIFICATION
// ============================================================
function initAuthListeners() {
    // Système d'onglets
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            
            // Mettre à jour les boutons
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Mettre à jour les contenus
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            document.getElementById(tabName + 'Tab').classList.add('active');
        });
    });

    // Connexion
    document.getElementById('loginForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const userInput = document.getElementById('loginUser').value;
        const password = document.getElementById('loginPass').value;
        const errorDiv = document.getElementById('loginError');

        const user = StorageManager.authenticate(userInput, password);
        if (user) {
            APP_STATE.currentUser = user.username;
            APP_STATE.isAdmin = (user.username === 'admin' && user.password === 'admin123');
            
            if (APP_STATE.isAdmin) {
                document.getElementById('adminPanel').style.display = 'block';
            }
            
            StorageManager.addLog(`👤 ${user.username} connecté`);
            MQTTManager.connect();
            document.getElementById('currentUser').textContent = user.username;
            showView('selection');
        } else {
            errorDiv.textContent = '❌ Identifiants incorrects';
            errorDiv.classList.add('show');
            setTimeout(() => errorDiv.classList.remove('show'), 3000);
        }
    });

    // Inscription
    document.getElementById('registerForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('registerEmail').value;
        const username = document.getElementById('registerUser').value;
        const password = document.getElementById('registerPass').value;
        const errorDiv = document.getElementById('registerError');
        const successDiv = document.getElementById('registerSuccess');

        if (password.length < 6) {
            errorDiv.textContent = '❌ Le mot de passe doit contenir au moins 6 caractères';
            errorDiv.classList.add('show');
            return;
        }

        const result = StorageManager.addUser(email, username, password);
        if (result.success) {
            successDiv.textContent = '✅ ' + result.message + ' ! Vous pouvez vous connecter.';
            successDiv.classList.add('show');
            document.getElementById('registerForm').reset();
            setTimeout(() => {
                successDiv.classList.remove('show');
                document.querySelector('[data-tab="login"]').click();
            }, 2000);
        } else {
            errorDiv.textContent = '❌ ' + result.message;
            errorDiv.classList.add('show');
        }
    });
}

// ============================================================
// SÉLECTION DES OBJETS & DASHBOARD
// ============================================================
function initDeviceSelection() {
    document.querySelectorAll('.device-card').forEach(card => {
        card.addEventListener('click', () => {
            const deviceName = card.dataset.device;
            navigateToDevice(deviceName);
        });
    });

    document.getElementById('adminBtn').addEventListener('click', () => {
        if (APP_STATE.isAdmin) showView('admin');
    });
}

function initDashboard() {
    // Contrôle LED
    document.getElementById('ledOnBtn').addEventListener('click', () => {
        document.getElementById('ledStatus').textContent = 'Allumée 🟢';
        MQTTManager.publish(CONFIG.MQTT_TOPICS.LED, 'ON');
        StorageManager.addLog('💡 LED allumée');
    });

    document.getElementById('ledOffBtn').addEventListener('click', () => {
        document.getElementById('ledStatus').textContent = 'Éteinte 🔴';
        MQTTManager.publish(CONFIG.MQTT_TOPICS.LED, 'OFF');
        StorageManager.addLog('💡 LED éteinte');
    });

    // Toggle Simulation
    document.getElementById('simulationToggle').addEventListener('change', (e) => {
        APP_STATE.simulationActive = e.target.checked;
        document.getElementById('simulationStatus').textContent = e.target.checked ? '✅ Simulation activée' : '⏸️ Simulation désactivée';
    });

    // Bouton Retour
    document.getElementById('backBtn').addEventListener('click', () => {
        stopSimulation();
        showView('selection');
    });
}

// ============================================================
// PANNEAU ADMINISTRATION
// ============================================================
function populateAdminTable() {
    const users = StorageManager.getUsers();
    const tbody = document.getElementById('usersTableBody');
    
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="no-data">Aucun utilisateur inscrit</td></tr>';
        return;
    }

    tbody.innerHTML = users.map((user, index) => `
        <tr>
            <td>${user.email}</td>
            <td>${user.username}</td>
            <td>••••••</td>
            <td>
                <button class="btn-delete" onclick="deleteUserFromAdmin('${user.email}')">Supprimer</button>
            </td>
        </tr>
    `).join('');
}

function deleteUserFromAdmin(email) {
    if (confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) {
        StorageManager.deleteUser(email);
        StorageManager.addLog(`🗑️ Utilisateur ${email} supprimé`);
        populateAdminTable();
    }
}

function initAdmin() {
    document.getElementById('backAdminBtn').addEventListener('click', () => {
        showView('selection');
    });
}

// ============================================================
// RAFRAÎCHISSEMENT DES LOGS
// ============================================================
function refreshLogs() {
    const logs = StorageManager.getLogs();
    const logsList = document.getElementById('logsList');

    if (logs.length === 0) {
        logsList.innerHTML = '<p class="no-logs">Aucun log pour le moment</p>';
        return;
    }

    logsList.innerHTML = logs.map(log => `
        <div class="log-item">
            <strong>${log.timestamp}</strong> - ${log.message}
        </div>
    `).join('');
}

// ============================================================
// DÉCONNEXION CENTRALISÉE
// ============================================================
function logout() {
    stopSimulation();
    APP_STATE.currentUser = null;
    APP_STATE.isAdmin = false;
    APP_STATE.currentDevice = null;
    document.getElementById('adminPanel').style.display = 'none';
    document.getElementById('loginForm').reset();
    document.getElementById('registerForm').reset();
    document.querySelector('[data-tab="login"]').click();
    showView('auth');
}

// ============================================================
// INITIALISATION DE L'APPLICATION
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    // Initialiser le localStorage
    StorageManager.init();
    
    // Initialiser les listeners
    initAuthListeners();
    initDeviceSelection();
    initDashboard();
    initAdmin();
    
    // Bouton logout centralisé (un seul pour les 3 vues)
    document.querySelectorAll('#logoutBtn').forEach(btn => {
        btn.addEventListener('click', logout);
    });
    
    // Afficher la vue d'authentification par défaut
    showView('auth');
    
    console.log('✅ Application IoT MQTT SPA initialisée');
    StorageManager.addLog('✅ Application démarrée');
});
