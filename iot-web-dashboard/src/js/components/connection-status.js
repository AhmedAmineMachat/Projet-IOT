function updateConnectionStatus(isConnected) {
    const statusElement = document.getElementById('connection-status');
    if (isConnected) {
        statusElement.textContent = 'Connected';
        statusElement.style.color = 'green';
    } else {
        statusElement.textContent = 'Disconnected';
        statusElement.style.color = 'red';
    }
}

export { updateConnectionStatus };