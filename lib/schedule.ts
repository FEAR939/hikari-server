export async function get_schedule() {
  let todaySchedule = await fetchDailyAiringSchedule();
  todaySchedule = await Promise.all(
    todaySchedule.map(async (episode) => {
      episode.airingAt = episode.airingAt;
      episode.kitsuId = await anilistToKitsuID(episode.media.id);
      return episode;
    }),
  );
  return todaySchedule;
}

const ANILIST_API = "https://graphql.anilist.co";

const AIRING_SCHEDULE_QUERY = `
  query ($page: Int, $start: Int, $end: Int) {
    Page(page: $page, perPage: 50) {
      pageInfo {
        hasNextPage
        currentPage
      }
      airingSchedules(airingAt_greater: $start, airingAt_lesser: $end) {
        airingAt
        episode
        media {
          id
          title {
            romaji
            english
          }
        }
      }
    }
  }
`;

export async function fetchDailyAiringSchedule() {
  const now = new Date();
  // const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDay = new Date("2026-02-15");
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const start = Math.floor(startOfDay.getTime() / 1000);
  const end = Math.floor(endOfDay.getTime() / 1000);

  const allSchedules = [];
  let page = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    try {
      const response = await fetch(ANILIST_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          query: AIRING_SCHEDULE_QUERY,
          variables: { page, start, end },
        }),
      });

      if (!response.ok)
        throw new Error(`AniList responded with ${response.status}`);

      const json = await response.json();
      const schedules = json.data.Page.airingSchedules;
      allSchedules.push(...schedules);

      hasNextPage = json.data.Page.pageInfo.hasNextPage;
      page++;

      // Rate limit: AniList allows 90 req/min
      await new Promise((resolve) => setTimeout(resolve, 700));
    } catch (error) {
      console.error(`Failed to fetch page ${page}:`, error);
      hasNextPage = false;
    }
  }

  return allSchedules;
}

export async function anilistToKitsuID(id: string) {
  const res = await fetch(`https://animeapi.my.id/al/${id}`);
  const json = await res.json();
  return json.kitsu || null;
}
