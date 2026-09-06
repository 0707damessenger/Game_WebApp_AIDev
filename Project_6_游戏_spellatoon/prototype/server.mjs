import { randomUUID } from 'node:crypto';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONFIG } from './js/config.mjs';
import {
  createInitialState,
  endTurn,
  performDeploy,
  performMove,
} from './js/rules.mjs';
import { createPlayerView } from './js/public-state.mjs';

const prototypeRoot = fileURLToPath(new URL('.', import.meta.url));
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
  });
  res.end(body);
}

function errorResponse(res, status, message, reason = null) {
  json(res, status, { error: message, ...(reason ? { reason } : {}) });
}

async function readJsonBody(req) {
  let body = '';
  for await (const chunk of req) body += chunk;
  if (!body.trim()) return {};
  try {
    return JSON.parse(body);
  } catch {
    throw new Error('invalid-json');
  }
}

function roomConnection(room) {
  return {
    connectedPlayers: [...room.players.values()]
      .filter((player) => player.connected)
      .map((player) => player.id),
  };
}

function playerRecord(room, playerId) {
  return room.players.get(playerId);
}

function authenticate(room, playerId, token) {
  const player = playerRecord(room, playerId);
  return player && player.token === token ? player : null;
}

function sendSse(res, event, payload) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

function newRoomId(rooms) {
  let roomId;
  do roomId = `spell-${randomUUID().slice(0, 8)}`; while (rooms.has(roomId));
  return roomId;
}

function roomResponse(room, playerId, extra = {}) {
  const player = playerRecord(room, playerId);
  return {
    roomId: room.id,
    playerId,
    token: player.token,
    host: playerId === 'p1',
    ...extra,
  };
}

function broadcastRoom(room, streams) {
  const connection = roomConnection(room);
  for (const [playerId, player] of room.players) {
    const view = createPlayerView(room.state, playerId, connection);
    for (const stream of player.streams) sendSse(stream, 'state', view);
  }
  return streams;
}

function actionResult(room, body, config, random) {
  const { playerId, type, cardId, path } = body;
  if (type === 'move') return performMove(room.state, playerId, cardId, path, config);
  if (type === 'deploy') return performDeploy(room.state, playerId, cardId, config);
  if (type === 'end-turn') return endTurn(room.state, playerId, config, random);
  return { ok: false, reason: 'unknown-action' };
}

function clearActionTimer(room, actionTimers) {
  if (!room.actionTimer) return;
  clearTimeout(room.actionTimer);
  actionTimers.delete(room.actionTimer);
  room.actionTimer = null;
}

async function serveStatic(req, res) {
  const requestUrl = new URL(req.url, 'http://localhost');
  let relativePath = decodeURIComponent(requestUrl.pathname);
  if (relativePath === '/') relativePath = '/index.html';
  const filePath = normalize(join(prototypeRoot, relativePath));
  if (!filePath.startsWith(prototypeRoot) || !existsSync(filePath) || statSync(filePath).isDirectory()) {
    errorResponse(res, 404, 'not-found');
    return;
  }
  const extension = extname(filePath).toLowerCase();
  res.writeHead(200, {
    'content-type': mimeTypes[extension] || 'application/octet-stream',
    'cache-control': 'no-store',
  });
  createReadStream(filePath).pipe(res);
}

export function createSpellatoonServer({ config = CONFIG, random = Math.random } = {}) {
  const rooms = new Map();
  const streams = new Set();
  const heartbeatTimers = new Set();
  const actionTimers = new Set();

  function scheduleActionTimer(room) {
    clearActionTimer(room, actionTimers);
    if (room.state.phase !== 'playing' || !Number.isFinite(room.state.turnDeadlineAt)) return;
    const deadline = room.state.turnDeadlineAt;
    const timer = setTimeout(() => expireTurn(room, deadline), Math.max(0, deadline - Date.now()) + 1);
    timer.unref?.();
    room.actionTimer = timer;
    actionTimers.add(timer);
  }

  function expireTurn(room, deadline = room.state.turnDeadlineAt) {
    if (
      room.state.phase !== 'playing'
      || room.state.turnDeadlineAt !== deadline
      || deadline > Date.now()
    ) return false;
    clearActionTimer(room, actionTimers);
    const playerId = room.state.activePlayerId;
    const result = endTurn(room.state, playerId, config, random, Date.now);
    if (!result.ok) return false;
    result.state.lastEvent = {
      ...result.event,
      type: 'turn-timeout',
      message: `行动时间到，${result.event.message}`,
    };
    room.state = result.state;
    broadcastRoom(room, streams);
    scheduleActionTimer(room);
    return true;
  }

  function handleEvents(req, res, room, playerId, token) {
    if (!authenticate(room, playerId, token)) {
      errorResponse(res, 401, 'unauthorized');
      return;
    }
    const player = playerRecord(room, playerId);
    player.connected = true;
    player.streams.add(res);
    streams.add(res);
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'access-control-allow-origin': '*',
    });
    broadcastRoom(room, streams);
    const timer = setInterval(() => res.write(': heartbeat\n\n'), config.network.heartbeatMs);
    heartbeatTimers.add(timer);
    req.on('close', () => {
      clearInterval(timer);
      heartbeatTimers.delete(timer);
      player.streams.delete(res);
      streams.delete(res);
      player.connected = false;
    });
  }

  async function handleApi(req, res) {
    const requestUrl = new URL(req.url, 'http://localhost');
    const parts = requestUrl.pathname.split('/').filter(Boolean);
    if (req.method === 'POST' && requestUrl.pathname === '/api/rooms') {
      const roomId = newRoomId(rooms);
      const state = createInitialState({ config, random });
      state.phase = 'lobby';
      state.lastEvent = { type: 'room-created', message: '等待另一名玩家加入' };
      const room = {
        id: roomId,
        state,
        players: new Map(),
      };
      room.players.set('p1', {
        id: 'p1',
        token: randomUUID(),
        connected: false,
        streams: new Set(),
      });
      rooms.set(roomId, room);
      json(res, 201, roomResponse(room, 'p1'));
      return;
    }

    if (parts[0] !== 'api' || parts[1] !== 'rooms' || !parts[2]) {
      await serveStatic(req, res);
      return;
    }
    const room = rooms.get(parts[2]);
    if (!room) {
      errorResponse(res, 404, 'room-not-found');
      return;
    }

    if (req.method === 'POST' && parts.length === 4 && parts[3] === 'join') {
      const body = await readJsonBody(req);
      if (body.playerId && body.token) {
        const player = authenticate(room, body.playerId, body.token);
        if (!player) {
          errorResponse(res, 401, 'unauthorized');
          return;
        }
        player.connected = true;
        json(res, 200, roomResponse(room, body.playerId, { reconnected: true }));
        return;
      }
      if (room.players.size >= config.players.length) {
        errorResponse(res, 409, 'room-full');
        return;
      }
      const playerId = 'p2';
      room.players.set(playerId, {
        id: playerId,
        token: randomUUID(),
        connected: false,
        streams: new Set(),
      });
      json(res, 200, roomResponse(room, playerId, { reconnected: false }));
      return;
    }

    if (req.method === 'GET' && parts.length === 4 && parts[3] === 'events') {
      handleEvents(req, res, room, requestUrl.searchParams.get('playerId'), requestUrl.searchParams.get('token'));
      return;
    }

    const body = await readJsonBody(req);
    const player = authenticate(room, body.playerId, body.token);
    if (!player) {
      errorResponse(res, 401, 'unauthorized');
      return;
    }

    if (req.method === 'POST' && parts.length === 4 && parts[3] === 'start') {
      if (body.playerId !== 'p1') {
        errorResponse(res, 403, 'host-only');
        return;
      }
      if (room.players.size < config.players.length) {
        errorResponse(res, 409, 'waiting-for-player');
        return;
      }
      if (room.state.phase === 'lobby') {
        room.state.phase = 'playing';
        room.state.turnDeadlineAt = Date.now() + config.timer.actionTimeMs;
        room.state.lastEvent = { type: 'game-started', message: `${room.state.players.find((candidate) => candidate.id === room.state.starterId).label} 先手` };
        broadcastRoom(room, streams);
        scheduleActionTimer(room);
      }
      json(res, 200, createPlayerView(room.state, 'p1', roomConnection(room)));
      return;
    }

    if (req.method === 'POST' && parts.length === 4 && parts[3] === 'action') {
      expireTurn(room);
      if (room.state.phase !== 'playing') {
        errorResponse(res, 409, 'game-not-playing');
        return;
      }
      const result = actionResult(room, body, config, random);
      if (!result.ok) {
        errorResponse(res, 409, 'invalid-action', result.reason);
        return;
      }
      room.state = result.state;
      broadcastRoom(room, streams);
      scheduleActionTimer(room);
      json(res, 200, createPlayerView(room.state, body.playerId, roomConnection(room)));
      return;
    }

    errorResponse(res, 404, 'not-found');
  }

  const server = createServer(async (req, res) => {
    try {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET,POST,OPTIONS',
          'access-control-allow-headers': 'content-type',
        });
        res.end();
        return;
      }
      await handleApi(req, res);
    } catch (error) {
      if (error.message === 'invalid-json') errorResponse(res, 400, 'invalid-json');
      else errorResponse(res, 500, 'server-error');
    }
  });

  return {
    server,
    rooms,
    streams,
    heartbeatTimers,
    actionTimers,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const app = createSpellatoonServer();
  app.server.listen(CONFIG.network.port, '0.0.0.0', () => {
    console.log(`Spellatoon LAN server listening on ${CONFIG.network.port}`);
  });
}
