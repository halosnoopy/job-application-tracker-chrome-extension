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
    const settingsBtn = document.getElementById("settingsBtn");
    const settingsPanel = document.getElementById("settingsPanel");

    const statsTimeRange = document.getElementById("statsTimeRange");
    const statsGroupBy = document.getElementById("statsGroupBy");
    const statsJobFilter = document.getElementById("statsJobFilter");
    const statsCompanyFilter = document.getElementById("statsCompanyFilter");
    const statsPlatformFilter = document.getElementById("statsPlatformFilter");
    const statsStatusFilter = document.getElementById("statsStatusFilter");
    const statsShowingLabel = document.getElementById("statsShowingLabel");
    const statsKpiGrid = document.getElementById("statsKpiGrid");
    const needsAttentionList = document.getElementById("needsAttentionList");

    const defaultViewSelect = document.getElementById("defaultViewSelect");
    const geminiApiKeyInput = document.getElementById("geminiApiKeyInput");
    const saveGeminiKeyBtn = document.getElementById("saveGeminiKeyBtn");
    const clearGeminiKeyBtn = document.getElementById("clearGeminiKeyBtn");
    const googleClientIdInput = document.getElementById("googleClientIdInput");

    const statusModal = document.getElementById("statusModal");
    const statusModalCurrent = document.getElementById("statusModalCurrent");
    const statusUpdateSelect = document.getElementById("statusUpdateSelect");
    const statusUpdateDate = document.getElementById("statusUpdateDate");
    const statusUpdateNote = document.getElementById("statusUpdateNote");
    const closeStatusModalBtn = document.getElementById("closeStatusModalBtn");
    const cancelStatusUpdateBtn = document.getElementById("cancelStatusUpdateBtn");
    const saveStatusUpdateBtn = document.getElementById("saveStatusUpdateBtn");
    const timelineModal = document.getElementById("timelineModal");
    const timelineModalTitle = document.getElementById("timelineModalTitle");
    const timelineList = document.getElementById("timelineList");
    const closeTimelineModalBtn = document.getElementById("closeTimelineModalBtn");

    const topPageInfo = document.getElementById("topPageInfo");


    let currentPage = 1;

    let applicationTrendChart = null;
    let statusTrendChart = null;
    let positionStatusChart = null;
    let jobTitleChart = null;
    let statusChart = null;
    let companyChart = null;

    const STATUSES = [
        "Submitted",
        "HR Reachout",
        "Phone Screen",
        "Interview",
        "Final Interview",
        "Offer",
        "Rejected",
        "Withdrawn"
    ];

    const PIPELINE_STAGES = ["Applied", "Contact", "Interview", "Decision"];

    const statusColors = {
        Submitted: "#0a84ff",
        "HR Reachout": "#ff9f0a",
        "Phone Screen": "#ff9f0a",
        Interview: "#bf5af2",
        "Final Interview": "#bf5af2",
        Offer: "#30d158",
        Rejected: "#ff453a",
        Withdrawn: "#8e8e93"
    };

    const stageColors = {
        Applied: "#0a84ff",
        Contact: "#ff9f0a",
        Interview: "#bf5af2",
        Decision: "#30d158"
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
        "defaultDashboardView",
        "geminiApiKey"
    ]);

    let applications = result.applications || [];
    let defaultDashboardView = result.defaultDashboardView || "metadata";
    let activeStatusAppId = null;
    let activeTimelineAppId = null;

    if (defaultDashboardView !== "metadata" && defaultDashboardView !== "stats") {
        defaultDashboardView = "metadata";
    }

    defaultViewSelect.value = defaultDashboardView;
    geminiApiKeyInput.value = result.geminiApiKey || "";
    googleClientIdInput.value = chrome.runtime.getManifest().oauth2?.client_id || "";
    populateStatusSelect(statusUpdateSelect);

    const migratedApplications = applications.map(normalizeApplication);
    const didMigrateApplications =
        JSON.stringify(migratedApplications) !== JSON.stringify(applications);
    applications = migratedApplications;

    if (didMigrateApplications) {
        await chrome.storage.local.set({ applications });
    }

    renderDashboard();
    populateStatsFilters();
    switchView(defaultDashboardView);

    function shortenLabel(label, maxLength = 18) {
        if (!label) return "Other";
        return label.length > maxLength ? label.slice(0, maxLength) + "..." : label;
    }

    function escapeHtml(value) {
        return String(value || "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function populateStatusSelect(selectElement) {
        selectElement.innerHTML = "";
        STATUSES.forEach((status) => {
            const option = document.createElement("option");
            option.value = status;
            option.textContent = status;
            selectElement.appendChild(option);
        });
    }

    function normalizeDate(value, fallback = new Date().toISOString()) {
        const date = new Date(value);
        return isNaN(date.getTime()) ? fallback : date.toISOString();
    }

    function getStageForStatus(status) {
        if (status === "Submitted") return "Applied";
        if (status === "HR Reachout" || status === "Phone Screen") return "Contact";
        if (status === "Interview" || status === "Final Interview") return "Interview";
        if (status === "Offer" || status === "Rejected" || status === "Withdrawn") return "Decision";
        return "Applied";
    }

    function normalizeStatus(status) {
        if (status === "Rejected" || status === "Offer" || status === "Submitted") return status;
        if (status === "Interview") return status;
        return STATUSES.includes(status) ? status : "Submitted";
    }

    function sortStatusHistory(history) {
        return [...history].sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    function getCurrentStatusFromHistory(history) {
        const sorted = sortStatusHistory(history);
        return sorted[sorted.length - 1]?.status || "Submitted";
    }

    function normalizeApplication(app) {
        const dateSubmitted = normalizeDate(app.dateSubmitted || app.createdAt);
        let history = Array.isArray(app.statusHistory) ? app.statusHistory : [];

        history = history
            .map((event) => ({
                status: normalizeStatus(event.status || app.status),
                date: normalizeDate(event.date || dateSubmitted, dateSubmitted),
                note: event.note || ""
            }))
            .filter((event) => event.status && event.date);

        if (history.length === 0) {
            history = [
                {
                    status: normalizeStatus(app.status || "Submitted"),
                    date: dateSubmitted,
                    note: app.schemaVersion ? "" : "Migrated from previous version"
                }
            ];
        }

        history = sortStatusHistory(history);
        const status = getCurrentStatusFromHistory(history);
        const lastUpdated = history[history.length - 1]?.date || dateSubmitted;

        return {
            ...app,
            id: app.id || Date.now() + Math.random(),
            applicationId: app.applicationId || crypto.randomUUID(),
            dateSubmitted,
            status,
            lastUpdated,
            statusHistory: history,
            schemaVersion: 4
        };
    }

    async function saveApplications(nextApplications = applications) {
        applications = nextApplications.map(normalizeApplication);
        await chrome.storage.local.set({ applications });
        renderDashboard();
        populateStatsFilters();

        if (statsView.style.display !== "none") {
            renderStats();
        }
    }

    function formatDate(value) {
        const date = new Date(value);
        return isNaN(date.getTime()) ? "" : date.toLocaleDateString();
    }

    function dateInputValue(value) {
        const date = new Date(value);
        return isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10);
    }

    function statusClass(status) {
        return `status-${String(status || "Submitted").toLowerCase().replace(/\s+/g, "-")}`;
    }

    function renderPipeline(app) {
        const currentStage = getStageForStatus(app.status);
        const currentStageIndex = PIPELINE_STAGES.indexOf(currentStage);
        const reachedStages = new Set(
            (app.statusHistory || [])
                .filter((event) => PIPELINE_STAGES.indexOf(getStageForStatus(event.status)) <= currentStageIndex)
                .map((event) => getStageForStatus(event.status))
        );

        return `
            <div class="pipeline-bar" title="${escapeHtml(app.status || currentStage)}">
                ${PIPELINE_STAGES.map((stage, index) => {
                    const isReached = reachedStages.has(stage) || stage === currentStage;
                    const isCurrent = stage === currentStage;
                    const color = isCurrent
                        ? statusColors[app.status] || stageColors[stage]
                        : stageColors[stage];

                    return `<span class="pipeline-step ${isReached ? "reached" : ""} ${isCurrent ? "current" : ""}" style="--stage-color: ${color}"></span>`;
                }).join("")}
            </div>
        `;
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
        const interview = applications.filter((app) =>
            app.status === "Interview" || app.status === "Final Interview"
        ).length;
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
                <td>${escapeHtml(app.company || "")}</td>
                <td>${escapeHtml(app.jobTitle || "")}</td>
                <td>${escapeHtml(app.platform || "Other")}</td>
                <td>${renderPipeline(app)}</td>
                <td>
                    <span class="status-badge ${statusClass(app.status)}">${escapeHtml(app.status || "Submitted")}</span>
                </td>
                <td>${formatDate(app.lastUpdated || app.dateSubmitted)}</td>
                <td>${escapeHtml(app.notes || "")}</td>
                <td><a href="${escapeHtml(app.url || "#")}" target="_blank">Open</a></td>
                <td>
                    <div class="row-actions">
                        <button class="update-status-btn" data-id="${app.id}">Update</button>
                        <button class="timeline-btn" data-id="${app.id}">Timeline</button>
                    </div>
                </td>
            `;

            table.appendChild(row);
        });

        document.querySelectorAll(".update-status-btn").forEach((button) => {
            button.addEventListener("click", () => {
                openStatusModal(Number(button.dataset.id));
            });
        });

        document.querySelectorAll(".timeline-btn").forEach((button) => {
            button.addEventListener("click", () => {
                openTimelineModal(Number(button.dataset.id));
            });
        });

        document.querySelectorAll(".row-checkbox").forEach((checkbox) => {
            checkbox.addEventListener("change", updateSelectedCount);
        });

        selectAllCheckbox.checked = false;
        updateSelectedCount();
    }

    function openStatusModal(appId) {
        const app = applications.find((item) => item.id === appId);
        if (!app) return;

        activeStatusAppId = appId;
        statusModalCurrent.textContent = `${app.company || "Unknown company"} - ${app.jobTitle || "Unknown role"} | Current: ${app.status}`;
        statusUpdateSelect.value = app.status || "Submitted";
        statusUpdateDate.value = new Date().toISOString().slice(0, 10);
        statusUpdateNote.value = "";
        statusModal.style.display = "flex";
    }

    function closeStatusModal() {
        activeStatusAppId = null;
        statusModal.style.display = "none";
    }

    async function saveStatusUpdate() {
        const app = applications.find((item) => item.id === activeStatusAppId);
        if (!app) return;

        const status = statusUpdateSelect.value;
        const date = normalizeDate(`${statusUpdateDate.value || new Date().toISOString().slice(0, 10)}T12:00:00`);
        const note = statusUpdateNote.value.trim();
        const nextApp = normalizeApplication({
            ...app,
            statusHistory: [
                ...(app.statusHistory || []),
                {
                    status,
                    date,
                    note
                }
            ]
        });

        await saveApplications(applications.map((item) => item.id === app.id ? nextApp : item));
        closeStatusModal();
    }

    function openTimelineModal(appId) {
        const app = applications.find((item) => item.id === appId);
        if (!app) return;

        activeTimelineAppId = appId;
        timelineModalTitle.textContent = `${app.company || "Unknown company"} - ${app.jobTitle || "Unknown role"}`;
        renderTimelineList(app);
        timelineModal.style.display = "flex";
    }

    function closeTimelineModal() {
        activeTimelineAppId = null;
        timelineModal.style.display = "none";
    }

    function renderTimelineList(app) {
        const history = sortStatusHistory(app.statusHistory || []);

        timelineList.innerHTML = history.map((event, index) => `
            <div class="timeline-item" data-index="${index}">
                <div class="timeline-dot ${statusClass(event.status)}"></div>
                <div class="timeline-fields">
                    <select class="timeline-status" data-index="${index}">
                        ${STATUSES.map((status) =>
                            `<option value="${status}" ${status === event.status ? "selected" : ""}>${status}</option>`
                        ).join("")}
                    </select>
                    <input class="timeline-date" data-index="${index}" type="date" value="${dateInputValue(event.date)}">
                    <input class="timeline-note" data-index="${index}" type="text" value="${escapeHtml(event.note || "")}" placeholder="Optional note">
                </div>
                <div class="timeline-actions">
                    <button class="save-timeline-event-btn" data-index="${index}">Save</button>
                    <button class="delete-timeline-event-btn" data-index="${index}" ${history.length <= 1 ? "disabled" : ""}>Delete</button>
                </div>
            </div>
        `).join("");

        document.querySelectorAll(".save-timeline-event-btn").forEach((button) => {
            button.addEventListener("click", async () => {
                await saveTimelineEvent(Number(button.dataset.index));
            });
        });

        document.querySelectorAll(".delete-timeline-event-btn").forEach((button) => {
            button.addEventListener("click", async () => {
                await deleteTimelineEvent(Number(button.dataset.index));
            });
        });
    }

    async function saveTimelineEvent(index) {
        const app = applications.find((item) => item.id === activeTimelineAppId);
        if (!app) return;

        const history = sortStatusHistory(app.statusHistory || []);
        history[index] = {
            status: document.querySelector(`.timeline-status[data-index="${index}"]`).value,
            date: normalizeDate(`${document.querySelector(`.timeline-date[data-index="${index}"]`).value}T12:00:00`),
            note: document.querySelector(`.timeline-note[data-index="${index}"]`).value.trim()
        };

        const nextApp = normalizeApplication({ ...app, statusHistory: history });
        await saveApplications(applications.map((item) => item.id === app.id ? nextApp : item));
        openTimelineModal(app.id);
    }

    async function deleteTimelineEvent(index) {
        const app = applications.find((item) => item.id === activeTimelineAppId);
        if (!app) return;

        const history = sortStatusHistory(app.statusHistory || []);
        if (history.length <= 1) {
            alert("At least one status event is required.");
            return;
        }

        history.splice(index, 1);
        const nextApp = normalizeApplication({ ...app, statusHistory: history });
        await saveApplications(applications.map((item) => item.id === app.id ? nextApp : item));
        openTimelineModal(app.id);
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
        renderFunnelChart(filteredApps);
        renderStatusTrendChart(filteredApps, groupBy);
        renderStatusChart(filteredApps);
        renderJobTitleChart(filteredApps);
        renderCompanyChart(filteredApps);
        renderKpiCards(filteredApps);
        renderNeedsAttention(filteredApps);
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

    function getStatusEvents(filteredApps) {
        return filteredApps.flatMap((app) =>
            (app.statusHistory || []).map((event) => ({
                ...event,
                app
            }))
        );
    }

    function renderFunnelChart(filteredApps) {
        const counts = PIPELINE_STAGES.map((stage) =>
            filteredApps.filter((app) =>
                (app.statusHistory || []).some((event) => getStageForStatus(event.status) === stage)
            ).length
        );

        destroyChart(statusTrendChart);

        statusTrendChart = new Chart(document.getElementById("statusTrendChart"), {
            type: "bar",
            data: {
                labels: PIPELINE_STAGES,
                datasets: [
                    {
                        label: "Reached stage",
                        data: counts,
                        backgroundColor: PIPELINE_STAGES.map((stage) => stageColors[stage])
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
        const events = getStatusEvents(filteredApps);
        const labels = [...new Set(events.map((event) => getDateKey(event.date, groupBy)))].sort();

        const datasets = STATUSES.map((status) => ({
            label: status,
            data: labels.map((label) =>
                events.filter((event) =>
                    getDateKey(event.date, groupBy) === label && event.status === status
                ).length
            ),
            backgroundColor: statusColors[status]
        }));

        destroyChart(positionStatusChart);

        positionStatusChart = new Chart(document.getElementById("positionStatusChart"), {
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

    function percent(numerator, denominator) {
        if (!denominator) return "0%";
        return `${Math.round((numerator / denominator) * 100)}%`;
    }

    function reachedStage(app, stage) {
        return (app.statusHistory || []).some((event) => getStageForStatus(event.status) === stage);
    }

    function daysBetween(start, end) {
        const startDate = new Date(start);
        const endDate = new Date(end);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return null;
        return Math.max(0, Math.round((endDate - startDate) / 86400000));
    }

    function signedDaysBetween(start, end) {
        const startDate = new Date(start);
        const endDate = new Date(end);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return null;
        return Math.round((endDate - startDate) / 86400000);
    }

    function formatRelativeDays(days) {
        if (days === 0) return "today";
        if (days === 1) return "tomorrow";
        if (days === -1) return "yesterday";
        if (days > 1) return `in ${days} days`;
        return `${Math.abs(days)} days ago`;
    }

    function averageDaysToStage(filteredApps, stage) {
        const values = filteredApps
            .map((app) => {
                const event = sortStatusHistory(app.statusHistory || [])
                    .find((item) => getStageForStatus(item.status) === stage);
                return event ? daysBetween(app.dateSubmitted, event.date) : null;
            })
            .filter((value) => Number.isFinite(value));

        if (values.length === 0) return "n/a";
        return `${Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)}d`;
    }

    function renderKpiCards(filteredApps) {
        const total = filteredApps.length;
        const active = filteredApps.filter((app) =>
            !["Offer", "Rejected", "Withdrawn"].includes(app.status)
        ).length;
        const contacted = filteredApps.filter((app) => reachedStage(app, "Contact")).length;
        const interviewed = filteredApps.filter((app) => reachedStage(app, "Interview")).length;
        const offers = filteredApps.filter((app) => app.status === "Offer").length;
        const now = new Date();
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        const thisWeek = filteredApps.filter((app) => new Date(app.dateSubmitted) >= weekAgo).length;

        const cards = [
            ["Total", total],
            ["Active Pipeline", active],
            ["This Week", thisWeek],
            ["Contact Rate", percent(contacted, total)],
            ["Interview Rate", percent(interviewed, total)],
            ["Offer Rate", percent(offers, total)],
            ["Avg Days to Contact", averageDaysToStage(filteredApps, "Contact")]
        ];

        statsKpiGrid.innerHTML = cards.map(([label, value]) => `
            <div class="kpi-card">
                <div class="kpi-value">${escapeHtml(value)}</div>
                <div class="kpi-label">${escapeHtml(label)}</div>
            </div>
        `).join("");
    }

    function renderNeedsAttention(filteredApps) {
        const now = new Date();
        const activeStatuses = ["Submitted", "HR Reachout", "Phone Screen", "Interview", "Final Interview"];
        const forwardStatuses = ["HR Reachout", "Phone Screen", "Interview", "Final Interview", "Offer"];
        const items = filteredApps
            .map((app) => {
                const daysSinceUpdate = daysBetween(app.lastUpdated || app.dateSubmitted, now);
                const nextEventDays = app.nextEventDate ? signedDaysBetween(now, app.nextEventDate) : null;
                const isActive = activeStatuses.includes(app.status);
                const latestEvent = sortStatusHistory(app.statusHistory || []).at(-1);
                const recentlyAdvanced =
                    latestEvent &&
                    forwardStatuses.includes(latestEvent.status) &&
                    daysSinceUpdate !== null &&
                    daysSinceUpdate <= 7;

                if (Number.isFinite(nextEventDays) && nextEventDays <= 7 && isActive) {
                    const label = app.nextEventLabel || app.status || "Next event";
                    const reason = nextEventDays < 0
                        ? `${label} overdue (${formatRelativeDays(nextEventDays)})`
                        : `${label} ${formatRelativeDays(nextEventDays)}`;
                    return {
                        app,
                        reason,
                        type: nextEventDays < 0 ? "overdue" : "upcoming",
                        priority: nextEventDays < 0 ? 100 : 95 - nextEventDays,
                        sortDate: app.nextEventDate
                    };
                }

                if (app.status === "Offer") {
                    return {
                        app,
                        reason: "Offer needs decision",
                        type: "decision",
                        priority: 88,
                        sortDate: app.lastUpdated || app.dateSubmitted
                    };
                }

                if (app.status === "Submitted" && daysSinceUpdate >= 14) {
                    return {
                        app,
                        reason: `Follow up: ${daysSinceUpdate} days since submission`,
                        type: "stale",
                        priority: 70 + Math.min(daysSinceUpdate, 30) / 10,
                        sortDate: app.lastUpdated || app.dateSubmitted
                    };
                }

                if (getStageForStatus(app.status) === "Contact" && daysSinceUpdate >= 7) {
                    return {
                        app,
                        reason: `Follow up: ${daysSinceUpdate} days since contact`,
                        type: "stale",
                        priority: 78 + Math.min(daysSinceUpdate, 30) / 10,
                        sortDate: app.lastUpdated || app.dateSubmitted
                    };
                }

                if (getStageForStatus(app.status) === "Interview" && daysSinceUpdate >= 10) {
                    return {
                        app,
                        reason: `Follow up: ${daysSinceUpdate} days since interview update`,
                        type: "stale",
                        priority: 82 + Math.min(daysSinceUpdate, 30) / 10,
                        sortDate: app.lastUpdated || app.dateSubmitted
                    };
                }

                if (recentlyAdvanced) {
                    return {
                        app,
                        reason: `Moved to ${latestEvent.status} ${formatRelativeDays(-daysSinceUpdate)}`,
                        type: "moved",
                        priority: 55 - daysSinceUpdate,
                        sortDate: latestEvent.date
                    };
                }

                return null;
            })
            .filter(Boolean)
            .sort((a, b) => b.priority - a.priority || new Date(b.sortDate) - new Date(a.sortDate))
            .slice(0, 8);

        if (items.length === 0) {
            needsAttentionList.innerHTML = `<div class="empty-attention">No upcoming events, stale follow-ups, or recent advances right now.</div>`;
            return;
        }

        needsAttentionList.innerHTML = items.map(({ app, reason, type }) => `
            <div class="attention-item attention-${escapeHtml(type)}">
                <div>
                    <strong>${escapeHtml(app.company || "Unknown company")}</strong>
                    <span>${escapeHtml(app.jobTitle || "Unknown role")}</span>
                </div>
                <span class="attention-reason">${escapeHtml(reason)}</span>
            </div>
        `).join("");
    }

    function createBackupPayload() {
        return {
            app: "Job Application Tracker",
            schemaVersion: 4,
            exportedAt: new Date().toISOString(),
            applications
        };
    }

    function exportHistory() {
        if (applications.length === 0) {
            alert("No data to export.");
            return;
        }

        const blob = new Blob([JSON.stringify(createBackupPayload(), null, 2)], {
            type: "application/json"
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;

        const timestamp = new Date()
            .toISOString()
            .replace(/[:.]/g, "-");

        a.download = `job_application_history_at_${timestamp}.json`;
        a.click();

        URL.revokeObjectURL(url);
    }

    function normalizeComparable(value) {
        return String(value || "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function getDateKey(value) {
        const date = new Date(value);
        return isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
    }

    function getApplicationMatchKeys(app) {
        const keys = [];
        const normalizedUrl = normalizeUrlForMatch(app.url || "");
        const company = normalizeComparable(app.company);
        const jobTitle = normalizeComparable(app.jobTitle);
        const date = getDateKey(app.dateSubmitted);

        if (app.applicationId) keys.push(`id|${app.applicationId}`);
        if (normalizedUrl) keys.push(`url|${normalizedUrl}`);
        if (company && jobTitle && date) keys.push(`fallback|${company}|${jobTitle}|${date}`);

        return keys;
    }

    function normalizeUrlForMatch(url) {
        if (!url) return "";

        try {
            const parsedUrl = new URL(url);

            if (parsedUrl.hostname.includes("linkedin.com")) {
                const pathMatch = parsedUrl.pathname.match(/\/jobs\/view\/(\d+)/);
                const jobId = pathMatch?.[1] || parsedUrl.searchParams.get("currentJobId");

                if (jobId) {
                    return `https://www.linkedin.com/jobs/view/${jobId}`;
                }
            }

            parsedUrl.hash = "";
            ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach((param) => {
                parsedUrl.searchParams.delete(param);
            });

            return parsedUrl.toString().replace(/\/$/, "").toLowerCase();
        } catch (error) {
            return String(url).trim().replace(/\/$/, "").toLowerCase();
        }
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

    function parseHistoryFile(text, fileName = "") {
        const trimmed = text.trim();

        if (!trimmed) {
            return [];
        }

        if (fileName.toLowerCase().endsWith(".csv")) {
            return parseCSV(text).map(normalizeApplication);
        }

        try {
            const payload = JSON.parse(text);
            return normalizeBackupApplications(payload)
                .filter((app) => app.company && app.jobTitle)
                .map(normalizeApplication);
        } catch (error) {
            return parseCSV(text).map(normalizeApplication);
        }
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

    function getStatusEventKey(event) {
        return [
            event.status || "",
            normalizeDate(event.date || ""),
            String(event.note || "").trim()
        ].join("|");
    }

    function mergeStatusHistories(localHistory = [], importedHistory = []) {
        const events = [];
        const seen = new Set();

        [...localHistory, ...importedHistory].forEach((event) => {
            const normalizedEvent = {
                status: normalizeStatus(event.status || "Submitted"),
                date: normalizeDate(event.date || new Date().toISOString()),
                note: event.note || ""
            };
            const key = getStatusEventKey(normalizedEvent);

            if (!seen.has(key)) {
                seen.add(key);
                events.push(normalizedEvent);
            }
        });

        return sortStatusHistory(events);
    }

    function pickFirstValue(...values) {
        return values.find((value) => String(value || "").trim()) || "";
    }

    function pickEarlierDate(a, b) {
        const first = new Date(a);
        const second = new Date(b);

        if (isNaN(first.getTime())) return b;
        if (isNaN(second.getTime())) return a;

        return first <= second ? a : b;
    }

    function mergeApplicationRecord(localApp, importedApp) {
        const local = normalizeApplication(localApp);
        const imported = normalizeApplication(importedApp);
        const statusHistory = mergeStatusHistories(local.statusHistory, imported.statusHistory);
        const latestEvent = sortStatusHistory(statusHistory).at(-1);
        const currentStatus = latestEvent?.status || local.status || imported.status || "Submitted";
        const localUpdated = new Date(local.lastUpdated || local.dateSubmitted);
        const importedUpdated = new Date(imported.lastUpdated || imported.dateSubmitted);
        const importedIsNewer =
            !isNaN(importedUpdated.getTime()) &&
            (isNaN(localUpdated.getTime()) || importedUpdated > localUpdated);
        const terminalStatus = ["Offer", "Rejected", "Withdrawn"].includes(currentStatus);
        const nextEventDate = terminalStatus
            ? ""
            : importedIsNewer
                ? pickFirstValue(imported.nextEventDate, local.nextEventDate)
                : pickFirstValue(local.nextEventDate, imported.nextEventDate);
        const nextEventLabel = terminalStatus
            ? ""
            : importedIsNewer
                ? pickFirstValue(imported.nextEventLabel, local.nextEventLabel)
                : pickFirstValue(local.nextEventLabel, imported.nextEventLabel);

        return normalizeApplication({
            ...local,
            applicationId: local.applicationId || imported.applicationId || crypto.randomUUID(),
            dateSubmitted: pickEarlierDate(local.dateSubmitted, imported.dateSubmitted),
            company: pickFirstValue(local.company, imported.company),
            jobTitle: pickFirstValue(local.jobTitle, imported.jobTitle),
            platform: pickFirstValue(local.platform, imported.platform, "Other"),
            notes: pickFirstValue(local.notes, imported.notes),
            url: pickFirstValue(local.url, imported.url),
            nextEventDate,
            nextEventLabel,
            statusHistory
        });
    }

    function buildApplicationIndex(sourceApplications) {
        const index = new Map();

        sourceApplications.forEach((app, appIndex) => {
            getApplicationMatchKeys(app).forEach((key) => {
                if (!index.has(key)) {
                    index.set(key, appIndex);
                }
            });
        });

        return index;
    }

    function findMatchingApplicationIndex(app, index) {
        for (const key of getApplicationMatchKeys(app)) {
            if (index.has(key)) {
                return index.get(key);
            }
        }

        return -1;
    }

    function mergeApplications(importedApplications) {
        const nextApplications = applications.map(normalizeApplication);
        const index = buildApplicationIndex(nextApplications);
        let added = 0;
        let updated = 0;
        let unchanged = 0;

        importedApplications.map(normalizeApplication).forEach((importedApp) => {
            const matchingIndex = findMatchingApplicationIndex(importedApp, index);

            if (matchingIndex === -1) {
                const normalizedImported = normalizeApplication(importedApp);
                nextApplications.push(normalizedImported);
                const newIndex = nextApplications.length - 1;
                getApplicationMatchKeys(normalizedImported).forEach((key) => index.set(key, newIndex));
                added += 1;
                return;
            }

            const before = JSON.stringify(normalizeApplication(nextApplications[matchingIndex]));
            const merged = mergeApplicationRecord(nextApplications[matchingIndex], importedApp);
            const after = JSON.stringify(merged);
            nextApplications[matchingIndex] = merged;
            getApplicationMatchKeys(merged).forEach((key) => index.set(key, matchingIndex));

            if (before === after) {
                unchanged += 1;
            } else {
                updated += 1;
            }
        });

        applications = nextApplications;

        return {
            added,
            updated,
            unchanged,
            processed: importedApplications.length
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

    settingsBtn.addEventListener("click", () => {
        const isOpening = settingsPanel.style.display === "none";
        settingsPanel.style.display = isOpening ? "block" : "none";
        settingsBtn.classList.toggle("active-view", isOpening);
    });

    defaultViewSelect.addEventListener("change", async () => {
        const selectedDefaultView = defaultViewSelect.value;

        await chrome.storage.local.set({
            defaultDashboardView: selectedDefaultView
        });
    });

    saveGeminiKeyBtn.addEventListener("click", async () => {
        const geminiApiKey = geminiApiKeyInput.value.trim();

        if (!geminiApiKey) {
            alert("Paste a Gemini API key before saving.");
            return;
        }

        await chrome.storage.local.set({ geminiApiKey });
        alert("Gemini API key saved locally.");
    });

    clearGeminiKeyBtn.addEventListener("click", async () => {
        await chrome.storage.local.remove("geminiApiKey");
        geminiApiKeyInput.value = "";
        alert("Gemini API key cleared.");
    });

    closeStatusModalBtn.addEventListener("click", closeStatusModal);
    cancelStatusUpdateBtn.addEventListener("click", closeStatusModal);
    saveStatusUpdateBtn.addEventListener("click", saveStatusUpdate);
    closeTimelineModalBtn.addEventListener("click", closeTimelineModal);

    statusModal.addEventListener("click", (event) => {
        if (event.target === statusModal) {
            closeStatusModal();
        }
    });

    timelineModal.addEventListener("click", (event) => {
        if (event.target === timelineModal) {
            closeTimelineModal();
        }
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

    exportBtn.addEventListener("click", exportHistory);

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
            driveBackupBtn.textContent = "Backup History";
        }
    });

    driveRestoreBtn.addEventListener("click", async () => {
        const confirmRestore = confirm(
            "Restore from Google Drive? Existing records will be merged so new timeline/status changes are preserved."
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
                .map(normalizeApplication);

            if (importedApplications.length === 0) {
                alert("The Google Drive backup file does not contain valid records.");
                return;
            }

            const result = mergeApplications(importedApplications);

            currentPage = 1;
            await saveApplications(applications);

            alert(
                `Restore complete.\n\nAdded: ${result.added}\nUpdated: ${result.updated}\nUnchanged: ${result.unchanged}`
            );
        } catch (error) {
            console.error("Google Drive restore failed:", error);
            alert(error.message || "Google Drive restore failed.");
        } finally {
            driveRestoreBtn.disabled = false;
            driveRestoreBtn.textContent = "Restore History";
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

        await saveApplications(applications);

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
        const importedApplications = parseHistoryFile(text, file.name);

        if (importedApplications.length === 0) {
            alert("No valid records found in the history file.");
            importFile.value = "";
            return;
        }

        const confirmImport = confirm(
            `Import ${importedApplications.length} history records? Matching records will be merged so timeline/status changes are preserved.`
        );

        if (!confirmImport) {
            importFile.value = "";
            return;
        }

        const result = mergeApplications(importedApplications);

        currentPage = 1;
        await saveApplications(applications);

        alert(
            `Import complete.\n\nAdded: ${result.added}\nUpdated: ${result.updated}\nUnchanged: ${result.unchanged}`
        );

        importFile.value = "";
    });

    resetBtn.addEventListener("click", async () => {
        if (applications.length === 0) {
            alert("No data to reset.");
            return;
        }

        const exportFirst = confirm(
            "Do you want to export your history before resetting?"
        );

        if (exportFirst) {
            exportHistory();
        }

        const confirmReset = confirm(
            "Are you sure you want to delete all saved application records? This cannot be undone."
        );

        if (!confirmReset) {
            return;
        }

        applications = [];
        currentPage = 1;
        await saveApplications(applications);

        alert("All records have been reset.");
    });
});
