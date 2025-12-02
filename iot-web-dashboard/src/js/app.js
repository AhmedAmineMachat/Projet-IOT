// Main JavaScript entry point for the IoT Web Dashboard

// Import necessary components
import { initConnectionStatus } from './components/connection-status.js';
import { handleLedToggle } from './components/led-toggle.js';
import { updateTemperatureDisplay } from './components/temp-display.js';
import { startSimulation, stopSimulation } from './components/simulation-panel.js';
import { connectMqtt } from './mqtt-client.js';

// Initialize the MQTT connection
const mqttClient = connectMqtt();

// Set up event listeners
document.getElementById('led-toggle').addEventListener('click', handleLedToggle);
document.getElementById('start-simulation').addEventListener('click', startSimulation);
document.getElementById('stop-simulation').addEventListener('click', stopSimulation);

// Update connection status on MQTT connection state change
mqttClient.onConnectionLost = function(responseObject) {
    initConnectionStatus(false);
};

mqttClient.onMessageArrived = function(message) {
    if (message.destinationName === 'temperature') {
        updateTemperatureDisplay(message.payloadString);
    }
};

// Initialize connection status on page load
window.onload = function() {
    initConnectionStatus(true);
};