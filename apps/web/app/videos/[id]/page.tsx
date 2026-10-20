
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import type {
  SubtitleSegment,
  VideoDetail,
} from '../../_lib/dashboard-types';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type UpdateSubtitleResponse = {
  message: string;
  subtitle: SubtitleSegment;
};

function formatTimestamp(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const ms = milliseconds % 1000;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

function formatClock(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function escapeSubtitleText(text: string): string {
  return text.replace(/\r?\n/g, '\n');
}

export default function VideoDetailPage() {
  const params = useParams<{ id: string }>();
  const videoId = params.id;
  const playerRef = useRef<HTMLVideoElement>(null);

  const [video, setVideo] = useState<VideoDetail | null>(null);
  const [segments, setSegments] = useState<SubtitleSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [videoResponse, subtitleResponse] = await Promise.all([
        fetch(`${API_URL}/videos/${videoId}`, { cache: 'no-store' }),
        fetch(`${API_URL}/videos/${videoId}/subtitles`, {
          cache: 'no-store',
        }),
      ]);

      if (!videoResponse.ok) {
        throw new Error(
          videoResponse.status === 404
            ? 'Không tìm thấy video.'
            : 'Không thể tải thông tin video.',
        );
      }

      if (!subtitleResponse.ok) {
        throw new Error('Không thể tải danh sách phụ đề.');
      }

      const videoData = (await videoResponse.json()) as VideoDetail;
      const subtitleData =
        (await subtitleResponse.json()) as SubtitleSegment[];

      setVideo(videoData);
      setSegments(subtitleData);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Đã xảy ra lỗi khi tải dữ liệu.',
      );
    } finally {
      setLoading(false);
    }
  }, [videoId]);

  useEffect(() => {
    const initialFetchId = window.setTimeout(() => {
      void fetchData();
    }, 0);

    return () => window.clearTimeout(initialFetchId);
  }, [fetchData]);

  const activeSegment = segments.find(
    (segment) =>
      currentTimeMs >= segment.startMs &&
      currentTimeMs < segment.endMs,
  );

  function seekTo(milliseconds: number) {
    const player = playerRef.current;
    if (!player) return;

    player.currentTime = milliseconds / 1000;
    setCurrentTimeMs(milliseconds);
  }

  function startEditing(segment: SubtitleSegment) {
    setEditingId(segment.id);
    setDraft(segment.translatedText);
    setError('');
    setNotice('');
  }

  function cancelEditing() {
    setEditingId(null);
    setDraft('');
    setError('');
  }

  async function saveTranslation(segment: SubtitleSegment) {
    const translatedText = draft.trim();

    if (!translatedText) {
      setError('Bản dịch không được để trống.');
      return;
    }

    setSavingId(segment.id);
    setError('');
    setNotice('');

    try {
      const response = await fetch(
        `${API_URL}/videos/${videoId}/subtitles/${segment.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ translatedText }),
        },
      );

      const result = (await response.json()) as
        | UpdateSubtitleResponse
        | { message?: string | string[] };

      if (!response.ok) {
        const message = result.message;

        throw new Error(
          Array.isArray(message)
            ? message.join(', ')
            : message || 'Không thể lưu bản dịch.',
        );
      }

      const updated = (result as UpdateSubtitleResponse).subtitle;

      setSegments((current) =>
        current.map((item) =>
          item.id === updated.id ? updated : item,
        ),
      );

      setEditingId(null);
      setDraft('');
      setNotice(`Đã lưu bản dịch câu ${segment.sequence}.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Không thể lưu bản dịch.',
      );
    } finally {
      setSavingId(null);
    }
  }

  function downloadSrt() {
    if (segments.length === 0) return;

    setDownloading(true);

    try {
      const content = segments
        .map((segment, index) =>
          [
            String(index + 1),
            `${formatTimestamp(segment.startMs)} --> ${formatTimestamp(segment.endMs)}`,
            escapeSubtitleText(segment.translatedText),
            '',
          ].join('\n'),
        )
        .join('\n');

      const blob = new Blob(['\uFEFF', content], {
        type: 'text/plain;charset=utf-8',
      });

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');

      anchor.href = url;
      anchor.download = `${(video?.title || 'subflow-subtitles').replace(/\.mp4$/i, '')}.vi.srt`;

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return (
      <main className="detail-page">
        <p>Đang tải thông tin video và phụ đề...</p>
      </main>
    );
  }

  if (error && !video) {
    return (
      <main className="detail-page">
        <Link className="back-link" href="/">
          ← Quay lại dashboard
        </Link>

        <div className="detail-message error" role="alert">
          {error}
        </div>

        <button className="detail-button" onClick={() => void fetchData()}>
          Thử lại
        </button>
      </main>
    );
  }

  if (!video) {
    return (
      <main className="detail-page">
        <Link className="back-link" href="/">
          ← Quay lại dashboard
        </Link>
        <div className="detail-message">Không tìm thấy video.</div>
      </main>
    );
  }

  return (
    <main className="detail-page">
      <header className="detail-header">
        <Link className="back-link" href="/">
          ← Dashboard
        </Link>

        <div className="detail-heading">
          <div>
            <p className="detail-eyebrow">SUBFLOW / VIDEO WORKSPACE</p>
            <h1>{video.title || 'Video chưa có tiêu đề'}</h1>
            <p className="detail-description">
              Xem video, đồng bộ phụ đề và chỉnh sửa bản dịch tiếng Việt.
            </p>
          </div>

          <button
            className="detail-button detail-button-primary"
            onClick={downloadSrt}
            disabled={segments.length === 0 || downloading}
          >
            {downloading ? 'Đang xuất...' : '↓ Tải phụ đề SRT'}
          </button>
        </div>

        <div className="detail-stats">
          <div className="detail-stat">
            <span>Tổng số câu</span>
            <strong>{segments.length}</strong>
          </div>

          <div className="detail-stat">
            <span>Ngôn ngữ gốc</span>
            <strong>Tiếng Nhật</strong>
          </div>

          <div className="detail-stat">
            <span>Bản dịch</span>
            <strong>Tiếng Việt</strong>
          </div>
        </div>
      </header>

      {error && (
        <div className="detail-message error" role="alert">
          {error}
        </div>
      )}

      {notice && (
        <div className="detail-message success" role="status">
          {notice}
        </div>
      )}

      <section className="video-player-section">
        <div className="subtitle-section-heading">
          <div>
            <h2>Trình phát video</h2>
            <p>
              Phụ đề tiếng Việt sẽ tự thay đổi theo thời gian phát.
            </p>
          </div>
        </div>

        <div className="video-player-layout">
          <div className="video-player-column">
            <video
              ref={playerRef}
              className="subflow-video-player"
              src={`${API_URL}/videos/${videoId}/stream`}
              controls
              playsInline
              preload="metadata"
              onTimeUpdate={(event) =>
                setCurrentTimeMs(
                  Math.floor(event.currentTarget.currentTime * 1000),
                )
              }
              onSeeked={(event) =>
                setCurrentTimeMs(
                  Math.floor(event.currentTarget.currentTime * 1000),
                )
              }
              onError={() =>
                setError(
                  'Không thể phát video. Hãy kiểm tra file upload và API streaming.',
                )
              }
            />

            <div className="live-subtitle-panel" aria-live="polite">
              <span className="subtitle-language-label">
                VI · PHỤ ĐỀ ĐANG PHÁT
              </span>

              <p>
                {activeSegment?.translatedText ||
                  'Phụ đề sẽ xuất hiện tại thời điểm tương ứng trong video.'}
              </p>
            </div>
          </div>

          <aside className="video-timeline">
            <div className="video-timeline-heading">
              <strong>Phụ đề theo thời gian</strong>
              <span>{formatClock(currentTimeMs)}</span>
            </div>

            <div className="video-timeline-list">
              {segments.map((segment) => {
                const isActive =
                  currentTimeMs >= segment.startMs &&
                  currentTimeMs < segment.endMs;

                return (
                  <button
                    type="button"
                    key={segment.id}
                    className={`video-timeline-item${isActive ? ' active' : ''}`}
                    onClick={() => seekTo(segment.startMs)}
                    title={`Tua đến ${formatClock(segment.startMs)}`}
                  >
                    <span>{formatClock(segment.startMs)}</span>
                    <span>{segment.translatedText || segment.originalText}</span>
                  </button>
                );
              })}
            </div>
          </aside>
        </div>
      </section>

      <section className="subtitle-section">
        <div className="subtitle-section-heading">
          <div>
            <h2>Danh sách phụ đề</h2>
            <p>
              Bấm vào mốc thời gian để tua video; chọn sửa để cập nhật bản dịch.
            </p>
          </div>

          <button
            className="detail-button"
            onClick={() => void fetchData()}
            disabled={savingId !== null}
          >
            ↻ Làm mới
          </button>
        </div>

        {segments.length === 0 ? (
          <div className="detail-message">
            Video chưa có phụ đề. Hãy kiểm tra trạng thái xử lý của video.
          </div>
        ) : (
          <div className="subtitle-list">
            {segments.map((segment) => {
              const isEditing = editingId === segment.id;
              const isSaving = savingId === segment.id;
              const isActive =
                currentTimeMs >= segment.startMs &&
                currentTimeMs < segment.endMs;

              return (
                <article
                  className={`subtitle-card${isActive ? ' subtitle-card-active' : ''}`}
                  key={segment.id}
                >
                  <div className="subtitle-card-top">
                    <span className="subtitle-number">
                      {String(segment.sequence).padStart(2, '0')}
                    </span>

                    <button
                      type="button"
                      className="subtitle-time subtitle-seek-button"
                      onClick={() => seekTo(segment.startMs)}
                      title="Tua video đến câu này"
                    >
                      ▶ {formatClock(segment.startMs)} –{' '}
                      {formatClock(segment.endMs)}
                    </button>
                  </div>

                  <div className="subtitle-content">
                    <div className="subtitle-language-block">
                      <span className="subtitle-language-label">
                        日本語 · TIẾNG NHẬT
                      </span>
                      <p className="subtitle-original">
                        {segment.originalText || '—'}
                      </p>
                    </div>

                    <div className="subtitle-language-block translated-block">
                      <span className="subtitle-language-label">
                        VI · TIẾNG VIỆT
                      </span>

                      {isEditing ? (
                        <div className="subtitle-editor">
                          <textarea
                            className="subtitle-textarea"
                            value={draft}
                            onChange={(event) =>
                              setDraft(event.target.value)
                            }
                            rows={Math.min(
                              8,
                              Math.max(3, draft.split('\n').length + 1),
                            )}
                            maxLength={10000}
                            disabled={isSaving}
                            autoFocus
                            aria-label={`Chỉnh sửa bản dịch câu ${segment.sequence}`}
                          />

                          <div className="subtitle-editor-actions">
                            <button
                              className="detail-button detail-button-primary"
                              onClick={() => void saveTranslation(segment)}
                              disabled={isSaving || !draft.trim()}
                            >
                              {isSaving ? 'Đang lưu...' : 'Lưu bản dịch'}
                            </button>

                            <button
                              className="detail-button"
                              onClick={cancelEditing}
                              disabled={isSaving}
                            >
                              Hủy
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="subtitle-translated">
                            {segment.translatedText || 'Chưa có bản dịch'}
                          </p>

                          <button
                            className="subtitle-edit-button"
                            onClick={() => startEditing(segment)}
                            disabled={savingId !== null}
                          >
                            ✎ Sửa bản dịch
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <footer className="detail-footer">
        SubFlow · Video Translation &amp; Subtitle Workspace
      </footer>
    </main>
  );
}
