export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Navigation Bar */}
      <nav className="flex items-center justify-between px-6 py-4 mx-auto max-w-7xl border-b border-slate-200">
        <h1 className="text-2xl font-bold tracking-tight text-blue-600">
          Campus<span className="text-slate-800">Hub</span>
        </h1>
        <div className="flex items-center gap-4">
          <a
            href="/login"
            className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors"
          >
            Login
          </a>
          <a
            href="/register"
            className="text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors shadow-sm"
          >
            Get Started
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="flex flex-col items-center text-center px-6 py-20 mx-auto max-w-4xl">
        <h2 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 mb-6">
          Your Campus. <span className="text-blue-600">Connected.</span>
        </h2>
        <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mb-10 leading-relaxed">
          CampusHub is a university portal that connects students, lecturers, departments, resources, and placement opportunities all in one single place.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <a
            href="/register"
            className="text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 px-8 py-3 rounded-xl transition-colors shadow-md text-center"
          >
            Get Started
          </a>
          <a
            href="/login"
            className="text-base font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 px-8 py-3 rounded-xl transition-colors text-center"
          >
            Login
          </a>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-white border-t border-slate-200 px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <h3 className="text-2xl sm:text-3xl font-bold text-center text-slate-900 mb-12">
            Everything you need in one place
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <article className="p-6 bg-slate-50 border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
              <h4 className="text-xl font-bold text-slate-900 mb-3">
                Academic Resources
              </h4>
              <p className="text-slate-600 leading-relaxed">
                Access course materials, announcements, and other academic resources seamlessly.
              </p>
            </article>

            {/* Feature 2 */}
            <article className="p-6 bg-slate-50 border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
              <h4 className="text-xl font-bold text-slate-900 mb-3">
                Course Management
              </h4>
              <p className="text-slate-600 leading-relaxed">
                Stay connected with your courses, departments, lecturers, and current enrolments.
              </p>
            </article>

            {/* Feature 3 */}
            <article className="p-6 bg-slate-50 border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
              <h4 className="text-xl font-bold text-slate-900 mb-3">
                Placement Opportunities
              </h4>
              <p className="text-slate-600 leading-relaxed">
                Discover internship and job opportunities and submit applications directly through CampusHub.
              </p>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}
