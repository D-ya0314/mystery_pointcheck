"use strict";

const LIFF_ID = "2011066044-9W2pagv5";
const GAS_URL =
  "https://script.google.com/macros/s/AKfycbz1eSFLwxabykW89URs1gj_FBjxEeMJr6GjUOYYUdgqaS4pW9hPjVresViL_XM5bu6r/exec";

const isHistoryPage = new URLSearchParams(window.location.search).get("view") === "history";

function renderPointHistory(history, limit = Infinity) {
  const statusElement = document.getElementById("pointHistoryStatus");
  const historyListElement = document.getElementById("pointHistoryList");
  historyListElement.replaceChildren();
  if (history.length === 0) {
    statusElement.textContent = "獲得履歴はありません";
    statusElement.hidden = false;
    historyListElement.hidden = true;
    return;
  }

  const sortedHistory = [...history].sort((a, b) =>
    (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)
  );
  sortedHistory.slice(0, limit).forEach((entry) => {
    const item = document.createElement("li");
    item.className = "m_p point-history-item";
    const date = new Date(entry.createdAt);
    const dateElement = document.createElement("span");
    dateElement.textContent = Number.isNaN(date.getTime())
      ? String(entry.createdAt ?? "")
      : new Intl.DateTimeFormat("ja-JP", {
          year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit",
        }).format(date);
    const categoryElement = document.createElement("span");
    categoryElement.textContent = String(entry.categoryName ?? "");
    const pointElement = document.createElement("span");
    pointElement.textContent = `${entry.point ?? 0} pt`;
    item.append(dateElement, categoryElement, pointElement);
    historyListElement.appendChild(item);
  });
  statusElement.hidden = true;
  historyListElement.hidden = false;
}

async function loadPointHistory(userId) {
  const statusElement = document.getElementById("pointHistoryStatus");
  const historyListElement = document.getElementById("pointHistoryList");

  const showStatus = (message) => {
    statusElement.textContent = message;
    statusElement.hidden = false;
    historyListElement.hidden = true;
    historyListElement.replaceChildren();
  };

  try {
    const response = await fetch(GAS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify({
        action: "getPointHistory",
        userId: userId,
      }),
    });

    if (!response.ok) {
      throw new Error("ポイント獲得履歴を取得できませんでした");
    }

    const result = await response.json();

    if (!result.success || !Array.isArray(result.history)) {
      showStatus("開発中");
      return;
    }

    renderPointHistory(result.history, isHistoryPage ? Infinity : 3);
  } catch (error) {
    showStatus("開発中");
  }
}

async function main() {
  document.getElementById("pointOverview").hidden = isHistoryPage;
  document.getElementById("historyDetailsLink").hidden = isHistoryPage;
  document.getElementById("historyBackLink").hidden = !isHistoryPage;
  document.getElementById("historyHeading").textContent = isHistoryPage
    ? "ポイント獲得履歴（全履歴）" : "ポイント獲得履歴（最新3件）";
  if (isHistoryPage) {
    document.title = "ポイント獲得履歴 | 探偵手帳";
  }
  // ローカルではLINE認証や本番APIを使わず、画面確認用の値を表示する。
  const isLocal =
    window.location.protocol === "file:" ||
    ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);

  if (isLocal) {
    document.getElementById("status").textContent =
      "ローカルプレビュー（サンプルデータ）";
    document.getElementById("point").textContent = "100";
    document.getElementById("rank").textContent = "1";
    document.getElementById("totalUsers").textContent = "10";
    document.getElementById("nextReward").textContent = "サンプル特典";
    document.getElementById("nextPoint").textContent = "あと 100 pt";
    document.getElementById("unlockedRewards").textContent =
      "まだ解放された特典はありません";
    document.getElementById("historyPreviewNotice").hidden = false;
    renderPointHistory([
      { createdAt: "2026-11-02T10:00:00+09:00", categoryName: "サンプル：謎解き", point: 30 },
      { createdAt: "2026-11-01T15:00:00+09:00", categoryName: "サンプル：来店", point: 10 },
      { createdAt: "2026-10-31T12:00:00+09:00", categoryName: "サンプル：謎解き", point: 20 },
      { createdAt: "2026-10-30T14:00:00+09:00", categoryName: "サンプル：来店", point: 10 },
      { createdAt: "2026-10-29T16:00:00+09:00", categoryName: "サンプル：謎解き", point: 30 },
    ], isHistoryPage ? Infinity : 3);
    document.getElementById("result").style.display = "block";
    return;
  }

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

    // 履歴APIが未準備または取得に失敗した場合は「開発中」を表示します。
    const historyRequest = loadPointHistory(userId);
    if (isHistoryPage) {
      await historyRequest;
      return;
    }

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
        <p class="m_p">
          🎁 ${reward.rewardName}<br>
          <small>使用済み</small>
        </p>
      `;
        } else {
          div.innerHTML = `
        <p class="m_p">
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

/*---------- ハンバーガーメニュー ----------*/
const hamburger = document.querySelector(".js_hamburger");
const navigation = document.querySelector(".js_nav");
const body = document.querySelector(".js_body");
let dwmkbn = 0;

hamburger.addEventListener("click", () => {
  hamburger.classList.toggle("is-active");
  navigation.classList.toggle("is-active");
  // body.classList.toggle("is-active");
  if (body.classList.contains("is-active")) {
    enableScroll();
  } else {
    disableScroll();
  }
  if (dwmkbn === 0) {
    dwmkbn = 1;
  } else {
    dwmkbn = 0;
  }
});

// PC幅でナビゲーションをクリックしても"is-active"がつかないようにします
navigation.addEventListener("click", () => {
  if (window.innerWidth < 1080) {
    hamburger.classList.toggle("is-active");
    navigation.classList.toggle("is-active");
    // body.classList.toggle("is-active");
    if (body.classList.contains("is-active")) {
      enableScroll();
    } else {
      disableScroll();
    }
  }
});

// スマホ（ハンバーガーメニューをクリック）→PC→スマホに画面幅が変更されたとき、強制的に"is-active"を外す
window.addEventListener("resize", () => {
  if (window.innerWidth >= 1080) {
    hamburger.classList.remove("is-active");
    navigation.classList.remove("is-active");
    body.classList.remove("is-active");
  }
});
