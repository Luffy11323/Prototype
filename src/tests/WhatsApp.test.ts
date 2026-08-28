import { describe, it, expect } from 'vitest';
import { generateWhatsAppMessage, generateWhatsAppLink } from '../lib/whatsapp';

describe('WhatsApp Link and Message Builder', () => {
  const mockOrder = {
    created_at: '2026-08-28T10:00:00.000Z',
    status: 'pending',
    notes: 'Fragile items, pack carefully.',
    order_items: [
      { item_name: 'Tapal Danedar Tea 475g', quantity: 12, unit: 'piece' },
      { item_name: 'Dalda Cooking Oil 5L', quantity: 2, unit: 'carton' },
    ],
  };

  it('should generate a correctly formatted order text summary', () => {
    const message = generateWhatsAppMessage(mockOrder, 'Kashif General Store');

    expect(message).toContain('*Order details for Kashif General Store*');
    expect(message).toContain('Status: *PENDING*');
    expect(message).toContain('1. Tapal Danedar Tea 475g - 12 piece(s)');
    expect(message).toContain('2. Dalda Cooking Oil 5L - 2 carton(s)');
    expect(message).toContain('*Notes:* Fragile items, pack carefully.');
    expect(message).toContain('Logged via Order Tracker MVP.');
  });

  it('should omit notes section when notes are null', () => {
    const orderNoNotes = { ...mockOrder, notes: null };
    const message = generateWhatsAppMessage(orderNoNotes, 'Kashif General Store');

    expect(message).not.toContain('*Notes:*');
  });

  it('should construct a valid wa.me URL with clean phone numbers', () => {
    const rawPhone = '+92 (300) 123-4567';
    const message = 'Hello World';
    const link = generateWhatsAppLink(rawPhone, message);

    expect(link).toBe('https://wa.me/+923001234567?text=Hello%20World');
  });
});
