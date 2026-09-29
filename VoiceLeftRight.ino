// AMB82-MINI (RTL8735B) voice-controlled LEDs over USB serial.
// Commands: L/R = blue/green on, X/Y = blue/green off,
// O = both off, B = blink both LEDs 3 times.
// Replies are acknowledgements used by the browser as the actual board state.

const int BLUE_LED = LED_B;   // PF9, Arduino pin 23
const int GREEN_LED = LED_G;  // PE6, Arduino pin 24

const unsigned long BLINK_INTERVAL_MS = 250;
bool blinking = false;
bool blinkOn = false;
byte blinkTransitionsRemaining = 0;
unsigned long lastBlinkAt = 0;
bool blueOn = false;
bool greenOn = false;

void setLeds(bool blue, bool green) {
  blueOn = blue;
  greenOn = green;
  digitalWrite(BLUE_LED, blue ? HIGH : LOW);
  digitalWrite(GREEN_LED, green ? HIGH : LOW);
}

const char *currentState() {
  if (blueOn && greenOn) return "BOTH";
  if (blueOn) return "BLUE";
  if (greenOn) return "GREEN";
  return "OFF";
}

void acknowledge(char command, const char *state) {
  Serial.print("ACK:");
  Serial.print(command);
  Serial.print(" STATE:");
  Serial.println(state);
}

void executeCommand(char command) {
  blinking = false;
  switch (command) {
    case 'L': setLeds(true, greenOn); acknowledge('L', currentState()); break;
    case 'R': setLeds(blueOn, true); acknowledge('R', currentState()); break;
    case 'X': setLeds(false, greenOn); acknowledge('X', currentState()); break;
    case 'Y': setLeds(blueOn, false); acknowledge('Y', currentState()); break;
    case 'O': setLeds(false, false); acknowledge('O', "OFF"); break;
    case 'B':
      setLeds(false, false);
      blinking = true;
      blinkOn = false;
      blinkTransitionsRemaining = 6;
      lastBlinkAt = millis();
      acknowledge('B', "BLINKING");
      break;
    default:
      Serial.print("ERR:UNKNOWN_COMMAND:");
      Serial.println(command);
  }
}

void updateBlink() {
  if (!blinking || millis() - lastBlinkAt < BLINK_INTERVAL_MS) return;
  lastBlinkAt = millis();
  blinkOn = !blinkOn;
  setLeds(blinkOn, blinkOn);
  blinkTransitionsRemaining--;
  if (blinkTransitionsRemaining == 0) {
    blinking = false;
    setLeds(false, false);
    Serial.println("DONE:B STATE:OFF");
  }
}

void setup() {
  pinMode(BLUE_LED, OUTPUT);
  pinMode(GREEN_LED, OUTPUT);
  setLeds(false, false);
  Serial.begin(115200);
  delay(300);
  Serial.println("READY:AMB82-MINI STATE:OFF");
}

void loop() {
  while (Serial.available() > 0) {
    char command = static_cast<char>(Serial.read());
    if (command >= 'a' && command <= 'z') command -= ('a' - 'A');
    if (command == '\r' || command == '\n' || command == ' ') continue;
    executeCommand(command);
  }
  updateBlink();
}
