(function attachState(root) {
  const STATES = {
    IDLE: 'idle',
    PICKING_START: 'pickingStart',
    RECORDING: 'recording',
    FINISHED: 'finished',
    ABORTED: 'aborted',
  };

  function clonePoint(point) {
    return {
      lat: Number(point.lat),
      lng: Number(point.lng),
      label: point.label || '',
      timestamp: point.timestamp || new Date().toISOString(),
    };
  }

  function createSession(now = new Date()) {
    return {
      state: STATES.IDLE,
      startedAt: null,
      endedAt: null,
      startPoint: null,
      currentPoint: null,
      track: [],
      birdRecords: [],
      distanceMeters: 0,
      createdAt: now.toISOString(),
    };
  }

  function beginStartSelection(session) {
    return {
      ...session,
      state: STATES.PICKING_START,
    };
  }

  function confirmStartPoint(session, point, now = new Date()) {
    const startPoint = clonePoint(point);
    return {
      ...session,
      state: STATES.RECORDING,
      startedAt: now.toISOString(),
      startPoint,
      currentPoint: startPoint,
      track: [startPoint],
      distanceMeters: 0,
    };
  }

  function addTrackPoint(session, point) {
    if (session.state !== STATES.RECORDING) {
      return session;
    }

    const nextPoint = clonePoint(point);
    const previousPoint = session.currentPoint || session.track[session.track.length - 1];
    const extraDistance = previousPoint ? distanceBetween(previousPoint, nextPoint) : 0;

    return {
      ...session,
      currentPoint: nextPoint,
      track: [...session.track, nextPoint],
      distanceMeters: session.distanceMeters + extraDistance,
    };
  }

  function finishSession(session, now = new Date()) {
    if (session.state !== STATES.RECORDING) {
      return session;
    }

    return {
      ...session,
      state: STATES.FINISHED,
      endedAt: now.toISOString(),
    };
  }

  function addBirdRecord(session, record, now = new Date()) {
    if (session.state !== STATES.RECORDING || !session.currentPoint) {
      return session;
    }

    const birdRecord = {
      id: `bird-${now.getTime()}-${session.birdRecords.length + 1}`,
      speciesName: record.speciesName,
      scientificName: record.scientificName || '',
      count: Math.max(1, Number(record.count) || 1),
      tags: Array.isArray(record.tags) ? [...record.tags] : [],
      note: record.note || '',
      position: clonePoint(session.currentPoint),
      createdAt: now.toISOString(),
    };

    return {
      ...session,
      birdRecords: [...session.birdRecords, birdRecord],
    };
  }

  function updateBirdRecord(session, recordId, patch) {
    return {
      ...session,
      birdRecords: session.birdRecords.map((record) => {
        if (record.id !== recordId) {
          return record;
        }

        return {
          ...record,
          speciesName: patch.speciesName || record.speciesName,
          scientificName: patch.scientificName || '',
          count: Math.max(1, Number(patch.count) || record.count),
          tags: Array.isArray(patch.tags) ? [...patch.tags] : record.tags,
          note: patch.note || '',
        };
      }),
    };
  }

  function deleteBirdRecord(session, recordId) {
    return {
      ...session,
      birdRecords: session.birdRecords.filter((record) => record.id !== recordId),
    };
  }

  function abortSession(session, now = new Date()) {
    return {
      ...createSession(now),
      state: STATES.ABORTED,
      endedAt: now.toISOString(),
    };
  }

  function summarizeSession(session) {
    const species = new Set(session.birdRecords.map((record) => record.speciesName));
    const totalBirds = session.birdRecords.reduce((total, record) => total + record.count, 0);

    return {
      state: session.state,
      trackPointCount: session.track.length,
      birdRecordCount: session.birdRecords.length,
      speciesCount: species.size,
      totalBirds,
      distanceMeters: Math.round(session.distanceMeters),
    };
  }

  function createSessionResult(session) {
    if (session.state !== STATES.FINISHED) {
      return null;
    }

    const summary = summarizeSession(session);
    const startedAt = session.startedAt ? new Date(session.startedAt) : null;
    const endedAt = session.endedAt ? new Date(session.endedAt) : null;
    const durationMinutes = startedAt && endedAt
      ? Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000))
      : 0;

    return {
      title: '本次记录',
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      startPoint: session.startPoint ? clonePoint(session.startPoint) : null,
      currentPoint: session.currentPoint ? clonePoint(session.currentPoint) : null,
      track: session.track.map(clonePoint),
      birdRecords: session.birdRecords.map((record) => ({
        ...record,
        tags: [...record.tags],
        position: clonePoint(record.position),
      })),
      summary: {
        ...summary,
        durationMinutes,
      },
    };
  }

  function createHistoryRecord(session, now = new Date()) {
    const result = createSessionResult(session);
    if (!result) {
      return null;
    }

    return {
      ...result,
      id: historyRecordId(result),
      savedAt: now.toISOString(),
    };
  }

  function addHistoryRecord(history, record) {
    if (!record || !record.id) {
      return Array.isArray(history) ? [...history] : [];
    }

    return [
      record,
      ...(Array.isArray(history) ? history.filter((item) => item && item.id !== record.id) : []),
    ].sort((a, b) => timestampValue(b.savedAt) - timestampValue(a.savedAt));
  }

  function findHistoryRecord(history, id) {
    if (!Array.isArray(history)) {
      return null;
    }

    return history.find((record) => record && record.id === id) || null;
  }

  function historyRecordId(result) {
    const start = result.startedAt || 'unknown-start';
    const end = result.endedAt || 'unknown-end';
    const startPoint = result.startPoint
      ? `${result.startPoint.lat.toFixed(6)},${result.startPoint.lng.toFixed(6)}`
      : 'unknown-point';

    return `history-${start}-${end}-${startPoint}`;
  }

  function timestampValue(value) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function distanceBetween(a, b) {
    const earthRadiusMeters = 6371000;
    const toRadians = (value) => (value * Math.PI) / 180;
    const deltaLat = toRadians(b.lat - a.lat);
    const deltaLng = toRadians(b.lng - a.lng);
    const lat1 = toRadians(a.lat);
    const lat2 = toRadians(b.lat);
    const sinLat = Math.sin(deltaLat / 2);
    const sinLng = Math.sin(deltaLng / 2);
    const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;

    return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  const api = {
    STATES,
    createSession,
    beginStartSelection,
    confirmStartPoint,
    addTrackPoint,
    addBirdRecord,
    updateBirdRecord,
    deleteBirdRecord,
    finishSession,
    abortSession,
    summarizeSession,
    createSessionResult,
    createHistoryRecord,
    addHistoryRecord,
    findHistoryRecord,
    distanceBetween,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.BirdRouteState = api;
})(typeof window !== 'undefined' ? window : globalThis);
