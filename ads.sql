CREATE TABLE ads (
    id SERIAL PRIMARY KEY,
    merchant_id INTEGER NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    img VARCHAR(1024) NOT NULL,
    provided_product INTEGER REFERENCES products(id) ON DELETE SET NULL,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_date TIMESTAMP WITH TIME ZONE NULL,
    daily_budget DECIMAL NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS and add basic policies if needed (assuming public usage or service role overrides)
ALTER TABLE ads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone." ON ads FOR SELECT USING (true);
CREATE POLICY "Service role can insert" ON ads FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can update" ON ads FOR UPDATE USING (true);
CREATE POLICY "Service role can delete" ON ads FOR DELETE USING (true);
