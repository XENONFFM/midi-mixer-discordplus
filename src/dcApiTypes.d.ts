import RPC from "discord-rpc";
import EventEmitter from "events";
  
  export interface voiceChannelSelectPayload {
    channel_id: string,
    giuld_id: string,
  }
  
  export interface voiceSettingsPayload {
    mute: boolean,
    nick: string,
    pan: {
      left: number,
      right: number,
    };
    user: {
      avatar: string,
      bot: boolean,
      discriminator: string,
      flags: number,
      id: string,
      premium_type: number,
      username: string,
    };
    voice_state: {
      deaf: boolean,
      mute: boolean,
      self_deaf: boolean,
      self_mute: boolean,
      suppress: boolean,
    };
    volume: number;
  }
 
  export type userUpdate = {
    type: "CREATE" | "DELETE" | "UPDATE" | "REORDER",
    id: number,
    name?: string,
    mute?: boolean,
    volume?: number;
  }

  export type clientUpdate = {
    mute?: boolean,
    deaf?: boolean,
    InputVolume?: number;
  }