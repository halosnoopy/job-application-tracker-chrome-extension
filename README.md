# Job Application Tracker Chrome Extension

A lightweight Chrome extension for tracking, managing, and analyzing job applications locally with AI-assisted extraction and a dashboard interface.

---

## Overview

Job Application Tracker helps users record submitted job applications and manage their application history in one place. The extension stores data locally in the browser and provides tools for searching, filtering, sorting, importing, exporting, and deleting records.

Version 2 expands the system with dashboard analytics and AI-assisted job information extraction while maintaining a fully local workflow without requiring a backend server.

---

## Features

### System reliability and data integrity

The extension is designed with safeguards to ensure data consistency and prevent accidental data loss.

Key mechanisms include:

- Unique application ID for each record  
- Confirmation dialogs for destructive actions  
- Optional CSV export before full reset  
- Duplicate detection during CSV import  
- Robust CSV parsing for edge cases  

---

### AI-assisted job information extraction (New in V2)

- Local rule-based extraction for:
  - Company name  
  - Job title  
  - Platform detection  
- Clean URL extraction (for example LinkedIn job links)  
- Gemini AI fallback for structured extraction:
  - jobTitle  
  - company  
  - platform  
  - isJobPage  
- Structured result display instead of raw AI response  
- Manual editing supported  

**Note:** Gemini AI extraction may take several seconds. Users should keep the popup/page open until the extraction is complete.

---

### Dashboard and analytics (New in V2)

- Dual view system:
  - Metadata table view  
  - Statistical analysis view  

- Visualizations powered by Chart.js:
  - Application trends over time  
  - Status distribution  
  - Company distribution  
  - Job title distribution  

---

### Table and data management improvements (New in V2)

- Pagination support  
- Page size options (30 / 50 / 100 / 200)  
- Select-all behavior scoped to current page  
- Improved table layout and controls  
- Better usability for large datasets  

---

## Tech stack

- HTML  
- CSS  
- Vanilla JavaScript  
- Chrome Extension Manifest V3  
- Chrome local storage API  
- Chart.js (external dependency)  
- Gemini API (optional, for AI extraction)  

---

## Third-party libraries

This project uses Chart.js for dashboard visualizations.

The file `chart.umd.min.js` is **not included** in this repository.

To enable chart features:

1. Download the UMD build of Chart.js from the official website  
2. Place `chart.umd.min.js` in the project root directory  

Official site: https://www.chartjs.org/

Chart.js is licensed under the MIT License. The full license text is included in `THIRD_PARTY_LICENSES.txt`.

If Chart.js is not installed, the dashboard statistical view will not render charts, but all core tracking features will still function.

---

## Data storage

All data is stored locally using:

```text
chrome.storage.local
