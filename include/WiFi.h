#ifndef WIFI_H
#define WIFI_H

#include <string>
#include "Arduino.h"

class WiFiClient {
public:
    WiFiClient() {}
};

class WiFiClass {
public:
    void mode(int m) {}
    void begin(const char* ssid, const char* passphrase = nullptr) {}
    int status() { return WL_CONNECTED; }
    String localIP() { return "192.168.1.100"; }
};

static WiFiClass WiFi;

#endif // WIFI_H
