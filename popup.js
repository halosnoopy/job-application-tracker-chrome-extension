const GEMINI_MODELS = [
    "gemini-3.1-flash-lite-preview",
    "gemini-2.5-flash-lite",
    "gemini-1.5-flash-8b"
];

document.addEventListener("DOMContentLoaded", async () => {
    const saveBtn = document.getElementById("saveBtn");
    const extractBtn = document.getElementById("extractBtn");
    const aiExtractBtn = document.getElementById("aiExtractBtn");
    const debugExtractBtn = document.getElementById("debugExtractBtn");
    const dashboardBtn = document.getElementById("dashboardBtn");
    const message = document.getElementById("message");
    const applicationDateInput = document.getElementById("applicationDate");
    const emailUpdatePanel = document.getElementById("emailUpdatePanel");
    const emailUpdateSummary = document.getElementById("emailUpdateSummary");
    const emailMatchSelect = document.getElementById("emailMatchSelect");
    const emailStatusSelect = document.getElementById("emailStatusSelect");
    const emailStatusDate = document.getElementById("emailStatusDate");
    const emailStatusNote = document.getElementById("emailStatusNote");
    const applyEmailUpdateBtn = document.getElementById("applyEmailUpdateBtn");
    const cancelEmailUpdateBtn = document.getElementById("cancelEmailUpdateBtn");
    const popupParams = new URLSearchParams(window.location.search);
    let sourceTabId = Number(popupParams.get("tabId"));
    let shouldAutoExtract = popupParams.get("autoExtract") === "1";
    let shouldAutoAiExtract = popupParams.get("autoAiExtract") === "1";
    let pendingEmailUpdate = null;

    const pendingPopupAction = await consumePendingPopupAction();
    if (pendingPopupAction) {
        sourceTabId = Number(pendingPopupAction.tabId);
        shouldAutoExtract = pendingPopupAction.mode === "local";
        shouldAutoAiExtract = pendingPopupAction.mode === "ai";
    }

    applicationDateInput.value = new Date().toISOString().slice(0, 10);
    emailStatusDate.value = new Date().toISOString().slice(0, 10);

    function getTextLength(value) {
        return JSON.stringify(value || "").length;
    }

    function getExtractionScore(result) {
        if (!result) return 0;

        let score = 0;
        if (result.company) score += 1000;
        if (result.jobTitle) score += 1000;
        if (result.platform) score += 100;
        score += getTextLength(result.company) + getTextLength(result.jobTitle);
        return score;
    }

    function getPageInfoScore(result) {
        if (!result) return 0;

        const candidates = result.candidates || {};
        let score = getTextLength(result.selectedPanelText);

        ["linkedinCard", "linkedin", "jsonLd", "dom", "title"].forEach((key) => {
            if (candidates[key]?.company) score += 700;
            if (candidates[key]?.jobTitle) score += 700;
        });

        return score;
    }

    function pickBestScriptResult(results, scoreResult) {
        return (results || [])
            .map((entry) => entry.result || {})
            .sort((a, b) => scoreResult(b) - scoreResult(a))[0] || {};
    }

    function repairLinkedInFrameUrl(result, tabUrl) {
        if (!result || !tabUrl?.includes("linkedin.com")) {
            return result;
        }

        const url = result.url || "";
        const cleanUrl = result.cleanUrl || "";

        if (url.includes("/preload/") || cleanUrl.includes("/preload/")) {
            const repairedUrl = normalizeSavedUrl(tabUrl);
            return {
                ...result,
                url: repairedUrl,
                cleanUrl: repairedUrl
            };
        }

        return result;
    }

    function cleanComparable(value) {
        return String(value || "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, " ")
            .replace(/\b(inc|llc|ltd|corp|corporation|company|the|and|role|job|position|opening)\b/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function escapeHtml(value) {
        return String(value || "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function dateInputValue(value) {
        const date = new Date(value);
        return isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10);
    }

    function tokenOverlapScore(a, b) {
        const aTokens = new Set(cleanComparable(a).split(" ").filter((token) => token.length > 2));
        const bTokens = new Set(cleanComparable(b).split(" ").filter((token) => token.length > 2));

        if (aTokens.size === 0 || bTokens.size === 0) return 0;

        const overlap = [...aTokens].filter((token) => bTokens.has(token)).length;
        return overlap / Math.max(aTokens.size, bTokens.size);
    }

    function getStageForStatus(status) {
        if (status === "Submitted") return "Applied";
        if (status === "HR Reachout" || status === "Phone Screen") return "Contact";
        if (status === "Interview" || status === "Final Interview") return "Interview";
        if (status === "Offer" || status === "Rejected" || status === "Withdrawn") return "Decision";
        return "Applied";
    }

    function normalizeDate(value, fallback = new Date().toISOString()) {
        const date = new Date(value);
        return isNaN(date.getTime()) ? fallback : date.toISOString();
    }

    function optionalIsoDate(value) {
        const date = new Date(value);
        return isNaN(date.getTime()) ? "" : date.toISOString();
    }

    function sortStatusHistory(history) {
        return [...(history || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    function normalizeApplication(app) {
        const dateSubmitted = normalizeDate(app.dateSubmitted || app.createdAt);
        let history = Array.isArray(app.statusHistory) ? app.statusHistory : [];

        if (history.length === 0) {
            history = [
                {
                    status: app.status || "Submitted",
                    date: dateSubmitted,
                    note: app.schemaVersion ? "" : "Migrated from previous version"
                }
            ];
        }

        history = sortStatusHistory(history.map((event) => ({
            status: event.status || app.status || "Submitted",
            date: normalizeDate(event.date || dateSubmitted, dateSubmitted),
            note: event.note || ""
        })));

        return {
            ...app,
            id: app.id || Date.now() + Math.random(),
            applicationId: app.applicationId || crypto.randomUUID(),
            dateSubmitted,
            statusHistory: history,
            status: history[history.length - 1]?.status || app.status || "Submitted",
            lastUpdated: history[history.length - 1]?.date || dateSubmitted,
            schemaVersion: 4
        };
    }

    function scoreApplicationMatch(app, update) {
        let score = 0;
        const appCompany = cleanComparable(app.company);
        const updateCompany = cleanComparable(update.company);
        const appTitle = cleanComparable(app.jobTitle);
        const updateTitle = cleanComparable(update.jobTitle);

        if (appCompany && updateCompany && appCompany === updateCompany) score += 50;
        else if (appCompany && updateCompany && (appCompany.includes(updateCompany) || updateCompany.includes(appCompany))) score += 30;

        const titleOverlap = tokenOverlapScore(appTitle, updateTitle);
        if (titleOverlap >= 0.8) score += 45;
        else if (titleOverlap >= 0.5) score += 30;
        else if (titleOverlap >= 0.25) score += 15;

        if (!["Offer", "Rejected", "Withdrawn"].includes(app.status)) score += 15;
        else score -= 25;

        const appliedDate = new Date(app.dateSubmitted);
        const statusDate = new Date(update.statusDate || new Date());

        if (!isNaN(appliedDate.getTime()) && !isNaN(statusDate.getTime())) {
            const ageDays = Math.round((Date.now() - appliedDate.getTime()) / 86400000);
            if (statusDate < appliedDate) score -= 50;
            if (ageDays <= 30) score += 10;
            else if (ageDays <= 90) score += 5;
            else score -= 5;
        }

        return score;
    }

    function matchApplications(applications, update) {
        return applications
            .map((app) => ({
                app: normalizeApplication(app),
                score: scoreApplicationMatch(normalizeApplication(app), update)
            }))
            .sort((a, b) => b.score - a.score);
    }

    function hideEmailUpdatePanel() {
        pendingEmailUpdate = null;
        emailUpdatePanel.style.display = "none";
    }

    function closePopupSoon(delay = 900) {
        setTimeout(() => {
            window.close();
        }, delay);
    }

    async function consumePendingPopupAction() {
        const result = await chrome.storage.session.get(["jatPendingPopupAction"]);
        const action = result.jatPendingPopupAction;

        if (!action) {
            return null;
        }

        await chrome.storage.session.remove(["jatPendingPopupAction"]);

        if (!action.createdAt || Date.now() - action.createdAt > 30000) {
            return null;
        }

        return action;
    }

    async function showEmailUpdatePanel(update) {
        const result = await chrome.storage.local.get(["applications"]);
        const applications = (result.applications || []).map(normalizeApplication);
        const matches = matchApplications(applications, update);

        pendingEmailUpdate = {
            ...update,
            applications
        };

        emailUpdateSummary.innerHTML = `
            <div><strong>Status:</strong> ${escapeHtml(update.status || "No status change")}</div>
            <div><strong>Company:</strong> ${escapeHtml(update.company || "Unknown")}</div>
            <div><strong>Job:</strong> ${escapeHtml(update.jobTitle || "Unknown")}</div>
            <div><strong>Contact:</strong> ${escapeHtml(update.contactName || "")} ${escapeHtml(update.contactEmail || "")}</div>
            <div><strong>Confidence:</strong> ${escapeHtml(update.confidence || "unknown")}</div>
        `;

        emailMatchSelect.innerHTML = `<option value="">Choose application...</option>` +
            matches.map(({ app, score }) => `
                <option value="${escapeHtml(app.applicationId || app.id)}">
                    ${escapeHtml(app.company || "Unknown")} - ${escapeHtml(app.jobTitle || "Unknown")} - ${escapeHtml(app.status || "Submitted")} (${score})
                </option>
            `).join("");

        if (matches[0]?.score >= 50) {
            emailMatchSelect.value = matches[0].app.applicationId || matches[0].app.id;
        }

        emailStatusSelect.value = update.status || "No status change";
        emailStatusDate.value = dateInputValue(update.statusDate || new Date().toISOString());
        emailStatusNote.value = update.note || "";
        emailUpdatePanel.style.display = "block";
    }

    async function getTargetTab() {
        if (Number.isInteger(sourceTabId) && sourceTabId > 0) {
            try {
                return await chrome.tabs.get(sourceTabId);
            } catch (error) {
                console.warn("Could not read source tab, falling back to active tab:", error);
            }
        }

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab;
    }

    async function runLocalExtraction() {
        message.textContent = "Extracting job details locally...";
        message.style.color = "#333";

        try {
            const tab = await getTargetTab();

            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id, allFrames: true },
                func: extractJobInfoFromPage
            });

            const extracted = repairLinkedInFrameUrl(
                pickBestScriptResult(results, getExtractionScore),
                tab.url
            );
            fillPopupForm(extracted, tab.url);

            message.textContent = "Local extraction complete. Please review before saving.";
            message.style.color = "green";
        } catch (error) {
            console.error(error);
            message.textContent = "Could not extract details locally.";
            message.style.color = "red";
        }
    }

    extractBtn.addEventListener("click", async () => {
        await runLocalExtraction();
    });

    async function runAiExtraction() {
        message.textContent = "Extracting job details with AI...";
        message.style.color = "#333";

        aiExtractBtn.disabled = true;
        aiExtractBtn.textContent = "AI Extracting...";
        extractBtn.disabled = true;
        saveBtn.disabled = true;

        try {
            const settings = await chrome.storage.local.get(["geminiApiKey"]);
            const geminiApiKey = (settings.geminiApiKey || "").trim();

            if (!geminiApiKey) {
                message.textContent = "Add your Gemini API key in dashboard Settings first.";
                message.style.color = "red";
                return;
            }

            const tab = await getTargetTab();

            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id, allFrames: true },
                func: collectCompactPageInfo
            });

            const pageInfo = repairLinkedInFrameUrl(
                pickBestScriptResult(results, getPageInfoScore),
                tab.url
            );
            const localResults = await chrome.scripting.executeScript({
                target: { tabId: tab.id, allFrames: true },
                func: extractJobInfoFromPage
            });

            pageInfo.localExtraction = repairLinkedInFrameUrl(
                pickBestScriptResult(localResults, getExtractionScore),
                tab.url
            );
            console.log("AI extraction page info:", pageInfo);
            const aiResult = await extractJobInfoWithGemini(pageInfo, geminiApiKey);
            console.log("AI extraction final result:", aiResult);

            if (aiResult.pageType === "email_message") {
                await showEmailUpdatePanel(aiResult);
                message.textContent = "AI detected an email update. Please review before applying.";
                message.style.color = "green";
                return;
            }

            fillPopupForm(aiResult, tab.url);

            message.textContent = "AI extraction complete. Please review before saving.";
            message.style.color = "green";
        } catch (error) {
            console.error("AI extraction error:", error);
            message.textContent = error.message || "AI extraction failed. Check console for details.";
            message.style.color = "red";
        } finally {
            aiExtractBtn.disabled = false;
            aiExtractBtn.textContent = "AI Extract";
            extractBtn.disabled = false;
            saveBtn.disabled = false;
        }
    }

    aiExtractBtn.addEventListener("click", runAiExtraction);

    /*
     * Debug Extract is intentionally inactive while the extension is in normal use.
     * To troubleshoot a new extraction failure, re-enable the button in popup.html.
     * This handler copies frame-by-frame candidates for Local/AI extraction so we
     * can see which DOM/title/meta source is being chosen.
     */
    debugExtractBtn?.addEventListener("click", async () => {
        message.textContent = "Collecting extraction debug info...";
        message.style.color = "#333";

        try {
            const tab = await getTargetTab();

            const pageInfoResults = await chrome.scripting.executeScript({
                target: { tabId: tab.id, allFrames: true },
                func: collectCompactPageInfo
            });

            const localResults = await chrome.scripting.executeScript({
                target: { tabId: tab.id, allFrames: true },
                func: extractJobInfoFromPage
            });

            const pageInfoFrames = (pageInfoResults || []).map((entry) => ({
                frameId: entry.frameId,
                score: getPageInfoScore(entry.result),
                result: entry.result
            }));

            const localFrames = (localResults || []).map((entry) => ({
                frameId: entry.frameId,
                score: getExtractionScore(entry.result),
                result: entry.result
            }));

            const debugInfo = {
                tabUrl: tab.url,
                chosenPageInfo: pickBestScriptResult(pageInfoResults, getPageInfoScore),
                chosenLocalExtraction: pickBestScriptResult(localResults, getExtractionScore),
                pageInfoSummary: pageInfoFrames.map((frame) => ({
                    frameId: frame.frameId,
                    score: frame.score,
                    selectedPanelPreview: String(frame.result?.selectedPanelText || "").slice(0, 500),
                    candidates: frame.result?.candidates || {}
                })),
                localSummary: localFrames.map((frame) => ({
                    frameId: frame.frameId,
                    score: frame.score,
                    result: frame.result
                })),
                pageInfoFrames,
                localFrames
            };

            await navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2));
            console.log("Extraction debug info:", debugInfo);

            message.textContent = "Debug info copied. Paste it into chat.";
            message.style.color = "green";
        } catch (error) {
            console.error("Debug extract error:", error);
            message.textContent = error.message || "Could not collect debug info.";
            message.style.color = "red";
        }
    });

    saveBtn.addEventListener("click", async () => {
        const company = document.getElementById("company").value.trim();
        const jobTitle = document.getElementById("jobTitle").value.trim();
        const platform = document.getElementById("platform").value;
        const status = document.getElementById("status").value;
        const notes = document.getElementById("notes").value.trim();
        const applicationDate = applicationDateInput.value || new Date().toISOString().slice(0, 10);
        const submittedAt = new Date(`${applicationDate}T12:00:00`).toISOString();

        if (!company || !jobTitle) {
            message.textContent = "Please enter company and job title.";
            message.style.color = "red";
            return;
        }

        const tab = await getTargetTab();
        const extractedUrlInput = document.getElementById("extractedUrl");

        let currentUrl =
            extractedUrlInput?.value ||
            tab?.url ||
            "";

        currentUrl = normalizeSavedUrl(currentUrl);

        const newApplication = {
            id: Date.now(),
            applicationId: crypto.randomUUID(),
            company,
            jobTitle,
            platform,
            status,
            notes,
            url: currentUrl,
            dateSubmitted: submittedAt,
            lastUpdated: submittedAt,
            schemaVersion: 4,
            statusHistory: [
                {
                    status,
                    date: submittedAt,
                    note: notes ? "Initial save: " + notes : "Initial save"
                }
            ]
        };

        const result = await chrome.storage.local.get(["applications"]);
        const applications = result.applications || [];

        const duplicateByUrl = applications.find((app) => {
            const savedUrl = normalizeSavedUrl(app.url || "");
            return savedUrl && currentUrl && savedUrl === currentUrl;
        });

        if (duplicateByUrl) {
            const applyAgain = confirm(
                "You have applied to this job. Do you want to apply it again?"
            );

            if (!applyAgain) {
                message.textContent = "Duplicate job was not saved.";
                message.style.color = "#666";

                document.getElementById("company").value = "";
                document.getElementById("jobTitle").value = "";
                document.getElementById("notes").value = "";
                document.getElementById("platform").value = "LinkedIn";
                document.getElementById("status").value = "Submitted";
                applicationDateInput.value = new Date().toISOString().slice(0, 10);

                if (extractedUrlInput) {
                    extractedUrlInput.value = "";
                }

                return;
            }
        }

        applications.push(newApplication);

        await chrome.storage.local.set({ applications });

        message.textContent = "Application saved!";
        message.style.color = "green";

        document.getElementById("company").value = "";
        document.getElementById("jobTitle").value = "";
        document.getElementById("notes").value = "";
        document.getElementById("platform").value = "LinkedIn";
        document.getElementById("status").value = "Submitted";
        applicationDateInput.value = new Date().toISOString().slice(0, 10);

        if (extractedUrlInput) {
            extractedUrlInput.value = "";
        }

        if (shouldAutoExtract) {
            closePopupSoon();
        }
    });

    dashboardBtn.addEventListener("click", () => {
        chrome.tabs.create({
            url: chrome.runtime.getURL("dashboard.html")
        });
    });

    cancelEmailUpdateBtn.addEventListener("click", hideEmailUpdatePanel);

    applyEmailUpdateBtn.addEventListener("click", async () => {
        if (!pendingEmailUpdate) {
            return;
        }

        if (emailStatusSelect.value === "No status change") {
            message.textContent = "No timeline update was applied.";
            message.style.color = "#666";
            hideEmailUpdatePanel();
            closePopupSoon();
            return;
        }

        const selectedId = emailMatchSelect.value;

        if (!selectedId) {
            message.textContent = "Choose the saved application to update.";
            message.style.color = "red";
            return;
        }

        const statusDate = normalizeDate(`${emailStatusDate.value || new Date().toISOString().slice(0, 10)}T12:00:00`);
        const note = emailStatusNote.value.trim() || pendingEmailUpdate.note || "Status update detected from email.";
        const nextEventDate = optionalIsoDate(pendingEmailUpdate.interviewDateTime);
        const shouldClearNextEvent = ["Offer", "Rejected", "Withdrawn"].includes(emailStatusSelect.value);
        const applications = pendingEmailUpdate.applications.map((app) => {
            const appKey = String(app.applicationId || app.id);

            if (appKey !== String(selectedId)) {
                return app;
            }

            const nextEventPatch = shouldClearNextEvent
                ? {
                    nextEventDate: "",
                    nextEventLabel: ""
                }
                : nextEventDate
                    ? {
                        nextEventDate,
                        nextEventLabel: emailStatusSelect.value
                    }
                    : {};

            return normalizeApplication({
                ...app,
                ...nextEventPatch,
                statusHistory: [
                    ...(app.statusHistory || []),
                    {
                        status: emailStatusSelect.value,
                        date: statusDate,
                        note
                    }
                ]
            });
        });

        await chrome.storage.local.set({ applications });
        message.textContent = "Application timeline updated from email.";
        message.style.color = "green";
        hideEmailUpdatePanel();
        closePopupSoon();
    });

    if (shouldAutoExtract) {
        await runLocalExtraction();
    }

    if (shouldAutoAiExtract) {
        await runAiExtraction();
    }
});

document.addEventListener("DOMContentLoaded", async () => {
    // button logic here
});

function normalizeSavedUrl(url) {
    if (!url) return "";

    if (!url.includes("linkedin.com")) {
        return url.trim();
    }

    try {
        const parsedUrl = new URL(url);

        const pathMatch = parsedUrl.pathname.match(/\/jobs\/view\/(\d+)/);
        if (pathMatch) {
            return `https://www.linkedin.com/jobs/view/${pathMatch[1]}`;
        }

        const jobId = parsedUrl.searchParams.get("currentJobId");
        if (jobId) {
            return `https://www.linkedin.com/jobs/view/${jobId}`;
        }
    } catch (e) {
        return url.trim();
    }

    return url.replace(/\/$/, "").trim();
}

function fillPopupForm(extracted, fallbackUrl) {
    document.getElementById("company").value = extracted.company || "";
    document.getElementById("jobTitle").value = extracted.jobTitle || "";

    if (extracted.platform) {
        const platformSelect = document.getElementById("platform");
        const hasOption = Array.from(platformSelect.options).some(
            (option) => option.value === extracted.platform
        );

        platformSelect.value = hasOption ? extracted.platform : "Company Website";
    }

    document.getElementById("notes").value = "";

    const extractedUrlInput = document.getElementById("extractedUrl");
    if (extractedUrlInput) {
        extractedUrlInput.value = extracted.url || fallbackUrl || "";
    }
}

async function extractJobInfoWithGemini(pageInfo, geminiApiKey) {
    const localCandidates = pageInfo.candidates || {};

    function buildAiPageInfo() {
        if (pageInfo.platform !== "LinkedIn") {
            return pageInfo;
        }

        return {
            url: pageInfo.url,
            cleanUrl: pageInfo.cleanUrl,
            hostname: pageInfo.hostname,
            platform: pageInfo.platform,
            pageTitle: pageInfo.pageTitle,
            selectedPanelText: pageInfo.selectedPanelText,
            candidates: {
                linkedinCard: localCandidates.linkedinCard || {},
                linkedin: localCandidates.linkedin || {},
                jsonLd: localCandidates.jsonLd || {},
                title: localCandidates.title || {}
            }
        };
    }

    const aiPageInfo = buildAiPageInfo();
    const maxOutputTokens = pageInfo.pageTypeHint === "email_message" ? 320 : 180;

    const prompt = `
Extract either a job posting or a job-application email update from this structured page data.

Rules:
- Use only values that appear in the provided data.
- First classify pageType as "job_posting", "email_message", or "unknown".
- Prefer selectedPanelText, emailMessage, and candidates over pageTitle.
- For LinkedIn pages, use the selected job panel/card only. Ignore profile/header text.
- Ignore recommended jobs, navigation, ads, and unrelated listings.
- For email pages, classify the application status from the currently opened email only.
- For email pages, ignore quoted old thread content when possible.
- Status must be one of: HR Reachout, Phone Screen, Interview, Final Interview, Offer, Rejected, Withdrawn, No status change.
- If a field is uncertain, return an empty string.
- Return JSON only.

JSON format:
{
  "pageType": "job_posting",
  "isJobPage": true,
  "isJobApplicationEmail": false,
  "company": "",
  "jobTitle": "",
  "platform": "",
  "status": "",
  "statusDate": "",
  "interviewDateTime": "",
  "contactName": "",
  "contactEmail": "",
  "note": "",
  "confidence": "low"
}

Page data:
${JSON.stringify(aiPageInfo)}
`;

    let data = null;
    let lastError = "";

    for (const model of GEMINI_MODELS) {
        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiApiKey)}`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        contents: [
                            {
                                parts: [{ text: prompt }]
                            }
                        ],
                        generationConfig: {
                            temperature: 0.1,
                            maxOutputTokens,
                            responseMimeType: "application/json"
                        }
                    })
                }
            );

            data = await response.json();

            if (response.ok) {
                console.log("Gemini model used:", model);
                break;
            }

            lastError = data.error?.message || "Request failed";
            console.warn(`Model failed: ${model}`, lastError);

        } catch (err) {
            lastError = err.message;
            console.warn(`Model crashed: ${model}`, err);
        }
    }

    if (!data?.candidates) {
        throw new Error(lastError || "All Gemini models failed.");
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log("Gemini raw response:", text);

    const cleanedText = text
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

    console.log("Gemini cleaned response:", cleanedText);
    // alert("Gemini returned:\n\n" + cleanedText.slice(0, 800));

    let parsed;

    try {
        parsed = JSON.parse(cleanedText);
    } catch (e) {
        const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);

        if (!jsonMatch) {
            console.error("No JSON found in Gemini response:", cleanedText);
            throw new Error("Gemini did not return valid JSON.");
        }

        try {
            parsed = JSON.parse(jsonMatch[0]);
        } catch (innerError) {
            console.error("Invalid JSON extracted from Gemini:", jsonMatch[0]);
            throw new Error("Failed to parse Gemini JSON response.");
        }
    }

    if (parsed.pageType === "email_message" || parsed.isJobApplicationEmail) {
        return {
            pageType: "email_message",
            isJobApplicationEmail: Boolean(parsed.isJobApplicationEmail),
            company: parsed.company || "",
            jobTitle: parsed.jobTitle || "",
            platform: pageInfo.platform || parsed.platform || "Email",
            status: parsed.status || "No status change",
            statusDate: parsed.statusDate || new Date().toISOString().slice(0, 10),
            interviewDateTime: parsed.interviewDateTime || "",
            contactName: parsed.contactName || "",
            contactEmail: parsed.contactEmail || pageInfo.emailMessage?.senderEmail || "",
            note: parsed.note || "",
            confidence: parsed.confidence || "low"
        };
    }

    function getAllowedEvidenceText() {
        if (pageInfo.platform !== "LinkedIn") {
            return JSON.stringify(aiPageInfo).toLowerCase();
        }

        return JSON.stringify(aiPageInfo).toLowerCase();
    }

    const allowedEvidenceText = getAllowedEvidenceText();

    function appearsInAllowedEvidence(value) {
        const normalized = String(value || "").trim().toLowerCase();
        return !normalized || allowedEvidenceText.includes(normalized);
    }

    function isBadCompanyValue(value) {
        const normalized = String(value || "").trim().toLowerCase();

        return (
            !normalized ||
            normalized === "linkedin" ||
            normalized === "show more options" ||
            normalized === "show more" ||
            normalized === "more" ||
            normalized === "share" ||
            normalized === "apply" ||
            normalized === "save" ||
            normalized.includes("with verification") ||
            normalized.includes("reactivate premium") ||
            normalized.includes("show match details") ||
            normalized.includes("tailor my resume") ||
            normalized.includes("help me stand out") ||
            normalized.includes("how your profile") ||
            normalized.includes("jobs based on your preferences") ||
            normalized.includes("top job picks") ||
            normalized.includes("how promoted jobs are ranked") ||
            normalized.includes("easy apply")
        );
    }

    function isBadJobTitleValue(value) {
        const normalized = String(value || "").trim().toLowerCase();

        return (
            !normalized ||
            normalized.includes("jobs based on your preferences") ||
            normalized.includes("top job picks") ||
            normalized.includes(" or ") && normalized.includes(" in ")
        );
    }

    function firstCandidateValue(field) {
        const priority =
            pageInfo.platform === "LinkedIn"
                ? ["linkedinCard", "linkedin", "jsonLd", "title", "localExtraction", "dom"]
                : ["jsonLd", "dom", "linkedin", "title"];

        for (const source of priority) {
            const candidate =
                source === "localExtraction" ? pageInfo.localExtraction : localCandidates[source];
            const value = candidate?.[field];
            if (field === "company" && isBadCompanyValue(value)) continue;
            if (field === "jobTitle" && isBadJobTitleValue(value)) continue;
            if (value) return value;
        }

        return "";
    }

    const fallbackCompany = firstCandidateValue("company");
    const fallbackJobTitle = firstCandidateValue("jobTitle");

    if (!parsed.isJobPage && !fallbackCompany && !fallbackJobTitle) {
        throw new Error("Gemini did not detect a job page.");
    }

    let company = fallbackCompany;
    let jobTitle = fallbackJobTitle;

    if (
        parsed.company &&
        appearsInAllowedEvidence(parsed.company) &&
        !isBadCompanyValue(parsed.company)
    ) {
        company = parsed.company;
    }

    if (
        parsed.jobTitle &&
        appearsInAllowedEvidence(parsed.jobTitle) &&
        !isBadJobTitleValue(parsed.jobTitle)
    ) {
        jobTitle = parsed.jobTitle;
    }

    return {
        company,
        jobTitle,
        platform: parsed.platform || pageInfo.platform || "Company Website",
        url: pageInfo.cleanUrl || pageInfo.url || ""
    };
}

function collectCompactPageInfo() {
    const url = window.location.href;
    const hostname = window.location.hostname.toLowerCase();
    const title = document.title || "";

    function cleanText(text) {
        return (text || "").replace(/\s+/g, " ").trim();
    }

    function cleanLines(text) {
        return (text || "")
            .split("\n")
            .map(cleanText)
            .filter(Boolean);
    }

    function compactText(text, maxLength) {
        return cleanText(text).slice(0, maxLength);
    }

    function collectDeepRoots(root = document) {
        const roots = [root];
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);

        while (walker.nextNode()) {
            const node = walker.currentNode;
            if (node.shadowRoot) {
                roots.push(...collectDeepRoots(node.shadowRoot));
            }
        }

        return roots;
    }

    function deepQuerySelector(selector) {
        for (const root of collectDeepRoots()) {
            const element = root.querySelector?.(selector);
            if (element) return element;
        }

        return null;
    }

    function deepQuerySelectorAll(selector) {
        return collectDeepRoots().flatMap((root) =>
            Array.from(root.querySelectorAll?.(selector) || [])
        );
    }

    function isJobTitleLine(line) {
        return /engineer|scientist|analyst|associate|developer|manager|intern|consultant|specialist|architect|researcher|trainer|designer|product|data|machine learning|ai\b|compiler/i.test(line || "");
    }

    function looksLikeCompanyName(value) {
        const normalized = cleanText(value);
        const lower = normalized.toLowerCase();

        if (!normalized || normalized.length > 80) return false;
        if (/^(remote|hybrid|on-site|full-time|contract|part-time)$/i.test(normalized)) return false;
        if (/^(share|more|show more|show more options|apply|save)$/i.test(normalized)) return false;
        if (/^(modeling|data|analytics|machine learning|ai|computer vision|nlp|llm|software|backend|frontend|platform|infrastructure)$/i.test(normalized)) return false;
        if (/engineer|scientist|analyst|associate|developer|manager|intern|consultant|specialist|architect|researcher|trainer|designer|product/i.test(normalized)) return false;
        if (lower.includes("with verification")) return false;
        if (lower.includes("how promoted jobs are ranked")) return false;

        return true;
    }

    function getDeepBodyText() {
        return collectDeepRoots()
            .map((root) => root.body?.innerText || root.host?.innerText || root.textContent || "")
            .join("\n");
    }

    function detectPlatform() {
        if (hostname.includes("mail.google.com")) return "Gmail";
        if (hostname.includes("outlook.live.com") || hostname.includes("outlook.office.com")) return "Outlook";
        if (hostname.includes("linkedin.com")) return "LinkedIn";
        if (hostname.includes("myworkdayjobs.com")) return "Workday";
        if (hostname.includes("greenhouse.io")) return "Greenhouse";
        if (hostname.includes("lever.co")) return "Lever";
        if (hostname.includes("indeed.com")) return "Indeed";
        if (hostname.includes("ashbyhq.com")) return "Ashby";
        if (hostname.includes("jobs.gem.com")) return "Gem";
        return "Company Website";
    }

    function extractEmailMessageCandidate() {
        const isGmail = hostname.includes("mail.google.com");
        const isOutlook = hostname.includes("outlook.live.com") || hostname.includes("outlook.office.com");

        if (!isGmail && !isOutlook) {
            return null;
        }

        const selectionText = cleanText(window.getSelection?.().toString() || "");
        const subject =
            cleanText(deepQuerySelector("h2.hP")?.innerText) ||
            cleanText(deepQuerySelector("[role='heading']")?.innerText) ||
            cleanText(deepQuerySelector("[aria-label='Subject']")?.innerText) ||
            title;
        const senderElement =
            deepQuerySelector(".gD[email]") ||
            deepQuerySelector("span[email]") ||
            deepQuerySelector("[data-hovercard-id]");
        const senderEmail =
            cleanText(senderElement?.getAttribute?.("email")) ||
            cleanText(senderElement?.getAttribute?.("data-hovercard-id"));
        const senderName = cleanText(senderElement?.innerText);
        const receivedDateText =
            cleanText(deepQuerySelector(".g3")?.getAttribute?.("title")) ||
            cleanText(deepQuerySelector(".g3")?.innerText) ||
            cleanText(deepQuerySelector("time")?.getAttribute?.("datetime")) ||
            cleanText(deepQuerySelector("time")?.innerText);

        const bodySelectors = isGmail
            ? ["div.a3s.aiL", "div.a3s", "[role='main']"]
            : ["[role='document']", "[aria-label='Message body']", "[role='main']"];

        const bodyText = bodySelectors
            .flatMap((selector) => deepQuerySelectorAll(selector))
            .map((element) => element.innerText || "")
            .filter(Boolean)
            .join("\n")
            .replace(/\nOn .* wrote:[\s\S]*/i, "")
            .replace(/\nFrom:.*\nSent:.*\nTo:.*[\s\S]*/i, "");

        return {
            pageTypeHint: "email_message",
            platform: isGmail ? "Gmail" : "Outlook",
            subject,
            senderName,
            senderEmail,
            receivedDateText,
            selectedText: compactText(selectionText, 3000),
            bodyText: compactText(selectionText || bodyText, 6000)
        };
    }

    function getCleanLinkedInUrl() {
        if (!hostname.includes("linkedin.com")) {
            return url;
        }

        try {
            const parsedUrl = new URL(url);

            const pathMatch = parsedUrl.pathname.match(/\/jobs\/view\/(\d+)/);
            if (pathMatch) {
                return `https://www.linkedin.com/jobs/view/${pathMatch[1]}`;
            }

            const jobId = parsedUrl.searchParams.get("currentJobId");

            if (jobId) {
                return `https://www.linkedin.com/jobs/view/${jobId}`;
            }
        } catch (e) {
            return url;
        }

        return url;
    }

    function getLinkedInJobId() {
        if (!hostname.includes("linkedin.com")) {
            return "";
        }

        try {
            const parsedUrl = new URL(url);
            const pathMatch = parsedUrl.pathname.match(/\/jobs\/view\/(\d+)/);
            return pathMatch?.[1] || parsedUrl.searchParams.get("currentJobId") || "";
        } catch (e) {
            return "";
        }
    }

    function getMetaContent(selector) {
        return cleanText(document.querySelector(selector)?.getAttribute("content"));
    }

    function parseTitleForJob() {
        const linkedInTitle = title.replace(/\s*\|\s*LinkedIn\s*$/i, "").trim();

        if (hostname.includes("linkedin.com") && linkedInTitle.includes("|")) {
            const parts = linkedInTitle
                .split("|")
                .map(cleanText)
                .filter(Boolean);

            if (parts.length >= 2 && looksLikeCompanyName(parts[parts.length - 1])) {
                return {
                    jobTitle: parts.slice(0, -1).join(" | "),
                    company: parts[parts.length - 1]
                };
            }

            return {
                jobTitle: linkedInTitle,
                company: ""
            };
        }

        if (hostname.includes("lever.co") && title.includes(" - ")) {
            const [companyPart, ...jobParts] = title.split(" - ");
            const company = cleanText(companyPart);
            const jobTitle = cleanText(jobParts.join(" - "));

            if (company && jobTitle) {
                return {
                    jobTitle,
                    company
                };
            }
        }

        if (hostname.includes("greenhouse.io")) {
            const greenhouseMatch = title.match(/^Job Application for\s+(.+?)\s+at\s+(.+)$/i);

            if (greenhouseMatch) {
                return {
                    jobTitle: cleanText(greenhouseMatch[1]),
                    company: cleanText(greenhouseMatch[2])
                };
            }
        }

        if (hostname.includes("greenhouse.io")) {
            const greenhouseMatch = title.match(/^Job Application for\s+(.+?)\s+at\s+(.+)$/i);

            if (greenhouseMatch) {
                jobTitle = cleanText(greenhouseMatch[1]);
                company = cleanText(greenhouseMatch[2]);
            }
        }

        const patterns = [
            /(.+?)\s+at\s+(.+?)(\||-|$)/i,
            /(.+?)\s+-\s+(.+?)(\||$)/i
        ];

        for (const pattern of patterns) {
            const match = title.match(pattern);

            if (match && looksLikeCompanyName(match[2])) {
                return {
                    jobTitle: cleanText(match[1]),
                    company: cleanText(match[2])
                };
            }
        }

        return {};
    }

    function extractJsonLdCandidate() {
        const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));

        for (const script of scripts) {
            try {
                const data = JSON.parse(script.textContent);
                const items = Array.isArray(data) ? data : [data];

                for (const item of items) {
                    if (item["@type"] === "JobPosting") {
                        return {
                            jobTitle: cleanText(item.title),
                            company: cleanText(item.hiringOrganization?.name)
                        };
                    }
                }
            } catch (e) {
                continue;
            }
        }

        return {};
    }

    function extractDomCandidate() {
        const companySelectors = [
            ".topcard__org-name-link",
            ".topcard__flavor",
            ".job-details-jobs-unified-top-card__company-name",
            "[data-automation-id='jobPostingCompany']",
            "[data-qa='posting-name']",
            ".posting-company",
            ".company-name"
        ];

        let company = "";

        for (const selector of companySelectors) {
            company = cleanText(deepQuerySelector(selector)?.innerText);
            if (company) break;
        }

        return {
            jobTitle: cleanText(deepQuerySelector("h1")?.innerText),
            company
        };
    }

    function extractLinkedInCandidate(panelText) {
        if (!hostname.includes("linkedin.com")) {
            return {};
        }

        function isBadLine(line) {
            const lower = line.toLowerCase();
            return (
                lower === "linkedin" ||
                lower.includes("describe the job you want") ||
                lower.includes("reactivate premium") ||
                lower === "show more options" ||
                lower === "show more" ||
                lower === "more" ||
                lower === "share" ||
                lower.includes("how your profile") ||
                lower.includes("show match details") ||
                lower.includes("tailor my resume") ||
                lower.includes("help me stand out") ||
                lower.includes("easy apply") ||
                lower === "apply" ||
                lower === "save" ||
                lower === "promoted" ||
                lower.startsWith("promoted by") ||
                lower.includes("notification") ||
                lower.includes("messaging")
            );
        }

        function looksLikeLocationOrMeta(line) {
            return (
                /\b(remote|hybrid|on-site|applicants?|clicked apply|week|weeks|day|days|hour|hours)\b/i.test(line) ||
                /\$[\d,.]+/.test(line) ||
                /\b[A-Z][a-z]+,\s*[A-Z]{2}\b/.test(line)
            );
        }

        function findCompanyBefore(lines, titleIndex) {
            for (let i = titleIndex - 1; i >= Math.max(0, titleIndex - 4); i--) {
                const candidate = lines[i];

                if (
                    candidate &&
                    !isBadLine(candidate) &&
                    !looksLikeLocationOrMeta(candidate) &&
                    candidate.length <= 80
                ) {
                    return candidate;
                }
            }

            return "";
        }

        const panelTitle = cleanText(linkedinDetailPanel?.querySelector("h1")?.innerText);
        const lines = cleanLines(panelText).filter((line) => !isBadLine(line));

        let titleIndex = panelTitle
            ? lines.findIndex((line) => line === panelTitle)
            : -1;

        if (titleIndex === -1) {
            titleIndex = lines.findIndex(isJobTitleLine);
        }

        if (titleIndex === -1) {
            return {};
        }

        return {
            jobTitle: panelTitle || lines[titleIndex],
            company: findCompanyBefore(lines, titleIndex)
        };
    }

    function extractLinkedInSelectedCardCandidate() {
        const jobId = getLinkedInJobId();

        if (!hostname.includes("linkedin.com")) {
            return {};
        }

        function uniqueElements(elements) {
            return [...new Set(elements.filter(Boolean))];
        }

        function getCardLines(card) {
            return cleanLines(card?.innerText).filter((line) => {
                const lower = line.toLowerCase();
                return (
                    lower !== "easy apply" &&
                    lower !== "promoted" &&
                    lower !== "more" &&
                    lower !== "show more options" &&
                    !lower.includes("viewed") &&
                    !lower.includes("actively reviewing") &&
                    !lower.includes("company alumni") &&
                    !lower.includes("jobs based on your preferences") &&
                    !lower.includes("top job picks")
                );
            });
        }

        function scoreCard(card) {
            const text = cleanText(card?.innerText).toLowerCase();
            const className = String(card?.className || "").toLowerCase();
            const ariaCurrent = card?.getAttribute?.("aria-current");
            const ariaSelected = card?.getAttribute?.("aria-selected");
            const panelTitle = cleanText(linkedinDetailPanel?.querySelector("h1")?.innerText);

            let score = 0;

            if (jobId && card.querySelector?.(`a[href*="${jobId}"]`)) score += 1000;
            if (ariaCurrent === "true" || ariaCurrent === "page") score += 800;
            if (ariaSelected === "true") score += 800;
            if (/active|selected|current/.test(className)) score += 700;
            if (panelTitle && text.includes(panelTitle.toLowerCase())) score += 400;
            if (isJobTitleLine(text)) {
                score += 100;
            }

            return score;
        }

        const selectedJobLink = jobId ? deepQuerySelector(`a[href*="${jobId}"]`) : null;
        const selectedCardFromJobId =
            selectedJobLink?.closest("li") ||
            selectedJobLink?.closest(".job-card-container") ||
            selectedJobLink?.closest(".jobs-search-results__list-item") ||
            selectedJobLink?.closest("div");

        const cardCandidates = uniqueElements([
            selectedCardFromJobId,
            ...deepQuerySelectorAll("[aria-current='true']"),
            ...deepQuerySelectorAll("[aria-current='page']"),
            ...deepQuerySelectorAll("[aria-selected='true']"),
            ...deepQuerySelectorAll(".jobs-search-results__list-item--active"),
            ...deepQuerySelectorAll(".jobs-search-results__list-item--selected"),
            ...deepQuerySelectorAll(".job-card-container--active"),
            ...deepQuerySelectorAll(".job-card-container--selected"),
            ...deepQuerySelectorAll("[data-job-id]"),
            ...deepQuerySelectorAll("[data-occludable-job-id]"),
            ...deepQuerySelectorAll(".job-card-container"),
            ...deepQuerySelectorAll(".jobs-search-results__list-item")
        ]);

        const selectedCard = cardCandidates
            .map((card) => ({ card, score: scoreCard(card) }))
            .filter(({ score }) => score > 0)
            .sort((a, b) => b.score - a.score)[0]?.card;

        if (!selectedCard) {
            return {};
        }

        const lines = getCardLines(selectedCard);

        const titleIndex = lines.findIndex(isJobTitleLine);

        if (titleIndex === -1) {
            return {};
        }

        return {
            jobTitle: lines[titleIndex],
            company: lines[titleIndex + 1] || ""
        };
    }

    const platform = detectPlatform();
    const emailMessage = extractEmailMessageCandidate();

    if (emailMessage) {
        return {
            url,
            cleanUrl: url,
            hostname,
            platform,
            pageTitle: title,
            pageTypeHint: "email_message",
            emailMessage,
            selectedPanelText: emailMessage.bodyText,
            candidates: {}
        };
    }

    const cleanUrl = getCleanLinkedInUrl();

    const h1Text = Array.from(deepQuerySelectorAll("h1"))
        .map((el) => cleanText(el.innerText))
        .filter(Boolean)
        .slice(0, 5);

    const h2Text = Array.from(deepQuerySelectorAll("h2"))
        .map((el) => cleanText(el.innerText))
        .filter(Boolean)
        .slice(0, 8);

    const metaDescription =
        getMetaContent('meta[name="description"]') ||
        getMetaContent('meta[property="og:description"]');

    const ogTitle = getMetaContent('meta[property="og:title"]');

    function findLinkedInDetailPanelByHeading() {
        if (!hostname.includes("linkedin.com")) {
            return null;
        }

        const headings = [...deepQuerySelectorAll("h1"), ...deepQuerySelectorAll("h2")]
            .filter((heading) => isJobTitleLine(cleanText(heading.innerText)));

        for (const heading of headings) {
            let current = heading.parentElement;

            for (let depth = 0; current && depth < 8; depth++) {
                const text = cleanText(current.innerText);

                if (
                    text.includes(cleanText(heading.innerText)) &&
                    /\b(apply|easy apply|save|about the job|profile and resume|applicants?)\b/i.test(text)
                ) {
                    return current;
                }

                current = current.parentElement;
            }
        }

        return null;
    }

    const linkedinDetailPanel =
        deepQuerySelector(".jobs-search__job-details--container") ||
        deepQuerySelector(".scaffold-layout__detail") ||
        deepQuerySelector(".job-view-layout") ||
        deepQuerySelector(".jobs-details") ||
        deepQuerySelector(".jobs-details__main-content") ||
        deepQuerySelector(".job-details-jobs-unified-top-card") ||
        findLinkedInDetailPanelByHeading();

    const rawSelectedPanelText =
        linkedinDetailPanel?.innerText ||
        (hostname.includes("linkedin.com") ? "" : deepQuerySelector("main")?.innerText) ||
        (hostname.includes("linkedin.com") ? "" : getDeepBodyText());

    const selectedPanelText = compactText(rawSelectedPanelText, 1200);

    const candidates = {
        linkedinCard: extractLinkedInSelectedCardCandidate(),
        jsonLd: extractJsonLdCandidate(),
        dom: extractDomCandidate(),
        linkedin: extractLinkedInCandidate(rawSelectedPanelText),
        title: parseTitleForJob()
    };

    return {
        url,
        cleanUrl,
        hostname,
        platform,
        pageTitle: title,
        ogTitle,
        metaDescription,
        h1Text,
        h2Text,
        selectedPanelText,
        candidates
    };
}

function extractJobInfoFromPage() {
    const url = window.location.href;
    const hostname = window.location.hostname.toLowerCase();
    const title = document.title || "";

    function cleanText(text) {
        return (text || "").replace(/\s+/g, " ").trim();
    }

    function detectPlatform() {
        if (hostname.includes("linkedin.com")) return "LinkedIn";
        if (hostname.includes("myworkdayjobs.com")) return "Workday";
        if (hostname.includes("greenhouse.io")) return "Greenhouse";
        if (hostname.includes("lever.co")) return "Lever";
        if (hostname.includes("indeed.com")) return "Indeed";
        if (hostname.includes("ashbyhq.com")) return "Ashby";
        if (hostname.includes("jobs.gem.com")) return "Gem";
        return "Company Website";
    }

    function getCleanLinkedInUrl() {
        if (!hostname.includes("linkedin.com")) {
            return url;
        }

        try {
            const parsedUrl = new URL(url);

            const pathMatch = parsedUrl.pathname.match(/\/jobs\/view\/(\d+)/);
            if (pathMatch) {
                return `https://www.linkedin.com/jobs/view/${pathMatch[1]}`;
            }

            const jobId = parsedUrl.searchParams.get("currentJobId");

            if (jobId) {
                return `https://www.linkedin.com/jobs/view/${jobId}`;
            }
        } catch (e) {
            return url;
        }

        return url;
    }

    function extractFromLever() {
        if (!hostname.includes("lever.co")) {
            return {};
        }

        function companyFromUrl() {
            const parts = hostname.split(".");
            const subdomain = parts[0];

            if (subdomain && subdomain !== "jobs" && subdomain !== "www") {
                return subdomain;
            }

            try {
                const parsedUrl = new URL(url);
                const pathCompany = parsedUrl.pathname.split("/").filter(Boolean)[0];
                return pathCompany || "";
            } catch (e) {
                return "";
            }
        }

        function normalizeCompanyName(value) {
            const knownCompanies = {
                zoox: "Zoox"
            };

            const normalized = cleanText(value).toLowerCase();
            return knownCompanies[normalized] || cleanText(value);
        }

        function parseLeverPageTitle() {
            const pageTitle = title.replace(/\s*\|\s*Lever\s*$/i, "").trim();

            if (!pageTitle.includes(" - ")) {
                return {};
            }

            const [companyPart, ...jobParts] = pageTitle.split(" - ");
            const company = cleanText(companyPart);
            const jobTitle = cleanText(jobParts.join(" - "));

            return {
                company,
                jobTitle
            };
        }

        function firstUsefulHeading(selector) {
            return Array.from(document.querySelectorAll(selector))
                .map((element) => cleanText(element.innerText))
                .find((text) =>
                    text &&
                    !/submit your application|resume\/cv|full name|pronouns|email|phone/i.test(text)
                ) || "";
        }

        const titleResult = parseLeverPageTitle();
        const jobTitle =
            cleanText(document.querySelector("h1")?.innerText) ||
            cleanText(document.querySelector(".posting-headline h2")?.innerText) ||
            cleanText(document.querySelector("[data-qa='posting-name']")?.innerText) ||
            firstUsefulHeading("h2") ||
            titleResult.jobTitle ||
            "";

        const company =
            cleanText(document.querySelector("[data-qa='company-name']")?.innerText) ||
            titleResult.company ||
            normalizeCompanyName(companyFromUrl());

        return {
            jobTitle,
            company,
            confidence: jobTitle && company ? "high" : "low"
        };
    }

    function extractFromGreenhouse() {
        if (!hostname.includes("greenhouse.io")) {
            return {};
        }

        function parseGreenhouseTitle() {
            const match = title.match(/^Job Application for\s+(.+?)\s+at\s+(.+)$/i);

            if (match) {
                return {
                    jobTitle: cleanText(match[1]),
                    company: cleanText(match[2])
                };
            }

            return {};
        }

        function companyFromUrl() {
            try {
                const parsedUrl = new URL(url);
                const parts = parsedUrl.pathname.split("/").filter(Boolean);
                return parts[0] || "";
            } catch (e) {
                return "";
            }
        }

        function normalizeCompanyName(value) {
            const knownCompanies = {
                ludorobotics: "Ludo Robotics"
            };

            const normalized = cleanText(value).toLowerCase();
            return knownCompanies[normalized] || cleanText(value);
        }

        const titleResult = parseGreenhouseTitle();
        const jobTitle =
            cleanText(document.querySelector("h1")?.innerText) ||
            cleanText(document.querySelector("[data-testid='job-title']")?.innerText) ||
            titleResult.jobTitle ||
            "";

        const company =
            titleResult.company ||
            cleanText(document.querySelector("[data-testid='company-name']")?.innerText) ||
            normalizeCompanyName(companyFromUrl());

        return {
            jobTitle,
            company,
            confidence: jobTitle && company ? "high" : "low"
        };
    }

    function extractFromLinkedIn() {
        if (!hostname.includes("linkedin.com")) {
            return {};
        }

        function isBadJobTitleLine(line) {
            const lower = line.toLowerCase();
            return (
                lower.includes("jobs based on your preferences") ||
                lower.includes("top job picks") ||
                (lower.includes(" or ") && lower.includes(" in "))
            );
        }

        function isBadCompanyLine(line) {
            const lower = line.toLowerCase();
            return (
                lower === "linkedin" ||
                lower === "show more options" ||
                lower === "show more" ||
                lower === "more" ||
                lower === "share" ||
                lower === "apply" ||
                lower === "save" ||
                lower.includes("with verification") ||
                lower.includes("reactivate premium") ||
                lower.includes("show match details") ||
                lower.includes("tailor my resume") ||
                lower.includes("help me stand out") ||
                lower.includes("how your profile") ||
                lower.includes("jobs based on your preferences") ||
                lower.includes("top job picks") ||
                lower.includes("how promoted jobs are ranked") ||
                lower.includes("easy apply") ||
                lower.includes("notification") ||
                lower.includes("messaging")
            );
        }

        function findCompanyBefore(lines, titleIndex) {
            for (let i = titleIndex - 1; i >= Math.max(0, titleIndex - 5); i--) {
                const candidate = lines[i];

                if (candidate && !isBadCompanyLine(candidate) && candidate.length <= 80) {
                    return candidate;
                }
            }

            return "";
        }

        let jobTitle = "";
        let company = "";

        let jobId = "";

        try {
            const parsedUrl = new URL(url);
            jobId = parsedUrl.searchParams.get("currentJobId") || "";
        } catch (e) {
            jobId = "";
        }

        const detailPanel =
            document.querySelector(".jobs-search__job-details--container") ||
            document.querySelector(".scaffold-layout__detail") ||
            document.querySelector(".job-view-layout") ||
            document.querySelector(".jobs-details");

        if (detailPanel) {
            const detailLines = detailPanel.innerText
                .split("\n")
                .map(cleanText)
                .filter(Boolean);

            const titleIndex = detailLines.findIndex((line) =>
                /engineer|scientist|analyst|associate|developer|manager|intern|consultant|specialist|architect|researcher/i.test(line) &&
                !isBadJobTitleLine(line)
            );

            if (titleIndex !== -1) {
                jobTitle = detailLines[titleIndex];
                company = findCompanyBefore(detailLines, titleIndex);
            }
        }

        if ((!jobTitle || !company) && jobId) {
            const selectedJobLink = document.querySelector(`a[href*="${jobId}"]`);
            const selectedCard = selectedJobLink?.closest("li") || selectedJobLink?.closest("div");

            if (selectedCard) {
                const cardLines = selectedCard.innerText
                    .split("\n")
                    .map(cleanText)
                    .filter(Boolean);

                if (!jobTitle) {
                    jobTitle = cardLines.find((line) =>
                        /engineer|scientist|analyst|associate|developer|manager|intern|consultant|specialist|architect|researcher/i.test(line)
                    ) || "";
                }

                if (!company && jobTitle) {
                    const titleIndex = cardLines.indexOf(jobTitle);

                    if (titleIndex !== -1 && cardLines[titleIndex + 1]) {
                        company = cardLines[titleIndex + 1];
                    }
                }
            }
        }

        if (!jobTitle || !company) {
            const blockedWords = [
                "notifications",
                "home",
                "my network",
                "messaging",
                "reactivate premium",
                "easy apply",
                "save",
                "show match details",
                "people you can reach out to"
            ];

            const cleanLines = document.body.innerText
                .split("\n")
                .map(cleanText)
                .filter(Boolean)
                .filter((line) => {
                    const lower = line.toLowerCase();
                    return !blockedWords.some((word) => lower.includes(word));
                });

            const titleIndex = cleanLines.findIndex((line) =>
                /engineer|scientist|analyst|associate|developer|manager|intern|consultant|specialist|architect|researcher/i.test(line) &&
                !isBadJobTitleLine(line)
            );

            if (titleIndex !== -1) {
                jobTitle = jobTitle || cleanLines[titleIndex];

                if (!company && titleIndex > 0) {
                    const candidate = cleanLines[titleIndex - 1];
                    if (!isBadCompanyLine(candidate)) {
                        company = candidate;
                    }
                }
            }
        }

        return {
            jobTitle,
            company,
            confidence: jobTitle && company ? "high" : "low"
        };
    }

    function extractFromJsonLd() {
        const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));

        for (const script of scripts) {
            try {
                const data = JSON.parse(script.textContent);
                const items = Array.isArray(data) ? data : [data];

                for (const item of items) {
                    if (item["@type"] === "JobPosting") {
                        return {
                            jobTitle: cleanText(item.title),
                            company: cleanText(item.hiringOrganization?.name),
                            confidence: "high"
                        };
                    }
                }
            } catch (e) {
                continue;
            }
        }

        return {};
    }

    function extractFromDom() {
        const h1 = cleanText(document.querySelector("h1")?.innerText);
        const h2 = cleanText(document.querySelector("h2")?.innerText);

        const selectors = [
            ".topcard__org-name-link",
            ".topcard__flavor",
            ".job-details-jobs-unified-top-card__company-name",
            "[data-automation-id='jobPostingCompany']",
            "[data-qa='posting-name']",
            ".posting-company",
            ".company-name"
        ];

        let company = "";

        for (const selector of selectors) {
            company = cleanText(document.querySelector(selector)?.innerText);
            if (company) break;
        }

        return {
            jobTitle: h1 || "",
            company: company || h2 || "",
            confidence: h1 && company ? "medium" : "low"
        };
    }

    function extractFromTitle() {
        let jobTitle = "";
        let company = "";

        function looksLikeCompanyName(value) {
            const normalized = cleanText(value);
            const lower = normalized.toLowerCase();

            if (!normalized || normalized.length > 80) return false;
            if (/^(remote|hybrid|on-site|full-time|contract|part-time)$/i.test(normalized)) return false;
            if (/^(share|more|show more|show more options|apply|save)$/i.test(normalized)) return false;
            if (/^(modeling|data|analytics|machine learning|ai|computer vision|nlp|llm|software|backend|frontend|platform|infrastructure)$/i.test(normalized)) return false;
            if (/engineer|scientist|analyst|associate|developer|manager|intern|consultant|specialist|architect|researcher|trainer|designer|product|compiler/i.test(normalized)) return false;
            if (lower.includes("with verification")) return false;
            if (lower.includes("how promoted jobs are ranked")) return false;

            return true;
        }

        const linkedInTitle = title.replace(/\s*\|\s*LinkedIn\s*$/i, "").trim();

        if (hostname.includes("linkedin.com") && linkedInTitle.includes("|")) {
            const parts = linkedInTitle
                .split("|")
                .map(cleanText)
                .filter(Boolean);

            if (parts.length >= 2 && looksLikeCompanyName(parts[parts.length - 1])) {
                jobTitle = parts.slice(0, -1).join(" | ");
                company = parts[parts.length - 1];
            } else {
                jobTitle = linkedInTitle;
            }
        }

        const patterns = [
            /(.+?)\s+at\s+(.+?)(\||-|$)/i,
            /(.+?)\s+-\s+(.+?)(\||$)/i
        ];

        if (!jobTitle || !company) {
            for (const pattern of patterns) {
                const match = title.match(pattern);

                if (match && looksLikeCompanyName(match[2])) {
                    jobTitle = cleanText(match[1]);
                    company = cleanText(match[2]);
                    break;
                }
            }
        }

        return {
            jobTitle,
            company,
            confidence: jobTitle && company ? "low" : "none"
        };
    }

    const platform = detectPlatform();
    const cleanUrl = getCleanLinkedInUrl();

    const titleResult = extractFromTitle();
    const linkedInResult = extractFromLinkedIn();
    if (hostname.includes("linkedin.com")) {
        const titleLooksBad =
            !titleResult.jobTitle ||
            titleResult.jobTitle.toLowerCase().includes("top job picks") ||
            titleResult.jobTitle.toLowerCase().includes("jobs based on your preferences");
        const linkedInLooksStrong =
            linkedInResult.company &&
            linkedInResult.jobTitle &&
            !linkedInResult.company.toLowerCase().includes("how promoted jobs are ranked") &&
            !linkedInResult.company.toLowerCase().includes("jobs based on your preferences") &&
            !linkedInResult.company.toLowerCase().includes("top job picks") &&
            !linkedInResult.jobTitle.toLowerCase().includes(" or ");

        const mergedLinkedInResult = {
            company:
                linkedInLooksStrong || titleLooksBad
                    ? linkedInResult.company || titleResult.company
                    : titleResult.company || linkedInResult.company,
            jobTitle:
                linkedInLooksStrong || titleLooksBad
                    ? linkedInResult.jobTitle || titleResult.jobTitle
                    : titleResult.jobTitle || linkedInResult.jobTitle,
            confidence:
                linkedInLooksStrong
                    ? linkedInResult.confidence
                    : titleResult.company && titleResult.jobTitle
                    ? "high"
                    : "low"
        };

        if (mergedLinkedInResult.jobTitle || mergedLinkedInResult.company) {
            return {
                company: mergedLinkedInResult.company,
                jobTitle: mergedLinkedInResult.jobTitle,
                platform,
                url: cleanUrl,
                confidence: mergedLinkedInResult.confidence
            };
        }
    }

    if (linkedInResult.jobTitle || linkedInResult.company) {
        return {
            company: linkedInResult.company,
            jobTitle: linkedInResult.jobTitle,
            platform,
            url: cleanUrl,
            confidence: linkedInResult.confidence
        };
    }

    const leverResult = extractFromLever();
    if (leverResult.jobTitle || leverResult.company) {
        return {
            company: leverResult.company,
            jobTitle: leverResult.jobTitle,
            platform,
            url: cleanUrl,
            confidence: leverResult.confidence
        };
    }

    const greenhouseResult = extractFromGreenhouse();
    if (greenhouseResult.jobTitle || greenhouseResult.company) {
        return {
            company: greenhouseResult.company,
            jobTitle: greenhouseResult.jobTitle,
            platform,
            url: cleanUrl,
            confidence: greenhouseResult.confidence
        };
    }

    const jsonLd = extractFromJsonLd();
    if (jsonLd.jobTitle || jsonLd.company) {
        return {
            company: jsonLd.company,
            jobTitle: jsonLd.jobTitle,
            platform,
            url: cleanUrl,
            confidence: jsonLd.confidence
        };
    }

    const domResult = extractFromDom();
    if (domResult.jobTitle || domResult.company) {
        return {
            company: domResult.company,
            jobTitle: domResult.jobTitle,
            platform,
            url: cleanUrl,
            confidence: domResult.confidence
        };
    }

    return {
        company: titleResult.company,
        jobTitle: titleResult.jobTitle,
        platform,
        url: cleanUrl,
        confidence: titleResult.confidence
    };
}
