CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id VARCHAR(50) NOT NULL,
    thing_name VARCHAR(100),
    member_id UUID REFERENCES members(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'active',
    certificate_id VARCHAR(100),
    provisioned_at TIMESTAMP WITH TIME ZONE,
    last_seen_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_device_id UNIQUE (device_id),
    CONSTRAINT unique_thing_name UNIQUE (thing_name)
);

CREATE INDEX idx_devices_device_id ON devices(device_id);
CREATE INDEX idx_devices_member_id ON devices(member_id);

CREATE TRIGGER trigger_devices_updated_at
    BEFORE UPDATE ON devices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own devices" ON devices
    FOR SELECT USING (member_id IN (SELECT id FROM members WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can insert devices" ON devices
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own devices" ON devices
    FOR UPDATE USING (member_id IN (SELECT id FROM members WHERE auth_user_id = auth.uid()));
