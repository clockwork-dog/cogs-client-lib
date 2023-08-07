import ShowPhase from './types/ShowPhase';
import ReconnectingWebSocket from 'reconnecting-websocket';
import CogsClientMessage from './types/CogsClientMessage';
import { COGS_SERVER_PORT } from './helpers/urls';
import MediaClipStateMessage from './types/MediaClipStateMessage';
import AllMediaClipStatesMessage from './types/AllMediaClipStatesMessage';
import { CogsPluginManifest, PluginManifestEventJson } from './types/CogsPluginManifestJson';
import * as ManifestTypes from './types/ManifestTypes';
import { DeepReadonly } from './types/utils';

export default class CogsConnection<Manifest extends CogsPluginManifest> {
  private websocket: WebSocket | ReconnectingWebSocket;
  private eventTarget = new EventTarget();

  private currentConfig: ManifestTypes.ConfigAsObject<Manifest> = {} as ManifestTypes.ConfigAsObject<Manifest>; // Received on open connection
  public get config(): ManifestTypes.ConfigAsObject<Manifest> {
    return { ...this.currentConfig };
  }

  private currentState: ManifestTypes.StateAsObject<Manifest> = {} as ManifestTypes.StateAsObject<Manifest>; // Received on open connection - TODO: set initial state from manifest?
  public get state(): ManifestTypes.StateAsObject<Manifest> {
    return { ...this.currentState };
  }

  private _showPhase: ShowPhase = ShowPhase.Setup;
  public get showPhase(): ShowPhase {
    return this._showPhase;
  }

  private _timerState: TimerState | null = null;
  public get timerState(): TimerState | null {
    return this._timerState ? { ...this._timerState } : null;
  }

  /**
   * Cached audio outputs use to look up the device/sink ID when a different device label is requested
   */
  private audioOutputs: MediaDeviceInfo[] | undefined = undefined;

  private _selectedAudioOutput = '';
  public get selectedAudioOutput(): string {
    return this._selectedAudioOutput;
  }

  constructor(
    readonly manifest: Manifest,
    { hostname = document.location.hostname, port = COGS_SERVER_PORT }: { hostname?: string; port?: number } = {},
    initialClientState: Partial<ManifestTypes.StateAsObject<Manifest, { writableFromClient: true }>> | undefined = undefined
  ) {
    this.currentState = { ...(initialClientState as ManifestTypes.StateAsObject<Manifest, { writableFromClient: true }>) };
    const { useReconnectingWebsocket, path, pathParams } = websocketParametersFromUrl(document.location.href);
    const socketUrl = `ws://${hostname}:${port}${path}${pathParams ? '?' + pathParams : ''}`;
    this.websocket = useReconnectingWebsocket ? new ReconnectingWebSocket(socketUrl) : new WebSocket(socketUrl);

    this.websocket.onopen = () => {
      this.currentConfig = {} as ManifestTypes.ConfigAsObject<Manifest>; // Received on open connection
      this.currentState = {} as ManifestTypes.StateAsObject<Manifest>; // Received on open connection

      this.dispatchEvent(new CogsConnectionOpenEvent());
      this.setState(this.currentState); // TODO: Remove this because you should set it manually...??
    };

    this.websocket.onclose = () => {
      this.dispatchEvent(new CogsConnectionCloseEvent());
    };

    this.websocket.onmessage = ({ data }) => {
      try {
        const parsed = JSON.parse(data);

        try {
          if (parsed.config) {
            this.currentConfig = parsed.config;
            this.dispatchEvent(new CogsConfigChangedEvent(this.currentConfig));
          } else if (parsed.updates) {
            this.currentState = { ...this.currentState, ...parsed.updates };
            this.dispatchEvent(new CogsStateChangedEvent(parsed.updates));
          } else if (parsed.event && parsed.event.key) {
            this.dispatchEvent(
              new CogsIncomingEvent(parsed.event.key, parsed.event.value) as CogsIncomingEventTypes<ManifestTypes.EventsFromCogs<Manifest>>
            );
          } else if (typeof parsed.message === 'object') {
            const message: CogsClientMessage = parsed.message;
            switch (message.type) {
              case 'adjustable_timer_update':
                this._timerState = {
                  startedAt: Date.now(),
                  durationMillis: message.durationMillis,
                  ticking: message.ticking,
                };
                break;
              case 'show_phase':
                this._showPhase = message.phase;
                break;
            }

            this.dispatchEvent(new CogsMessageEvent(message));
          }
        } catch (e) {
          console.warn('Error handling data', data, e);
        }
      } catch (e) {
        console.error('Unable to parse incoming data from server', data, e);
      }
    };

    // Send a list of audio outputs to COGS and keep it up to date
    {
      const refreshAudioOutputs = async () => {
        // `navigator.mediaDevices` is undefined on COGS AV <= 4.5 because of secure origin permissions
        if (navigator.mediaDevices) {
          const audioOutputs = (await navigator.mediaDevices.enumerateDevices()).filter(({ kind }) => kind === 'audiooutput');
          this.sendAudioOutputs(audioOutputs);
          this.audioOutputs = audioOutputs;
        }
      };

      this.eventTarget.addEventListener('open', refreshAudioOutputs);
      navigator.mediaDevices?.addEventListener('devicechange', refreshAudioOutputs);
      refreshAudioOutputs();
    }
  }

  public get isConnected(): boolean {
    return this.websocket.readyState === WebSocket.OPEN;
  }

  public close(): void {
    this.websocket.close();
  }

  public sendEvent<EventName extends ManifestTypes.EventNameToCogs<Manifest>>(
    eventName: EventName,
    ...[eventValue]: ManifestTypes.EventToCogsAsObject<Manifest>[EventName] extends undefined
      ? []
      : [ManifestTypes.EventToCogsAsObject<Manifest>[EventName]]
  ): void {
    if (this.isConnected) {
      this.websocket.send(
        JSON.stringify({
          event: {
            key: eventName,
            value: eventValue,
          },
        })
      );
    }
  }

  public setState(values: Partial<ManifestTypes.StateAsObject<Manifest, { writableFromClient: true }>>): void {
    this.currentState = { ...this.currentState, ...values };
    if (this.isConnected) {
      this.websocket.send(JSON.stringify({ updates: values }));
    }
  }

  public getAudioSinkId(audioOutput: string): string | undefined {
    return audioOutput ? this.audioOutputs?.find(({ label }) => label === audioOutput)?.deviceId : '';
  }

  sendInitialMediaClipStates(allMediaClipStates: AllMediaClipStatesMessage): void {
    if (this.isConnected) {
      this.websocket.send(JSON.stringify({ allMediaClipStates }));
    }
  }

  sendMediaClipState(mediaClipState: MediaClipStateMessage): void {
    if (this.isConnected) {
      this.websocket.send(JSON.stringify({ mediaClipState }));
    }
  }

  sendAudioOutputs(audioOutputs: MediaDeviceInfo[]): void {
    if (this.isConnected) {
      this.websocket.send(JSON.stringify({ audioOutputs }));
    }
  }

  /**
   * Show or hide the plugin window.
   * @param visible Whether to show or hide the window
   * This is only relevant for plugins, not for Media Master content.
   */
  public setPluginWindowVisible(visible: boolean): void {
    if (this.isConnected) {
      this.websocket.send(JSON.stringify({ window: { visible } }));
    }
  }

  // Type-safe wrapper around EventTarget
  public addEventListener<EventType extends CogsConnectionEvent<Manifest>['type']>(
    type: EventType,
    listener: (event: CogsConnectionEvent<Manifest> & { type: EventType }) => void,
    options?: boolean | AddEventListenerOptions
  ): void {
    this.eventTarget.addEventListener(type, listener as EventListener, options);
  }
  public removeEventListener<EventType extends CogsConnectionEvent<Manifest>['type']>(
    type: EventType,
    listener: (event: Extract<CogsConnectionEvent<Manifest>, { type: EventType }>) => void,
    options?: boolean | EventListenerOptions
  ): void {
    this.eventTarget.removeEventListener(type, listener as EventListener, options);
  }
  private dispatchEvent<Event extends CogsConnectionEvent<Manifest>>(event: Event): void {
    this.eventTarget.dispatchEvent(event);
  }
}

function websocketParametersFromUrl(url: string): { path: string; pathParams?: URLSearchParams; useReconnectingWebsocket?: boolean } {
  const parsedUrl = new URL(url);
  const pathParams = new URLSearchParams(parsedUrl.searchParams);
  const localClientId = pathParams.get('local_id');
  const isSimulator = pathParams.get('simulator') === 'true';
  const display = pathParams.get('display') ?? '';
  const pluginId = parsedUrl.pathname.startsWith('/plugin/') ? decodeURIComponent(parsedUrl.pathname.split('/')[2]) : undefined;

  if (localClientId) {
    const type = pathParams.get('t') ?? '';
    pathParams.delete('local_id');
    return {
      path: `/local/${encodeURIComponent(localClientId)}`,
      pathParams: new URLSearchParams({ t: type }),
      useReconnectingWebsocket: true,
    };
  } else if (isSimulator) {
    const name = pathParams.get('name') ?? '';
    pathParams.delete('simulator');
    pathParams.delete('name');
    return { path: `/simulator/${encodeURIComponent(name)}`, pathParams, useReconnectingWebsocket: true };
  } else if (display) {
    const displayIdIndex = pathParams.get('displayIdIndex') ?? '';
    pathParams.delete('display');
    pathParams.delete('displayIdIndex');
    return { path: `/display/${encodeURIComponent(display)}/${encodeURIComponent(displayIdIndex)}` };
  } else if (pluginId) {
    return { path: `/plugin/${encodeURIComponent(pluginId)}`, useReconnectingWebsocket: true };
  } else {
    const serial = pathParams.get('serial') ?? '';
    pathParams.delete('serial');
    return { path: `/client/${encodeURIComponent(serial)}`, pathParams };
  }
}

export type TimerState = Omit<Extract<CogsClientMessage, { type: 'adjustable_timer_update' }>, 'type'> & { startedAt: number };

export class CogsConnectionOpenEvent extends Event {
  public readonly type = 'open';
  constructor() {
    super('open');
  }
}

export class CogsConnectionCloseEvent extends Event {
  public readonly type = 'close';
  constructor() {
    super('close');
  }
}

export class CogsMessageEvent extends Event {
  public readonly type = 'message';
  constructor(public readonly message: CogsClientMessage) {
    super('message');
  }
}

export class CogsConfigChangedEvent<CogsConfig> extends Event {
  public readonly type = 'config';
  constructor(public readonly config: CogsConfig) {
    super('config');
  }
}
export class CogsStateChangedEvent<CogsState> extends Event {
  public readonly type = 'state';
  constructor(public readonly state: CogsState) {
    super('state');
  }
}

export class CogsIncomingEvent<CogsEvent extends DeepReadonly<PluginManifestEventJson> | PluginManifestEventJson> extends Event {
  public readonly type = 'event';
  constructor(public readonly name: CogsEvent['name'], public readonly value: ManifestTypes.TypeFromCogsValueType<CogsEvent['value']>) {
    super('event');
  }
}

/**
 * Allows CogsIncomingEvent of each supported value type
 */
export type CogsIncomingEventTypes<CogsEvent extends DeepReadonly<PluginManifestEventJson> | PluginManifestEventJson> = CogsEvent extends unknown
  ? CogsIncomingEvent<CogsEvent>
  : never;

export type CogsConnectionEvent<Manifest extends CogsPluginManifest> =
  | CogsConnectionOpenEvent
  | CogsConnectionCloseEvent
  | CogsMessageEvent
  | CogsConfigChangedEvent<ManifestTypes.ConfigAsObject<Manifest>>
  | CogsStateChangedEvent<Partial<ManifestTypes.StateAsObject<Manifest>>>
  | CogsIncomingEventTypes<ManifestTypes.EventsFromCogs<Manifest>>;
