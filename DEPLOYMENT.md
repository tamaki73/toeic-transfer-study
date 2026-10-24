# GitHub Pages 公開済み

公開URL: https://tamaki73.github.io/toeic-transfer-study/

2026年10月24日、ユーザーのフェーズ3承認後にソースを `tamaki73/toeic-transfer-study` の `main` へcommit・pushしました。ユーザーがPagesを有効化し、公開後の確認を完了しています。`188cm-run` には変更を加えていません。

## 公開設定と確認

- GitHub API: `status: built`、`build_type: legacy`、配信元 `main` / `/`。
- 最初のアプリ公開コミット: `afbf975af59126fcd93f5be6dc8f74311c5d633c`。
- HTML・CSS・JS・辞書が公開URLからHTTP 200で取得できることを確認。
- 公開URL上で、PC・モバイル幅を使った14グループのChromium操作検証が成功。
- 公開画面からMyMemoryへ実通信し、日本語訳の表示と、翻訳だけでは自動登録しないことを確認。
- 元HTMLの無変更コピー、出典・ライセンス付きEJDict、説明書、合成データを使うテストを公開。ユーザーの個人学習データ・バックアップJSON・認証情報はアップロードしていません。

初回はクラウド環境の通信制限でGitHub APIや公開先に接続できませんでしたが、今回はそれらとMyMemoryへの実通信を確認できました。TLS検証は有効のままです。

## 今後の更新と検証

公開アプリはmainから配信されます。ユーザーの依頼に基づき変更を検証・commit・pushした後、GitHubの最新Pagesビルドがそのコミットで成功していることを確認してください。force-pushや他リポジトリへの操作は行いません。

```sh
STUDY_TEST_URL=https://tamaki73.github.io/toeic-transfer-study/ python tests/browser.py
python tests/live_translation.py
```

独立した一時ブラウザプロファイルと合成データだけを使い、ユーザーの実ブラウザでテストをしないでください。クラウドのChromiumでは、環境のプロキシと既存CAへの信頼が必要です。証明書検証を無効にしないでください。

## 残る確認とデータ移行

実機のiPhone Safari・Android Chrome・PC別OSでの操作と、実際の音声出力は未検証です。検証したモバイル表示はChromiumの端末エミュレーションです。

既存のlocalStorageは新しい公開URLへ自動移行されません。READMEの手順で、元のHTMLを使っていた同じ場所・同じブラウザから全体JSONを保存し、公開アプリへ読み込んで照合してください。PCとスマートフォン間の自動同期はなく、当面はJSONで手動移行します。元HTMLとJSONは照合後も保管してください。
