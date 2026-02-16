import { get_schedule } from "./schedule";

let db_conn;

export function createNotificationHandler(db_connection) {
  db_conn = db_connection;

  scheduleNotificationScheduler();
}

function scheduleNotificationScheduler() {
  scheduleNotificationHandler();
  setInterval(scheduleNotificationHandler, 24 * 60 * 60 * 1000);
}

async function scheduleNotificationHandler() {
  console.log("Notification job started");
  const todaySchedule = await get_schedule();
  todaySchedule.forEach(async (episode) => {
    const notification = await createNotification(episode, "episode.airing");
  });
  console.log(
    "Notification job finished, will run again at ",
    new Date(Date.now() + 24 * 60 * 60 * 1000),
  );
}

async function createNotification(element, type) {
  if (!db_conn) {
    console.warn("Database connection not initialized");
    return;
  }

  if (!element.kitsu_id) {
    console.warn("Notification Anime did not have a Kitsu ID");
    return;
  }

  const targetUsers =
    await db_conn`SELECT user_id FROM user_bookmarks WHERE kitsu_id = ${element.kitsu_id}`;

  if (targetUsers.length === 0) {
    return;
  }

  targetUsers.forEach(async (user) => {
    const notification_title = `Anime ${element.kitsu_id} Episode ${element.episode} just aired`;
    await db_conn`INSERT INTO notifications (user_id, title, type, kitsu_id, anilist_id, episode_number) VALUES (${user.user_id}, ${notification_title}, ${type}, ${element.kitsu_id}, ${element.media.id}, ${element.episode})`;
  });
}
