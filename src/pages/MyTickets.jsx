import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { API_URL, formatDate, formatNaira } from '../api';
import { useAuth } from '../auth.jsx';

export default function MyTickets() {
  const { token, logout } = useAuth();
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/tickets/mine`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (res.status === 401) {
          logout();
          throw new Error('Please log in again.');
        }
        if (!res.ok) throw new Error('Could not load your tickets.');
        return res.json();
      })
      .then((d) => setOrders(d.orders))
      .catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!token) return <Navigate to="/login" state={{ from: '/my-tickets' }} replace />;
  if (error) return <p className="px-8 py-16 text-red-400">{error}</p>;
  if (!orders) return <p className="px-8 py-16 text-gray-400">Loading your tickets...</p>;

  return (
    <div className="mx-auto max-w-3xl px-8 py-12">
      <h2 className="text-3xl font-bold">My tickets</h2>
      {orders.length === 0 && (
        <p className="mt-6 text-gray-400">
          You have no tickets yet.{' '}
          <Link to="/" className="text-purple-400 hover:underline">Browse events</Link>
        </p>
      )}
      <div className="mt-6 space-y-4">
        {orders.map((o) => (
          <Link
            key={o.id}
            to={`/tickets/${o.id}`}
            className="block rounded-xl border border-gray-800 bg-gray-900 p-5 transition hover:border-purple-500"
          >
            <p className="text-lg font-semibold">{o.event.title}</p>
            <p className="text-gray-400">{o.event.venue} · {formatDate(o.event.startsAt)}</p>
            <p className="mt-2 text-sm text-purple-400">
              {o.ticketCount} ticket{o.ticketCount === 1 ? '' : 's'} · paid {formatNaira(o.totalKobo)}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}