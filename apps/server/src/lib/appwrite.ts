import { Client, Sites } from "node-appwrite";

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
