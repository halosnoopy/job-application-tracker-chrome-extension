const GEMINI_API_KEY = "put your gemini api key here";

const GEMINI_MODELS = [
    "gemini-3.1-flash-lite-preview",
    "gemini-2.5-flash-lite",
    "gemini-1.5-flash-8b"
];

document.addEventListener("DOMContentLoaded", async () => {
    const saveBtn = document.getElementById("saveBtn");
    const extractBtn = document.getElementById("extractBtn");
    const aiExtractBtn = document.getElementById("aiExtractBtn");
    const dashboardBtn = document.getElementById("dashboardBtn");
    const message = document.getElementById("message");

    extractBtn.addEventListener("click", async () => {
        message.textContent = "Extracting job details locally...";
        message.style.color = "#333";

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: extractJobInfoFromPage
            });

            const extracted = results[0].result || {};
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
            if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_GEMINI_API_KEY") {
                message.textContent = "Please add your Gemini API key in popup.js first.";
                message.style.color = "red";
                return;
            }

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: collectCompactPageInfo
            });

            const pageInfo = results[0].result || {};
            const aiResult = await extractJobInfoWithGemini(pageInfo);

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
    const prompt = `
Extract the selected job posting information from the page data.

The page may contain multiple job cards or recommendation lists. Use the selected job, main job detail panel, or primary job posting only. Do not use unrelated recommended jobs.

Return the required JSON format only. Do not include markdown, code fences, comments, or explanation. The required JSON foat is below. Use empty strings for any unknown values.

Required JSON format:
{
  "isJobPage": true,
  "company": "",
  "jobTitle": "",
  "platform": "",
}

Use empty strings if unknown.

Page data:
${JSON.stringify(pageInfo)}
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
                            maxOutputTokens: 300,
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

    if (!parsed.isJobPage) {
        throw new Error("Gemini did not detect a job page.");
    }

    return {
        company: parsed.company || "",
        jobTitle: parsed.jobTitle || "",
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

    function getMetaContent(selector) {
        return cleanText(document.querySelector(selector)?.getAttribute("content"));
    }

    const platform = detectPlatform();
    const cleanUrl = getCleanLinkedInUrl();

    const h1Text = Array.from(document.querySelectorAll("h1"))
        .map((el) => cleanText(el.innerText))
        .filter(Boolean)
        .slice(0, 5);

    const h2Text = Array.from(document.querySelectorAll("h2"))
        .map((el) => cleanText(el.innerText))
        .filter(Boolean)
        .slice(0, 8);

    const metaDescription =
        getMetaContent('meta[name="description"]') ||
        getMetaContent('meta[property="og:description"]');

    const ogTitle = getMetaContent('meta[property="og:title"]');

    let mainText = "";

    const linkedinDetailPanel =
        document.querySelector(".jobs-search__job-details--container") ||
        document.querySelector(".scaffold-layout__detail") ||
        document.querySelector(".job-view-layout") ||
        document.querySelector(".jobs-details");

    if (hostname.includes("linkedin.com") && linkedinDetailPanel) {
        mainText = cleanText(linkedinDetailPanel.innerText).slice(0, 2500);
    } else {
        mainText = cleanText(document.body.innerText).slice(0, 2500);
    }

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
        mainText
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
    function extractFromLinkedIn() {
        if (!hostname.includes("linkedin.com")) {
            return {};
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
                /engineer|scientist|analyst|associate|developer|manager|intern|consultant|specialist|architect|researcher/i.test(line)
            );

            if (titleIndex !== -1) {
                jobTitle = detailLines[titleIndex];

                if (titleIndex > 0) {
                    company = detailLines[titleIndex - 1];
                }
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

        const patterns = [
            /(.+?)\s+at\s+(.+?)(\||-|$)/i,
            /(.+?)\s+-\s+(.+?)(\||$)/i,
            /(.+?)\s+\|\s+(.+?)(\||$)/i
        ];

        for (const pattern of patterns) {
            const match = title.match(pattern);

            if (match) {
                jobTitle = cleanText(match[1]);
                company = cleanText(match[2]);
                break;
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

    const linkedInResult = extractFromLinkedIn();
    if (linkedInResult.jobTitle || linkedInResult.company) {
        return {
            company: linkedInResult.company,
            jobTitle: linkedInResult.jobTitle,
            platform,
            url: cleanUrl,
            confidence: linkedInResult.confidence
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

    const titleResult = extractFromTitle();

    return {
        company: titleResult.company,
        jobTitle: titleResult.jobTitle,
        platform,
        url: cleanUrl,
        confidence: titleResult.confidence
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

    function extractFromLinkedIn() {
        if (!hostname.includes("linkedin.com")) {
            return {};
        }

        const pageText = document.body.innerText
            .split("\n")
            .map(cleanText)
            .filter(Boolean);

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

        const cleanLines = pageText.filter((line) => {
            const lower = line.toLowerCase();
            return !blockedWords.some((word) => lower.includes(word));
        });

        let jobTitle = "";
        let company = "";

        const titleIndex = cleanLines.findIndex((line) =>
            /engineer|scientist|analyst|associate|developer|manager|intern|consultant|specialist|architect|researcher/i.test(line)
        );

        if (titleIndex !== -1) {
            jobTitle = cleanLines[titleIndex];

            if (titleIndex > 0) {
                company = cleanLines[titleIndex - 1];
            }
        }

        return {
            jobTitle,
            company,
            confidence: jobTitle && company ? "medium" : "low"
        };
    }

    function getMetaContent(selector) {
        return cleanText(document.querySelector(selector)?.getAttribute("content"));
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

        const patterns = [
            /(.+?)\s+at\s+(.+?)(\||-|$)/i,
            /(.+?)\s+-\s+(.+?)(\||$)/i,
            /(.+?)\s+\|\s+(.+?)(\||$)/i
        ];

        for (const pattern of patterns) {
            const match = title.match(pattern);

            if (match) {
                jobTitle = cleanText(match[1]);
                company = cleanText(match[2]);
                break;
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

    const linkedInResult = extractFromLinkedIn();
    if (linkedInResult.jobTitle || linkedInResult.company) {
        return {
            company: linkedInResult.company,
            jobTitle: linkedInResult.jobTitle,
            platform,
            url: cleanUrl,
            confidence: linkedInResult.confidence
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

    const titleResult = extractFromTitle();

    return {
        company: titleResult.company,
        jobTitle: titleResult.jobTitle,
        platform,
        url: cleanUrl,
        confidence: titleResult.confidence
    };
}