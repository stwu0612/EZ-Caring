-- ============================================================================
-- PX 體適能測試系統 - Supabase 數據庫結構
-- ============================================================================

-- 啟用 UUID 擴展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. 會員表 (Members) - 使用系統的管理員/操作員
-- ============================================================================
CREATE TABLE IF NOT EXISTS members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(50) DEFAULT 'operator',  -- admin, operator, viewer
    status VARCHAR(20) DEFAULT 'active',  -- active, inactive, pending
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 關聯到 Supabase Auth
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 會員索引
CREATE INDEX idx_members_email ON members(email);
CREATE INDEX idx_members_status ON members(status);

-- ============================================================================
-- 2. 受測者表 (Subjects) - 接受測試的人員
-- ============================================================================
CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ulid VARCHAR(26) UNIQUE NOT NULL,  -- 與 Android App 同步用
    name VARCHAR(100) NOT NULL,
    id_number VARCHAR(20),  -- 身分證字號（加密存儲）
    gender VARCHAR(10),  -- male, female
    birth_date DATE,
    age INTEGER,
    height DECIMAL(5,2),  -- 身高 cm
    weight DECIMAL(5,2),  -- 體重 kg
    
    -- 統計
    test_count INTEGER DEFAULT 0,
    
    -- 建立者
    created_by UUID REFERENCES members(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 軟刪除
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 受測者索引
CREATE INDEX idx_subjects_ulid ON subjects(ulid);
CREATE INDEX idx_subjects_name ON subjects(name);
CREATE INDEX idx_subjects_created_by ON subjects(created_by);

-- ============================================================================
-- 3. 測試結果表 (Test Results)
-- ============================================================================
CREATE TABLE IF NOT EXISTS test_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ulid VARCHAR(26) UNIQUE NOT NULL,  -- 與 Android App 同步用
    
    -- 關聯
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    subject_ulid VARCHAR(26) NOT NULL,  -- 冗餘存儲，方便同步
    
    -- 測試資訊
    test_type VARCHAR(50) NOT NULL,  -- sit_stand, walk_speed, balance_foot, etc.
    test_name VARCHAR(100),
    
    -- 結果
    result_value DECIMAL(10,2),
    result_unit VARCHAR(20),  -- 秒, m/s, cm, 度
    
    -- HLS 錄影
    hls_stream_name VARCHAR(100),
    hls_start_time TIMESTAMP WITH TIME ZONE,
    hls_end_time TIMESTAMP WITH TIME ZONE,
    
    -- 設備資訊
    device_id VARCHAR(50),
    
    -- 時間
    tested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    synced_at TIMESTAMP WITH TIME ZONE,  -- 同步時間
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 原始 JSON（備份）
    raw_data JSONB
);

-- 測試結果索引
CREATE INDEX idx_test_results_ulid ON test_results(ulid);
CREATE INDEX idx_test_results_subject_id ON test_results(subject_id);
CREATE INDEX idx_test_results_subject_ulid ON test_results(subject_ulid);
CREATE INDEX idx_test_results_test_type ON test_results(test_type);
CREATE INDEX idx_test_results_tested_at ON test_results(tested_at DESC);

-- ============================================================================
-- 4. SPPB 評估結果表
-- ============================================================================
CREATE TABLE IF NOT EXISTS sppb_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    
    -- 分項分數
    chair_stand_score INTEGER DEFAULT 0,  -- 0-4
    walking_speed_score INTEGER DEFAULT 0,  -- 0-4
    balance_score INTEGER DEFAULT 0,  -- 0-4
    
    -- 總分
    total_score INTEGER DEFAULT 0,  -- 0-12
    
    -- 風險評估
    risk_level VARCHAR(20),  -- low, moderate, high
    
    -- 關聯的測試結果
    chair_stand_result_id UUID REFERENCES test_results(id),
    walking_speed_result_id UUID REFERENCES test_results(id),
    balance_parallel_result_id UUID REFERENCES test_results(id),
    balance_semi_result_id UUID REFERENCES test_results(id),
    balance_tandem_result_id UUID REFERENCES test_results(id),
    
    assessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SPPB 索引
CREATE INDEX idx_sppb_subject_id ON sppb_assessments(subject_id);
CREATE INDEX idx_sppb_assessed_at ON sppb_assessments(assessed_at DESC);

-- ============================================================================
-- 5. 同步日誌表 (Sync Logs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- 同步來源
    source VARCHAR(50) NOT NULL,  -- android_app, web_admin
    device_id VARCHAR(50),
    
    -- 同步內容
    sync_type VARCHAR(50) NOT NULL,  -- subjects, test_results, full
    records_synced INTEGER DEFAULT 0,
    
    -- 狀態
    status VARCHAR(20) DEFAULT 'success',  -- success, partial, failed
    error_message TEXT,
    
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 6. 觸發器：自動更新 updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_members_updated_at
    BEFORE UPDATE ON members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_subjects_updated_at
    BEFORE UPDATE ON subjects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 7. 觸發器：自動更新受測者的測試次數
-- ============================================================================
CREATE OR REPLACE FUNCTION update_subject_test_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE subjects SET test_count = test_count + 1 WHERE id = NEW.subject_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE subjects SET test_count = test_count - 1 WHERE id = OLD.subject_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_test_count
    AFTER INSERT OR DELETE ON test_results
    FOR EACH ROW EXECUTE FUNCTION update_subject_test_count();

-- ============================================================================
-- 8. Row Level Security (RLS)
-- ============================================================================
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE sppb_assessments ENABLE ROW LEVEL SECURITY;

-- 會員政策：已登入用戶可讀，管理員可寫
CREATE POLICY "Members are viewable by authenticated users" ON members
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Members are editable by admins" ON members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM members m 
            WHERE m.auth_user_id = auth.uid() AND m.role = 'admin'
        )
    );

-- 受測者政策：已登入用戶可讀寫
CREATE POLICY "Subjects are viewable by authenticated users" ON subjects
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Subjects are editable by authenticated users" ON subjects
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Subjects are updatable by authenticated users" ON subjects
    FOR UPDATE USING (auth.role() = 'authenticated');

-- 測試結果政策：已登入用戶可讀寫
CREATE POLICY "Test results are viewable by authenticated users" ON test_results
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Test results are insertable by authenticated users" ON test_results
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- SPPB 政策
CREATE POLICY "SPPB assessments are viewable by authenticated users" ON sppb_assessments
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "SPPB assessments are insertable by authenticated users" ON sppb_assessments
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ============================================================================
-- 9. 視圖：受測者詳細資訊（含最近測試）
-- ============================================================================
CREATE OR REPLACE VIEW subjects_with_latest_test AS
SELECT 
    s.*,
    m.name as created_by_name,
    (
        SELECT tested_at 
        FROM test_results tr 
        WHERE tr.subject_id = s.id 
        ORDER BY tested_at DESC 
        LIMIT 1
    ) as latest_test_at
FROM subjects s
LEFT JOIN members m ON s.created_by = m.id
WHERE s.deleted_at IS NULL;

-- ============================================================================
-- 10. 函數：同步測試結果（upsert）
-- ============================================================================
CREATE OR REPLACE FUNCTION sync_test_result(
    p_ulid VARCHAR(26),
    p_subject_ulid VARCHAR(26),
    p_test_type VARCHAR(50),
    p_test_name VARCHAR(100),
    p_result_value DECIMAL(10,2),
    p_result_unit VARCHAR(20),
    p_hls_stream_name VARCHAR(100),
    p_hls_start_time TIMESTAMP WITH TIME ZONE,
    p_hls_end_time TIMESTAMP WITH TIME ZONE,
    p_device_id VARCHAR(50),
    p_tested_at TIMESTAMP WITH TIME ZONE,
    p_raw_data JSONB
)
RETURNS UUID AS $$
DECLARE
    v_subject_id UUID;
    v_result_id UUID;
BEGIN
    -- 查找 subject
    SELECT id INTO v_subject_id FROM subjects WHERE ulid = p_subject_ulid;
    
    -- Upsert 測試結果
    INSERT INTO test_results (
        ulid, subject_id, subject_ulid, test_type, test_name,
        result_value, result_unit, hls_stream_name,
        hls_start_time, hls_end_time, device_id, tested_at, synced_at, raw_data
    ) VALUES (
        p_ulid, v_subject_id, p_subject_ulid, p_test_type, p_test_name,
        p_result_value, p_result_unit, p_hls_stream_name,
        p_hls_start_time, p_hls_end_time, p_device_id, p_tested_at, NOW(), p_raw_data
    )
    ON CONFLICT (ulid) DO UPDATE SET
        result_value = EXCLUDED.result_value,
        result_unit = EXCLUDED.result_unit,
        hls_stream_name = EXCLUDED.hls_stream_name,
        hls_start_time = EXCLUDED.hls_start_time,
        hls_end_time = EXCLUDED.hls_end_time,
        synced_at = NOW(),
        raw_data = EXCLUDED.raw_data
    RETURNING id INTO v_result_id;
    
    RETURN v_result_id;
END;
$$ LANGUAGE plpgsql;
