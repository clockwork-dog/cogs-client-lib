import waitForExpect from 'wait-for-expect';
import { MediaClipStateMessage } from '..';
import { VideoState } from '../types/VideoState';
import VideoPlayer from '../VideoPlayer';
import FakeCogsConnection from '../testUtils/FakeCogsConnection';

let fakeCogsConnection: FakeCogsConnection;
let videoPlayer: VideoPlayer;
let stateListener: jest.Mock<void, [VideoState]>;
let clipStateListener: jest.Mock<void, [MediaClipStateMessage]>;

beforeEach(async () => {
  stateListener = jest.fn();
  clipStateListener = jest.fn();

  fakeCogsConnection = new FakeCogsConnection();
  await fakeCogsConnection.isOpen;

  videoPlayer = new VideoPlayer(fakeCogsConnection);
  videoPlayer.addEventListener('state', ({ detail }) => stateListener(detail));
  videoPlayer.addEventListener('videoClipState', ({ detail }) => clipStateListener(detail));
});

afterEach(() => {
  fakeCogsConnection.close();
});

describe('config update', () => {
  test('initial clip states empty', async () => {
    await waitForExpect(() => {
      expect(fakeCogsConnection.fakeServerMessageListener).toHaveBeenCalledWith({
        allMediaClipStates: {
          files: [],
          mediaType: 'video',
        },
      });
    });
  });

  test('empty config => state empty', async () => {
    fakeCogsConnection.fakeMessageFromServer({
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
    fakeCogsConnection.fakeMessageFromServer({
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
  fakeCogsConnection.fakeMessageFromServer({
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
    expect(fakeCogsConnection.fakeServerMessageListener).toHaveBeenCalledWith({
      mediaClipState: {
        playId: 'video1',
        mediaType: 'video',
        file: 'foo.mp4',
        status: 'playing',
      },
    });
  });
});
