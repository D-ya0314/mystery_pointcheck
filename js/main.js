const LIFF_ID = "2011066044-9W2pagv5";

const GAS_URL =
  "https://script.google.com/macros/s/AKfycbz1eSFLwxabykW89URs1gj_FBjxEeMJr6GjUOYYUdgqaS4pW9hPjVresViL_XM5bu6r/exec";

async function main() {
  try {
    // =========================
    // LIFF初期化
    // =========================

    await liff.init({
      liffId: LIFF_ID,
    });

    // =========================
    // LINEログイン確認
    // =========================

    if (!liff.isLoggedIn()) {
      liff.login();
      return;
    }

    // =========================
    // LINEプロフィール取得
    // =========================

    const profile = await liff.getProfile();

    const userId = profile.userId;
    const displayName = profile.displayName;

    // console.log("userId:", userId);
    // console.log("displayName:", displayName);

    document.getElementById("status").textContent =
      "ポイントを確認しています……";

    // =========================
    // GASへポイント確認
    // =========================

    const response = await fetch(GAS_URL, {
      method: "POST",

      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },

      body: JSON.stringify({
        action: "getPoint",
        userId: userId,
      }),
    });

    // =========================
    // GASレスポンス
    // =========================

    const result = await response.json();

    // console.log("GAS response:", result);

    if (!result.success) {
      document.getElementById("status").textContent =
        result.message || "ポイント情報を取得できませんでした";

      return;
    }

    // =========================
    // 画面表示
    // =========================

    document.getElementById("status").textContent =
      `${displayName}さんのポイント情報`;

    document.getElementById("point").textContent = result.totalPoint;

    document.getElementById("rank").textContent = result.rank;

    document.getElementById("totalUsers").textContent = result.totalUsers;

    // =========================
    // 次の報酬
    // =========================

    if (result.nextReward) {
      document.getElementById("nextReward").textContent =
        result.nextReward.rewardName;

      const needPoint = result.nextReward.requiredPoint - result.totalPoint;

      document.getElementById("nextPoint").textContent = `あと ${needPoint} pt`;
    } else {
      document.getElementById("nextReward").textContent =
        "すべての報酬を解放済み！🎉";

      document.getElementById("nextPoint").textContent = "";
    }

    // =========================
    // 解放済み特典表示
    // =========================

    const unlockedRewardsElement = document.getElementById("unlockedRewards");

    if (result.unlockedRewards && result.unlockedRewards.length > 0) {
      unlockedRewardsElement.innerHTML = "";

      result.unlockedRewards.forEach((reward) => {
        const div = document.createElement("div");

        if (reward.used) {
          div.innerHTML = `
        <p>
          🎁 ${reward.rewardName}<br>
          <small>使用済み</small>
        </p>
      `;
        } else {
          div.innerHTML = `
        <p>
          🎁 ${reward.rewardName}<br>
          <small>未使用</small>
        </p>
      `;
        }

        unlockedRewardsElement.appendChild(div);
      });
    } else {
      unlockedRewardsElement.textContent = "まだ解放された特典はありません";
    }

    document.getElementById("result").style.display = "block";
  } catch (error) {
    console.error(error);

    document.getElementById("status").textContent = "エラーが発生しました";
  }
}

main();
