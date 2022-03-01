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
      this.userGroup.push(new Assignment("DcUser" + i, { name: "VoiceUser " + (i + 1), volume: 0, throttle: 50 })
        .on("mutePressed", async () => {
          if (this.dcApi.user[i]) this.dcApi.user[i].toggleMute();
        })
        .on("volumeChanged", async (level: number) => {
          if (this.dcApi.user[i]) this.dcApi.user[i].setVolume(Math.round(level * 200));
        }))
    }

    this.clientGroup = {
      [DcFader.InputVolume]: new Assignment("Input", { name: "Input", volume: 0,  throttle: 50 })
        .on("mutePressed", async () => {
          if (this.dcApi.client) this.dcApi.client.toggleMute();
        })
        .on("volumeChanged", async (level: number) => {
          if (this.dcApi.client) this.dcApi.client.setInputVolume(Math.round(level * 100));
        }),
      [DcFader.OutputVolume]: new Assignment("Output", { name: "Output", volume: 0,  throttle: 50 })
        .on("mutePressed", async () => {
          if (this.dcApi.client) this.dcApi.client.toggleDeaf();
        })
    }
  }

  private initializeButtons() {
    this.buttons = {
      [DcButton.ToggleMute]: new ButtonType(DcButton.ToggleMute, {
        name: "Toggle mute | Discord+",
        active: false,
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

  public updateUserGroup(data: userUpdate) { //TODO rework
    if (this.userGroup[data.id]) {
      switch (data.type) {
        case("DELETE"): {
          this.userGroup[data.id].name = "VoiceUser " + (data.id + 1);
          this.userGroup[data.id].muted = false;
          this.userGroup[data.id].volume = 0;
        }
        case("CREATE"): {
          if(data.name) {
            this.userGroup[data.id].name = data.name;
            if (data.mute) this.userGroup[data.id].muted = data.mute;
            if (data.volume) this.userGroup[data.id].volume = data.volume / 200;
          }
        }
        case("UPDATE"): {
          if (data.mute) this.userGroup[data.id].muted = data.mute;
          if (data.volume) this.userGroup[data.id].volume = data.volume / 200;
        }
      }
    }
  }

  public updateClientGroup(data: clientUpdate) { //TODO rework
    if (this.clientGroup) {
      if (data.InputVolume) this.clientGroup[DcFader.InputVolume].volume = data.InputVolume / 100;
      if (data.mute) {this.clientGroup[DcFader.InputVolume].muted = data.mute;}
      if (data.deaf) this.clientGroup[DcFader.OutputVolume].muted = data.deaf;
    }
    if (this.buttons) {
      if(data.mute) this.buttons[DcButton.ToggleMute].active = data.mute;
      if(data.deaf) this.buttons[DcButton.ToggleDeafen].active = data.deaf;
    }
  }
}