-- Create Custom Enums
CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'delivered', 'paid');
CREATE TYPE order_unit AS ENUM ('piece', 'dozen', 'carton', 'kg', 'other');

-- Create Businesses Table
CREATE TABLE businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create Customers Table
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create Orders Table
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    status order_status NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create Order Items Table
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    quantity NUMERIC NOT NULL CHECK (quantity > 0),
    unit order_unit NOT NULL DEFAULT 'piece'
);

-- Create indexes for performance
CREATE INDEX idx_customers_business_id ON customers(business_id);
CREATE INDEX idx_orders_business_id ON orders(business_id);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- Enable Row Level Security (RLS)
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Helper function to extract user's business_id from JWT metadata
CREATE OR REPLACE FUNCTION get_auth_business_id()
RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('request.jwt.claims', true)::json->'user_metadata'->>'business_id', '')::UUID;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies for Businesses
CREATE POLICY businesses_policy ON businesses
    FOR ALL
    TO authenticated
    USING (id = get_auth_business_id())
    WITH CHECK (id = get_auth_business_id());

-- RLS Policies for Customers
CREATE POLICY customers_policy ON customers
    FOR ALL
    TO authenticated
    USING (business_id = get_auth_business_id())
    WITH CHECK (business_id = get_auth_business_id());

-- RLS Policies for Orders
CREATE POLICY orders_policy ON orders
    FOR ALL
    TO authenticated
    USING (business_id = get_auth_business_id())
    WITH CHECK (business_id = get_auth_business_id());

-- RLS Policies for Order Items
CREATE POLICY order_items_policy ON order_items
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = order_items.order_id
              AND orders.business_id = get_auth_business_id()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = order_items.order_id
              AND orders.business_id = get_auth_business_id()
        )
    );
