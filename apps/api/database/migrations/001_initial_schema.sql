
CREATE TABLE videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255),
    source_type VARCHAR(20) NOT NULL,
    source_url TEXT NOT NULL,
    duration_seconds INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_videos_source_type
        CHECK (source_type IN ('url'))
);

CREATE TABLE translation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'queued',
    progress INTEGER NOT NULL DEFAULT 0,
    current_step VARCHAR(50),
    processing_seconds DOUBLE PRECISION,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    CONSTRAINT chk_jobs_status
        CHECK (status IN (
            'queued', 'processing', 'completed', 'failed'
        )),
    CONSTRAINT chk_jobs_progress
        CHECK (progress BETWEEN 0 AND 100)
);

CREATE TABLE subtitle_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    sequence INTEGER NOT NULL,
    start_ms INTEGER NOT NULL,
    end_ms INTEGER NOT NULL,
    original_text TEXT NOT NULL,
    translated_text TEXT NOT NULL,

    CONSTRAINT chk_subtitle_timing
        CHECK (start_ms >= 0 AND end_ms > start_ms),
    CONSTRAINT uq_subtitle_sequence
        UNIQUE (video_id, sequence)
);

CREATE INDEX idx_videos_created_at
    ON videos(created_at DESC);

CREATE INDEX idx_jobs_status_created_at
    ON translation_jobs(status, created_at DESC);

CREATE INDEX idx_jobs_video_id
    ON translation_jobs(video_id);

CREATE INDEX idx_subtitles_video_sequence
    ON subtitle_segments(video_id, sequence);
