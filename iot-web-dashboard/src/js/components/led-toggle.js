function ledToggle(mqttClient) {
    const ledButton = document.getElementById('led-toggle');

    ledButton.addEventListener('click', () => {
        const ledState = ledButton.classList.toggle('active') ? '1' : '0';
        mqttClient.publish('home/led', ledState);
        console.log(`LED state changed to: ${ledState}`);
    });
}

export default ledToggle;