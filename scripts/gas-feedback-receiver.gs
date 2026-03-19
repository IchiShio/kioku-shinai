/**
 * kioku-shinai フィードバック受信GAS
 *
 * セットアップ:
 * 1. Google Sheets で新規スプレッドシートを作成（名前: kioku-shinai-feedback）
 * 2. 拡張機能 → Apps Script を開く
 * 3. このコードを貼り付けて保存
 * 4. デプロイ → 新しいデプロイ → ウェブアプリ
 *    - 実行するユーザー: 自分
 *    - アクセスできるユーザー: 全員
 * 5. URLをコピーして .env.local の NEXT_PUBLIC_FEEDBACK_URL に設定
 */

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("responses");

    if (!sheet) {
      sheet = ss.insertSheet("responses");
      sheet.appendRow([
        "timestamp", "level", "correct", "total", "accuracy",
        "understanding", "comparison", "volume",
        "feat_etymology", "feat_cognitive", "feat_gap", "feat_hook", "feat_audio", "feat_variety"
      ]);
    }

    const best = data.best || [];
    const accuracy = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;

    sheet.appendRow([
      new Date(data.ts || Date.now()).toISOString(),
      data.level || "",
      data.correct || 0,
      data.total || 0,
      accuracy + "%",
      data.understanding != null ? data.understanding : "",
      data.comparison != null ? data.comparison : "",
      data.volume != null ? data.volume : "",
      best[0] ? "YES" : "",
      best[1] ? "YES" : "",
      best[2] ? "YES" : "",
      best[3] ? "YES" : "",
      best[4] ? "YES" : "",
      best[5] ? "YES" : ""
    ]);

    return ContentService.createTextOutput(JSON.stringify({ status: "ok" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService.createTextOutput("kioku-shinai feedback receiver is running")
    .setMimeType(ContentService.MimeType.TEXT);
}
