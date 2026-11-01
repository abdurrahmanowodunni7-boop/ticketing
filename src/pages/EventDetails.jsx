import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { API_URL, formatDate, formatNaira } from '../api';
import { useAuth } from '../auth.jsx';

export default function EventDetails() {
  const { id } = useParams();
  const location = useLocation();
  const { user, token, logout } = useAuth();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [qty, setQty] = useState({});
  const [quote, setQuote] = useState(null);
  const [payError, setPayError] = useState('');
  const [paying, setPaying] = useState(false);

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

  const items = Object.entries(qty)
    .filter(([, q]) => q > 0)
    .map(([ticketTypeId, quantity]) => ({ ticketTypeId, quantity }));
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);

  useEffect(() => {
    if (!event || items.length === 0) {
      setQuote(null);
      return;
    }
    fetch(`${API_URL}/orders/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: event.id, items }),
    })
      .then((r) => r.json())
      .then((d) => setQuote(d.totalKobo ? d : null))
      .catch(() => setQuote(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, JSON.stringify(items)]);

  function change(ticketId, delta, max) {
    setQty((prev) => {
      const next = Math.max(0, Math.min(max, (prev[ticketId] || 0) + delta));
      return { ...prev, [ticketId]: next };
    });
  }

  async function pay() {
    setPayError('');
    setPaying(true);
    try {
      const orderRes = await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ eventId: event.id, items }),
      });
      if (orderRes.status === 401) {
        logout();
        throw new Error('Your session expired. Please log in again.');
      }
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || 'Could not create your order');

      const payRes = await fetch(`${API_URL}/payments/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: orderData.order.id,
          callbackUrl: `${window.location.origin}/payment/callback`,
        }),
      });
      const payData = await payRes.json();
      if (!payRes.ok) throw new Error(payData.error || 'Could not start payment');

      window.location.href = payData.authorizationUrl;
    } catch (err) {
      setPayError(err.message);
      setPaying(false);
    }
  }

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
      <Link to="/" className="text-sm text-purple-400 hover:underline">← All events</Link>

      <h2 className="mt-4 text-4xl font-bold">{event.title}</h2>
      <p className="mt-2 text-purple-400">{formatDate(event.startsAt)}</p>
      <p className="text-gray-400">{event.venue}</p>
      {event.description && <p className="mt-6 text-gray-300">{event.description}</p>}

      <h3 className="mb-4 mt-10 text-2xl font-bold">Tickets</h3>
      <div className="space-y-4">
        {event.ticketTypes.map((t) => {
          const max = Math.min(10, t.remaining);
          return (
            <div key={t.id} className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900 p-5">
              <div>
                <p className="text-lg font-semibold">{t.name}</p>
                <p className="text-sm text-gray-400">
                  {t.remaining > 0 ? `${t.remaining} left` : 'Sold out'}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <p className="text-xl font-bold">{formatNaira(t.priceKobo)}</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => change(t.id, -1, max)}
                    disabled={!qty[t.id]}
                    className="h-9 w-9 rounded-lg bg-gray-800 text-xl disabled:opacity-40"
                  >
                    −
                  </button>
                  <span className="w-6 text-center">{qty[t.id] || 0}</span>
                  <button
                    onClick={() => change(t.id, 1, max)}
                    disabled={max === 0 || (qty[t.id] || 0) >= max}
                    className="h-9 w-9 rounded-lg bg-purple-600 text-xl disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {totalQty > 0 && (
        <div className="mt-8 rounded-xl border border-gray-800 bg-gray-900 p-6">
          {quote && (
            <div className="space-y-2 text-gray-300">
              <div className="flex justify-between"><span>Tickets ({totalQty})</span><span>{formatNaira(quote.subtotalKobo)}</span></div>
              <div className="flex justify-between"><span>Service fee</span><span>{formatNaira(quote.serviceFeeKobo)}</span></div>
              <div className="flex justify-between"><span>Payment processing fee</span><span>{formatNaira(quote.processingFeeKobo)}</span></div>
              <div className="flex justify-between border-t border-gray-700 pt-2 text-lg font-bold text-white">
                <span>Total</span><span>{formatNaira(quote.totalKobo)}</span>
              </div>
            </div>
          )}

          {user ? (
            <>
              <p className="mt-4 text-sm text-gray-400">
                Tickets will be sent to <span className="text-white">{user.email}</span>
              </p>
              {payError && <p className="mt-4 text-red-400">{payError}</p>}
              <button
                onClick={pay}
                disabled={paying || !quote}
                className="mt-4 w-full rounded-lg bg-purple-600 py-3 text-lg font-semibold hover:bg-purple-700 disabled:bg-gray-700"
              >
                {paying ? 'Taking you to payment...' : 'Pay now'}
              </button>
              <p className="mt-3 text-center text-xs text-gray-500">
                Your tickets are held for 15 minutes once you click Pay.
              </p>
            </>
          ) : (
            <Link
              to="/login"
              state={{ from: location.pathname }}
              className="mt-4 block w-full rounded-lg bg-purple-600 py-3 text-center text-lg font-semibold hover:bg-purple-700"
            >
              Sign in to buy
            </Link>
          )}
        </div>
      )}
    </div>
  );
}