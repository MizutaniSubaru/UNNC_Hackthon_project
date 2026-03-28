'use client';

import { useEffect, useRef, useState } from 'react';
import { MotionButton } from '@/components/ui/motion-button';
import { generateWebcalUrl, downloadICalendar } from '@/lib/calendar-export';
import type { Item } from '@/lib/types';

type CalendarExportButtonProps = {
  items: Item[];
  locale?: string;
  userId?: string;
};

export function CalendarExportButton({ items, locale, userId }: CalendarExportButtonProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isChinese =
    typeof locale === 'string'
      ? locale.startsWith('zh')
      : typeof navigator !== 'undefined'
        ? navigator.language.toLowerCase().startsWith('zh')
        : true;

  function clearCopiedTimer() {
    if (copiedTimerRef.current) {
      clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = null;
    }
  }

  function closeMenu() {
    setShowMenu(false);
    clearCopiedTimer();
    setCopied(false);
  }

  useEffect(() => {
    return () => {
      clearCopiedTimer();
    };
  }, []);

  useEffect(() => {
    if (!showMenu) {
      return;
    }

    function handleOutsidePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (containerRef.current?.contains(target)) {
        return;
      }

      closeMenu();
    }

    function handleEscapeKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeMenu();
      }
    }

    window.addEventListener('pointerdown', handleOutsidePointerDown);
    window.addEventListener('keydown', handleEscapeKey);

    return () => {
      window.removeEventListener('pointerdown', handleOutsidePointerDown);
      window.removeEventListener('keydown', handleEscapeKey);
    };
  }, [showMenu]);

  const handleDownload = () => {
    downloadICalendar(items, `calendar-${new Date().toISOString().split('T')[0]}.ics`);
    closeMenu();
  };

  const handleCopyUrl = async () => {
    const httpsUrl = generateWebcalUrl(userId).replace(/^webcal:\/\//, window.location.protocol + '//');
    try {
      await navigator.clipboard.writeText(httpsUrl);
      setCopied(true);
      clearCopiedTimer();
      copiedTimerRef.current = setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch (error) {
      console.error('Failed to copy URL:', error);
    }
  };

  const handleOpenInCalendar = () => {
    const webcalUrl = generateWebcalUrl(userId);
    window.location.href = webcalUrl;
    closeMenu();
  };

  return (
    <div className="relative" ref={containerRef}>
      <MotionButton
        aria-expanded={showMenu}
        aria-haspopup="menu"
        aria-label={isChinese ? '同步日历' : 'Sync calendar'}
        className="relative z-[60] flex h-11 w-11 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        motionPreset="subtle"
        onClick={() => setShowMenu(!showMenu)}
        title="Sync Calendar"
        type="button"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
      </MotionButton>

      {showMenu && (
        <div className="absolute right-0 z-[60] mt-2 w-40 rounded-md border border-gray-200 bg-white shadow-lg">
          <div className="py-1">
            <MotionButton
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
              motionPreset="subtle"
              onClick={handleOpenInCalendar}
              type="button"
            >
              {isChinese ? '🗓️ 自动导入' : '🗓️ Auto Import'}
            </MotionButton>

            <MotionButton
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
              motionPreset="subtle"
              onClick={handleCopyUrl}
              type="button"
            >
              {copied ? (isChinese ? '✅ 已复制' : '✅ Copied') : '🔗 URL'}
            </MotionButton>

            <MotionButton
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
              motionPreset="subtle"
              onClick={handleDownload}
              type="button"
            >
              📥 ICS
            </MotionButton>
          </div>
        </div>
      )}
    </div>
  );
}
