import { NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import type { APIError } from 'openai/error';
import { DEFAULT_TIMEZONE } from '@/lib/constants';
import { getSupabaseClient } from '@/lib/supabase';
import type { Item, SearchHit, SearchMode, SearchResponse, SearchTimeRange } from '@/lib/types';

type AiIntent = {
    date_end: string | null;
    date_start: string | null;
    keywords: string[];
    type: 'all' | 'event' | 'todo';
};

type DateRange = {
    end: Date;
    label: string;
    start: Date;
};

type ScoredHit = {
    hit: SearchHit;
    score: number;
    timestamp: number;
};

type RankPayload = {
    ordered_ids: string[];
    reason?: string;
};

function parseJson<T>(content: string | null | undefined) {
    if (!content) {
        return null;
    }

    try {
        return JSON.parse(content) as T;
    } catch {
        return null;
    }
}

function getAiConfig() {
    const apiKey = process.env.OPENAI_API_KEY || process.env.KIMI_API_KEY;
    const baseURL =
        process.env.OPENAI_BASE_URL || process.env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1';
    const model = process.env.OPENAI_MODEL || process.env.KIMI_MODEL || 'kimi-k2.5';

    return { apiKey, baseURL, model };
}

function startOfDay(date: Date) {
    const clone = new Date(date);
    clone.setHours(0, 0, 0, 0);
    return clone;
}

function endOfDay(date: Date) {
    const clone = new Date(date);
    clone.setHours(23, 59, 59, 999);
    return clone;
}

function formatYmd(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseYmd(value: string | null | undefined) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return null;
    }

    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getWeekRange(now: Date, offsetWeeks: number, locale: string): DateRange {
    const normalizedDay = (now.getDay() + 6) % 7;
    const monday = startOfDay(now);
    monday.setDate(monday.getDate() - normalizedDay + offsetWeeks * 7);

    const sunday = endOfDay(monday);
    sunday.setDate(monday.getDate() + 6);

    const isChinese = locale.startsWith('zh');
    return {
        end: sunday,
        label: isChinese ? (offsetWeeks === -1 ? '上周' : '本周') : offsetWeeks === -1 ? 'last week' : 'this week',
        start: monday,
    };
}

function getMonthRange(now: Date, offsetMonths: number, locale: string): DateRange {
    const firstDay = startOfDay(new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1));
    const lastDay = endOfDay(new Date(now.getFullYear(), now.getMonth() + offsetMonths + 1, 0));

    const isChinese = locale.startsWith('zh');
    return {
        end: lastDay,
        label: isChinese ? (offsetMonths === -1 ? '上个月' : '本月') : offsetMonths === -1 ? 'last month' : 'this month',
        start: firstDay,
    };
}

function inferRangeByRule(query: string, locale: string): DateRange | null {
    const normalized = query.toLowerCase();
    const now = new Date();

    if (/上周|上星期|last\s+week/.test(normalized)) {
        return getWeekRange(now, -1, locale);
    }

    if (/本周|这周|this\s+week/.test(normalized)) {
        return getWeekRange(now, 0, locale);
    }

    if (/上个月|last\s+month/.test(normalized)) {
        return getMonthRange(now, -1, locale);
    }

    if (/本月|这个月|this\s+month/.test(normalized)) {
        return getMonthRange(now, 0, locale);
    }

    if (/昨天|yesterday/.test(normalized)) {
        const day = new Date();
        day.setDate(day.getDate() - 1);
        return {
            end: endOfDay(day),
            label: locale.startsWith('zh') ? '昨天' : 'yesterday',
            start: startOfDay(day),
        };
    }

    if (/今天|today/.test(normalized)) {
        const day = new Date();
        return {
            end: endOfDay(day),
            label: locale.startsWith('zh') ? '今天' : 'today',
            start: startOfDay(day),
        };
    }

    return null;
}

function isSummaryIntent(query: string) {
    return /我.*做了什么|发生了什么|what\s+did\s+i|what\s+happened|things\s+i\s+did/i.test(query);
}

function extractKeywords(query: string) {
    const compact = query.trim().toLowerCase();
    if (!compact) {
        return [] as string[];
    }

    const matches = compact.match(/[a-z0-9\u4e00-\u9fff]+/gi) ?? [];
    const stopwords = new Set([
        '我',
        '了',
        '什么',
        '些',
        '的',
        'did',
        'what',
        'the',
        'a',
        'an',
        'to',
        'in',
        'on',
        'at',
        'my',
        'is',
        'are',
    ]);

    const personHints: string[] = [];
    const personPatterns = [
        /(?:我和|跟|与|和)([\u4e00-\u9fffA-Za-z0-9]{2,18})(?:一起|玩|做|吃|看|聊|学|去了|了|在|$)/g,
        /with\s+([a-z0-9\-\s]{2,30}?)(?:\s+(?:did|do|play|meet|what)|$)/gi,
    ];

    for (const pattern of personPatterns) {
        let result = pattern.exec(compact);
        while (result) {
            const value = result[1]?.trim();
            if (value) {
                personHints.push(value);
            }
            result = pattern.exec(compact);
        }
    }

    const actionHints: string[] = [];
    if (/玩|play/.test(compact)) {
        actionHints.push('玩', 'play');
    }
    if (/吃|eat/.test(compact)) {
        actionHints.push('吃', 'eat');
    }
    if (/看|watch/.test(compact)) {
        actionHints.push('看', 'watch');
    }

    const expandedChineseTokens: string[] = [];
    for (const match of matches) {
        if (/^[\u4e00-\u9fff]{5,}$/.test(match)) {
            for (let index = 0; index < match.length - 1; index += 1) {
                expandedChineseTokens.push(match.slice(index, index + 2));
            }
        }
    }

    return Array.from(
        new Set([...matches, ...personHints, ...actionHints, ...expandedChineseTokens])
    ).filter((word) => word.length > 1 && !stopwords.has(word));
}

function getItemAnchor(item: Item) {
    if (item.type === 'event') {
        return item.start_at || item.due_date || item.updated_at || item.created_at;
    }

    return item.due_date || item.updated_at || item.created_at;
}

function toDate(value: string | null) {
    if (!value) {
        return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function inRange(anchor: Date | null, range: DateRange | null) {
    if (!range) {
        return true;
    }

    if (!anchor) {
        return false;
    }

    return anchor.getTime() >= range.start.getTime() && anchor.getTime() <= range.end.getTime();
}

function scoreKeywordMatch(item: Item, keywords: string[], rawQuery: string) {
    const fields = {
        group: (item.group_key ?? '').toLowerCase(),
        location: (item.location ?? '').toLowerCase(),
        notes: (item.notes ?? '').toLowerCase(),
        status: (item.status ?? '').toLowerCase(),
        title: (item.title ?? '').toLowerCase(),
        type: (item.type ?? '').toLowerCase(),
    };

    let score = 0;
    const matchedKeywords: string[] = [];

    for (const keyword of keywords) {
        if (
            fields.title.includes(keyword) ||
            fields.notes.includes(keyword) ||
            fields.location.includes(keyword) ||
            fields.group.includes(keyword) ||
            fields.status.includes(keyword) ||
            fields.type.includes(keyword)
        ) {
            score += fields.title.includes(keyword) ? 3 : 1;
            matchedKeywords.push(keyword);
        }
    }

    if (rawQuery && (fields.title.includes(rawQuery) || fields.notes.includes(rawQuery))) {
        score += 4;
    }

    return {
        matchedKeywords,
        score,
    };
}

function scoreSkillHints(item: Item, query: string) {
    const normalized = query.trim().toLowerCase();
    const text = `${item.title ?? ''} ${item.location ?? ''} ${item.notes ?? ''}`.toLowerCase();
    let score = 0;

    const personPatterns = [
        /(?:我和|跟|与|和)([\u4e00-\u9fffA-Za-z0-9]{2,18})(?:一起|玩|做|吃|看|聊|学|去了|了|在|$)/g,
        /with\s+([a-z0-9\-\s]{2,30}?)(?:\s+(?:did|do|play|meet|what)|$)/gi,
    ];

    for (const pattern of personPatterns) {
        let result = pattern.exec(normalized);
        while (result) {
            const person = result[1]?.trim();
            if (person && text.includes(person)) {
                score += 16;
            }
            result = pattern.exec(normalized);
        }
    }

    const pairedActionSkills = [
        { queryToken: /玩|play/, itemToken: /玩|play/ },
        { queryToken: /吃|eat/, itemToken: /吃|eat/ },
        { queryToken: /看|watch/, itemToken: /看|watch/ },
        { queryToken: /聊|talk/, itemToken: /聊|talk|discussion|chat/ },
    ];

    for (const skill of pairedActionSkills) {
        if (skill.queryToken.test(normalized) && skill.itemToken.test(text)) {
            score += 5;
        }
    }

    if (/了什么|what\s+did\s+i|what\s+happened/.test(normalized)) {
        score += 2;
    }

    return score;
}

function serializeItemForRanking(item: Item, locale: string) {
    const anchor = getItemAnchor(item) ?? item.created_at;
    return {
        anchor,
        group: item.group_key,
        id: item.id,
        location: item.location,
        notes: item.notes,
        status: item.status,
        title: item.title,
        type: item.type,
        why: locale.startsWith('zh')
            ? '候选项，基于关键词/时间规则召回'
            : 'Candidate recalled by keyword/time rules',
    };
}

async function rankWithAiSkills(input: {
    candidates: SearchHit[];
    locale: string;
    query: string;
    timezone: string;
}) {
    const { candidates, locale, query, timezone } = input;
    const { apiKey, baseURL, model } = getAiConfig();

    if (!apiKey || candidates.length === 0) {
        return null;
    }

    const openai = new OpenAI({ apiKey, baseURL });
    const candidateModels = [model, 'kimi-k2.5', 'moonshot-v1-8k'].filter(
        (value, index, array) => value && array.indexOf(value) === index
    );

    const payload = candidates.slice(0, 80).map((entry) => serializeItemForRanking(entry.item, locale));
    let lastError: unknown = null;

    for (const candidate of candidateModels) {
        try {
            const response = await openai.chat.completions.create({
                model: candidate,
                messages: [
                    {
                        role: 'system',
                        content: `
You are an AI retrieval reranker for personal schedules.
Return only JSON: {"ordered_ids": string[], "reason": string}.

Apply these search skills strictly:
1) Person-Entity Binding: if user asks about someone (e.g. 我和千早爱音...), prioritize records containing that person name in title/notes/location.
2) Action-Object Completion: for queries like “玩了什么 / what did we play”, map verb intent to activity object in schedule title (e.g. 和千早爱音玩香肠).
3) Temporal Grounding: obey pre-filtered time range candidates first.
4) Semantic Paraphrase: treat close wording as match, not only exact string.
5) Precision First: keep only strong matches at top; if uncertain, still output best effort ordering.

Locale: ${locale}
Timezone: ${timezone}
            `.trim(),
                    },
                    {
                        role: 'user',
                        content: JSON.stringify({
                            candidates: payload,
                            query,
                        }),
                    },
                ],
                response_format: { type: 'json_object' },
            });

            const parsed = parseJson<RankPayload>(response.choices[0]?.message?.content);
            if (!parsed || !Array.isArray(parsed.ordered_ids)) {
                return null;
            }

            const idSet = new Set(candidates.map((entry) => entry.item.id));
            const orderedIds = parsed.ordered_ids.filter((id) => typeof id === 'string' && idSet.has(id));

            return orderedIds;
        } catch (error) {
            lastError = error;
            const apiError = error as APIError;
            const shouldRetry =
                apiError?.status === 404 ||
                /not found the model|permission denied/i.test(apiError?.message || '');

            if (!shouldRetry) {
                throw error;
            }
        }
    }

    if (lastError) {
        return null;
    }

    return null;
}

function reorderByIds(results: SearchHit[], orderedIds: string[]) {
    if (orderedIds.length === 0) {
        return results;
    }

    const rank = new Map<string, number>();
    orderedIds.forEach((id, index) => rank.set(id, index));

    const sorted = [...results].sort((left, right) => {
        const leftRank = rank.has(left.item.id) ? rank.get(left.item.id)! : Number.MAX_SAFE_INTEGER;
        const rightRank = rank.has(right.item.id) ? rank.get(right.item.id)! : Number.MAX_SAFE_INTEGER;

        if (leftRank !== rightRank) {
            return leftRank - rightRank;
        }

        return 0;
    });

    return sorted;
}

function normalizeAiIntent(payload: unknown): AiIntent {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return {
            date_end: null,
            date_start: null,
            keywords: [],
            type: 'all',
        };
    }

    const source = payload as {
        date_end?: unknown;
        date_start?: unknown;
        keywords?: unknown;
        type?: unknown;
    };

    const keywords = Array.isArray(source.keywords)
        ? source.keywords.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim().toLowerCase()).filter(Boolean)
        : [];

    const type = source.type === 'event' || source.type === 'todo' ? source.type : 'all';

    return {
        date_end: typeof source.date_end === 'string' ? source.date_end : null,
        date_start: typeof source.date_start === 'string' ? source.date_start : null,
        keywords,
        type,
    };
}

async function inferIntentWithAi(input: {
    locale: string;
    query: string;
    timezone: string;
}) {
    const { locale, query, timezone } = input;
    const { apiKey, baseURL, model } = getAiConfig();

    if (!apiKey) {
        return null;
    }

    const openai = new OpenAI({ apiKey, baseURL });
    const candidateModels = [model, 'kimi-k2.5', 'moonshot-v1-8k'].filter(
        (value, index, array) => value && array.indexOf(value) === index
    );

    let lastError: unknown = null;

    for (const candidate of candidateModels) {
        try {
            const response = await openai.chat.completions.create({
                model: candidate,
                messages: [
                    {
                        role: 'system',
                        content: `
You are an AI search intent parser.
Return only JSON with keys: keywords, type, date_start, date_end.
Rules:
- keywords: array of concise search keywords.
- type: one of all, event, todo.
- date_start and date_end must be YYYY-MM-DD when inferable, otherwise null.
- If query asks about broad summaries (e.g. what did I do last week), keep keywords empty and fill date range.
- Respect locale ${locale} and timezone ${timezone}.
            `.trim(),
                    },
                    { role: 'user', content: query },
                ],
                response_format: { type: 'json_object' },
            });

            const payload = parseJson<unknown>(response.choices[0]?.message?.content);
            return normalizeAiIntent(payload);
        } catch (error) {
            lastError = error;
            const apiError = error as APIError;
            const shouldRetry =
                apiError?.status === 404 ||
                /not found the model|permission denied/i.test(apiError?.message || '');

            if (!shouldRetry) {
                throw error;
            }
        }
    }

    if (lastError) {
        throw lastError;
    }

    return null;
}

function toTimeRangePayload(range: DateRange | null): SearchTimeRange | null {
    if (!range) {
        return null;
    }

    return {
        end: formatYmd(range.end),
        label: range.label,
        start: formatYmd(range.start),
    };
}

function searchInMemory(input: {
    allowNoKeyword?: boolean;
    items: Item[];
    keywords: string[];
    locale: string;
    mode: SearchMode;
    query: string;
    range: DateRange | null;
    type: 'all' | 'event' | 'todo';
}) {
    const {
        allowNoKeyword = false,
        items,
        keywords,
        locale,
        mode,
        query,
        range,
        type,
    } = input;
    const queryText = query.trim().toLowerCase();
    const rangeOnly = Boolean(range) && keywords.length === 0;
    const scored: ScoredHit[] = [];

    for (const item of items) {
        if (type !== 'all' && item.type !== type) {
            continue;
        }

        const anchorRaw = getItemAnchor(item);
        const anchor = toDate(anchorRaw);
        if (!inRange(anchor, range)) {
            continue;
        }

        const { matchedKeywords, score } = scoreKeywordMatch(item, keywords, queryText);
        const skillBoost = scoreSkillHints(item, queryText);

        if (!rangeOnly && keywords.length > 0 && score === 0) {
            continue;
        }

        if (!allowNoKeyword && !rangeOnly && keywords.length === 0 && queryText) {
            continue;
        }

        const reason = rangeOnly
            ? locale.startsWith('zh')
                ? `匹配到时间范围：${range?.label ?? ''}`
                : `Matched inferred time range: ${range?.label ?? ''}`
            : mode === 'ai'
                ? locale.startsWith('zh')
                    ? matchedKeywords.length > 0
                        ? `AI 语义匹配，关键词：${matchedKeywords.join('、')}`
                        : 'AI 语义匹配'
                    : matchedKeywords.length > 0
                        ? `AI semantic match: ${matchedKeywords.join(', ')}`
                        : 'AI semantic match'
                : locale.startsWith('zh')
                    ? `关键词命中：${matchedKeywords.join('、')}`
                    : `Keyword match: ${matchedKeywords.join(', ')}`;

        scored.push({
            hit: {
                item,
                matched_at: anchorRaw,
                reason,
            },
            score: score + skillBoost + (range ? 1 : 0),
            timestamp: anchor?.getTime() ?? 0,
        });
    }

    scored.sort((a, b) => {
        if (b.score !== a.score) {
            return b.score - a.score;
        }

        return b.timestamp - a.timestamp;
    });

    return scored;
}

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const query = typeof body.query === 'string' ? body.query.trim() : '';
        const mode: SearchMode = body.mode === 'ai' ? 'ai' : 'keyword';
        const locale = typeof body.locale === 'string' ? body.locale : 'zh-CN';
        const timezone = typeof body.timezone === 'string' ? body.timezone : DEFAULT_TIMEZONE;

        if (!query) {
            return NextResponse.json({ error: 'Query is required.' }, { status: 400 });
        }

        const supabase = getSupabaseClient();
        if (!supabase) {
            return NextResponse.json(
                { error: 'Supabase is not configured.' },
                { status: 500 }
            );
        }

        const { data, error } = await supabase
            .from('items')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1000);

        if (error) {
            throw error;
        }

        const items = (data ?? []) as Item[];
        const ruleRange = inferRangeByRule(query, locale);
        const keywordList = extractKeywords(query);

        let effectiveType: 'all' | 'event' | 'todo' = 'all';
        let effectiveRange = ruleRange;
        let effectiveKeywords = keywordList;
        let fallbackToKeyword = false;

        if (effectiveRange && isSummaryIntent(query)) {
            effectiveKeywords = [];
        }

        if (mode === 'ai') {
            try {
                const aiIntent = await inferIntentWithAi({ locale, query, timezone });
                if (!aiIntent) {
                    fallbackToKeyword = true;
                } else {
                    effectiveType = aiIntent.type;

                    const aiStart = parseYmd(aiIntent.date_start);
                    const aiEnd = parseYmd(aiIntent.date_end);
                    if (aiStart && aiEnd && !ruleRange) {
                        effectiveRange = {
                            end: endOfDay(aiEnd),
                            label: locale.startsWith('zh') ? 'AI 解析时间范围' : 'AI inferred time range',
                            start: startOfDay(aiStart),
                        };
                    }

                    if (aiIntent.keywords.length > 0) {
                        effectiveKeywords = aiIntent.keywords;
                    } else if (effectiveRange && isSummaryIntent(query)) {
                        effectiveKeywords = [];
                    }
                }
            } catch {
                fallbackToKeyword = true;
            }
        }

        const primaryScored = searchInMemory({
            items,
            keywords: effectiveKeywords,
            locale,
            mode,
            query,
            range: effectiveRange,
            type: effectiveType,
        });

        let scored = primaryScored;

        if (mode === 'ai' && scored.length === 0) {
            // AI mode fallback recall: keep filters, temporarily drop keywords to avoid over-pruning.
            scored = searchInMemory({
                allowNoKeyword: true,
                items,
                keywords: [],
                locale,
                mode,
                query,
                range: effectiveRange,
                type: effectiveType,
            });
        }

        let results = scored.map((entry) => entry.hit);

        if (mode === 'ai' && results.length > 0) {
            try {
                const orderedIds = await rankWithAiSkills({
                    candidates: results,
                    locale,
                    query,
                    timezone,
                });

                if (orderedIds && orderedIds.length > 0) {
                    results = reorderByIds(results, orderedIds);
                    results = results.map((entry, index) => ({
                        ...entry,
                        reason:
                            index < 5
                                ? locale.startsWith('zh')
                                    ? `${entry.reason}；AI 技能重排优先命中`
                                    : `${entry.reason}; prioritized by AI skill reranking`
                                : entry.reason,
                    }));
                }
            } catch {
                fallbackToKeyword = true;
            }
        }

        const payload: SearchResponse = {
            fallbackToKeyword,
            mode,
            query,
            results,
            timeRange: toTimeRangePayload(effectiveRange),
        };

        return NextResponse.json(payload);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to search items.';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
