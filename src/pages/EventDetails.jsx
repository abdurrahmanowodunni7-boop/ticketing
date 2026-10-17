import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { API_URL, formatDate, formatNaira } from '../api';

export default function EventDetails() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/events/${id}`)
      .then((res) => {
        if (res.status === 404) throw new Error('notfound');
        if (!res.ok) throw new Error('failed');
        return res.json();
      })
      .then((data) => setEvent(data.event))
      .catch((err) =>
        setError(err.message === 'notfound' ? 'Event not found.' : 'Could not load this event.')
      )
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="px-8 py-16 text-gray-400">Loading...</p>;
  if (error) {
    return (
      <div className="px-8 py-16">
        <p className="text-red-400">{error}</p>
        <Link to="/" className="mt-4 inline-block text-purple-400 hover:underline">
          Back to events
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-12">
      <Link to="/" className="text-sm text-purple-400 hover:underline">
        ← All events
      </Link>

      <h2 className="mt-4 text-4xl font-bold">{event.title}</h2>
      <p className="mt-2 text-purple-400">{formatDate(event.startsAt)}</p>
      <p className="text-gray-400">{event.venue}</p>

      {event.description && <p className="mt-6 text-gray-300">{event.description}</p>}

      <p className="mt-6 rounded-lg bg-gray-900 p-4 text-sm text-gray-300">
        {event.reentryEnabled
          ? `Re-entry is allowed (up to ${event.maxReentries} times). Keep your wristband and bring your QR ticket.`
          : 'Re-entry is not allowed at this event. Once you leave, you cannot return.'}
      </p>

      <h3 className="mb-4 mt-10 text-2xl font-bold">Tickets</h3>
      <div className="space-y-4">
        {event.ticketTypes.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900 p-5"
          >
            <div>
              <p className="text-lg font-semibold">{t.name}</p>
              <p className="text-sm text-gray-400">
                {t.remaining > 0 ? `${t.remaining} left` : 'Sold out'}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <p className="text-xl font-bold">{t.priceKobo === 0 ? 'Free' : formatNaira(t.priceKobo)}</p>
              <button
                disabled={t.remaining === 0}
                className="rounded-lg bg-purple-600 px-5 py-2 font-semibold hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-gray-700"
              >
                Buy
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}