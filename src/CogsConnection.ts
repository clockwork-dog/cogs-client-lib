import { ConfigValue, EventKeyValue, EventValue, PortValue, ShowPhase } from './types/valueTypes';
import ReconnectingWebSocket from 'reconnecting-websocket';
import CogsClientMessage from './types/CogsClientMessage';
import { COGS_SERVER_PORT } from './helpers/urls';
import MediaClipStateMessage from './types/MediaClipStateMessage';
import AllMediaClipStatesMessage from './types/AllMediaClipStatesMessage';
import CogsMessage from './types/CogsMessage';

interface ConnectionEventListeners<
  CustomTypes extends {
    config?: { [configKey: string]: ConfigValue };
    inputPorts?: { [port: string]: PortValue };
    inputEvents?: { [key: string]: EventValue | null };
  }
> {
  open: undefined;
  close: undefined;
  message: CogsClientMessage;
  config: CustomTypes['config'];
  updates: Partial<CustomTypes['inputPorts']>;
  event: CustomTypes['inputEvents'] extends { [key: string]: EventValue | null } ? EventKeyValue<CustomTypes['inputEvents']> : Record<string, never>;
  /**
   * @ignore
   */
  _cogsMessage: CogsMessage;
}

export type TimerState = Omit<Extract<CogsClientMessage, { type: 'adjustable_timer_update' }>, 'type'> & { startedAt: number };

export interface CogsConnectionOptions {
  hostname?: string;
  port?: number;
}

export default class CogsConnection<
  CustomTypes extends {
    config?: { [configKey: string]: ConfigValue };
    inputPorts?: { [port: string]: PortValue };
    outputPorts?: { [port: string]: PortValue };
    inputEvents?: { [key: string]: EventValue | null };
    outputEvents?: { [key: string]: EventValue | null };
  } = Record<never, never>
> {
  private websocket: WebSocket | ReconnectingWebSocket;
  private eventTarget = new EventTarget();

  private currentConfig: CustomTypes['config'] = {} as NonNullable<CustomTypes['config']>; // Received on open connection
  public get config(): CustomTypes['config'] {
    return { ...this.currentConfig };
  }

  private currentInputPortValues: CustomTypes['inputPorts'] = {} as NonNullable<CustomTypes['inputPorts']>; // Received on open connection
  public get inputPortValues(): CustomTypes['inputPorts'] {
    return { ...this.currentInputPortValues };
  }

  private currentOutputPortValues: CustomTypes['outputPorts'] = {} as NonNullable<CustomTypes['outputPorts']>; // Sent on open connection
  public get outputPortValues(): CustomTypes['outputPorts'] {
    return { ...this.currentOutputPortValues };
  }

  private _showPhase: ShowPhase = ShowPhase.Setup;
  public get showPhase(): ShowPhase {
    return this._showPhase;
  }

  private _timerState: TimerState | null = null;
  public get timerState(): TimerState | null {
    return this._timerState ? { ...this._timerState } : null;
  }

  constructor(
    { hostname = document.location.hostname, port = COGS_SERVER_PORT }: CogsConnectionOptions = {},
    outputPortValues: CustomTypes['outputPorts'] = undefined
  ) {
    this.currentOutputPortValues = { ...outputPortValues };
    const { useReconnectingWebsocket, path, pathParams } = websocketParametersFromUrl(document.location.href);
    const socketUrl = `ws://${hostname}:${port}${path}?${pathParams}`;
    this.websocket = useReconnectingWebsocket ? new ReconnectingWebSocket(socketUrl) : new WebSocket(socketUrl);

    this.websocket.onopen = () => {
      this.currentConfig = {} as CustomTypes['config']; // Received on open connection
      this.currentInputPortValues = {} as CustomTypes['inputPorts']; // Received on open connection

      this.dispatchEvent('open', undefined);
      this.setOutputPortValues(this.currentOutputPortValues as NonNullable<CustomTypes['outputPorts']>);
    };

    this.websocket.onclose = () => {
      this.dispatchEvent('close', undefined);
    };

    this.websocket.onmessage = ({ data }) => {
      try {
        const parsed = JSON.parse(data);
        try {
          this._handleCogsMessage(parsed);
        } catch (e) {
          console.warn('Error handling data', data, e);
        }
      } catch (e) {
        console.error('Unable to parse incoming data from server', data, e);
      }
    };
  }

  /**
   * @ignore
   */
  _handleCogsMessage(message: {
    config?: CustomTypes['config'];
    updates?: Partial<CustomTypes['inputPorts']>;
    event?: CustomTypes['inputEvents'] extends { [key: string]: EventValue | null }
      ? EventKeyValue<CustomTypes['inputEvents']>
      : Record<string, never>;
    message?: CogsClientMessage;
  }): void {
    if (message.config) {
      this.currentConfig = message.config;
      this.dispatchEvent('config', this.currentConfig);
    } else if (message.updates) {
      this.currentInputPortValues = { ...this.currentInputPortValues, ...message.updates };
      this.dispatchEvent('updates', this.currentInputPortValues);
    } else if (message.event && message.event.key) {
      this.dispatchEvent('event', message.event);
    } else if (typeof message.message === 'object') {
      switch (message.message.type) {
        case 'adjustable_timer_update':
          this._timerState = {
            startedAt: Date.now(),
            durationMillis: message.message.durationMillis,
            ticking: message.message.ticking,
          };
          break;
        case 'show_phase':
          this._showPhase = message.message.phase;
          break;
      }

      this.dispatchEvent('message', message.message);
    }
  }

  public get isConnected(): boolean {
    return this.websocket.readyState === WebSocket.OPEN;
  }

  public close(): void {
    this.websocket.close();
  }

  private sendToCogs(message: CogsMessage) {
    if (this.isConnected) {
      this.websocket.send(JSON.stringify(message));
    }
    this.dispatchEvent('_cogsMessage', message);
  }

  public sendEvent<EventName extends keyof CustomTypes['outputEvents']>(
    eventName: EventName,
    ...[eventValue]: CustomTypes['outputEvents'][EventName] extends null ? [] : [CustomTypes['outputEvents'][EventName]]
  ): void {
    if (this.isConnected) {
      this.sendToCogs({
        event: {
          key: eventName as string,
          value: eventValue as EventValue | undefined,
        },
      });
    }
  }

  public setOutputPortValues(values: Partial<CustomTypes['outputPorts']>): void {
    this.currentOutputPortValues = { ...this.currentOutputPortValues, ...values };
    this.sendToCogs({ updates: values as any });
  }

  sendInitialMediaClipStates(allMediaClipStates: AllMediaClipStatesMessage): void {
    this.sendToCogs({ allMediaClipStates });
  }

  sendMediaClipState(mediaClipState: MediaClipStateMessage): void {
    this.sendToCogs({ mediaClipState });
  }

  // Type-safe wrapper around EventTarget
  public addEventListener<
    EventName extends keyof ConnectionEventListeners<CustomTypes>,
    EventValue extends ConnectionEventListeners<CustomTypes>[EventName]
  >(type: EventName, listener: (ev: CustomEvent<EventValue>) => void, options?: boolean | AddEventListenerOptions): void {
    this.eventTarget.addEventListener(type, listener as EventListener, options);
  }
  public removeEventListener<
    EventName extends keyof ConnectionEventListeners<CustomTypes>,
    EventValue extends ConnectionEventListeners<CustomTypes>[EventName]
  >(type: EventName, listener: (ev: CustomEvent<EventValue>) => void, options?: boolean | EventListenerOptions): void {
    this.eventTarget.removeEventListener(type, listener as EventListener, options);
  }
  private dispatchEvent<EventName extends keyof ConnectionEventListeners<CustomTypes>>(
    type: EventName,
    detail: ConnectionEventListeners<CustomTypes>[EventName]
  ): void {
    this.eventTarget.dispatchEvent(new CustomEvent(type, { detail }));
  }
}

function websocketParametersFromUrl(url: string): { path: string; pathParams: URLSearchParams; useReconnectingWebsocket?: boolean } {
  const parsedUrl = new URL(url);
  const pathParams = new URLSearchParams(parsedUrl.searchParams);
  const localClientId = pathParams.get('local_id');
  const isSimulator = pathParams.get('simulator') === 'true';

  if (localClientId) {
    const type = pathParams.get('t') ?? '';
    pathParams.delete('local_id');
    return {
      path: `/client/local/${encodeURIComponent(localClientId)}`,
      pathParams: new URLSearchParams({ t: type }),
      useReconnectingWebsocket: true,
    };
  } else if (isSimulator) {
    const name = pathParams.get('name') ?? '';
    pathParams.delete('simulator');
    pathParams.delete('name');
    return { path: `/simulator/${encodeURIComponent(name)}`, pathParams, useReconnectingWebsocket: true };
  } else {
    const serial = pathParams.get('serial') ?? '';
    pathParams.delete('serial');
    return { path: `/client/${encodeURIComponent(serial)}`, pathParams };
  }
}
