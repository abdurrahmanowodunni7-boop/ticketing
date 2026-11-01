import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { API_URL, formatDate } from '../api';
import { useAuth } from '../auth.jsx';

function TicketCard({ ticket, eventTitle }) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    QRCode.toDataURL(ticket.qrToken, { width: 280, margin: 2 }).then(setSrc);
  }, [ticket.qrToken]);

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 text-center">
      <p className="text-sm text-purple-400">{eventTitle}</p>
      <p className="mt-1 text-lg font-semibold">{ticket.type}</p>
      <p className="text-gray-400">{ticket.attendeeName}</p>
      {src && <img src={src} alt="Ticket QR code" className="mx-auto mt-4 rounded-lg bg-white" />}
      {ticket.used ? (
        <p className="mt-3 text-sm font-semibold text-red-400">Already used</p>
      ) : (
        <p className="mt-3 text-xs text-gray-500">Show this QR code at the entrance</p>
      )}
    </div>
  );
}

export default function Tickets() {
  const { orderId } = useParams();
  const { token, logout } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/tickets/order/${orderId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (res.status === 401) {
          logout();
          throw new Error('Please log in again.');
        }
        const body = await res.json();
        if (res.status === 409) throw new Error('Payment not confirmed yet. Refresh in a moment.');
        if (!res.ok) throw new Error(body.error || 'Could not load tickets');
        return body;
      })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, token]);

  if (!token) return <Navigate to="/login" state={{ from: `/tickets/${orderId}` }} replace />;
  if (loading) return <p className="px-8 py-16 text-gray-400">Loading your tickets...</p>;
  if (error) {
    return (
      <div className="px-8 py-16">
        <p className="text-red-400">{error}</p>
        <Link to="/my-tickets" className="mt-4 inline-block text-purple-400 hover:underline">My tickets</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-12">
      <Link to="/my-tickets" className="text-sm text-purple-400 hover:underline">← My tickets</Link>
      <h2 className="mt-4 text-3xl font-bold">Your tickets</h2>
      <p className="mt-2 text-gray-400">
        {data.event.title} · {data.event.venue} · {formatDate(data.event.startsAt)}
      </p>
      <p className="mt-4 rounded-lg bg-gray-900 p-4 text-sm text-gray-300">
        Each ticket can be scanned once. Once it has been scanned, it cannot be used again.
      </p>
      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {data.tickets.map((t) => (
          <TicketCard key={t.id} ticket={t} eventTitle={data.event.title} />
        ))}
      </div>
    </div>
  );
}