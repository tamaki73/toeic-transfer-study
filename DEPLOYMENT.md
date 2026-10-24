# GitHub公開の進行状況

2026年10月24日。ユーザーからフェーズ3（commit・push・GitHub Pages公開）の承認を取得しています。

- 対象: 既存の `tamaki73/toeic-transfer-study`、ブランチ `main`。
- 公開対象: アプリ、同梱辞書・CC0ライセンス、元HTMLの無変更コピー、説明書、合成データを使うテスト。
- 公開しないもの: ユーザーのブラウザ内の学習記録、学習JSON、認証情報。ファイル確認と秘密情報パターン検査で問題は見つかりませんでした。
- フェーズ2では保存関連17テストと実Chromiumの14検証グループが成功。詳細は `TEST_RESULTS.md`。

## 現在の公開制約

Gitの読み取り・push経路とGitHub APIの通信経路は別です。現環境ではGitは利用できますが、Pages設定の読み書きに必要な `https://api.github.com/` への接続が `Forbidden` で拒否されました。API用環境変数の存在は確認していますが、実際のAPI認証・権限はまだ検証できていません。

このため、GitHub Pagesを有効化したとはまだ主張できません。通常の構成での公開予定URLは `https://tamaki73.github.io/toeic-transfer-study/` ですが、GitHubによる公開完了とHTTP応答を確認するまでは未確認です。

## 残る作業

1. エージェントによる設定・検証を続ける場合は、クラウド環境の設定案を確認・保存し、クラウド環境をPublishして通信許可を反映する。設定案には `api.github.com`、`tamaki73.github.io`、`api.mymemory.translated.net` を保存済み。既存の通信プリセットは維持。クラウド環境のPublishは、GitHub Pagesの公開とは別の操作。
2. GitHub Pages設定を確認し、未設定なら `main` の `/(root)` を配信元として有効化する。API権限が不足する場合は、ユーザーがGitHubのSettings → Pagesから同じ設定を保存する。
3. GitHubが表示する公開URLでHTML、CSS、JavaScript、辞書が取得できることを確認する。独立した合成データ用のブラウザで検索・登録・復習・チェック・スコア・JSON復元・再読み込みを検証する。ユーザーの実データは検証に使わない。
4. MyMemory実通信、実機のPC/スマートフォン、音声再生を確認する。未検証項目を成功扱いにしない。

再開時にソースのpush完了は `git ls-remote origin refs/heads/main` とローカルHEADの一致で確認してください。既存のmainをforce-pushせず、必要な公開設定以外は変更しないでください。
