export type FontAwesomeIconId = string;

export interface CogsValueTypeBase<Id extends string> {
  type: Id;
}

export type CogsValueTypeString = CogsValueTypeBase<'string'>;
export interface CogsValueTypeNumber extends CogsValueTypeBase<'number'> {
  integer?: true;
  min?: number;
  max?: number;
}

export type CogsValueTypeBoolean = CogsValueTypeBase<'boolean'>;
export type CogsValueTypeColor = CogsValueTypeBase<'color'>;
export interface CogsValueTypeOption<Options extends string[]> extends CogsValueTypeBase<'option'> {
  options: Options;
}

export type CogsValueType = CogsValueTypeString | CogsValueTypeNumber | CogsValueTypeBoolean | CogsValueTypeColor | CogsValueTypeOption<string[]>;

export type CogsValueTypeStringWithDefault = CogsValueTypeString & { default: string };
export type CogsValueTypeNumberWithDefault = CogsValueTypeNumber & { default: number };
export type CogsValueTypeBooleanWithDefault = CogsValueTypeBoolean & { default: boolean };
export type CogsValueTypeColorWithDefault = CogsValueTypeColor & { default: string };
export type CogsValueTypeOptionWithDefault = CogsValueTypeOption<string[]> & { default: string };

export type CogsValueTypeWithDefault =
  | CogsValueTypeStringWithDefault
  | CogsValueTypeNumberWithDefault
  | CogsValueTypeBooleanWithDefault
  | CogsValueTypeColorWithDefault
  | CogsValueTypeOptionWithDefault;

export type PluginManifestConfigJson = {
  name: string;
  value: CogsValueType | CogsValueTypeWithDefault;
};

export type PluginManifestEventJson = {
  name: string;
  value?: CogsValueType;
};

export type PluginManifestStateJson = {
  name: string;
  value: CogsValueTypeWithDefault;
  writableFromCogs?: true;
  writableFromClient?: true;
};

/**
 * `cogs-plugin-manifest.json` is a JSON manifest file describing the content of a COGS plugin or COGS Media Master custom content.
 *
 *
 * It should be saved in the root of a folder in the `plugins` or `client_content` folder in your COGS project
 *
 * The [COGS plugins directory](/plugins) contains a number of plugins you can use out of the box
 */
export interface PluginManifestJson {
  /**
   * e.g. `1.0.0`
   */
  version: `${number}` | `${number}.${number}` | `${number}.${number}.${number}`;

  /**
   * A short human-readable name
   */
  name: string;

  /**
   * The minimum COGS version required
   *
   * Follows semantic versioning with `semver`
   * e.g. `4.12.0
   */
  minCogsVersion?: `${number}.${number}.${number}`;

  /**
   * A description that appears alongside `name` in the list of plugins, and in the [COGS plugins directory](/plugins)
   */
  description?: string;

  /**
   * A FontAwesome 5.X icon shown alongside `name`, in the COGS navigation bar, and in the [COGS plugins directory](/plugins)
   */
  icon?: FontAwesomeIconId;

  /**
   * The HTML entrypoint for the plugin
   *
   * Defaults to `/` which includes `/index.html`
   */
  indexPath?: string;
  /**
   * If set, shows a popup window to the user where you can show the HTML content of your plugin
   *
   * By default a window is not shown to the user
   * The window can later be opened/closed from the Javascript running in the plugin
   * Only valid for plugins, not for Media Master custom content
   */
  window?: {
    width: number;
    height: number;

    /**
     * Whether the window is initially visible
     */
    visible?: boolean;
  };
  config?: PluginManifestConfigJson[];

  /**
   * Events that trigger COGS behaviors or can trigger actions in this plugin
   */
  events?: {
    fromCogs?: PluginManifestEventJson[];
    toCogs?: PluginManifestEventJson[];
  };

  /**
   * State that can be set by COGS behaviors
   */
  state?: PluginManifestStateJson[];

  /**
   * The types of COGS media actions supported
   */
  media?: {
    audio?: true;
    video?: true;
    images?: true;
  };
}
