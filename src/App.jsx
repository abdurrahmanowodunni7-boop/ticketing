
function App() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="flex items-center justify-between px-8 py-5">
        <h1 className="text-2xl font-bold text-purple-400">
          Ticketing
        </h1>

        <div className="flex gap-6">
          <a href="#" className="hover:text-purple-400">
            Explore
          </a>
          <a href="#" className="hover:text-purple-400">
            My Tickets
          </a>
        </div>

        <button className="rounded-lg bg-purple-600 px-5 py-2 hover:bg-purple-700">
          Sign In
        </button>
      </nav>

      <main className="px-8 py-24 text-center">
        <p className="mb-4 text-purple-400">
          YOUR NEXT EXPERIENCE STARTS HERE
        </p>

        <h2 className="mx-auto max-w-3xl text-5xl font-bold">
          Discover Events. Buy Tickets. Make Memories.
        </h2>

        <p className="mx-auto mt-6 max-w-xl text-gray-400">
          Find the hottest parties and events around you.
          Secure your ticket and get ready for an unforgettable experience.
        </p>

        <button className="mt-8 rounded-lg bg-purple-600 px-8 py-3 font-semibold hover:bg-purple-700">
          Explore Events
        </button>
      </main>
    </div>
  )
}

export default App