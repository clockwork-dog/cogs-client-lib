import MediaClipStateMessage from './MediaClipStateMessage';
import AllMediaClipStatesMessage from './AllMediaClipStatesMessage';
import { EventValue, PortValue } from './valueTypes';

export default interface CogsMessage {
  mediaClipState?: MediaClipStateMessage;
  allMediaClipStates?: AllMediaClipStatesMessage;
  event?: {
    key: string;
    value?: EventValue;
  };
  updates?: { [port: string]: PortValue };
}
