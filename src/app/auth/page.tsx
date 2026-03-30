'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';
import { MotionButton } from '@/components/ui/motion-button';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';

type AuthMode = 'signin' | 'signup';
type SignupPhase = 'email-entry' | 'awaiting-link' | 'password-setup';

const MIN_PASSWORD_LENGTH = 6;
const VERIFY_COOLDOWN_SECONDS = 60;

function createTemporarySignupPassword() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `Tmp-${crypto.randomUUID()}-Aa1!`;
    }

    const fallback = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
    return `Tmp-${fallback}-Aa1!`;
}

function normalizeEmail(value: string) {
    return value.trim().toLowerCase();
}

function resolveLocale() {
    if (typeof navigator === 'undefined') {
        return 'zh-CN';
    }

    return navigator.language?.startsWith('zh') ? 'zh-CN' : navigator.language || 'en-US';
}

function isSafeRedirectPath(path: string | null): path is string {
    return Boolean(path && path.startsWith('/') && !path.startsWith('//'));
}

function mapCallbackError(errorCode: string | null, locale: string) {
    const isChinese = locale.startsWith('zh');

    switch (errorCode) {
        case 'config':
            return isChinese
                ? 'Supabase 配置缺失，请先完成环境变量配置。'
                : 'Supabase configuration is missing.';
        case 'missing_code':
            return isChinese
                ? '登录回调缺少授权信息，请重试。'
                : 'Missing authorization code in callback. Please try again.';
        case 'oauth_failed':
            return isChinese
                ? 'Google 登录失败，请重试。'
                : 'Google sign-in failed. Please try again.';
        default:
            return null;
    }
}

function GoogleIcon() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
            <path
                d="M21.6 12.227c0-.709-.063-1.39-.182-2.045H12v3.873h5.382a4.6 4.6 0 0 1-1.995 3.018v2.505h3.227c1.89-1.74 2.986-4.305 2.986-7.35Z"
                fill="#4285F4"
            />
            <path
                d="M12 22c2.7 0 4.964-.895 6.619-2.422l-3.227-2.505c-.895.6-2.041.955-3.392.955-2.61 0-4.819-1.76-5.61-4.127H3.055v2.587A9.997 9.997 0 0 0 12 22Z"
                fill="#34A853"
            />
            <path
                d="M6.39 13.9A5.994 5.994 0 0 1 6.075 12c0-.66.113-1.3.315-1.9V7.513H3.055A9.996 9.996 0 0 0 2 12c0 1.615.386 3.146 1.055 4.487L6.39 13.9Z"
                fill="#FBBC04"
            />
            <path
                d="M12 5.972c1.469 0 2.786.505 3.823 1.496l2.868-2.868C16.96 2.985 14.695 2 12 2a9.997 9.997 0 0 0-8.945 5.513L6.39 10.1c.791-2.368 3-4.128 5.61-4.128Z"
                fill="#EA4335"
            />
        </svg>
    );
}

export default function AuthPage() {
    const router = useRouter();
    const supabase = getSupabaseClient();
    const configured = isSupabaseConfigured();
    const [mode, setMode] = useState<AuthMode>('signin');
    const [signupPhase, setSignupPhase] = useState<SignupPhase>('email-entry');
    const [locale, setLocale] = useState('zh-CN');
    const [nextPath, setNextPath] = useState('/');
    const [callbackErrorCode, setCallbackErrorCode] = useState<string | null>(null);
    const [email, setEmail] = useState('');
    const [verifiedByLink, setVerifiedByLink] = useState(false);
    const [verificationRequested, setVerificationRequested] = useState(false);
    const [verifiedEmailSnapshot, setVerifiedEmailSnapshot] = useState('');
    const [verificationBusy, setVerificationBusy] = useState(false);
    const [cooldownSeconds, setCooldownSeconds] = useState(0);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [infoMessage, setInfoMessage] = useState<string | null>(null);

    const isChinese = locale.startsWith('zh');

    useEffect(() => {
        setLocale(resolveLocale());
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const params = new URLSearchParams(window.location.search);
        const returnTo = params.get('returnTo');
        const requestedPath = params.get('next');
        setNextPath(
            isSafeRedirectPath(returnTo)
                ? returnTo
                : isSafeRedirectPath(requestedPath)
                    ? requestedPath
                    : '/'
        );

        const requestedMode = params.get('mode');
        if (requestedMode === 'signin' || requestedMode === 'signup') {
            setMode(requestedMode);
        }

        const prefilledEmail = params.get('email');
        if (prefilledEmail) {
            setEmail(normalizeEmail(prefilledEmail));
        }

        setVerifiedByLink(params.get('verified') === '1');
        setCallbackErrorCode(params.get('error'));
    }, []);

    useEffect(() => {
        const callbackError = mapCallbackError(callbackErrorCode, locale);
        if (callbackError) {
            setErrorMessage(callbackError);
        }
    }, [callbackErrorCode, locale]);

    useEffect(() => {
        if (!supabase) {
            return;
        }

        let active = true;
        void supabase.auth.getUser().then(({ data }) => {
            if (active && data.user && mode === 'signin') {
                router.replace(nextPath);
            }
        });

        return () => {
            active = false;
        };
    }, [mode, nextPath, router, supabase]);

    useEffect(() => {
        if (mode !== 'signup') {
            return;
        }

        if (cooldownSeconds <= 0) {
            return;
        }

        const timerId = window.setTimeout(() => {
            setCooldownSeconds((current) => Math.max(0, current - 1));
        }, 1000);

        return () => {
            window.clearTimeout(timerId);
        };
    }, [cooldownSeconds, mode]);

    useEffect(() => {
        if (!supabase || mode !== 'signup') {
            return;
        }

        const normalized = normalizeEmail(email);
        if (!normalized) {
            setSignupPhase('email-entry');
            return;
        }

        let active = true;

        const syncVerificationPhase = (user: { email?: string | null; email_confirmed_at?: string | null } | null) => {
            if (!active) {
                return;
            }

            const userEmail = normalizeEmail(user?.email ?? '');
            const hasMatchingVerifiedUser = Boolean(
                userEmail &&
                userEmail === normalized &&
                user?.email_confirmed_at &&
                (verifiedByLink || verificationRequested)
            );

            if (hasMatchingVerifiedUser) {
                setVerifiedEmailSnapshot(userEmail);
                setSignupPhase('password-setup');
                setErrorMessage(null);
                setInfoMessage(
                    locale.startsWith('zh')
                        ? '邮箱验证通过，请设置密码完成注册。'
                        : 'Email verified. Set your password to complete registration.'
                );
                return;
            }

            if (verificationRequested) {
                setSignupPhase('awaiting-link');
            }
        };

        void supabase.auth.getUser().then(({ data }) => {
            syncVerificationPhase(data.user);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            syncVerificationPhase(session?.user ?? null);
        });

        return () => {
            active = false;
            subscription.unsubscribe();
        };
    }, [email, locale, mode, supabase, verificationRequested, verifiedByLink]);

    function resetSignupVerificationState() {
        setVerificationRequested(false);
        setVerifiedByLink(false);
        setVerifiedEmailSnapshot('');
        setVerificationBusy(false);
        setCooldownSeconds(0);
        setSignupPhase('email-entry');
        setPassword('');
        setConfirmPassword('');
    }

    function handleEmailChange(nextValue: string) {
        const normalized = normalizeEmail(nextValue);
        setEmail(normalized);

        if (mode === 'signup') {
            resetSignupVerificationState();
            setErrorMessage(null);
            setInfoMessage(null);
        }
    }

    async function handleSendVerificationLink() {
        if (!supabase) {
            setErrorMessage(isChinese ? 'Supabase 尚未配置。' : 'Supabase is not configured.');
            return;
        }

        const normalizedEmail = normalizeEmail(email);
        if (!normalizedEmail) {
            setErrorMessage(isChinese ? '请先填写邮箱。' : 'Please enter your email first.');
            return;
        }

        if (cooldownSeconds > 0 || verificationBusy) {
            return;
        }

        setVerificationBusy(true);
        setErrorMessage(null);
        setInfoMessage(null);

        try {
            const postVerifyPath = `/auth?mode=signup&verified=1&email=${encodeURIComponent(normalizedEmail)}&returnTo=${encodeURIComponent(nextPath)}`;
            const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(postVerifyPath)}`;

            const { error } = await supabase.auth.signUp({
                email: normalizedEmail,
                password: createTemporarySignupPassword(),
                options: {
                    emailRedirectTo: redirectTo,
                },
            });

            if (error) {
                throw error;
            }

            setVerificationRequested(true);
            setVerifiedEmailSnapshot(normalizedEmail);
            setSignupPhase('awaiting-link');
            setCooldownSeconds(VERIFY_COOLDOWN_SECONDS);
            setInfoMessage(
                isChinese
                    ? '验证链接已发送，请前往邮箱查看。通过验证后将显示密码设置。'
                    : 'Verification link sent. Check your inbox. Password setup appears after verification.'
            );
        } catch (error) {
            const message = error instanceof Error
                ? error.message
                : isChinese
                    ? '发送验证链接失败，请重试。'
                    : 'Failed to send verification link. Please retry.';

            if (/already registered|already exists|user already/i.test(message)) {
                setErrorMessage(
                    isChinese
                        ? '该邮箱已注册，请直接登录或使用忘记密码。'
                        : 'This email is already registered. Please sign in or reset password.'
                );
            } else {
                setErrorMessage(message);
            }
        } finally {
            setVerificationBusy(false);
        }
    }

    async function handleEmailAuth(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!supabase) {
            setErrorMessage(isChinese ? 'Supabase 尚未配置。' : 'Supabase is not configured.');
            return;
        }

        setBusy(true);
        setErrorMessage(null);
        setInfoMessage(null);

        try {
            if (mode === 'signin') {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) {
                    throw error;
                }

                router.replace(nextPath);
                return;
            }

            if (signupPhase !== 'password-setup') {
                throw new Error(
                    isChinese
                        ? '请先完成邮箱验证，验证通过后再设置密码。'
                        : 'Please verify your email first. Password setup is available after verification.'
                );
            }

            const normalizedEmail = normalizeEmail(email);
            if (normalizeEmail(verifiedEmailSnapshot) !== normalizedEmail) {
                throw new Error(
                    isChinese
                        ? '当前邮箱与已验证邮箱不一致，请重新验证。'
                        : 'Current email does not match the verified email. Please verify again.'
                );
            }

            if (password.length < MIN_PASSWORD_LENGTH) {
                throw new Error(
                    isChinese
                        ? `密码长度至少 ${MIN_PASSWORD_LENGTH} 位。`
                        : `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
                );
            }

            if (password !== confirmPassword) {
                throw new Error(isChinese ? '两次输入的密码不一致。' : 'Passwords do not match.');
            }

            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError || !user) {
                throw new Error(
                    isChinese
                        ? '未检测到已验证会话，请在同一浏览器中完成邮箱验证后重试。'
                        : 'No verified session was found. Complete email verification in the same browser and retry.'
                );
            }

            if (normalizeEmail(user.email ?? '') !== normalizedEmail || !user.email_confirmed_at) {
                throw new Error(
                    isChinese
                        ? '邮箱尚未验证完成，请先点击邮件中的验证链接。'
                        : 'Email verification is not complete yet. Please open the verification link from your email.'
                );
            }

            const { error } = await supabase.auth.updateUser({
                password,
            });

            if (error) {
                throw error;
            }

            setInfoMessage(
                isChinese
                    ? '注册完成，正在进入应用...'
                    : 'Registration complete. Redirecting...'
            );
            setConfirmPassword('');
            router.replace(nextPath);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : isChinese ? '操作失败，请重试。' : 'Request failed. Please retry.');
        } finally {
            setBusy(false);
        }
    }

    async function handleGoogleSignIn() {
        if (!supabase) {
            setErrorMessage(isChinese ? 'Supabase 尚未配置。' : 'Supabase is not configured.');
            return;
        }

        setBusy(true);
        setErrorMessage(null);
        setInfoMessage(null);

        try {
            const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo,
                },
            });

            if (error) {
                throw error;
            }
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : isChinese ? 'Google 登录失败。' : 'Google sign-in failed.');
            setBusy(false);
        }
    }

    if (!configured || !supabase) {
        return (
            <main className="landing-shell">
                <div className="landing-shell__glow" />
                <section className="landing-card">
                    <h1 className="landing-card__title">Supabase configuration required.</h1>
                    <p className="landing-card__body">
                        Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY first.
                    </p>
                </section>
            </main>
        );
    }

    return (
        <main className="landing-shell auth-shell">
            <div className="landing-shell__glow" />
            <section className="auth-card">
                <p className="auth-card__eyebrow">Orbit Planner</p>
                <h1 className="auth-card__title">{isChinese ? '登录你的账号' : 'Sign in to Orbit Planner'}</h1>
                <p className="auth-card__subtitle">
                    {isChinese
                        ? '支持邮箱密码和 Google 登录。'
                        : 'Use email/password or continue with Google.'}
                </p>

                <div className="auth-card__modes" role="tablist" aria-label="auth mode">
                    <MotionButton
                        aria-selected={mode === 'signin'}
                        className={`auth-card__mode ${mode === 'signin' ? 'is-active' : ''}`}
                        motionPreset="subtle"
                        onClick={() => {
                            setMode('signin');
                            setErrorMessage(null);
                            setInfoMessage(null);
                        }}
                        role="tab"
                        type="button"
                    >
                        {isChinese ? '登录' : 'Sign in'}
                    </MotionButton>
                    <MotionButton
                        aria-selected={mode === 'signup'}
                        className={`auth-card__mode ${mode === 'signup' ? 'is-active' : ''}`}
                        motionPreset="subtle"
                        onClick={() => {
                            setMode('signup');
                            setErrorMessage(null);
                            setInfoMessage(null);
                            setSignupPhase('email-entry');
                        }}
                        role="tab"
                        type="button"
                    >
                        {isChinese ? '注册' : 'Sign up'}
                    </MotionButton>
                </div>

                <form className="auth-card__form" onSubmit={(event) => void handleEmailAuth(event)}>
                    {mode === 'signup' ? (
                        <div className="auth-card__email-row">
                            <label className="auth-card__label">
                                {isChinese ? '邮箱' : 'Email'}
                                <input
                                    autoComplete="email"
                                    className="auth-card__input"
                                    onChange={(event) => handleEmailChange(event.target.value)}
                                    placeholder="you@example.com"
                                    required
                                    type="email"
                                    value={email}
                                />
                            </label>

                            <MotionButton
                                className="planner-button planner-button--ghost auth-card__verify-button"
                                disabled={verificationBusy || busy || !email || signupPhase === 'password-setup' || cooldownSeconds > 0}
                                onClick={() => void handleSendVerificationLink()}
                                type="button"
                            >
                                {verificationBusy
                                    ? isChinese
                                        ? '发送中...'
                                        : 'Sending...'
                                    : cooldownSeconds > 0
                                        ? isChinese
                                            ? `重发(${cooldownSeconds}s)`
                                            : `Resend (${cooldownSeconds}s)`
                                        : signupPhase === 'password-setup'
                                            ? isChinese
                                                ? '已验证'
                                                : 'Verified'
                                            : isChinese
                                                ? '验证邮箱'
                                                : 'Verify'}
                            </MotionButton>
                        </div>
                    ) : (
                        <label className="auth-card__label">
                            {isChinese ? '邮箱' : 'Email'}
                            <input
                                autoComplete="email"
                                className="auth-card__input"
                                onChange={(event) => setEmail(normalizeEmail(event.target.value))}
                                placeholder="you@example.com"
                                required
                                type="email"
                                value={email}
                            />
                        </label>
                    )}

                    {mode === 'signin' || signupPhase === 'password-setup' ? (
                        <label className="auth-card__label">
                            {isChinese ? '密码' : 'Password'}
                            <input
                                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                                className="auth-card__input"
                                minLength={MIN_PASSWORD_LENGTH}
                                onChange={(event) => setPassword(event.target.value)}
                                required
                                type="password"
                                value={password}
                            />
                        </label>
                    ) : null}

                    {mode === 'signup' && signupPhase === 'password-setup' ? (
                        <label className="auth-card__label">
                            {isChinese ? '确认密码' : 'Confirm password'}
                            <input
                                autoComplete="new-password"
                                className="auth-card__input"
                                minLength={MIN_PASSWORD_LENGTH}
                                onChange={(event) => setConfirmPassword(event.target.value)}
                                required
                                type="password"
                                value={confirmPassword}
                            />
                        </label>
                    ) : null}

                    {errorMessage ? <p className="auth-card__error">{errorMessage}</p> : null}
                    {infoMessage ? <p className="auth-card__success">{infoMessage}</p> : null}

                    <div className="auth-card__actions">
                        {mode === 'signin' || signupPhase === 'password-setup' ? (
                            <MotionButton className="planner-button auth-card__submit" disabled={busy} type="submit">
                                {busy
                                    ? isChinese
                                        ? '处理中...'
                                        : 'Processing...'
                                    : mode === 'signin'
                                        ? isChinese
                                            ? '邮箱登录'
                                            : 'Sign in with Email'
                                        : isChinese
                                            ? '完成注册'
                                            : 'Complete Registration'}
                            </MotionButton>
                        ) : null}

                        <MotionButton
                            aria-label={isChinese ? 'Google 登录' : 'Sign in with Google'}
                            className="planner-button planner-button--ghost auth-card__google"
                            disabled={busy}
                            onClick={() => void handleGoogleSignIn()}
                            title={isChinese ? 'Google 登录' : 'Sign in with Google'}
                            type="button"
                        >
                            <GoogleIcon />
                        </MotionButton>
                    </div>
                </form>

                <div className="auth-card__links">
                    <Link className="auth-card__link" href="/auth/reset">
                        {isChinese ? '忘记密码？' : 'Forgot password?'}
                    </Link>
                </div>
            </section>
        </main>
    );
}
