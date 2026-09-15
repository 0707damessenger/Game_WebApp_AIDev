import { randomUUID } from 'node:crypto';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONFIG } from './js/config.mjs';
import { endTurn, performDeploy, performMove, createInitialState } from './js/rules.mjs';
import { projectStateForPlayer } from './js/public-state.mjs';

const prototypeRoot = fileURLToPath(new URL('.', import.meta.url));
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
};

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'access-control-allow-origin': '*',
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(payload));
}

function sendError(response, status, error, reason = null) {
  sendJson(response, status, { error, ...(reason ? { reason } : {}) });
}

async function readJson(request) {
  let body = '';
  for await (const chunk of request) body += chunk;
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    throw new Error('invalid-json');
  }
}

function newRoomId(rooms, random) {
  let roomId;
  do roomId = String(Math.floor(random() * 10000)).padStart(4, '0'); while (rooms.has(roomId));
  return roomId;
}

function authenticate(room, playerId, token) {
  const player = room.players.get(playerId);
  return player?.token === token ? player : null;
}

function actionResult(room, body, config) {
  if (body.type === 'move') return performMove(room.state, body.playerId, body.cardId, body.path, config);
  if (body.type === 'deploy') return performDeploy(room.state, body.playerId, body.cardId, config);
  if (body.type === 'end-turn') return endTurn(room.state, body.playerId, config, room.random);
  return { ok: false, reason: 'unknown-action' };
}

function sendSse(response, payload) {
  response.write(`event: state\ndata: ${JSON.stringify(payload)}\n\n`);
}

function roomConnection(room) {
  return { joinedPlayers: [...room.players.keys()] };
}

function broadcastRoom(room) {
  for (const [playerId, player] of room.players) {
    const view = projectStateForPlayer(room.state, playerId, roomConnection(room));
    for (const stream of player.streams) sendSse(stream, view);
  }
}

function serveStatic(request, response) {
  const requestUrl = new URL(request.url, 'http://localhost');
  const relativePath = requestUrl.pathname === '/' ? 'index.html' : requestUrl.pathname.slice(1);
  const filePath = normalize(join(prototypeRoot, decodeURIComponent(relativePath)));
  if (!filePath.startsWith(prototypeRoot) || !existsSync(filePath) || statSync(filePath).isDirectory()) {
    sendError(response, 404, 'not-found');
    return;
  }
  response.writeHead(200, { 'content-type': mimeTypes[extname(filePath)] || 'application/octet-stream' });
  createReadStream(filePath).pipe(response);
}

export function createSpellatoonServer({ config = CONFIG, random = Math.random } = {}) {
  const rooms = new Map();
  const streams = new Set();

  const server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url, 'http://localhost');
      const parts = requestUrl.pathname.split('/').filter(Boolean);
      if (request.method === 'POST' && requestUrl.pathname === '/api/rooms') {
        const state = createInitialState({ config, random });
        state.phase = 'lobby';
        state.lastEvent = { type: 'room-created' };
        const room = {
          id: newRoomId(rooms, random),
          players: new Map(),
          random,
          state,
        };
        const host = { id: 'p1', token: randomUUID(), streams: new Set() };
        room.players.set(host.id, host);
        rooms.set(room.id, room);
        sendJson(response, 201, { roomId: room.id, playerId: host.id, token: host.token, host: true });
        return;
      }

      if (parts[0] !== 'api' || parts[1] !== 'rooms' || !parts[2]) {
        serveStatic(request, response);
        return;
      }

      const room = rooms.get(parts[2]);
      if (!room) {
        sendError(response, 404, 'room-not-found');
        return;
      }

      if (request.method === 'POST' && parts[3] === 'join') {
        const body = await readJson(request);
        if (body.playerId && body.token) {
          if (!authenticate(room, body.playerId, body.token)) {
            sendError(response, 401, 'unauthorized');
            return;
          }
          sendJson(response, 200, { roomId: room.id, playerId: body.playerId, token: body.token, host: body.playerId === 'p1', reconnected: true });
          return;
        }
        if (room.players.size >= config.players.length) {
          sendError(response, 409, 'room-full');
          return;
        }
        const guest = { id: 'p2', token: randomUUID(), streams: new Set() };
        room.players.set(guest.id, guest);
        broadcastRoom(room);
        sendJson(response, 200, { roomId: room.id, playerId: guest.id, token: guest.token, host: false, reconnected: false });
        return;
      }

      if (request.method === 'GET' && parts[3] === 'events') {
        const playerId = requestUrl.searchParams.get('playerId');
        const token = requestUrl.searchParams.get('token');
        const player = authenticate(room, playerId, token);
        if (!player) {
          sendError(response, 401, 'unauthorized');
          return;
        }
        response.writeHead(200, {
          'access-control-allow-origin': '*',
          'cache-control': 'no-cache, no-transform',
          connection: 'keep-alive',
          'content-type': 'text/event-stream; charset=utf-8',
        });
        player.streams.add(response);
        streams.add(response);
        broadcastRoom(room);
        request.on('close', () => {
          player.streams.delete(response);
          streams.delete(response);
        });
        return;
      }

      const body = await readJson(request);
      if (!authenticate(room, body.playerId, body.token)) {
        sendError(response, 401, 'unauthorized');
        return;
      }

      if (request.method === 'POST' && parts[3] === 'start') {
        if (body.playerId !== 'p1') {
          sendError(response, 403, 'host-only');
          return;
        }
        if (room.players.size < config.players.length) {
          sendError(response, 409, 'waiting-for-player');
          return;
        }
        room.state.phase = 'playing';
        room.state.lastEvent = { type: 'game-started', playerId: room.state.starterId };
        broadcastRoom(room);
        sendJson(response, 200, projectStateForPlayer(room.state, body.playerId, roomConnection(room)));
        return;
      }

      if (request.method === 'POST' && parts[3] === 'action') {
        if (room.state.phase !== 'playing') {
          sendError(response, 409, 'game-not-playing');
          return;
        }
        const result = actionResult(room, body, config);
        if (!result.ok) {
          sendError(response, 409, 'invalid-action', result.reason);
          return;
        }
        room.state = result.state;
        broadcastRoom(room);
        sendJson(response, 200, projectStateForPlayer(room.state, body.playerId, roomConnection(room)));
        return;
      }

      sendError(response, 404, 'not-found');
    } catch (error) {
      sendError(response, error.message === 'invalid-json' ? 400 : 500, error.message === 'invalid-json' ? 'invalid-json' : 'server-error');
    }
  });

  return { server, rooms, streams };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const app = createSpellatoonServer();
  app.server.listen(CONFIG.network.port, '0.0.0.0', () => {
    console.log(`Spellatoon optimization server listening on ${CONFIG.network.port}`);
  });
}
