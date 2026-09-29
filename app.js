(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const controls = [...document.querySelectorAll("[data-command]")];
  const ui = {
    connect: $("connect"), disconnect: $("disconnect"), connection: $("connection"),
    listen: $("listen"), stop: $("stop"), speakBack: $("speakBack"),
    language: $("language"), commandHint: $("commandHint"),
    transcript: $("transcript"), status: $("status"), errorBanner: $("errorBanner"), log: $("log"),
    clearLog: $("clearLog"), exportCsv: $("exportCsv"),
    blue: $("blueDot"), green: $("greenDot")
  };
  let port = null, reader = null, keepReading = false, receiveBuffer = "", responseTimer = null;
  let closingPort = false;
  let logEntries = [];
  const encoder = new TextEncoder(), decoder = new TextDecoder();

  function log(message) {
    const now = new Date();
    const time = now.toLocaleTimeString("zh-TW", { hour12:false });
    logEntries.push({ time: now.toLocaleString("zh-TW", { hour12:false }), message });
    if (ui.log.textContent === "等待操作…") ui.log.textContent = "";
    ui.log.textContent += `[${time}] ${message}\n`;
    ui.log.scrollTop = ui.log.scrollHeight;
  }
  function clearLog() {
    logEntries = [];
    ui.log.textContent = "等待操作…";
    ui.status.textContent = "系統紀錄已重置。";
  }
  function clearError() {
    ui.errorBanner.hidden = true;
    ui.errorBanner.textContent = "";
  }
  function showCommunicationError(message) {
    ui.errorBanner.textContent = `⚠ ${message}`;
    ui.errorBanner.hidden = false;
    ui.status.textContent = message;
  }
  function csvCell(value) {
    return `"${String(value).replace(/"/g, '""')}"`;
  }
  function exportLogCsv() {
    if (logEntries.length === 0) {
      ui.status.textContent = "目前沒有可輸出的系統紀錄。";
      return;
    }
    const rows = [["時間", "事件"], ...logEntries.map((entry) => [entry.time, entry.message])];
    const csv = "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob([csv], { type:"text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    link.href = url;
    link.download = `AMB82-MINI_系統紀錄_${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    ui.status.textContent = `CSV 已輸出，共 ${logEntries.length} 筆紀錄。`;
  }
  function setConnected(connected) {
    ui.connect.disabled = connected;
    ui.disconnect.disabled = !connected;
    controls.forEach((button) => { button.disabled = !connected; });
    ui.listen.disabled = !connected || !recognition;
    ui.connection.textContent = connected ? "已連線" : "未連線";
    ui.connection.style.background = connected ? "#ddf6e7" : "#edf1f5";
  }
  function showState(state) {
    ui.blue.classList.toggle("on", state === "BLUE" || state === "BOTH" || state === "BLINKING");
    ui.green.classList.toggle("on", state === "GREEN" || state === "BOTH" || state === "BLINKING");
  }
  function speak(message) {
    if (!ui.speakBack.checked || !("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = "zh-TW";
    speechSynthesis.speak(utterance);
  }
  function handleBoardLine(line) {
    line = line.trim();
    if (!line) return;
    log(`板端 → ${line}`);
    const stateMatch = line.match(/STATE:(BLUE|GREEN|BOTH|OFF|BLINKING)/);
    if (stateMatch) showState(stateMatch[1]);
    if (line.startsWith("ACK:")) {
      clearTimeout(responseTimer);
      const state = stateMatch ? stateMatch[1] : "UNKNOWN";
      const labels = { BLUE:"目前只有藍燈亮", GREEN:"目前只有綠燈亮", BOTH:"藍燈與綠燈皆亮", OFF:"兩燈皆已關閉", BLINKING:"開始閃爍三次" };
      ui.status.textContent = `執行成功：${labels[state] || line}`;
      speak(labels[state] || "指令已執行");
    } else if (line.startsWith("DONE:B")) {
      ui.status.textContent = "閃爍三次完成，LED 已關閉。";
    } else if (line.startsWith("ERR:")) {
      clearTimeout(responseTimer);
      ui.status.textContent = `開發板拒絕指令：${line}`;
    }
  }
  async function readLoop() {
    keepReading = true;
    while (port && port.readable && keepReading) {
      reader = port.readable.getReader();
      try {
        while (keepReading) {
          const { value, done } = await reader.read();
          if (done) {
            if (keepReading) log("序列埠讀取已結束");
            break;
          }
          receiveBuffer += decoder.decode(value, { stream:true });
          const lines = receiveBuffer.split(/\r?\n/);
          receiveBuffer = lines.pop();
          lines.forEach(handleBoardLine);
        }
      } catch (error) {
        log(`讀取失敗：${error.message}`);
        showCommunicationError("通訊中斷：無法讀取開發板，請重新連線。 ");
      } finally {
        reader.releaseLock(); reader = null;
      }
    }
    if (port) await closePort(false);
  }
  async function connect() {
    if (!("serial" in navigator)) {
      ui.status.textContent = "此瀏覽器不支援 Web Serial，請改用桌面版 Chrome 或 Edge。"; return;
    }
    try {
      port = await navigator.serial.requestPort();
      await port.open({ baudRate:115200 });
      port.addEventListener?.("disconnect", handleUnexpectedDisconnect, { once:true });
      setConnected(true);
      clearError();
      ui.status.textContent = "已連線，等待語音或按鈕指令。";
      log("USB 序列埠已連線（115200 baud）");
      readLoop();
    } catch (error) {
      port = null;
      ui.status.textContent = `連線失敗：${error.message}`;
      log(`連線失敗：${error.message}`);
    }
  }
  async function closePort(userInitiated = true) {
    if (closingPort) return;
    closingPort = true;
    keepReading = false; clearTimeout(responseTimer);
    try { if (reader) await reader.cancel(); } catch (_) {}
    try { if (port) await port.close(); } catch (_) {}
    port = null; setConnected(false); showState("OFF");
    if (userInitiated) {
      clearError();
      ui.status.textContent = "已中斷連線。";
    } else {
      showCommunicationError("通訊中斷：偵測不到 AMB82-MINI，請檢查 USB 後重新連線。 ");
    }
    log(userInitiated ? "已中斷連線" : "偵測到通訊中斷");
    closingPort = false;
  }
  function handleUnexpectedDisconnect() {
    if (!port || closingPort) return;
    showCommunicationError("通訊中斷：USB 已拔除或開發板失去連線。 ");
    log("USB disconnect 事件：開發板失去連線");
    closePort(false);
  }
  async function sendCommand(code, source = "手動") {
    if (!port || !port.writable) {
      showCommunicationError("通訊失敗：開發板尚未連線。 ");
      log(`未送出 ${code}：沒有可用的序列埠`); return;
    }
    const writer = port.writable.getWriter();
    try {
      await writer.write(encoder.encode(`${code}\n`));
      clearError();
      ui.status.textContent = "指令已送出，等待開發板確認…";
      log(`${source} → 送出 ${code}`);
      clearTimeout(responseTimer);
      responseTimer = setTimeout(() => {
        showCommunicationError("通訊逾時：開發板未在 2 秒內回覆，LED 狀態不更新。 ");
        log("等待 ACK 逾時");
      }, 2000);
    } catch (error) {
      showCommunicationError(`通訊失敗：${error.message}`);
      log(`寫入失敗：${error.message}`);
    } finally { writer.releaseLock(); }
  }

  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  if (Recognition) {
    recognition = new Recognition();
    recognition.lang = ui.language.value;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;
    recognition.onstart = () => {
      ui.listen.disabled = true; ui.stop.disabled = false; ui.language.disabled = true;
      ui.status.textContent = ui.language.value === "en-US" ? "Listening…" : "正在聆聽…";
    };
    recognition.onresult = (event) => {
      const alternatives = [...event.results[0]].map((item) => item.transcript);
      ui.transcript.textContent = alternatives.join(" / ");
      const matched = alternatives.map(CommandParser.parseVoiceCommand).find(Boolean);
      if (!matched) {
        ui.status.textContent = ui.language.value === "en-US"
          ? "Recognized speech, but no valid command was found. Try: right light."
          : "未找到控制指令，LED 狀態保持不變。";
        log(`忽略非控制語句：${alternatives.join(" | ")}`);
        speak("沒有找到控制指令"); return;
      }
      sendCommand(matched.code, `語音「${matched.label}」`);
    };
    recognition.onerror = (event) => {
      const messages = { "no-speech":"沒有偵測到語音，LED 狀態不變。", "not-allowed":"麥克風權限被拒絕。", network:"語音辨識服務無法連線。" };
      ui.status.textContent = messages[event.error] || `語音辨識失敗：${event.error}`;
      log(`語音辨識錯誤：${event.error}`);
    };
    recognition.onend = () => { ui.listen.disabled = !port; ui.stop.disabled = true; ui.language.disabled = false; };
  } else {
    ui.listen.disabled = true;
    ui.status.textContent = "此瀏覽器不支援 Web Speech API；仍可使用手動測試按鈕。";
  }
  ui.connect.addEventListener("click", connect);
  ui.disconnect.addEventListener("click", () => closePort(true));
  ui.clearLog.addEventListener("click", clearLog);
  ui.exportCsv.addEventListener("click", exportLogCsv);
  ui.language.addEventListener("change", () => {
    const english = ui.language.value === "en-US";
    ui.commandHint.textContent = english
      ? "English: left/right light on, left/right light off, lights off, blink three times."
      : "中文指令：左邊開燈／關燈、右邊開燈／關燈、全部關燈、閃爍三次。";
    ui.status.textContent = english ? "English recognition selected." : "已選擇中文辨識。";
  });
  ui.listen.addEventListener("click", () => {
    if (!recognition) return;
    recognition.lang = ui.language.value;
    recognition.start();
  });
  ui.stop.addEventListener("click", () => recognition && recognition.stop());
  controls.forEach((button) => button.addEventListener("click", () => sendCommand(button.dataset.command)));
  navigator.serial?.addEventListener("disconnect", handleUnexpectedDisconnect);
  setConnected(false);
})();
