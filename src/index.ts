import algosdk, { makeAssetTransferTxnWithSuggestedParamsFromObject } from "algosdk";
import * as algokit from "@algorandfoundation/algokit-utils";
import { SMART_CONTRACT_ARC_32 } from "./client";
import { AppClient } from "@algorandfoundation/algokit-utils/types/app-client";

// The app ID to interact with.
const appId = 736014374;

// Account address
// NDSFN27FY62A5U5YIFYQWWWCYSPHPAM2ZS6RAVEFYTAFPMN3HAYSN3F2RI

async function loadClient() {
  const client = algokit.AlgorandClient.fromConfig({
    algodConfig: {
      server: "https://testnet-api.algonode.cloud",
    },
    indexerConfig: {
      server: "https://testnet-idx.algonode.cloud",
    },
  });

  return client;
}

async function loadAccount() {
  const client = await loadClient();
  const account = client.account.fromMnemonic('');

  return account;
}

async function claimAsset(appId: number) {
  const client = await loadClient();
    const account = await loadAccount();

    const appClient = new AppClient({
        appId: BigInt(appId),
        appSpec: JSON.stringify(SMART_CONTRACT_ARC_32),
        algorand: client,
    });

    const suggestedParams = await client.client.algod.getTransactionParams().do();

    const atc = new algosdk.AtomicTransactionComposer();

    const globalState = await appClient.getGlobalState();
    const assetId = globalState.asset.value;
    console.log(assetId);

    /**
     * Opt into asset
     */
    const assetOptinTxn = makeAssetTransferTxnWithSuggestedParamsFromObject({
        amount: 0,
        from: account.addr,
        to: account.addr,
        suggestedParams,
        assetIndex: Number(assetId),
    });

    atc.addTransaction({
        txn: assetOptinTxn,
        signer: account.signer,
    });

    /**
     * Call asset claim
     */
    atc.addMethodCall({
        method: appClient.getABIMethod('claimAsset'),
        suggestedParams: {
            ...suggestedParams,
            fee: 6_000,
        },
        sender: account.addr,
        signer: account.signer,
        appID: appId,
        appForeignAssets: [Number(assetId)],
    });

    const response = await atc.execute(client.client.algod, 8);
    console.log(response);

    const assetBalance = await client.client.algod.accountAssetInformation(account.addr, Number(assetId)).do();

    console.log('Asset balance', assetBalance);
}

async function main() {
  console.log('Claiming asset...')
  await claimAsset(Number(appId));
  console.log('Asset claimed');
}

main()