
'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { DashboardSidebar } from './_components/dashboard-sidebar';
import { DashboardStats } from './_components/dashboard-stats';
import { LanguageSwitcher } from './_components/language-switcher';
import { VideoImportForm } from './_components/video-import-form';
import { VideosTable } from './_components/videos-table';
import {
  translations,
  type Language,
} from './_lib/dashboard-i18n';
import type { ImportResponse, Video } from './_lib/dashboard-types';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const MAX_FILE_SIZE = 500 * 1024 * 1024;

export default function HomePage() {
  const [language, setLanguage] = useState<Language>('vi');
  const copy = translations[language];

  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const fetchVideos = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/videos`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('api');
      }

      const data = (await response.json()) as Video[];
      setVideos(data);
      setError((current) => (current === 'api' ? '' : current));
    } catch {
      setError((current) => current || 'api');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialFetchId = window.setTimeout(() => {
      void fetchVideos();
    }, 0);

    const intervalId = window.setInterval(() => {
      void fetchVideos();
    }, 5000);

    return () => {
      window.clearTimeout(initialFetchId);
      window.clearInterval(intervalId);
    };
  }, [fetchVideos]);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!selectedFile) {
      setError('required');
      return;
    }

    if (!selectedFile.name.toLowerCase().endsWith('.mp4')) {
      setError('Chỉ hỗ trợ file có phần mở rộng .mp4.');
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setError('File vượt quá dung lượng tối đa 500 MB.');
      return;
    }

    setImporting(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch(`${API_URL}/videos/upload`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          Array.isArray(result.message)
            ? result.message.join(', ')
            : result.message || copy.importError,
        );
      }

      const data = result as ImportResponse;
      setMessage(copy.importSuccess(data.job.id));
      setSelectedFile(null);

      const input = document.getElementById(
        'videoFile',
      ) as HTMLInputElement | null;

      if (input) {
        input.value = '';
      }

      await fetchVideos();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.importError);
    } finally {
      setImporting(false);
    }
  }

  function formatDate(value: string) {
    return new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  const activeCount = videos.filter(
    (video) =>
      video.job?.status === 'queued' || video.job?.status === 'processing',
  ).length;

  const completedCount = videos.filter(
    (video) => video.job?.status === 'completed',
  ).length;

  return (
    <main className="app-shell">
      <DashboardSidebar copy={copy} />

      <section className="main-panel">
        <header className="topbar">
          <div className="breadcrumb">
            {copy.workspace} <span>/</span> {copy.dashboard}
          </div>

          <div className="topbar-actions">
            <LanguageSwitcher
              language={language}
              onChange={setLanguage}
              label={copy.language}
            />
            <span className="environment-tag">{copy.localDev}</span>
          </div>
        </header>

        <div className="page-content">
          <section className="page-heading">
            <div>
              <p className="eyebrow">{copy.videoWorkspace}</p>
              <h1>{copy.dashboard}</h1>
              <p className="page-description">{copy.description}</p>
            </div>

            <button
              className="button button-secondary"
              onClick={() => void fetchVideos()}
              disabled={loading}
              type="button"
            >
              {copy.refresh}
            </button>
          </section>

          <DashboardStats
            total={loading ? null : videos.length}
            active={loading ? null : activeCount}
            completed={loading ? null : completedCount}
            copy={copy}
          />

          <VideoImportForm
            copy={copy}
            selectedFile={selectedFile}
            onFileChange={(file) => {
              setSelectedFile(file);
              setError('');
              setMessage('');
            }}
            importing={importing}
            onSubmit={handleUpload}
            message={message}
            error={error}
          />

          <VideosTable
            videos={videos}
            loading={loading}
            copy={copy}
            formatDate={formatDate}
          />

          <footer className="page-footer">
            <span>{copy.footerTitle}</span>
            <span>{copy.footerNote}</span>
          </footer>
        </div>
      </section>
    </main>
  );
}
