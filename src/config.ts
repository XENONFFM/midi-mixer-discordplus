import Conf from "conf";

export const config = new Conf({
  configName: "com.midi-mixer.discordplus",
});

export enum Keys {
  AuthToken = "authToken",
}
