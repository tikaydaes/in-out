# Privacy and Data Disclosure -- in/out Browser Extension

**Version:** 1.0
**Last Updated:** 2026-03-16

This document describes what the in/out browser extension ("Extension") does with data, what risks you accept by using it, and what responsibilities fall on you as the user. Read this before using the Extension.

## Important Warnings

**This tool violates LinkedIn's Terms of Service.** LinkedIn's User Agreement (Section 8.2) explicitly prohibits the use of browser extensions, scripts, and automated tools to scrape or copy data from LinkedIn. By using this Extension, you acknowledge that you are violating LinkedIn's Terms of Service and accept all consequences, including but not limited to: account restrictions, permanent account suspension, IP blacklisting, and potential legal action by LinkedIn.

**You are solely responsible for all data you collect.** Once data is exported from the Extension, you are the sole data controller. There is no entity behind this tool that shares, manages, or accepts liability for your use of exported data.

**No warranty. No support. No liability.** This Extension is provided as-is, without warranty of any kind, express or implied. The contributors to this project accept no liability for any damages, losses, account suspensions, legal claims, or other consequences arising from your use of this tool.

## What the Extension Does

The Extension allows you to export data about LinkedIn connections, followers, and company followers. It works by making requests to LinkedIn's internal web API (Voyager API) using your active LinkedIn session. All processing happens locally in your browser. No data is sent to any external server.

## What Data the Extension Accesses

### Your LinkedIn Session

The Extension reads your LinkedIn session cookie (JSESSIONID) from your browser to authenticate requests to LinkedIn's API. This cookie value is used transiently to construct request headers. It is not stored persistently, logged, or transmitted anywhere outside of requests to linkedin.com.

### Third-Party Profile Data

When you run an export, the Extension retrieves the following information about other LinkedIn users:

- **Identity:** First name, last name, public profile URL, LinkedIn entity identifier
- **Professional:** Current job title, headline, professional summary, industry
- **Employment:** Current employer name, employer LinkedIn identifier, employer website domain
- **Location:** Geographic location as displayed on their LinkedIn profile
- **Skills and qualifications:** Listed skills, education history (institution, degree, field of study), languages
- **Employer metadata:** Company name, domain, industry, staff count, description, tagline, specialties, founding year, headquarters location, company type

The specific data retrieved depends on what each individual has made visible on their LinkedIn profile and the export mode you select.

### What the Extension Does Not Access

- Email addresses
- Phone numbers
- Passwords or login credentials
- Browsing history (beyond detecting whether the current LinkedIn page is a company page)
- Financial or payment information
- Data from any website other than linkedin.com

## How Data is Collected

The Extension makes HTTP requests to LinkedIn's internal Voyager API endpoints using your authenticated session. These are the same API endpoints that LinkedIn's own web application uses. The Extension impersonates LinkedIn's web client by sending appropriate request headers.

A content script injected into LinkedIn pages proxies these API requests from your browser's extension context to LinkedIn's servers, using your existing session cookies for authentication.

## Where Data is Stored

All data stays on your machine. The Extension does not transmit any collected data to any server.

| Data | Where It Lives | How Long |
|---|---|---|
| Exported profiles (JSONL files) | Your local filesystem after you download them | Until you delete the files |
| Company domain cache | `chrome.storage.local` in your browser | 30 days, then automatically deleted. You can clear it manually from the Extension popup. |
| Export session state | `chrome.storage.session` in your browser | Cleared when your browser session ends or the export completes |
| LinkedIn session cookie | Your browser's cookie store (read-only by the Extension) | Managed by LinkedIn and your browser, not by this Extension |

### Security Limitations

**`chrome.storage.local` is not encrypted.** Cached company domain data is stored in plain text in your browser's local storage. Any process or extension with access to your browser profile can read this data. If this concerns you, clear the cache after each use or avoid using the Extension on shared machines.

**Exported JSONL files are plain text.** The downloaded files contain personal information in unencrypted JSON format. If you transfer these files off your machine (email, cloud storage, USB), you are responsible for ensuring secure transmission and storage. Consider encrypting files before transferring them.

## Your Responsibilities

By using this Extension, you accept sole responsibility for:

- **LinkedIn ToS violation.** You understand this tool violates LinkedIn's Terms of Service and accept all associated risks to your LinkedIn account.
- **Data controller obligations.** You are the sole data controller for any personal information you export. Depending on your jurisdiction, privacy laws may impose obligations on how you handle, store, use, and dispose of this data. These may include the Australian Privacy Act 1988, the EU General Data Protection Regulation (GDPR), or other applicable privacy frameworks.
- **Lawful basis for collection.** You must determine whether you have a lawful basis to collect and process the personal information of the individuals whose profiles you export.
- **Notification obligations.** Some privacy laws require you to notify individuals when you collect their personal information. Compliance with any such requirement is your responsibility.
- **Data security.** You must store and protect exported data appropriately and delete it when no longer needed.
- **Downstream use.** Any use you make of the exported data -- including sharing it with others, importing it into other tools, or using it for outreach -- is entirely your responsibility.

## No Telemetry, No Analytics, No Phone-Home

The Extension contains no analytics, telemetry, tracking pixels, or server-side reporting. It does not contact any server other than linkedin.com. It does not report usage statistics, error logs, or any other information to any party.

## Children

This Extension is not intended for use by anyone under 18 years of age.

## Changes to This Document

This document may be updated. Changes are reflected by updating the version number and date at the top. Check the repository for the latest version.

## Disclaimer of Warranties and Limitation of Liability

THIS EXTENSION IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.

IN NO EVENT SHALL THE CONTRIBUTORS TO THIS PROJECT BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR EXEMPLARY DAMAGES (INCLUDING BUT NOT LIMITED TO LOSS OF DATA, LOSS OF PROFITS, BUSINESS INTERRUPTION, OR LINKEDIN ACCOUNT SUSPENSION) ARISING FROM THE USE OR INABILITY TO USE THIS EXTENSION, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.

YOU USE THIS EXTENSION ENTIRELY AT YOUR OWN RISK.
