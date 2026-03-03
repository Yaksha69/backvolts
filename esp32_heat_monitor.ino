#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>

// ================= WIFI SETTINGS =================
const char* ssid = "heat";
const char* password = "12345678";

// ================= BACKEND API SETTINGS =================
String backendUrl = "https://backvolts.onrender.com"; // 🔥 Your backend URL
String apiEndpoint = "/api/v1/data/new";

// ================= SENSOR PINS =================
#define DHTPIN 4
#define DHTTYPE DHT22
#define LIGHT_PIN 34

// ================= IPROG SMS SETTINGS =================
String apiToken = "e39123ece8c53ca98560c11a254daf5ef8eae0f0"; // 🔥 Replace with your real token
String phoneNumbers = "639761700936, 639275778126";             // Single string, comma-separated

// ================= OBJECTS =================
DHT dht(DHTPIN, DHTTYPE);
LiquidCrystal_I2C lcd(0x27, 16, 2);

// ================= TIMERS =================
unsigned long lastUploadTime = 0;
const long uploadInterval = 120000;  // 2 minutes

unsigned long lastSensorReadTime = 0;
const long sensorInterval = 2000;

// ================= SENSOR DATA =================
float curH, curT, curHI;
int curLP;
String curSun;
int scrollIndex = 0;

// ================= ALERT LEVELS =================
enum HeatLevel { NONE, CAUTION, EXTREME_CAUTION, DANGER, EXTREME_DANGER };
HeatLevel currentAlert = NONE;

// =====================================================
// ===================== SETUP =========================
// =====================================================
void setup() {
  Serial.begin(115200);

  Wire.begin(21, 22);
  lcd.init();
  lcd.backlight();
  dht.begin();

  lcd.print("SYSTEM STARTING");
  connectWiFi();

  readSensors();
  delay(2000);
  readSensors();

  lcd.clear();
  lcd.print("System Ready");
}

// =====================================================
// ====================== LOOP =========================
// =====================================================
void loop() {

  if (millis() - lastSensorReadTime > sensorInterval) {
    lastSensorReadTime = millis();
    readSensors();
  }

  if (millis() - lastUploadTime > uploadInterval) {
    if (!isnan(curH) && !isnan(curT)) {
      sendToBackend();
      lastUploadTime = millis();
    }
  }

  checkHeatAlerts();

  static unsigned long lastScrl = 0;
  if (millis() - lastScrl > 400) {
    lastScrl = millis();
    updateLCD();
  }
}

// =====================================================
// ================= READ SENSORS ======================
// =====================================================
void readSensors() {
  curH = dht.readHumidity();
  curT = dht.readTemperature();
  curHI = dht.computeHeatIndex(curT, curH, false);

  int rawLight = analogRead(LIGHT_PIN);
  curLP = map(rawLight, 0, 4095, 0, 100);

  if (curLP > 75) curSun = "SUNNY";
  else if (curLP > 30) curSun = "CLOUDY";
  else curSun = "DARK";
}

// =====================================================
// ====================== LCD ==========================
// =====================================================
void updateLCD() {
  String topText = "T:" + String(curT,1) + "C H:" + String(curH,0) + "%     ";
  String botText = "HI:" + String(curHI,1) + "C " + curSun + "     ";

  lcd.setCursor(0,0);
  lcd.print(topText.substring(scrollIndex, scrollIndex+16));
  lcd.setCursor(0,1);
  lcd.print(botText.substring(scrollIndex, scrollIndex+16));

  scrollIndex++;
  if (scrollIndex > 4) scrollIndex = 0;
}

// =====================================================
// ===================== WIFI ==========================
// =====================================================
void connectWiFi() {
  lcd.clear();
  lcd.print("Connecting WiFi");
  WiFi.begin(ssid, password);

  int timeout = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    timeout++;
    if (timeout > 40) {
      lcd.clear();
      lcd.print("WiFi Failed!");
      return;
    }
  }

  lcd.clear();
  lcd.print("WiFi Connected!");
  delay(2000);
  lcd.clear();
}

// =====================================================
// ================= BACKEND API ========================
// =====================================================
void sendToBackend() {

  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    return;
  }

  HTTPClient http;
  String url = backendUrl + apiEndpoint;
  
  // Create JSON document
  DynamicJsonDocument doc(256);
  doc["temperature"] = curT;
  doc["humidity"] = curH;
  doc["heatIndex"] = curHI;
  doc["light"] = curLP;
  
  String jsonString;
  serializeJson(doc, jsonString);

  lcd.clear();
  lcd.print("Uploading...");
  Serial.println("Sending to backend:");
  Serial.println(jsonString);
  
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  
  int httpResponseCode = http.POST(jsonString);
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.println("HTTP Response code: " + String(httpResponseCode));
    Serial.println("Response: " + response);
    
    lcd.clear();
    lcd.print("Upload Success!");
  } else {
    Serial.println("Error on sending POST: " + String(httpResponseCode));
    lcd.clear();
    lcd.print("Upload Failed!");
  }
  
  http.end();
  delay(2000);
  lcd.clear();
}

// =====================================================
// ================= HEAT ALERT LOGIC ==================
// =====================================================
void checkHeatAlerts() {

  HeatLevel newLevel = NONE;

  if (curHI >= 42.0) newLevel = EXTREME_DANGER;
  else if (curHI >= 40.0) newLevel = DANGER;
  else if (curHI >= 35.0) newLevel = EXTREME_CAUTION;
  else if (curHI >= 27.0) newLevel = CAUTION;

  if (newLevel != currentAlert && newLevel != NONE) {
    sendSMS(newLevel);
    currentAlert = newLevel;
  }

  if (curHI < 27.0) {
    currentAlert = NONE;
  }
}

// =====================================================
// ================= SEND SMS (POST JSON) ==============
// =====================================================
void sendSMS(HeatLevel level) {

  if (WiFi.status() != WL_CONNECTED) connectWiFi();

  String message;

  switch(level) {
    case CAUTION:
      message = "[ALERT] HI:" + String(curHI,1) +
                "C Temp:" + String(curT,1) +
                "C Hum:" + String(curH,0) +
                "% Light:" + String(curLP) +
                ". Stay hydrated.";
      break;

    case EXTREME_CAUTION:
      message = "[ALERT] HI:" + String(curHI,1) +
                "C High heat. Drink water.";
      break;

    case DANGER:
      message = "[EMERGENCY] HI:" + String(curHI,1) +
                "C Severe heat. Stay indoors.";
      break;

    case EXTREME_DANGER:
      message = "[EMERGENCY] HI:" + String(curHI,1) +
                "C Extreme heat! Act now!";
      break;

    default:
      return;
  }

  WiFiClientSecure client;
  client.setInsecure();   // Allow HTTPS without certificate check

  HTTPClient https;
  https.begin(client, "https://www.iprogsms.com/api/v1/sms_messages/send_bulk");
  https.addHeader("Content-Type", "application/json");

  // Correct JSON payload
  String jsonPayload = "{";
  jsonPayload += "\"api_token\":\"" + apiToken + "\",";
  jsonPayload += "\"phone_number\":\"" + phoneNumbers + "\",";
  jsonPayload += "\"message\":\"" + message + "\"";
  jsonPayload += "}";

  lcd.clear();
  lcd.print("Sending SMS...");
  Serial.println("Sending JSON:");
  Serial.println(jsonPayload);

  int httpCode = https.POST(jsonPayload);

  Serial.print("HTTP Code: ");
  Serial.println(httpCode);

  if (httpCode > 0) {
    String response = https.getString();
    Serial.println("Response:");
    Serial.println(response);
  } else {
    Serial.println("SMS Failed");
  }

  https.end();

  lcd.clear();
  lcd.print("SMS Sent!");
  delay(2000);
  lcd.clear();
}
