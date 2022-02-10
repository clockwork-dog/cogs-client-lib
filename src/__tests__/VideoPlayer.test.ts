import VideoPlayer from '../VideoPlayer';
import CogsConnection from '../CogsConnection';
import WS, { WebSocketServer } from 'ws';
import { CogsClientMessage, MediaClipStateMessage } from '..';
import { VideoState } from '../types/VideoState';
import waitForExpect from 'wait-for-expect';
import AllMediaClipStatesMessage from '../types/AllMediaClipStatesMessage';

let fakeServer: WebSocketServer;
let fakeClientConnection: WS;
let cogsConnection: CogsConnection;
let videoPlayer: VideoPlayer;
let stateListener: jest.Mock<void, [VideoState]>;
let clipStateListener: jest.Mock<void, [MediaClipStateMessage]>;
let fakeServerMessageListener: jest.Mock<
  void,
  [
    {
      allMediaClipStates?: AllMediaClipStatesMessage;
      mediaClipStates?: MediaClipStateMessage;
    }
  ]
>;

beforeEach(async () => {
  stateListener = jest.fn();
  clipStateListener = jest.fn();
  fakeServerMessageListener = jest.fn();

  fakeServer = new WebSocketServer({ port: 1234 });
  cogsConnection = new CogsConnection({ hostname: 'localhost', port: 1234 });
  fakeClientConnection = await new Promise((resolve) => fakeServer.once('connection', resolve));
  fakeClientConnection.on('message', (data) => fakeServerMessageListener(JSON.parse(data.toString())));
  await new Promise((resolve) => cogsConnection.addEventListener('open', resolve));

  videoPlayer = new VideoPlayer(cogsConnection);
  videoPlayer.addEventListener('state', ({ detail }) => stateListener(detail));
  videoPlayer.addEventListener('videoClipState', ({ detail }) => clipStateListener(detail));
});

afterEach(() => {
  fakeClientConnection.close();
  fakeServer.close();
});

function fakeMessageFromServer(message: CogsClientMessage) {
  fakeClientConnection.send(JSON.stringify({ message }));
}

describe('config update', () => {
  test('initial clip states empty', async () => {
    await waitForExpect(() => {
      expect(fakeServerMessageListener).toHaveBeenCalledWith({
        allMediaClipStates: {
          files: [],
          mediaType: 'video',
        },
      });
    });
  });

  test('empty config => state empty', async () => {
    fakeMessageFromServer({
      type: 'media_config_update',
      files: {},
      globalVolume: 1,
    });

    await waitForExpect(() => {
      expect(stateListener).toHaveBeenCalledWith({
        globalVolume: 1,
        isPlaying: false,
        clips: {},
      });
    });
  });

  test('preload one file', async () => {
    fakeMessageFromServer({
      type: 'media_config_update',
      files: {
        'preload-me.mp4': { type: 'video', preload: true },
      },
      globalVolume: 1,
    });

    await waitForExpect(() => {
      expect(stateListener).toHaveBeenCalledWith({
        globalVolume: 1,
        isPlaying: false,
        clips: {
          'preload-me.mp4': {
            config: { type: 'video', ephemeral: false, fit: expect.any(String), preload: true },
            volume: 1,
          },
        },
      });
    });

    expect(clipStateListener).not.toHaveBeenCalled();
  });
});

test('play', async () => {
  fakeMessageFromServer({
    type: 'video_play',
    file: 'foo.mp4',
    playId: 'video1',
    volume: 1,
    fit: 'contain',
  });

  await waitForExpect(() => {
    expect(stateListener).toHaveBeenCalledWith({
      globalVolume: 1,
      isPlaying: true,
      activeClip: {
        path: 'foo.mp4',
        loop: false,
        volume: 1,
        state: 'playing',
      },
      clips: {
        'foo.mp4': {
          config: {
            ephemeral: true,
            fit: 'contain',
            preload: false,
          },
          volume: 1,
        },
      },
    });
    expect(clipStateListener).toHaveBeenCalledWith({
      playId: 'video1',
      mediaType: 'video',
      file: 'foo.mp4',
      status: 'playing',
    });
    expect(fakeServerMessageListener).toHaveBeenCalledWith({
      mediaClipState: {
        playId: 'video1',
        mediaType: 'video',
        file: 'foo.mp4',
        status: 'playing',
      },
    });
  });
});
