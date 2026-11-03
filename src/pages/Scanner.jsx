import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { API_URL } from '../api';
import { useAuth } from '../auth.jsx';

export default function Scanner() {
  const { token, logout } = useAuth();

  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState('');
  const [loadError, setLoadError] = useState('');

  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [manualToken, setManualToken] = useState('');

  const scannerRef = useRef(null);
  const busyRef = useRef(false);
  const eventIdRef = useRef('');
  const tokenRef = useRef(token);

  useEffect(() => { eventIdRef.current = eventId; }, [eventId]);
  useEffect(() => { tokenRef.current = token; }, [token]);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/scan/events`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (r.status === 401) {
          logout();
          throw new Error('Please log in again.');
        }
        if (r.status === 403) throw new Error('This account cannot scan tickets.');
        if (!r.ok) throw new Error('Could not load events.');
        return r.json();
      })
      .then((d) => {
        setEvents(d.events);
        if (d.events[0]) setEventId(d.events[0].id);
      })
      .catch((err) => setLoadError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleScan(text) {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const res = await fetch(`${API_URL}/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenRef.current}`,
        },
        body: JSON.stringify({ eventId: eventIdRef.current, token: text }),
      });
      const data = await res.json();
      setResult(res.ok ? data : { ok: false, result: 'ERROR', message: data.error || 'Scan failed' });
    } catch {
      setResult({ ok: false, result: 'ERROR', message: 'Could not reach the server' });
    }
    // busyRef stays true until staff taps "Scan next".
  }

  async function startCamera() {
    setCameraError('');
    setResult(null);
    busyRef.current = false;
    try {
      const qr = new Html5Qrcode('qr-reader');
      scannerRef.current = qr;
      await qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 250 },
        (text) => handleScan(text),
        () => {}
      );
      setScanning(true);
    } catch {
      setCameraError('Could not open the camera. Allow camera access, and use HTTPS or localhost.');
    }
  }

  async function stopCamera() {
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      }
    } catch {}
    scannerRef.current = null;
    setScanning(false);
  }

  function checkManual() {
    const text = manualToken.trim();
    if (!text) return;
    busyRef.current = false;
    handleScan(text);
    setManualToken('');
  }

  function scanNext() {
    setResult(null);
    busyRef.current = false;
  }

  useEffect(() => () => { stopCamera(); }, []);

  if (!token) return <Navigate to="/login" state={{ from: '/scan' }} replace />;

  const good = result?.ok;
  return (
    <div className="mx-auto max-w-md px-6 py-8">
      <h2 className="text-2xl font-bold">Scanner</h2>

      {loadError && <p className="mt-4 text-red-400">{loadError}</p>}

      <select
        value={eventId}
        onChange={(e) => setEventId(e.target.value)}
        disabled={scanning}
        className="mt-4 w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3"
      >
        {events.length === 0 && <option value="">No events found</option>}
        {events.map((ev) => (
          <option key={ev.id} value={ev.id}>{ev.title}</option>
        ))}
      </select>

      <div id="qr-reader" className="mt-4 overflow-hidden rounded-lg" />
      {cameraError && <p className="mt-3 text-red-400">{cameraError}</p>}

      {!scanning ? (
        <button
          onClick={startCamera}
          disabled={!eventId}
          className="mt-4 w-full rounded-lg bg-purple-600 py-3 font-semibold hover:bg-purple-700 disabled:bg-gray-700"
        >
          Start camera
        </button>
      ) : (
        <button onClick={stopCamera} className="mt-4 w-full rounded-lg bg-gray-700 py-3 font-semibold">
          Stop camera
        </button>
      )}

      <div className="mt-8 border-t border-gray-800 pt-6">
        <p className="mb-2 text-sm text-gray-400">Camera not working? Paste the ticket code:</p>
        <input
          value={manualToken}
          onChange={(e) => setManualToken(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') checkManual(); }}
          placeholder="Ticket code"
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3"
        />
        <button
          onClick={checkManual}
          disabled={!eventId || !manualToken.trim()}
          className="mt-2 w-full rounded-lg bg-gray-700 py-3 font-semibold disabled:opacity-50"
        >
          Check ticket
        </button>
      </div>

      {result && (
        <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center p-8 text-center ${good ? 'bg-green-600' : 'bg-red-600'}`}>
          <p className="text-5xl font-extrabold">
            {good ? 'ADMITTED' : result.result === 'ALREADY_USED' ? 'ALREADY USED' : 'REFUSED'}
          </p>
          <p className="mt-4 text-xl">{result.message}</p>
          {result.attendeeName && (
            <p className="mt-2 text-lg">{result.attendeeName} · {result.type}</p>
          )}
          {result.firstAdmittedAt && (
            <p className="mt-2">First entry: {new Date(result.firstAdmittedAt).toLocaleTimeString()}</p>
          )}
          <button onClick={scanNext} className="mt-8 rounded-lg bg-white px-8 py-3 font-bold text-gray-900">
            Scan next
          </button>
        </div>
      )}
    </div>
  );
}