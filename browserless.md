1. Realbrowser code
```
// In this example, we'll scrape links on HN
export default async ({ page }: { page: Page }) => {
  await page.goto('https://news.ycombinator.com');

  // Here, we inject some JavaScript into the page to build a list of results
  const items = await page.evaluate(() => {
    const elements = [...document.querySelectorAll('.athing a')];
    const results = elements.map((el: HTMLAnchorElement) => ({
      title: el.textContent,
      href: el.href,
    }));
    return JSON.stringify(results);
  });

  // Finally, we return an object, which triggers a JSON file download
  return JSON.parse(items);
};
```

2. Realbrowser Websocket Header
```
요청 URL
ws://192.168.0.15:3002/
요청 메서드
GET
상태 코드
101 Switching Protocols
connection
Upgrade
sec-websocket-accept
ZwEIpgFjxlT7ZW7ZSwqgQMQWpKA=
sec-websocket-extensions
permessage-deflate; client_max_window_bits=15
upgrade
WebSocket
accept-encoding
gzip, deflate
accept-language
ko,en-US;q=0.9,en;q=0.8,ko-KR;q=0.7,ja;q=0.6,zh-CN;q=0.5,zh-TW;q=0.4,zh;q=0.3
cache-control
no-cache
connection
Upgrade
cookie
drss-theme=%7B%22mode%22%3A%22dark%22%2C%22colors%22%3A%7B%22primary%22%3A%22%236366f1%22%2C%22secondary%22%3A%22%238b5cf6%22%7D%7D; token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJleHAiOjE3OTc3NzIwOTAsImlhdCI6MTc2NjIzNjA5MH0.FpzSn3laV9DO6uvg2g1fuqGT_N0a6x3vFAvhPolzxf0; __next_hmr_refresh_hash__=1181
host
192.168.0.15:3002
origin
http://192.168.0.15:3002
pragma
no-cache
sec-websocket-extensions
permessage-deflate; client_max_window_bits
sec-websocket-key
hh7m3G5/TOh4jVZNgjUR5Q==
sec-websocket-version
13
upgrade
websocket
user-agent
Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36
```

3. Realbrowser Websocket Message
```
{
  "id": 140,
  "result": {},
  "sessionId": "7C31FED9D900470741F365E93A8C7C64"
}	69
04: 43: 23.915
{
  "sessionId": "7C31FED9D900470741F365E93A8C7C64",
  "method": "Input.emulateTouchFromMouseEvent",
  "params": {
    "type": "mouseMoved",
    "x": 602,
    "y": 271,
    "modifiers": 0,
    "button": "none",
    "clickCount": 1
  },
  "id": 141
}	193
04: 43: 24.483
{
  "sessionId": "7C31FED9D900470741F365E93A8C7C64",
  "method": "Input.emulateTouchFromMouseEvent",
  "params": {
    "type": "mouseMoved",
    "x": 601,
    "y": 271,
    "modifiers": 0,
    "button": "none",
    "clickCount": 1
  },
  "id": 142
}	193
04: 43: 24.487
{
  "sessionId": "7C31FED9D900470741F365E93A8C7C64",
  "method": "Input.emulateTouchFromMouseEvent",
  "params": {
    "type": "mouseMoved",
    "x": 600,
    "y": 271,
    "modifiers": 0,
    "button": "none",
    "clickCount": 1
  },
  "id": 143
}	193
04: 43: 24.491
{
  "id": 141,
  "result": {},
  "sessionId": "7C31FED9D900470741F365E93A8C7C64"
}	69
04: 43: 24.574
{
  "id": 142,
  "result": {},
  "sessionId": "7C31FED9D900470741F365E93A8C7C64"
}	69
04: 43: 24.574
{
  "id": 143,
  "result": {},
  "sessionId": "7C31FED9D900470741F365E93A8C7C64"
}	69
04: 43: 24.575
{
  "sessionId": "7C31FED9D900470741F365E93A8C7C64",
  "method": "Input.emulateTouchFromMouseEvent",
  "params": {
    "type": "mouseMoved",
    "x": 600,
    "y": 270,
    "modifiers": 0,
    "button": "none",
    "clickCount": 1
  },
  "id": 144
}	193
04: 43: 24.604
{
  "id": 144,
  "result": {},
  "sessionId": "7C31FED9D900470741F365E93A8C7C64"
}	69
04: 43: 24.609
{
  "sessionId": "7C31FED9D900470741F365E93A8C7C64",
  "method": "Input.emulateTouchFromMouseEvent",
  "params": {
    "type": "mouseMoved",
    "x": 600,
    "y": 269,
    "modifiers": 0,
    "button": "none",
    "clickCount": 1
  },
  "id": 145
}	193
04: 43: 24.704
{
  "sessionId": "7C31FED9D900470741F365E93A8C7C64",
  "method": "Input.emulateTouchFromMouseEvent",
  "params": {
    "type": "mouseMoved",
    "x": 601,
    "y": 269,
    "modifiers": 0,
    "button": "none",
    "clickCount": 1
  },
  "id": 146
}	193
04: 43: 24.708
{
  "id": 145,
  "result": {},
  "sessionId": "7C31FED9D900470741F365E93A8C7C64"
}	69
04: 43: 24.710
{
  "id": 146,
  "result": {},
  "sessionId": "7C31FED9D900470741F365E93A8C7C64"
}	69
04: 43: 24.712
{
  "sessionId": "7C31FED9D900470741F365E93A8C7C64",
  "method": "Emulation.setDeviceMetricsOverride",
  "params": {
    "mobile": false,
    "width": 603,
    "height": 420,
    "deviceScaleFactor": 1,
    "screenOrientation": {
      "angle": 0,
      "type": "portraitPrimary"
    }
  },
  "id": 147
}	233
04: 43: 26.134
{
  "sessionId": "7C31FED9D900470741F365E93A8C7C64",
  "method": "Emulation.setTouchEmulationEnabled",
  "params": {
    "enabled": false
  },
  "id": 148
}	130
04: 43: 26.134
{
  "method": "Page.frameResized",
  "params": {},
  "sessionId": "7C31FED9D900470741F365E93A8C7C64"
}	89
04: 43: 26.217
{
  "id": 147,
  "result": {},
  "sessionId": "7C31FED9D900470741F365E93A8C7C64"
}	69
04: 43: 26.220
{
  "id": 148,
  "result": {},
  "sessionId": "7C31FED9D900470741F365E93A8C7C64"
}	69
04: 43: 26.220
{
  "method": "Page.screencastFrame",
  "params": {
    "data": "길어서 생략",
    "metadata": {
      "offsetTop": 0,
      "pageScaleFactor": 1,
      "deviceWidth": 603,
      "deviceHeight": 420,
      "scrollOffsetX": 0,
      "scrollOffsetY": 0,
      "timestamp": 1766259806.277407
    },
    "sessionId": 1
  },
  "sessionId": "7C31FED9D900470741F365E93A8C7C64"
}	173465
04: 43: 26.251
{
  "sessionId": "7C31FED9D900470741F365E93A8C7C64",
  "method": "Page.screencastFrameAck",
  "params": {
    "sessionId": 1
  },
  "id": 149
}	117
04: 43: 26.251
{
  "id": 149,
  "result": {},
  "sessionId": "7C31FED9D900470741F365E93A8C7C64"
}	69
04: 43: 26.256
{
  "method": "Page.screencastFrame",
  "params": {
    "data": "길어서 생략함",
    "metadata": {
      "offsetTop": 0,
      "pageScaleFactor": 1,
      "deviceWidth": 603,
      "deviceHeight": 420,
      "scrollOffsetX": 0,
      "scrollOffsetY": 0,
      "timestamp": 1766259807.283496
    },
    "sessionId": 1
  },
  "sessionId": "7C31FED9D900470741F365E93A8C7C64"
}	170017
04: 43: 27.264
{
  "sessionId": "7C31FED9D900470741F365E93A8C7C64",
  "method": "Page.screencastFrameAck",
  "params": {
    "sessionId": 1
  },
  "id": 150
}	117
04: 43: 27.265
{method: "Target.getBrowserContexts", id: 1
}

```
