'use main-site';
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import StatusBadge from '@/components/StatusBadge';
import { generateWhatsAppMessage, generateWhatsAppLink } from '@/lib/whatsapp';
import {
  Search,
  Clock,
  ChevronDown,
  ChevronUp,
  Share2,
  TrendingUp,
  AlertCircle,
  Loader2,
  Calendar,
  Sparkles,
  ShoppingBag,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns'; // Wait, let's verify if we need date-fns. We can write a lightweight custom format function to avoid installing libraries! Custom is safer and faster.

// Custom simple formatDistanceToNow
function formatTimeAgo(dateString: string) {
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

interface OrderItem {
  id: string;
  item_name: string;
  quantity: number;
  unit: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
}

interface Order {
  id: string;
  created_at: string;
  status: 'pending' | 'confirmed' | 'delivered' | 'paid';
  notes: string | null;
  customer: Customer;
  order_items: OrderItem[];
}

interface TopCustomer {
  id: string;
  name: string;
  phone: string;
  orderCount: number;
  lastOrderDate: string;
}

const STATUS_OPTIONS: Order['status'][] = ['pending', 'confirmed', 'delivered', 'paid'];

const STATUS_STYLES = {
  pending: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
    label: 'Pending',
  },
  confirmed: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/20',
    label: 'Confirmed',
  },
  delivered: {
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    border: 'border-purple-500/20',
    label: 'Delivered',
  },
  paid: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
    label: 'Paid',
  },
};

export default function Dashboard() {
  const supabase = createClient();

  // Core Data State
  const [orders, setOrders] = useState<Order[]>([]);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter/Search State
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [showTopCustomers, setShowTopCustomers] = useState(false);

  // Fetch all orders with associated customers and items
  const fetchDashboardData = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const businessId = user.user_metadata?.business_id;
      if (!businessId) {
        setError('No business ID associated with user.');
        return;
      }

      // Fetch Orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          created_at,
          status,
          notes,
          customer:customers (
            id,
            name,
            phone
          ),
          order_items (
            id,
            item_name,
            quantity,
            unit
          )
        `)
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      const typedOrders = (ordersData || []).map((o: any) => ({
        id: o.id,
        created_at: o.created_at,
        status: o.status as Order['status'],
        notes: o.notes,
        customer: o.customer as Customer,
        order_items: (o.order_items || []) as OrderItem[],
      }));

      setOrders(typedOrders);

      // Compute Top Customers
      // We group orders by customer id to find top 5
      const counts: Record<string, { name: string; phone: string; count: number; lastDate: string }> = {};
      typedOrders.forEach((o) => {
        if (!o.customer) return;
        const cid = o.customer.id;
        if (!counts[cid]) {
          counts[cid] = {
            name: o.customer.name,
            phone: o.customer.phone,
            count: 0,
            lastDate: o.created_at,
          };
        }
        counts[cid].count += 1;
        if (new Date(o.created_at) > new Date(counts[cid].lastDate)) {
          counts[cid].lastDate = o.created_at;
        }
      });

      const sortedTop = Object.entries(counts)
        .map(([id, val]) => ({
          id,
          name: val.name,
          phone: val.phone,
          orderCount: val.count,
          lastOrderDate: val.lastDate,
        }))
        .sort((a, b) => b.orderCount - a.orderCount)
        .slice(0, 5);

      setTopCustomers(sortedTop);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      setError(err.message || 'Failed to load orders. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Subscribe to database changes for real-time updates
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          fetchDashboardData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        () => {
          fetchDashboardData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  // Handle Order Status Update (Optimistic UI)
  const handleUpdateStatus = async (orderId: string, newStatus: Order['status']) => {
    // 1. Snapshot previous state
    const previousOrders = [...orders];

    // 2. Optimistically update local state
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    );

    try {
      const { error: patchError } = await supabase
        .from('orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if (patchError) throw patchError;
    } catch (err) {
      console.error('Failed to update status, rolling back:', err);
      // Rollback on failure
      setOrders(previousOrders);
      alert('Could not update status. Checked offline status or permission.');
    }
  };

  // Generate WhatsApp text & redirect
  const shareToWhatsApp = (order: Order) => {
    if (!order.customer) return;
    const msg = generateWhatsAppMessage(order, order.customer.name);
    const waUrl = generateWhatsAppLink(order.customer.phone, msg);
    window.open(waUrl, '_blank');
  };

  // Filter and search computation
  const filteredOrders = orders.filter((order) => {
    const custName = order.customer?.name?.toLowerCase() || '';
    const custPhone = order.customer?.phone || '';
    const matchesSearch =
      custName.includes(searchQuery.toLowerCase()) || custPhone.includes(searchQuery);

    if (activeTab === 'all') return matchesSearch;
    return order.status === activeTab && matchesSearch;
  });

  // Calculate counts for tabs
  const counts = {
    all: orders.length,
    pending: orders.filter((o) => o.status === 'pending').length,
    confirmed: orders.filter((o) => o.status === 'confirmed').length,
    delivered: orders.filter((o) => o.status === 'delivered').length,
    paid: orders.filter((o) => o.status === 'paid').length,
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Order Board
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
              Live
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Search orders, change status instantly, or share to WhatsApp.
          </p>
        </div>

        {/* Top Customers Panel Toggle */}
        <button
          onClick={() => setShowTopCustomers(!showTopCustomers)}
          className="flex items-center gap-2 self-start sm:self-center px-4 py-2.5 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold hover:bg-indigo-600/20 active:scale-95 transition-all duration-200"
        >
          <TrendingUp className="h-4 w-4" />
          {showTopCustomers ? 'Hide Insights' : 'View Top Customers'}
        </button>
      </div>

      {/* Top Customers collapsible drawer panel */}
      {showTopCustomers && (
        <div className="rounded-3xl border border-slate-900 bg-slate-900/30 p-5 backdrop-blur-xl animate-fade-in space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-400" />
              Top Customers (by order count)
            </h2>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider">Auto-Computed</span>
          </div>

          {topCustomers.length === 0 ? (
            <p className="text-xs text-slate-500 py-2">No customer order data available yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {topCustomers.map((cust, index) => (
                <div
                  key={cust.id}
                  className="p-4 rounded-2xl bg-slate-950/40 border border-slate-900 hover:border-slate-800 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-500">#{index + 1}</span>
                      <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                        {cust.orderCount} orders
                      </span>
                    </div>
                    <h3 className="font-semibold text-sm text-white truncate">{cust.name}</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">{cust.phone}</p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-900/60 flex items-center gap-1 text-[10px] text-slate-400">
                    <Calendar className="h-3 w-3 shrink-0 text-slate-500" />
                    <span>Last: {formatTimeAgo(cust.lastOrderDate)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-2xl bg-red-500/10 p-4 ring-1 ring-red-500/20 text-red-200 text-sm flex gap-3">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and search bar wrapper */}
      <div className="flex flex-col gap-4">
        {/* Search */}
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

        {/* Tab pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none">
          {(['all', ...STATUS_OPTIONS] as const).map((tab) => {
            const count = counts[tab];
            const isActive = activeTab === tab;
            const style = tab !== 'all' ? STATUS_STYLES[tab] : null;

            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-semibold capitalize shrink-0 transition-all duration-200 active:scale-95 border ${
                  isActive
                    ? tab === 'all'
                      ? 'bg-white text-slate-950 border-white font-bold'
                      : `${style?.bg} ${style?.text} ${style?.border} font-bold ring-1 ring-inset ${style?.border}`
                    : 'bg-slate-900/20 border-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <span>{tab}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                    isActive
                      ? tab === 'all'
                        ? 'bg-slate-950 text-white'
                        : 'bg-indigo-600/20 text-indigo-400'
                      : 'bg-slate-900 text-slate-500'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Orders list */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
          <p className="text-sm">Fetching distributor logs...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-900 p-12 text-center">
          <ShoppingBag className="mx-auto h-12 w-12 text-slate-600" />
          <h3 className="mt-4 text-sm font-semibold text-slate-200">No orders found</h3>
          <p className="mt-1 text-xs text-slate-500">
            {searchQuery ? 'Try resetting search keywords' : 'Click "New Order" below to log the first one'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const isExpanded = expandedOrderId === order.id;
            const style = STATUS_STYLES[order.status];
            const timeAgo = formatTimeAgo(order.created_at);

            return (
              <div
                key={order.id}
                className={`rounded-3xl border border-slate-900 bg-slate-900/20 hover:bg-slate-900/40 backdrop-blur-xl overflow-hidden transition-all duration-200 ${
                  isExpanded ? 'ring-1 ring-indigo-500/20 bg-slate-900/35' : ''
                }`}
              >
                {/* Order Row Header Clickable */}
                <div
                  onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                  className="flex items-center justify-between p-4 cursor-pointer select-none"
                >
                  <div className="min-w-0 flex-1 pr-4">
                    <h3 className="font-semibold text-sm text-white truncate">
                      {order.customer?.name || 'Unknown Customer'}
                    </h3>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
                      <span>{order.order_items?.length || 0} items</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {timeAgo}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3.5">
                    {/* Status Badge */}
                    <StatusBadge status={order.status} />
                    {isExpanded ? (
                      <ChevronUp className="h-4.5 w-4.5 text-slate-500" />
                    ) : (
                      <ChevronDown className="h-4.5 w-4.5 text-slate-500" />
                    )}
                  </div>
                </div>

                {/* Expanded Details Drawer */}
                {isExpanded && (
                  <div className="border-t border-slate-900/80 bg-slate-950/40 p-4 space-y-4 animate-slide-down">
                    {/* Contact & notes */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="block text-slate-500 font-medium">Customer Phone</span>
                        <span className="block text-slate-300 font-semibold mt-0.5">
                          {order.customer?.phone || 'No phone'}
                        </span>
                      </div>
                      {order.notes && (
                        <div>
                          <span className="block text-slate-500 font-medium">Order Notes</span>
                          <p className="text-slate-300 italic mt-0.5 leading-relaxed">{order.notes}</p>
                        </div>
                      )}
                    </div>

                    {/* Items List */}
                    <div>
                      <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                        Items Purchased
                      </span>
                      <div className="rounded-2xl border border-slate-900/80 bg-slate-950/60 overflow-hidden divide-y divide-slate-900/60">
                        {order.order_items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between px-3 py-2 text-xs"
                          >
                            <span className="text-slate-200 font-semibold">{item.item_name}</span>
                            <span className="text-slate-400 font-bold bg-slate-900/40 px-2 py-0.5 rounded-md">
                              {item.quantity} {item.unit}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Controls section */}
                    <div className="flex flex-col gap-3.5 pt-2 border-t border-slate-900/60">
                      {/* Status quick changer */}
                      <div>
                        <span className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                          Update Order Status
                        </span>
                        <div className="grid grid-cols-4 gap-1.5">
                          {STATUS_OPTIONS.map((status) => {
                            const active = order.status === status;
                            const btnStyle = STATUS_STYLES[status];
                            return (
                              <button
                                key={status}
                                onClick={() => handleUpdateStatus(order.id, status)}
                                className={`text-[10px] sm:text-xs font-bold py-2 rounded-xl border transition-all duration-200 active:scale-95 ${
                                  active
                                    ? `${btnStyle.bg} ${btnStyle.text} ${btnStyle.border} ring-1 ring-inset ${btnStyle.border}`
                                    : 'bg-slate-900/10 border-slate-900 text-slate-500 hover:text-slate-300'
                                }`}
                              >
                                {btnStyle.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Share WhatsApp Action */}
                      <button
                        onClick={() => shareToWhatsApp(order)}
                        className="w-full flex justify-center items-center gap-1.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 px-4 py-3.5 text-xs font-semibold text-white transition-all duration-200 hover:shadow-emerald-600/15"
                      >
                        <Share2 className="h-4 w-4" />
                        Share to WhatsApp
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
