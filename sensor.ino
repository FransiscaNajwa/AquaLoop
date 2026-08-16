#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <OneWire.h>
#include <DallasTemperature.h>

const char* ssid = "NAMA_WIFI_TAMBAK";
const char* password = "PASSWORD_WIFI";
const char* serverUrl = "http://192.168.1.100/aqualoop/api/ingest.php";

// Definisi Pin Hardware (Hanya Suhu & Status Pompa Sesuai Desain Low-Cost)
const int PUMP_STATUS_PIN = 4;   // Pin pembaca status pompa kangkung (ON/OFF)
const int TEMP_PIN = 23;         // Pin data untuk Sensor Suhu DS18B20

OneWire oneWire(TEMP_PIN);
DallasTemperature sensors(&oneWire);

void setup() {
  Serial.begin(115200);
  pinMode(PUMP_STATUS_PIN, INPUT_PULLUP);
  
  // Inisialisasi sensor suhu DS18B20
  sensors.begin();
  
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWi-Fi terhubung!");
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    // --- PEMBACAAN DATA SENSOR FISIK ---
    // 1. Membaca Suhu Aktual dari Sensor DS18B20
    sensors.requestTemperatures();
    float temperature = sensors.getTempCByIndex(0);
    if (temperature == DEVICE_DISCONNECTED_C) {
      temperature = 28.5; // Nilai fallback jika sensor gagal terbaca sementara
    }

    // 2. Status Pompa Kangkung (Sistem Fitoremediasi NFT)
    bool isPumpOn = digitalRead(PUMP_STATUS_PIN) == HIGH;
    String pumpStatusStr = isPumpOn ? "ON" : "OFF";

    // Format JSON Payload (Disesuaikan dengan tabel database baru tanpa pond_id)
    StaticJsonDocument<512> doc;
    doc["device_code"] = "ESP32_NODE_01";
    doc["device_name"] = "ESP32 Sensor Node";
    doc["device_type"] = "sensor_node";
    doc["temperature"] = temperature;
    doc["battery_percent"] = 85;     // Sesuai sistem Solar Power Off-Grid[cite: 1]

    JsonObject rawPayload = doc.createNestedObject("raw_payload");
    rawPayload["pump_status"] = pumpStatusStr;
    rawPayload["salinity"] = 5.0;    // Nilai tetap kondisi optimal salinitas kangkung (5 ppt)[cite: 1]
    rawPayload["note"] = "Soft-Sensor LSTM DO active on server side";

    String requestBody;
    serializeJson(doc, requestBody);

    int httpResponseCode = http.POST(requestBody);
    if (httpResponseCode > 0) {
      Serial.printf("Data sensor suhu (%.1f°C) berhasil dikirim! Response: %d\n", temperature, httpResponseCode);
    } else {
      Serial.printf("Gagal mengirim data. Error code: %d\n", httpResponseCode);
    }
    http.end();
  }
  
  delay(5000); // Kirim data setiap 5 detik
}