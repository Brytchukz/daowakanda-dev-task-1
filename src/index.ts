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

async function connectWallet() {
  const connector = new WalletConnect({
    bridge: "https://bridge.walletconnect.org",
    qrcodeModal: QRCodeModal,
  });

  if (!connector.connected) {
    await connector.createSession();
  }

  return connector;
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

    // Connect wallet
    const connector = await connectWallet();

    // Request signing
    const txnsToSign = [{ txn: algosdk.encodeUnsignedTransaction(txn) }];
    const signedTxns = await connector.signTransaction(txnsToSign);

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
