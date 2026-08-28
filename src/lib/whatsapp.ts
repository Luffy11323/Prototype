export interface WhatsAppOrderItem {
  item_name: string;
  quantity: number;
  unit: string;
}

export interface WhatsAppOrder {
  created_at: string;
  status: string;
  notes: string | null;
  order_items: WhatsAppOrderItem[];
}

/**
 * Generates a clean, readable text summary of the order for WhatsApp.
 */
export function generateWhatsAppMessage(order: WhatsAppOrder, customerName: string): string {
  const dateStr = new Date(order.created_at).toLocaleDateString();
  let msg = `*Order details for ${customerName}*\n`;
  msg += `Status: *${order.status.toUpperCase()}*\n`;
  msg += `Date: ${dateStr}\n\n`;
  msg += `*Items List:*\n`;
  
  order.order_items.forEach((item, index) => {
    msg += `${index + 1}. ${item.item_name} - ${item.quantity} ${item.unit}(s)\n`;
  });

  if (order.notes) {
    msg += `\n*Notes:* ${order.notes}\n`;
  }

  msg += `\nLogged via Order Tracker MVP.`;
  return msg;
}

/**
 * Generates a wa.me URL for the customer phone number and encoded message.
 */
export function generateWhatsAppLink(phone: string, message: string): string {
  const formattedPhone = phone.replace(/[^0-9+]/g, '');
  const encodedText = encodeURIComponent(message);
  return `https://wa.me/${formattedPhone}?text=${encodedText}`;
}
