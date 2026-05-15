# Extension Building Experience Notes

This file captures reusable lessons from building the Job Application Tracker Chrome extension. The goal is to make the experience transferable to future browser-extension projects, especially tools that extract information from web pages, use AI as a fallback, and manage local user records.

---

## 1. Build Local-First, Then Add Cloud

For personal productivity extensions, local-first storage is usually the safest starting point.

Use `chrome.storage.local` as the main working copy because it is simple, fast, private, and does not require a backend. Add export/import early so users do not lose data when removing or reinstalling the extension.

Cloud sync should be optional. In this project, Google Drive is used as a personal backup layer, not as the primary database. This avoided backend engineering while still giving users a way to move data between devices.

Useful pattern:

- Local storage is the source of truth during normal use.
- JSON export/import is the emergency backup and testing format.
- Google Drive backup stores one recent backup file.
- Restore merges records and skips duplicates.
- Cloud delete removes only the cloud backup, never local data.

---

## 2. Prefer Structured History Over One Current Value

A single `status` field is easy at first, but it becomes limiting when analytics and status correction are needed.

For application tracking, the better model is:

```json
{
  "status": "Interview",
  "lastUpdated": "2026-05-05T12:00:00.000Z",
  "statusHistory": [
    {
      "status": "Submitted",
      "date": "2026-04-20T12:00:00.000Z",
      "note": "Initial save"
    },
    {
      "status": "Interview",
      "date": "2026-05-05T12:00:00.000Z",
      "note": "Technical interview scheduled"
    }
  ]
}
```

Benefits:

- The current status can be recalculated from the latest event.
- Mistakes can be corrected by editing or deleting timeline events.
- Charts can show real movement over time.
- Pipeline stages can represent skipped steps.
- Email updates can append a new event instead of overwriting history.

---

## 3. Web Extraction Needs Layered Fallbacks

Web pages are inconsistent. A robust extractor should not depend on one selector or one page layout.

A practical extraction priority is:

1. Site-specific known selectors.
2. Visible selected/detail panel text.
3. Structured data such as JSON-LD, Open Graph, or meta tags.
4. Page title parsing.
5. URL patterns.
6. Conservative DOM fallback.
7. AI fallback only when rules are uncertain.

Avoid trusting generic page headers too much. On job boards, headers like “Jobs based on your preferences,” “How promoted jobs are ranked,” “Apply for this job,” and “Show more options” can look like company or job-title text if the extractor is too broad.

For each platform, keep a list of bad values to reject.

Examples:

- LinkedIn bad company values: `Share`, `Show more options`, `Easy Apply`, `Reactivate Premium`.
- Greenhouse bad company values: `Apply for this job`.
- LinkedIn search pages: page title may be more reliable than visible left-column text.
- LinkedIn recommended pages: selected detail panel can live in a different frame, such as `/preload/`.

---

## 4. Debug Extraction With Real Page Evidence

The most useful debugging tool was a hidden/debug extraction mode that copied:

- Current tab URL.
- Cleaned URL.
- Frame IDs.
- Candidate extraction result per frame.
- Page title.
- H1/H2 text.
- Selected/detail panel preview.
- Candidate sources such as DOM, title, LinkedIn card, JSON-LD.
- Final local extraction result.

This made it much easier to understand why extraction failed.

Important lesson: screenshots show what humans see, but debug JSON shows what the extension actually receives. Both are useful, but the debug JSON is what usually reveals the bug.

Keep the debug tool in code, but disabled in normal UI. It is valuable when a website changes DOM structure.

---

## 5. AI Should Receive Curated Context, Not the Whole Page

Sending the whole webpage to an AI model often causes wrong extraction because navigation, recommendations, profile text, and unrelated cards pollute the prompt.

Better approach:

- Build a compact `pageInfo` object.
- Include only candidate company/title fields, page title, selected panel text, meta description, URL, and platform.
- Include local extraction output as evidence.
- Ask the model for strict JSON.
- Validate AI output against allowed evidence when possible.
- Fall back to rule-based candidates when AI returns suspicious text.

For job pages, AI should answer:

```json
{
  "pageType": "job_posting",
  "isJobPage": true,
  "company": "",
  "jobTitle": "",
  "platform": "",
  "confidence": "high"
}
```

For email pages, AI should answer:

```json
{
  "pageType": "email_message",
  "isJobApplicationEmail": true,
  "company": "",
  "jobTitle": "",
  "status": "Interview",
  "statusDate": "2026-05-05",
  "interviewDateTime": "2026-05-08T17:00:00",
  "contactName": "",
  "contactEmail": "",
  "note": "",
  "confidence": "medium"
}
```

Important: AI should assist, not silently mutate records. For email updates, show a review/match panel before changing any saved application.

---

## 6. Matching AI Email Updates Requires User Confirmation

Company and job-title matching is inherently fuzzy. Email subject/body may mention only a recruiter, a team name, or a partial company name.

Use scoring, but require confirmation.

Useful matching signals:

- Exact normalized company match.
- Partial company match.
- Job-title token overlap.
- Active records get a bonus.
- Final statuses such as `Rejected`, `Offer`, and `Withdrawn` get a penalty.
- Status date before application date gets a penalty.
- Recently submitted applications get a small bonus.

The UI should show top matching applications and let the user choose. This avoids updating the wrong job.

---

## 7. Chrome OAuth Has Hard Limits

For Chrome extension Google OAuth using `chrome.identity.getAuthToken()`, the OAuth client ID must be in `manifest.json`.

This means:

- A UI input box cannot dynamically replace the manifest OAuth client ID.
- After editing the client ID, the extension must be reloaded.
- The OAuth client must be created as a **Chrome Extension** OAuth client in Google Cloud.
- The extension ID in Google Cloud must match the installed extension ID.
- Testing-mode apps require the signed-in Google account to be added as a test user.

For personal or GitHub-distributed versions, users may edit `manifest.json`. For Chrome Web Store versions, a shared built-in client ID is more practical.

---

## 8. Right-Click UX Should Use the Native Extension Popup

Creating custom popup windows with `chrome.windows.create()` can behave badly on macOS, especially when Chrome is fullscreen or uses multiple desktop spaces. It may look like a new page or fullscreen window.

Better pattern:

1. Context menu click stores a short pending action in `chrome.storage.session`.
2. Background script calls `chrome.action.openPopup()`.
3. Popup reads the pending action and runs the correct mode.

Example modes:

- `local`: run local job extraction.
- `ai`: run AI email status extraction.

This keeps the UI as a normal extension popup and avoids strange OS-level window behavior.

---

## 9. Dashboard Responsiveness Has Two Different Strategies

There are two valid responsive strategies:

1. Reflow the layout for small screens.
2. Keep a stable dashboard canvas and allow horizontal scrolling.

For dense statistical dashboards, the second strategy can be better. Users want the same chart layout on every monitor, not a different visual story at every width.

Good rule:

- Metadata tables can scroll horizontally.
- Dense statistical views can keep a stable minimum width.
- Buttons and filters should wrap only when they do not change the meaning of the layout.
- Do not squeeze charts until labels and canvases become unreadable.

For the statistics page, keep:

- KPI row aligned.
- Top row as 2 charts.
- Bottom row as 4 chart cards.
- Horizontal scroll on smaller screens.

---

## 10. UI Polish Matters for Trust

For productivity extensions, the UI should feel calm and reviewable.

Useful design choices:

- Compact Apple-style panels.
- Clear grouping: Local actions and Cloud actions.
- Status badges with consistent colors.
- Pipeline bars for quick progress scanning.
- Timeline modal for correcting history.
- Settings panel for API keys and preferences.
- Avoid making the dashboard feel like a marketing page.

Status color convention:

- Submitted: blue.
- HR Reachout / Phone Screen: amber.
- Interview / Final Interview: purple.
- Offer: green.
- Rejected: red.
- Withdrawn: gray.

---

## 11. Testing Needs Realistic Data

A dashboard is hard to judge with only five records.

Create synthetic test data that looks like real usage:

- 100-300 records.
- Mixed companies and roles.
- Mixed platforms.
- Different submission dates.
- Realistic status distribution.
- Some skipped pipeline stages.
- Some stale applications.
- Some offers/rejections.
- Some upcoming next events.

Keep the fixture importable through the normal import path. This tests both the UI and the migration/import logic.

---

## 12. Release Hygiene

Before wrapping a version:

1. Reload the extension.
2. Test icon popup save.
3. Test right-click local extraction.
4. Test right-click AI status update on Gmail/Outlook.
5. Test dashboard update modal.
6. Test timeline edit/delete.
7. Test export/import JSON.
8. Test Google Drive backup/restore if OAuth is configured.
9. Test dashboard on small and large screens.
10. Update README and privacy notes.

For Chrome Web Store:

- Prepare single-purpose description.
- Explain every permission.
- Mention whether remote code is used. API calls are not remote code if all executable code is bundled locally.
- Disclose website content usage if extracting page/email text.
- Provide a privacy policy if any user data is collected or processed.

---

## 13. Reusable Architecture Pattern

A transferable extension architecture:

```text
manifest.json       Permissions, OAuth, action, background service worker
background.js       Context menus, pending popup actions, dashboard entry points
popup.html          Small focused user workflow
popup.js            Extraction, AI calls, save/update logic
dashboard.html      Record management and analytics UI
dashboard.js        Storage, filters, charts, timeline, import/export, cloud sync
style.css           Shared popup/dashboard styling
test-data/          Synthetic import fixtures
scripts/            Fixture generators and maintenance helpers
```

The most important separation:

- Background script opens entry points.
- Popup handles one current task.
- Dashboard manages history and analytics.
- Extraction functions are deterministic and testable.
- AI is optional and review-first.

