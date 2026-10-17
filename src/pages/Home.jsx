import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_URL, formatDate } from '../api';

export default function Home() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/events`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load events');
        return res.json();
      })
      .then((data) => setEvents(data.events))
      .catch(() => setError('Could not load events. Is the server running?'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <section className="px-8 py-20 text-center">
        <p className="mb-4 text-purple-400">YOUR NEXT EXPERIENCE STARTS HERE</p>
        <h2 className="mx-auto max-w-3xl text-5xl font-bold">
          Discover Events. Buy Tickets. Make Memories.
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-gray-400">
          Find the hottest parties and events around you. Secure your ticket and
          get ready for an unforgettable experience.
        </p>
        <a
          href="#events"
          className="mt-8 inline-block rounded-lg bg-purple-600 px-8 py-3 font-semibold hover:bg-purple-700"
        >
          Explore Events
        </a>
      </section>

      <section id="events" className="mx-auto max-w-5xl px-8 pb-24">
        <h3 className="mb-6 text-2xl font-bold">Upcoming events</h3>

        {loading && <p className="text-gray-400">Loading events...</p>}
        {error && <p className="text-red-400">{error}</p>}
        {!loading && !error && events.length === 0 && (
          <p className="text-gray-400">No upcoming events yet.</p>
        )}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <Link
              key={event.id}
              to={`/events/${event.id}`}
              className="rounded-xl border border-gray-800 bg-gray-900 p-6 transition hover:border-purple-500"
            >
              <p className="text-sm text-purple-400">{formatDate(event.startsAt)}</p>
              <h4 className="mt-2 text-xl font-semibold">{event.title}</h4>
              <p className="mt-1 text-gray-400">{event.venue}</p>
              {event.reentryEnabled && (
                <span className="mt-3 inline-block rounded-full bg-purple-900 px-3 py-1 text-xs text-purple-300">
                  Re-entry allowed
                </span>
              )}
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}