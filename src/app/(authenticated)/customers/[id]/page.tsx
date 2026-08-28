'use main-site';
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import StatusBadge from '@/components/StatusBadge';
import { generateWhatsAppMessage, generateWhatsAppLink } from '@/lib/whatsapp';
import {
  ArrowLeft,
  ShoppingBag,
  TrendingUp,
  Calendar,
  Layers,
  Clock,
  ChevronDown,
  ChevronUp,
  Share2,
  Phone,
  Store,
  Loader2,
} from 'lucide-react';

interface OrderItem {
  id: string;
  item_name: string;
  quantity: number;
  unit: string;
}

interface Order {
  id: string;
  created_at: string;
  status: 'pending' | 'confirmed' | 'delivered' | 'paid';
  notes: string | null;
  order_items: OrderItem[];
}

interface Customer {
  id: string;
  name: string;
  phone: string;
}

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

export default function CustomerDetails({ params }: { params: { id: string } }) {
  const router = useRouter();
  const supabase = createClient();
  const customerId = params.id;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Insights State
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalItemsCount, setTotalItemsCount] = useState(0);
  const [lastOrderAgo, setLastOrderAgo] = useState('Never');
  const [mostOrderedItem, setMostOrderedItem] = useState('None');

  useEffect(() => {
    async function loadCustomerData() {
      try {
        // Fetch customer profile
        const { data: custData, error: custError } = await supabase
          .from('customers')
          .select('id, name, phone')
          .eq('id', customerId)
          .single();

        if (custError) throw custError;
        setCustomer(custData);

        // Fetch all orders with items
        const { data: ordersData, error: ordersError } = await supabase
          .from('orders')
          .select(`
            id,
            created_at,
            status,
            notes,
            order_items (
              id,
              item_name,
              quantity,
              unit
            )
          `)
          .eq('customer_id', customerId)
          .order('created_at', { ascending: false });

        if (ordersError) throw ordersError;

        const typedOrders = (ordersData || []).map((o: any) => ({
          id: o.id,
          created_at: o.created_at,
          status: o.status as Order['status'],
          notes: o.notes,
          order_items: (o.order_items || []) as OrderItem[],
        }));

        setOrders(typedOrders);

        // Compute Insights
        if (typedOrders.length > 0) {
          setTotalOrders(typedOrders.length);

          // 1. Total items quantity sum
          let itemsSum = 0;
          const itemFreq: Record<string, number> = {};

          typedOrders.forEach((o) => {
            o.order_items.forEach((item) => {
              itemsSum += Number(item.quantity) || 0;
              itemFreq[item.item_name] = (itemFreq[item.item_name] || 0) + 1;
            });
          });
          setTotalItemsCount(itemsSum);

          // 2. Last order relative date
          const newestOrderDate = typedOrders[0].created_at;
          setLastOrderAgo(formatTimeAgo(newestOrderDate));

          // 3. Most frequent item name
          let topItem = 'None';
          let maxCount = 0;
          Object.entries(itemFreq).forEach(([name, count]) => {
            if (count > maxCount) {
              maxCount = count;
              topItem = name;
            }
          });
          setMostOrderedItem(topItem);
        }
      } catch (err: any) {
        console.error('Error loading customer details:', err);
        setError(err.message || 'Failed to load customer profile.');
      } finally {
        setLoading(false);
      }
    }

    loadCustomerData();
  }, [customerId, supabase]);

  // Share to WhatsApp
  const shareToWhatsApp = (order: Order) => {
    if (!customer) return;
    const msg = generateWhatsAppMessage(order, customer.name);
    const waUrl = generateWhatsAppLink(customer.phone, msg);
    window.open(waUrl, '_blank');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
        <p className="text-sm">Retrieving customer files...</p>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Go Back
        </button>
        <div className="rounded-2xl bg-red-500/10 p-4 ring-1 ring-red-500/20 text-red-200 text-sm">
          {error || 'Customer not found.'}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Navigation & Profile */}
      <div className="space-y-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Directory
        </button>

        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-indigo-600/10 p-3 text-indigo-400 border border-indigo-500/20 shrink-0">
            <Store className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">{customer.name}</h1>
            <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" /> {customer.phone}
            </p>
          </div>
        </div>
      </div>

      {/* Insights metrics strip */}
      <div className="grid grid-cols-2 gap-3.5">
        <div className="rounded-3xl border border-slate-900 bg-slate-900/30 p-4.5 backdrop-blur-xl">
          <span className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Total Orders</span>
          <span className="block text-2xl font-bold text-white mt-1.5 flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-indigo-400 shrink-0" />
            {totalOrders}
          </span>
        </div>

        <div className="rounded-3xl border border-slate-900 bg-slate-900/30 p-4.5 backdrop-blur-xl">
          <span className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Total Items Quantity</span>
          <span className="block text-2xl font-bold text-white mt-1.5 flex items-center gap-2">
            <Layers className="h-6 w-6 text-indigo-400 shrink-0" />
            {totalItemsCount}
          </span>
        </div>

        <div className="rounded-3xl border border-slate-900 bg-slate-900/30 p-4.5 backdrop-blur-xl">
          <span className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Last Order</span>
          <span className="block text-sm font-bold text-white mt-1.5 flex items-center gap-2 py-1">
            <Calendar className="h-5 w-5 text-indigo-400 shrink-0" />
            {lastOrderAgo === 'Never' ? 'None yet' : `${lastOrderAgo}`}
          </span>
        </div>

        <div className="rounded-3xl border border-slate-900 bg-slate-900/30 p-4.5 backdrop-blur-xl">
          <span className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Most Ordered Item</span>
          <span className="block text-xs font-bold text-white mt-1.5 truncate flex items-center gap-2 py-1.5">
            <TrendingUp className="h-5 w-5 text-indigo-400 shrink-0" />
            {mostOrderedItem}
          </span>
        </div>
      </div>

      {/* History List */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Order History</h2>

        {orders.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-900 p-8 text-center text-slate-500">
            No orders logged under this client yet.
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const isExpanded = expandedOrderId === order.id;
              const style = STATUS_STYLES[order.status];

              return (
                <div
                  key={order.id}
                  className={`rounded-3xl border border-slate-900 bg-slate-900/20 hover:bg-slate-900/40 backdrop-blur-xl overflow-hidden transition-all duration-200 ${
                    isExpanded ? 'ring-1 ring-indigo-500/20 bg-slate-900/35' : ''
                  }`}
                >
                  <div
                    onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                    className="flex items-center justify-between p-4 cursor-pointer select-none"
                  >
                    <div>
                      <span className="text-xs font-semibold text-white block">
                        Order logged {new Date(order.created_at).toLocaleDateString()}
                      </span>
                      <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-1">
                        <Clock className="h-3.5 w-3.5" />
                        {formatTimeAgo(order.created_at)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <StatusBadge status={order.status} />
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-slate-500" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-500" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-900/80 bg-slate-950/40 p-4 space-y-4">
                      {order.notes && (
                        <div>
                          <span className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                            Notes
                          </span>
                          <p className="text-xs text-slate-300 italic">{order.notes}</p>
                        </div>
                      )}

                      <div>
                        <span className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                          Items
                        </span>
                        <div className="rounded-2xl border border-slate-900 bg-slate-950/60 overflow-hidden divide-y divide-slate-900/60">
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

                      <button
                        onClick={() => shareToWhatsApp(order)}
                        className="w-full flex justify-center items-center gap-1.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 px-4 py-3.5 text-xs font-semibold text-white transition-all duration-200"
                      >
                        <Share2 className="h-4 w-4" />
                        Share Order Details via WhatsApp
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
