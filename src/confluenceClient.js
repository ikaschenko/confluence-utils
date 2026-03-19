const axios = require("axios");

function createClient(config) {
  const headers = {
    Authorization: `Bearer ${config.apiToken}`,
    Accept: "application/json"
  };

  async function getChildPages(parentId) {
    let results = [];
    let start = 0;
    const limit = 50;

    while (true) {
      const response = await axios.get(
        `${config.baseUrl}/rest/api/content/${parentId}/child/page`,
        {
          headers,
          params: { start, limit }
        }
      );

      const pages = response.data.results;
      results = results.concat(pages);

      if (pages.length < limit) {
        break;
      }

      start += limit;
    }

    return results;
  }

  async function getPage(pageId) {
    const response = await axios.get(
      `${config.baseUrl}/rest/api/content/${pageId}`,
      {
        headers,
        params: { expand: "body.storage" }
      }
    );

    return {
      id: response.data.id,
      title: response.data.title,
      body: response.data.body.storage.value
    };
  }

  async function getPageContent(pageId) {
    const page = await getPage(pageId);
    return page.body;
  }

  return { getChildPages, getPageContent, getPage };
}

module.exports = { createClient };
