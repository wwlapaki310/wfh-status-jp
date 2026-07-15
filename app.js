(() => {
  const DATA_URL = "data/companies.json";
  const REPO_URL = "https://github.com/wwlapaki310/wfh-status-jp";

  const CATEGORY_LABEL = {
    return_to_office: "週5出社便 / RETURN TO OFFICE",
    remote_committed: "在宅継続便 / REMOTE COMMITTED",
    hybrid: "ハイブリッド便 / HYBRID",
  };

  const listEls = {
    return_to_office: document.getElementById("list-return_to_office"),
    remote_committed: document.getElementById("list-remote_committed"),
    hybrid: document.getElementById("list-hybrid"),
  };

  const searchInput = document.getElementById("searchInput");
  const filterButtons = document.querySelectorAll(".filter-chip");
  const lastUpdatedEl = document.getElementById("lastUpdated");
  const totalCountEl = document.getElementById("totalCount");
  const addCompanyLink = document.getElementById("addCompanyLink");

  const detailPanel = document.getElementById("detailPanel");
  const detailClose = document.getElementById("detailClose");
  const detailCategory = document.getElementById("detailCategory");
  const detailName = document.getElementById("detailName");
  const detailDate = document.getElementById("detailDate");
  const detailVerified = document.getElementById("detailVerified");
  const detailSource = document.getElementById("detailSource");
  const detailNotes = document.getElementById("detailNotes");

  addCompanyLink.href = `${REPO_URL}/issues/new?template=add-company.yml`;

  let allCompanies = [];
  let activeFilter = "all";
  let searchTerm = "";

  function formatDate(d) {
    if (!d) return "—";
    return d;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
  }

  function render() {
    const term = searchTerm.trim().toLowerCase();

    Object.entries(listEls).forEach(([category, el]) => {
      el.innerHTML = "";

      if (activeFilter !== "all" && activeFilter !== category) {
        el.closest(".board-panel").style.display = "none";
        return;
      }
      el.closest(".board-panel").style.display = "";

      const items = allCompanies
        .filter((c) => c.category === category)
        .filter((c) => !term || c.name.toLowerCase().includes(term))
        .sort((a, b) => a.name.localeCompare(b.name, "ja"));

      items.forEach((company, i) => {
        const li = document.createElement("li");
        li.className = "board-row";
        li.tabIndex = 0;
        li.style.animationDelay = `${Math.min(i, 12) * 35}ms`;
        li.innerHTML = `
          <span class="board-row__name">${escapeHtml(company.name)}</span>
          <span class="board-row__date">${formatDate(company.changedDate)}</span>
          <span class="board-row__flag" aria-hidden="true"></span>
        `;
        li.addEventListener("click", () => showDetail(company));
        li.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            showDetail(company);
          }
        });
        el.appendChild(li);
      });
    });

    const visibleCount = allCompanies.filter(
      (c) => (activeFilter === "all" || c.category === activeFilter) &&
        (!term || c.name.toLowerCase().includes(term))
    ).length;
    totalCountEl.textContent = `表示中 ${visibleCount} / 全 ${allCompanies.length} 社`;
  }

  function showDetail(company) {
    detailCategory.textContent = CATEGORY_LABEL[company.category] || company.category;
    detailName.textContent = company.name;
    detailDate.textContent = formatDate(company.changedDate);
    detailVerified.textContent = formatDate(company.lastVerified);
    detailSource.innerHTML = company.sourceUrl
      ? `<a href="${escapeHtml(company.sourceUrl)}" target="_blank" rel="noopener">出典を見る ↗</a>`
      : "—";
    detailNotes.textContent = company.notes || "補足情報はありません。";
    detailPanel.hidden = false;
  }

  detailClose.addEventListener("click", () => { detailPanel.hidden = true; });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") detailPanel.hidden = true;
  });

  searchInput.addEventListener("input", (e) => {
    searchTerm = e.target.value;
    render();
  });

  filterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterButtons.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      activeFilter = btn.dataset.filter;
      render();
    });
  });

  fetch(DATA_URL)
    .then((res) => {
      if (!res.ok) throw new Error(`データの取得に失敗しました (${res.status})`);
      return res.json();
    })
    .then((data) => {
      allCompanies = data;
      const latest = data.reduce((max, c) => {
        return c.lastVerified && c.lastVerified > max ? c.lastVerified : max;
      }, "");
      lastUpdatedEl.textContent = latest ? `最終更新: ${latest}` : "最終更新: —";
      render();
    })
    .catch((err) => {
      lastUpdatedEl.textContent = "データの読み込みに失敗しました";
      console.error(err);
    });
})();
