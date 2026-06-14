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

test('finished sessions can be converted into a stable result snapshot', () => {
  let session = state.confirmStartPoint(
    state.beginStartSelection(state.createSession(new Date('2026-06-10T01:00:00.000Z'))),
    { lat: 31.2304, lng: 121.4737, label: '上海' },
    new Date('2026-06-10T01:05:00.000Z'),
  );
  session = state.addTrackPoint(session, { lat: 31.231, lng: 121.4742 });
  session = state.addBirdRecord(session, {
    speciesName: '白头鹎',
    scientificName: 'Pycnonotus sinensis',
    count: 2,
    tags: ['成鸟'],
    note: '树梢鸣叫',
  }, new Date('2026-06-10T01:08:00.000Z'));
  const finished = state.finishSession(session, new Date('2026-06-10T01:30:00.000Z'));

  const result = state.createSessionResult(finished);

  assert.equal(result.title, '本次记录');
  assert.equal(result.summary.speciesCount, 1);
  assert.equal(result.summary.totalBirds, 2);
  assert.equal(result.summary.durationMinutes, 25);
  assert.equal(result.track.length, 2);
  assert.equal(result.birdRecords.length, 1);
  assert.notEqual(result.track, finished.track);
  assert.notEqual(result.birdRecords, finished.birdRecords);
});

test('finished sessions can be converted into a stable history record snapshot', () => {
  let session = state.confirmStartPoint(
    state.beginStartSelection(state.createSession(new Date('2026-06-10T01:00:00.000Z'))),
    { lat: 31.2304, lng: 121.4737, label: '上海' },
    new Date('2026-06-10T01:05:00.000Z'),
  );
  session = state.addTrackPoint(session, { lat: 31.231, lng: 121.4742 });
  session = state.addBirdRecord(session, {
    speciesName: '白头鹎',
    scientificName: 'Pycnonotus sinensis',
    count: 2,
    tags: ['成鸟'],
    note: '树梢鸣叫',
  }, new Date('2026-06-10T01:08:00.000Z'));
  const finished = state.finishSession(session, new Date('2026-06-10T01:30:00.000Z'));

  const historyRecord = state.createHistoryRecord(finished, new Date('2026-06-10T01:31:00.000Z'));

  assert.equal(historyRecord.title, '本次记录');
  assert.equal(historyRecord.savedAt, '2026-06-10T01:31:00.000Z');
  assert.equal(historyRecord.summary.speciesCount, 1);
  assert.equal(historyRecord.summary.totalBirds, 2);
  assert.equal(historyRecord.summary.durationMinutes, 25);
  assert.equal(historyRecord.track.length, 2);
  assert.equal(historyRecord.birdRecords.length, 1);
  assert.notEqual(historyRecord.track, finished.track);
  assert.notEqual(historyRecord.birdRecords, finished.birdRecords);
});

test('unfinished sessions do not create history records', () => {
  const session = state.confirmStartPoint(
    state.beginStartSelection(state.createSession()),
    { lat: 31.2304, lng: 121.4737 },
  );

  assert.equal(state.createHistoryRecord(session), null);
});

test('history records are deduplicated by id and sorted by newest saved time', () => {
  const older = {
    id: 'record-older',
    savedAt: '2026-06-10T01:00:00.000Z',
    title: '旧记录',
    summary: { totalBirds: 1 },
  };
  const newer = {
    id: 'record-newer',
    savedAt: '2026-06-10T02:00:00.000Z',
    title: '新记录',
    summary: { totalBirds: 2 },
  };
  const duplicateOlder = {
    ...older,
    savedAt: '2026-06-10T03:00:00.000Z',
    summary: { totalBirds: 3 },
  };

  const history = state.addHistoryRecord(
    state.addHistoryRecord(
      state.addHistoryRecord([], older),
      newer,
    ),
    duplicateOlder,
  );

  assert.deepEqual(history.map((record) => record.id), ['record-older', 'record-newer']);
  assert.equal(history[0].summary.totalBirds, 3);
});

test('history records can be found by id', () => {
  const history = [
    { id: 'record-a', title: 'A' },
    { id: 'record-b', title: 'B' },
  ];

  assert.deepEqual(state.findHistoryRecord(history, 'record-b'), history[1]);
  assert.equal(state.findHistoryRecord(history, 'record-missing'), null);
});

test('old history records default to not favorite', () => {
  assert.equal(state.isHistoryRecordFavorite({ id: 'record-old' }), false);
  assert.equal(state.isHistoryRecordFavorite({ id: 'record-favorite', isFavorite: true }), true);
  assert.equal(state.isHistoryRecordFavorite({ id: 'record-explicit-false', isFavorite: false }), false);
});

test('history favorite toggles update a single record without changing list order', () => {
  const a = { id: 'a', savedAt: '2026-06-10T03:00:00.000Z' };
  const b = { id: 'b', savedAt: '2026-06-10T02:00:00.000Z' };
  const history = [a, b];

  const favorited = state.toggleHistoryFavorite(history, 'b');
  assert.deepEqual(favorited.map((record) => record.id), ['a', 'b']);
  assert.equal(state.findHistoryRecord(favorited, 'b').isFavorite, true);
  assert.equal(state.findHistoryRecord(favorited, 'a').isFavorite, undefined);

  const unfavorited = state.toggleHistoryFavorite(favorited, 'b');
  assert.equal(state.findHistoryRecord(unfavorited, 'b').isFavorite, false);
});

test('favoriteHistoryRecords returns only favorited records in existing order', () => {
  const history = [
    { id: 'a', isFavorite: true },
    { id: 'b' },
    { id: 'c', isFavorite: true },
  ];

  assert.deepEqual(state.favoriteHistoryRecords(history).map((record) => record.id), ['a', 'c']);
  assert.deepEqual(state.favoriteHistoryRecords(null), []);
});

test('deleting a favorited history record removes it from favorite results', () => {
  const history = [
    { id: 'a', isFavorite: true },
    { id: 'b', isFavorite: true },
  ];

  const next = state.deleteHistoryRecord(history, 'a');

  assert.deepEqual(state.favoriteHistoryRecords(next).map((record) => record.id), ['b']);
});

test('replaceHistoryRecord swaps a record by id while preserving list order', () => {
  const a = { id: 'a', savedAt: '2026-06-10T03:00:00.000Z', summary: { totalBirds: 1 } };
  const b = { id: 'b', savedAt: '2026-06-10T02:00:00.000Z', summary: { totalBirds: 2 } };
  const history = [a, b];
  const updatedB = { ...b, summary: { totalBirds: 9 } };

  const next = state.replaceHistoryRecord(history, updatedB);

  assert.deepEqual(next.map((record) => record.id), ['a', 'b']);
  assert.equal(next[1].summary.totalBirds, 9);
  assert.notEqual(next, history);
});

test('deleteHistoryRecord removes a record by id', () => {
  const history = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  const next = state.deleteHistoryRecord(history, 'b');

  assert.deepEqual(next.map((record) => record.id), ['a', 'c']);
});

test('updateBirdRecordPosition moves only the targeted record position', () => {
  const container = {
    birdRecords: [
      { id: 'a', speciesName: '白头鹎', count: 2, position: { lat: 31.2, lng: 121.4, label: '点A', timestamp: 't1' } },
      { id: 'b', speciesName: '麻雀', count: 1, position: { lat: 31.3, lng: 121.5, label: '点B', timestamp: 't2' } },
    ],
  };

  const next = state.updateBirdRecordPosition(container, 'a', { lat: 31.25, lng: 121.45 });

  assert.equal(next.birdRecords[0].position.lat, 31.25);
  assert.equal(next.birdRecords[0].position.lng, 121.45);
  assert.equal(next.birdRecords[0].position.label, '点A');
  assert.equal(next.birdRecords[0].speciesName, '白头鹎');
  assert.deepEqual(next.birdRecords[1].position, container.birdRecords[1].position);
});

test('recomputeResultSummary refreshes bird counts but preserves route metrics', () => {
  let session = state.confirmStartPoint(
    state.beginStartSelection(state.createSession(new Date('2026-06-10T01:00:00.000Z'))),
    { lat: 31.2304, lng: 121.4737, label: '上海' },
    new Date('2026-06-10T01:05:00.000Z'),
  );
  session = state.addTrackPoint(session, { lat: 31.231, lng: 121.4742 });
  session = state.addBirdRecord(session, {
    speciesName: '白头鹎', scientificName: 'Pycnonotus sinensis', count: 2,
  }, new Date('2026-06-10T01:08:00.000Z'));
  session = state.addBirdRecord(session, {
    speciesName: '麻雀', scientificName: 'Passer montanus', count: 1,
  }, new Date('2026-06-10T01:09:00.000Z'));
  const finished = state.finishSession(session, new Date('2026-06-10T01:30:00.000Z'));
  const result = state.createSessionResult(finished);

  const edited = {
    ...result,
    birdRecords: result.birdRecords.filter((record) => record.speciesName !== '麻雀'),
  };
  const recomputed = state.recomputeResultSummary(edited);

  assert.equal(recomputed.summary.speciesCount, 1);
  assert.equal(recomputed.summary.totalBirds, 2);
  assert.equal(recomputed.summary.birdRecordCount, 1);
  assert.equal(recomputed.summary.durationMinutes, 25);
  assert.equal(recomputed.summary.distanceMeters, result.summary.distanceMeters);
  assert.equal(recomputed.summary.trackPointCount, result.summary.trackPointCount);
});

test('disabled share import service does not append imported records', () => {
  const history = [{ id: 'record-existing', title: '已有记录' }];
  const incoming = { id: 'record-shared', title: '分享记录' };

  const preview = state.previewSharedRecordImport(history, incoming, {
    serviceEnabled: false,
    duplicateStrategy: 'openExisting',
  });

  assert.equal(preview.status, 'serviceUnavailable');
  assert.equal(preview.record, null);
  assert.equal(preview.duplicateRecord, null);
  assert.deepEqual(preview.history, history);
  assert.equal(history.length, 1);
});

test('duplicate shared record resolves to existing history record without adding a copy', () => {
  const existing = { id: 'record-shared', title: '已有分享记录' };
  const incoming = { id: 'record-shared', title: '再次导入的分享记录' };

  const preview = state.previewSharedRecordImport([existing], incoming, {
    serviceEnabled: true,
    duplicateStrategy: 'openExisting',
  });

  assert.equal(preview.status, 'duplicate');
  assert.deepEqual(preview.duplicateRecord, existing);
  assert.equal(preview.record, null);
  assert.deepEqual(preview.history, [existing]);
});
