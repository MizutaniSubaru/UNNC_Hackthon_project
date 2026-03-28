'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { QuoteView, QuotesResponse } from '@/lib/types';

const ROTATE_INTERVAL_MS = 6000;
const FADE_DURATION_MS = 360;
const FETCH_LIMIT = 120;

type QuoteRotatorProps = {
    locale: string;
};

function normalizeAnimeTitle(rawAnime: string) {
    const trimmed = rawAnime.trim();
    if (!trimmed) {
        return '《Unknown》';
    }

    if (trimmed.startsWith('《') && trimmed.endsWith('》')) {
        return trimmed;
    }

    return `《${trimmed.replace(/^《+|》+$/g, '')}》`;
}

function textSizeClass(textLength: number) {
    if (textLength >= 140) {
        return 'quote-rotator__line--xs';
    }

    if (textLength >= 110) {
        return 'quote-rotator__line--sm';
    }

    if (textLength >= 80) {
        return 'quote-rotator__line--md';
    }

    return 'quote-rotator__line--lg';
}

function pickNextQuote(
    candidates: QuoteView[],
    currentId: string | null,
    recentIds: string[]
) {
    if (candidates.length === 0) {
        return null;
    }

    const basePool = candidates.filter((quote) => quote.id !== currentId);
    const pool = basePool.length > 0 ? basePool : candidates;
    const recentWindowSize = Math.max(1, Math.min(8, pool.length - 1));
    const blocked = new Set(recentIds.slice(-recentWindowSize));
    let selectable = pool.filter((quote) => !blocked.has(quote.id));

    if (selectable.length === 0) {
        selectable = pool;
    }

    const randomIndex = Math.floor(Math.random() * selectable.length);
    return selectable[randomIndex] ?? selectable[0] ?? null;
}

export function QuoteRotator({ locale }: QuoteRotatorProps) {
    const [loading, setLoading] = useState(true);
    const [quotes, setQuotes] = useState<QuoteView[]>([]);
    const [activeQuote, setActiveQuote] = useState<QuoteView | null>(null);
    const [phaseClass, setPhaseClass] = useState('');
    const recentIdsRef = useRef<string[]>([]);
    const swapTimerRef = useRef<number | null>(null);

    const isChinese = locale.startsWith('zh');

    useEffect(() => {
        let cancelled = false;

        async function loadQuotes() {
            try {
                setLoading(true);
                const response = await fetch(`/api/quotes?limit=${FETCH_LIMIT}`, {
                    cache: 'no-store',
                });

                const payload = (await response.json().catch(() => ({ quotes: [] }))) as QuotesResponse;
                if (!response.ok) {
                    throw new Error(payload.error || 'Failed to load quotes.');
                }

                const normalized = Array.isArray(payload.quotes)
                    ? payload.quotes.filter((entry) => entry.quote && entry.anime)
                    : [];

                if (!cancelled) {
                    setQuotes(normalized);
                    const first = pickNextQuote(normalized, null, []);
                    setActiveQuote(first);
                    recentIdsRef.current = first ? [first.id] : [];
                    setPhaseClass('');
                }
            } catch {
                if (!cancelled) {
                    setQuotes([]);
                    setActiveQuote(null);
                    recentIdsRef.current = [];
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        void loadQuotes();

        return () => {
            cancelled = true;
        };
    }, []);

    const displayText = useMemo(() => {
        if (loading) {
            return isChinese ? '正在加载语录中…' : 'Loading quote...';
        }

        if (!activeQuote) {
            return isChinese
                ? '今天也要向前走哦 - 《UNNC Hackathon》'
                : 'Keep moving forward today - 《UNNC Hackathon》';
        }

        return `${activeQuote.quote} - ${normalizeAnimeTitle(activeQuote.anime)}`;
    }, [activeQuote, isChinese, loading]);

    useEffect(() => {
        if (quotes.length <= 1 || !activeQuote) {
            return;
        }

        const charsLength = Array.from(displayText).length;
        // Wait for all chars to animate (charsLength * 60ms) + 300ms char animation + 2000ms stay
        const displayDuration = charsLength * 60 + 300 + 2000;

        const cycleTimer = window.setTimeout(() => {
            setPhaseClass('quote-rotator__line--out');
            swapTimerRef.current = window.setTimeout(() => {
                setActiveQuote((current) => {
                    const next = pickNextQuote(quotes, current?.id ?? null, recentIdsRef.current);
                    if (next) {
                        const appended = [...recentIdsRef.current, next.id];
                        recentIdsRef.current = appended.slice(-16);
                    }
                    return next;
                });
                setPhaseClass('');
            }, FADE_DURATION_MS);
        }, displayDuration);

        return () => {
            window.clearTimeout(cycleTimer);
            if (swapTimerRef.current !== null) {
                window.clearTimeout(swapTimerRef.current);
            }
        };
    }, [activeQuote, quotes, displayText]);

    const sizeClass = textSizeClass(displayText.length);

    return (
        <section className="planner-panel quote-rotator" aria-live="polite">
            <div className="planner-panel__header quote-rotator__header">
                <div>
                    <p className="planner-panel__eyebrow">{isChinese ? '动漫语录' : 'Anime Quote'}</p>
                    <h2 className="planner-panel__title quote-rotator__title">
                        {isChinese ? '今日份心动台词' : 'Line of the Moment'}
                    </h2>
                </div>
            </div>

            <div className="quote-rotator__body">
                <p className={`quote-rotator__line ${sizeClass} ${phaseClass}`}>
                    {Array.from(displayText).map((char, index) => (
                        <span
                            key={`${activeQuote?.id || 'static'}-${index}`}
                            className="quote-char"
                            style={{ animationDelay: `${index * 60}ms` }}
                        >
                            {char}
                        </span>
                    ))}
                </p>
            </div>
        </section>
    );
}
