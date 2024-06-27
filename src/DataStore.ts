import CogsConnection from './CogsConnection';

/**
 * A simple key-value store for storing data in COGS
 *
 * When reconnected the data will be restored.
 */
export default class DataStore {
  private _items: { [key: string]: unknown } = {};

  #eventTarget = new EventTarget();

  constructor(private cogsConnection: CogsConnection<any>) {
    cogsConnection.addEventListener('message', ({ message }) => {
      switch (message.type) {
        case 'data_store_items':
          this._items = message.items;
          // TODO: notify listeners
          break;
        case 'data_store_item':
          this._items[message.key] = message.value;
          this.dispatchEvent(new DataStoreItemEvent(message.key, message.value));
          this.dispatchEvent(new DataStoreItemsEvent(this._items));
          break;
      }
    });
  }

  public get items(): Readonly<typeof this._items> {
    return this._items;
  }

  public getItem(key: string): unknown | undefined {
    return this._items[key];
  }

  public setItem(key: string, value: unknown): this {
    this._items[key] = value;
    this.cogsConnection.sendDataStoreItem(key, value);
    this.dispatchEvent(new DataStoreItemEvent(key, value));
    this.dispatchEvent(new DataStoreItemsEvent(this._items));
    return this;
  }

  // Type-safe listeners
  public addEventListener<K extends keyof DataStoreEventMap>(
    type: K,
    listener: (event: DataStoreEventMap[K]) => void,
    options: boolean | AddEventListenerOptions
  ): void {
    this.#eventTarget.addEventListener(type, listener as EventListener, options);
  }
  public removeEventListener<K extends keyof DataStoreEventMap>(
    type: K,
    listener: (event: DataStoreEventMap[K]) => void,
    options: boolean | EventListenerOptions
  ): void {
    this.#eventTarget.removeEventListener(type, listener as EventListener, options);
  }
  private dispatchEvent<K extends keyof DataStoreEventMap>(event: DataStoreEventMap[K]): void {
    this.#eventTarget.dispatchEvent(event);
  }
}

export class DataStoreItemEvent extends Event {
  public readonly _cogsConnectionEventType = 'item';
  constructor(public readonly key: string, public readonly value: unknown) {
    super('item');
  }
}

export class DataStoreItemsEvent extends Event {
  public readonly _cogsConnectionEventType = 'item';
  constructor(public readonly items: { [key: string]: unknown }) {
    super('items');
  }
}

export interface DataStoreEventMap {
  item: DataStoreItemEvent;
  items: DataStoreItemsEvent;
}
