import algosdk from "algosdk";
import * as algokit from "@algorandfoundation/algokit-utils";
import { SignClient } from "@walletconnect/sign-client";
import QRCodeModal from "algorand-walletconnect-qrcode-modal";
import dotenv from "dotenv";

dotenv.config();

// The app ID to interact with.
const appId = 736014374;
const sender = process.env.MY_ADDRESS; // Replace with your Algorand address

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

import SignClient from "@walletconnect/sign-client";

async function connectWallet() {
  const client = await SignClient.init({
    projectId: "68a0eda170a6615b8ded4b59b3947a93", // Replace with your actual WalletConnect Cloud project ID
    relayUrl: "wss://relay.walletconnect.com",
  });

  const { uri, approval } = await client.connect({
    requiredNamespaces: {
      algorand: {
        methods: ["algo_signTxn"],
        chains: ["algorand:testnet"],
        events: [],
      },
    },
  });

  if (uri) {
    QRCodeModal.open(uri, () => console.log("QR Code Modal closed"));
  }

  await approval();
  return client;
}

async function claimAsset() {
  try {
    const client = await loadClient();
    const algodClient = client.algod();
    const suggestedParams = await algodClient.getTransactionParams().do();

    // Ensure user is opted into the ASA
    const accountInfo = await algodClient.accountInformation(sender).do();
    const globalState = await algodClient.getApplicationByID(appId).do();
    const assetId = globalState['params']['global-state'].find(entry => entry.key === "asset").value.uint;
    
    const optedIn = accountInfo['assets'].some(asset => asset['asset-id'] === assetId);
    if (!optedIn) {
      console.log("You must opt into the ASA before calling claimAsset.");
      return;
    }

    // Create the transaction
    const txn = algosdk.makeApplicationNoOpTxn(sender, suggestedParams, appId, [
      new Uint8Array(Buffer.from("claimAsset"))
    ], undefined, undefined, undefined, undefined, 6000); // Fee of 6000 microAlgos

   const client = await connectWallet();
const txnsToSign = [{ txn: algosdk.encodeUnsignedTransaction(txn) }];
const signedTxns = await client.request({
  topic: client.session.keys[0], 
  chainId: "algorand:testnet",
  request: {
    method: "algo_signTxn",
    params: txnsToSign,
  },
});
    // Send the transaction
    const { txId } = await algodClient.sendRawTransaction(signedTxns).do();
    
    console.log(`Transaction sent with ID: ${txId}`);
    
    // Wait for confirmation
    await algokit.Transaction.waitForConfirmation(algodClient, txId, 4);
    console.log("Asset claimed successfully!");
  } catch (error) {
    console.error("Error claiming asset:", error);
  }
}

claimAsset();
