const assert = require("assert");
const { parseVoiceCommand } = require("./command-parser.js");
const cases = [
  ["左邊開燈", "L"], ["左边开灯。", "L"], ["blue on", "L"],
  ["turn on the left light", "L"], ["turn on the blue light", "L"],
  ["turn the left light on", "L"], ["left light", "L"], ["blue light", "L"],
  ["右邊開燈", "R"], ["green on", "R"], ["turn on the right light", "R"],
  ["turn on the green light", "R"], ["right light", "R"], ["green light", "R"], ["全部關燈", "O"],
  ["turn the right light on", "R"],
  ["左邊關燈", "X"], ["blue light off", "X"], ["turn off the left light", "X"],
  ["右邊關燈", "Y"], ["green light off", "Y"], ["turn off the right light", "Y"],
  ["turn off the lights", "O"], ["lights off", "O"], ["閃爍三次", "B"], ["blink 3 times", "B"], ["blink the lights three times", "B"],
  ["今天天氣很好", null], ["開燈", null], ["", null]
];
for (const [input, expected] of cases) assert.strictEqual(parseVoiceCommand(input)?.code ?? null, expected, input);
console.log(`PASS: ${cases.length} command parser cases`);
