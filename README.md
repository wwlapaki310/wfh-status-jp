> 週5出社リスト／テレワーク継続リスト

# WFH Status Japan（仮）

テレワーク移行後に「週5出社」へ戻した企業リストと、信念を持ってテレワークを継続している企業リストを可視化する、**みんなで編集できる静的Webサイト**です。

## コンセプト

- 誰でも閲覧・編集できる（サーバー不要、GitHub Pages でホスティング）
- データは `data/companies.json` に集約
- 編集はこのWebアプリ内で完結させたい（詳細は Issue で検討中）

## データスキーマ（案）

```json
{
  "id": "sony",
  "name": "ソニーグループ",
  "category": "return_to_office", // "return_to_office" | "remote_committed" | "hybrid"
  "changedDate": "2024-04-01",     // 制度変更があった日付（任意）
  "sourceUrl": "https://example.com/news",
  "notes": "週5出社を義務化",
  "lastVerified": "2026-07-15"
}
```

## 進行状況

- [x] リポジトリ作成
- [ ] 編集方式の決定（GitHub PAT埋め込み方式 / Issueフォーム方式 / Decap CMS 等）
- [ ] フロントエンド実装（index.html + JSONデータ表示）
- [ ] 初期データ投入
- [ ] デプロイ（GitHub Pages）

## ライセンス

MIT
