# Job Application Tracker Chrome Extension

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
- Local browser storage remains the main working copy

No custom backend server is required.

---

## Main Features

### Save Applications

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
- Default dashboard view preference

The dashboard uses Chart.js for:

- Application trend
- Status trend
- Position status
- Status distribution
- Job title distribution
- Company distribution

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
2. Click the extension icon.
3. Use **Local Extract**, **AI Extract**, or enter fields manually.
4. Review and correct the fields if needed.
5. Click **Save Application**.
6. Open the dashboard to search, filter, update statuses, export/import, analyze, or back up records.

---

## Gemini API Setup

Gemini is optional. Local extraction, dashboard, CSV import/export, and Google Drive backup work without Gemini.

To enable AI extraction:

1. Get a Gemini API key from Google AI Studio.
2. Open:

```text
popup.js
```

3. Replace:

```js
const GEMINI_API_KEY = "your_api_key_here";
```

with your real Gemini API key.

Notes:

- Gemini extraction may take several seconds.
- Keep the popup open while extraction runs.
- Review AI-filled fields before saving.
- Do not publish a repository containing a private API key.

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
