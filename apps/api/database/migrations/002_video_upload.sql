ALTER TABLE videos
    ADD COLUMN source_path TEXT;

ALTER TABLE videos
    DROP CONSTRAINT chk_videos_source_type;

ALTER TABLE videos
    ADD CONSTRAINT chk_videos_source_type
    CHECK (source_type IN ('url', 'upload'));
