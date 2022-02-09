import * as path from 'path';

const BROWSER_IMPORT_FILE = path.join(path.dirname(path.dirname(__dirname)), 'dist', 'browser', 'index.js');
const COGS: any = {};

beforeAll(async () => {
  await page.addScriptTag({ path: BROWSER_IMPORT_FILE });
});

test('create', async () => {
  await page.evaluate(() => {
    (window as any).audioPlayer = new COGS.CogsAudioPlayer(new COGS.CogsConnection({ hostname: 'localhost', port: 4444 }));
  });
});
