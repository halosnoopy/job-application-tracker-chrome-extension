# Job Application Tracker Chrome Extension
<img width="3788" height="1706" alt="image" src="https://github.com/user-attachments/assets/f2851abf-c9ea-48cb-87f6-c56426d20a6a" />


A local-first Chrome extension for saving job applications, improving job-posting extraction, reviewing application history, and backing up records to Google Drive.

---

## Version

Current version: **4.0**

Version 4 is the pipeline-history release. It keeps the simple save-and-review workflow from earlier versions, but adds timeline-based status tracking, email-assisted status updates, stronger dashboard analytics, and safer JSON history backup.

---

## Overview

Job Application Tracker helps users save submitted job applications from common job boards and manage the records in one dashboard.

Version 4 focuses on pipeline history and more useful analytics:

- Better local extraction for LinkedIn, Lever, and Greenhouse
- Optional Gemini AI extraction for harder pages
- Application date selection for backfilled records
- Status timeline history with update and correction flows
- AI email status update detection from open Gmail/Outlook messages
- Pipeline progress view for each application
- KPI cards, funnel analytics, and action-needed insights
- Action-needed analysis for upcoming events, stale follow-ups, offers, and recently advanced applications
- JSON history export/import for safer local backup
- Optional Google Drive history backup and restore
- Dashboard Settings panel for default view and API configuration
- Right-click page action for faster extraction
- Synthetic JSON test history for dashboard testing
- Local browser storage remains the main working copy

No custom backend server is required.

---

## Main Features

### Save Applications
<img width="1022" height="759" alt="image" src="https://github.com/user-attachments/assets/23e55259-58e3-4ccc-8913-48032d526b22" />


The popup saves:

- Company
- Job title
- Platform
- Status
- Application date
- Notes
- Job URL
- Submission date
- Unique application ID
- Status timeline history

You can open the popup in two ways:

- Click the extension icon.
- Right-click a job page and choose **Job Extract for JAT**. This opens a focused popup window and runs local extraction automatically.
- Right-click a Gmail or Outlook message and choose **JAT Status Update**. This opens the popup and runs AI extraction automatically for email status detection.

The right-click popup closes automatically after a successful save. When an email status update is applied from the popup, that window also closes automatically after the update is saved.

Supported status values:

- Submitted
- HR Reachout
- Phone Screen
- Interview
- Final Interview
- Offer
- Rejected
- Withdrawn

---

### Local Extraction

The **Local Extract** button reads the active job page and tries to fill company, job title, platform, and clean URL without using AI.

Current local extraction is tuned for:

- LinkedIn Top Picks
- LinkedIn search results
- LinkedIn jobs based on preferences
- Lever application pages
- Greenhouse application pages

The extraction logic uses a layered fallback strategy:

1. Site-specific selectors and page structure
2. Job board URL patterns
3. Browser/page title parsing
4. Structured job metadata when available
5. Conservative DOM fallback

For LinkedIn, the extractor also handles tricky cases where the visible job information is in a separate frame or page shell.

---

### AI Extraction

The **AI Extract** button uses Gemini as an optional fallback when local extraction is not enough.

Gemini receives a compact structured payload instead of the full page whenever possible. This reduces noise from recommendations, navigation, profile text, and unrelated job cards.

AI extraction is also context-aware. On open Gmail or Outlook messages, it can classify company or recruiter emails as application status updates, such as HR reachout, phone screen, interview, offer, rejection, or withdrawal.

AI extraction is intended to help with difficult pages and emails, but users should still review the result before saving or updating a timeline.

For email pages, the popup does not update a record immediately. It shows a review panel with:

- Detected company
- Detected job title
- Detected status
- Status date
- Timeline note
- Suggested matching saved applications

The user chooses the correct saved application before the timeline is updated. This avoids updating the wrong job when the company or title is ambiguous.

---

### Dashboard
<img width="3760" height="1411" alt="image" src="https://github.com/user-attachments/assets/33a17c83-af88-47fb-953d-029355cf2d5f" />

The dashboard includes:

- Metadata table view
- Statistical analysis view
- Search by company or job title
- Filter by status
- Sort by date, company, position, or platform
- Pagination
- JSON history export/import
- Batch delete
- Full reset with export reminder
- Settings panel

The dashboard uses Chart.js for:

- Application trend
- Status trend
- Pipeline funnel
- Status distribution
- Job title distribution
- Company distribution
- Action-needed list

The metadata table includes:

- Application date
- Company
- Job title
- Platform
- Pipeline bar
- Current status badge
- Last updated date
- Notes
- Job link
- Update and Timeline actions

The **Action Needed** card highlights:

- Upcoming phone screens, interviews, or final rounds when a next-event date is stored
- Overdue upcoming events
- Offers that need a decision
- Submitted applications that may need follow-up
- Contact or interview-stage applications that have gone stale
- Applications that recently moved forward in the pipeline

---

### Pipeline and Timeline

Version 4 stores status changes as a timeline instead of only keeping the latest status.

Each application keeps:

- Current status
- Last updated date
- Full status history
- Optional note per status event

Pipeline stages are grouped as:

```text
Applied -> Contact -> Interview -> Decision
```

Users update status from the dashboard with an update modal that includes:

- New status
- Status date
- Optional note

Mistakes can be corrected from the timeline view by editing or deleting status events. The current status and charts are recalculated from the latest valid timeline event.

Skipped stages are handled intentionally. For example:

- Submitted -> Rejected shows Applied and Decision, while Contact and Interview stay gray.
- Submitted -> HR Reachout -> Rejected shows Applied, Contact, and Decision, while Interview stays gray.
- Submitted -> Interview shows Applied and Interview, while Contact stays gray.

Email updates can also be added from the popup. When **AI Extract** detects an open Gmail or Outlook message about an application, it shows a review panel with the detected status, date, note, and suggested matching saved application. The user must confirm the match before the timeline is updated.

---

### Settings Panel

The dashboard **Settings** button keeps configuration away from the main record table.

Settings currently include:

- Default dashboard view
- Gemini API key input
- Active Google OAuth client ID display

The Gemini API key is saved in `chrome.storage.local`. The Google OAuth client ID is still configured manually in `manifest.json`, because Chrome extension OAuth reads that value from the manifest.

---

### Status Colors

Version 4 adds status colors in the dashboard and chart palette:

- Submitted: blue
- HR Reachout / Phone Screen: amber
- Interview / Final Interview: purple
- Offer: green
- Rejected: red
- Withdrawn: gray

---

### Google Drive Backup

Version 4 adds optional Google Drive history backup and restore.

Dashboard cloud actions:

- Backup History
- Restore History
- Remove Cloud Backup

The extension stores one latest backup file:

```text
job-application-tracker-backup.json
```

Local browser storage remains the primary source for daily use. Google Drive is used as a personal backup and cross-device restore option.

Restore behavior:

- Keeps existing local records
- Imports valid records from Drive
- Skips duplicate records

Remove Cloud Backup behavior:

- Deletes the Drive backup file
- Does not delete local browser records

If Google Drive sign-in fails with an OAuth error, first confirm that the extension ID in `chrome://extensions/` matches the Chrome Extension OAuth client in Google Cloud, then reload the extension after editing `manifest.json`.

---

## Data Storage

Local data is stored in:

```text
chrome.storage.local
```

Important note:

If the extension is removed from Chrome, local extension storage can be deleted. Use **Export History** or Google Drive backup before removing the extension.

Optional cloud backup is stored in the user's own Google Drive through the Google Drive API.

---

## Test Data

This repository includes a synthetic v4 history fixture for dashboard testing:

```text
test-data/sample-history-200.json
```

It contains 200 realistic fake records with companies, job titles, platforms, notes, URLs, application dates, current statuses, status timelines, and sample upcoming next-event dates.

To load it:

1. Open the dashboard.
2. Click **Import History**.
3. Select `test-data/sample-history-200.json`.
4. Confirm the import.

To regenerate the fixture:

```text
node scripts/generate-test-history.js
```

The fixture is synthetic and should not contain real personal data.

---

## Installation

1. Open Chrome.
2. Go to:

```text
chrome://extensions/
```

3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select this project folder.
6. Pin the extension if desired.

---

## Usage

1. Open a job posting page.
2. Click the extension icon, or right-click the page and choose **Job Extract for JAT**.
3. Use **Local Extract**, **AI Extract**, or enter fields manually. The right-click flow opens the tracker and runs Local Extract automatically.
4. Review and correct the fields if needed.
5. Click **Save Application**.
6. To update a saved application from an email, open the email, right-click, choose **JAT Status Update**, review the AI result, match it to the correct application, and click **Update Timeline**.
7. Open the dashboard to search, filter, update status timelines, export/import history, analyze, or back up records.

---

## Gemini API Setup

Gemini is optional. Local extraction, dashboard, history import/export, and Google Drive backup work without Gemini.

To enable AI extraction:

1. Get a Gemini API key from Google AI Studio.
2. Open the dashboard.
3. Click **Settings**.
4. Paste the key into **Gemini API key**.
5. Click **Save Gemini Key**.

Notes:

- Gemini extraction may take several seconds.
- Keep the popup open while extraction runs.
- Review AI-filled fields before saving.
- The Gemini key is stored locally in Chrome extension storage, not in the source code.
- If no key is saved, **AI Extract** will ask you to add one in dashboard Settings.
- On Gmail or Outlook, select the important email body text before clicking **AI Extract** if the email layout is unusual.

---

## Google Drive API Setup

Google Drive backup is optional. It requires a Google OAuth Client ID for a Chrome Extension.

### 1. Create a Google Cloud Project

1. Open Google Cloud Console.
2. Create or select a project.
3. Go to **APIs & Services > Library**.
4. Enable **Google Drive API**.

### 2. Configure OAuth Consent

1. Go to **APIs & Services > OAuth consent screen**.
2. Configure the app name and contact email.
3. Keep the app in testing mode for personal use.
4. Add your Google account as a test user.

If you see this error:

```text
Access blocked: app has not completed the Google verification process
```

add the signed-in Google account as a test user in the OAuth consent screen.

### 3. Create a Chrome Extension OAuth Client

1. Go to **APIs & Services > Credentials**.
2. Click **Create Credentials > OAuth client ID**.
3. Choose **Chrome Extension**.
4. Enter the extension ID from:

```text
chrome://extensions/
```

5. Copy the generated client ID.

### 4. Add OAuth Settings to Manifest

Google Drive sync uses the OAuth client ID from `manifest.json`. The dashboard **Settings** panel shows the active value for checking, but changing it requires editing `manifest.json` and reloading the extension.

`manifest.json` should include:

```json
"permissions": ["storage", "tabs", "activeTab", "scripting", "identity", "contextMenus"],
"host_permissions": ["https://www.googleapis.com/*"],
"oauth2": {
  "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
  "scopes": [
    "https://www.googleapis.com/auth/drive.file"
  ]
}
```

The current project uses the `drive.file` scope so the extension can create and manage files it owns, instead of requesting full Drive access.

If you change the client ID:

1. Edit `manifest.json`.
2. Save the file.
3. Open `chrome://extensions/`.
4. Click reload for this extension.
5. Reopen the dashboard and confirm the Settings panel shows the updated client ID.

### 5. Use Drive Backup

After reloading the extension:

1. Open the dashboard.
2. Click **Backup History**.
3. Sign in and approve access if prompted.
4. Click **Restore History** on this or another device to merge records.

---

## Tech Stack

- HTML
- CSS
- Vanilla JavaScript
- Chrome Extension Manifest V3
- Chrome local storage API
- Chrome identity API
- Chrome context menus API
- Google Drive API
- Gemini API
- Chart.js

---

## Third-Party Libraries

This project uses Chart.js for dashboard visualizations.

Bundled file:

```text
chart.umd.min.js
```

Official site:

```text
https://www.chartjs.org/
```

Chart.js is licensed under the MIT License. The license text is included in:

```text
THIRD_PARTY_LICENSES.txt
```

---

## Project Files

```text
manifest.json       Chrome extension manifest
background.js       Context menu setup and right-click entry points
popup.html          Save-application popup UI
popup.js            Extraction and save logic
dashboard.html      Dashboard UI
dashboard.js        Dashboard, charts, history import/export, Drive sync
style.css           Popup and dashboard styling
chart.umd.min.js    Chart.js bundle
scripts/            Test-data generator scripts
test-data/          Synthetic JSON import fixtures
README.md           Project documentation
```

---

## Changelog

### 4.0

- Added application date field in the popup for backfilled records.
- Added status history timeline data model.
- Added dashboard status update modal with status date and note.
- Added timeline modal for editing or deleting status events.
- Added AI email status update detection with a review-and-match popup flow.
- Added **JAT Status Update** right-click action to run AI email extraction directly.
- Added automatic popup close after right-click save and email timeline update.
- Replaced direct table status dropdown with status badge, pipeline bar, Update, and Timeline actions.
- Added KPI cards, pipeline funnel, status timeline trend, and action-needed insights.
- Reworked Needs Attention into an Action Needed queue for upcoming events, stale follow-ups, offers, and recently advanced applications.
- Renamed local backup actions to Export History and Import History.
- Switched primary local backup format to JSON history while keeping CSV import compatibility.
- Updated Google Drive backup payload to schema version 4.
- Added synthetic 200-record JSON fixture and generator for dashboard testing.

### 3.0

- Added optional Google Drive backup, restore, and cloud backup removal.
- Improved local extraction for LinkedIn, Lever, and Greenhouse.
- Improved LinkedIn handling for Top Picks, search results, and jobs based on preferences.
- Added Apple-style popup and dashboard UI refresh.
- Added colored status indicators and matching chart colors.
- Added grouped dashboard actions for Local and Cloud operations.
- Added dashboard Settings panel.
- Added right-click page menu to open the tracker and auto-run local extraction.
- Moved default view preference into Settings.
- Moved Gemini API key setup into Settings and removed hardcoded Gemini key usage.
- Kept Google OAuth client ID manifest-based for stable Chrome extension sign-in.
- Kept debug extraction helper disabled in code for future troubleshooting.

### 2.0

- Added dashboard analytics and Chart.js visualizations.
- Added AI-assisted extraction with Gemini.
- Added pagination, CSV import/export, filtering, sorting, and batch deletion.

---

## Privacy Notes

- Application data is stored locally unless the user exports it or backs it up to Google Drive.
- Google Drive backup stores one JSON backup file in the user's own Drive.
- Gemini extraction sends selected page data to the Gemini API only when the user clicks **AI Extract**.
- If AI Extract is used on an open email message, selected email content may be sent to Gemini to classify application status updates.
- Users should review extracted data before saving.
- The extension does not sell user data.
- The extension does not use application history for advertising, lending, or credit decisions.
