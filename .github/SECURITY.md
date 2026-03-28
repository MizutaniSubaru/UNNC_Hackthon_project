# Security Policy

## Supported Versions

This project is under active development. Only the latest code on the default branch is supported for security updates.

| Version                 | Supported | Notes                    |
| ----------------------- | --------- | ------------------------ |
| Default branch (latest) | Yes       | Receives security fixes  |
| Older commits or forks  | No        | Please upgrade to latest |

## Reporting a Vulnerability

Please do not open public issues for security vulnerabilities.

Use one of the following private channels:

1. GitHub Security Advisories (preferred): Security tab -> Report a vulnerability
2. Private maintainer contact channel used by this project team

Please include:

- A clear description of the issue
- Affected components (for example API route, parser, dependency, or Supabase policy)
- Reproduction steps or proof of concept
- Impact assessment (what can an attacker do)
- Suggested mitigation if available

## Response Targets

The team aims for the following response windows:

- Initial acknowledgment: within 72 hours
- Triage decision: within 7 calendar days
- Fix timeline (target):
  - Critical: within 7 days
  - High: within 14 days
  - Medium: within 30 days
  - Low: next planned release

Complex issues may require longer timelines; we will share status updates during investigation.

## Coordinated Disclosure

- Please allow time for investigation and patching before public disclosure.
- After a fix is available, maintainers will coordinate disclosure details.
- Reporter credit can be included if requested.

## Scope Notes

In scope:

- Application API endpoints and business logic
- Data access rules and Supabase security configuration
- Dependency vulnerabilities with practical exploitability
- Secret exposure in repository or deployment configuration

Out of scope:

- Non-exploitable theoretical issues
- Purely local development misconfiguration with no security impact
- Social engineering or phishing campaigns unrelated to code defects
