import { expect } from 'chai';
import { CogsConnection } from '../../src';
import CogsMessage from '../../src/types/CogsMessage';
import VideoPlayer from '../../src/VideoPlayer';

describe('VideoPlayer', () => {
  it('create', () => {
    const videoPlayer = new VideoPlayer(new CogsConnection({ hostname: 'localhost', port: 0 }));
    expect(videoPlayer).to.not.be.undefined;
  });

  it('play', () => {
    const connection = new CogsConnection({ hostname: 'localhost', port: 0 });
    const cogsMessages: CogsMessage[] = [];
    connection.addEventListener('_cogsMessage', ({ detail }) => cogsMessages.push(detail));

    const videoPlayer = new VideoPlayer(connection);
    connection._handleCogsMessage({
      message: {
        type: 'video_play',
        file: 'boom.mp4',
        playId: 'video1',
        fit: 'contain',
        volume: 1,
      },
    });

    waitForCogsMessage(
      connection,
      ({ mediaClipState }) => mediaClipState?.mediaType === 'video' && mediaClipState.file === 'boom.mp4' && mediaClipState.playId === 'video1'
    );
  });
});

async function waitForCogsMessage(connection: CogsConnection, messagePredicate: (message: CogsMessage) => unknown) {
  return new Promise<CogsMessage>((resolve) => {
    const listener = ({ detail }: { detail: CogsMessage }) => {
      if (messagePredicate(detail)) {
        connection.removeEventListener('_cogsMessage', listener);
        resolve(detail);
      }
    };
    connection.addEventListener('_cogsMessage', listener);
  });
}
