
import Link from 'next/link';
import {
  formatDuration,
  getStatusColor,
  getStatusLabel,
  type Copy,
} from '../_lib/dashboard-i18n';
import type { Video } from '../_lib/dashboard-types';

type VideosTableProps = {
  videos: Video[];
  loading: boolean;
  copy: Copy;
  formatDate: (value: string) => string;
};

function getStepLabel(step: string, language: 'vi' | 'en'): string {
  const labels: Record<string, { vi: string; en: string }> = {
    queued: { vi: 'Đang chờ xử lý', en: 'Queued for processing' },
    downloading: { vi: 'Đang tải video', en: 'Downloading video' },
    extracting_audio: { vi: 'Đang tách âm thanh', en: 'Extracting audio' },
    transcription: {
      vi: 'Đang nhận diện lời thoại',
      en: 'Transcribing audio',
    },
    transcription_completed: {
      vi: 'Đã nhận diện lời thoại',
      en: 'Transcription completed',
    },
    translation: { vi: 'Đang dịch phụ đề', en: 'Translating subtitles' },
    translation_completed: {
      vi: 'Đã dịch xong phụ đề',
      en: 'Translation completed',
    },
    completed: { vi: 'Hoàn tất', en: 'Completed' },
    demo_completed: {
      vi: 'Hoàn tất xử lý demo',
      en: 'Demo processing completed',
    },
    failed: { vi: 'Xử lý thất bại', en: 'Processing failed' },
  };

  return labels[step]?.[language] ?? step.replaceAll('_', ' ');
}

function formatProcessingTime(seconds: number, language: 'vi' | 'en') {
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  return language === 'vi'
    ? `${minutes} phút ${remainingSeconds} giây`
    : `${minutes}m ${remainingSeconds}s`;
}

export function VideosTable({
  videos,
  loading,
  copy,
  formatDate,
}: VideosTableProps) {
  const language = copy.language === 'Ngôn ngữ' ? 'vi' : 'en';

  return (
    <section className="videos-section" id="videos">
      <div className="section-heading">
        <div>
          <h2>{copy.recentVideos}</h2>
          <p>{copy.recentDescription}</p>
        </div>
        <span className="count-pill">{copy.videoCount(videos.length)}</span>
      </div>

      <div className="auto-refresh-note">
        <span className="status-dot" />
        {copy.autoRefresh}
      </div>

      <div className="table-container">
        <table className="videos-table">
          <thead>
            <tr>
              <th>{copy.video}</th>
              <th>{copy.source}</th>
              <th>{copy.status}</th>
              <th>{copy.added}</th>
              <th>{copy.duration}</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="table-message">
                  {copy.loading}
                </td>
              </tr>
            ) : videos.length === 0 ? (
              <tr>
                <td colSpan={5} className="table-message">
                  {copy.empty}
                </td>
              </tr>
            ) : (
              videos.map((video) => {
                const job = video.job;
                const statusColor = getStatusColor(job?.status);
                const progress = Math.min(
                  100,
                  Math.max(0, Number(job?.progress ?? 0)),
                );

                const isFailed = job?.status === 'failed';
                const isCompleted = job?.status === 'completed';
                const isActive =
                  job?.status === 'queued' || job?.status === 'processing';

                return (
                  <tr key={video.id}>
                    <td>
                      <div className="video-cell">
                        <span className="video-thumbnail">▷</span>

                        <div className="video-details">
                          <Link
                            href={`/videos/${video.id}`}
                            className="video-title-link"
                          >
                            {video.title || copy.untitled}
                          </Link>

                          <span title={video.sourceUrl}>
                            {video.sourceUrl}
                          </span>

                          <Link
                            href={`/videos/${video.id}`}
                            className="video-detail-link"
                          >
                            {language === 'vi'
                              ? 'Xem chi tiết phụ đề →'
                              : 'View subtitles →'}
                          </Link>

                          {job?.currentStep && (
                            <small className="job-step">
                              {copy.currentStep}:{' '}
                              {getStepLabel(job.currentStep, language)}
                            </small>
                          )}

                          {job?.errorMessage && (
                            <small
                              className="job-error"
                              title={job.errorMessage}
                              role="alert"
                            >
                              {job.errorMessage}
                            </small>
                          )}
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className="source-badge">
                        {video.sourceType.toUpperCase()}
                      </span>
                    </td>

                    <td className="status-cell">
                      <div className="job-status-column">
                        <span
                          className="job-status"
                          style={{
                            color: statusColor,
                            backgroundColor: `${statusColor}15`,
                          }}
                        >
                          <span
                            className="job-status-dot"
                            style={{ backgroundColor: statusColor }}
                          />
                          {getStatusLabel(job?.status, copy)}
                        </span>

                        {job && (
                          <div className="job-progress">
                            <div className="job-progress-label">
                              <span>{copy.progress}</span>
                              <span>{progress}%</span>
                            </div>

                            <div
                              className="progress-track"
                              role="progressbar"
                              aria-label={`${copy.progress}: ${progress}%`}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={progress}
                            >
                              <div
                                className="progress-value"
                                style={{
                                  width: `${progress}%`,
                                  backgroundColor: statusColor,
                                }}
                              />
                            </div>

                            {job.processingSeconds != null && (
                              <small className="processing-time">
                                {copy.processingTime}:{' '}
                                {formatProcessingTime(
                                  job.processingSeconds,
                                  language,
                                )}
                              </small>
                            )}

                            {isActive && (
                              <small className="job-step">
                                {language === 'vi'
                                  ? 'Video đang được xử lý nền.'
                                  : 'Video is being processed in the background.'}
                              </small>
                            )}

                            {isCompleted && (
                              <small className="job-step">
                                {job.currentStep === 'translation_completed'
                                  ? language === 'vi'
                                    ? 'Đã hoàn thành nhận diện và dịch.'
                                    : 'Transcription and translation completed.'
                                  : language === 'vi'
                                    ? 'Tác vụ đã kết thúc; cần xác nhận đầu ra phụ đề.'
                                    : 'Job finished; subtitle output needs verification.'}
                              </small>
                            )}

                            {isFailed && (
                              <small className="job-error">
                                {language === 'vi'
                                  ? 'Bạn có thể thử tải video lên lại.'
                                  : 'You can try uploading the video again.'}
                              </small>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="date-cell">
                      {formatDate(video.createdAt)}
                    </td>

                    <td className="date-cell">
                      {formatDuration(video.durationSeconds, copy)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="table-footer">{copy.tableFooter}</p>
      <p className="demo-warning">{copy.demoWarning}</p>
    </section>
  );
}
