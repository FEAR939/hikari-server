import { get_schedule } from "./schedule";
import process from "process";

let db_conn;
let scheduledTimeouts = [];

export function createNotificationHandler(db_connection) {
  db_conn = db_connection;
  scheduleNotificationScheduler();
}

function getMillisUntilUTCMidnight() {
  const now = new Date();
  const nextUTCMidnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  return nextUTCMidnight - now;
}

function scheduleNotificationScheduler() {
  if (process.argv.includes("--run-now")) {
    console.log(
      `${new Date().toISOString()} | --run-now flag detected. Running notification handler immediately.`,
    );
    scheduleNotificationHandler();
  }

  scheduleNextRun();
}

function scheduleNextRun() {
  const millisUntilMidnight = getMillisUntilUTCMidnight();
  const nextRun = new Date(Date.now() + millisUntilMidnight);
  console.log(
    `${new Date().toISOString()} | Next notification job will run at ${nextRun.toISOString()}`,
  );

  // ✅ Reschedules every day instead of using setInterval, preventing drift
  setTimeout(() => {
    scheduleNotificationHandler();
    scheduleNextRun();
  }, millisUntilMidnight + 5000); // 5 second buffer to ensure we're past midnight
}

async function scheduleNotificationHandler() {
  for (const id of scheduledTimeouts) {
    clearTimeout(id);
  }
  scheduledTimeouts = [];

  console.log(`${new Date().toISOString()} | Notification job started`);

  const todaySchedule = await get_schedule();

  for (const episode of todaySchedule) {
    const timeDelta = episode.airingAt - Date.now();
    if (timeDelta <= 0) {
      await createNotification(episode, "episode.aired");
    } else {
      const timeoutId = setTimeout(() => {
        createNotification(episode, "episode.aired");
      }, timeDelta);
      scheduledTimeouts.push(timeoutId);
      console.log(
        `${new Date().toISOString()} | Scheduled notification for ${new Date(episode.airingAt).toISOString()}`,
      );
    }
  }

  console.log(
    `${new Date().toISOString()} | Notification job finished, next run at ${new Date(Date.now() + getMillisUntilUTCMidnight()).toISOString()}`,
  );
}

async function createNotification(element, type) {
  if (!db_conn) {
    console.warn(
      `${new Date().toISOString()} | Database connection not initialized`,
    );
    return;
  }
  if (!element.kitsuId) {
    console.warn(
      `${new Date().toISOString()} | Notification Anime did not have a Kitsu ID, anilist ID = ${element.media.id}`,
    );
    return;
  }

  const targetUsers =
    await db_conn`SELECT user_id FROM user_bookmarks WHERE kitsu_id = ${element.kitsuId} AND subscribed = true`;

  if (targetUsers.length === 0) {
    return;
  }

  const rows = targetUsers.map((user) => ({
    user_id: user.user_id,
    title: `Anime ${element.kitsuId} Episode ${element.episode} just aired`,
    type,
    kitsu_id: element.kitsuId,
    anilist_id: element.media.id,
    episode_number: element.episode,
  }));

  await db_conn`INSERT INTO notifications ${db_conn(rows, "user_id", "title", "type", "kitsu_id", "anilist_id", "episode_number")}`;
}
