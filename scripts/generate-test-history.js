const fs = require("fs");
const path = require("path");

let seed = 4405;

function rand() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
}

function pick(items) {
    return items[Math.floor(rand() * items.length)];
}

function chance(probability) {
    return rand() < probability;
}

function isoDate(daysAgo, hour = 9) {
    const date = new Date(Date.UTC(2026, 4, 5, hour, Math.floor(rand() * 60), 0));
    date.setUTCDate(date.getUTCDate() - daysAgo);
    return date.toISOString();
}

function addDays(isoValue, days) {
    const date = new Date(isoValue);
    date.setUTCDate(date.getUTCDate() + days);
    date.setUTCHours(9 + Math.floor(rand() * 8), Math.floor(rand() * 60), 0, 0);
    return date.toISOString();
}

function slug(value) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

const companies = [
    "Archetype AI", "Zoox", "Character.AI", "Anthropic", "OpenAI", "Google DeepMind",
    "NVIDIA", "Apple", "Meta", "Microsoft", "Amazon Robotics", "Tesla", "Waymo",
    "Cruise", "Scale AI", "Databricks", "Snowflake", "Stripe", "Roblox", "Discord",
    "Figma", "Notion", "Perplexity AI", "Sierra", "Applied Intuition", "Skydio",
    "Anduril", "Cohere", "Mistral AI", "Hugging Face", "Weights & Biases", "Runway",
    "Twelve Labs", "Ludo Robotics", "Machinify", "AfterQuery Experts", "DeWinter Group",
    "HealthEdge", "OneMagnify", "Guild Mortgage", "Crossing Hurdles", "Rowspace",
    "Plaud", "FemtoAI", "Kickmaker", "Dynamism", "Company.ai", "AppZen",
    "Chasepro Talent", "Acceler8 Talent", "Biohub", "Diligent Technologies", "HireArt",
    "DataAnnotation", "Stealth Startup", "KRAFTON AI", "Replit", "ElevenLabs", "Adobe",
    "Pinterest", "Uber", "Lyft", "Airbnb", "Rippling", "Ramp", "Palantir", "Asana",
    "Canva", "DoorDash", "Instacart", "LinkedIn", "Block", "Coinbase", "Glean",
    "Observe.AI", "Samsara", "Vercel", "Retool", "Cerebras", "Groq"
];

const titles = [
    "Machine Learning Engineer", "AI Engineer", "Data Scientist", "Applied Scientist",
    "Research Engineer, AI", "ML Compiler Engineer", "Machine Learning Applied Researcher",
    "Software Engineer, Applied ML", "AI Safety & Evaluation Engineer", "Data Scientist | Modeling",
    "Computer Vision Engineer", "NLP Engineer", "MLOps Engineer", "Generative AI Engineer",
    "Staff Machine Learning Engineer", "Senior Data Analyst", "AI Product Engineer",
    "Robotics Machine Learning Engineer", "Simulation Scenario Generation Engineer",
    "Recommendation Systems Engineer", "LLM Evaluation Engineer", "AI Platform Engineer",
    "Search Ranking Engineer", "Research Scientist, Machine Learning", "Data Engineer, ML Platform",
    "Machine Learning Infrastructure Engineer"
];

const platforms = ["LinkedIn", "Lever", "Greenhouse", "Ashby", "Workday", "Company Website", "Indeed"];
const locations = [
    "San Francisco, CA", "San Mateo, CA", "San Jose, CA", "Redwood City, CA", "Palo Alto, CA",
    "Foster City, CA", "Mountain View, CA", "Cupertino, CA", "New York, NY", "Seattle, WA",
    "Austin, TX", "Boston, MA", "Remote, United States", "Hybrid - Bay Area", "Los Angeles, CA"
];
const sources = [
    "LinkedIn Easy Apply", "LinkedIn external apply", "Company careers page", "Recruiter message",
    "Referral", "Job board search", "Saved job follow-up", "Google Jobs"
];
const noteTemplates = [
    "Saved from search results; resume tailored for ML systems work.",
    "Applied with general AI/ML resume.",
    "Role looks aligned with Python, model evaluation, and production ML.",
    "Need to follow up if no response after two weeks.",
    "Strong match on job description; company research needed.",
    "External application form completed.",
    "Salary/location details need manual review.",
    "Found via LinkedIn recommendations."
];
const contactNames = [
    "Maya Chen", "Daniel Park", "Priya Shah", "Alex Morgan", "Jessica Lee", "Ryan Kim",
    "Sofia Patel", "Ethan Wright", "Emily Zhao", "Chris Nguyen", "Jordan Smith", "Taylor Brown"
];

function weightedStatus() {
    const roll = rand();
    if (roll < 0.44) return "Submitted";
    if (roll < 0.56) return "Rejected";
    if (roll < 0.68) return "HR Reachout";
    if (roll < 0.78) return "Phone Screen";
    if (roll < 0.9) return "Interview";
    if (roll < 0.94) return "Final Interview";
    if (roll < 0.975) return "Offer";
    return "Withdrawn";
}

function timelineFor(finalStatus, submittedAt) {
    const history = [{ status: "Submitted", date: submittedAt, note: "Initial save" }];
    let cursor = submittedAt;

    function push(status, minGap, maxGap, note) {
        cursor = addDays(cursor, minGap + Math.floor(rand() * (maxGap - minGap + 1)));
        history.push({ status, date: cursor, note });
    }

    if (finalStatus === "Submitted") return history;

    if (finalStatus === "Withdrawn") {
        if (chance(0.35)) push(pick(["HR Reachout", "Phone Screen"]), 2, 10, "Some contact before withdrawal.");
        push("Withdrawn", 1, 12, "Withdrew from process.");
        return history;
    }

    if (finalStatus === "Rejected") {
        const pathType = rand();
        if (pathType < 0.42) {
            push("Rejected", 3, 28, "Rejection email received.");
        } else if (pathType < 0.72) {
            push(pick(["HR Reachout", "Phone Screen"]), 2, 14, "Recruiter or HR contact received.");
            push("Rejected", 2, 18, "Rejected after initial contact.");
        } else {
            push("HR Reachout", 2, 10, "Recruiter reached out to schedule screen.");
            if (chance(0.8)) push("Phone Screen", 1, 7, "Phone screen completed.");
            if (chance(0.65)) push("Interview", 3, 12, "Technical interview scheduled.");
            if (chance(0.25)) push("Final Interview", 4, 10, "Final round completed.");
            push("Rejected", 2, 14, "Rejected after interview process.");
        }
        return history;
    }

    if (finalStatus === "Offer") {
        push("HR Reachout", 2, 9, "Recruiter reached out.");
        if (chance(0.85)) push("Phone Screen", 1, 6, "Phone screen completed.");
        push("Interview", 3, 10, "Interview scheduled/completed.");
        if (chance(0.7)) push("Final Interview", 3, 9, "Final round completed.");
        push("Offer", 2, 8, "Offer received.");
        return history;
    }

    if (finalStatus === "Final Interview") {
        push("HR Reachout", 2, 10, "Recruiter reached out.");
        if (chance(0.8)) push("Phone Screen", 1, 6, "Phone screen completed.");
        push("Interview", 3, 10, "Technical interview completed.");
        push("Final Interview", 3, 9, "Final interview scheduled.");
        return history;
    }

    if (finalStatus === "Interview") {
        if (chance(0.75)) push("HR Reachout", 2, 10, "Recruiter reached out.");
        if (chance(0.65)) push("Phone Screen", 1, 7, "Phone screen completed.");
        push("Interview", 2, 12, "Interview scheduled.");
        return history;
    }

    if (finalStatus === "Phone Screen") {
        if (chance(0.7)) push("HR Reachout", 2, 10, "Recruiter reached out.");
        push("Phone Screen", 1, 8, "Phone screen scheduled.");
        return history;
    }

    if (finalStatus === "HR Reachout") {
        push("HR Reachout", 2, 14, "Recruiter reached out by email.");
    }

    return history;
}

const applications = Array.from({ length: 200 }, (_, index) => {
    const company = pick(companies);
    const jobTitle = pick(titles);
    const platform = pick(platforms);
    const daysAgo = 1 + Math.floor(rand() * 178);
    const dateSubmitted = isoDate(daysAgo);
    const statusHistory = timelineFor(weightedStatus(), dateSubmitted);
    const status = statusHistory[statusHistory.length - 1].status;
    const lastUpdated = statusHistory[statusHistory.length - 1].date;
    const applicationId = `test-${String(index + 1).padStart(3, "0")}-${slug(company).slice(0, 14)}`;
    const source = pick(sources);
    const location = pick(locations);
    const salary = chance(0.6) ? `$${80 + Math.floor(rand() * 140)}k - $${140 + Math.floor(rand() * 190)}k` : "";
    const contact = chance(0.28) ? pick(contactNames) : "";
    const host = platform === "Lever"
        ? "jobs.lever.co"
        : platform === "Greenhouse"
            ? "job-boards.greenhouse.io"
            : platform === "LinkedIn"
                ? "www.linkedin.com"
                : `${slug(company)}.example.com`;
    const url = platform === "LinkedIn"
        ? `https://www.linkedin.com/jobs/view/${4360000000 + index}`
        : `https://${host}/${slug(company)}/jobs/${applicationId}`;
    const hasUpcomingEvent =
        ["HR Reachout", "Phone Screen", "Interview", "Final Interview"].includes(status) &&
        chance(0.22);

    return {
        id: 1760000000000 + index,
        applicationId,
        dateSubmitted,
        company,
        jobTitle,
        platform,
        status,
        notes: [
            pick(noteTemplates),
            `Source: ${source}.`,
            `Location: ${location}.`,
            salary ? `${salary}.` : "",
            contact ? `Contact: ${contact}.` : ""
        ].filter(Boolean).join(" "),
        url,
        nextEventDate: hasUpcomingEvent
            ? addDays(new Date(Date.UTC(2026, 4, 5, 12, 0, 0)).toISOString(), Math.floor(rand() * 7))
            : "",
        nextEventLabel: hasUpcomingEvent ? status : "",
        lastUpdated,
        statusHistory,
        schemaVersion: 4
    };
});

const payload = {
    app: "Job Application Tracker",
    schemaVersion: 4,
    exportedAt: new Date(Date.UTC(2026, 4, 5, 17, 30, 0)).toISOString(),
    fixture: true,
    description: "Synthetic 200-record v4 history fixture for dashboard import and statistics testing.",
    applications
};

const outDir = path.join(__dirname, "..", "test-data");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "sample-history-200.json"), JSON.stringify(payload, null, 2));

const counts = applications.reduce((acc, app) => {
    acc[app.status] = (acc[app.status] || 0) + 1;
    return acc;
}, {});

console.log(JSON.stringify({ records: applications.length, counts }, null, 2));
