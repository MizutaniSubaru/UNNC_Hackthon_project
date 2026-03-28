'use client';

import { useEffect, useId, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import type { CSSProperties } from 'react';
import { X } from 'lucide-react';
import { PlannerEditorFields } from '@/components/planner-editor-fields';
import { MotionButton } from '@/components/ui/motion-button';
import { COPY } from '@/lib/copy';
import { hasValidLaunchOrigin } from '@/lib/launch-origin';
import type { Item, LaunchOrigin } from '@/lib/types';

type ItemEditorProps = {
  item: Item | null;
  launchOrigin: LaunchOrigin | null;
  locale: string;
  onChange: (item: Item) => void;
  onDelete: (item: Item) => void;
  onDismiss: () => void;
  onSave: (item: Item) => void;
};

type LaunchMotionStyle = CSSProperties & {
  '--planner-modal-origin-scale-x': string;
  '--planner-modal-origin-scale-y': string;
  '--planner-modal-origin-x': string;
  '--planner-modal-origin-y': string;
};

type ItemEditorFormProps = {
  copy: typeof COPY.en;
  item: Item;
  locale: string;
  onChange: (item: Item) => void;
  onDelete: (item: Item) => void;
  onSave: (item: Item) => void;
};

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return () => undefined;
      }

      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      const handleChange = () => onStoreChange();

      if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
      }

      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    },
    () => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return false;
      }

      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    },
    () => false
  );
}

function buildLaunchMotionStyle(origin: LaunchOrigin, targetRect: DOMRect): LaunchMotionStyle {
  const targetWidth = Math.max(targetRect.width, 1);
  const targetHeight = Math.max(targetRect.height, 1);
  const originWidth = Math.max(Math.min(origin.width, targetWidth), 40);
  const originHeight = Math.max(Math.min(origin.height, targetHeight), 28);
  const sourceCenterX = origin.left + origin.width / 2;
  const sourceCenterY = origin.top + origin.height / 2;
  const targetCenterX = targetRect.left + targetRect.width / 2;
  const targetCenterY = targetRect.top + targetRect.height / 2;

  return {
    '--planner-modal-origin-scale-x': String(originWidth / targetWidth),
    '--planner-modal-origin-scale-y': String(originHeight / targetHeight),
    '--planner-modal-origin-x': `${sourceCenterX - targetCenterX}px`,
    '--planner-modal-origin-y': `${sourceCenterY - targetCenterY}px`,
  };
}

function ItemEditorForm({
  copy,
  item,
  locale,
  onChange,
  onDelete,
  onSave,
}: ItemEditorFormProps) {
  return (
    <>
      <PlannerEditorFields
        autoFocusTitle
        copy={copy}
        locale={locale}
        onChange={(nextValue) => onChange(nextValue as Item)}
        showStatus
        sourceMode="editable"
        typeChangeTransformer={(nextItem, nextType) => ({
          ...nextItem,
          status: nextType === 'event' ? 'scheduled' : 'pending',
        })}
        value={item}
      />

      <div className="editor-actions">
        <MotionButton className="planner-button planner-button--ghost" onClick={() => onDelete(item)} type="button">
          {copy.actions.delete}
        </MotionButton>
        <MotionButton className="planner-button" onClick={() => onSave(item)} type="button">
          {copy.actions.save}
        </MotionButton>
      </div>
    </>
  );
}

export function ItemEditor({
  item,
  launchOrigin,
  locale,
  onChange,
  onDelete,
  onDismiss,
  onSave,
}: ItemEditorProps) {
  const copy = locale.startsWith('zh') ? COPY.zh : COPY.en;
  const dialogTitleId = useId();
  const overlayRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const itemId = item?.id ?? null;
  const useLaunchTransition = !prefersReducedMotion && hasValidLaunchOrigin(launchOrigin);

  useEffect(() => {
    if (!item) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [item]);

  useEffect(() => {
    if (!item) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onDismiss();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [item, onDismiss]);

  useLayoutEffect(() => {
    if (!itemId) {
      return;
    }

    const overlay = overlayRef.current;
    const panel = panelRef.current;
    if (!overlay || !panel) {
      return;
    }

    overlay.classList.remove('is-visible');
    panel.classList.remove('is-visible');
    panel.style.removeProperty('--planner-modal-origin-scale-x');
    panel.style.removeProperty('--planner-modal-origin-scale-y');
    panel.style.removeProperty('--planner-modal-origin-x');
    panel.style.removeProperty('--planner-modal-origin-y');

    if (!useLaunchTransition) {
      overlay.classList.add('is-visible');
      return;
    }

    const launchStyle = buildLaunchMotionStyle(launchOrigin, panel.getBoundingClientRect());
    panel.style.setProperty(
      '--planner-modal-origin-scale-x',
      launchStyle['--planner-modal-origin-scale-x']
    );
    panel.style.setProperty(
      '--planner-modal-origin-scale-y',
      launchStyle['--planner-modal-origin-scale-y']
    );
    panel.style.setProperty('--planner-modal-origin-x', launchStyle['--planner-modal-origin-x']);
    panel.style.setProperty('--planner-modal-origin-y', launchStyle['--planner-modal-origin-y']);

    const frame = requestAnimationFrame(() => {
      overlay.classList.add('is-visible');
      panel.classList.add('is-visible');
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [itemId, launchOrigin, useLaunchTransition]);

  if (!item) {
    return null;
  }

  const closeLabel = locale.startsWith('zh') ? '关闭编辑弹窗' : 'Close item editor';
  const panelClassName = [
    'planner-panel',
    'planner-panel--modal',
    'planner-panel--editor-modal',
    useLaunchTransition ? 'planner-panel--modal-launch' : 'planner-panel--modal-pop',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <MotionButton
        aria-label={closeLabel}
        className="planner-modal__overlay"
        motionPreset="overlay"
        onClick={onDismiss}
        ref={overlayRef}
        type="button"
      />
      <div
        aria-labelledby={dialogTitleId}
        aria-modal="true"
        className="planner-modal"
        role="dialog"
      >
        <section className={panelClassName} ref={panelRef}>
          <div className="planner-panel__header item-editor-modal__header">
            <div>
              <h2 className="planner-panel__title" id={dialogTitleId}>
                {item.title}
              </h2>
            </div>
            <MotionButton
              aria-label={closeLabel}
              className="item-editor-modal__close"
              motionPreset="subtle"
              onClick={onDismiss}
              type="button"
            >
              <X aria-hidden="true" size={18} />
            </MotionButton>
          </div>

          <ItemEditorForm
            copy={copy}
            item={item}
            locale={locale}
            onChange={onChange}
            onDelete={onDelete}
            onSave={onSave}
          />
        </section>
      </div>
    </>
  );
}
