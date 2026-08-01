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

Replace `hexaconverter.com` with the production domain if it differs. These must
resolve over HTTPS, be publicly reachable with no sign-in and no geo-blocking,
and must not be a Google Doc or a file that anyone can edit.

| Play Console field           | URL                                           |
| ---------------------------- | --------------------------------------------- |
| Privacy policy (App content) | `https://www.hexaconverter.com/legal/privacy` |
| Support email                | `info@hexaconverter.com`                      |
| Terms of service (optional)  | `https://www.hexaconverter.com/legal/terms`   |

There is no "Data deletion — web URL" to give, because the app has no accounts;
see [Account deletion declaration](#account-deletion-declaration). The legal
pages are statically prerendered, listed in `sitemap.xml`, allowed by
`robots.txt`, and linked from the site footer.

## Data safety form answers

### Does your app collect or share any of the required user data types?

**Yes.** Answering "no" would be wrong: the app transmits the files a user
chooses to convert.

### Is all user data encrypted in transit?

**Yes.** HTTPS with HSTS enforced, on the web and inside the TWA.

### Do you provide a way for users to request that their data be deleted?

**Yes.** Files are deleted automatically on a fixed schedule, and the toolkits
offer a "delete my files" control that removes everything immediately. There is
no account to delete.

### Data types

For every row: collected **yes**, shared **no**, processed **ephemerally** only
where stated, and **never** used for advertising, marketing, fraud prevention on
behalf of a third party, or personalisation.

| Data type                    | Collected | Shared | Optional?            | Purpose                    | Notes                                                            |
| ---------------------------- | --------- | ------ | -------------------- | -------------------------- | ---------------------------------------------------------------- |
| Files and docs               | Yes       | No     | Required for the app | App functionality          | The file being converted. Deleted on the schedule in the policy. |
| Photos and videos            | Yes       | No     | Required for the app | App functionality          | Only when the user picks one to convert. Same deletion schedule. |
| App activity — other actions | Yes       | No     | Required for the app | App functionality          | Conversion records: formats, sizes, duration, status.            |
| Other IDs                    | Yes       | No     | Required for the app | Fraud prevention, security | Opaque guest cookie identifier. Not an advertising or device ID. |

Do **not** tick Email address, Name or Password. The app has no accounts, no
sign-in and no subscription, so none of the three is ever collected. Do not tick
"Analytics" either: nothing is surfaced back to the user and no analytics SDK is
involved.

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

Play requires this **only of apps that let users create an account**. This app
does not: there is no sign-up, no sign-in and no profile, so the account
deletion requirement does not apply and no data-deletion URL is needed.

Answer the Play Console question "Does your app allow users to create an
account?" with **No**.

- **What is stored:** the file being converted, a conversion record (formats,
  sizes, duration, status, salted IP hash) and an opaque cookie identifying the
  browser. Nothing identifies a person.
- **How it is deleted:** the source file goes as soon as the conversion
  finishes; the output goes on the retention schedule in the privacy policy; the
  job record is removed after 30 days by the scheduled cleanup. A user can also
  clear everything immediately with the "delete my files" control in the
  toolkits.

If accounts are ever reintroduced, this section and the data-deletion URL both
have to come back.

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
| Play Billing / subscriptions      | Purchase history collected; financial info handling; accounts likely return     |
| Push notifications (FCM)          | Device/other IDs collected                                                      |

The privacy policy currently states plainly that the app contains none of these.
That sentence is the first thing to change.

## Before you submit

- [ ] Point `NEXT_PUBLIC_APP_URL` at the production domain. The policy renders
      the site URL from it, so a stale value publishes a policy naming the wrong
      site.
- [ ] Confirm `info@hexaconverter.com` actually receives mail, and that
      someone reads it. A bouncing contact on a privacy policy is a rejection.
- [ ] Set `CONTACT_INBOX` to the same address so the contact form agrees with
      the policy.
- [ ] Open the legal URLs in a private window to confirm they load with no
      redirect and no prompt of any kind.
- [ ] Re-read the retention table against `LIMITS.retentionHours` and the
      constants in `src/services/jobs/retention.service.ts` if either has
      changed since this was written.
- [ ] Have someone qualified review the policy. It is written to match the code,
      but matching the code is not the same as meeting every obligation that
      applies to you in your jurisdiction.
