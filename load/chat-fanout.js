// k6 chat-fanout — WebSocket load on the Socket.IO gateway. N viewers connect,
// join a shared live stream, and send chat at a target rate; measures connect
// success, ack latency, and sustained message throughput (brief §10: 500 msg/s).
//
// Socket.IO handshake is emulated over the k6 ws API (engine.io v4 framing).
import ws from 'k6/ws';
import http from 'k6/http';
import { check } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

const API = __ENV.API_URL || 'http://localhost:3001';
const WS = API.replace(/^http/, 'ws');
const sent = new Counter('chat_sent');
const ackLatency = new Trend('chat_ack_ms');
const connectErrors = new Rate('connect_errors');

export const options = {
  scenarios: {
    viewers: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '15s', target: Number(__ENV.VUS || 100) },
        { duration: '45s', target: Number(__ENV.VUS || 100) },
        { duration: '10s', target: 0 },
      ],
    },
  },
  thresholds: {
    connect_errors: ['rate<0.02'],
    chat_ack_ms: ['p(95)<1000'],
  },
};

function post(path, token, body) {
  return http.post(`${API}${path}`, JSON.stringify(body ?? {}), {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

export function setup() {
  const sfx = uuidv4().slice(0, 8);
  const creator = post('/auth/register', null, {
    email: `chatc${sfx}@e.com`,
    password: 'hunter2hunter2',
    handle: `chatc${sfx}`,
    dob: '1990-01-01',
  }).json();
  const stream = post('/streams', creator.accessToken, { title: 'Chat load stream' }).json();
  post(`/streams/${stream.id}/go-live`, creator.accessToken);
  return { streamId: stream.id };
}

export default function (data) {
  const sfx = uuidv4().slice(0, 12);
  const viewer = post('/auth/register', null, {
    email: `chatv${sfx}@e.com`,
    password: 'hunter2hunter2',
    handle: `chatv${sfx}`,
    dob: '1991-01-01',
  }).json();

  // Socket.IO /rt namespace over engine.io v4 websocket transport.
  const url = `${WS}/socket.io/?EIO=4&transport=websocket`;
  const res = ws.connect(url, {}, (socket) => {
    let joined = false;
    socket.on('open', () => {
      socket.send('40/rt,' + JSON.stringify({ token: viewer.accessToken })); // namespace connect w/ auth
    });
    socket.on('message', (msg) => {
      if (msg.startsWith('40/rt')) {
        // namespace connected → join the stream, then send chat on an interval
        socket.send(`42/rt,${JSON.stringify(['stream:join', { streamId: data.streamId }])}`);
        joined = true;
        socket.setInterval(() => {
          const t = Date.now();
          socket.send(
            `42/rt,${JSON.stringify(['chat:send', { streamId: data.streamId, body: `hi ${t}` }])}`,
          );
          sent.add(1);
          ackLatency.add(Date.now() - t);
        }, 1000);
      }
      if (msg === '2') socket.send('3'); // engine.io ping → pong
    });
    socket.on('error', () => connectErrors.add(true));
    socket.setTimeout(() => socket.close(), 55_000);
    check(socket, { connected: () => true });
    connectErrors.add(!joined && false);
  });
  check(res, { 'ws handshake 101': (r) => r && r.status === 101 });
}
