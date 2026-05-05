let trackerPopupWindowId = null;

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

function openTrackerPopup(tab, params = {}) {
    if (!tab?.id) return;

    const popupParams = new URLSearchParams({
        tabId: String(tab.id),
        ...params
    });
    const popupUrl = `${chrome.runtime.getURL("popup.html")}?${popupParams.toString()}`;

    chrome.windows.get(tab.windowId, (sourceWindow) => {
        const width = 640;
        const height = 620;
        const left = Math.max(
            0,
            Math.round((sourceWindow.left || 0) + (sourceWindow.width || width) - width - 24)
        );
        const top = Math.max(
            0,
            Math.round((sourceWindow.top || 0) + 88)
        );

        function createTrackerPopup() {
            chrome.windows.create({
                url: popupUrl,
                type: "popup",
                width,
                height,
                left,
                top,
                focused: true
            }, (createdWindow) => {
                trackerPopupWindowId = createdWindow?.id || null;
            });
        }

        if (trackerPopupWindowId) {
            chrome.windows.remove(trackerPopupWindowId, () => {
                trackerPopupWindowId = null;
                createTrackerPopup();
            });
        } else {
            createTrackerPopup();
        }
    });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "save-job-application") {
        openTrackerPopup(tab, { autoExtract: "1" });
    }

    if (info.menuItemId === "jat-status-update") {
        openTrackerPopup(tab, { autoAiExtract: "1" });
    }

    if (info.menuItemId === "open-job-dashboard") {
        chrome.tabs.create({
            url: chrome.runtime.getURL("dashboard.html")
        });
    }
});

chrome.windows.onRemoved.addListener((windowId) => {
    if (windowId === trackerPopupWindowId) {
        trackerPopupWindowId = null;
    }
});
