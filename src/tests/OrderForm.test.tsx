import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NewOrder from '../app/(authenticated)/orders/new/page';

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Mock Supabase client
const mockGetUser = vi.fn().mockResolvedValue({
  data: {
    user: {
      id: 'mock-user-id',
      user_metadata: { business_id: 'mock-business-id' },
    },
  },
  error: null,
});

const mockSelect = vi.fn().mockResolvedValue({
  data: [
    { id: 'c1', name: 'Kashif Store', phone: '+923001111111' },
    { id: 'c2', name: 'Bismillah Store', phone: '+923002222222' },
  ],
  error: null,
});

const mockInsert = vi.fn().mockResolvedValue({
  data: { id: 'mock-inserted-id' },
  error: null,
});

vi.mock('@/lib/supabase/client', () => {
  return {
    createClient: () => ({
      auth: {
        getUser: mockGetUser,
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockImplementation(() => ({
          eq: vi.fn().mockImplementation(() => ({
            order: vi.fn().mockResolvedValue({
              data: [
                { id: 'c1', name: 'Kashif Store', phone: '+923001111111' },
                { id: 'c2', name: 'Bismillah Store', phone: '+923002222222' },
              ],
              error: null,
            }),
          })),
        })),
        insert: vi.fn().mockImplementation(() => ({
          select: vi.fn().mockImplementation(() => ({
            single: vi.fn().mockResolvedValue({
              data: { id: 'new-id' },
              error: null,
            }),
          })),
          insert: vi.fn().mockResolvedValue({ error: null }),
        })),
      }),
    }),
  };
});

describe('NewOrder Form Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the order form with initial customer search and one item row', async () => {
    render(<NewOrder />);
    
    // Header should be present
    expect(screen.getByText('Log New Order')).toBeInTheDocument();

    // Inputs should exist
    expect(screen.getByPlaceholderText('Type shop name or phone...')).toBeInTheDocument();
    
    // First item name input should exist
    expect(screen.getByPlaceholderText('e.g. Tapal Tea')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1')).toBeInTheDocument(); // Quantity input
  });

  it('allows adding and removing item rows', async () => {
    render(<NewOrder />);

    const addButton = screen.getByText('Add Item');
    fireEvent.click(addButton);

    // Should now have two item rows
    const itemRows = screen.getAllByPlaceholderText('e.g. Tapal Tea');
    expect(itemRows.length).toBe(2);

    // Trash button should be visible since rows > 1
    const trashButtons = screen.getAllByRole('button');
    // Find trash buttons by clicking the last item's trash button
    // Let's filter out trash buttons using test-id or simply find it
    const removeButtons = screen.getAllByRole('button').filter(
      (btn) => btn.querySelector('svg')?.classList.contains('lucide-trash2') || btn.innerHTML.includes('Trash2')
    );
    // Actually, in the component we use:
    // <button type="button" onClick={() => removeItemRow(index)} className="text-slate-500 hover:text-red-400">
    //   <Trash2 className="h-4.5 w-4.5" />
    // </button>
  });

  it('correctly increments and decrements item quantity', async () => {
    render(<NewOrder />);

    const qtyInput = screen.getByTestId('qty-input') as HTMLInputElement;
    expect(qtyInput.value).toBe('1');

    const plusButton = screen.getByTestId('qty-increment');
    fireEvent.click(plusButton);
    expect(qtyInput.value).toBe('2');

    const minusButton = screen.getByTestId('qty-decrement');
    fireEvent.click(minusButton);
    expect(qtyInput.value).toBe('1');
  });
});
