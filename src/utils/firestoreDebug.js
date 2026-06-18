const session = {
  reads: 0,
  writes: 0,
  queries: [],
  queryCounts: {},
};

const isDev = () => import.meta.env.DEV;

export const resetFirestoreDebugSession = () => {
  session.reads = 0;
  session.writes = 0;
  session.queries = [];
  session.queryCounts = {};
};

export const getFirestoreDebugSession = () => ({
  reads: session.reads,
  writes: session.writes,
  queries: [...session.queries],
  queryCounts: { ...session.queryCounts },
});

export const logFirestoreRead = (label, estimatedCount = 1) => {
  if (!isDev()) return;
  const count = Math.max(0, Number(estimatedCount) || 0);
  session.reads += count;
  session.queries.push({ type: 'read', label, count, at: Date.now() });
  session.queryCounts[label] = (session.queryCounts[label] || 0) + 1;
  console.debug(`[Firestore READ] ${label} (~${count})`);
};

export const logFirestoreWrite = (label, estimatedCount = 1) => {
  if (!isDev()) return;
  const count = Math.max(0, Number(estimatedCount) || 0);
  session.writes += count;
  session.queries.push({ type: 'write', label, count, at: Date.now() });
  session.queryCounts[label] = (session.queryCounts[label] || 0) + 1;
  console.debug(`[Firestore WRITE] ${label} (~${count})`);
};

export const logFirestoreQuery = (label, params = {}) => {
  if (!isDev()) return;
  session.queries.push({ type: 'query', label, params, at: Date.now() });
  session.queryCounts[label] = (session.queryCounts[label] || 0) + 1;
  console.debug(`[Firestore QUERY] ${label}`, params);
};
