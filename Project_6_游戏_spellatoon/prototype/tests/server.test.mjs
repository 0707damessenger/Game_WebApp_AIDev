import test from 'node:test';
import assert from 'node:assert/strict';

import { CONFIG } from '../js/config.mjs';
import { createSpellatoonServer } from '../server.mjs';

async function startServer() {
  const app = createSpellatoonServer({ config: CONFIG, random: () => 0 });
  await new Promise((resolve) => app.server.listen(0, resolve));
  const address = app.server.address();
  return { app, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function stopServer(app) {
  for (const stream of app.streams || []) stream.destroy();
  await new Promise((resolve) => app.server.close(resolve));
}

async function request(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
    ...options,
    body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body,
  });
  const text = await response.text();
  return { response, body: text ? JSON.parse(text) : null };
}

async function createRoom(baseUrl) {
  return request(baseUrl, '/api/rooms', { method: 'POST', body: {} });
}

async function joinRoom(baseUrl, roomId, body = {}) {
  return request(baseUrl, `/api/rooms/${roomId}/join`, { method: 'POST', body });
}

async function readSseEvent(reader) {
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) return null;
    buffer += decoder.decode(value, { stream: true });
    const boundary = buffer.indexOf('\n\n');
    if (boundary === -1) continue;
    const block = buffer.slice(0, boundary);
    const data = block.split('\n').find((line) => line.startsWith('data: '));
    if (data) return JSON.parse(data.slice(6));
    buffer = buffer.slice(boundary + 2);
  }
}

test('creates a room, allows one join, rejects a third player, and starts for the host only', async () => {
  const { app, baseUrl } = await startServer();
  try {
    const created = await createRoom(baseUrl);
    assert.equal(created.response.status, 201);
    assert.equal(created.body.playerId, 'p1');

    const joined = await joinRoom(baseUrl, created.body.roomId);
    assert.equal(joined.response.status, 200);
    assert.equal(joined.body.playerId, 'p2');

    const third = await joinRoom(baseUrl, created.body.roomId);
    assert.equal(third.response.status, 409);

    const wrongStart = await request(baseUrl, `/api/rooms/${created.body.roomId}/start`, {
      method: 'POST',
      body: { playerId: 'p2', token: joined.body.token },
    });
    assert.equal(wrongStart.response.status, 403);

    const started = await request(baseUrl, `/api/rooms/${created.body.roomId}/start`, {
      method: 'POST',
      body: { playerId: 'p1', token: created.body.token },
    });
    assert.equal(started.response.status, 200);
    assert.equal(started.body.phase, 'playing');
  } finally {
    await stopServer(app);
  }
});

test('broadcasts valid actions through private SSE views and rejects a waiting player action', async () => {
  const { app, baseUrl } = await startServer();
  const readers = [];
  try {
    const created = await createRoom(baseUrl);
    const joined = await joinRoom(baseUrl, created.body.roomId);
    await request(baseUrl, `/api/rooms/${created.body.roomId}/start`, {
      method: 'POST',
      body: { playerId: 'p1', token: created.body.token },
    });

    const p1Events = await fetch(`${baseUrl}/api/rooms/${created.body.roomId}/events?playerId=p1&token=${created.body.token}`);
    const p2Events = await fetch(`${baseUrl}/api/rooms/${created.body.roomId}/events?playerId=p2&token=${joined.body.token}`);
    readers.push(p1Events.body.getReader(), p2Events.body.getReader());
    const p1Initial = await readSseEvent(readers[0]);
    const p2Initial = await readSseEvent(readers[1]);
    const p1Card = p1Initial.ownHand[0];
    const p2Card = p2Initial.ownHand[0];

    assert.equal(p1Initial.localPlayerId, 'p1');
    assert.equal(p2Initial.localPlayerId, 'p2');
    assert.equal(JSON.stringify(p1Initial).includes(p2Card.id), false);

    const rejected = await request(baseUrl, `/api/rooms/${created.body.roomId}/action`, {
      method: 'POST',
      body: {
        playerId: 'p2',
        token: joined.body.token,
        type: 'move',
        cardId: 'p2-card-1',
        path: [{ row: 5, col: 4 }],
      },
    });
    assert.equal(rejected.response.status, 409);

    const action = await request(baseUrl, `/api/rooms/${created.body.roomId}/action`, {
      method: 'POST',
      body: {
        playerId: 'p1',
        token: created.body.token,
        type: 'move',
        cardId: p1Card.id,
        path: [{ row: 0, col: 1 }],
      },
    });
    assert.equal(action.response.status, 200);

    const p1Update = await readSseEvent(readers[0]);
    const p2Update = await readSseEvent(readers[1]);
    assert.deepEqual(p1Update.players.find((player) => player.id === 'p1').position, { row: 0, col: 1 });
    assert.deepEqual(p2Update.players.find((player) => player.id === 'p1').position, { row: 0, col: 1 });
    assert.ok(p1Update.ownHand.every((card) => card.ownerId === 'p1'));
    assert.ok(p2Update.ownHand.every((card) => card.ownerId === 'p2'));
    assert.equal(JSON.stringify(p1Update).includes(p2Card.id), false);
    assert.equal(JSON.stringify(p2Update).includes(p1Card.id), false);
  } finally {
    for (const reader of readers) await reader.cancel();
    await stopServer(app);
  }
});

test('reconnects a player with the same token and preserves the room state', async () => {
  const { app, baseUrl } = await startServer();
  try {
    const created = await createRoom(baseUrl);
    const joined = await joinRoom(baseUrl, created.body.roomId);
    const reconnected = await joinRoom(baseUrl, created.body.roomId, {
      playerId: 'p2',
      token: joined.body.token,
    });

    assert.equal(reconnected.response.status, 200);
    assert.equal(reconnected.body.playerId, 'p2');
    assert.equal(reconnected.body.reconnected, true);
    assert.equal(reconnected.body.roomId, created.body.roomId);
  } finally {
    await stopServer(app);
  }
});
