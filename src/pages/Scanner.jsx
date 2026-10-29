import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { API_URL } from '../api';

export default function Scanner() {
  const [token, setToken] = useState(() => sessionStorage.getItem('scanToken') || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState('');

  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [cameraError, setCameraError] = useState('');

  const scannerRef = useRef(null);
  const busyRef = useRef(false);
  const eventIdRef = useRef('');
  const tokenRef = useRef(token);

  useEffect(() => { eventIdRef.current = eventId; }, [eventId]);
  useEffect(() => { tokenRef.current = token; }, [token]);

  // Load events once logged in.
  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/events/mine/list`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setEvents(d.events);
        if (d.events[0]) setEventId(d.events[0].id);
      })
      .catch(() => {
        sessionStorage.removeItem('scanToken');
        setToken('');
      });
  }, [token]);

  async function login(e) {
    e.preventDefault();
    setLoginError('');
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) return setLoginError(data.error || 'Login failed');
    sessionStorage.setItem('scanToken', data.token);
    setToken(data.token);
  }

  function logout() {
    stopCamera();
    sessionStorage.removeItem('scanToken');
    setToken('');
  }

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
      setCameraError('Could not open the camera. Allow camera access and use HTTPS or localhost.');
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

  function scanNext() {
    setResult(null);
    busyRef.current = false;
  }

  useEffect(() => () => { stopCamera(); }, []);

  // ---------- Login screen ----------
  if (!token) {
    return (
      <div className="mx-auto max-w-sm px-8 py-16">
        <h2 className="text-3xl font-bold">Staff login</h2>
        <form onSubmit={login} className="mt-6 space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3"
          />
          {loginError && <p className="text-red-400">{loginError}</p>}
          <button className="w-full rounded-lg bg-purple-600 py-3 font-semibold hover:bg-purple-700">
            Log in
          </button>
        </form>
      </div>
    );
  }

  // ---------- Scanner screen ----------
  const good = result?.ok;
  return (
    <div className="mx-auto max-w-md px-6 py-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Scanner</h2>
        <button onClick={logout} className="text-sm text-gray-400 hover:text-white">Log out</button>
      </div>

      <select
        value={eventId}
        onChange={(e) => setEventId(e.target.value)}
        disabled={scanning}
        className="mt-4 w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3"
      >
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