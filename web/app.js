const recommendations = [
  {
    id: "rec-1",
    title: "Assign a lead for the Father Figures event",
    summary: "The planning discussion identifies the event as a priority but does not record a confirmed owner. The system recommends asking the Brotherhood and Service leads to nominate one.",
    source: "General Meeting Docs · August 2026 · Planning discussion",
    risk: "low",
  },
  {
    id: "rec-2",
    title: "Submit a standard event brief and budget",
    summary: "Foundation support requires an event brief and budget. The next step is to prepare both for review before requesting space or funding.",
    source: "Strategy Session · FY 25'-26' · Foundation support protocol",
    risk: "low",
  },
  {
    id: "rec-3",
    title: "Set a paid-membership conversion objective",
    summary: "The cookout exceeded its fundraising target but reached 5 paid members against a target of 40. A follow-up objective should be approved before the next event.",
    source: "General Meeting Docs · August 2026 · Cookout debrief",
    risk: "medium",
  },
];

const sources = [
  ["PDF", "EAAA General Meeting Docs (March 2026 - August 2026).pdf", "Local seed corpus · not yet ingested"],
  ["PDF", "EAAA Strategy Session Meeting (FY 25'-26').pdf", "Local seed corpus · not yet ingested"],
  ["XLS", "Engagement Calendar_EAAA.xlsx", "Local seed corpus · not yet ingested"],
  ["PDF", "Bylaws - Eagle Academy Alumni Association v3.pdf", "Local seed corpus · not yet ingested"],
];

const reviewList = document.querySelector("#review-list");
const reviewCount = document.querySelector("#review-count");
const emptyReview = document.querySelector("#empty-review");

function renderRecommendations() {
  reviewList.innerHTML = "";
  recommendations.filter((item) => !item.status).forEach((item) => {
    const card = document.createElement("article");
    card.className = "review-card";
    card.innerHTML = `
      <div class="review-top">
        <div><p class="eyebrow">PROPOSED · ${item.risk.toUpperCase()} RISK</p><h3>${item.title}</h3></div>
        <span class="tag">${item.risk === "low" ? "Low risk" : "Needs context"}</span>
      </div>
      <p class="summary">${item.summary}</p>
      <div class="evidence"><span class="evidence-mark">✓</span><div><strong>Source evidence</strong><cite>${item.source}</cite></div></div>
      <div class="actions"><button class="approve" data-action="approve" data-id="${item.id}">Approve recommendation</button><button class="reject" data-action="reject" data-id="${item.id}">Reject</button></div>
    `;
    reviewList.appendChild(card);
  });

  const remaining = recommendations.filter((item) => !item.status).length;
  reviewCount.textContent = remaining;
  emptyReview.classList.toggle("hidden", remaining !== 0);
  document.querySelector("#commitment-metric").textContent = remaining + 4;
}

function setView(name) {
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("hidden", view.id !== `view-${name}`));
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.view === name));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-view-target], .tab");
  if (target) setView(target.dataset.viewTarget || target.dataset.view);

  const action = event.target.closest("[data-action]");
  if (action) {
    const item = recommendations.find((candidate) => candidate.id === action.dataset.id);
    if (!item) return;
    item.status = action.dataset.action === "approve" ? "approved" : "rejected";
    renderRecommendations();
  }
});

document.querySelector("#source-list").innerHTML = sources.map(([kind, title, status]) => `
  <div class="source-item"><span class="source-icon">${kind}</span><div><strong>${title}</strong><small>${status}</small></div><span class="source-state">Awaiting import</span></div>
`).join("");

renderRecommendations();
