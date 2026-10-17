import { Link, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import EventDetails from './pages/EventDetails';

function App() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="flex items-center justify-between px-8 py-5">
        <Link to="/" className="text-2xl font-bold text-purple-400">
          Ticketing
        </Link>

        <div className="flex gap-6">
          <Link to="/" className="hover:text-purple-400">Explore</Link>
          <a href="#" className="hover:text-purple-400">My Tickets</a>
        </div>

        <button className="rounded-lg bg-purple-600 px-5 py-2 hover:bg-purple-700">
          Sign In
        </button>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/events/:id" element={<EventDetails />} />
      </Routes>
    </div>
  );
}

export default App;