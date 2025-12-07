// ============================================================
// CONFIGURATION
// ============================================================
const CONFIG = {
    MQTT_HOST: 'test.mosquitto.org', 
    MQTT_PORT: 8081,
    
    MQTT_TOPICS: {
        LED: 'projet_TP_IOT_2025/led',
        TEMP: 'projet_TP_IOT_2025/temperature',
        COMMAND: 'projet_TP_IOT_2025/command'
    },
    SIMULATION_INTERVAL: 5000,
    ADMIN_CREDS: { username: 'admin', password: 'admin123' }
};

// ============================================================
// ÉTAT GLOBAL
// ============================================================
const STATE = {
    user: null,
    isAdmin: false,
    currentDevice: null,
    simulationActive: true,
    mqttConnected: false,
    logs: []
};

// ============================================================
// STORAGE MANAGER (localStorage)
// ============================================================
class Storage {
    static KEY_USERS = 'app:users';
    static KEY_LOGS = 'app:logs';
    static KEY_SESSION = 'app:session';

    static init() {
        if (!localStorage.getItem(this.KEY_USERS)) localStorage.setItem(this.KEY_USERS, JSON.stringify([]));
        if (!localStorage.getItem(this.KEY_LOGS)) localStorage.setItem(this.KEY_LOGS, JSON.stringify([]));
        const users = this.getUsers();
        const adminExists = users.some(u => u.username === CONFIG.ADMIN_CREDS.username);

        if (!adminExists) {
            users.push({
                email: 'admin@system.iot',
                username: CONFIG.ADMIN_CREDS.username,
                password: CONFIG.ADMIN_CREDS.password
            });
            localStorage.setItem(this.KEY_USERS, JSON.stringify(users));
            console.log('👑 Compte Admin généré automatiquement');
        }
    }

    static getUsers() {
        return JSON.parse(localStorage.getItem(this.KEY_USERS)) || [];
    }

    static addUser(email, username, password) {
        const users = this.getUsers();
        if (users.some(u => u.email === email || u.username === username)) {
            return { ok: false, msg: 'Email ou pseudo déjà utilisé' };
        }
        users.push({ email, username, password });
        localStorage.setItem(this.KEY_USERS, JSON.stringify(users));
        return { ok: true, msg: 'Utilisateur créé' };
    }

    static authenticate(input, password) {
        return this.getUsers().find(u => (u.email === input || u.username === input) && u.password === password) || null;
    }

    static userExists(input) {
        return this.getUsers().find(u => u.email === input || u.username === input) || null;
    }

    static deleteUser(email) {
        let users = this.getUsers();
        users = users.filter(u => u.email !== email);
        localStorage.setItem(this.KEY_USERS, JSON.stringify(users));
    }

    static addLog(msg) {
        
        const logs = JSON.parse(localStorage.getItem(this.KEY_LOGS)) || [];
        const time = new Date().toLocaleTimeString('fr-FR');
        logs.unshift({ msg, time });
        if (logs.length > 50) logs.pop();
        localStorage.setItem(this.KEY_LOGS, JSON.stringify(logs));
        STATE.logs = logs;

        const logsList = document.getElementById('logsList');
        if (logsList) {
            
            const emptyMsg = logsList.querySelector('.no-logs');
            if (emptyMsg) emptyMsg.remove();

            const newLogDiv = document.createElement('div');
            newLogDiv.className = 'log-item';
            
            newLogDiv.style.animation = 'fadeIn 0.5s'; 
            newLogDiv.innerHTML = `<strong>${time}</strong> - ${msg}`;

            logsList.prepend(newLogDiv);
        }
    }

    static getLogs() {
        return JSON.parse(localStorage.getItem(this.KEY_LOGS)) || [];
    }

    static saveSession(user, isAdmin) {
        localStorage.setItem(this.KEY_SESSION, JSON.stringify({ user, isAdmin }));
    }

    static getSession() {
        const session = localStorage.getItem(this.KEY_SESSION);
        return session ? JSON.parse(session) : null;
    }

    static clearSession() {
        localStorage.removeItem(this.KEY_SESSION);
    }
}

// ============================================================
// MQTT MANAGER
// ============================================================
class MQTT {
    static connect() {
        try {
            console.log(`⏳ Tentative de connexion à ${CONFIG.MQTT_HOST}:${CONFIG.MQTT_PORT}...`);
            
            STATE.mqttClient = new Paho.MQTT.Client(
                CONFIG.MQTT_HOST, 
                CONFIG.MQTT_PORT, 
                `web_${Date.now()}` // ID unique
            );
            
            STATE.mqttClient.onConnectionLost = (responseObject) => {
                console.log('❌ MQTT connexion perdue:', responseObject.errorMessage);
                STATE.mqttConnected = false;
                Storage.addLog('Connexion MQTT perdue');
            };

            STATE.mqttClient.onMessageArrived = msg => this.handleMessage(msg);

            STATE.mqttClient.connect({
                onSuccess: () => {
                    STATE.mqttConnected = true;
                    console.log('✅ Connecté MQTT avec succès !');
                    Storage.addLog('Connecté au broker MQTT');
                    
                    console.log(`Subscribing to: ${CONFIG.MQTT_TOPICS.TEMP}`);
                    STATE.mqttClient.subscribe(CONFIG.MQTT_TOPICS.TEMP);
                },
                onFailure: (message) => {
                    console.log('⚠️ Échec connexion:', message.errorMessage);
                    Storage.addLog('Erreur connexion: ' + message.errorMessage);
                },
                useSSL: true
            });
        } catch (e) {
            console.log('Erreur critique MQTT:', e);
            Storage.addLog('Erreur critique du client MQTT');
        }
    }

    static publish(topic, msg) {
        if (STATE.mqttClient?.isConnected?.()) {
            const m = new Paho.MQTT.Message(msg);
            m.destinationName = topic;
            STATE.mqttClient.send(m);
        }
        Storage.addLog(`[${topic}] ${msg}`);
    }

    static handleMessage(message) {
        const topic = message.destinationName;
        const payload = message.payloadString;
        Storage.addLog(`[${topic}] ${payload}`);
        if (topic === CONFIG.MQTT_TOPICS.TEMP) updateTempGauge(parseFloat(payload));
    }
}

// ============================================================
// SIMULATION
// ============================================================
let simulationTimer;

function startSimulation() {
    if (simulationTimer) clearInterval(simulationTimer);
    simulationTimer = setInterval(() => {
        if (!STATE.simulationActive) return;
        const temp = (Math.random() * 20 + 15).toFixed(1);
        updateTempGauge(temp);
        MQTT.publish(CONFIG.MQTT_TOPICS.TEMP, temp);
    }, CONFIG.SIMULATION_INTERVAL);
}

function stopSimulation() {
    if (simulationTimer) clearInterval(simulationTimer);
}

function updateTempGauge(value) {
    const pct = Math.max(0, Math.min(100, (value - 15) / 20 * 100));
    const gauge = document.getElementById('tempGauge');
    const display = document.getElementById('tempValue');
    const status = document.getElementById('tempStatus');
    
    if (!gauge) return;
    gauge.style.height = pct + '%';
    display.textContent = value + '°C';
    status.textContent = value < 18 ? '❄️ Froid' : value > 28 ? '🔥 Chaud' : '🔵 Normal';
}

// ============================================================
// ROUTEUR & NAVIGATION
// ============================================================
const VIEWS = {};

function registerView(name, template, handlers = {}) {
    VIEWS[name] = { template, handlers };
}

function goTo(viewName) {
    const app = document.getElementById('app');
    const view = VIEWS[viewName];
    if (!view) return console.error(`Vue ${viewName} non trouvée`);

    app.innerHTML = view.template();
    
    if (viewName === 'dashboard') startSimulation();
    else stopSimulation();

    // Attacher les handlers
    Object.entries(view.handlers).forEach(([selector, handler]) => {
        document.addEventListener('click', e => {
            if (e.target.matches(selector)) handler(e);
        });
    });

    // Handlers spécifiques
    if (viewName === 'dashboard') attachDashboardHandlers();
    else if (viewName === 'admin') attachAdminHandlers();
    else if (viewName === 'selection') attachSelectionHandlers();
    else if (viewName === 'auth') attachAuthHandlers();
}

// ============================================================
// TEMPLATES DES VUES
// ============================================================

// VUE: AUTHENTIFICATION
registerView('auth', () => `
    <div class="auth-container">
        <div class="auth-header">
            <h1>🌐 Projet IOT</h1>
            <p>Gestion IoT via MQTT</p>
        </div>
        
        <div class="tabs">
            <button class="tab-btn active" data-tab="login">Connexion</button>
            <button class="tab-btn" data-tab="register">Inscription</button>
        </div>

        <div id="loginTab" class="tab-content active">
            <form id="loginForm">
                <div class="form-group">
                    <label>Identifiant</label>
                    <input type="text" id="loginUser" placeholder="Email ou pseudo" required>
                </div>
                <div class="form-group">
                    <label>Mot de passe</label>
                    <input type="password" id="loginPass" placeholder="Mot de passe" required>
                </div>
                <button type="submit" class="btn btn-primary">Se connecter</button>
                <div id="loginError" class="error-msg"></div>
            </form>
        </div>

        <div id="registerTab" class="tab-content">
            <form id="registerForm">
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="registerEmail" placeholder="votre@email.com" required>
                </div>
                <div class="form-group">
                    <label>Nom d'utilisateur</label>
                    <input type="text" id="registerUser" placeholder="pseudo" required>
                </div>
                <div class="form-group">
                    <label>Mot de passe</label>
                    <input type="password" id="registerPass" placeholder="Min 6 caractères" required>
                </div>
                <button type="submit" class="btn btn-primary">S'inscrire</button>
                <div id="registerError" class="error-msg"></div>
                <div id="registerSuccess" class="success-msg"></div>
            </form>
        </div>
    </div>
`);

// VUE: SÉLECTION APPAREILS
registerView('selection', () => `
    <div class="header">
        <h2>Sélectionnez un capteur</h2>
        <div class="header-right">
            <span class="user-info">👤 ${STATE.user.username}</span>
            <button class="btn btn-secondary btn-logout">Déconnexion</button>
        </div>
    </div>
    <div class="container">
        <div class="devices-grid">
            <div class="device-card" data-device="salon">
                <div class="device-icon">🌡️</div>
                <h3>Capteur Salon</h3>
                <p>Température & Humidité</p>
                <span class="device-status">En ligne</span>
            </div>
            <div class="device-card" data-device="cuisine">
                <div class="device-icon">🍳</div>
                <h3>Capteur Cuisine</h3>
                <p>Qualité de l'air</p>
                <span class="device-status">En ligne</span>
            </div>
            <div class="device-card" data-device="garage">
                <div class="device-icon">🚗</div>
                <h3>Garage</h3>
                <p>Détecteur de mouvement</p>
                <span class="device-status">En ligne</span>
            </div>
            <div class="device-card" data-device="chambre">
                <div class="device-icon">🛏️</div>
                <h3>Capteur Chambre</h3>
                <p>Température & Luminosité</p>
                <span class="device-status">En ligne</span>
            </div>
        </div>
        ${STATE.isAdmin ? `
            <div style="text-align: center; margin-top: 30px;">
                <button class="btn btn-danger btn-admin">🔒 Accès Administration</button>
            </div>
        ` : ''}
    </div>
`);

// VUE: DASHBOARD
registerView('dashboard', () => `
    <div class="header">
        <button class="btn btn-secondary btn-back">← Retour</button>
        <h2 id="deviceTitle">Dashboard - ${STATE.currentDevice.charAt(0).toUpperCase() + STATE.currentDevice.slice(1)}</h2>
        <div class="header-right">
            <button class="btn btn-secondary btn-logout">Déconnexion</button>
        </div>
    </div>
    <div class="container">
        <div class="dashboard-container">
            <div class="control-card">
                <h3>Contrôle LED</h3>
                <div class="control-content">
                    <p>État : <span id="ledStatus">Éteinte</span></p>
                    <div class="button-group">
                        <button class="btn btn-success btn-led-on">Allumer</button>
                        <button class="btn btn-danger btn-led-off">Éteindre</button>
                    </div>
                </div>
            </div>

            <div class="control-card">
                <h3>Température</h3>
                <div class="control-content">
                    <div class="gauge">
                        <div class="gauge-fill" id="tempGauge"></div>
                        <span id="tempValue">--°C</span>
                    </div>
                    <p id="tempStatus">En attente...</p>
                </div>
            </div>

            <div class="control-card">
                <h3>Mode Simulation</h3>
                <div class="control-content">
                    <label class="toggle-switch">
                        <input type="checkbox" id="simulationToggle" ${STATE.simulationActive ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                    <p id="simulationStatus">${STATE.simulationActive ? '✅ Activée' : '⏸️ Désactivée'}</p>
                </div>
            </div>
        </div>

        <div class="logs-container">
            <h3>Logs d'activité</h3>
            <div class="logs-list" id="logsList">
                ${STATE.logs.length === 0 ? '<p class="no-logs">Aucun log</p>' : STATE.logs.map(l => `
                    <div class="log-item"><strong>${l.time}</strong> - ${l.msg}</div>
                `).join('')}
            </div>
        </div>
    </div>
`);

// VUE: ADMINISTRATION
registerView('admin', () => `
    <div class="header">
        <button class="btn btn-secondary btn-back">← Retour</button>
        <h2>🔒 Panneau Administration</h2>
        <div class="header-right">
            <button class="btn btn-secondary btn-logout">Déconnexion</button>
        </div>
    </div>
    <div class="container">
        <div class="admin-container">
            <h3>Utilisateurs inscrits (${Storage.getUsers().length})</h3>
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Email</th>
                        <th>Pseudo</th>
                        <th>Mot de passe</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody id="usersTableBody">
                    <tr><td colspan="4" class="no-data">Aucun utilisateur</td></tr>
                </tbody>
            </table>
        </div>
    </div>
`);

// ============================================================
// HANDLERS SPÉCIFIQUES
// ============================================================

function attachAuthHandlers() {
    // Onglets
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(tab + 'Tab').classList.add('active');
        });
    });

    // Connexion
    document.getElementById('loginForm')?.addEventListener('submit', e => {
        e.preventDefault();
        const input = document.getElementById('loginUser').value;
        const pass = document.getElementById('loginPass').value;
        const err = document.getElementById('loginError');

        const user = Storage.authenticate(input, pass);
        if (user) {
            STATE.user = user;
            STATE.isAdmin = user.username === CONFIG.ADMIN_CREDS.username && user.password === CONFIG.ADMIN_CREDS.password;
            Storage.saveSession(user, STATE.isAdmin);
            Storage.addLog(`${user.username} connecté`);
            MQTT.connect();
            goTo('selection');
        } else {
            // Vérifier si l'identifiant existe
            const userExists = Storage.userExists(input);
            if (userExists) {
                err.textContent = '❌ Mot de passe incorrecte';
            } else {
                err.textContent = '❌ Identifiant inexistant';
            }
            err.classList.add('show');
            setTimeout(() => err.classList.remove('show'), 3000);
        }
    });

    // Inscription
    document.getElementById('registerForm')?.addEventListener('submit', e => {
        e.preventDefault();
        const email = document.getElementById('registerEmail').value;
        const user = document.getElementById('registerUser').value;
        const pass = document.getElementById('registerPass').value;
        const err = document.getElementById('registerError');
        const suc = document.getElementById('registerSuccess');

        if (pass.length < 6) {
            err.textContent = '❌ Min 6 caractères';
            err.classList.add('show');
            return;
        }

        const res = Storage.addUser(email, user, pass);
        if (res.ok) {
            suc.textContent = '✅ ' + res.msg + ' !';
            suc.classList.add('show');
            setTimeout(() => {
                document.querySelector('[data-tab="login"]').click();
                e.target.reset();
            }, 1500);
        } else {
            err.textContent = '❌ ' + res.msg;
            err.classList.add('show');
        }
    });
}

function attachSelectionHandlers() {
    document.querySelectorAll('.device-card').forEach(card => {
        card.addEventListener('click', () => {
            STATE.currentDevice = card.dataset.device;
            goTo('dashboard');
        });
    });

    document.querySelector('.btn-admin')?.addEventListener('click', () => goTo('admin'));
}

function attachDashboardHandlers() {
    document.querySelector('.btn-back')?.addEventListener('click', () => goTo('selection'));
    
    document.querySelector('.btn-led-on')?.addEventListener('click', () => {
        document.getElementById('ledStatus').textContent = 'Allumée 🟢';
        MQTT.publish(CONFIG.MQTT_TOPICS.LED, 'ON');
        Storage.addLog('LED allumée');
    });

    document.querySelector('.btn-led-off')?.addEventListener('click', () => {
        document.getElementById('ledStatus').textContent = 'Éteinte 🔴';
        MQTT.publish(CONFIG.MQTT_TOPICS.LED, 'OFF');
        Storage.addLog('LED éteinte');
    });

    document.getElementById('simulationToggle')?.addEventListener('change', e => {
        STATE.simulationActive = e.target.checked;
        document.getElementById('simulationStatus').textContent = e.target.checked ? '✅ Activée' : '⏸️ Désactivée';
    });
}

// NOUVEAU: Handler pour l'admin
function attachAdminHandlers() {
    document.querySelector('.btn-back')?.addEventListener('click', () => goTo('selection'));
    populateAdminTable();
}

function populateAdminTable() {
    const tbody = document.getElementById('usersTableBody');
    const users = Storage.getUsers();
    
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="no-data">Aucun utilisateur</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(u => `
        <tr>
            <td>${u.email}</td>
            <td>${u.username}</td>
            <td>••••••</td>
            <td><button class="btn-delete" onclick="deleteUser('${u.email}')">Supprimer</button></td>
        </tr>
    `).join('');
}

function deleteUser(email) {
    if (!confirm('Supprimer cet utilisateur ?')) return;
    Storage.deleteUser(email);
    Storage.addLog(`${email} supprimé`);
    populateAdminTable();
}

// ============================================================
// LOGOUT CENTRALISÉ
// ============================================================
document.addEventListener('click', e => {
    if (e.target.classList.contains('btn-logout')) {
        stopSimulation();
        STATE.user = null;
        STATE.isAdmin = false;
        STATE.currentDevice = null;
        Storage.clearSession();
        goTo('auth');
    }
});

// ============================================================
// INITIALISATION
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    Storage.init();
    STATE.logs = Storage.getLogs();
    
    // Restaurer la session si elle existe
    const session = Storage.getSession();
    if (session && session.user) {
        STATE.user = session.user;
        STATE.isAdmin = session.isAdmin;
        MQTT.connect();
        goTo('selection');
    } else {
        goTo('auth');
    }
    
    console.log('✅ SPA initialisée');
});
