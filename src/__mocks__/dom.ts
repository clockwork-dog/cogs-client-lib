import WS from 'ws';
import { JSDOM } from 'jsdom';

const dom = new JSDOM();
global.document = dom.window.document;
global.window = dom.window as any;
global.EventTarget = dom.window.EventTarget;
global.CustomEvent = dom.window.CustomEvent;

dom.window.WebSocket = WS as any;
global.WebSocket = dom.window.WebSocket;

jest.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(async function () {
  const media = this as HTMLMediaElement;
  media.dispatchEvent(new dom.window.Event('playing', { bubbles: true }));
  Object.defineProperty(media, 'paused', {
    get() {
      return false;
    },
  });
});

jest.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(async function () {
  const media = this as HTMLMediaElement;
  media.dispatchEvent(new dom.window.Event('paused', { bubbles: true }));
  Object.defineProperty(media, 'paused', {
    get() {
      return true;
    },
  });
});
