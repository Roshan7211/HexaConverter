# Google Play listing — privacy and data safety

Everything Google Play asks for about data handling, answered from what the code
actually does rather than from what would be convenient to claim. The Data
safety form and the privacy policy are cross-checked by reviewers, so the
answers below and `/legal/privacy` must stay in step: change one, change both.

Written for the app as agreed — a Trusted Web Activity wrapping the website,
with **no analytics, crash-reporting, advertising or billing SDKs**. If any of
those are added later, [what changes](#if-you-add-sdks-later) lists exactly
which answers stop being true.

- [URLs to paste into the listing](#urls-to-paste-into-the-listing)
- [Data safety form answers](#data-safety-form-answers)
- [Account deletion declaration](#account-deletion-declaration)
- [Other declarations](#other-declarations)
- [If you add SDKs later](#if-you-add-sdks-later)
- [Before you submit](#before-you-submit)

## URLs to paste into the listing

Replace `hexaconverter.app` with the production domain if it differs. These must
resolve over HTTPS, be publicly reachable with no sign-in and no geo-blocking,
and must not be a Google Doc or a file that anyone can edit.

| Play Console field           | URL                                                |
| ---------------------------- | -------------------------------------------------- |
| Privacy policy (App content) | `https://hexaconverter.app/legal/privacy`          |
| Data deletion — web URL      | `https://hexaconverter.app/legal/account-deletion` |
| Support email                | `support@hexaconverter.app`                        |
| Terms of service (optional)  | `https://hexaconverter.app/legal/terms`            |

Both legal pages are statically prerendered, listed in `sitemap.xml`, allowed by
`robots.txt`, and linked from the site footer.

## Data safety form answers

### Does your app collect or share any of the required user data types?

**Yes.** Answering "no" would be wrong: the app transmits uploaded files and, for
account holders, an email address.

### Is all user data encrypted in transit?

**Yes.** HTTPS with HSTS enforced, on the web and inside the TWA.

### Do you provide a way for users to request that their data be deleted?

**Yes.** In-app from Settings, and from the public web URL above.

### Data types

For every row: collected **yes**, shared **no**, processed **ephemerally** only
where stated, and **never** used for advertising, marketing, fraud prevention on
behalf of a third party, or personalisation.

| Data type                    | Collected | Shared | Optional?            | Purpose                        | Notes                                                              |
| ---------------------------- | --------- | ------ | -------------------- | ------------------------------ | ------------------------------------------------------------------ |
| Files and docs               | Yes       | No     | Required for the app | App functionality              | The file being converted. Deleted on the schedule in the policy.   |
| Photos and videos            | Yes       | No     | Required for the app | App functionality              | Only when the user picks one to convert. Same deletion schedule.   |
| Email address                | Yes       | No     | **Optional**         | Account management             | Only if the user creates an account; conversions work without one. |
| Name                         | Yes       | No     | **Optional**         | Account management             | Display name, account holders only.                                |
| Password                     | Yes       | No     | **Optional**         | Account management             | Stored only as a bcrypt hash.                                      |
| App activity — other actions | Yes       | No     | Required for the app | App functionality, Analytics\* | Conversion records: formats, sizes, duration, status.              |
| Other IDs                    | Yes       | No     | Required for the app | Fraud prevention, security     | Opaque guest cookie identifier. Not an advertising or device ID.   |

\* Tick "Analytics" for the conversion record only if you surface conversion
history and statistics in the dashboard, which this app does. It is first-party
product data; no analytics SDK is involved and nothing leaves the service.

### Data types you must NOT tick

Ticking these would contradict the policy and the code:

- Location (precise or approximate) — never requested.
- Contacts, calendar, SMS, call logs — never requested.
- Advertising ID — not collected; no ad SDK is present.
- Device or other IDs beyond the guest cookie above.
- Financial info, health, purchase history — no billing integration.
- Installed apps, in-app search history, audio.

### The IP address question

Play does not have an "IP address" data type. The service never stores a raw IP
address — only a salted SHA-256 hash, used for rate limiting and abuse
investigation. That is covered by the "Other IDs" row and is described
explicitly in the privacy policy. Do not tick "Device or other IDs" for an
advertising or hardware identifier, because none is collected.

## Account deletion declaration

Play requires apps that let users create an account to offer deletion of the
account **and** its associated data, reachable both in the app and from a public
web page.

- **In-app:** Settings → Delete account. Immediate, no request queue.
- **Web:** `https://hexaconverter.app/legal/account-deletion`.
- **What is deleted:** profile, email, display name, password hash, connected
  providers, conversion history, stored files, pinned conversions,
  notifications, and every session. Enforced by `deleteAccount()` in
  `src/services/account/account.service.ts`, which removes stored objects before
  deleting the row; the remaining records are removed by database cascade.
- **What is retained:** security audit entries for 12 months. These hold a
  salted IP hash and no file contents. Declare this in the "partial deletion"
  box — Play accepts retention for security and legal reasons when it is stated.

## Other declarations

**Ads.** The app contains no ads. Answer "No, my app does not contain ads."

**Content rating.** The app converts user-supplied files and shows no curated
content. Answer the questionnaire honestly about user-generated content: files
are private to the person who uploaded them and are not shared, published or
discoverable by other users.

**Target audience.** Not directed at children. The policy states an under-16
position, so do not select a child audience — doing so pulls the listing into
the Families policy, which requires far more.

**Permissions.** The TWA declares `INTERNET`. File access happens through the
Android system file picker, which needs no storage permission. If a wrapper
template adds `READ_EXTERNAL_STORAGE`, remove it: Play requires a declaration
for broad storage access and the app does not need it.

**Data safety "third parties".** The infrastructure providers (hosting, object
storage, database, SMTP) are processors acting on instruction, not recipients
you must declare as data sharing. "Sharing" in Play's sense means transfer to a
distinct company for its own purposes, which does not happen here.

## If you add SDKs later

Each of these invalidates specific answers above. Update the Data safety form
**and** `/legal/privacy` in the same release, or the listing becomes inaccurate.

| If you add                        | You must then declare                                                           |
| --------------------------------- | ------------------------------------------------------------------------------- |
| Firebase Analytics / GA           | App activity and Device/other IDs collected; Google as a recipient              |
| Crashlytics or any crash reporter | Crash logs and diagnostics collected                                            |
| AdMob or any ad network           | Advertising ID collected **and shared**; ads present; a consent flow in the EEA |
| Play Billing / subscriptions      | Purchase history collected; financial info handling                             |
| Push notifications (FCM)          | Device/other IDs collected                                                      |

The privacy policy currently states plainly that the app contains none of these.
That sentence is the first thing to change.

## Before you submit

- [ ] Point `NEXT_PUBLIC_APP_URL` at the production domain. The policy renders
      the site URL from it, so a stale value publishes a policy naming the wrong
      site.
- [ ] Confirm `support@hexaconverter.app` actually receives mail, and that
      someone reads it. A bouncing contact on a privacy policy is a rejection,
      and the address is also the deletion-request channel.
- [ ] Set `CONTACT_INBOX` to the same address so the contact form agrees with
      the policy.
- [ ] Open both legal URLs in a private window, signed out, to confirm they load
      with no redirect to sign-in.
- [ ] Re-read the retention table against `UNIVERSAL_LIMITS.retentionHours` and
      the constants in `src/services/jobs/retention.service.ts` if either has
      changed since this was written.
- [ ] Have someone qualified review the policy. It is written to match the code,
      but matching the code is not the same as meeting every obligation that
      applies to you in your jurisdiction.
