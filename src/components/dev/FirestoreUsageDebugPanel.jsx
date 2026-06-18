import { useEffect, useState } from 'react';
import { getFirestoreDebugSession } from '../../utils/firestoreDebug.js';

export default function FirestoreUsageDebugPanel() {
  const [session, setSession] = useState(getFirestoreDebugSession());

  useEffect(() => {
    const timer = setInterval(() => {
      setSession(getFirestoreDebugSession());
    }, 1500);
    return () => clearInterval(timer);
  }, []);

  const repeated = Object.entries(session.queryCounts)
    .filter(([, count]) => count > 3)
    .sort((a, b) => b[1] - a[1]);

  return (
    <aside className="firestore-debug-panel" aria-label="Firestore debug">
      <strong>Firestore (DEV)</strong>
      <div>Leituras: {session.reads}</div>
      <div>Escritas: {session.writes}</div>
      {repeated.length > 0 ? (
        <div className="firestore-debug-alert">
          Queries repetidas: {repeated.map(([label, count]) => `${label} (${count})`).join(', ')}
        </div>
      ) : null}
      <ul>
        {session.queries.slice(-8).reverse().map((item, idx) => (
          <li key={`${item.at}-${idx}`}>
            [{item.type}] {item.label}
            {item.count ? ` (~${item.count})` : ''}
          </li>
        ))}
      </ul>
    </aside>
  );
}
