import { createPlugin } from '@/utils';
import registerCallback from '@/providers/song-info';
import * as http from 'http';
import * as fs from 'fs';

interface Data {
  title: string;
  artist: string;
  status: string;
  duration: string;
  progress: string;
}

export default createPlugin({
  name: () => 'HTTP',
  description: () => 'HTTP Server to get information about the current song',
  restartNeeded: false,
  config: {
    enabled: false,
  },
  backend: {
    data: {
      title: '',
      artist: '',
      status: '',
      progress: '',
      duration: '',
    } as Data,
    start({ ipc }) {
      const formatTime = (t: number) => {
        // t is in seconds
        const hours = Math.floor(t / 3600);
        const minutes = Math.floor((t % 3600) / 60);
        const seconds = Math.floor(t % 60);

        var minutesString = minutes.toString();
        if (minutes < 10) {
          minutesString = '0' + minutesString;
        }

        var secondsString = seconds.toString();
        if (seconds < 10) {
          secondsString = '0' + secondsString;
        }

        if (hours > 0) {
          return `${hours}:${minutesString}:${secondsString}`;
        } else {
          return `${minutesString}:${secondsString}`;
        }
      };
      ipc.on('ytmd:player-api-loaded', () =>
        ipc.send('ytmd:setup-time-changed-listener'),
      );
      ipc.on('ytmd:time-changed', (t: number) => {
        if (!this.data.title) {
          return;
        }
        this.data.progress = formatTime(t);
      });

      registerCallback((songInfo) => {
        if (!songInfo.title && !songInfo.artist) {
          return;
        }

        this.data.title = songInfo.title;
        this.data.artist = songInfo.artist;
        this.data.status = songInfo.isPaused ? 'stopped' : 'playing';
        this.data.duration = formatTime(songInfo.songDuration);
        this.data.progress = formatTime(songInfo.elapsedSeconds ?? 0);
      });

      const server = http.createServer((req, resp) => {
        if (req.method === 'GET' && req.url === '/') {
          resp.writeHead(200, { 'Content-Type': 'application/json' });
          resp.end(JSON.stringify(this.data));
        } else {
          resp.writeHead(404, { 'Content-Type': 'text/plain' });
          resp.end('404 - Not Found');
        }
      });

      const PORT = 2003;
      // read from config
      const configFilePath = 'http.json';
      var hostname = 'localhost';

      try {
        const config: any = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
        if (config.hostname) {
          hostname = config.hostname;
        }
      } catch (e) {}

      server.listen(PORT, hostname, () => {});
    },
  },
});
