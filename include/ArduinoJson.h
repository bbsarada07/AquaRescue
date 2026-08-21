#ifndef ARDUINOJSON_H
#define ARDUINOJSON_H

#include "Arduino.h"

template<size_t N>
class StaticJsonDocument {
public:
    template<typename T>
    void operator[](const char* key) {}
    
    struct ElementProxy {
        template<typename T>
        ElementProxy& operator=(T val) { return *this; }
    };
    
    ElementProxy operator[](const char* key) {
        return ElementProxy();
    }
};

template<typename T>
inline size_t serializeJson(T& doc, char* output) {
    if (output) output[0] = '\0';
    return 0;
}

#endif // ARDUINOJSON_H
