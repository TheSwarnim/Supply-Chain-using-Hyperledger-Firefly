import { FireFly, FireFlyListener, TokenPool } from "./firefly";

const TIMEOUT = 15 * 1000;

async function createBOLPool(
  carrierff: FireFly,
  poolData: TokenPool,
  carrierws: FireFlyListener
) {
  if (!(await carrierff.getTokenPoolByName(poolData.name))) {
    console.log("BOL pool doesn't exist - creating now");

    await carrierff.createPool(poolData);

    let poolMessage = await carrierws.firstMessageOfType(
      "token_pool_confirmed",
      TIMEOUT
    );
    if (poolMessage === undefined) {
      throw new Error("BOL pool creation failed");
    } else {
      console.log(
        `BOL pool created message : ${JSON.stringify(poolMessage, null, 1)}`
      );
    }
  } else {
    console.log("BOL pool already exists");
  }
}

async function mintBillOfLandingAssetToken(
  carrierff: FireFly,
  poolData: TokenPool,
  carrierws: FireFlyListener,
  carrierAccount: string
) {
  await carrierff.mintToken("1", carrierAccount, poolData.name);

  let receivedMessage = await carrierws.firstMessageOfType(
    "message_confirmed",
    TIMEOUT
  );
  if (receivedMessage === undefined) {
    throw new Error(`Mint was not done.`);
  } else {
    console.log(`Mint message: ${JSON.stringify(receivedMessage, null, 1)}`);
  }
}

async function transferOwnerShipOfBOLAssetToken(
  carrierff: FireFly,
  poolData: TokenPool,
  exporterAccount: string,
  carrierws: FireFlyListener,
  key: string
) {
  const res = await carrierff.transferToken(
    "11",
    poolData.name,
    exporterAccount,
    "Transfer of BOL token",
    key
  );

  let nextReceivedMessage = await carrierws.firstMessageOfType(
    "message_confirmed",
    TIMEOUT
  );
  if (nextReceivedMessage === undefined) {
    throw new Error(
      `Transfer was not done. Verify that this token exists and is starting out in carrier node`
    );
  } else {
    // console.log(nextReceivedMessage.message);
    // console.log(`This is res : ${JSON.stringify(res)}`);
    return res.key;
  }
}

function verifySenderSignature(key: string, senderPublicKey: string) {
  if (key !== senderPublicKey) {
    throw new Error(`Sender signature verification failed.`);
  }
}

async function sendAcknolodgement(fireflyNode: FireFly, message: string) {
  await fireflyNode.bradcastMessage(message);
}

async function main() {
  console.log("Welcome to the Supply Chain CLI");

  const exporterff = new FireFly(5000);
  const carrierff = new FireFly(5001);
  const importerff = new FireFly(5002);
  const importerBankff = new FireFly(5003);

  const exporterws = new FireFlyListener(5000);
  const carrierws = new FireFlyListener(5001);
  //   const importerws = new FireFlyListener(5002);
  //   const importerBankws = new FireFlyListener(5003);

  //   await exporterws.ready();
  await carrierws.ready();
  //   await importerws.ready();
  //   await importerBankws.ready();

  // get accounts
  const accounts = await exporterff.getAccounts();
  const [
    { identity: importerBankAccount },
    { identity: importerAccount },
    { identity: carrierAccount },
    { identity: exporterAccount },
  ] = accounts;

  // initialize Bill of Landing(BOL)
  const poolData: TokenPool = {
    name: "test1",
    type: "nonfungible",
  };

  //  create BOL : create BOL by carrier firefly node
  //   await createBOLPool(carrierff, poolData, carrierws);

  // mint Bill of landing asset token. Owner : carrier
  //   await mintBillOfLandingAssetToken(carrierff, poolData, carrierws, carrierAccount);

  // transfer ownership of asset TOken(BOL) to exporter
  let key = await transferOwnerShipOfBOLAssetToken(
    carrierff,
    poolData,
    exporterAccount,
    carrierws,
    carrierAccount
  );
  // verify sender signature
  console.log(
    `Verifying signature of sender : ${key} and public key : ${carrierAccount}`
  );
  verifySenderSignature(key, carrierAccount);
  // send acknolodgement
  console.log(
    "BOL Token transfer done from carrier node to exporter node. Sending acknowledgement"
  );
  await sendAcknolodgement(exporterff, "BOL Token received successfully");

  // transfer ownership of asset TOken(BOL) to importer
  key = await transferOwnerShipOfBOLAssetToken(
    exporterff,
    poolData,
    importerAccount,
    exporterws,
    exporterAccount
  );
  // verify sender signature
  console.log(
    `Verifying signature of sender : ${key} and public key : ${exporterAccount}`
  );
  verifySenderSignature(key, exporterAccount);
  // send acknolodgement
  console.log(
    "BOL Token transfer done from exporter node to importer node. Sending acknowledgement"
  );
  await sendAcknolodgement(importerff, "BOL Token received successfully");

  exporterws.close();
  carrierws.close();
}

main().catch((err) => {
  console.error(`Failed to run: ${err}`);
  process.exit(1);
});

// .then((res) => {
//   console.log(res);
// })
// .catch((err) => {
//   console.error(err.response.data.error);
//   process.exit(1);
// });
