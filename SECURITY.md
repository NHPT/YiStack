# Security Policy

## Supported Versions

YiStack has not published a stable release. Security fixes are applied to the
current `main` branch only. Older commits, forks, generated applications, and
third-party deployment images are not supported by this policy.

## Reporting a Vulnerability

Do not disclose a suspected vulnerability in a public issue, discussion, pull
request, log, screenshot, or generated benchmark artifact.

Use GitHub's private vulnerability reporting for this repository:

<https://github.com/NHPT/YiStack/security/advisories/new>

Include:

- affected commit or version;
- affected component and deployment topology;
- reproduction steps or a minimal proof of concept;
- expected and observed impact;
- whether credentials, user data, containers, or generated projects are
  exposed;
- any known workaround.

Maintainers aim to acknowledge a complete report within three business days
and provide an initial severity assessment within seven business days. These
targets are not a service-level agreement.

## Disclosure Process

1. Maintainers reproduce and classify the issue privately.
2. A fix and regression test are prepared on a private branch when needed.
3. Affected users receive mitigation guidance when a safe channel exists.
4. The fix is released before or together with a public advisory.
5. Reporter credit is included when requested and legally permitted.

Please allow coordinated remediation before public disclosure.

## Security Boundaries

- Never commit `.env`, API tokens, OAuth secrets, encryption keys, database
  credentials, generated user projects, or private benchmark evidence.
- Treat `runtime/`, `logs/`, `.yistack/`, and local Supabase data as
  environment-specific and potentially sensitive.
- Run Podman rootless. Do not expose the Podman socket or preview ports to
  untrusted networks.
- Replace all example JWT secrets and default seed credentials before any
  non-local deployment.
- GitHub, Vercel, Supabase, model-provider, and container-registry incidents
  must also be reported to the affected upstream provider.

The Apache-2.0 license provides the software without warranty; this policy
describes the project's handling process and does not create a warranty or SLA.
