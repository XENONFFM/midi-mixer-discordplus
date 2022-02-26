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

  $MM.setSettingsStatus("status", "Getting plugin settings...");
  const settings = await $MM.getSettings();

  $MM.getSettings().then((settings) => {
    console.log("Current settings:", settings);
  });

  const clientId = settings.clientId as string;
  const clientSecret = settings.clientSecret as string;
  const userCount = settings.userCount as string;

  const clientIdValid = Boolean(clientId) && typeof clientId === "string";
  const clientSecretValid = Boolean(clientSecret) && typeof clientSecret === "string";

  if (!clientIdValid || !clientSecretValid) {
    return void $MM.setSettingsStatus( "status", "Error: No or incorrect Client ID or Client Secret." );
  }

  dcApi = new DcApi(clientId, clientSecret);
  mmApi = new MmApi(dcApi);

  try {
    await dcApi.connect();
  } catch (err) {
    console.error(err);
    $MM.setSettingsStatus("status", "Error, see developer console for further info.");
    cleanUpConnections();
  }
  dcApi.on("Client", (data: clientUpdate) => { mmApi?.updateClientGroup(data) });
  dcApi.on("User", (data: userUpdate) => { mmApi?.updateUserGroup(data) });
  $MM.setSettingsStatus("status", "Connected");
  mmApi.setup(+userCount);
};

$MM.onSettingsButtonPress("reconnect", connect);
connect();