# Job Application Tracker Chrome Extension
<img width="3784" height="1548" alt="image" src="https://github.com/user-attachments/assets/70dd9fba-23f0-4121-9376-5d1bf71852d9" />

A local-first Chrome extension for saving job applications, improving job-posting extraction, reviewing application history, and backing up records to Google Drive.

---

## Overview

Job Application Tracker helps users save submitted job applications from common job boards and manage the records in one dashboard.

Version 3 focuses on reliability and personal data safety:

- Better local extraction for LinkedIn, Lever, and Greenhouse
- Optional Gemini AI extraction for harder pages
- Apple-style popup and dashboard UI refresh
- Colored application statuses
- Optional Google Drive backup and restore
- Dashboard Settings panel for default view and API configuration
- Local browser storage remains the main working copy

No custom backend server is required.

---

## Main Features

### Save Applications
<img width="1030" height="723" alt="image" src="https://github.com/user-attachments/assets/cad82a26-b82e-42b1-a7e5-b7d8896106a0" />

The popup saves:

- Company
- Job title
- Platform
- Status
- Notes
- Job URL
- Submission date
- Unique application ID

Supported status values:

- Submitted
- Interview
- Rejected
- Offer

---

### Local Extraction

The **Local Extract** button reads the active job page and tries to fill company, job title, platform, and clean URL without using AI.

Version 3 improves extraction for:

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

AI extraction is intended to help with difficult pages, but users should still review the result before saving.

---

### Dashboard
<img width="3767" height="1364" alt="image" src="https://github.com/user-attachments/assets/6552f3dd-6bd5-47ed-bc44-8b330aa5fe0b" />

The dashboard includes:

- Metadata table view
- Statistical analysis view
- Search by company or job title
- Filter by status
- Sort by date, company, position, or platform
- Pagination
- CSV export/import
- Batch delete
- Full reset with export reminder
- Settings panel

The dashboard uses Chart.js for:

- Application trend
- Status trend
- Position status
- Status distribution
- Job title distribution
- Company distribution

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

Version 3 adds status colors in the dashboard and chart palette:

- Submitted: blue
- Interview: amber
- Rejected: red
- Offer: green

---

### Google Drive Backup

Version 3 adds optional Google Drive backup and restore.

Dashboard cloud actions:

- Backup to Drive
- Restore from Drive
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

---

## Data Storage

Local data is stored in:

```text
chrome.storage.local
```

Important note:

If the extension is removed from Chrome, local extension storage can be deleted. Use CSV export or Google Drive backup before removing the extension.

Optional cloud backup is stored in the user's own Google Drive through the Google Drive API.

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
6. Open the dashboard to search, filter, update statuses, export/import, analyze, or back up records.

---

## Gemini API Setup

Gemini is optional. Local extraction, dashboard, CSV import/export, and Google Drive backup work without Gemini.

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
"permissions": ["storage", "tabs", "activeTab", "scripting", "identity"],
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
2. Click **Backup to Drive**.
3. Sign in and approve access if prompted.
4. Click **Restore from Drive** on this or another device to merge records.

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
dashboard.js        Dashboard, charts, import/export, Drive sync
style.css           Popup and dashboard styling
chart.umd.min.js    Chart.js bundle
README.md           Project documentation
```

---

## Changelog

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
- Users should review extracted data before saving.
