#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

const char* ssid = "Wokwi-GUEST";
const char* password = "";
const char* mqtt_server = "broker.hivemq.com";
const int mqtt_port = 1883;
const char* mqtt_topic = "aquarescue/telemetry/drone";

WiFiClient espClient;
PubSubClient client(espClient);

// Initial drone coordinates near AquaRescue reference origin (17.385044, 78.486671)
double droneLat = 17.385044;
double droneLng = 78.486671;
double droneAlt = 15.0;
double angle = 0.0;

void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to WiFi ");
  Serial.println(ssid);

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi connected");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    String clientId = "ESP32Drone-";
    clientId += String(random(0xffff), HEX);
    if (client.connect(clientId.c_str())) {
      Serial.println("connected to MQTT broker");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 2 seconds");
      delay(2000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  setup_wifi();
  client.setServer(mqtt_server, mqtt_port);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  // Incrementally shift telemetry coordinates (circular orbital flight path)
  angle += 0.05;
  if (angle > 6.28318) angle = 0.0;
  droneLat = 17.385044 + (0.0008 * sin(angle));
  droneLng = 78.486671 + (0.0008 * cos(angle));

  StaticJsonDocument<200> doc;
  doc["vehicleId"] = "DRONE_UAV_01";
  doc["lat"] = droneLat;
  doc["lng"] = droneLng;
  doc["alt"] = droneAlt;

  char buffer[256];
  serializeJson(doc, buffer);

  client.publish(mqtt_topic, buffer);
  Serial.print("Published MQTT telemetry: ");
  Serial.println(buffer);

  delay(200);
}
