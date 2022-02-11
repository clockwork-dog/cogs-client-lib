import WS, { WebSocketServer } from 'ws';
import { CogsClientMessage, MediaClipStateMessage } from '..';
import CogsConnection from '../CogsConnection';
import AllMediaClipStatesMessage from '../types/AllMediaClipStatesMessage';

export default class FakeCogsConnection extends CogsConnection {
  port: number;
  isOpen: Promise<void>;
  fakeServerMessageListener: jest.Mock<
    void,
    [
      {
        allMediaClipStates?: AllMediaClipStatesMessage;
        mediaClipStates?: MediaClipStateMessage;
      }
    ]
  > = jest.fn();

  private fakeServer: WebSocketServer;
  private fakeClientConnection: WS | undefined;
  private messageListener = (data: WS.RawData) => this.fakeServerMessageListener(JSON.parse(data.toString()));

  constructor(port = 2000 + Math.floor(Math.random() * 8000)) {
    super({ hostname: 'localhost', port });
    this.port = port;
    this.fakeServer = new WebSocketServer({ port });
    this.isOpen = (async () => {
      this.fakeClientConnection = await new Promise<WS>((resolve) => this.fakeServer.once('connection', resolve));
      this.fakeClientConnection.on('message', this.messageListener);
    })();
  }

  close(): void {
    this.fakeClientConnection?.off('message', this.messageListener);
    this.fakeClientConnection?.close();
    this.fakeServer.close();
  }

  fakeMessageFromServer(message: CogsClientMessage): void {
    this.fakeClientConnection?.send(JSON.stringify({ message }));
  }
}
