import test from 'node:test';
import assert from 'node:assert/strict';

import { createSpellatoonServer } from '../server.mjs';

async function startServer() {
  const app = createSpellatoonServer({ random: () => 0 });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const { port } = app.server.address();
  if (port >= 6665 && port <= 6669) {
    await new Promise((resolve) => app.server.close(resolve));
    return startServer();
  }
  return { app, baseUrl: `http://127.0.0.1:${port}` };
}

async function stopServer(app) {
  for (const stream of app.streams) stream.destroy();
  await new Promise((resolve) => app.server.close(resolve));
}

async function request(baseUrl, path, body = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return { response, body: text ? JSON.parse(text) : null };
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

test('creates a room, authorizes players, and never returns the opponent hand', async (t) => {
  const { app, baseUrl } = await startServer();
  t.after(() => stopServer(app));

  const created = await request(baseUrl, '/api/rooms');
  assert.equal(created.response.status, 201);
  assert.match(created.body.roomId, /^\d{4}$/);
  const joined = await request(baseUrl, `/api/rooms/${created.body.roomId}/join`);
  assert.equal(joined.response.status, 200);
  const started = await request(baseUrl, `/api/rooms/${created.body.roomId}/start`, {
    playerId: created.body.playerId,
    token: created.body.token,
  });
  assert.equal(started.response.status, 200);
  assert.equal(started.body.phase, 'playing');
  assert.equal(JSON.stringify(started.body).includes(joined.body.token), false);

  const waitingPlayerAction = await request(baseUrl, `/api/rooms/${created.body.roomId}/action`, {
    playerId: joined.body.playerId,
    token: joined.body.token,
    type: 'move',
    cardId: 'p2-card-6',
    path: [{ row: 7, col: 6 }],
  });
  assert.equal(waitingPlayerAction.response.status, 409);

  const moved = await request(baseUrl, `/api/rooms/${created.body.roomId}/action`, {
    playerId: created.body.playerId,
    token: created.body.token,
    type: 'move',
    cardId: started.body.localHand[0].id,
    path: [{ row: 0, col: 1 }],
  });
  assert.equal(moved.response.status, 200);
  assert.deepEqual(moved.body.players.find((player) => player.id === 'p1').position, { row: 0, col: 1 });
  assert.equal(JSON.stringify(moved.body).includes('p2-card-6'), false);
});

test('broadcasts each player a private state view after an authorized action', async (t) => {
  const { app, baseUrl } = await startServer();
  const readers = [];
  t.after(async () => {
    for (const reader of readers) await reader.cancel();
    await stopServer(app);
  });

  const created = await request(baseUrl, '/api/rooms');
  const joined = await request(baseUrl, `/api/rooms/${created.body.roomId}/join`);
  await request(baseUrl, `/api/rooms/${created.body.roomId}/start`, {
    playerId: 'p1', token: created.body.token,
  });
  const p1Events = await fetch(`${baseUrl}/api/rooms/${created.body.roomId}/events?playerId=p1&token=${created.body.token}`);
  const p2Events = await fetch(`${baseUrl}/api/rooms/${created.body.roomId}/events?playerId=p2&token=${joined.body.token}`);
  readers.push(p1Events.body.getReader(), p2Events.body.getReader());
  await readSseEvent(readers[0]);
  await readSseEvent(readers[1]);

  await request(baseUrl, `/api/rooms/${created.body.roomId}/action`, {
    playerId: 'p1',
    token: created.body.token,
    type: 'move',
    cardId: 'p1-card-1',
    path: [{ row: 0, col: 1 }],
  });
  const p1Update = await readSseEvent(readers[0]);
  const p2Update = await readSseEvent(readers[1]);

  assert.deepEqual(p1Update.players.find((player) => player.id === 'p1').position, { row: 0, col: 1 });
  assert.deepEqual(p2Update.players.find((player) => player.id === 'p1').position, { row: 0, col: 1 });
  assert.equal(JSON.stringify(p1Update).includes('p2-card-6'), false);
  assert.equal(JSON.stringify(p2Update).includes('p1-card-1'), false);
});
