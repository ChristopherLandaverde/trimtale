import { GtmDiscoveryClient } from "./google.js";

const accessToken = process.env.GOOGLE_GTM_ACCESS_TOKEN?.trim();
if (!accessToken) {
  throw new Error(
    "GOOGLE_GTM_ACCESS_TOKEN is required. Supply a short-lived token with tagmanager.readonly scope.",
  );
}

const accounts = await new GtmDiscoveryClient(async () => accessToken).discover();
const containerCount = accounts.reduce((total, account) => total + account.containers.length, 0);

console.log(
  `Real Google discovery passed: ${accounts.length} account(s), ${containerCount} container(s).`,
);
