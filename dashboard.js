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
    const batchDeleteBtn = document.getElementById("batchDeleteBtn");
    const resetBtn = document.getElementById("resetBtn");

    const searchInput = document.getElementById("searchInput");
    const statusFilter = document.getElementById("statusFilter");
    const sortFilter = document.getElementById("sortFilter");
    const selectAllCheckbox = document.getElementById("selectAllCheckbox");

    const result = await chrome.storage.local.get(["applications"]);
    let applications = result.applications || [];

    renderDashboard();

    function updateSelectedCount() {
        const checkedBoxes = document.querySelectorAll(".row-checkbox:checked");
        selectedCount.textContent = `Selected: ${checkedBoxes.length}`;
        batchDeleteBtn.disabled = checkedBoxes.length === 0;
    }

    function renderStatusStats() {
        const submitted = applications.filter((app) => app.status === "Submitted").length;
        const interview = applications.filter((app) => app.status === "Interview").length;
        const rejected = applications.filter((app) => app.status === "Rejected").length;
        const offer = applications.filter((app) => app.status === "Offer").length;

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
                if (sortType === "newest") {
                    return new Date(b.dateSubmitted) - new Date(a.dateSubmitted);
                }

                if (sortType === "oldest") {
                    return new Date(a.dateSubmitted) - new Date(b.dateSubmitted);
                }

                if (sortType === "company") {
                    return (a.company || "").localeCompare(b.company || "");
                }

                if (sortType === "position") {
                    return (a.jobTitle || "").localeCompare(b.jobTitle || "");
                }

                if (sortType === "platform") {
                    return (a.platform || "").localeCompare(b.platform || "");
                }

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

        table.innerHTML = "";

        visibleApplications.forEach((app) => {
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
          <select class="status-select" data-id="${app.id}">
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
            });
        });

        document.querySelectorAll(".row-checkbox").forEach((checkbox) => {
            checkbox.addEventListener("change", updateSelectedCount);
        });

        selectAllCheckbox.checked = false;
        updateSelectedCount();
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

    searchInput.addEventListener("input", renderDashboard);
    statusFilter.addEventListener("change", renderDashboard);
    sortFilter.addEventListener("change", renderDashboard);

    selectAllCheckbox.addEventListener("change", () => {
        document.querySelectorAll(".row-checkbox").forEach((checkbox) => {
            checkbox.checked = selectAllCheckbox.checked;
        });

        updateSelectedCount();
    });

    exportBtn.addEventListener("click", exportCSV);

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
        renderDashboard();

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
        renderDashboard();

        alert("All records have been reset.");
    });
});