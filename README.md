# in↔out

A Chrome extension that exports LinkedIn connections, followers, and company followers to JSONL format.

## Possible LinkedIn Terms of Service Violations

Using this extension likely violates LinkedIn's User Agreement, including but not limited to:

- **Section 8.2** — Prohibits scraping, crawling, or using automated tools (including browser extensions) to access or extract data from LinkedIn.
- **API misuse** — The extension accesses LinkedIn's internal Voyager API, which is undocumented and not intended for third-party use.
- **Data extraction at scale** — Bulk exporting profile data (names, titles, employers, locations, skills, education) goes beyond normal platform usage.

Consequences may include account restriction, permanent suspension, IP blacklisting, or legal action by LinkedIn.

## Your Responsibilities for Third-Party Privacy

When you export data with this extension, you collect personal information about other LinkedIn users. You are the sole data controller for that data.

- **Privacy law obligations** — Depending on your jurisdiction, laws such as the GDPR, Australian Privacy Act 1988, CCPA, or other frameworks may impose obligations on how you collect, store, process, and dispose of personal data.
- **Lawful basis** — You must determine whether you have a lawful basis to collect and process the personal information of the individuals whose profiles you export.
- **Notification** — Some privacy laws require you to notify individuals when you collect their personal information.
- **Data security** — You must store and protect exported data appropriately and delete it when no longer needed.
- **Downstream use** — Any use you make of exported data (sharing, importing into other tools, outreach) is entirely your responsibility.

## Liability Disclaimer

**You assume ALL liability for using this extension.**

This extension is provided "as is" without warranty of any kind, express or implied. The author does not accept liability for any damages, data loss, account suspension, legal claims, or other consequences arising from your use of this tool. You use it entirely at your own risk.

See [PRIVACY_POLICY.md](PRIVACY_POLICY.md) for the full privacy and data disclosure.

## Installing the Extension

The extension is built and packaged automatically on every push to `main`. Each build creates a GitHub release with a downloadable zip.

### Download from Releases

1. Go to the [Releases](../../releases) page of this repository.
2. Download the latest `in-out-extension-v*.zip` file.
3. Unzip the downloaded file — it contains the packaged extension folder.

### Load into Chrome

1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** using the toggle in the top-right corner.
3. Click **Load unpacked**.
4. Select the unzipped `in-out-extension` folder (the one containing `manifest.json`).
5. The extension icon will appear in your toolbar. Pin it for easy access.

### Usage

1. Log in to LinkedIn in a Chrome tab.
2. Click the extension icon to open the popup.
3. Select an export type (connections, followers, company followers, or manual list).
4. Click **Start Export** and wait for the process to complete.
5. Click **Download JSONL** to save the exported data.

## Building Locally

```bash
pnpm install
pnpm run build
```

The built files will be in the `dist/` directory. Load the entire project folder as an unpacked extension in Chrome.
