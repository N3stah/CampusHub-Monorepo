'use client';

import { useMemo, useState, type FormEvent } from 'react';
import PortalShell from '@/components/PortalShell';
import { Alert, Button } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';

const transactions = [
  { id: 'MP240001', date: '2026-09-04', description: 'M-Pesa tuition payment', method: 'M-Pesa', amount: 45000, status: 'Paid' },
  { id: 'RC240002', date: '2026-09-12', description: 'Library and activity fees', method: 'Bank', amount: 4500, status: 'Paid' },
];

export default function FinancePage() {
  const { user } = useAuth();
  const canManage = user?.role === 'finance' || user?.role === 'admin';
  const [provider, setProvider] = useState('M-Pesa');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('12000');
  const [notice, setNotice] = useState<string | null>(null);
  const totalPaid = useMemo(() => transactions.reduce((sum, item) => sum + item.amount, 0), []);

  function initiatePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(provider === 'M-Pesa'
      ? 'Payment request ready for M-Pesa STK Push. Connect the payment API before production use.'
      : 'Payment instructions prepared. Connect the selected provider before production use.');
  }

  return (
    <PortalShell roles={['student', 'finance', 'admin']}>
      <section className="space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">{canManage ? 'Finance office' : 'Student account'}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Fees and payments</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Review charges, payment history, receipts, and outstanding balance.</p>
        </header>

        <div className="grid gap-4 sm:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Programme fee</p><p className="mt-2 text-2xl font-bold">KES 105,000</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Amount paid</p><p className="mt-2 text-2xl font-bold text-emerald-700">KES {totalPaid.toLocaleString()}</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Outstanding balance</p><p className="mt-2 text-2xl font-bold text-red-700">KES 55,500</p></article>
        </div>

        {!canManage && (
          <form onSubmit={initiatePayment} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
            <div>
              <label htmlFor="payment-provider" className="mb-1 block text-sm font-medium text-slate-700">Payment method</label>
              <select id="payment-provider" value={provider} onChange={(event) => setProvider(event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5">
                <option>M-Pesa</option>
                <option>Bank transfer</option>
                <option>Card</option>
              </select>
            </div>
            <div>
              <label htmlFor="payment-phone" className="mb-1 block text-sm font-medium text-slate-700">Mobile number</label>
              <input id="payment-phone" required={provider === 'M-Pesa'} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="2547..." className="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
            </div>
            <div>
              <label htmlFor="payment-amount" className="mb-1 block text-sm font-medium text-slate-700">Amount</label>
              <input id="payment-amount" type="number" min="1" required value={amount} onChange={(event) => setAmount(event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
            </div>
            <Button type="submit">Pay now</Button>
          </form>
        )}
        {notice && <Alert tone="info">{notice}</Alert>}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold">Transaction ledger</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Reference</th><th className="px-5 py-3">Date</th><th className="px-5 py-3">Description</th><th className="px-5 py-3">Method</th><th className="px-5 py-3">Amount</th><th className="px-5 py-3">Status</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{transactions.map((item) => <tr key={item.id}><td className="px-5 py-3 font-medium">{item.id}</td><td className="px-5 py-3 text-slate-600">{item.date}</td><td className="px-5 py-3">{item.description}</td><td className="px-5 py-3 text-slate-600">{item.method}</td><td className="px-5 py-3 font-semibold">KES {item.amount.toLocaleString()}</td><td className="px-5 py-3"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{item.status}</span></td></tr>)}</tbody>
            </table>
          </div>
        </section>
      </section>
    </PortalShell>
  );
}
