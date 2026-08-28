'use main-site';
'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Plus,
  Minus,
  Trash2,
  CheckCircle,
  Search,
  UserPlus,
  ArrowRight,
  Loader2,
  Sparkles,
} from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  phone: string;
}

interface OrderItemInput {
  item_name: string;
  quantity: string;
  unit: 'piece' | 'dozen' | 'carton' | 'kg' | 'other';
}

const COMMON_ITEMS = [
  'Tapal Danedar Tea 475g',
  'Dalda Cooking Oil 5L',
  'National Iodized Salt 800g',
  'Sufi Washing Soap',
  'Sufi Sunflower Oil 1L',
  'Shan Biryani Masala Box',
  'Lux Beauty Soap 150g',
  'Supreme Tea 950g',
  'Habib Cooking Oil 1L',
  'Arial Detergent Powder 1kg',
  'Sunsilk Shampoo 360ml',
  'Colgate Toothpaste 150g',
  'Shan Korma Masala Box',
  'Dalda Ghee 1kg Pack',
  'National Chili Sauce 300g',
  'National Tomato Ketchup 500g',
];

export default function NewOrder() {
  const supabase = createClient();

  // State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [businessId, setBusinessId] = useState<string | null>(null);

  // Form State
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  const [items, setItems] = useState<OrderItemInput[]>([
    { item_name: '', quantity: '1', unit: 'piece' },
  ]);
  const [notes, setNotes] = useState('');

  // UI Flow State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Suggestions state
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState<number | null>(null);
  const [focusedItemIndex, setFocusedItemIndex] = useState<number | null>(null);
  const [itemSuggestions, setItemSuggestions] = useState<string[]>([]);

  // Autocomplete Dropdowns visibility
  const [showCustDropdown, setShowCustDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch initial customer data & user profile
  useEffect(() => {
    async function loadData() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const bId = user.user_metadata?.business_id;
          setBusinessId(bId);

          if (bId) {
            const { data: custData, error: custError } = await supabase
              .from('customers')
              .select('id, name, phone')
              .eq('business_id', bId)
              .order('name', { ascending: true });

            if (custError) throw custError;
            setCustomers(custData || []);
          }
        }
      } catch (err) {
        console.error('Error loading customers:', err);
      } finally {
        setLoadingCustomers(false);
      }
    }
    loadData();
  }, [supabase]);

  // Click outside to close customer dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowCustDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter customers for dropdown
  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.phone.includes(customerSearch)
  );

  // Handle customer selection
  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomerId(customer.id);
    setCustomerSearch(customer.name);
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone);
    setIsNewCustomer(false);
    setShowCustDropdown(false);
    setErrorMsg(null);
  };

  // Switch to new customer input
  const handleToggleNewCustomer = () => {
    setIsNewCustomer(true);
    setSelectedCustomerId('');
    setCustomerName(customerSearch);
    setCustomerPhone('');
    setShowCustDropdown(false);
  };

  // Add Item Row
  const addItemRow = () => {
    setItems([...items, { item_name: '', quantity: '1', unit: 'piece' }]);
  };

  // Remove Item Row
  const removeItemRow = (index: number) => {
    if (items.length > 1) {
      const newItems = [...items];
      newItems.splice(index, 1);
      setItems(newItems);
    }
  };

  // Update Item Row
  const updateItemRow = (index: number, fields: Partial<OrderItemInput>) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], ...fields };
    setItems(newItems);

    // If item_name changed, compute suggestions
    if (fields.item_name !== undefined) {
      const val = fields.item_name;
      if (val.trim().length > 0) {
        const filtered = COMMON_ITEMS.filter((item) =>
          item.toLowerCase().includes(val.toLowerCase())
        ).slice(0, 5);
        setItemSuggestions(filtered);
      } else {
        setItemSuggestions([]);
      }
    }
  };

  // Quantity quick adjusters
  const adjustQuantity = (index: number, delta: number) => {
    const currentVal = parseFloat(items[index].quantity) || 0;
    const newVal = Math.max(1, currentVal + delta);
    updateItemRow(index, { quantity: newVal.toString() });
  };

  // Select item suggestion
  const handleSelectSuggestion = (index: number, suggestion: string) => {
    updateItemRow(index, { item_name: suggestion });
    setItemSuggestions([]);
    setFocusedItemIndex(null);
  };

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setErrorMsg(null);

    // Form Validations
    if (!businessId) {
      setErrorMsg('Business identity not found. Are you logged in?');
      return;
    }

    if (isNewCustomer) {
      if (!customerName.trim()) {
        setErrorMsg('Customer name is required.');
        return;
      }
      if (!customerPhone.trim()) {
        setErrorMsg('Customer phone number is required.');
        return;
      }
    } else {
      if (!selectedCustomerId) {
        setErrorMsg('Please select an existing customer or enter a new one.');
        return;
      }
    }

    // Validate Items
    for (let i = 0; i < items.length; i++) {
      if (!items[i].item_name.trim()) {
        setErrorMsg(`Item #${i + 1} name is empty.`);
        return;
      }
      const qty = parseFloat(items[i].quantity);
      if (isNaN(qty) || qty <= 0) {
        setErrorMsg(`Item #${i + 1} must have a quantity greater than 0.`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      let finalCustomerId = selectedCustomerId;

      // 1. Create customer if new
      if (isNewCustomer) {
        const { data: newCust, error: custError } = await supabase
          .from('customers')
          .insert({
            business_id: businessId,
            name: customerName.trim(),
            phone: customerPhone.trim(),
          })
          .select()
          .single();

        if (custError) throw custError;
        finalCustomerId = newCust.id;

        // Refresh local customers list
        setCustomers((prev) => [...prev, newCust].sort((a, b) => a.name.localeCompare(b.name)));
      }

      // 2. Create the order
      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert({
          business_id: businessId,
          customer_id: finalCustomerId,
          status: 'pending',
          notes: notes.trim() || null,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // 3. Create the order items
      const itemsToInsert = items.map((it) => ({
        order_id: newOrder.id,
        item_name: it.item_name.trim(),
        quantity: parseFloat(it.quantity),
        unit: it.unit,
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      // Success state!
      setSuccess(true);

      // Auto-reset form after 2.5 seconds
      setTimeout(() => {
        resetForm();
      }, 2500);
    } catch (err: any) {
      console.error('Submission error:', err);
      setErrorMsg(err.message || 'Failed to save order. Please check connections.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setIsNewCustomer(false);
    setSelectedCustomerId('');
    setCustomerSearch('');
    setCustomerName('');
    setCustomerPhone('');
    setItems([{ item_name: '', quantity: '1', unit: 'piece' }]);
    setNotes('');
    setSuccess(false);
    setErrorMsg(null);
  };

  if (success) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center p-6">
        <div className="rounded-full bg-emerald-500/10 p-6 text-emerald-400 ring-4 ring-emerald-500/20 animate-bounce">
          <CheckCircle className="h-16 w-16" />
        </div>
        <h2 className="mt-8 text-2xl font-bold text-white tracking-tight">Order Logged Successfully!</h2>
        <p className="mt-2 text-slate-400 text-sm max-w-sm">
          The order has been saved as <span className="text-emerald-400 font-semibold">pending</span>. 
          The form is resetting.
        </p>
        <button
          onClick={resetForm}
          className="mt-8 flex items-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg transition-all duration-200"
        >
          <span>Log Next Order</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Log New Order
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2 py-0.5 text-xs font-semibold text-indigo-400 ring-1 ring-inset ring-indigo-500/20">
              <Sparkles className="h-3 w-3" /> MVP
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Tap search to choose a customer, or add a new one inline.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-6 rounded-2xl bg-red-500/10 p-4 ring-1 ring-red-500/20 text-red-200 text-sm flex gap-3">
          <span className="font-bold text-red-400">Error:</span>
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer Selector card */}
        <div className="rounded-3xl border border-slate-900 bg-slate-900/30 p-5 backdrop-blur-xl space-y-4">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Customer Details</h2>

          {!isNewCustomer ? (
            <div className="relative" ref={dropdownRef}>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Search Shop/Customer</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Type shop name or phone..."
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setSelectedCustomerId('');
                    setShowCustDropdown(true);
                  }}
                  onFocus={() => setShowCustDropdown(true)}
                  className="block w-full rounded-2xl border-0 bg-slate-950/60 py-3.5 pl-10 pr-4 text-white ring-1 ring-inset ring-slate-800 placeholder:text-slate-600 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm transition-all duration-200"
                />
                <Search className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-500" />
              </div>

              {/* Customer Dropdown */}
              {showCustDropdown && (
                <div className="absolute z-50 mt-1.5 w-full rounded-2xl border border-slate-850 bg-slate-900 shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
                  {loadingCustomers ? (
                    <div className="p-4 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                      Loading customers...
                    </div>
                  ) : filteredCustomers.length > 0 ? (
                    <div>
                      {filteredCustomers.map((cust) => (
                        <button
                          key={cust.id}
                          type="button"
                          onClick={() => handleSelectCustomer(cust)}
                          className="w-full px-4 py-3.5 text-left text-sm hover:bg-slate-850 border-b border-slate-850/60 last:border-0 flex justify-between items-center transition-colors"
                        >
                          <span className="font-semibold text-white">{cust.name}</span>
                          <span className="text-xs text-slate-400">{cust.phone}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-sm text-slate-500">
                      No customer found matching &quot;{customerSearch}&quot;
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleToggleNewCustomer}
                    className="w-full px-4 py-4 text-left text-sm font-semibold text-indigo-400 bg-slate-950/40 hover:bg-slate-950/80 border-t border-slate-850 flex items-center gap-2 transition-all duration-200"
                  >
                    <UserPlus className="h-4 w-4" />
                    Add &quot;{customerSearch || 'New Customer'}&quot; Inline
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-indigo-400 flex items-center gap-1.5 bg-indigo-500/10 px-2.5 py-1 rounded-full">
                  <UserPlus className="h-3.5 w-3.5" /> New Customer Mode
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsNewCustomer(false);
                    setCustomerSearch('');
                    setCustomerName('');
                    setCustomerPhone('');
                  }}
                  className="text-xs text-slate-400 hover:text-white transition-colors"
                >
                  Select Existing
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Shop Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kashif General Store"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="block w-full rounded-2xl border-0 bg-slate-950/60 py-3.5 px-4 text-white ring-1 ring-inset ring-slate-800 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Phone Number</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. +923001234567"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="block w-full rounded-2xl border-0 bg-slate-950/60 py-3.5 px-4 text-white ring-1 ring-inset ring-slate-800 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm transition-all"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Items Card */}
        <div className="rounded-3xl border border-slate-900 bg-slate-900/30 p-5 backdrop-blur-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Order Items</h2>
            <button
              type="button"
              onClick={addItemRow}
              className="flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              <Plus className="h-4 w-4" /> Add Item
            </button>
          </div>

          <div className="space-y-4">
            {items.map((item, index) => (
              <div
                key={index}
                className="relative flex flex-col gap-3 p-4 rounded-2xl bg-slate-950/30 border border-slate-900/50"
              >
                {/* Item header (for multi-row readability) */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">Item #{index + 1}</span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItemRow(index)}
                      className="text-slate-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-4.5 w-4.5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  {/* Name field */}
                  <div className="relative sm:col-span-6">
                    <label className="block text-[10px] font-medium text-slate-500 mb-1">Item Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Tapal Tea"
                      value={item.item_name}
                      onChange={(e) => updateItemRow(index, { item_name: e.target.value })}
                      onFocus={() => setFocusedItemIndex(index)}
                      onBlur={() => {
                        // Delay closing suggestions to allow clicks to register
                        setTimeout(() => {
                          if (focusedItemIndex === index) setFocusedItemIndex(null);
                        }, 200);
                      }}
                      className="block w-full rounded-xl border-0 bg-slate-950/60 py-2.5 px-3 text-white ring-1 ring-inset ring-slate-800 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-xs transition-all"
                    />

                    {/* Item Autocomplete suggestions */}
                    {focusedItemIndex === index && itemSuggestions.length > 0 && (
                      <div className="absolute z-50 mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 shadow-xl overflow-hidden">
                        {itemSuggestions.map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => handleSelectSuggestion(index, suggestion)}
                            className="w-full px-3 py-2 text-left text-xs hover:bg-slate-800 text-slate-200 border-b border-slate-800/40 last:border-0 transition-colors"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Quantity with quick adjusters */}
                  <div className="sm:col-span-4">
                    <label className="block text-[10px] font-medium text-slate-500 mb-1">Quantity</label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        data-testid="qty-decrement"
                        onClick={() => adjustQuantity(index, -1)}
                        className="rounded-xl border border-slate-800 bg-slate-950/40 hover:bg-slate-900 p-2 text-slate-400 hover:text-white shrink-0 active:scale-95 transition-all"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <input
                        type="number"
                        data-testid="qty-input"
                        step="any"
                        required
                        value={item.quantity}
                        onChange={(e) => updateItemRow(index, { quantity: e.target.value })}
                        className="block w-full text-center rounded-xl border-0 bg-slate-950/60 py-2 px-2 text-white ring-1 ring-inset ring-slate-800 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-xs transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button
                        type="button"
                        data-testid="qty-increment"
                        onClick={() => adjustQuantity(index, 1)}
                        className="rounded-xl border border-slate-800 bg-slate-950/40 hover:bg-slate-900 p-2 text-slate-400 hover:text-white shrink-0 active:scale-95 transition-all"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Unit Selector */}
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-medium text-slate-500 mb-1">Unit</label>
                    <select
                      value={item.unit}
                      onChange={(e) =>
                        updateItemRow(index, {
                          unit: e.target.value as OrderItemInput['unit'],
                        })
                      }
                      className="block w-full rounded-xl border-0 bg-slate-950/60 py-2.5 px-2 text-white ring-1 ring-inset ring-slate-800 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-xs transition-all"
                    >
                      <option value="piece">piece</option>
                      <option value="dozen">dozen</option>
                      <option value="carton">carton</option>
                      <option value="kg">kg</option>
                      <option value="other">other</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addItemRow}
            className="w-full flex justify-center items-center gap-1.5 rounded-2xl border-2 border-dashed border-slate-800 hover:border-slate-700 py-3.5 text-sm font-medium text-slate-400 hover:text-slate-300 transition-all duration-200"
          >
            <Plus className="h-5 w-5" /> Add Another Item Row
          </button>
        </div>

        {/* Notes Card */}
        <div className="rounded-3xl border border-slate-900 bg-slate-900/30 p-5 backdrop-blur-xl space-y-3">
          <label className="block text-sm font-semibold text-slate-400 uppercase tracking-wider">Order Notes (Optional)</label>
          <textarea
            rows={2}
            placeholder="e.g. deliver next week, special discount..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="block w-full rounded-2xl border-0 bg-slate-950/60 py-3 px-4 text-white ring-1 ring-inset ring-slate-800 placeholder:text-slate-700 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm transition-all"
          />
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-full justify-center items-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 px-6 py-4 text-md font-semibold text-white shadow-xl hover:shadow-indigo-600/10 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01] transition-all duration-200"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-white" />
              Saving Order...
            </>
          ) : (
            <>
              <span>Log Order</span>
              <ArrowRight className="h-5 w-5" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
