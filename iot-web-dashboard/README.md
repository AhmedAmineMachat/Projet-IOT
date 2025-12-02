# IoT Web Dashboard

This project is an IoT web dashboard that simulates an ESP32 device using MQTT via WebSockets. It provides a user-friendly interface to monitor and control IoT devices, featuring a connection status indicator, a toggle button for an LED, and a temperature display.

## Features

- **Connection Status**: Displays the current connection status to the MQTT broker.
- **LED Toggle Button**: Allows users to turn an LED on or off by publishing messages to the MQTT topic.
- **Temperature Display**: Shows the current temperature readings, updated in real-time.
- **Simulation Section**: Simulates temperature data and logs actions taken on the dashboard.

## Project Structure

```
iot-web-dashboard
├── src
│   ├── index.html          # Main HTML structure of the dashboard
│   ├── css
│   │   └── styles.css      # Styles for the dashboard (Dark Mode)
│   ├── js
│   │   ├── app.js          # Main JavaScript entry point
│   │   ├── mqtt-client.js   # MQTT connection handling
│   │   ├── simulator.js      # Simulation logic for temperature data
│   │   └── components
│   │       ├── connection-status.js  # Connection status indicator
│   │       ├── led-toggle.js          # LED toggle button functionality
│   │       ├── temp-display.js        # Temperature display updates
│   │       └── simulation-panel.js    # Manages the simulation panel
│   └── data
│       └── sample-sensor-data.json    # Sample data for testing
├── package.json          # npm configuration file
├── .gitignore            # Files to ignore in version control
├── README.md             # Project documentation
└── LICENSE               # Licensing information
```

## Setup Instructions

1. Clone the repository:
   ```
   git clone <repository-url>
   ```

2. Navigate to the project directory:
   ```
   cd iot-web-dashboard
   ```

3. Install dependencies (if any):
   ```
   npm install
   ```

4. Open `src/index.html` in a web browser to view the dashboard.

## Usage

- Connect to the MQTT broker by ensuring the correct settings are configured in `mqtt-client.js`.
- Use the LED toggle button to control the LED state.
- Monitor the temperature display for real-time updates.
- Start the simulation to generate random temperature data.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.