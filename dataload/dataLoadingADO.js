const axios = require("axios");

function extractWorkItemId(adoUrl) {
  const match = adoUrl.match(/_workitems\/edit\/(\d+)/);
  return match ? match[1] : null;
}

function extractOrgAndProject(adoUrl) {
  // Supports both formats:
  //   https://dev.azure.com/{org}/{project}/...
  //   https://{org}.visualstudio.com/{project}/...
  const devAzureMatch = adoUrl.match(
    /dev\.azure\.com\/([^/]+)\/([^/]+)/
  );
  if (devAzureMatch) {
    return { organization: devAzureMatch[1], project: devAzureMatch[2] };
  }

  const vsMatch = adoUrl.match(
    /([^/]+)\.visualstudio\.com\/([^/]+)/
  );
  if (vsMatch) {
    return { organization: vsMatch[1], project: vsMatch[2] };
  }

  return null;
}

function createAdoClient(config) {
  const pat = config.adoPat;
  const authHeader =
    "Basic " + Buffer.from(":" + pat).toString("base64");

  async function getWorkItemByUrl(adoUrl) {
    const workItemId = extractWorkItemId(adoUrl);
    if (!workItemId) {
      throw new Error(`Cannot extract work item ID from URL: ${adoUrl}`);
    }

    const orgProject = extractOrgAndProject(adoUrl);
    const organization = orgProject
      ? orgProject.organization
      : config.adoOrg;
    const project = orgProject ? orgProject.project : undefined;

    const baseUrl = `https://dev.azure.com/${organization}`;
    const apiPath = project
      ? `${baseUrl}/${project}/_apis/wit/workitems/${workItemId}`
      : `${baseUrl}/_apis/wit/workitems/${workItemId}`;

    const response = await axios.get(apiPath, {
      headers: {
        Authorization: authHeader,
        Accept: "application/json"
      },
      params: { "api-version": "7.0" }
    });

    const fields = response.data.fields || {};

    return {
      id: response.data.id,
      url: adoUrl,
      title: fields["System.Title"] || "",
      state: fields["System.State"] || "",
      workItemType: fields["System.WorkItemType"] || "",
      assignedTo: fields["System.AssignedTo"]?.displayName || "",
      areaPath: fields["System.AreaPath"] || "",
      iterationPath: fields["System.IterationPath"] || ""
    };
  }

  async function getWorkItemsByUrls(adoUrls) {
    const results = [];

    for (const url of adoUrls) {
      try {
        const item = await getWorkItemByUrl(url);
        results.push(item);
      } catch (error) {
        results.push({
          url,
          error: error.response
            ? `HTTP ${error.response.status}: ${error.response.statusText}`
            : error.message
        });
      }
    }

    return results;
  }

  return { getWorkItemByUrl, getWorkItemsByUrls };
}

module.exports = { createAdoClient };
