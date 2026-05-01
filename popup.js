document.addEventListener("DOMContentLoaded", async () => {
    const saveBtn = document.getElementById("saveBtn");
    const dashboardBtn = document.getElementById("dashboardBtn");
    const message = document.getElementById("message");

    saveBtn.addEventListener("click", async () => {
        const company = document.getElementById("company").value.trim();
        const jobTitle = document.getElementById("jobTitle").value.trim();
        const status = document.getElementById("status").value;
        const notes = document.getElementById("notes").value.trim();

        if (!company || !jobTitle) {
            message.textContent = "Please enter company and job title.";
            message.style.color = "red";
            return;
        }

        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const currentUrl = tabs[0]?.url || "";

        const newApplication = {
            id: Date.now(),
            applicationId: crypto.randomUUID(),
            company,
            jobTitle,
            status,
            notes,
            url: currentUrl,
            dateSubmitted: new Date().toISOString()
        };

        const result = await chrome.storage.local.get(["applications"]);
        const applications = result.applications || [];

        applications.push(newApplication);

        await chrome.storage.local.set({ applications });

        message.textContent = "Application saved!";
        message.style.color = "green";

        document.getElementById("company").value = "";
        document.getElementById("jobTitle").value = "";
        document.getElementById("notes").value = "";
        document.getElementById("status").value = "Submitted";
    });

    dashboardBtn.addEventListener("click", () => {
        chrome.tabs.create({
            url: chrome.runtime.getURL("dashboard.html")
        });
    });
});