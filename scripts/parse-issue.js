// Issueフォームの本文（Markdown）を解析して data/companies.json に反映するスクリプト
const fs = require("fs");
const path = require("path");

const issueBody = process.env.ISSUE_BODY || "";
const issueNumber = process.env.ISSUE_NUMBER || "0";

function extractField(body, label) {
  // GitHub Issue Forms は "### ラベル\n\n値" という形式でレンダリングされる
  const pattern = new RegExp(`### ${label}\\s*\\n\\n([\\s\\S]*?)(?=\\n### |$)`, "i");
  const match = body.match(pattern);
  if (!match) return "";
  const value = match[1].trim();
  return value === "_No response_" ? "" : value;
}

function slugify(name) {
  return (
    name
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "") || "company"
  );
}

function mapCategory(raw) {
  if (raw.startsWith("return_to_office")) return "return_to_office";
  if (raw.startsWith("remote_committed")) return "remote_committed";
  if (raw.startsWith("hybrid")) return "hybrid";
  return null;
}

const name = extractField(issueBody, "企業名");
const categoryRaw = extractField(issueBody, "分類");
const changedDate = extractField(issueBody, "制度変更日（わかれば） YYYY-MM-DD形式") || null;
const sourceUrl = extractField(issueBody, "出典URL（ニュース記事・公式発表など）");
const notes = extractField(issueBody, "補足情報");

const category = mapCategory(categoryRaw);

if (!name || !category || !sourceUrl) {
  console.error("必須項目が不足しています。解析結果:", { name, category, sourceUrl });
  process.exit(1);
}

const dataPath = path.join(__dirname, "..", "data", "companies.json");
const companies = JSON.parse(fs.readFileSync(dataPath, "utf8"));

const newEntry = {
  id: `${slugify(name)}-${issueNumber}`,
  name,
  category,
  changedDate: changedDate || null,
  sourceUrl,
  notes: notes || "",
  lastVerified: new Date().toISOString().slice(0, 10),
};

// 同名企業が既にあれば更新、なければ追加
const existingIndex = companies.findIndex((c) => c.name === name);
if (existingIndex >= 0) {
  companies[existingIndex] = { ...companies[existingIndex], ...newEntry, id: companies[existingIndex].id };
} else {
  companies.push(newEntry);
}

companies.sort((a, b) => a.name.localeCompare(b.name, "ja"));

fs.writeFileSync(dataPath, JSON.stringify(companies, null, 2) + "\n");
console.log("更新完了:", newEntry);
