function simulationPanel() {
    let simulationInterval;

    const startSimulation = () => {
        if (!simulationInterval) {
            simulationInterval = setInterval(() => {
                const temperature = (Math.random() * 10 + 20).toFixed(2); // Generates a temperature between 20 and 30
                console.log(`Simulated Temperature: ${temperature}°C`);
                // Here you would publish the temperature to the MQTT topic
                // mqttClient.publish('temperature/topic', temperature);
            }, 5000);
            console.log("Temperature simulation started.");
        }
    };

    const stopSimulation = () => {
        if (simulationInterval) {
            clearInterval(simulationInterval);
            simulationInterval = null;
            console.log("Temperature simulation stopped.");
        }
    };

    return {
        startSimulation,
        stopSimulation
    };
}

export default simulationPanel;