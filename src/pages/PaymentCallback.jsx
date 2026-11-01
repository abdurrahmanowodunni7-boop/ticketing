import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { API_URL } from '../api';

export default function PaymentCallback() {
  const [params] = useSearchParams();
  const reference = params.get('reference') || params.get('trxref');
  const navigate = useNavigate();
  const [message, setMessage] = useState('Confirming your payment...');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!reference) {
      setFailed(true);
      setMessage('No payment reference found.');
      return;
    }
    let tries = 0;
    let stopped = false;

    async function check() {
      try {
        const res = await fetch(`${API_URL}/payments/verify/${encodeURIComponent(reference)}`);
        const data = await res.json();
        if (stopped) return;
        if (res.ok && data.status === 'PAID') {
          navigate(`/tickets/${data.orderId}`, { replace: true });
          return;
        }
      } catch {}
      tries += 1;
      if (tries >= 10) {
        setFailed(true);
        setMessage('We could not confirm your payment yet. If you were charged, your tickets will appear shortly. Please contact support with your reference: ' + reference);
        return;
      }
      setTimeout(check, 2000);
    }
    check();
    return () => { stopped = true; };
  }, [reference, navigate]);

  return (
    <div className="mx-auto max-w-lg px-8 py-20 text-center">
      <p className={failed ? 'text-red-400' : 'text-gray-300'}>{message}</p>
      {failed && (
        <Link to="/" className="mt-6 inline-block text-purple-400 hover:underline">Back to events</Link>
      )}
    </div>
  );
}