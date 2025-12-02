const mqtt = require('paho-mqtt').mqtt;

let client;
const brokerUrl = 'ws://broker.hivemq.com:8000/mqtt'; // Example broker URL
const clientId = 'mqtt_client_' + Math.random().toString(16).substr(2, 8);

function connect() {
    client = new mqtt.Client(brokerUrl, clientId);

    client.onConnectionLost = onConnectionLost;
    client.onMessageArrived = onMessageArrived;

    client.connect({
        onSuccess: onConnect,
        onFailure: onFailure
    });
}

function onConnect() {
    console.log('Connected to MQTT broker');
    client.subscribe('home/temperature');
    client.subscribe('home/led');
}

function onFailure(responseObject) {
    console.error('Connection failed: ' + responseObject.errorMessage);
}

function onConnectionLost(responseObject) {
    if (responseObject.errorCode !== 0) {
        console.error('Connection lost: ' + responseObject.errorMessage);
    }
}

function onMessageArrived(message) {
    console.log('Message arrived: ' + message.payloadString);
    // Handle incoming messages here
}

function publish(topic, message) {
    const mqttMessage = new mqtt.Message(message);
    mqttMessage.destinationName = topic;
    client.send(mqttMessage);
}

module.exports = {
    connect,
    publish
};