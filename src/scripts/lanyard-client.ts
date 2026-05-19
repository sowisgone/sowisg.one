import {
	getAvatarUrl,
	getDisplayName,
	statusColors,
	type LanyardPresence,
} from '../lib/discord';
import { setPfpSource } from './pfp-canvas';

const WS_URL = 'wss://api.lanyard.rest/socket';
const DEFAULT_HEARTBEAT_MS = 30_000;
const RECONNECT_MS = 3_000;

function isPresence(data: unknown): data is LanyardPresence {
	return (
		typeof data === 'object' &&
		data !== null &&
		'discord_user' in data &&
		'discord_status' in data
	);
}

function applyPresence(presence: LanyardPresence) {
  const statusDot = document.getElementById('status-dot');
  const activityLabel = document.getElementById('activity-label');
  const spotifyMarquee = document.getElementById('spotify-marquee') as HTMLElement | null;
  const spotifyText = document.getElementById('spotify-text');

  // PFP
  setPfpSource(getAvatarUrl(presence.discord_user));

  // Status dot
  if (statusDot) {
    statusDot.style.background =
      statusColors[presence.discord_status] ?? statusColors.offline;
  }

  if (!activityLabel) return;

  // 1. Twitch stream (activity type 1)
  const streamActivity = (presence as any).activities?.find((a: any) => a.type === 1);
  if (streamActivity) {
    activityLabel.innerHTML = 'live on <span class="activity-verb">twitch</span>';
    if (spotifyMarquee) spotifyMarquee.style.display = 'none';
    return;
  }

  // 2. Spotify
  const sp = (presence as any).spotify;
  if ((presence as any).listening_to_spotify && sp) {
    activityLabel.innerHTML = 'now <span class="activity-verb">listening</span>';
    if (spotifyMarquee && spotifyText) {
      spotifyMarquee.style.display = 'block';
      const songText = `${sp.song} — ${sp.artist}`;
      spotifyText.dataset.duplicated = '';
      spotifyText.textContent = songText;
      spotifyText.classList.remove('scrolling');
      requestAnimationFrame(() => {
        if (spotifyText.scrollWidth > (spotifyMarquee as HTMLElement).offsetWidth) {
          spotifyText.textContent = songText + '   ' + songText;
          spotifyText.dataset.duplicated = 'true';
          spotifyText.classList.add('scrolling');
        }
      });
    }
    return;
  }

  // 3. Game (activity type 0)
  const gameActivity = (presence as any).activities?.find((a: any) => a.type === 0);
  if (gameActivity) {
    activityLabel.innerHTML = `now playing<br><span class="activity-verb">${gameActivity.name}</span>`;
    if (spotifyMarquee) spotifyMarquee.style.display = 'none';
    return;
  }

  // 4. Idling
  activityLabel.innerHTML = 'idling<span class="dots-anim"></span>';
  if (spotifyMarquee) spotifyMarquee.style.display = 'none';
}

export function initLanyard(discordUserId: string) {
	let heartbeat: ReturnType<typeof setInterval> | undefined;

	function connect() {
		const socket = new WebSocket(WS_URL);

		socket.addEventListener('open', () => {
			socket.send(
				JSON.stringify({
					op: 2,
					d: { subscribe_to_id: discordUserId },
				}),
			);
		});

		socket.addEventListener('message', ({ data }) => {
			const msg = JSON.parse(data as string) as {
				op: number;
				t?: string;
				d: unknown;
			};

			// Hello — server heartbeat interval
			if (msg.op === 1 && typeof msg.d === 'object' && msg.d !== null) {
				const interval =
					'heartbeat_interval' in msg.d &&
					typeof (msg.d as { heartbeat_interval: unknown }).heartbeat_interval ===
						'number'
						? (msg.d as { heartbeat_interval: number }).heartbeat_interval
						: DEFAULT_HEARTBEAT_MS;

				if (heartbeat) clearInterval(heartbeat);
				heartbeat = setInterval(() => {
					socket.send(JSON.stringify({ op: 3 }));
				}, interval);
				return;
			}

			// Current protocol: op 0 carries presence in d
			if (msg.op === 0 && isPresence(msg.d)) {
				applyPresence(msg.d);
				return;
			}

			// Legacy event envelope (t + nested d)
			if (msg.t === 'INIT_STATE' || msg.t === 'PRESENCE_UPDATE') {
				if (isPresence(msg.d)) applyPresence(msg.d);
			}
		});

		socket.addEventListener('close', () => {
			if (heartbeat) clearInterval(heartbeat);
			setTimeout(connect, RECONNECT_MS);
		});
	}

	connect();
}
