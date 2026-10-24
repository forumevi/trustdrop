import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

const apiKey = process.env.CIRCLE_API_KEY;
const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

if (!apiKey) { console.error("CIRCLE_API_KEY missing"); process.exit(1); }
if (!entitySecret) { console.error("CIRCLE_ENTITY_SECRET missing"); process.exit(1); }

console.log("API key prefix:", apiKey.split(":")[0]);
console.log("Entity secret length:", entitySecret.length);

try {
  const client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });
  const res = await client.listWalletSets({ pageSize: 1 });
  console.log("OK - wallet sets:", res.data?.walletSets?.length ?? 0);
} catch (e: unknown) {
  console.error("FAIL:", e instanceof Error ? e.message : String(e));
}
