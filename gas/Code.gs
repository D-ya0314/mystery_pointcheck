function doGet(e) {
  return ContentService
    .createTextOutput("GAS is working!");
}


function doPost(e) {

  const data = JSON.parse(e.postData.contents);

  // =====================================
  // ポイント確認API
  // =====================================

  if (data.action === "getPoint") {
    return getPointInfo(data);
  }

  if (data.action === "getPointHistory") {
    return getPointHistory(data);
  }
  const userId = data.userId;
  const displayName = data.displayName;
  const categoryId = data.categoryId
  const key = data.key;

  // console.log("userId:", userId);
  // console.log("displayName:", displayName);


  // =====================================
  // スプレッドシート
  // =====================================

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const usersSheet = ss.getSheetByName("Users");
  const historySheet = ss.getSheetByName("PointHistory");
  const categorySheet = ss.getSheetByName("PointCategories");


  // =====================================
  // ユーザー確認
  // =====================================

  const usersData = usersSheet.getDataRange().getValues();

  let userRow = -1;

  for (let i = 1; i < usersData.length; i++) {

    if (usersData[i][0] === userId) {
      userRow = i + 1;
      break;
    }

  }


  // ユーザーが存在しない場合
  if (userRow === -1) {

    usersSheet.appendRow([
      userId,
      displayName,
      0
    ]);

    userRow = usersSheet.getLastRow();

    console.log("新規ユーザー登録");

  }


  // =====================================
  // PUZZLEポイント設定取得
  // =====================================

  const categoryData = categorySheet.getDataRange().getValues();

  let addPoint = 0;

  for (let i = 1; i < categoryData.length; i++) {

    if (
      categoryData[i][0] === categoryId &&
      categoryData[i][3] === true
    ) {

      addPoint = Number(categoryData[i][4]);

      break;

    }

  }


  // PUZZLEが無効の場合
  if (addPoint <= 0) {

    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        message: categoryId + "ポイントが無効です"
      }))
      .setMimeType(ContentService.MimeType.JSON);

  }


  // =====================================
  // 今日の日付
  // =====================================

  const timezone = Session.getScriptTimeZone();

  const today = Utilities.formatDate(
    new Date(),
    timezone,
    "yyyy-MM-dd"
  );

  // 有効期限の確認
  if (key !== today) {

  return ContentService
    .createTextOutput(JSON.stringify({
      success: false,
      granted: false,
      message: "このポイント獲得URLは期限切れです"
    }))
    .setMimeType(ContentService.MimeType.JSON);

}


  // =====================================
  // ポイント履歴確認
  // =====================================

  const historyData = historySheet.getDataRange().getValues();

  let alreadyGranted = false;

  for (let i = 1; i < historyData.length; i++) {

    const historyUserId = historyData[i][1];
    const hisCategoryId = historyData[i][3];
    const createdAt = historyData[i][4];

    if (
      historyUserId === userId &&
      hisCategoryId === categoryId &&
      createdAt
    ) {

      const historyDate = Utilities.formatDate(
        new Date(createdAt),
        timezone,
        "yyyy-MM-dd"
      );

      if (historyDate === today || hisCategoryId === "SPECIAL1"
      ) {

        alreadyGranted = true;
        break;

      }

    }

  }


  // =====================================
  // すでに今日取得済み
  // =====================================

  if (alreadyGranted) {

    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        granted: false,
        message: "ポイントは獲得済みです"
      }))
      .setMimeType(ContentService.MimeType.JSON);

  }


  // =====================================
  // ポイント加算
  // =====================================

  const currentPoint = Number(
    usersSheet.getRange(userRow, 3).getValue()
  ) || 0;

  const newPoint = currentPoint + addPoint;


  // Users更新
  usersSheet
    .getRange(userRow, 3)
    .setValue(newPoint);


  // =====================================
  // ポイント履歴追加
  // =====================================

  const historyId =
    Utilities.getUuid();

  historySheet.appendRow([
    historyId,
    userId,
    addPoint,
    categoryId,
    new Date()
  ]);


  console.log("ポイント付与:", addPoint);

  // ポイントに応じて報酬を自動解放
  checkAndUnlockRewards(userId, newPoint);


  // =====================================
  // 結果返却
  // =====================================

  return ContentService
    .createTextOutput(JSON.stringify({
      success: true,
      granted: true,
      point: addPoint,
      totalPoint: newPoint
    }))
    .setMimeType(ContentService.MimeType.JSON);

}


// =====================================
// ユーザーのポイントに応じて報酬を自動解放する
// =====================================
function checkAndUnlockRewards(userId, totalPoint) {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const rewardsSheet = ss.getSheetByName("Rewards");
  const unlockSheet = ss.getSheetByName("RewardUnlocks");

  if (!rewardsSheet) {
    throw new Error("Rewards シートがありません");
  }

  if (!unlockSheet) {
    throw new Error("RewardUnlocks シートがありません");
  }

  // Rewards取得
  const rewardsData = rewardsSheet.getDataRange().getValues();

  // RewardUnlocks取得
  const unlockData = unlockSheet.getDataRange().getValues();

  // すでに解放済みの rewardId を取得
  const unlockedRewardIds = new Set();

  for (let i = 1; i < unlockData.length; i++) {

    const unlockUserId = unlockData[i][0];
    const rewardId = unlockData[i][1];

    if (unlockUserId === userId) {
      unlockedRewardIds.add(rewardId);
    }
  }

  // Rewardsを確認
  for (let i = 1; i < rewardsData.length; i++) {

    const rewardId = rewardsData[i][0];
    const requiredPoint = Number(rewardsData[i][1]);

    // 必要ポイントに達している
    if (totalPoint >= requiredPoint) {

      // すでに解放済みなら何もしない
      if (unlockedRewardIds.has(rewardId)) {
        continue;
      }

      // RewardUnlocksに追加
      unlockSheet.appendRow([
        userId,
        rewardId,
        new Date(),
        false
      ]);

      console.log(
        "報酬解放:",
        userId,
        rewardId
      );
    }
  }
}


// =====================================
// ポイント確認・順位取得
// =====================================
function getPointInfo(data) {

  const userId = data.userId;

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const usersSheet = ss.getSheetByName("Users");

  if (!usersSheet) {

    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        message: "Usersシートがありません"
      }))
      .setMimeType(ContentService.MimeType.JSON);

  }


  // =====================================
  // Users取得
  // =====================================

  const usersData = usersSheet
    .getDataRange()
    .getValues();


  // =====================================
  // 自分の情報
  // =====================================

  let displayName = "";
  let totalPoint = 0;
  let userExists = false;


  for (let i = 1; i < usersData.length; i++) {

    if (usersData[i][0] === userId) {

      displayName = usersData[i][1];
      totalPoint = Number(usersData[i][2]) || 0;

      userExists = true;

      break;

    }

  }


  // =====================================
  // ユーザーが存在しない場合
  // =====================================

  if (!userExists) {

    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        displayName: "",
        totalPoint: 0,
        rank: 0,
        totalUsers: 0,
        message: "まだポイントを獲得していません"
      }))
      .setMimeType(ContentService.MimeType.JSON);

  }


  // =====================================
  // 全ユーザーのランキング作成
  // =====================================

  const rankings = [];


  for (let i = 1; i < usersData.length; i++) {

    const id = usersData[i][0];
    const name = usersData[i][1];
    const point = Number(usersData[i][2]) || 0;


    if (id) {

      rankings.push({
        userId: id,
        displayName: name,
        point: point
      });

    }

  }


  // =====================================
  // ポイント降順
  // =====================================

  rankings.sort(function(a, b) {

    return b.point - a.point;

  });


  // =====================================
  // 自分の順位
  // =====================================

  let rank = 0;


  for (let i = 0; i < rankings.length; i++) {

    if (rankings[i].userId === userId) {

      rank = i + 1;

      break;

    }

  }

  // =========================
  // 報酬情報
  // =========================

  let nextReward = null;
  const unlockedRewards = [];

  const rewardsSheet = ss.getSheetByName("Rewards");
  const unlockSheet = ss.getSheetByName("RewardUnlocks");

  let unlockData = [];

  const unlockedRewardIds = new Set();


  // =========================
  // RewardUnlocks取得
  // =========================

  if (unlockSheet) {

    unlockData = unlockSheet
      .getDataRange()
      .getValues();

    for (let i = 1; i < unlockData.length; i++) {

      if (unlockData[i][0] === userId) {
        unlockedRewardIds.add(unlockData[i][1]);
      }

    }
  }


  // =========================
  // Rewards取得
  // =========================

  if (rewardsSheet) {

    const rewardsData = rewardsSheet
      .getDataRange()
      .getValues();

    for (let i = 1; i < rewardsData.length; i++) {

      const rewardId = rewardsData[i][0];
      const requiredPoint = Number(rewardsData[i][1]);
      const rewardName = rewardsData[i][2];
      const rewardType = rewardsData[i][3];
      const targetId = rewardsData[i][4];


      // 解放済み
      if (unlockedRewardIds.has(rewardId)) {

        let used = false;

        for (let j = 1; j < unlockData.length; j++) {

          if (
            unlockData[j][0] === userId &&
            unlockData[j][1] === rewardId
          ) {

            used = unlockData[j][3] === true;
            break;

          }

        }

        unlockedRewards.push({
          rewardId: rewardId,
          requiredPoint: requiredPoint,
          rewardName: rewardName,
          rewardType: rewardType,
          targetId: targetId,
          used: used
        });

        continue;
      }


      // 次の報酬
      if (requiredPoint > totalPoint) {

        if (
          nextReward === null ||
          requiredPoint < nextReward.requiredPoint
        ) {

          nextReward = {
            rewardId: rewardId,
            requiredPoint: requiredPoint,
            rewardName: rewardName,
            rewardType: rewardType,
            targetId: targetId
          };

        }

      }

    }
  }

  // =====================================
  // 結果返却
  // =====================================

  return ContentService
    .createTextOutput(JSON.stringify({

      success: true,

      displayName: displayName,

      totalPoint: totalPoint,

      rank: rank,

      totalUsers: rankings.length,

      nextReward: nextReward,

      unlockedRewards: unlockedRewards

    }))
    .setMimeType(ContentService.MimeType.JSON);

}
// =====================================
// ポイント確認画面向けの獲得履歴取得（読み取り専用）
// =====================================
function getPointHistory(data) {
  const jsonResponse = (result) => ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);

  const userId = data.userId;
  if (typeof userId !== "string" || userId.trim() === "") {
    return jsonResponse({ success: false, message: "userIdが必要です" });
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const historySheet = ss.getSheetByName("PointHistory");
    if (!historySheet) {
      return jsonResponse({ success: false, message: "PointHistoryシートがありません" });
    }

    // PointCategories: A列=categoryId、B列=カテゴリ名。
    // カテゴリ名が見つからない履歴はcategoryIdを表示する。
    const categoryNames = new Map();
    const categorySheet = ss.getSheetByName("PointCategories");
    if (categorySheet) {
      const categories = categorySheet.getDataRange().getValues();
      for (let i = 1; i < categories.length; i++) {
        categoryNames.set(String(categories[i][0]), String(categories[i][1] || categories[i][0]));
      }
    }

    // PointHistory: A列=履歴ID、B列=userId、C列=ポイント、D列=categoryId、E列=獲得日時。
    const rows = historySheet.getDataRange().getValues();
    const history = [];
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][1] !== userId) {
        continue;
      }
      const categoryId = String(rows[i][3]);
      const rawDate = rows[i][4];
      const date = rawDate ? new Date(rawDate) : null;
      history.push({
        createdAt: date && !Number.isNaN(date.getTime()) ? date.toISOString() : "",
        categoryName: categoryNames.get(categoryId) || categoryId,
        point: Number(rows[i][2]) || 0
      });
    }

    // 新しい履歴から表示。日時が空の履歴は末尾に並べる。
    history.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return jsonResponse({ success: true, history: history });
  } catch (error) {
    console.error(error);
    return jsonResponse({ success: false, message: "ポイント獲得履歴を取得できませんでした" });
  }
}