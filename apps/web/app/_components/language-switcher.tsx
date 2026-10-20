'use client';

import type { Language } from '../_lib/dashboard-i18n';

type LanguageSwitcherProps = {
  language: Language;
  onChange: (language: Language) => void;
  label: string;
};

export function LanguageSwitcher({
  language,
  onChange,
  label,
}: LanguageSwitcherProps) {
  return (
    <div className="language-switch" role="group" aria-label={label}>
      {(['vi', 'en'] as const).map((option) => (
        <button
          key={option}
          className={`language-button${language === option ? ' active' : ''}`}
          type="button"
          aria-pressed={language === option}
          onClick={() => onChange(option)}
        >
          {option.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
