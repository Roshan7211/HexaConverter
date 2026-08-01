# Security policy

## Reporting a vulnerability

Please report security issues privately rather than opening a public issue.

Use the [contact form](https://www.hexaconverter.com/contact) with the subject
prefix `SECURITY`, or email the address published in the repository metadata.
Include:

- the affected endpoint, route or component;
- reproduction steps or a proof of concept;
- the impact you believe it has.

We acknowledge reports within **two business days** and aim to ship a fix for a
confirmed high-severity issue within **seven days**. We will keep you updated
while the fix is in progress and credit you in the release notes unless you
prefer otherwise.

Please do not run automated scanners against the hosted service, exfiltrate
data belonging to other users, or degrade availability while testing. Testing
against your own local deployment is always welcome.

## Supported versions

The `main` branch and the most recent tagged release receive security fixes.

## Controls in place

| Area              | Control                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------ |
| Upload validation | Magic-byte container sniffing, extension consistency check, streaming size enforcement     |
| Command execution | Argument arrays only — no shell interpolation anywhere                                     |
| Input options     | Strict Zod schemas that reject unknown keys and clamp all numeric bounds                   |
| Archive handling  | Entry-count, total-size and compression-ratio limits; path-traversal and symlink rejection |
| Resource limits   | Pixel ceiling on decoding, cell budget on spreadsheets, wall-clock timeout per process     |
| Authorisation     | Ownership-scoped queries; HMAC-signed, short-lived download tokens and upload tickets      |
| Authentication    | bcrypt cost 12, constant-time comparisons, no account enumeration                          |
| Transport         | HSTS, restrictive CSP, `nosniff`, `frame-ancestors 'none'`, same-origin API enforcement    |
| Isolation         | Unprivileged container user, per-job temporary directories, private LibreOffice profile    |
| Data minimisation | EXIF stripped by default, IP addresses stored only as salted hashes, scheduled deletion    |
| Abuse prevention  | Per-route rate limits, plan quotas, concurrency caps, contact-form honeypot                |

## Operational guidance

- Rotate `NEXTAUTH_SECRET`, `DOWNLOAD_URL_SECRET` and `CRON_SECRET` on a
  schedule. Rotating `DOWNLOAD_URL_SECRET` invalidates outstanding download
  links and upload tickets, which is the intended behaviour after an incident.
- Keep the object storage bucket private, with server-side encryption and a
  lifecycle rule matching your longest retention window as a backstop to the
  application-level cleanup job.
- Run the cleanup cron on schedule; it is what enforces the retention promises
  in the privacy policy.
- Rebuild the container image regularly. LibreOffice and Poppler are the largest
  attack surface in the runtime and both receive frequent upstream fixes.
