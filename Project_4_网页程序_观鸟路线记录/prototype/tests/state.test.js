const test = require('node:test');
const assert = require('node:assert/strict');
const state = require('../js/state.js');

test('recording starts from a selected point and stores it as the first track point', () => {
  const session = state.createSession(new Date('2026-06-09T10:00:00.000Z'));
  const picking = state.beginStartSelection(session);
  const recording = state.confirmStartPoint(
    picking,
    { lat: 31.2304, lng: 121.4737, label: '起点' },
    new Date('2026-06-09T10:01:00.000Z'),
  );

  assert.equal(recording.state, state.STATES.RECORDING);
  assert.equal(recording.track.length, 1);
  assert.deepEqual(recording.startPoint, recording.track[0]);
});

test('recording appends simulated walking points and accumulates distance', () => {
  let session = state.confirmStartPoint(
    state.beginStartSelection(state.createSession()),
    { lat: 31.2304, lng: 121.4737 },
  );

  session = state.addTrackPoint(session, { lat: 31.231, lng: 121.4742 });
  session = state.addTrackPoint(session, { lat: 31.232, lng: 121.475 });

  assert.equal(session.track.length, 3);
  assert.ok(session.distanceMeters > 0);
  assert.equal(state.summarizeSession(session).trackPointCount, 3);
});

test('finished sessions keep their track and no longer accept new track points', () => {
  let session = state.confirmStartPoint(
    state.beginStartSelection(state.createSession()),
    { lat: 31.2304, lng: 121.4737 },
  );
  session = state.addTrackPoint(session, { lat: 31.231, lng: 121.4742 });
  const finished = state.finishSession(session, new Date('2026-06-09T10:20:00.000Z'));
  const unchanged = state.addTrackPoint(finished, { lat: 31.24, lng: 121.48 });

  assert.equal(finished.state, state.STATES.FINISHED);
  assert.equal(unchanged.track.length, 2);
});

test('aborted sessions discard the current route data', () => {
  let session = state.confirmStartPoint(
    state.beginStartSelection(state.createSession()),
    { lat: 31.2304, lng: 121.4737 },
  );
  session = state.addTrackPoint(session, { lat: 31.231, lng: 121.4742 });
  const aborted = state.abortSession(session, new Date('2026-06-09T10:12:00.000Z'));

  assert.equal(aborted.state, state.STATES.ABORTED);
  assert.equal(aborted.track.length, 0);
  assert.equal(aborted.startPoint, null);
  assert.equal(aborted.currentPoint, null);
});

test('bird records attach to the current route position while recording', () => {
  let session = state.confirmStartPoint(
    state.beginStartSelection(state.createSession()),
    { lat: 31.2304, lng: 121.4737 },
  );
  session = state.addTrackPoint(session, { lat: 31.231, lng: 121.4742 });

  const withBird = state.addBirdRecord(session, {
    speciesName: '白头鹎',
    scientificName: 'Pycnonotus sinensis',
    count: 2,
    tags: ['成鸟', '飞行'],
    note: '树梢附近',
  });

  assert.equal(withBird.birdRecords.length, 1);
  assert.equal(withBird.birdRecords[0].speciesName, '白头鹎');
  assert.deepEqual(withBird.birdRecords[0].position, session.currentPoint);
  assert.equal(state.summarizeSession(withBird).speciesCount, 1);
  assert.equal(state.summarizeSession(withBird).totalBirds, 2);
});

test('bird records can be edited without changing their route position', () => {
  let session = state.confirmStartPoint(
    state.beginStartSelection(state.createSession()),
    { lat: 31.2304, lng: 121.4737 },
  );
  session = state.addBirdRecord(session, {
    speciesName: '白头鹎',
    scientificName: 'Pycnonotus sinensis',
    count: 1,
    tags: ['成鸟'],
    note: '',
  }, new Date('2026-06-10T01:00:00.000Z'));
  const originalPosition = session.birdRecords[0].position;

  const edited = state.updateBirdRecord(session, session.birdRecords[0].id, {
    speciesName: '麻雀',
    scientificName: 'Passer montanus',
    count: 3,
    tags: ['飞行'],
    note: '低空飞过',
  });

  assert.equal(edited.birdRecords[0].speciesName, '麻雀');
  assert.equal(edited.birdRecords[0].count, 3);
  assert.deepEqual(edited.birdRecords[0].position, originalPosition);
  assert.equal(state.summarizeSession(edited).totalBirds, 3);
});

test('bird records can be deleted and summary counts update', () => {
  let session = state.confirmStartPoint(
    state.beginStartSelection(state.createSession()),
    { lat: 31.2304, lng: 121.4737 },
  );
  session = state.addBirdRecord(session, {
    speciesName: '白头鹎',
    scientificName: 'Pycnonotus sinensis',
    count: 2,
  }, new Date('2026-06-10T01:00:00.000Z'));

  const deleted = state.deleteBirdRecord(session, session.birdRecords[0].id);

  assert.equal(deleted.birdRecords.length, 0);
  assert.equal(state.summarizeSession(deleted).speciesCount, 0);
  assert.equal(state.summarizeSession(deleted).totalBirds, 0);
});
