#include <WiFi.h>
#include <PubSubClient.h>

// ==========================================
// 1. CONFIGURATION WIFI
// ==========================================
const char* ssid = "A93 De Machat";
const char* password = "machat321";

// ==========================================
// 2. CONFIGURATION MQTT (Identique au JS)
// ==========================================
const char* mqtt_server = "test.mosquitto.org";
const int mqtt_port = 1883; // Port standard pour l'ESP32 (différent du JS)

// Topics (DOIVENT ÊTRE EXACTEMENT LES MÊMES QUE DANS SCRIPT.JS)
const char* topic_led = "projet_TP_IOT_2025/led";
const char* topic_temp = "projet_TP_IOT_2025/temperature";

// ==========================================
// 3. OBJETS GLOBAUX
// ==========================================
WiFiClient espClient;
PubSubClient client(espClient);

// Pin de la LED (Sur l'ESP32, la LED bleue intégrée est souvent sur le GPIO 2)
const int ledPin = 2; 

unsigned long lastMsg = 0; // Pour le chrono d'envoi de température

// ==========================================
// 4. SETUP (Lancé une seule fois au début)
// ==========================================
void setup() {
  pinMode(ledPin, OUTPUT);
  Serial.begin(115200); // Pour voir les logs sur l'ordi
  
  setup_wifi();
  
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback); // Définit la fonction qui réagit aux messages reçus
}

// ==========================================
// 5. BOUCLE PRINCIPALE (Tourne à l'infini)
// ==========================================
void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop(); // Maintient la connexion MQTT active

  // Envoi de la température toutes les 5 secondes (5000ms)
  unsigned long now = millis();
  if (now - lastMsg > 5000) {
    lastMsg = now;
    
    // SIMULATION D'UNE TEMPERATURE (Comme tu n'as pas encore de capteur)
    // Génère un nombre entre 20.0 et 30.0
    float temperature = 20.0 + (random(100) / 10.0);
    
    // Conversion en texte (String) pour l'envoi MQTT
    char tempString[8];
    dtostrf(temperature, 1, 2, tempString);
    
    Serial.print("Envoi température : ");
    Serial.println(tempString);
    
    // Publication sur le topic
    client.publish(topic_temp, tempString);
  }
}

// ==========================================
// FONCTIONS UTILITAIRES
// ==========================================

void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Connexion au Wifi : ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi connecté");
  Serial.println("Adresse IP: ");
  Serial.println(WiFi.localIP());
}

// Cette fonction se déclenche quand le site envoie un message
void callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Message reçu [");
  Serial.print(topic);
  Serial.print("] : ");

  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.println(message);

  // Vérification de l'ordre reçu
  if (String(topic) == topic_led) {
    if(message == "ON"){
      digitalWrite(ledPin, HIGH); // Allume la LED
      Serial.println("--> LED ALLUMÉE");
    }
    else if(message == "OFF"){
      digitalWrite(ledPin, LOW);  // Éteint la LED
      Serial.println("--> LED ÉTEINTE");
    }
  }
}

void reconnect() {
  // Boucle jusqu'à la reconnexion
  while (!client.connected()) {
    Serial.print("Tentative de connexion MQTT...");
    // Création d'un ID client aléatoire
    String clientId = "ESP32Client-";
    clientId += String(random(0xffff), HEX);
    
    if (client.connect(clientId.c_str())) {
      Serial.println("Connecté !");
      // Une fois connecté, on s'abonne au topic de la LED pour écouter les ordres
      client.subscribe(topic_led);
    } else {
      Serial.print("Échec, rc=");
      Serial.print(client.state());
      Serial.println(" nouvelle tentative dans 5 secondes");
      delay(5000);
    }
  }
}