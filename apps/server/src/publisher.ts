/** biome-ignore-all lint/style/noNonNullAssertion: <idcatp> */
import child_process from "node:child_process";
import { promisify } from "node:util";
import { Client, Sites } from "node-appwrite";
import { InputFile } from "node-appwrite/file";

const exec = promisify(child_process.exec);

//!NOTE: This file will be used in sandbox to deploy user's code
async function main() {
  const requiredEnvs = [
    "APPWRITE_REGION",
    "APPWRITE_PROJECT_ID",
    "APPWRITE_API_KEY",
    "APPWRITE_SITE_ID",
  ];

  const missingEnvs = requiredEnvs.filter((env) => !process.env[env]);

  if (missingEnvs.length > 0) {
    console.error("Missing environment variables:", missingEnvs);
    process.exit(1);
  }

  const endpoint = `https://${process.env.APPWRITE_REGION}.cloud.appwrite.io/v1`;
  const client = new Client()
    .setEndpoint(endpoint)
    .setProject(process.env.APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);

  const sites = new Sites(client);

  const proc = await exec(
    "tar -czf /publisher/site.tar.gz --exclude=node_modules -C /workspace ."
  );

  console.log(proc.stdout);
  console.error(proc.stderr);

  const deployment = await sites.createDeployment({
    activate: true,
    siteId: process.env.APPWRITE_SITE_ID!,
    code: InputFile.fromPath("./site.tar.gz", "site.tar.gz"),
  });

  const separator = "====>";
  console.log(`${separator}deploymentId:${deployment.$id}${separator}`);
  return process.exit(0);
}

main();
