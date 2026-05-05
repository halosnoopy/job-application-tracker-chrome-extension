chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: "save-job-application",
            title: "Job Extract for JAT",
            contexts: ["page"]
        });

        chrome.contextMenus.create({
            id: "open-job-dashboard",
            title: "Open Job Tracker Dashboard",
            contexts: ["action"]
        });
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "save-job-application" && tab?.id) {
        const popupUrl =
            chrome.runtime.getURL("popup.html") +
            `?tabId=${encodeURIComponent(tab.id)}&autoExtract=1`;

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

            chrome.windows.create({
                url: popupUrl,
                type: "popup",
                width,
                height,
                left,
                top,
                focused: true
            });
        });
    }

    if (info.menuItemId === "open-job-dashboard") {
        chrome.tabs.create({
            url: chrome.runtime.getURL("dashboard.html")
        });
    }
});
