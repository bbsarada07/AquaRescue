#ifndef ARDUINO_H
#define ARDUINO_H

#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <string>
#include <sstream>

#define WIFI_STA 1
#define WL_CONNECTED 3
#define HEX 16

class SerialMock {
public:
  void begin(unsigned long baud) {}
  void print(const char *s) {}
  void print(int val) {}
  void print(double val) {}
  void print(const std::string &s) {}
  void println(const char *s = "") {}
  void println(int val) {}
  void println(double val) {}
  void println(const std::string &s) {}
};

static SerialMock Serial;

inline void delay(unsigned long ms) {}
inline long random(long max) { return rand() % max; }
inline long random(long min, long max) { return min + (rand() % (max - min)); }

class String : public std::string {
public:
    String() : std::string() {}
    String(const char* s) : std::string(s ? s : "") {}
    String(const std::string& s) : std::string(s) {}
    String(unsigned long val, int base = 10) {
        if (base == HEX) {
            std::stringstream ss;
            ss << std::hex << val;
            *this = ss.str();
        } else {
            *this = std::to_string(val);
        }
    }
    String(long val, int base = 10) : String((unsigned long)val, base) {}
    String(int val, int base = 10) : String((unsigned long)val, base) {}
};

#endif // ARDUINO_H
