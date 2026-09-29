(function (root) {
  function normalize(text) {
    return String(text || "").toLowerCase().replace(/[\s，。！？、,.!?]/g, "")
      .replace(/左邊/g, "左边").replace(/右邊/g, "右边").replace(/開/g, "开")
      .replace(/關/g, "关").replace(/燈/g, "灯").replace(/藍/g, "蓝").replace(/綠/g, "绿")
      .replace(/閃爍/g, "闪烁");
  }
  function parseVoiceCommand(text) {
    const value = normalize(text);
    if (/^(左边开灯|开左灯|蓝灯|leftlight|bluelight|lefton|leftlighton|turnontheleft|turnontheleftlight|turntheleftlighton|turnonthebluelight|turnthebluelighton|blueon|bluelighton)$/.test(value)) return { code:"L", label:"藍燈" };
    if (/^(右边开灯|开右灯|绿灯|rightlight|greenlight|righton|rightlighton|turnontheright|turnontherightlight|turntherightlighton|turnonthegreenlight|turnthegreenlighton|greenon|greenlighton)$/.test(value)) return { code:"R", label:"綠燈" };
    if (/^(左边关灯|关左灯|蓝灯关掉|leftoff|leftlightoff|bluelightoff|turnofftheleftlight|turntheleftlightoff|turnoffthebluelight|turnthebluelightoff)$/.test(value)) return { code:"X", label:"關閉藍燈" };
    if (/^(右边关灯|关右灯|绿灯关掉|rightoff|rightlightoff|greenlightoff|turnofftherightlight|turntherightlightoff|turnoffthegreenlight|turnthegreenlightoff)$/.test(value)) return { code:"Y", label:"關閉綠燈" };
    if (/^(全部关灯|关灯|灯关掉|off|alloff|lightsoff|turnoffthelights?)$/.test(value)) return { code:"O", label:"全部關燈" };
    if (/^(闪烁三次|閃爍三次|闪三次|blinkthreetimes|blink3times|blinkthelightsthreetimes)$/.test(value)) return { code:"B", label:"閃爍三次" };
    return null;
  }
  const api = { normalize, parseVoiceCommand };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.CommandParser = api;
})(typeof window !== "undefined" ? window : globalThis);
