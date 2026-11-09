import Link from 'next/link';

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 sm:px-6">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
        <Link href="/" className="text-xl font-bold text-slate-900">
          Campus<span className="text-blue-700">Hub</span>
        </Link>
        <h1 className="mt-7 text-2xl font-bold text-slate-900">Account registration</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          CampusHub accounts are created by the Registrar or Super Admin. If you have been admitted or appointed, contact your campus office to have your account set up. Your initial sign-in details will be sent to your registered email address.
        </p>
        <Link href="/login" className="mt-6 flex min-h-12 items-center justify-center rounded-xl bg-blue-700 px-4 font-semibold text-white hover:bg-blue-800">
          Go to sign in
        </Link>
      </section>
    </main>
  );
}
