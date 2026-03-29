'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { MotionButton } from '@/components/ui/motion-button';
import {
  downloadICalendar,
  generateICalendarDataUrl,
} from '@/lib/calendar-export';
import type { Item } from '@/lib/types';

type CalendarExportButtonProps = {
  items: Item[];
  locale?: string;
};

export function CalendarExportButton({ items, locale }: CalendarExportButtonProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  const isChinese =
    typeof locale === 'string'
      ? locale.startsWith('zh')
      : typeof navigator !== 'undefined'
        ? navigator.language.toLowerCase().startsWith('zh')
        : true;
  const triggerAriaLabel = isChinese ? '\u5bfc\u51fa' : 'Export';
  const exportAsUrlLabel = isChinese ? '\u5bfc\u51fa\u4e3a URL' : 'Export as URL';
  const exportAsIcsLabel = isChinese
    ? '\u5bfc\u51fa\u4e3a ICS'
    : 'Export as ICS';
  const urlCopiedLabel = isChinese
    ? '\u65e5\u5386 URL \u5df2\u590d\u5236\u5230\u526a\u8d34\u677f'
    : 'Calendar URL copied to clipboard.';
  const urlFallbackLabel = isChinese
    ? '\u65e5\u5386 URL \u590d\u5236\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u6d4f\u89c8\u5668\u6743\u9650\u3002'
    : 'Failed to copy calendar URL. Please check browser permissions.';

  const copyWithFallback = useCallback((text: string) => {
    const hiddenTextArea = document.createElement('textarea');
    hiddenTextArea.value = text;
    hiddenTextArea.setAttribute('readonly', 'true');
    hiddenTextArea.style.position = 'fixed';
    hiddenTextArea.style.opacity = '0';
    hiddenTextArea.style.pointerEvents = 'none';

    document.body.appendChild(hiddenTextArea);
    hiddenTextArea.focus();
    hiddenTextArea.select();

    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch {
      copied = false;
    }

    document.body.removeChild(hiddenTextArea);
    return copied;
  }, []);

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  useEffect(() => {
    if (!statusText) {
      return;
    }

    const timer = window.setTimeout(() => {
      setStatusText(null);
    }, 2500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [statusText]);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (menuRef.current?.contains(target)) {
        return;
      }

      closeMenu();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeMenu, isMenuOpen]);

  const handleDownload = () => {
    downloadICalendar(items, `calendar-${new Date().toISOString().split('T')[0]}.ics`);
    setStatusText(null);
    closeMenu();
  };

  const handleExportUrl = async () => {
    const dataUrl = generateICalendarDataUrl(items);
    let copied = false;

    try {
      await navigator.clipboard.writeText(dataUrl);
      copied = true;
    } catch {
      copied = copyWithFallback(dataUrl);
    }

    setStatusText(copied ? urlCopiedLabel : urlFallbackLabel);

    closeMenu();
  };

  return (
    <div ref={menuRef} className="relative z-[60] inline-flex flex-col items-end">
      <MotionButton
        aria-controls={menuId}
        aria-expanded={isMenuOpen}
        aria-haspopup="menu"
        aria-label={triggerAriaLabel}
        className="group relative inline-flex h-11 w-11 items-center justify-center justify-self-end rounded-md border border-gray-300 bg-white text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        motionPreset="subtle"
        onClick={() => {
          setIsMenuOpen((open) => !open);
        }}
        title={triggerAriaLabel}
        type="button"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 transition-transform duration-200 group-hover:-translate-y-0.5"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </MotionButton>

      {isMenuOpen ? (
        <div
          id={menuId}
          role="menu"
          className="absolute top-full right-0 mt-2 flex min-w-[200px] flex-col gap-1 rounded-md border border-gray-200 bg-white p-1 shadow-lg"
        >
          <button
            role="menuitem"
            type="button"
            className="inline-flex h-10 items-center justify-start rounded-md px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            onClick={() => {
              void handleExportUrl();
            }}
          >
            {exportAsUrlLabel}
          </button>

          <button
            role="menuitem"
            type="button"
            className="group inline-flex h-10 items-center justify-start gap-2 rounded-md px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            onClick={handleDownload}
          >
            {exportAsIcsLabel}
          </button>
        </div>
      ) : null}

      {statusText ? (
        <p className="mt-2 text-xs text-gray-500" aria-live="polite">
          {statusText}
        </p>
      ) : null}
    </div>
  );
}
