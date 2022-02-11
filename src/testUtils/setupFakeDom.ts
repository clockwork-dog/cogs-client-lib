import WS from 'ws';
import { JSDOM } from 'jsdom';

const dom = new JSDOM();
global.document = dom.window.document;
global.window = dom.window as any;
global.EventTarget = dom.window.EventTarget;
global.CustomEvent = dom.window.CustomEvent;

dom.window.WebSocket = WS as any;
global.WebSocket = dom.window.WebSocket;

jest.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(async function (this: HTMLMediaElement) {
  this.dispatchEvent(new dom.window.Event('playing', { bubbles: true }));

  let paused = false;
  Object.defineProperty(this, 'paused', {
    get: () => paused,
    set: (value) => (paused = value),
  });

  jest.spyOn(this, 'pause').mockImplementation(() => {
    paused = true;
    this.dispatchEvent(new dom.window.Event('paused', { bubbles: true }));
  });
});
