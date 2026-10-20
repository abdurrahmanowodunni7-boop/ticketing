import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { API_URL, formatDate } from '../api';

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
      <p className="mt-3 text-xs text-gray-500">Show this QR code at the entrance</p>
    </div>
  );
}

export default function Tickets() {
  const { orderId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/tickets/order/${orderId}`)
      .then(async (res) => {
        const body = await res.json();
        if (res.status === 409) throw new Error('Payment not confirmed yet. Refresh in a moment.');
        if (!res.ok) throw new Error(body.error || 'Could not load tickets');
        return body;
      })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [orderId]);

  if (loading) return <p className="px-8 py-16 text-gray-400">Loading your tickets...</p>;
  if (error) {
    return (
      <div className="px-8 py-16">
        <p className="text-red-400">{error}</p>
        <Link to="/" className="mt-4 inline-block text-purple-400 hover:underline">Back to events</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-12">
      <h2 className="text-3xl font-bold">Your tickets</h2>
      <p className="mt-2 text-gray-400">
        {data.event.title} · {data.event.venue} · {formatDate(data.event.startsAt)}
      </p>
      {data.event.reentryEnabled && (
        <p className="mt-4 rounded-lg bg-gray-900 p-4 text-sm text-gray-300">
          Re-entry is allowed (up to {data.event.maxReentries} times). Keep your wristband and bring this QR code.
        </p>
      )}
      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {data.tickets.map((t) => (
          <TicketCard key={t.id} ticket={t} eventTitle={data.event.title} />
        ))}
      </div>
    </div>
  );
}