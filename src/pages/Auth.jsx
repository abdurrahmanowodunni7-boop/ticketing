import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Auth({ mode }) {
  const isSignup = mode === 'signup';
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const next = (location.state && location.state.from) || '/';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (isSignup) await signup(name, email, password);
      else await login(email, password);
      navigate(next, { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const input = 'w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3';

  return (
    <div className="mx-auto max-w-sm px-8 py-16">
      <h2 className="text-3xl font-bold">{isSignup ? 'Create your account' : 'Welcome back'}</h2>
      <form onSubmit={submit} className="mt-6 space-y-4">
        {isSignup && (
          <input className={input} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
        )}
        <input className={input} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input
          className={input}
          type="password"
          placeholder={isSignup ? 'Password (8+ characters)' : 'Password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-red-400">{error}</p>}
        <button
          disabled={busy}
          className="w-full rounded-lg bg-purple-600 py-3 font-semibold hover:bg-purple-700 disabled:bg-gray-700"
        >
          {busy ? 'Please wait...' : isSignup ? 'Sign up' : 'Log in'}
        </button>
      </form>
      <p className="mt-6 text-gray-400">
        {isSignup ? 'Already have an account? ' : 'New here? '}
        <Link
          to={isSignup ? '/login' : '/signup'}
          state={{ from: next }}
          className="text-purple-400 hover:underline"
        >
          {isSignup ? 'Log in' : 'Create an account'}
        </Link>
      </p>
    </div>
  );
}