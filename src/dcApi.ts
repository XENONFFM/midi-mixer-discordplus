import RPC, { VoiceSettings } from "discord-rpc";
import { config, Keys } from "./config";
import { EventEmitter } from 'events';
import { voiceChannelSelectPayload, voiceSettingsPayload } from "./dcApiTypes";

export class DcApi extends EventEmitter {
  private static scopes = [
    "rpc",
    "rpc.voice.read",
    "rpc.voice.write",
  ];
  
  private rpc?: RPC.Client;
  
  private clientId: string;
  private clientSecret: string;
  
  private channel?: RPC.Channel;
  private myClientId: string = "";
  private currentVcId?: string;
  private previousVcId?: string;
  public client?: voiceClient;
  public user: voiceUser[] = [];
  
  constructor(clientId: string, clientSecret: string) {
    super()
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }
  
  public async connect(): Promise<void> {
    let connected = false;
    let logedin = false;
    let accessToken = config.get(Keys.AuthToken) as string;
    this.rpc = new RPC.Client({ transport: "ipc" });
    
    /**
    console.log("Socket1:", (this.rpc as any).transport);
    while(!(this.rpc as any).transport.socket) {
      console.warn("Discord Application not running.");
      this.emit("Warn", "Discord Application not running.");
      await new Promise(resolve => setTimeout(resolve, 5000));
      this.rpc = new RPC.Client({ transport: "ipc" });
    }*/
    
    this.rpc.on("ready", () => { console.log("READY"); logedin = true });
    this.rpc.on("connected", () => { console.log("CONNECTED"); connected = true });
    // @ts-ignore
    console.log("Socket2:", this.rpc, this.rpc._connectPromise);
    
    while (!connected) {
      await this.rpc.connect(this.clientId)
        .catch(async (err) => {
          console.warn("Could not establish connection to discord. retrying in 15 seconds.", err);
          this.emit("Warn", "No discord client running");
          await new Promise(resolve => setTimeout(resolve, 5000));
          this.rpc = new RPC.Client({ transport: "ipc" });
          this.rpc.on("ready", () => { console.log("READY"); logedin = true });
          this.rpc.on("connected", () => { console.log("CONNECTED"); connected = true });
        })
    }

    // @ts-ignore
    console.log("Socket3:", this.rpc, this.rpc._connectPromise);

    while (!logedin) {
      if (accessToken && typeof accessToken === "string") {
        await this.rpc.login({ clientId: this.clientId, accessToken: accessToken, scopes: DcApi.scopes })
          .then((data: any) => { config.set(Keys.AuthToken, data.accessToken) })
          .catch(async (err) => {
            config.delete(Keys.AuthToken);
            console.warn("Failed to authorise using existing token.", err);
            await this.authorize();
          })
      } else {
        await this.authorize();
      }
    }
    console.log("Connected", this.rpc.application);
    this.myClientId = this.rpc.user.id;
    this.setup();
  }

  private async authorize() {
    console.log("Waiting for user authorisation");
    this.emit("Warn", "Waiting for user authorisation");

    await this.rpc?.login({ clientId: this.clientId, clientSecret: this.clientSecret, scopes: DcApi.scopes, redirectUri: "http://localhost/" })
      .then((data: any) => { config.set(Keys.AuthToken, data.accessToken) })
      .catch(async (err) => {
        console.warn("User declined authorisation. Retrying in 5 seconds.", err);
        this.emit("Warn", "User declined authorisation. Retrying in 5 seconds.");
        await new Promise(resolve => setTimeout(resolve, 5000));
      });
  }

  private async setup() {
    /**
     * Define callbacks for all needed events & subscribe to client voice setting changes & voice channel joining
     */
    // @ts-ignore return type: @voiceSettings
    this.rpc.on("VOICE_SETTINGS_UPDATE", (data: VoiceSettings) => {
      console.log("VOICE_SETTINGS_UPDATE event triggered", data);
      this.updateClientVoiceSettings(data);
    });
    // @ts-ignore return type: @voiceChannelSelectPayload
    this.rpc.on("VOICE_CHANNEL_SELECT", (data: voiceChannelSelectPayload) => {
      console.log("VOICE_CHANNEL_SELECT event triggered", data);
      this.updateClientVoiceConnection(data);
    });

    // @ts-ignore return type: @voiceSettingsPayload
    this.rpc.on("VOICE_STATE_CREATE", (data: any) => {
      console.log("VOICE_STATE_CREATE event triggered", data);
      this.newUser(data);
      this.reorderVoiceUsers();
    });
    // @ts-ignore return type: @voiceSettingsPayload
    this.rpc.on("VOICE_STATE_UPDATE", (data: voiceSettingsPayload) => {
      console.log("VOICE_STATE_UPDATE event triggered", data);
      this.updateUserVoiceSettings(data);
    });
    // @ts-ignore return type: @voiceSettingsPayload
    this.rpc.on("VOICE_STATE_DELETE", (data: any) => {
      console.log("VOICE_STATE_DELETE event triggered", data);
      this.userDisconected(data);
    });

    // @ts-ignore
    this.rpc.subscribe("VOICE_SETTINGS_UPDATE", {}).catch( (err: any) => {
      console.warn("Error VOICE_SETTINGS_UPDATE", err);
      if (err.message == "connection closed") this.reconnect();
    });
    // @ts-ignore
    this.rpc.subscribe("VOICE_CHANNEL_SELECT", {}).catch( (err: any) => {
      console.warn("Error VOICE_CHANNEL_SELECT", err);
      if (err.message == "connection closed") this.reconnect();
    });

    if(this.rpc)
    this.client = new voiceClient(this.rpc, await this.rpc.getVoiceSettings());

    // @ts-ignore
    let connectedToVoiceChannel = await this.rpc.request("GET_SELECTED_VOICE_CHANNEL");
    if(connectedToVoiceChannel) this.connectToVoiceChannel(connectedToVoiceChannel.id);
  }

  public async disconnect(): Promise<void> {
    if (this.currentVcId) {
      this.unsubscribeToUserVoiceChanges(this.currentVcId);
    }
    await this.rpc?.destroy();
  }

  public async reconnect() {
    this.rpc = undefined;
    this.connect();
  }

  private async updateClientVoiceSettings(vS: VoiceSettings) { //TODO rework
    if (this.client) {
      this.changedClientSettings(vS, this.client.getVS());
      this.client.updateVoiceSettings(vS);
    }
  }

  private async updateClientVoiceConnection(voiceChannelInfo: voiceChannelSelectPayload) {
    let voiceChannelId = voiceChannelInfo.channel_id;
    this.previousVcId = this.currentVcId;

    if (!this.previousVcId && voiceChannelId) {//Connected to a voice channel
      this.connectToVoiceChannel(voiceChannelId);

    } else if (this.previousVcId && voiceChannelId) { //switched voice channel
      this.disconnectFormVoiceChannel(this.previousVcId);
      this.connectToVoiceChannel(voiceChannelId);

    } else if (this.previousVcId && !voiceChannelId) { //disconnected from server/call
      this.disconnectFormVoiceChannel(this.previousVcId);
      this.previousVcId = undefined;
    }
  }

  private async connectToVoiceChannel(voiceChannelId: string) {
    this.currentVcId = voiceChannelId;
    let voice_states;
    if(this.rpc) {
      this.channel = await this.rpc.getChannel(voiceChannelId);
      voice_states = this.channel.voice_states;
    }

    if (voice_states) {
      this.user = [];
      for (let i = 0; i < voice_states.length; i++) {
        if (voice_states[i].user.id != this.myClientId) {
          this.newUser(voice_states[i]);
        }
      }
      this.reorderVoiceUsers();
      this.subscribeToUserVoiceChanges(voiceChannelId);
    }
  }

  private async disconnectFormVoiceChannel(voiceChannelId: string) {
    this.channel = undefined;
    for (let i = 0; i < this.user?.length; i++) {
      this.emit("User", { type: "DELETE", id: i });
    }
    this.user = [];
    this.currentVcId = undefined;
    this.unsubscribeToUserVoiceChanges(voiceChannelId);
  }

  private async updateUserVoiceSettings(vSP: voiceSettingsPayload) {
    if (this.user && this.client?.id != vSP.user.id) {
      for (let i = 0; i < this.user?.length; i++) {
        if (this.user[i].id == vSP.user.id) {
          this.changedUserSettings(i, vSP, this.user[i].getVSP());
          this.user[i].updateVoiceSettings(vSP);
        }
      }
    }
  }

  private async newUser(vSP: voiceSettingsPayload) {
    if (vSP.user.id != this.client?.id && this.rpc) {
      let newUser: voiceUser = new voiceUser(this.rpc, vSP);
      this.user.push(newUser);
      this.emit("User", { type: "CREATE", id: this.user.length - 1, name: vSP.nick, active: true, mute: vSP.mute, volume: vSP.volume });
    }
  }

  private async userDisconected(vSP: voiceSettingsPayload) {
    for (let i = 0; i < this.user?.length; i++) {
      if (this.user[i].id == vSP.user.id) {
        this.emit("User", { type: "DELETE", id: i });
        this.user.splice(i, 1);
        this.reorderVoiceUsers();
      }
    }
  }

  private reorderVoiceUsers() {
    for(let i = 0; i < this.user.length; i++) {
      this.emit("User", { type: "DELETE", id: i});
    }

    this.user.sort( (a, b) => a.getVSP().nick.localeCompare(b.getVSP().nick, 'fr', {ignorePunctuation: true}));

    for(let j = 0; j < this.user.length; j++) {
      this.emit("User", { type: "CREATE", id: j, name: this.user[j].getVSP().nick, mute: this.user[j].getVSP().mute, volume: this.user[j].getVSP().volume})
    }
  }

  private subscribeToUserVoiceChanges(voiceChannelId: string) {
    // @ts-ignore
    this.rpc.subscribe("VOICE_STATE_CREATE", { channel_id: voiceChannelId }).catch( (err: any) => {
      console.warn("Error VOICE_STATE_CREATE", err);
      if (err.message == "connection closed") this.reconnect();
    });
    // @ts-ignore
    this.rpc.subscribe("VOICE_STATE_UPDATE", { channel_id: voiceChannelId }).catch( (err: any) => {
      console.warn("Error VOICE_STATE_UPDATE", err);
      if (err.message == "connection closed") this.reconnect();
    });
    // @ts-ignore
    this.rpc.subscribe("VOICE_STATE_DELETE", { channel_id: voiceChannelId }).catch( (err: any) => {
      console.warn("Error VOICE_STATE_DELETE", err);
      if (err.message == "connection closed") this.reconnect();
    });
  }

  private async unsubscribeToUserVoiceChanges(voiceChannelId: string) {
    // @ts-ignore
    (await (this.rpc.subscribe("VOICE_STATE_CREATE", { channel_id: voiceChannelId }))).unsubscribe();
    // @ts-ignore
    (await (this.rpc.subscribe("VOICE_STATE_UPDATE", { channel_id: voiceChannelId }))).unsubscribe();
    // @ts-ignore
    (await (this.rpc.subscribe("VOICE_STATE_DELETE", { channel_id: voiceChannelId }))).unsubscribe();
  }

  private changedClientSettings(obj1: VoiceSettings, obj2: VoiceSettings) {
    if (obj1.deaf != obj2.deaf) this.emit("Client", { deaf: obj2.deaf });
    if (obj1.mute != obj2.mute) this.emit("Client", { mute: obj2.mute });
    if (obj1.input?.volume != obj2.input?.volume) this.emit("Client", { input: { volume: obj2.input?.volume } });
  }

  private changedUserSettings(id: number, newVSP: voiceSettingsPayload, currentVSP: voiceSettingsPayload) {
    if (newVSP.mute != currentVSP.mute) this.emit("User", { type: "UPDATE", id: id, name: newVSP.nick, mute: newVSP.mute });
    if (newVSP.volume != currentVSP.volume) this.emit("User", { type: "UPDATE", id: id, name: newVSP.nick, volume: newVSP.volume });
  }
}

class voiceUser {
  protected rpc: RPC.Client;

  readonly id: string;
  protected vSP: voiceSettingsPayload;

  constructor(rpc: RPC.Client, vSP: voiceSettingsPayload) {
    this.rpc = rpc;

    this.id = vSP.user.id;
    this.vSP = vSP;
  }

  public getVSP() {
    return this.vSP;
  }

  public updateVoiceSettings(vSP: voiceSettingsPayload) {
    if (this.id == vSP.user.id) {
      this.vSP = vSP;
    } else {
      console.warn("updating voice settings failed, id mismatch")
    }
  }

  public async setMute(mute: boolean) {
    this.vSP.mute = (await this.rpc.setUserVoiceSettings(this.id, { id: this.id, mute: mute })).mute;
    console.log("voiceUser mute set to:", this.vSP.mute);
    return this.vSP.mute;
  }

  public async setVolume(volume: number) {
    if (volume >= 0 && volume <= 200) {
      this.vSP.volume = (await this.rpc.setUserVoiceSettings(this.id, { id: this.id, volume: volume })).volume;
      console.log("voiceUser volume set to:", this.vSP.volume);
    }
    return this.vSP.volume;
  }

  public async toggleMute() {
    this.vSP.mute = (await this.rpc.setUserVoiceSettings(this.id, { id: this.id, mute: !this.vSP.mute })).mute;
    console.log("voiceUser mute set to:.", this.vSP.mute);
    return this.vSP.mute;
  }
}

class voiceClient {
  protected rpc: RPC.Client;

  readonly id: string;
  readonly name: string;
  readonly avatar: string;
  protected vS: VoiceSettings;

  constructor(rpc: RPC.Client, vS: VoiceSettings) {
    this.rpc = rpc;

    this.id = rpc.user.id;
    this.name = rpc.user.username;
    this.avatar = rpc.user.avatar;
    this.vS = vS;
  }

  getVS() {
    return this.vS;
  }

  public updateVoiceSettings(vS: VoiceSettings) {
    this.vS = vS;
  }

  public async setMute(mute: boolean) {
    // @ts-ignore RPC: VoiceSettings is wrong implemented: all parameters should be optional
    this.vS.mute = (await this.rpc.setVoiceSettings({ mute: mute })).mute;
    console.log("voiceClient mute set to:", this.vS.mute);
    return this.vS.mute;
  }

  public async setInputVolume(volume: number) {
    if (this.vS.input?.volume && volume >= 0 && volume <= 200)
      // @ts-ignore RPC: VoiceSettings is wrong implemented: all parameters should be optional
      this.vS.input.volume = (await this.rpc.setVoiceSettings({ input: { volume: volume } })).input?.volume;
    console.log("VoiceClient volume set to:", this.vS.input?.volume);
    return this.vS.input?.volume;
  }

  public async toggleMute() {
    // @ts-ignore RPC: VoiceSettings is wrong implemented: all parameters should be optional
    this.vS.mute = (await this.rpc.setUserVoiceSettings({ mute: !this.vS.mute })).mute;
    console.log("voiceClient mute set to:.", this.vS.mute);
    return this.vS.mute;
  }

  public async setDeaf(deaf: boolean) {
    // @ts-ignore RPC: VoiceSettings is wrong implemented: all parameters should be optional
    this.vS.deaf = (await this.rpc.setVoiceSettings({ deaf: this.deaf })).deaf;
    console.log("voiceClient set deaf:", this.vS.deaf);
    return this.vS.deaf;
  }

  public async toggleDeaf() {
    // @ts-ignore RPC: VoiceSettings is wrong implemented: all parameters should be optional
    this.deaf = (await this.rpc.setVoiceSettings({ deaf: !this.deaf })).deaf;
    console.log("voiceClient toggled deaf:", this.vS.deaf);
    return this.vS.deaf;
  }
}