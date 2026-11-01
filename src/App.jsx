import { Link, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import EventDetails from './pages/EventDetails';
import Tickets from './pages/Tickets';
import Scanner from './pages/Scanner';
import PaymentCallback from './pages/PaymentCallback';
import Auth from './pages/Auth';
import MyTickets from './pages/MyTickets';
import { useAuth } from './auth.jsx';

function App() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="flex items-center justify-between px-8 py-5">
        <Link to="/" className="text-2xl font-bold text-purple-400">
          Ticketing
        </Link>

        <div className="flex gap-6">
          <Link to="/" className="hover:text-purple-400">Explore</Link>
          <Link to="/my-tickets" className="hover:text-purple-400">My Tickets</Link>
        </div>

        {user ? (
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">{user.name}</span>
            <button onClick={logout} className="rounded-lg bg-gray-800 px-4 py-2 hover:bg-gray-700">
              Log out
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Link to="/login" className="hover:text-purple-400">Log in</Link>
            <Link to="/signup" className="rounded-lg bg-purple-600 px-5 py-2 hover:bg-purple-700">
              Sign up
            </Link>
          </div>
        )}
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/events/:id" element={<EventDetails />} />
        <Route path="/tickets/:orderId" element={<Tickets />} />
        <Route path="/my-tickets" element={<MyTickets />} />
        <Route path="/scan" element={<Scanner />} />
        <Route path="/payment/callback" element={<PaymentCallback />} />
        <Route path="/login" element={<Auth mode="login" />} />
        <Route path="/signup" element={<Auth mode="signup" />} />
      </Routes>
    </div>
  );
}

export default App;