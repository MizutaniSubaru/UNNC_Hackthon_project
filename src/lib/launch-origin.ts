import type { LaunchOrigin } from '@/lib/types';

export function createLaunchOrigin(rect: DOMRect | DOMRectReadOnly): LaunchOrigin {
  return {
    height: rect.height,
    left: rect.left,
    top: rect.top,
    width: rect.width,
  };
}

export function hasValidLaunchOrigin(
  origin: LaunchOrigin | null | undefined
): origin is LaunchOrigin {
  return Boolean(
    origin &&
      Number.isFinite(origin.top) &&
      Number.isFinite(origin.left) &&
      Number.isFinite(origin.width) &&
      Number.isFinite(origin.height) &&
      origin.width > 0 &&
      origin.height > 0
  );
}
