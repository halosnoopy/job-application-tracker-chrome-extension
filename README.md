# Job Application Tracker Chrome Extension

A lightweight Chrome extension for tracking, managing, and analyzing job applications locally through a dashboard interface.

## Overview

Job Application Tracker helps users record submitted job applications and manage their application history in one place. The extension stores data locally in the browser and provides tools for searching, filtering, sorting, importing, exporting, and deleting records.

This version is designed as a complete local workflow without requiring a backend server or external database.

## Features

### Application tracking

Users can save job application records directly from the extension popup.

Each record includes:

* Company
* Job title
* Platform
* Status
* Notes
* Job URL
* Submitted date
* Unique application ID

### Dashboard view

The dashboard displays all saved applications in a table format.

The dashboard includes:

* Total application count
* Record since date
* Selected record count
* Status summary
* Search box
* Status filter
* Sort dropdown
* Application table

### Search and filtering

Users can search records by company name or job title.

Users can filter applications by status:

* All statuses
* Submitted
* Interview
* Rejected
* Offer

### Sorting

Users can sort application records by:

* Newest first
* Oldest first
* Company A-Z
* Position A-Z
* Platform A-Z

### Batch delete

The dashboard supports selecting one or multiple records using checkboxes.

Users can:

* Select individual rows
* Select all visible rows
* View selected count
* Delete selected records with confirmation

### Status summary

The dashboard shows a basic status breakdown:

* Submitted count
* Interview count
* Rejected count
* Offer count

### CSV export

Users can export all saved records to a CSV file.

The exported file includes:

* Application ID
* Date
* Company
* Job title
* Platform
* Status
* Notes
* URL

The exported filename uses a timestamp format:

```text
job_application_record_at_<timestamp>.csv
```

### CSV import

Users can import previously exported CSV files back into the extension.

The import function supports:

* Restoring saved records
* Duplicate detection using application ID
* Safe parsing for quoted values and commas
* Fallback handling for missing fields

## Tech stack

* HTML
* CSS
* Vanilla JavaScript
* Chrome Extension Manifest V3
* Chrome local storage API

## Data storage

All data is stored locally in the browser using:

```text
chrome.storage.local
```

No user data is sent to an external server.

## Project structure

```text
job-application-tracker/
├── manifest.json
├── popup.html
├── popup.js
├── dashboard.html
├── dashboard.js
└── style.css
```

## Installation

### Step 1: Clone the repository

```bash
git clone https://github.com/your-username/job-application-tracker.git
```

### Step 2: Open Chrome extensions page

Open Chrome and go to:

```text
chrome://extensions/
```

### Step 3: Enable developer mode

Turn on Developer mode in the top-right corner.

### Step 4: Load the extension

Click Load unpacked and select the project folder.

### Step 5: Use the extension

Click the extension icon to save a job application. Open the dashboard to manage and analyze saved records.

## Usage

### Save an application

1. Open a job application page.
2. Click the extension icon.
3. Enter the company, job title, platform, status, and notes.
4. Click Save Application.

### View dashboard

1. Open the extension popup.
2. Click Open Dashboard.
3. Review saved applications in the dashboard table.

### Export data

1. Open the dashboard.
2. Click Export CSV.
3. Save the generated CSV file for backup or future use.

### Import data

1. Open the dashboard.
2. Click Import CSV.
3. Select a compatible CSV file.
4. Confirm the import.

### Delete records

1. Select one or more records using the checkboxes.
2. Click Delete Selected.
3. Confirm deletion.

## Version

### v1

Initial stable version with complete local job application tracking workflow.

Included features:

* Application saving
* Local browser storage
* Dashboard table
* Search
* Status filter
* Multi-field sorting
* Platform field
* Status summary
* Select all
* Batch delete
* CSV export
* CSV import
* Duplicate detection

## Future improvements

Possible future improvements include:

### Data visualization and statistics

Add dashboard visualizations to help users better understand their job search progress.

Potential visualizations include:

* Applications over time
* Applications by month or week
* Applications by company
* Applications by job title or position type
* Applications by platform
* Status distribution
* Interview and offer conversion trends

### Auto-fill job information

Future versions may support automatic extraction of job information from job posting pages.

Possible auto-filled fields include:

* Company name
* Job title
* Platform
* Job URL
* Application date

For v1, all job information is entered manually to keep the extension simple, stable, and easy to test.

### Follow-up tracking

Add follow-up management for each application.

Possible fields include:

* Follow-up date
* Follow-up notes
* Reminder status
* Last contacted date
* Recruiter or contact name

### Email feedback integration

Future versions may support updating application records based on email feedback.

For example, if the user receives an interview invitation, rejection, or offer email, the extension could help locate the related application and update its status.

This feature may require additional permissions or integration with email services, so it should be treated as a later-stage feature.

### Application timeline

Add a timeline view for each application to track status changes over time.

Example timeline events include:

* Application submitted
* Follow-up sent
* Interview received
* Rejection received
* Offer received
* Notes updated

### Status color indicators

Add visual color indicators for different statuses to make the dashboard easier to scan.

Possible status styles include:

* Submitted
* Interview
* Rejected
* Offer

### Inline editing

Add editing support directly inside the dashboard.

Possible editable fields include:

* Status
* Notes
* Platform
* Follow-up date
* Company name
* Job title

### Cloud sync option

Future versions may support optional cloud sync or backup so users can access records across devices.

## License

MIT License
