export function updateTemperatureDisplay(temperature) {
    const tempDisplayElement = document.getElementById('temperature-display');
    if (tempDisplayElement) {
        tempDisplayElement.textContent = `${temperature} °C`;
    }
}