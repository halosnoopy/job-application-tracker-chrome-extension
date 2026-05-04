document.addEventListener("DOMContentLoaded", async () => {
    const summary = document.getElementById("summary");
    const recordSince = document.getElementById("recordSince");
    const selectedCount = document.getElementById("selectedCount");
    const table = document.getElementById("applicationTable");

    const submittedCount = document.getElementById("submittedCount");
    const interviewCount = document.getElementById("interviewCount");
    const rejectedCount = document.getElementById("rejectedCount");
    const offerCount = document.getElementById("offerCount");

    const exportBtn = document.getElementById("exportBtn");
    const importBtn = document.getElementById("importBtn");
    const importFile = document.getElementById("importFile");
    const driveBackupBtn = document.getElementById("driveBackupBtn");
    const driveRestoreBtn = document.getElementById("driveRestoreBtn");
    const driveDeleteBtn = document.getElementById("driveDeleteBtn");
    const batchDeleteBtn = document.getElementById("batchDeleteBtn");
    const resetBtn = document.getElementById("resetBtn");

    const searchInput = document.getElementById("searchInput");
    const statusFilter = document.getElementById("statusFilter");
    const sortFilter = document.getElementById("sortFilter");
    const selectAllCheckbox = document.getElementById("selectAllCheckbox");

    const pageSizeSelect = document.getElementById("pageSizeSelect");
    const prevPageBtn = document.getElementById("prevPageBtn");
    const nextPageBtn = document.getElementById("nextPageBtn");
    const pageInfo = document.getElementById("pageInfo");
    const bottomPrevPageBtn = document.getElementById("bottomPrevPageBtn");
    const bottomNextPageBtn = document.getElementById("bottomNextPageBtn");

    const metadataView = document.getElementById("metadataView");
    const statsView = document.getElementById("statsView");
    const metadataViewBtn = document.getElementById("metadataViewBtn");
    const statsViewBtn = document.getElementById("statsViewBtn");

    const statsTimeRange = document.getElementById("statsTimeRange");
    const statsGroupBy = document.getElementById("statsGroupBy");
    const statsJobFilter = document.getElementById("statsJobFilter");
    const statsCompanyFilter = document.getElementById("statsCompanyFilter");
    const statsPlatformFilter = document.getElementById("statsPlatformFilter");
    const statsStatusFilter = document.getElementById("statsStatusFilter");
    const statsShowingLabel = document.getElementById("statsShowingLabel");

    const defaultViewSelect = document.getElementById("defaultViewSelect");

    const topPageInfo = document.getElementById("topPageInfo");


    let currentPage = 1;

    let applicationTrendChart = null;
    let statusTrendChart = null;
    let positionStatusChart = null;
    let jobTitleChart = null;
    let statusChart = null;
    let companyChart = null;

    const statusColors = {
        Submitted: "#0a84ff",
        Interview: "#ff9f0a",
        Rejected: "#ff453a",
        Offer: "#30d158"
    };

    const chartColors = [
        "#0a84ff",
        "#30d158",
        "#ff9f0a",
        "#bf5af2",
        "#64d2ff",
        "#ff375f",
        "#8e8e93"
    ];

    const DRIVE_BACKUP_FILE_NAME = "job-application-tracker-backup.json";

    const result = await chrome.storage.local.get([
        "applications",
        "defaultDashboardView"
    ]);

    let applications = result.applications || [];
    let defaultDashboardView = result.defaultDashboardView || "metadata";

    if (defaultDashboardView !== "metadata" && defaultDashboardView !== "stats") {
        defaultDashboardView = "metadata";
    }

    defaultViewSelect.value = defaultDashboardView;

    renderDashboard();
    populateStatsFilters();
    switchView(defaultDashboardView);

    function shortenLabel(label, maxLength = 18) {
        if (!label) return "Other";
        return label.length > maxLength ? label.slice(0, maxLength) + "..." : label;
    }

    function switchView(view) {
        if (view === "metadata") {
            metadataView.style.display = "block";
            statsView.style.display = "none";

            metadataViewBtn.classList.add("active-view");
            statsViewBtn.classList.remove("active-view");
        } else {
            metadataView.style.display = "none";
            statsView.style.display = "block";

            metadataViewBtn.classList.remove("active-view");
            statsViewBtn.classList.add("active-view");

            renderStats();
        }
    }

    function updateSelectedCount() {
        const checkedBoxes = document.querySelectorAll(".row-checkbox:checked");
        selectedCount.textContent = `Selected: ${checkedBoxes.length}`;
        batchDeleteBtn.disabled = checkedBoxes.length === 0;

        const visibleCheckboxes = document.querySelectorAll(".row-checkbox");
        selectAllCheckbox.checked =
            visibleCheckboxes.length > 0 &&
            checkedBoxes.length === visibleCheckboxes.length;
    }

    function renderStatusStats() {
        const submitted = applications.filter((app) => app.status === "Submitted").length;
        const interview = applications.filter((app) => app.status === "Interview").length;
        const rejected = applications.filter((app) => app.status === "Rejected").length;
        const offer = applications.filter((app) => app.status === "Offer").length;

        submittedCount.className = "status-summary status-submitted";
        interviewCount.className = "status-summary status-interview";
        rejectedCount.className = "status-summary status-rejected";
        offerCount.className = "status-summary status-offer";

        submittedCount.textContent = `Submitted: ${submitted}`;
        interviewCount.textContent = `Interview: ${interview}`;
        rejectedCount.textContent = `Rejected: ${rejected}`;
        offerCount.textContent = `Offer: ${offer}`;
    }

    function renderDashboard() {
        summary.textContent = `Total applications: ${applications.length}`;
        renderStatusStats();

        if (applications.length > 0) {
            const dates = applications.map((app) => new Date(app.dateSubmitted));
            const earliestDate = new Date(Math.min(...dates));
            recordSince.textContent = `Record since: ${earliestDate.toLocaleDateString()}`;
        } else {
            recordSince.textContent = "Record since: No records yet";
        }

        const searchText = searchInput.value.toLowerCase().trim();
        const selectedStatus = statusFilter.value;
        const sortType = sortFilter.value;

        const visibleApplications = [...applications]
            .sort((a, b) => {
                if (sortType === "newest") return new Date(b.dateSubmitted) - new Date(a.dateSubmitted);
                if (sortType === "oldest") return new Date(a.dateSubmitted) - new Date(b.dateSubmitted);
                if (sortType === "company") return (a.company || "").localeCompare(b.company || "");
                if (sortType === "position") return (a.jobTitle || "").localeCompare(b.jobTitle || "");
                if (sortType === "platform") return (a.platform || "").localeCompare(b.platform || "");
                return 0;
            })
            .filter((app) => {
                const matchesSearch =
                    (app.company || "").toLowerCase().includes(searchText) ||
                    (app.jobTitle || "").toLowerCase().includes(searchText);

                const matchesStatus =
                    selectedStatus === "All" || app.status === selectedStatus;

                return matchesSearch && matchesStatus;
            });

        const pageSize = Number(pageSizeSelect.value);
        const totalPages = Math.max(1, Math.ceil(visibleApplications.length / pageSize));

        if (currentPage > totalPages) {
            currentPage = totalPages;
        }

        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const pagedApplications = visibleApplications.slice(startIndex, endIndex);

        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
        topPageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage === totalPages;

        bottomPrevPageBtn.disabled = currentPage === 1;
        bottomNextPageBtn.disabled = currentPage === totalPages;

        table.innerHTML = "";

        pagedApplications.forEach((app) => {
            const row = document.createElement("tr");
            const date = new Date(app.dateSubmitted).toLocaleDateString();

            row.innerHTML = `
                <td>
                    <input type="checkbox" class="row-checkbox" data-id="${app.id}">
                </td>
                <td>${date}</td>
                <td>${app.company || ""}</td>
                <td>${app.jobTitle || ""}</td>
                <td>${app.platform || "Other"}</td>
                <td>
                    <select class="status-select status-${String(app.status || "Submitted").toLowerCase()}" data-id="${app.id}">
                        <option value="Submitted" ${app.status === "Submitted" ? "selected" : ""}>Submitted</option>
                        <option value="Interview" ${app.status === "Interview" ? "selected" : ""}>Interview</option>
                        <option value="Rejected" ${app.status === "Rejected" ? "selected" : ""}>Rejected</option>
                        <option value="Offer" ${app.status === "Offer" ? "selected" : ""}>Offer</option>
                    </select>
                </td>
                <td>${app.notes || ""}</td>
                <td><a href="${app.url || "#"}" target="_blank">Open</a></td>
            `;

            table.appendChild(row);
        });

        document.querySelectorAll(".status-select").forEach((select) => {
            select.addEventListener("change", async (event) => {
                const id = Number(event.target.dataset.id);
                const newStatus = event.target.value;

                applications = applications.map((app) =>
                    app.id === id ? { ...app, status: newStatus } : app
                );

                await chrome.storage.local.set({ applications });
                renderDashboard();
                populateStatsFilters();

                if (statsView.style.display !== "none") {
                    renderStats();
                }
            });
        });

        document.querySelectorAll(".row-checkbox").forEach((checkbox) => {
            checkbox.addEventListener("change", updateSelectedCount);
        });

        selectAllCheckbox.checked = false;
        updateSelectedCount();
    }

    function populateStatsFilters() {
        populateSelect(statsJobFilter, "All jobs", getUniqueValues("jobTitle"));
        populateSelect(statsCompanyFilter, "All companies", getUniqueValues("company"));
        populateSelect(statsPlatformFilter, "All platforms", getUniqueValues("platform"));
    }

    function populateSelect(selectElement, defaultText, values) {
        if (!selectElement) return;

        const currentValue = selectElement.value;
        selectElement.innerHTML = `<option value="All">${defaultText}</option>`;

        values.forEach((value) => {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = value;
            selectElement.appendChild(option);
        });

        if ([...selectElement.options].some((option) => option.value === currentValue)) {
            selectElement.value = currentValue;
        }
    }

    function getUniqueValues(field) {
        return [...new Set(applications.map((app) => app[field] || "Other"))]
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b));
    }

    function getFilteredStatsApplications() {
        const now = new Date();
        const range = statsTimeRange.value;

        return applications.filter((app) => {
            const appDate = new Date(app.dateSubmitted);
            let matchesTime = true;

            if (range !== "all") {
                const days = Number(range);
                const startDate = new Date();
                startDate.setDate(now.getDate() - days);
                matchesTime = appDate >= startDate;
            }

            const matchesJob =
                statsJobFilter.value === "All" || app.jobTitle === statsJobFilter.value;

            const matchesCompany =
                statsCompanyFilter.value === "All" || app.company === statsCompanyFilter.value;

            const matchesPlatform =
                statsPlatformFilter.value === "All" || (app.platform || "Other") === statsPlatformFilter.value;

            const matchesStatus =
                statsStatusFilter.value === "All" || app.status === statsStatusFilter.value;

            return matchesTime && matchesJob && matchesCompany && matchesPlatform && matchesStatus;
        });
    }

    function getDateKey(date, groupBy) {
        const d = new Date(date);

        if (groupBy === "day") {
            return d.toISOString().slice(0, 10);
        }

        if (groupBy === "week") {
            const weekStart = new Date(d);
            const day = weekStart.getDay();
            weekStart.setDate(weekStart.getDate() - day);
            return weekStart.toISOString().slice(0, 10);
        }

        if (groupBy === "month") {
            return d.toISOString().slice(0, 7);
        }

        return d.toISOString().slice(0, 10);
    }

    function countBy(items, keyGetter) {
        return items.reduce((counts, item) => {
            const key = keyGetter(item) || "Other";
            counts[key] = (counts[key] || 0) + 1;
            return counts;
        }, {});
    }

    function getTopNWithOther(counts, topN) {
        const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        const topEntries = entries.slice(0, topN);
        const otherEntries = entries.slice(topN);

        const result = Object.fromEntries(topEntries);
        const otherTotal = otherEntries.reduce((sum, [, value]) => sum + value, 0);

        if (otherTotal > 0) {
            result.Other = otherTotal;
        }

        return result;
    }

    function destroyChart(chart) {
        if (chart) {
            chart.destroy();
        }
    }

    function getLegendWithCounts() {
        return {
            labels: {
                boxWidth: 14,
                boxHeight: 10,
                padding: 10,
                font: {
                    size: 11
                },
                generateLabels(chart) {
                    const data = chart.data;
                    const dataset = data.datasets[0];

                    return data.labels.map((label, index) => {
                        const value = dataset.data[index];
                        const color = Array.isArray(dataset.backgroundColor)
                            ? dataset.backgroundColor[index]
                            : dataset.backgroundColor;

                        return {
                            text: `${shortenLabel(label, 14)} (${value})`,
                            fillStyle: color,
                            strokeStyle: color,
                            lineWidth: 1,
                            hidden: false,
                            index
                        };
                    });
                }
            }
        };
    }

    function renderStats() {
        if (typeof Chart === "undefined") {
            statsShowingLabel.textContent = "Statistics view loaded, but chart.umd.min.js is missing.";
            return;
        }

        const filteredApps = getFilteredStatsApplications();
        const groupBy = statsGroupBy.value;

        statsShowingLabel.textContent =
            `Showing: ${getTimeRangeLabel()} | Group by ${groupBy} (${filteredApps.length} applications)`;

        renderApplicationTrendChart(filteredApps, groupBy);
        renderStatusTrendChart(filteredApps, groupBy);
        renderPositionStatusChart(filteredApps);
        renderStatusChart(filteredApps);
        renderJobTitleChart(filteredApps);
        renderCompanyChart(filteredApps);
    }

    function getTimeRangeLabel() {
        if (statsTimeRange.value === "all") return "All time";
        if (statsTimeRange.value === "7") return "Last 7 days";
        if (statsTimeRange.value === "30") return "Last 30 days";
        if (statsTimeRange.value === "90") return "Last 3 months";
        if (statsTimeRange.value === "365") return "This year";
        return "Selected range";
    }

    function renderApplicationTrendChart(filteredApps, groupBy) {
        const grouped = countBy(filteredApps, (app) => getDateKey(app.dateSubmitted, groupBy));
        const labels = Object.keys(grouped).sort();
        const data = labels.map((label) => grouped[label]);

        destroyChart(applicationTrendChart);

        applicationTrendChart = new Chart(document.getElementById("applicationTrendChart"), {
            type: "bar",
            data: {
                labels,
                datasets: [
                    {
                        label: "Applications",
                        data,
                        backgroundColor: "#4e79a7"
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                }
            }
        });
    }

    function renderStatusTrendChart(filteredApps, groupBy) {
        const statuses = ["Submitted", "Interview", "Rejected", "Offer"];
        const labels = [...new Set(filteredApps.map((app) => getDateKey(app.dateSubmitted, groupBy)))].sort();

        const datasets = statuses.map((status) => ({
            label: status,
            data: labels.map((label) =>
                filteredApps.filter((app) =>
                    getDateKey(app.dateSubmitted, groupBy) === label && app.status === status
                ).length
            ),
            backgroundColor: statusColors[status]
        }));

        destroyChart(statusTrendChart);

        statusTrendChart = new Chart(document.getElementById("statusTrendChart"), {
            type: "bar",
            data: {
                labels,
                datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "bottom"
                    }
                },
                scales: {
                    x: {
                        stacked: true
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                }
            }
        });
    }

    function renderPositionStatusChart(filteredApps) {
        const statuses = ["Submitted", "Interview", "Rejected", "Offer"];
        const titleCounts = countBy(filteredApps, (app) => app.jobTitle || "Other");
        const topTitles = Object.keys(getTopNWithOther(titleCounts, 5));

        const datasets = statuses.map((status) => ({
            label: status,
            data: topTitles.map((title) => {
                if (title === "Other") {
                    return filteredApps.filter((app) => {
                        const appTitle = app.jobTitle || "Other";
                        return !topTitles.includes(appTitle) && app.status === status;
                    }).length;
                }

                return filteredApps.filter((app) =>
                    (app.jobTitle || "Other") === title && app.status === status
                ).length;
            }),
            backgroundColor: statusColors[status]
        }));

        destroyChart(positionStatusChart);

        positionStatusChart = new Chart(document.getElementById("positionStatusChart"), {
            type: "bar",
            data: {
                labels: topTitles.map((title) => shortenLabel(title, 14)),
                datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "bottom"
                    }
                },
                scales: {
                    x: {
                        stacked: true,
                        ticks: {
                            maxRotation: 35,
                            minRotation: 20
                        }
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                }
            }
        });
    }

    function renderStatusChart(filteredApps) {
        const counts = countBy(filteredApps, (app) => app.status || "Submitted");

        destroyChart(statusChart);

        statusChart = new Chart(document.getElementById("statusChart"), {
            type: "doughnut",
            data: {
                labels: Object.keys(counts),
                datasets: [
                    {
                        data: Object.values(counts),
                        backgroundColor: Object.keys(counts).map((status) => statusColors[status] || "#bab0ab")
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 1,
                cutout: "52%",
                plugins: {
                    legend: {
                        display: true,
                        position: "bottom",
                        ...getLegendWithCounts()
                    }
                }
            }
        });
    }

    function renderJobTitleChart(filteredApps) {
        const counts = countBy(filteredApps, (app) => app.jobTitle || "Other");
        const topCounts = getTopNWithOther(counts, 5);

        destroyChart(jobTitleChart);

        jobTitleChart = new Chart(document.getElementById("jobTitleChart"), {
            type: "doughnut",
            data: {
                labels: Object.keys(topCounts),
                datasets: [
                    {
                        data: Object.values(topCounts),
                        backgroundColor: chartColors
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 1,
                cutout: "52%",
                plugins: {
                    legend: {
                        display: true,
                        position: "bottom",
                        ...getLegendWithCounts()
                    }
                }
            }
        });
    }

    function renderCompanyChart(filteredApps) {
        const counts = countBy(filteredApps, (app) => app.company || "Other");
        const topCounts = getTopNWithOther(counts, 5);

        destroyChart(companyChart);

        companyChart = new Chart(document.getElementById("companyChart"), {
            type: "doughnut",
            data: {
                labels: Object.keys(topCounts),
                datasets: [
                    {
                        data: Object.values(topCounts),
                        backgroundColor: chartColors
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 1,
                cutout: "52%",
                plugins: {
                    legend: {
                        display: true,
                        position: "bottom",
                        ...getLegendWithCounts()
                    }
                }
            }
        });
    }

    function exportCSV() {
        if (applications.length === 0) {
            alert("No data to export.");
            return;
        }

        const headers = [
            "Application ID",
            "Date",
            "Company",
            "Job Title",
            "Platform",
            "Status",
            "Notes",
            "URL"
        ];

        const rows = applications.map((app) => [
            app.applicationId || app.id || crypto.randomUUID(),
            new Date(app.dateSubmitted).toLocaleDateString(),
            app.company || "",
            app.jobTitle || "",
            app.platform || "Other",
            app.status || "Submitted",
            app.notes || "",
            app.url || ""
        ]);

        const csvContent = [headers, ...rows]
            .map((row) =>
                row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")
            )
            .join("\n");

        const blob = new Blob([csvContent], { type: "text/csv" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;

        const timestamp = new Date()
            .toISOString()
            .replace(/[:.]/g, "-");

        a.download = `job_application_record_at_${timestamp}.csv`;
        a.click();

        URL.revokeObjectURL(url);
    }

    function getDuplicateKey(app) {
        if (app.applicationId) {
            return `id|${app.applicationId}`;
        }

        const date = new Date(app.dateSubmitted).toLocaleDateString();

        return `fallback|${(app.company || "").toLowerCase().trim()}|${(app.jobTitle || "")
            .toLowerCase()
            .trim()}|${date}`;
    }

    function parseCSV(text) {
        const lines = text.trim().split(/\r?\n/);

        if (lines.length < 2) {
            return [];
        }

        return lines
            .slice(1)
            .map((line) => {
                const values = [];
                let current = "";
                let insideQuotes = false;

                for (let i = 0; i < line.length; i++) {
                    const char = line[i];
                    const nextChar = line[i + 1];

                    if (char === '"' && insideQuotes && nextChar === '"') {
                        current += '"';
                        i++;
                    } else if (char === '"') {
                        insideQuotes = !insideQuotes;
                    } else if (char === "," && !insideQuotes) {
                        values.push(current.trim());
                        current = "";
                    } else {
                        current += char;
                    }
                }

                values.push(current.trim());

                const rawDate = values[1];
                const parsedDate = new Date(rawDate);
                const safeDate = isNaN(parsedDate.getTime())
                    ? new Date().toISOString()
                    : parsedDate.toISOString();

                return {
                    id: Date.now() + Math.random(),
                    applicationId: values[0] || crypto.randomUUID(),
                    dateSubmitted: safeDate,
                    company: values[2] || "",
                    jobTitle: values[3] || "",
                    platform: values[4] || "Other",
                    status: values[5] || "Submitted",
                    notes: values[6] || "",
                    url: values[7] || ""
                };
            })
            .filter((app) => app.company && app.jobTitle);
    }

    function getGoogleAuthToken(interactive = true) {
        return new Promise((resolve, reject) => {
            chrome.identity.getAuthToken({ interactive }, (token) => {
                if (chrome.runtime.lastError || !token) {
                    reject(new Error(chrome.runtime.lastError?.message || "Google sign-in failed."));
                    return;
                }

                resolve(token);
            });
        });
    }

    async function driveFetch(token, url, options = {}) {
        const response = await fetch(url, {
            ...options,
            headers: {
                Authorization: `Bearer ${token}`,
                ...(options.headers || {})
            }
        });

        if (!response.ok) {
            const message = await response.text();
            throw new Error(message || `Google Drive request failed (${response.status}).`);
        }

        return response;
    }

    async function findDriveBackupFile(token) {
        const query = encodeURIComponent(
            `name='${DRIVE_BACKUP_FILE_NAME}' and trashed=false`
        );
        const url =
            `https://www.googleapis.com/drive/v3/files?q=${query}` +
            "&spaces=drive&fields=files(id,name,webViewLink,modifiedTime)&pageSize=10";

        const response = await driveFetch(token, url);
        const data = await response.json();

        return data.files?.[0] || null;
    }

    function createBackupPayload() {
        return {
            app: "Job Application Tracker",
            schemaVersion: 1,
            exportedAt: new Date().toISOString(),
            applications
        };
    }

    function createMultipartBody(metadata, payload) {
        const boundary = "job_tracker_backup_boundary";
        const delimiter = `\r\n--${boundary}\r\n`;
        const closeDelimiter = `\r\n--${boundary}--`;

        const body =
            delimiter +
            "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
            JSON.stringify(metadata) +
            delimiter +
            "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
            JSON.stringify(payload, null, 2) +
            closeDelimiter;

        return { boundary, body };
    }

    async function uploadDriveBackup(token, existingFileId) {
        const metadata = {
            name: DRIVE_BACKUP_FILE_NAME,
            mimeType: "application/json"
        };
        const payload = createBackupPayload();
        const { boundary, body } = createMultipartBody(metadata, payload);

        const url = existingFileId
            ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart&fields=id,name,webViewLink,modifiedTime`
            : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,modifiedTime";

        const response = await driveFetch(token, url, {
            method: existingFileId ? "PATCH" : "POST",
            headers: {
                "Content-Type": `multipart/related; boundary=${boundary}`
            },
            body
        });

        return response.json();
    }

    async function downloadDriveBackup(token, fileId) {
        const response = await driveFetch(
            token,
            `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
        );

        return response.json();
    }

    async function deleteDriveBackup(token, fileId) {
        await driveFetch(token, `https://www.googleapis.com/drive/v3/files/${fileId}`, {
            method: "DELETE"
        });
    }

    function normalizeBackupApplications(payload) {
        if (Array.isArray(payload)) {
            return payload;
        }

        if (Array.isArray(payload?.applications)) {
            return payload.applications;
        }

        return [];
    }

    function mergeApplications(importedApplications) {
        const existingKeys = new Set(applications.map(getDuplicateKey));
        const uniqueApplications = importedApplications.filter((app) => {
            const key = getDuplicateKey(app);
            return !existingKeys.has(key);
        });

        applications = [...applications, ...uniqueApplications];

        return {
            added: uniqueApplications.length,
            skipped: importedApplications.length - uniqueApplications.length
        };
    }

    searchInput.addEventListener("input", () => {
        currentPage = 1;
        renderDashboard();
    });

    statusFilter.addEventListener("change", () => {
        currentPage = 1;
        renderDashboard();
    });

    sortFilter.addEventListener("change", () => {
        currentPage = 1;
        renderDashboard();
    });

    pageSizeSelect.addEventListener("change", () => {
        currentPage = 1;
        renderDashboard();
    });

    prevPageBtn.addEventListener("click", () => {
        if (currentPage > 1) {
            currentPage--;
            renderDashboard();
        }
    });

    nextPageBtn.addEventListener("click", () => {
        currentPage++;
        renderDashboard();
    });

    bottomPrevPageBtn.addEventListener("click", () => {
        if (currentPage > 1) {
            currentPage--;
            renderDashboard();
        }
    });

    bottomNextPageBtn.addEventListener("click", () => {
        currentPage++;
        renderDashboard();
    });

    selectAllCheckbox.addEventListener("change", () => {
        document.querySelectorAll(".row-checkbox").forEach((checkbox) => {
            checkbox.checked = selectAllCheckbox.checked;
        });

        updateSelectedCount();
    });

    metadataViewBtn.addEventListener("click", () => {
        switchView("metadata");
    });

    statsViewBtn.addEventListener("click", () => {
        switchView("stats");
    });

    defaultViewSelect.addEventListener("change", async () => {
        const selectedDefaultView = defaultViewSelect.value;

        await chrome.storage.local.set({
            defaultDashboardView: selectedDefaultView
        });
    });

    [
        statsTimeRange,
        statsGroupBy,
        statsJobFilter,
        statsCompanyFilter,
        statsPlatformFilter,
        statsStatusFilter
    ].forEach((filter) => {
        filter.addEventListener("change", () => {
            renderStats();
        });
    });

    exportBtn.addEventListener("click", exportCSV);

    driveBackupBtn.addEventListener("click", async () => {
        if (applications.length === 0) {
            alert("No data to back up.");
            return;
        }

        driveBackupBtn.disabled = true;
        driveBackupBtn.textContent = "Backing up...";

        try {
            const token = await getGoogleAuthToken(true);
            const existingFile = await findDriveBackupFile(token);
            const file = await uploadDriveBackup(token, existingFile?.id);

            alert(
                `Google Drive backup complete.\n\nFile: ${file.name}\nRecords: ${applications.length}`
            );
        } catch (error) {
            console.error("Google Drive backup failed:", error);
            alert(error.message || "Google Drive backup failed.");
        } finally {
            driveBackupBtn.disabled = false;
            driveBackupBtn.textContent = "Backup to Drive";
        }
    });

    driveRestoreBtn.addEventListener("click", async () => {
        const confirmRestore = confirm(
            "Restore from Google Drive? Existing local records will be kept and duplicate records will be skipped."
        );

        if (!confirmRestore) {
            return;
        }

        driveRestoreBtn.disabled = true;
        driveRestoreBtn.textContent = "Restoring...";

        try {
            const token = await getGoogleAuthToken(true);
            const file = await findDriveBackupFile(token);

            if (!file) {
                alert("No Google Drive backup file was found.");
                return;
            }

            const payload = await downloadDriveBackup(token, file.id);
            const importedApplications = normalizeBackupApplications(payload)
                .filter((app) => app.company && app.jobTitle)
                .map((app) => ({
                    id: app.id || Date.now() + Math.random(),
                    applicationId: app.applicationId || crypto.randomUUID(),
                    dateSubmitted: app.dateSubmitted || new Date().toISOString(),
                    company: app.company || "",
                    jobTitle: app.jobTitle || "",
                    platform: app.platform || "Other",
                    status: app.status || "Submitted",
                    notes: app.notes || "",
                    url: app.url || ""
                }));

            if (importedApplications.length === 0) {
                alert("The Google Drive backup file does not contain valid records.");
                return;
            }

            const result = mergeApplications(importedApplications);

            await chrome.storage.local.set({ applications });
            currentPage = 1;
            renderDashboard();
            populateStatsFilters();

            if (statsView.style.display !== "none") {
                renderStats();
            }

            alert(
                `Restore complete. Added ${result.added} records. Skipped ${result.skipped} duplicates.`
            );
        } catch (error) {
            console.error("Google Drive restore failed:", error);
            alert(error.message || "Google Drive restore failed.");
        } finally {
            driveRestoreBtn.disabled = false;
            driveRestoreBtn.textContent = "Restore from Drive";
        }
    });

    driveDeleteBtn.addEventListener("click", async () => {
        const confirmDelete = confirm(
            "Remove the Google Drive backup file? Local browser records will stay unchanged."
        );

        if (!confirmDelete) {
            return;
        }

        driveDeleteBtn.disabled = true;
        driveDeleteBtn.textContent = "Removing...";

        try {
            const token = await getGoogleAuthToken(true);
            const file = await findDriveBackupFile(token);

            if (!file) {
                alert("No Google Drive backup file was found.");
                return;
            }

            await deleteDriveBackup(token, file.id);
            alert("Google Drive backup file removed. Local records were not changed.");
        } catch (error) {
            console.error("Google Drive backup removal failed:", error);
            alert(error.message || "Google Drive backup removal failed.");
        } finally {
            driveDeleteBtn.disabled = false;
            driveDeleteBtn.textContent = "Remove Cloud Backup";
        }
    });

    batchDeleteBtn.addEventListener("click", async () => {
        const selectedIds = Array.from(
            document.querySelectorAll(".row-checkbox:checked")
        ).map((checkbox) => Number(checkbox.dataset.id));

        if (selectedIds.length === 0) {
            alert("Please select at least one application to delete.");
            return;
        }

        const confirmDelete = confirm(
            `Are you sure you want to delete ${selectedIds.length} selected application(s)?`
        );

        if (!confirmDelete) {
            return;
        }

        applications = applications.filter((app) => !selectedIds.includes(app.id));

        await chrome.storage.local.set({ applications });
        renderDashboard();
        populateStatsFilters();

        if (statsView.style.display !== "none") {
            renderStats();
        }

        alert("Selected application(s) deleted.");
    });

    importBtn.addEventListener("click", () => {
        importFile.click();
    });

    importFile.addEventListener("change", async (event) => {
        const file = event.target.files[0];

        if (!file) {
            return;
        }

        const text = await file.text();
        const importedApplications = parseCSV(text);

        if (importedApplications.length === 0) {
            alert("No valid records found in the CSV file.");
            importFile.value = "";
            return;
        }

        const confirmImport = confirm(
            `Import ${importedApplications.length} records? Duplicates will be skipped.`
        );

        if (!confirmImport) {
            importFile.value = "";
            return;
        }

        const existingKeys = new Set(applications.map(getDuplicateKey));

        const uniqueImportedApplications = importedApplications.filter((app) => {
            const key = getDuplicateKey(app);
            return !existingKeys.has(key);
        });

        const duplicateCount =
            importedApplications.length - uniqueImportedApplications.length;

        if (uniqueImportedApplications.length === 0) {
            alert(
                `All imported records already exist. Skipped ${duplicateCount} duplicates.`
            );
            importFile.value = "";
            return;
        }

        applications = [...applications, ...uniqueImportedApplications];

        await chrome.storage.local.set({ applications });
        currentPage = 1;
        renderDashboard();
        populateStatsFilters();

        if (statsView.style.display !== "none") {
            renderStats();
        }

        alert(
            `Import complete. Added ${uniqueImportedApplications.length} new records. Skipped ${duplicateCount} duplicates.`
        );

        importFile.value = "";
    });

    resetBtn.addEventListener("click", async () => {
        if (applications.length === 0) {
            alert("No data to reset.");
            return;
        }

        const exportFirst = confirm(
            "Do you want to export your data to CSV before resetting?"
        );

        if (exportFirst) {
            exportCSV();
        }

        const confirmReset = confirm(
            "Are you sure you want to delete all saved application records? This cannot be undone."
        );

        if (!confirmReset) {
            return;
        }

        applications = [];
        await chrome.storage.local.set({ applications });
        currentPage = 1;
        renderDashboard();
        populateStatsFilters();

        if (statsView.style.display !== "none") {
            renderStats();
        }

        alert("All records have been reset.");
    });
});
