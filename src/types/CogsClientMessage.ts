import BackgroundOptions from './BackgroundOptions';
import MediaObjectFit from './MediaObjectFit';
import { ShowPhase } from './valueTypes';

// COGS updates/events

interface ShowResetMessage {
  type: 'show_reset';
}

interface ShowPhaseMessage {
  type: 'show_phase';
  phase: ShowPhase;
}

interface AdjustableTimerUpdateMessage {
  type: 'adjustable_timer_update';
  ticking: boolean;
  durationMillis: number;
}

interface TextHintsUpdateMessage {
  type: 'text_hints_update';
  lastSentHint: string;
}

// Media

interface MediaClientConfigMessage {
  type: 'media_config_update';
  globalVolume: number; // Question: Are all these appropriate for custom content??
  files: { [path: string]: { preload: boolean } };
  background?: BackgroundOptions;
}

type MediaClientMessage =
  | { type: 'audio_play'; file: string; fade?: number; loop?: true; volume: number }
  | { type: 'audio_pause'; file: string; fade?: number }
  | { type: 'audio_stop'; file?: string; fade?: number }
  | { type: 'audio_set_clip_volume'; file: string; volume: number; fade?: number }
  | { type: 'video_play'; file: string; loop?: true; volume: number; fit: MediaObjectFit }
  | { type: 'video_pause' }
  | { type: 'video_stop' }
  | { type: 'video_set_volume'; volume: number }
  | { type: 'image_show'; file: string; fit: MediaObjectFit; hideOthers?: boolean }
  | { type: 'image_hide'; file?: string };

export type CogsClientMessage =
  | ShowResetMessage
  | ShowPhaseMessage
  | AdjustableTimerUpdateMessage
  | TextHintsUpdateMessage
  | MediaClientConfigMessage
  | MediaClientMessage;

export default CogsClientMessage;
