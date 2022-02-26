import { Assignment, ButtonType } from "midi-mixer-plugin";
import { DcApi } from "./dcApi";
import { clientUpdate, userUpdate } from "./dcApiTypes";

enum DcButton {
  ToggleDeafen = "toggleDeafen",
  ToggleMute = "toggleMute",
}

enum DcFader {
  InputVolume = "inputVolume",
  OutputVolume = "outputVolume",
}

export class MmApi {
  private buttons: Record<DcButton, ButtonType> | null = null;
  private faders: Record<DcFader, Assignment> | null = null;
  private userGroup: Assignment[] = [];
  private clientGroup?: Record<DcFader, Assignment> | null = null;
  private dcApi: DcApi;
  constructor(discordApi: DcApi) {
    this.dcApi = discordApi;
  }

  public setup(userCount: number) {
    this.initializeButtons();
    this.initializeFaders(userCount);
  }

  private initializeFaders(userCount: number) {
    for (let i = 0; i <= (userCount - 1); i++) {
      this.userGroup.push(new Assignment("DcUser" + i, { name: "VoiceUser " + (i + 1), throttle: 50 })
        .on("mutePressed", async () => {
          if (this.dcApi.user[i]) this.dcApi.user[i].toggleMute();
        })
        .on("volumeChanged", async (level: number) => {
          if (this.dcApi.user[i]) this.dcApi.user[i].setVolume(Math.round(level * 200));
        }))
    }

    this.clientGroup = {
      [DcFader.InputVolume]: new Assignment("Input", { name: "Input", throttle: 250 })
        .on("mutePressed", async () => {
          if (this.dcApi.client) this.dcApi.client.toggleMute();
        })
        .on("volumeChanged", async (level: number) => {
          if (this.dcApi.client) this.dcApi.client.setInputVolume(level * 200);
        }),
      [DcFader.OutputVolume]: new Assignment("Output", { name: "Output", throttle: 250 })
        .on("mutePressed", async () => {
          if (this.dcApi.client) this.dcApi.client.toggleDeaf();
        })
    }
  }

  private initializeButtons() {
    this.buttons = {
      [DcButton.ToggleMute]: new ButtonType(DcButton.ToggleMute, {
        name: "Toggle mute | Discord+",
        active: true,
      }).on("pressed", async () => {
        if (this.dcApi.client) this.dcApi.client.toggleMute();
      }),
      [DcButton.ToggleDeafen]: new ButtonType(DcButton.ToggleDeafen, {
        name: "Toggle deafen | Discord+",
        active: false,
      }).on("pressed", async () => {
        if (this.dcApi.client) this.dcApi.client.toggleDeaf();
      }),
    };
  }

  public disconnect() {
    Object.values(this.buttons ?? {}).forEach((button) => void button.remove());
    Object.values(this.faders ?? {}).forEach((fader) => void fader.remove());
    Object.values(this.clientGroup ?? {}).forEach((fader) => void fader.remove());
    Object.values(this.userGroup ?? {}).forEach((fader) => void fader.remove());
  }

  public updateUserGroup(data: userUpdate) {
    if (data.name) {
      this.userGroup[data.id].name = data.name;
      if (data.mute) this.userGroup[data.id].muted = data.mute;
      if (data.volume) this.userGroup[data.id].volume = data.volume / 200;
    } else {
      this.userGroup[data.id].name = "VoiceUser " + (data.id + 1);
      this.userGroup[data.id].muted = false;
      this.userGroup[data.id].volume = 0;
    }

  }

  public updateClientGroup(data: clientUpdate) {
    if (this.clientGroup) {
      if (data.volume) this.clientGroup[DcFader.InputVolume].volume = data.volume / 200;
      if (data.mute) this.clientGroup[DcFader.InputVolume].muted = data.mute;
      if (data.deaf) this.clientGroup[DcFader.OutputVolume].muted = data.deaf;
    }
  }
}