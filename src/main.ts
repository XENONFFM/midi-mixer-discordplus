import "midi-mixer-plugin";
import { DcApi } from "./dcApi";
import { clientUpdate, userUpdate } from "./dcApiTypes";
import { MmApi } from "./mmApi";

let dcApi: DcApi | null = null;
let mmApi: MmApi | null = null;

const cleanUpConnections = async () => {
  await Promise.all([
    new Promise<void>((resolve) => {
      if (!dcApi) return resolve();

      dcApi.disconnect().finally(() => {
        dcApi = null;
        resolve();
      });
    }),
  ]);
  mmApi?.disconnect();
  $MM.setSettingsStatus("status", "Disconnected");
};

$MM.onClose(async () => {
  await cleanUpConnections();
});

const connect = async () => {
  /**
   * Disconnect any running instances.
   */
  await cleanUpConnections();

  const settings = await $MM.getSettings();

  const clientId = settings.clientId as string;
  const clientSecret = settings.clientSecret as string;
  let userCount = settings.userCount as string;

  const clientIdValid = Boolean(clientId) && typeof clientId === "string";
  const clientSecretValid = Boolean(clientSecret) && typeof clientSecret === "string";

  if (!userCount) userCount = "8";

  if (!clientIdValid || !clientSecretValid) return void $MM.setSettingsStatus( "status", "Error: No or incorrect Client ID or Client Secret." );

  dcApi = new DcApi(clientId, clientSecret);
  mmApi = new MmApi(dcApi);
  mmApi.setup(+userCount);

  $MM.setSettingsStatus("status", "Connecting to Discord ...");
  try {
    await dcApi.connect();
  } catch (err) {
    console.error("Disconected, could not establish connection to discord.", err);
    cleanUpConnections();
  }
  $MM.setSettingsStatus("status", "Connected");

  dcApi.on("Client", (data: clientUpdate) => { mmApi?.updateClientGroup(data) });
  dcApi.on("User", (data: userUpdate) => { mmApi?.updateUserGroup(data) });
};

$MM.onSettingsButtonPress("reconnect", connect);
connect();