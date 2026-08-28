'use main-site';
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Search, Users, ChevronRight, ShoppingBag, Calendar, Loader2, UserPlus, X } from 'lucide-react';

interface CustomerWithOrders {
  id: string;
  name: string;
  phone: string;
  orders: { id: string; created_at: string }[];
}

function formatTimeAgo(dateString: string | null) {
  if (!dateString) return 'Never';
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays}d ago`;
  } catch (err) {
    return 'Recently';
  }
}

export default function CustomersList() {
  const supabase = createClient();
  const [customers, setCustomers] = useState<CustomerWithOrders[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);

  // Add Customer Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCustomers() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const bId = user.user_metadata?.business_id;
        if (!bId) {
          setError('Business ID not found.');
          return;
        }
        setBusinessId(bId);

        const { data, error: fetchError } = await supabase
          .from('customers')
          .select(`
            id,
            name,
            phone,
            orders (
              id,
              created_at
            )
          `)
          .eq('business_id', bId);

        if (fetchError) throw fetchError;

        setCustomers(data || []);
      } catch (err: any) {
        console.error('Error loading customers:', err);
        setError(err.message || 'Failed to load customers.');
      } finally {
        setLoading(false);
      }
    }

    loadCustomers();
  }, [supabase]);

  // Search filtering & sorting (most orders first)
  const processedCustomers = customers
    .filter(
      (c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery)
    )
    .map((c) => {
      const sortedOrders = [...(c.orders || [])].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const lastOrderDate = sortedOrders[0]?.created_at || null;
      return {
        ...c,
        orderCount: c.orders?.length || 0,
        lastOrderDate,
      };
    })
    .sort((a, b) => b.orderCount - a.orderCount);

  // Handle Add Customer submission
  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adding) return;
    setAddError(null);

    if (!newCustomerName.trim()) {
      setAddError('Shop name is required.');
      return;
    }
    if (!newCustomerPhone.trim()) {
      setAddError('Phone number is required.');
      return;
    }
    if (!businessId) {
      setAddError('Business identity not found. Are you logged in?');
      return;
    }

    setAdding(true);
    try {
      const { data: newCust, error: insertError } = await supabase
        .from('customers')
        .insert({
          business_id: businessId,
          name: newCustomerName.trim(),
          phone: newCustomerPhone.trim(),
        })
        .select(`
          id,
          name,
          phone,
          orders (
            id,
            created_at
          )
        `)
        .single();

      if (insertError) throw insertError;

      // Add newly created customer to listing state
      setCustomers([newCust, ...customers]);
      setNewCustomerName('');
      setNewCustomerPhone('');
      setShowAddModal(false);
    } catch (err: any) {
      console.error('Error adding customer:', err);
      setAddError(err.message || 'Failed to add customer. Please check your connection.');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Customers Directory
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Ranked by order frequency. Select a customer to view their complete history and insights.
          </p>
        </div>
        <button
          onClick={() => {
            setAddError(null);
            setShowAddModal(true);
          }}
          className="flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all duration-200 self-start sm:self-auto hover:shadow-indigo-600/20 active:scale-[0.98]"
        >
          <UserPlus className="h-4.5 w-4.5" />
          <span>Add Customer</span>
        </button>
      </div>

      {error && (
        <div className="rounded-2xl bg-red-500/10 p-4 ring-1 ring-red-500/20 text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search by customer name or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="block w-full rounded-2xl border-0 bg-slate-900/40 py-3.5 pl-11 pr-4 text-white ring-1 ring-inset ring-slate-900 placeholder:text-slate-600 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm transition-all duration-200"
        />
        <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-500" />
      </div>

      {/* Customers List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
          <p className="text-sm">Loading customer directory...</p>
        </div>
      ) : processedCustomers.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-900 p-12 text-center">
          <Users className="mx-auto h-12 w-12 text-slate-600" />
          <h3 className="mt-4 text-sm font-semibold text-slate-200">No customers found</h3>
          <p className="mt-1 text-xs text-slate-500">
            {searchQuery ? 'Reset search filter' : 'Customers will appear when you log their first order.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {processedCustomers.map((cust, index) => (
            <Link
              key={cust.id}
              href={`/customers/${cust.id}`}
              className="flex items-center justify-between p-4 rounded-3xl border border-slate-900 bg-slate-900/20 hover:bg-slate-900/40 backdrop-blur-xl group transition-all duration-200 active:scale-[0.99]"
            >
              <div className="min-w-0 flex-1 pr-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">#{index + 1}</span>
                  <h3 className="font-semibold text-sm text-white truncate group-hover:text-indigo-400 transition-colors">
                    {cust.name}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">{cust.phone}</p>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right">
                  <span className="flex items-center gap-1 text-[11px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full justify-end">
                    <ShoppingBag className="h-3 w-3" />
                    {cust.orderCount} orders
                  </span>
                  {cust.lastOrderDate && (
                    <span className="flex items-center gap-1 text-[10px] text-slate-500 mt-1 justify-end">
                      <Calendar className="h-3 w-3 text-slate-600" />
                      {formatTimeAgo(cust.lastOrderDate)}
                    </span>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 text-slate-500 group-hover:text-slate-300 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200 relative">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-800">
              <div className="rounded-xl bg-indigo-600/10 p-2 text-indigo-400 border border-indigo-500/10">
                <UserPlus className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-bold text-white">Add New Customer</h2>
            </div>

            {addError && (
              <div className="rounded-2xl bg-red-500/10 p-4 ring-1 ring-red-500/20 text-red-200 text-xs">
                {addError}
              </div>
            )}

            <form onSubmit={handleAddCustomer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Shop / Customer Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Al-Madina Supermart"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  className="block w-full rounded-2xl border-0 bg-slate-950/60 py-3.5 px-4 text-white ring-1 ring-inset ring-slate-800 placeholder:text-slate-700 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. +923214567890"
                  value={newCustomerPhone}
                  onChange={(e) => setNewCustomerPhone(e.target.value)}
                  className="block w-full rounded-2xl border-0 bg-slate-950/60 py-3.5 px-4 text-white ring-1 ring-inset ring-slate-800 placeholder:text-slate-700 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm transition-all"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 justify-center rounded-2xl border border-slate-800 bg-slate-900 hover:bg-slate-800 px-4 py-3.5 text-sm font-semibold text-slate-300 hover:text-white transition-all active:scale-[0.98]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adding}
                  className="flex-1 justify-center items-center flex gap-1.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 px-4 py-3.5 text-sm font-semibold text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {adding ? (
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                  ) : (
                    <>
                      <span>Save Profile</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
