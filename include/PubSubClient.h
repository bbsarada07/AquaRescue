#ifndef PUBSUBCLIENT_H
#define PUBSUBCLIENT_H

#include "Arduino.h"
#include "WiFi.h"

class PubSubClient {
public:
    PubSubClient() {}
    PubSubClient(WiFiClient& client) {}
    void setServer(const char* domain, uint16_t port) {}
    bool connected() { return true; }
    bool connect(const char* id) { return true; }
    int state() { return 0; }
    bool loop() { return true; }
    bool publish(const char* topic, const char* payload) { return true; }
};

#endif // PUBSUBCLIENT_H
