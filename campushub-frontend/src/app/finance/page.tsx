'use client';

import { useEffect, useState, type FormEvent } from 'react';
import ApiCrudWorkspace from '@/components/ApiCrudWorkspace';
import PortalShell from '@/components/PortalShell';
import { useAuth } from '@/context/AuthContext';
import ServiceOverview from '@/components/ServiceOverview';
import api from '@/lib/api';
import { getApiErrorMessage, getApiPage } from '@/lib/portal';

interface StudentInvoiceOption {
  id: number;
  invoice_number?: string;
  amount: number;
  due_date?: string | null;
  status: string;
}

const financeMetrics = [
  { label: 'Outstanding invoices', endpoint: '/finance/invoices/', params: { status: 'issued' }, href: '/finance' },
  { label: 'Payments to reconcile', endpoint: '/finance/payments/', params: { status: 'pending' }, href: '/finance' },
  { label: 'Confirmed payments', endpoint: '/finance/payments/', params: { status: 'confirmed' }, href: '/finance' },
];
const studentFinanceMetrics = [
  { label: 'My invoices', endpoint: '/finance/invoices/', params: { scope: 'self' }, href: '/finance' },
  { label: 'My payments', endpoint: '/finance/payments/', params: { scope: 'self' }, href: '/finance' },
];

const invoiceStatuses = [
  { value: 'draft', label: 'Draft' },
  { value: 'issued', label: 'Issued' },
  { value: 'partially_paid', label: 'Partially paid' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function FinancePage() {
  const { user } = useAuth();
  const canManage = user?.role === 'finance';
  const [paymentInvoiceId, setPaymentInvoiceId] = useState('');
  const [paymentPhone, setPaymentPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('mpesa');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null);
  const [studentInvoices, setStudentInvoices] = useState<StudentInvoiceOption[]>([]);

  useEffect(() => {
    if (canManage || user?.role !== 'student') return;
    const controller = new AbortController();
    void getApiPage<StudentInvoiceOption>('/finance/invoices/', { scope: 'self', page_size: 100 }, controller.signal).then((page) => {
      if (!controller.signal.aborted) {
        setStudentInvoices(page.results.filter((invoice) => !['paid', 'cancelled', 'voided'].includes(invoice.status)));
      }
    }).catch((requestError: unknown) => {
      if (!controller.signal.aborted) setPaymentError(getApiErrorMessage(requestError));
    });
    return () => controller.abort();
  }, [canManage, user?.role]);

  async function requestPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPaymentSubmitting(true);
    setPaymentError(null);
    setPaymentNotice(null);
    try {
      const { data } = await api.post<{ message?: string }>('/finance/payment-requests/', {
        invoice_id: Number(paymentInvoiceId),
        method: paymentMethod,
        phone_number: paymentMethod === 'mpesa' ? paymentPhone : null,
      });
      setPaymentNotice(data.message ?? 'Payment request submitted.');
      setPaymentInvoiceId('');
      setPaymentPhone('');
    } catch (requestError) {
      setPaymentError(getApiErrorMessage(requestError));
    } finally {
      setPaymentSubmitting(false);
    }
  }

  return (
    <PortalShell roles={['student', 'finance']}>
      <section className="space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">{canManage ? 'Finance office' : 'Student account'}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Fees and payments</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Manage fee schedules, student invoices, payment records, and reconciliation.</p>
        </header>
        <ServiceOverview title={canManage ? 'Finance workload' : 'My account overview'} metrics={canManage ? financeMetrics : studentFinanceMetrics} />

        {canManage ? (
          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">Make a payment</h2>
              <p className="mt-1 text-sm text-slate-600">Select an outstanding invoice and request payment through an available channel.</p>
              {paymentError && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{paymentError}</p>}
              {paymentNotice && <p role="status" className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{paymentNotice}</p>}
              <form onSubmit={requestPayment} className="mt-4 grid gap-4 sm:grid-cols-3 sm:items-end">
                <label className="text-sm font-medium text-slate-700">Invoice
                  <select required value={paymentInvoiceId} onChange={(event) => setPaymentInvoiceId(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5">
                    <option value="">Choose an outstanding invoice</option>
                    {studentInvoices.map((invoice) => (
                      <option key={invoice.id} value={invoice.id}>
                        {invoice.invoice_number ?? `Invoice #${invoice.id}`} · KES {invoice.amount.toLocaleString()} · {invoice.status}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-700">Payment method
                  <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5">
                    <option value="mpesa">M-Pesa</option>
                    <option value="bank">Bank transfer</option>
                    <option value="card">Card</option>
                  </select>
                </label>
                {paymentMethod === 'mpesa' && (
                  <label className="text-sm font-medium text-slate-700">M-Pesa phone number
                    <input required value={paymentPhone} onChange={(event) => setPaymentPhone(event.target.value)} placeholder="2547…" className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
                  </label>
                )}
                <button type="submit" disabled={paymentSubmitting || !studentInvoices.length} className="min-h-11 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60 sm:col-span-3">
                  {paymentSubmitting ? 'Submitting…' : 'Request payment'}
                </button>
                <p className="text-xs text-slate-500 sm:col-span-3">Payment requests are not payment confirmations. The finance API must confirm transactions before invoices are marked paid.</p>
              </form>
            </section>
            <ApiCrudWorkspace
              title="Fee structures"
              description="Create and maintain fee schedules by programme and academic year."
              endpoint="/finance/fee-structures/"
              fields={[
                { name: 'name', label: 'Fee name', required: true },
                { name: 'programme_id', label: 'Programme', type: 'number', required: true, lookup: { endpoint: '/academics/courses/', labelFields: ['code', 'title'] } },
                { name: 'academic_year', label: 'Academic year', placeholder: '2027/2028', required: true },
                { name: 'amount', label: 'Amount (KES)', type: 'number', required: true },
                { name: 'due_date', label: 'Due date', type: 'date' },
                { name: 'status', label: 'Status', options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }], required: true },
              ]}
              displayFields={['name', 'programme_name', 'academic_year', 'amount', 'status']}
              displayLabels={{ programme_name: 'Programme', academic_year: 'Academic year', amount: 'Amount (KES)' }}
              filters={[{ name: 'status', label: 'Status', options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }] }]}
              sortableFields={[{ value: 'academic_year', label: 'Academic year' }, { value: 'amount', label: 'Amount' }]}
              allowDelete={false}
            />
            <ApiCrudWorkspace
              title="Invoices"
              description="Issue, update, and cancel student invoices."
              endpoint="/finance/invoices/"
              fields={[
                { name: 'student_id', label: 'Student', type: 'number', required: true, lookup: { endpoint: '/users/', params: { role: 'student' }, labelFields: ['admission_number', 'first_name', 'last_name', 'email'] } },
                { name: 'fee_structure_id', label: 'Fee structure', type: 'number', required: true, lookup: { endpoint: '/finance/fee-structures/', labelFields: ['name', 'academic_year', 'amount'] } },
                { name: 'amount', label: 'Amount (KES)', type: 'number', required: true },
                { name: 'due_date', label: 'Due date', type: 'date', required: true },
                { name: 'status', label: 'Status', options: invoiceStatuses, required: true },
                { name: 'description', label: 'Description', type: 'textarea' },
              ]}
              displayFields={['student_name', 'fee_structure_name', 'amount', 'due_date', 'status']}
              displayLabels={{ student_name: 'Student', fee_structure_name: 'Fee structure', amount: 'Amount (KES)', due_date: 'Due date' }}
              filters={[{ name: 'status', label: 'Status', options: invoiceStatuses }]}
              sortableFields={[{ value: 'due_date', label: 'Due date' }, { value: '-created_at', label: 'Recently created' }]}
              allowDelete={false}
            />
            <ApiCrudWorkspace
              title="Payments"
              description="Record and reconcile payments. Voiding a payment should retain an auditable reversal in the finance backend."
              endpoint="/finance/payments/"
              fields={[
                { name: 'invoice_id', label: 'Invoice', type: 'number', required: true, lookup: { endpoint: '/finance/invoices/', labelFields: ['id', 'student_name', 'amount', 'due_date'] } },
                { name: 'amount', label: 'Amount (KES)', type: 'number', required: true },
                { name: 'method', label: 'Payment method', options: [{ value: 'mpesa', label: 'M-Pesa' }, { value: 'bank', label: 'Bank transfer' }, { value: 'card', label: 'Card' }, { value: 'cash', label: 'Cash' }], required: true },
                { name: 'reference', label: 'Payment reference', required: true },
                { name: 'paid_at', label: 'Payment date', type: 'date', required: true },
                { name: 'status', label: 'Status', options: [{ value: 'confirmed', label: 'Confirmed' }, { value: 'pending', label: 'Pending' }, { value: 'failed', label: 'Failed' }], required: true },
              ]}
              displayFields={['student_name', 'invoice_reference', 'amount', 'method', 'reference', 'paid_at', 'status']}
              displayLabels={{ student_name: 'Student', invoice_reference: 'Invoice', amount: 'Amount (KES)', paid_at: 'Paid on' }}
              filters={[{ name: 'status', label: 'Status', options: [{ value: 'confirmed', label: 'Confirmed' }, { value: 'pending', label: 'Pending' }, { value: 'failed', label: 'Failed' }, { value: 'voided', label: 'Voided' }] }]}
              sortableFields={[{ value: '-paid_at', label: 'Newest payment' }, { value: 'amount', label: 'Amount' }]}
              allowDelete={false}
              rowActions={[{ label: 'Void', endpointSuffix: 'void/', confirmation: 'Void this payment? The finance API should retain an audit and reversal entry.', hideWhen: { field: 'status', value: 'voided' } }]}
            />
          </div>
        ) : (
          <div className="space-y-6">
            <ApiCrudWorkspace
              title="My invoices"
              description="Review fee invoices and current balances."
              endpoint="/finance/invoices/"
              fields={[]}
              displayFields={['invoice_number', 'amount', 'due_date', 'status', 'description']}
              displayLabels={{ invoice_number: 'Invoice', amount: 'Amount (KES)', due_date: 'Due date' }}
              allowCreate={false}
              allowEdit={false}
              allowDelete={false}
              baseParams={{ scope: 'self' }}
            />
            <ApiCrudWorkspace
              title="My payments"
              description="Review recorded payments and references."
              endpoint="/finance/payments/"
              fields={[]}
              displayFields={['invoice_reference', 'amount', 'method', 'reference', 'paid_at', 'status']}
              displayLabels={{ invoice_reference: 'Invoice', amount: 'Amount (KES)', paid_at: 'Paid on' }}
              allowCreate={false}
              allowEdit={false}
              allowDelete={false}
              baseParams={{ scope: 'self' }}
            />
          </div>
        )}
      </section>
    </PortalShell>
  );
}
