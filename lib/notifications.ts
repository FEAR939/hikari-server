import { get_schedule } from "./schedule";
import process from "process";

let db_conn;
let scheduledTimeouts = [];

export function createNotificationHandler(db_connection) {
  db_conn = db_connection;
  scheduleNotificationScheduler();
}

function getMillisUntilMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight - now;
}

function scheduleNotificationScheduler() {
  if (process.argv.includes("--run-now")) {
    console.log(
      "--run-now flag detected. Running notification handler immediately.",
    );
    scheduleNotificationHandler();
  }

  const nextRun = new Date(
    Date.now() + getMillisUntilMidnight() + 5 * 60 * 1000,
  ); // + 5 minutes as a safety margin
  console.log(
    `The first Notification job will run at ${nextRun.toISOString()}`,
  );

  // Schedule next run at midnight, then every 24h after that
  setTimeout(
    () => {
      scheduleNotificationHandler();
      setInterval(scheduleNotificationHandler, 24 * 60 * 60 * 1000);
    },
    getMillisUntilMidnight() + 5 * 60 * 1000,
  ); // + 5 minutes as a safety margin
}

async function scheduleNotificationHandler() {
  // Clear any leftover timeouts from the previous day
  for (const id of scheduledTimeouts) {
    clearTimeout(id);
  }
  scheduledTimeouts = [];

  console.log("Notification job started");
  const todaySchedule = await get_schedule();

  for (const episode of todaySchedule) {
    const timeDelta = episode.airingAt - Date.now();
    console.log(`Time delta for episode ${episode.id}: ${timeDelta}ms`);

    if (timeDelta <= 0) {
      await createNotification(episode, "episode.aired");
    } else {
      const timeoutId = setTimeout(() => {
        createNotification(episode, "episode.aired");
      }, timeDelta);
      scheduledTimeouts.push(timeoutId);

      console.log(
        `Scheduled notification for ${new Date(episode.airingAt).toISOString()}`,
      );
    }
  }

  const nextRun = new Date(
    Date.now() + getMillisUntilMidnight() + 5 * 60 * 1000,
  ); // + 5 minutes as a safety margin
  console.log(
    `Notification job finished, next run at ${nextRun.toISOString()}`,
  );
}

async function createNotification(element, type) {
  if (!db_conn) {
    console.warn("Database connection not initialized");
    return;
  }

  if (!element.kitsuId) {
    console.warn("Notification Anime did not have a Kitsu ID");
    return;
  }

  const targetUsers =
    await db_conn`SELECT user_id FROM user_bookmarks WHERE kitsu_id = ${element.kitsuId} AND subscribed = true`;

  if (targetUsers.length === 0) {
    return;
  }

  // Batch insert all notifications in a single query
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
