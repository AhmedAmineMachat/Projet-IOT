// This file contains the simulation logic. It generates random temperature values between 20 and 30°C and publishes them to the temperature topic every 5 seconds. It also logs messages to the console when the LED toggle button is pressed.

let mqttClient; // Assume this is initialized in app.js
const temperatureTopic = "home/temperature";
const ledTopic = "home/led";

function startTemperatureSimulation() {
    setInterval(() => {
        const temperature = (Math.random() * 10 + 20).toFixed(2); // Generate random temperature between 20 and 30
        mqttClient.publish(temperatureTopic, temperature);
        console.log(`Published temperature: ${temperature}°C`);
    }, 5000);
}

function logLedToggle(state) {
    console.log(`LED toggled: ${state ? 'ON' : 'OFF'}`);
}

// Export functions for use in other modules
export { startTemperatureSimulation, logLedToggle };