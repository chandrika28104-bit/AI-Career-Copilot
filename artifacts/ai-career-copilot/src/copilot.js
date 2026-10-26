const resumeField = document.getElementById("resume");
const jobDescriptionField = document.getElementById("job-description");
const analyzeButton = document.getElementById("analyzeBtn");
const results = document.getElementById("results");
const minimumLength = 50;
const maximumLength = 24_000;

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function showError(title, message) {
  const error = createElement("div", "error-box");
  error.setAttribute("role", "alert");
  error.append(
    createElement("span", "", "⚠️"),
    createElement("div", "", ""),
  );
  const content = error.lastElementChild;
  content.append(
    createElement("strong", "", title),
    createElement("br"),
    createElement("span", "", message),
  );
  results.replaceChildren(error);
}

function appendList(parent, title, items, className = "") {
  const card = createElement("div", `result-card ${className}`.trim());
  card.append(createElement("h4", "", title));
  if (items.length === 0) {
    card.append(createElement("p", "", "No items identified."));
  } else if (className === "keyword-card") {
    const keywords = createElement("div", "keyword-list");
    for (const value of items) keywords.append(createElement("span", "keyword", value));
    card.append(keywords);
  } else {
    const list = createElement("ul", "insight-list");
    if (className === "improvement-card") list.classList.add("improvement-list");
    for (const value of items) list.append(createElement("li", "", value));
    card.append(list);
  }
  parent.append(card);
}

function displayResults(analysis) {
  const score = Math.max(0, Math.min(100, Math.round(Number(analysis.ats_score))));
  const scoreCard = createElement("div", "result-card score-card");
  scoreCard.append(createElement("h4", "", "🎯 ATS Match Score"));

  const circle = createElement("div", "score-circle");
  circle.style.setProperty("--score-deg", `${score * 3.6}deg`);
  const scoreColor =
    score >= 80 ? "var(--success)" : score >= 60 ? "var(--warning)" : "var(--danger)";
  const number = createElement("div", "score-number", String(score));
  number.style.color = scoreColor;
  circle.append(number, createElement("div", "score-label", "out of 100"));

  const scoreMessage =
    score >= 80
      ? "Excellent match — your resume aligns well with this role."
      : score >= 60
        ? "Good match — targeted improvements can help."
        : score >= 40
          ? "Fair match — consider strengthening the role-specific details."
          : "Low match — review the role requirements and suggested changes.";
  scoreCard.append(circle, createElement("p", "score-message", scoreMessage));

  const summaryCard = createElement("div", "result-card");
  summaryCard.append(
    createElement("h4", "", "📝 AI Summary"),
    createElement("p", "", analysis.summary),
  );

  const fragment = document.createDocumentFragment();
  fragment.append(
    scoreCard,
    summaryCard,
  );
  appendList(fragment, "✅ What Your Resume Does Well", analysis.strengths);
  appendList(fragment, "Missing Keywords", analysis.missing_keywords, "keyword-card");
  appendList(fragment, "💡 Recommended Improvements", analysis.improvements, "improvement-card");
  results.replaceChildren(fragment);
  results.scrollIntoView({ behavior: "smooth", block: "start" });
}

analyzeButton.addEventListener("click", async () => {
  const resume = resumeField.value.trim();
  const jobDescription = jobDescriptionField.value.trim();

  if (!resume || !jobDescription) {
    showError("Please fill in both fields", "Paste your resume and the job description to get AI feedback.");
    return;
  }
  if (resume.length < minimumLength || jobDescription.length < minimumLength) {
    showError("Content too short", "Each field needs at least 50 characters for a useful analysis.");
    return;
  }
  if (resume.length > maximumLength || jobDescription.length > maximumLength) {
    showError("Content too long", "Each field must be no longer than 24,000 characters.");
    return;
  }

  analyzeButton.disabled = true;
  analyzeButton.setAttribute("aria-busy", "true");
  analyzeButton.textContent = "Analyzing…";

  const loading = createElement("div", "loading");
  loading.append(
    createElement("div", "spinner"),
    createElement("p", "", "Analyzing your resume against the job description…"),
  );
  results.replaceChildren(loading);

  try {
    const endpoint = `${import.meta.env.BASE_URL}api/analyze`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resume, jobDescription }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(
        typeof payload?.error === "string"
          ? payload.error
          : "Analysis failed. Please try again.",
      );
    }
    if (
      !payload ||
      typeof payload.summary !== "string" ||
      !Number.isFinite(Number(payload.ats_score)) ||
      !Array.isArray(payload.strengths) ||
      !Array.isArray(payload.missing_keywords) ||
      !Array.isArray(payload.improvements)
    ) {
      throw new Error("The analysis service returned an invalid response. Please try again.");
    }
    displayResults(payload);
  } catch (error) {
    showError(
      "Analysis failed",
      error instanceof Error ? error.message : "A connection issue interrupted the analysis.",
    );
  } finally {
    analyzeButton.disabled = false;
    analyzeButton.removeAttribute("aria-busy");
    analyzeButton.replaceChildren(
      createElement("span", "", "🚀"),
      document.createTextNode(" Analyze Resume"),
    );
  }
});
