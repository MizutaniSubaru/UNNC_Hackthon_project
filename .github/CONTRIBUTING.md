# Contributing Guide

Thanks for your interest in improving this project.

## Before You Start

1. Read README and SECURITY policy.
2. Search existing issues and pull requests to avoid duplication.
3. For security issues, do not open a public issue. Use the private flow in SECURITY.md.

## Local Setup

1. Install dependencies:

   bun install

2. Create local environment file:

   copy .env.example .env.local

3. Start development server:

   bun run dev

## Branch and Commit

1. Create a feature branch from main.
2. Keep commits focused and small.
3. Prefer clear commit prefixes such as feat, fix, refactor, docs, chore.

## Pull Request Checklist

Before opening a PR, please verify:

- Code compiles successfully.
- Lint passes: bun run lint
- Build passes: bun run build
- Changes are documented where needed.
- Any new environment variable is added to .env.example.
- Screenshots are attached for UI changes.

## Scope and Quality

- Keep behavior changes explicit in PR description.
- Add tests when introducing new logic.
- Avoid unrelated refactors in the same PR.

## Review Expectations

- A maintainer may request updates before merge.
- Large PRs may take longer to review.
- Maintainers can close stale or out-of-scope PRs.
