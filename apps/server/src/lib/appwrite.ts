import { Adapter, BuildRuntime, Client, Framework, Sites } from "node-appwrite";

export async function checkValidity({
  region,
  appwriteProjectId,
  apiKey,
}: {
  region: string;
  appwriteProjectId: string;
  apiKey: string;
}) {
  const client = new Client()
    .setEndpoint(`https://${region}.cloud.appwrite.io/v1`)
    .setProject(appwriteProjectId)
    .setKey(apiKey);

  const sites = new Sites(client);
  try {
    const result = await sites.list();
    console.log(result);
    return true;
  } catch {
    return false;
  }
}

export async function findSite({
  region,
  appwriteProjectId,
  apiKey,
  siteId,
}: {
  region: string;
  appwriteProjectId: string;
  apiKey: string;
  siteId: string;
}) {
  const client = new Client()
    .setEndpoint(`https://${region}.cloud.appwrite.io/v1`)
    .setProject(appwriteProjectId)
    .setKey(apiKey);

  const sites = new Sites(client);
  try {
    const result = await sites.get({ siteId });
    console.log(result);
    return result.$id;
  } catch {
    return false;
  }
}

export async function createSite({
  region,
  appwriteProjectId,
  apiKey,
  siteId,
}: {
  region: string;
  appwriteProjectId: string;
  apiKey: string;
  siteId: string;
}) {
  const client = new Client()
    .setEndpoint(`https://${region}.cloud.appwrite.io/v1`)
    .setProject(appwriteProjectId)
    .setKey(apiKey);

  const sites = new Sites(client);
  try {
    const result = await sites.create({
      siteId,
      buildRuntime: BuildRuntime.Bun11,
      framework: Framework.Vite,
      name: "Vibe Project",
      adapter: Adapter.Static,
      installCommand: "bun install",
      buildCommand: "bun run build",
      outputDirectory: "./dist",
    });
    console.log(result);
    return result.$id;
  } catch {
    return false;
  }
}

export async function ensureSite({
  region,
  appwriteProjectId,
  apiKey,
  siteId,
}: {
  region: string;
  appwriteProjectId: string;
  apiKey: string;
  siteId: string;
}) {
  const exists = await findSite({ region, appwriteProjectId, apiKey, siteId });
  if (exists) {
    console.log(`Site ${siteId} already exists.`);
    return exists;
  }

  const created = await createSite({
    region,
    appwriteProjectId,
    apiKey,
    siteId,
  });
  if (created) {
    console.log(`Site ${siteId} created successfully.`);
  } else {
    console.log(`Failed to create site ${siteId}.`);
    throw new Error(`Failed to create site ${siteId}.`);
  }
  return created;
}
