chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: "save-job-application",
            title: "Job Extract for JAT",
            contexts: ["page"]
        });

        chrome.contextMenus.create({
            id: "jat-status-update",
            title: "JAT Status Update",
            contexts: ["page", "selection"]
        });

        chrome.contextMenus.create({
            id: "open-job-dashboard",
            title: "Open Job Tracker Dashboard",
            contexts: ["action"]
        });
    });
});

async function openTrackerPopup(tab, mode) {
    if (!tab?.id) return;

    await chrome.storage.session.set({
        jatPendingPopupAction: {
            tabId: tab.id,
            mode,
            createdAt: Date.now()
        }
    });

    if (chrome.action?.openPopup) {
        chrome.action.openPopup();
    }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "save-job-application") {
        openTrackerPopup(tab, "local");
    }

    if (info.menuItemId === "jat-status-update") {
        openTrackerPopup(tab, "ai");
    }

    if (info.menuItemId === "open-job-dashboard") {
        chrome.tabs.create({
            url: chrome.runtime.getURL("dashboard.html")
        });
    }
});
