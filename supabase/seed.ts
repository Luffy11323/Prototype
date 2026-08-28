import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: NEXT_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const DEMO_BUSINESS_ID = 'd3b07384-d113-4ec6-a558-75b2b2959828';
const DEMO_EMAIL = 'demo@distributor.pk';
const DEMO_PASSWORD = 'password123';

async function seed() {
  console.log('Starting database seeding...');

  // 1. Delete existing demo business (cascading deletes customers, orders, order_items)
  console.log('Cleaning up existing demo business data...');
  await supabase.from('businesses').delete().eq('id', DEMO_BUSINESS_ID);

  // 2. Delete existing auth user if they exist
  console.log('Cleaning up existing auth user...');
  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error('Error listing users:', listError);
  } else {
    const existingUser = usersData.users.find((u) => u.email === DEMO_EMAIL);
    if (existingUser) {
      await supabase.auth.admin.deleteUser(existingUser.id);
      console.log('Deleted existing demo user.');
    }
  }

  // 3. Create demo business
  console.log('Inserting demo business...');
  const { error: businessError } = await supabase.from('businesses').insert({
    id: DEMO_BUSINESS_ID,
    name: 'Pak Wholesale FMCG',
    owner_email: DEMO_EMAIL,
  });

  if (businessError) {
    console.error('Error creating business:', businessError);
    process.exit(1);
  }

  // 4. Create demo auth user with business_id in metadata
  console.log('Creating auth user with metadata...');
  const { data: userData, error: userError } = await supabase.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: {
      business_id: DEMO_BUSINESS_ID,
    },
  });

  if (userError) {
    console.error('Error creating user:', userError);
    process.exit(1);
  }
  console.log(`Created auth user: ${userData.user.email} (${userData.user.id})`);

  // 5. Insert Pakistani customers
  console.log('Inserting customers...');
  const customers = [
    { name: 'Kashif General Store', phone: '+923001234567', business_id: DEMO_BUSINESS_ID },
    { name: 'Bismillah Kiryana Store', phone: '+923129876543', business_id: DEMO_BUSINESS_ID },
    { name: 'Al-Madina Supermart', phone: '+923214567890', business_id: DEMO_BUSINESS_ID },
    { name: 'Lahore Wholesale House', phone: '+923337654321', business_id: DEMO_BUSINESS_ID },
    { name: 'Karachi Mart', phone: '+923451122334', business_id: DEMO_BUSINESS_ID },
  ];

  const { data: seededCustomers, error: customersError } = await supabase
    .from('customers')
    .insert(customers)
    .select();

  if (customersError || !seededCustomers) {
    console.error('Error inserting customers:', customersError);
    process.exit(1);
  }

  const custMap = Object.fromEntries(seededCustomers.map((c) => [c.name, c.id]));
  console.log(`Seeded ${seededCustomers.length} customers.`);

  // 6. Insert sample orders with order items
  console.log('Inserting orders & order items...');

  const ordersData = [
    {
      customerName: 'Kashif General Store',
      status: 'pending',
      notes: 'Please deliver after 2 PM. Call before coming.',
      createdOffsetDays: 0, // today
      items: [
        { item_name: 'Tapal Danedar Tea 475g', quantity: 24, unit: 'piece' },
        { item_name: 'Dalda Cooking Oil 5L', quantity: 10, unit: 'carton' },
      ],
    },
    {
      customerName: 'Bismillah Kiryana Store',
      status: 'confirmed',
      notes: 'Urgent order.',
      createdOffsetDays: 1, // yesterday
      items: [
        { item_name: 'National Iodized Salt 800g', quantity: 5, unit: 'carton' },
        { item_name: 'Sufi Washing Soap', quantity: 20, unit: 'dozen' },
        { item_name: 'Sufi Sunflower Oil 1L', quantity: 12, unit: 'piece' },
      ],
    },
    {
      customerName: 'Al-Madina Supermart',
      status: 'delivered',
      notes: 'Payment check will be cleared next week.',
      createdOffsetDays: 3,
      items: [
        { item_name: 'Shan Biryani Masala Box', quantity: 48, unit: 'piece' },
        { item_name: 'Lux Beauty Soap 150g', quantity: 15, unit: 'carton' },
      ],
    },
    {
      customerName: 'Lahore Wholesale House',
      status: 'paid',
      notes: 'Cleared full payment via Bank Transfer.',
      createdOffsetDays: 5,
      items: [
        { item_name: 'Supreme Tea 950g', quantity: 30, unit: 'piece' },
        { item_name: 'Habib Cooking Oil 1L', quantity: 20, unit: 'carton' },
        { item_name: 'Arial Detergent Powder 1kg', quantity: 40, unit: 'piece' },
      ],
    },
    {
      customerName: 'Karachi Mart',
      status: 'pending',
      notes: '',
      createdOffsetDays: 1,
      items: [
        { item_name: 'Sunsilk Shampoo 360ml', quantity: 2, unit: 'carton' },
        { item_name: 'Colgate Toothpaste 150g', quantity: 60, unit: 'piece' },
      ],
    },
    {
      customerName: 'Kashif General Store',
      status: 'delivered',
      notes: 'Delivered successfully.',
      createdOffsetDays: 7,
      items: [
        { item_name: 'Tapal Danedar Tea 475g', quantity: 12, unit: 'piece' },
        { item_name: 'Shan Korma Masala Box', quantity: 24, unit: 'piece' },
      ],
    },
    {
      customerName: 'Bismillah Kiryana Store',
      status: 'paid',
      notes: 'Paid cash on delivery.',
      createdOffsetDays: 10,
      items: [
        { item_name: 'Dalda Ghee 1kg Pack', quantity: 50, unit: 'piece' },
      ],
    },
    {
      customerName: 'Al-Madina Supermart',
      status: 'confirmed',
      notes: 'Deliver along with next shipment.',
      createdOffsetDays: 2,
      items: [
        { item_name: 'National Chili Sauce 300g', quantity: 3, unit: 'carton' },
        { item_name: 'National Tomato Ketchup 500g', quantity: 5, unit: 'carton' },
      ],
    },
    {
      customerName: 'Karachi Mart',
      status: 'delivered',
      notes: 'Driver reported delivery completed.',
      createdOffsetDays: 4,
      items: [
        { item_name: 'Sufi Washing Soap', quantity: 10, unit: 'dozen' },
      ],
    },
    {
      customerName: 'Lahore Wholesale House',
      status: 'pending',
      notes: 'Inquired about discounts on tea bags.',
      createdOffsetDays: 2,
      items: [
        { item_name: 'Supreme Tea 950g', quantity: 10, unit: 'piece' },
      ],
    },
  ];

  for (const ord of ordersData) {
    const custId = custMap[ord.customerName];
    if (!custId) continue;

    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - ord.createdOffsetDays);

    const { data: seededOrder, error: orderError } = await supabase
      .from('orders')
      .insert({
        business_id: DEMO_BUSINESS_ID,
        customer_id: custId,
        status: ord.status,
        notes: ord.notes || null,
        created_at: createdAt.toISOString(),
        updated_at: createdAt.toISOString(),
      })
      .select()
      .single();

    if (orderError || !seededOrder) {
      console.error(`Error inserting order for ${ord.customerName}:`, orderError);
      process.exit(1);
    }

    const itemsToInsert = ord.items.map((it) => ({
      order_id: seededOrder.id,
      item_name: it.item_name,
      quantity: it.quantity,
      unit: it.unit,
    }));

    const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert);

    if (itemsError) {
      console.error(`Error inserting order items for order ${seededOrder.id}:`, itemsError);
      process.exit(1);
    }
  }

  console.log('Database seeding completed successfully!');
}

seed().catch((err) => {
  console.error('Seeding crashed:', err);
  process.exit(1);
});
