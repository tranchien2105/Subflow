'use client';

import type { FormEvent } from 'react';
import type { Copy } from '../_lib/dashboard-i18n';

type VideoImportFormProps = {
  copy: Copy;
  selectedFile: File | null;
  onFileChange: (file: File | null) => void;
  importing: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  message: string;
  error: string;
};

export function VideoImportForm({
  copy,
  selectedFile,
  onFileChange,
  importing,
  onSubmit,
  message,
  error,
}: VideoImportFormProps) {
  return (
    <section className="import-card">
      <div className="section-heading">
        <div>
          <h2>{copy.importVideo}</h2>
          <p>{copy.importDescription}</p>
        </div>
        <span className="import-icon">↑</span>
      </div>

      <form className="import-form" onSubmit={onSubmit}>
        <label htmlFor="videoFile">{copy.videoUrl}</label>

        <div className="input-row">
          <input
            id="videoFile"
            type="file"
            accept=".mp4,video/mp4"
            disabled={importing}
            onChange={(event) =>
              onFileChange(event.target.files?.[0] ?? null)
            }
          />

          <button
            className="button button-primary"
            type="submit"
            disabled={importing || !selectedFile}
          >
            {importing ? copy.importing : copy.importButton}
          </button>
        </div>

        <p className="input-hint">
          {selectedFile
            ? `${selectedFile.name} · ${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB`
            : copy.urlHint}
        </p>
      </form>

      {message && (
        <div className="feedback success" role="status">
          <span>✓</span>
          <p>{message}</p>
        </div>
      )}

      {error && (
        <div className="feedback error" role="alert">
          <span>!</span>
          <p>
            {error === 'api'
              ? copy.apiError
              : error === 'required'
                ? copy.requiredUrl
                : error}
          </p>
        </div>
      )}
    </section>
  );
}