-- ============================================================================
-- Migration: 新增 S3 影片支援
-- 從 HLS (KVS) 遷移到 S3 直接儲存
-- ============================================================================

-- 新增 video_s3_url 欄位到 test_results 表
ALTER TABLE test_results 
ADD COLUMN IF NOT EXISTS video_s3_url VARCHAR(500);

-- 建立索引（可選，如果常需要查詢有影片的結果）
CREATE INDEX IF NOT EXISTS idx_test_results_video_s3_url 
ON test_results(video_s3_url) 
WHERE video_s3_url IS NOT NULL;

-- 更新 sync_test_result 函數以支援 S3 URL
CREATE OR REPLACE FUNCTION sync_test_result(
    p_ulid VARCHAR(26),
    p_subject_ulid VARCHAR(26),
    p_test_type VARCHAR(50),
    p_test_name VARCHAR(100),
    p_result_value DECIMAL(10,2),
    p_result_unit VARCHAR(20),
    p_video_s3_url VARCHAR(500),      -- 新增：S3 影片 URL
    p_hls_stream_name VARCHAR(100),   -- 保留向下相容
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
        result_value, result_unit, video_s3_url, hls_stream_name,
        hls_start_time, hls_end_time, device_id, tested_at, synced_at, raw_data
    ) VALUES (
        p_ulid, v_subject_id, p_subject_ulid, p_test_type, p_test_name,
        p_result_value, p_result_unit, p_video_s3_url, p_hls_stream_name,
        p_hls_start_time, p_hls_end_time, p_device_id, p_tested_at, NOW(), p_raw_data
    )
    ON CONFLICT (ulid) DO UPDATE SET
        result_value = EXCLUDED.result_value,
        result_unit = EXCLUDED.result_unit,
        video_s3_url = EXCLUDED.video_s3_url,
        hls_stream_name = EXCLUDED.hls_stream_name,
        hls_start_time = EXCLUDED.hls_start_time,
        hls_end_time = EXCLUDED.hls_end_time,
        synced_at = NOW(),
        raw_data = EXCLUDED.raw_data
    RETURNING id INTO v_result_id;
    
    RETURN v_result_id;
END;
$$ LANGUAGE plpgsql;

-- 註解說明
COMMENT ON COLUMN test_results.video_s3_url IS 'S3 影片 URL，格式: s3://bucket/path/video.mp4 或 https://...';
COMMENT ON COLUMN test_results.hls_stream_name IS '(舊版) KVS HLS 串流名稱，保留向下相容';
