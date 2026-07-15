// wfh-status-jp — client-side spreadsheet + GitHub fork-and-PR editing flow
// No backend. Data lives at data/companies.json in this repo.

const OWNER = "wwlapaki310";
const REPO = "wfh-status-jp";
const FILE_PATH = "data/companies.json";
const BASE_BRANCH = "main";
const API = "https://api.github.com";

const CATEGORY_LABEL = {
  return_to_office: "🏢 週5出社",
  hybrid: "🔀 ハイブリッド",
  remote_committed: "🏠 リモート継続",
};

let rows = [];       // working copy of company records
let activeFilters = new Set(Object.keys(CATEGORY_LABEL));
let searchTerm = "";

const $ = (sel) => document.querySelector(sel);
const body = $("#sheet-body");
const statusLog = $("#status-log");
const emptyState = $("#empty-state");

$("#link-repo").href = `https://github.com/${OWNER}/${REPO}`;

function log(msg) {
  statusLog.textContent = msg;
}

function uid() {
  return "row-" + Math.random().toString(36).slice(2, 9);
}

// ---------- Load ----------
async function loadData() {
  log("データを読み込み中…");
  try {
    const res = await fetch(
      `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BASE_BRANCH}/${FILE_PATH}?t=${Date.now()}`
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    rows = data.map((r) => ({ ...r, _uid: uid() }));
    log("");
  } catch (err) {
    log(`データの読み込みに失敗しました: ${err.message}`);
    rows = [];
  }
  render();
}

// ---------- Render ----------
function matchesFilters(r) {
  if (!activeFilters.has(r.category)) return false;
  if (searchTerm && !r.name.toLowerCase().includes(searchTerm.toLowerCase()))
    return false;
  return true;
}

function render() {
  body.innerHTML = "";
  const visible = rows.filter(matchesFilters);
  emptyState.classList.toggle("hidden", visible.length > 0);

  for (const r of visible) {
    body.appendChild(renderRow(r));
  }
}

function renderRow(r) {
  const tr = document.createElement("tr");
  tr.dataset.uid = r._uid;

  tr.innerHTML = `
    <td class="col-name"><input type="text" value="${escapeAttr(r.name || "")}" data-field="name" placeholder="会社名" /></td>
    <td class="col-cat">
      <select data-field="category">
        ${Object.entries(CATEGORY_LABEL)
          .map(
            ([val, label]) =>
              `<option value="${val}" ${r.category === val ? "selected" : ""}>${label}</option>`
          )
          .join("")}
      </select>
    </td>
    <td class="col-date"><input type="date" value="${r.changedDate || ""}" data-field="changedDate" /></td>
    <td class="col-src"><input type="url" value="${escapeAttr(r.sourceUrl || "")}" data-field="sourceUrl" placeholder="https://" /></td>
    <td class="col-notes"><input type="text" value="${escapeAttr(r.notes || "")}" data-field="notes" placeholder="備考" /></td>
    <td class="col-verified"><input type="date" value="${r.lastVerified || ""}" data-field="lastVerified" /></td>
    <td class="col-op"><button class="btn-del" title="この行を削除">✕</button></td>
  `;

  tr.querySelectorAll("[data-field]").forEach((el) => {
    el.addEventListener("input", () => {
      const rec = rows.find((x) => x._uid === r._uid);
      rec[el.dataset.field] = el.value;
      if (el.dataset.field === "category") render(); // may leave current filter
    });
  });

  tr.querySelector(".btn-del").addEventListener("click", () => {
    if (!confirm(`「${r.name || "この行"}」を削除しますか？`)) return;
    rows = rows.filter((x) => x._uid !== r._uid);
    render();
  });

  return tr;
}

function escapeAttr(s) {
  return String(s).replace(/"/g, "&quot;");
}

// ---------- Toolbar ----------
document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const f = chip.dataset.filter;
    if (activeFilters.has(f)) {
      activeFilters.delete(f);
      chip.classList.remove("active");
    } else {
      activeFilters.add(f);
      chip.classList.add("active");
    }
    render();
  });
});

$("#search").addEventListener("input", (e) => {
  searchTerm = e.target.value.trim();
  render();
});

$("#btn-add-row").addEventListener("click", () => {
  const rec = {
    _uid: uid(),
    id: "",
    name: "",
    category: "return_to_office",
    changedDate: "",
    sourceUrl: "",
    notes: "",
    lastVerified: new Date().toISOString().slice(0, 10),
  };
  rows.unshift(rec);
  render();
  const firstInput = body.querySelector("tr input");
  if (firstInput) firstInput.focus();
});

// ---------- Settings / PAT ----------
const modal = $("#modal-settings");
$("#btn-settings").addEventListener("click", () => {
  $("#pat-input").value = localStorage.getItem("gh_pat") || "";
  modal.classList.remove("hidden");
});
modal.addEventListener("click", (e) => {
  if (e.target === modal) modal.classList.add("hidden");
});
$("#btn-pat-save").addEventListener("click", () => {
  const v = $("#pat-input").value.trim();
  if (v) localStorage.setItem("gh_pat", v);
  modal.classList.add("hidden");
});
$("#btn-pat-clear").addEventListener("click", () => {
  localStorage.removeItem("gh_pat");
  $("#pat-input").value = "";
});

function getToken() {
  return localStorage.getItem("gh_pat");
}

// ---------- Propose changes: fork -> branch -> commit -> PR ----------
async function gh(path, token, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github+json",
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
      ...opts.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${opts.method || "GET"} ${path} -> ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.status === 204 ? null : res.json();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function proposeChanges() {
  const token = getToken();
  if (!token) {
    log("先に「設定」からGitHubトークンを登録してください。");
    modal.classList.remove("hidden");
    return;
  }

  const btn = $("#btn-propose");
  btn.disabled = true;

  try {
    log("GitHubアカウントを確認中…");
    const me = await gh("/user", token);
    const username = me.login;

    let fork;
    try {
      fork = await gh(`/repos/${username}/${REPO}`, token);
      log(`既存のフォーク ${username}/${REPO} を使用します…`);
    } catch {
      log(`${username}/${REPO} をフォーク中…`);
      fork = await gh(`/repos/${OWNER}/${REPO}/forks`, token, { method: "POST" });
      // Forking is async on GitHub's side; wait for it to become available.
      for (let i = 0; i < 10; i++) {
        await sleep(1500);
        try {
          await gh(`/repos/${username}/${REPO}`, token);
          break;
        } catch {
          /* keep waiting */
        }
      }
    }

    const branchName = `edit-${Date.now()}`;
    log("フォークの最新コミットを取得中…");
    const ref = await gh(`/repos/${username}/${REPO}/git/ref/heads/${BASE_BRANCH}`, token);
    const baseSha = ref.object.sha;

    log(`ブランチ ${branchName} を作成中…`);
    await gh(`/repos/${username}/${REPO}/git/refs`, token, {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: baseSha }),
    });

    log("変更内容をコミット中…");
    const fileInfo = await gh(
      `/repos/${username}/${REPO}/contents/${FILE_PATH}?ref=${branchName}`,
      token
    );

    const cleaned = rows.map(({ _uid, ...rest }) => rest);
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(cleaned, null, 2) + "\n")));

    await gh(`/repos/${username}/${REPO}/contents/${FILE_PATH}`, token, {
      method: "PUT",
      body: JSON.stringify({
        message: "data: 企業リストを更新",
        content,
        sha: fileInfo.sha,
        branch: branchName,
      }),
    });

    log("プルリクエストを作成中…");
    const pr = await gh(`/repos/${OWNER}/${REPO}/pulls`, token, {
      method: "POST",
      body: JSON.stringify({
        title: "データ更新の提案",
        head: `${username}:${branchName}`,
        base: BASE_BRANCH,
        body: "アプリ内の編集画面から自動生成されたプルリクエストです。内容を確認してマージしてください。",
      }),
    });

    log(`✓ プルリクエストを作成しました: ${pr.html_url}`);
    window.open(pr.html_url, "_blank");
  } catch (err) {
    log(`エラー: ${err.message}`);
  } finally {
    btn.disabled = false;
  }
}

$("#btn-propose").addEventListener("click", proposeChanges);

loadData();
