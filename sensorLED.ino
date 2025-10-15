#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include "esp_eap_client.h"
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_TSL2591.h>

// ======== NYU WiFi Credentials (WPA2 Enterprise) ========
const char* ssid = "nyu";
const char* EAP_IDENTITY = "";
const char* EAP_USERNAME = "";
const char* EAP_PASSWORD = "";

// ======== Hardware Setup ========
Adafruit_TSL2591 tsl = Adafruit_TSL2591(2591);
const int ledPin = 12;

// ======== Web Server ========
WebServer server(80);

// ======== Latest Sensor Data ========
struct SensorData {
  uint16_t visible_ir;
  uint16_t ir;
  float lux;
  unsigned long timestamp;
} latestData;

// ======== Timing Variables ========
unsigned long prevSensorMillis = 0;
unsigned long previousWiFiMillis = 0;
unsigned long wifiLogMillis = 0;

// ======== Intervals ========
const unsigned long sensorInterval = 500;  // log sensor data every 0.5s
const long wifiCheckInterval = 10000;      // Check WiFi connection every 10 seconds
const long wifiLogInterval = 30000;        // Detailed WiFi logs every 30 seconds

// ======== State Tracking ========
bool wifiConnected = false;
int wifiReconnectAttempts = 0;

void setup() {
  Serial.begin(115200);
  delay(2000);

  Serial.println("========================================");
  Serial.println("ESP32 Light Sensor + NYU WiFi System");
  Serial.println("========================================");

  pinMode(ledPin, OUTPUT);
  digitalWrite(ledPin, HIGH);
  Serial.println("🟢 LED initialized on pin 12 - Always ON");

  Wire.begin(21, 22);
  Serial.println("🔗 I2C initialized (SDA: 21, SCL: 22)");

  if (!tsl.begin()) {
    Serial.println("❌ TSL2591 not found. Check wiring!");
    while (1) {
      digitalWrite(ledPin, HIGH);
      delay(100);
      digitalWrite(ledPin, LOW);
      delay(100);
    }
  }
  Serial.println("✅ TSL2591 sensor found!");
  tsl.setGain(TSL2591_GAIN_MED);
  tsl.setTiming(TSL2591_INTEGRATIONTIME_100MS);
  Serial.println("🔧 Sensor configured: GAIN_MED, 100ms integration");

  // Connect to NYU WiFi
  connectToNYUWiFi();

  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    printConnectionDetails();
    testInternetConnection();

    // Setup HTTP server endpoints
    server.on("/", handleRoot);
    server.on("/data", handleData);
    server.enableCORS(true);  // Enable CORS for web app access
    server.begin();

    Serial.println("\n🌐 [SERVER] HTTP server started!");
    Serial.println("========================================");
    Serial.println("📱 ACCESS FROM ANY DEVICE ON NYU NETWORK:");
    Serial.print("   http://");
    Serial.println(WiFi.localIP());
    Serial.print("   Sensor data: http://");
    Serial.print(WiFi.localIP());
    Serial.println("/data");
    Serial.println("========================================\n");
  }

  Serial.println("🚀 System initialized - Starting main loop...\n");
}

void loop() {
  unsigned long currentMillis = millis();

  // ====== Handle HTTP requests ======
  server.handleClient();

  // ====== Read light sensor ======
  if (currentMillis - prevSensorMillis >= sensorInterval) {
    prevSensorMillis = currentMillis;
    readLightSensor();
  }

  // ====== WiFi connection check ======
  if (currentMillis - previousWiFiMillis >= wifiCheckInterval) {
    previousWiFiMillis = currentMillis;
    monitorWiFiConnection();
  }

  // ====== Detailed WiFi logs ======
  if (currentMillis - wifiLogMillis >= wifiLogInterval) {
    wifiLogMillis = currentMillis;
    logDetailedWiFiStatus();
  }
}

// ====== FUNCTIONS ======

void readLightSensor() {
  uint32_t full = tsl.getFullLuminosity();
  uint16_t ir = full >> 16;
  uint16_t broadband = full & 0xFFFF;
  float lux = tsl.calculateLux(broadband, ir);

  // Store latest data for web server
  latestData.visible_ir = broadband;
  latestData.ir = ir;
  latestData.lux = lux;
  latestData.timestamp = millis();

  Serial.print("💡 [SENSOR] Visible+IR: ");
  Serial.print(broadband);
  Serial.print(" | IR: ");
  Serial.print(ir);
  Serial.print(" | Lux: ");
  Serial.print(lux);

  if (wifiConnected) {
    Serial.print(" | WiFi: ✅ (");
    Serial.print(WiFi.RSSI());
    Serial.print(" dBm)");
  } else {
    Serial.print(" | WiFi: ❌");
  }
  Serial.println();
}

// ====== HTTP SERVER HANDLERS ======
void handleRoot() {
  String html = "<!DOCTYPE html><html><head>";
  html += "<meta name='viewport' content='width=device-width, initial-scale=1'>";
  html += "<style>body{font-family:Arial;padding:20px;background:#1a1a1a;color:#fff;}";
  html += "h1{color:#4CAF50;}a{color:#2196F3;}</style></head><body>";
  html += "<h1>ESP32 Light Sensor Server</h1>";
  html += "<p>✅ Server is running on NYU Network!</p>";
  html += "<p><strong>Current IP:</strong> " + WiFi.localIP().toString() + "</p>";
  html += "<p><strong>Access sensor data:</strong> <a href='/data'>/data</a></p>";
  html += "<p><strong>Signal Strength:</strong> " + String(WiFi.RSSI()) + " dBm</p>";
  html += "<hr><p>Use this IP address in your web app to fetch live sensor data.</p>";
  html += "</body></html>";
  server.send(200, "text/html", html);
}

void handleData() {
  // Create JSON response with latest sensor data
  String json = "{";
  json += "\"visible_ir\":" + String(latestData.visible_ir) + ",";
  json += "\"ir\":" + String(latestData.ir) + ",";
  json += "\"lux\":" + String(latestData.lux, 2) + ",";
  json += "\"timestamp\":" + String(latestData.timestamp);
  json += "}";

  server.send(200, "application/json", json);
}

void connectToNYUWiFi() {
  Serial.println("📡 [WIFI] Connecting to NYU WPA2 Enterprise network...");
  Serial.print("Network: ");
  Serial.println(ssid);
  Serial.print("Identity: ");
  Serial.println(EAP_IDENTITY);

  WiFi.disconnect(true);
  delay(1000);
  WiFi.mode(WIFI_STA);

  // Configure WPA2 Enterprise settings
  esp_eap_client_set_identity((uint8_t *)EAP_IDENTITY, strlen(EAP_IDENTITY));
  esp_eap_client_set_username((uint8_t *)EAP_USERNAME, strlen(EAP_USERNAME));
  esp_eap_client_set_password((uint8_t *)EAP_PASSWORD, strlen(EAP_PASSWORD));
  
  // PEAP Phase 1 and Phase 2 authentication (MSCHAPv2)
  esp_wifi_sta_enterprise_enable();
  
  WiFi.begin(ssid);

  int attempts = 0;
  Serial.print("🔄 [WIFI] Connecting");
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(1000);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ [WIFI] Connected successfully to NYU network!");
  } else {
    Serial.println("\n❌ [WIFI] Failed to connect. Check credentials and network availability.");
  }
}

void monitorWiFiConnection() {
  if (WiFi.status() != WL_CONNECTED) {
    if (wifiConnected) {
      Serial.println("⚠️  [WIFI] Connection lost! Attempting to reconnect...");
      wifiConnected = false;
      wifiReconnectAttempts++;
    }
    connectToNYUWiFi();

    // Restart server if reconnected
    if (WiFi.status() == WL_CONNECTED && !wifiConnected) {
      wifiConnected = true;
      server.begin();
      Serial.println("✅ [SERVER] HTTP server restarted!");
    }
  } else {
    if (!wifiConnected) {
      wifiConnected = true;
      Serial.println("✅ [WIFI] Connection restored!");
    }
    Serial.print("📶 [WIFI] Signal: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
  }
}

void logDetailedWiFiStatus() {
  Serial.println("\n📊 [WIFI LOG] Detailed Status Report");
  Serial.println("=====================================");
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("Status: ✅ Connected | IP: ");
    Serial.print(WiFi.localIP());
    Serial.print(" | RSSI: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
    Serial.print("Gateway: ");
    Serial.print(WiFi.gatewayIP());
    Serial.print(" | DNS: ");
    Serial.println(WiFi.dnsIP());
    Serial.print("Server: http://");
    Serial.print(WiFi.localIP());
    Serial.println(" (ACTIVE)");
  } else {
    Serial.println("Status: ❌ Disconnected");
  }
  Serial.println("=====================================\n");
}

void printConnectionDetails() {
  Serial.println("\n📶 [WIFI] === Connection Details ===");
  Serial.print("Network: ");
  Serial.println(WiFi.SSID());
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
  Serial.print("Gateway: ");
  Serial.println(WiFi.gatewayIP());
  Serial.print("DNS: ");
  Serial.println(WiFi.dnsIP());
  Serial.print("MAC: ");
  Serial.println(WiFi.macAddress());
  Serial.print("Signal: ");
  Serial.print(WiFi.RSSI());
  Serial.println(" dBm");
  Serial.println("=====================================\n");
}

void testInternetConnection() {
  Serial.println("🌐 [WIFI] Testing internet connectivity...");
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin("http://httpbin.org/ip");
    http.setTimeout(10000);
    int code = http.GET();

    if (code == 200) {
      Serial.println("✅ [WIFI] Internet connection OK");
      Serial.println(http.getString());
    } else {
      Serial.print("⚠️ [WIFI] HTTP test failed, code: ");
      Serial.println(code);
    }
    http.end();
  } else {
    Serial.println("❌ [WIFI] Not connected");
  }
  Serial.println("=====================================\n");
}
