const GEMINI_API_KEY = "your gemini api key here"; // Replace with your actual Gemini API key

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

    extractBtn.addEventListener("click", async () => {
        message.textContent = "Extracting job details locally...";
        message.style.color = "#333";

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

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
    });

    aiExtractBtn.addEventListener("click", async () => {
        message.textContent = "Extracting job details with AI...";
        message.style.color = "#333";

        aiExtractBtn.disabled = true;
        aiExtractBtn.textContent = "AI Extracting...";
        extractBtn.disabled = true;
        saveBtn.disabled = true;

        try {
            if (
                !GEMINI_API_KEY ||
                GEMINI_API_KEY === "YOUR_GEMINI_API_KEY" ||
                GEMINI_API_KEY === "put your gemini api key here"
            ) {
                message.textContent = "Please add your Gemini API key in popup.js first.";
                message.style.color = "red";
                return;
            }

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

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
            const aiResult = await extractJobInfoWithGemini(pageInfo);
            console.log("AI extraction final result:", aiResult);

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
    });

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
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

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

        if (!company || !jobTitle) {
            message.textContent = "Please enter company and job title.";
            message.style.color = "red";
            return;
        }

        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const extractedUrlInput = document.getElementById("extractedUrl");

        let currentUrl =
            extractedUrlInput?.value ||
            tabs[0]?.url ||
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
            dateSubmitted: new Date().toISOString()
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

        if (extractedUrlInput) {
            extractedUrlInput.value = "";
        }
    });

    dashboardBtn.addEventListener("click", () => {
        chrome.tabs.create({
            url: chrome.runtime.getURL("dashboard.html")
        });
    });
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

async function extractJobInfoWithGemini(pageInfo) {
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

    const prompt = `
Extract the primary job posting from this structured page data.

Rules:
- Use only values that appear in the provided data.
- Prefer selectedPanelText and candidates over pageTitle.
- For LinkedIn pages, use the selected job panel/card only. Ignore profile/header text.
- Ignore recommended jobs, navigation, ads, and unrelated listings.
- If a field is uncertain, return an empty string.
- Return JSON only.

JSON format:
{
  "isJobPage": true,
  "company": "",
  "jobTitle": "",
  "platform": ""
}

Page data:
${JSON.stringify(aiPageInfo)}
`;

    const MODELS = [
        "gemini-3.1-flash-lite-preview",
        "gemini-2.5-flash-lite",
        "gemini-1.5-flash-8b"
    ];

    let data = null;
    let lastError = "";

    for (const model of MODELS) {
        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
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
                            maxOutputTokens: 180,
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

