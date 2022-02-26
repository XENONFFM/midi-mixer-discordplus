# Discord+

## Getting started

- Requiremnts:
    - Discord application [Discord Developer Portal](https://discord.com/developers/applications)
    - Offical discord client running localy

- Settings:
    - **Client ID**: Id of your discord application
    - **Client Secret**: secret of your discord application
    - **Number of VoiceUsers**: Max number of users you can control

- Assignments:
    Assign "voiceUserX" Assigments to the desired groups.
    As soon as you join a channel the assignments will be linked to users in your voice channel.
    -> The name of the assignment will change to the name of the user it will control.

- Info:
    If you start midi-mixer or this plugin after connecting to a voice channel, you have to reconnect to the channel to control the users in this channel.

## Features

- Control your mic volume, mute and deaf state
- Control the volume and mute state of users in your current voice channel (works on servers,dm and group dm)

## Controls

### Assignments

- #### VoiceUserX
  - **volume**: users mic volume
  - **mute**: users mic mute

- #### Input
  - **volume**: client mic volume
  - **mute**: client mic mute

- #### Output
  - **mute**: client speaker deaf

### Buttons

- **Toggle mute**: client mic mute
- **Toggle deafen**: client speaker deaf
