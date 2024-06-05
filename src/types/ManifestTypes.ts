import {
  CogsValueType,
  CogsValueTypeBoolean,
  CogsValueTypeNumber,
  CogsValueTypeOption,
  CogsValueTypeString,
  CogsPluginManifest,
  PluginManifestStateJson,
} from './CogsPluginManifest';
import { DeepMutable, DistributeObject } from './utils';

export type TypeFromCogsValueType<ValueType extends Pick<CogsValueType, 'type'> | undefined> = ValueType extends CogsValueTypeOption<any>
  ? ValueType['options'][number]
  : ValueType extends CogsValueTypeString
  ? Readonly<string>
  : ValueType extends CogsValueTypeNumber
  ? number
  : ValueType extends CogsValueTypeBoolean
  ? boolean
  : undefined;

export type ConfigName<Manifest extends Pick<CogsPluginManifest, 'config'>> = NonNullable<Manifest['config']>[number]['name'];

export type ConfigAsObject<Manifest extends Pick<CogsPluginManifest, 'config'>> = DistributeObject<
  {
    [Name in ConfigName<Manifest>]: TypeFromCogsValueType<Extract<DeepMutable<NonNullable<Manifest['config']>[number]>, { name: Name }>['value']>;
  }
>;

export type StateName<
  Manifest extends Pick<CogsPluginManifest, 'state'>,
  Constraints extends Partial<PluginManifestStateJson> = Record<never, never>
> = Extract<DeepMutable<NonNullable<Manifest['state']>[number]>, Constraints>['name'];

export type StateValue<Manifest extends Pick<CogsPluginManifest, 'state'>, Name extends StateName<Manifest>> = TypeFromCogsValueType<
  Extract<DeepMutable<NonNullable<Manifest['state']>[number]>, { name: Name }>['value']
>;

export type StateAsObject<
  Manifest extends Pick<CogsPluginManifest, 'state'>,
  Constraints extends Partial<PluginManifestStateJson> = Record<never, never>
> = DistributeObject<
  {
    [Name in StateName<Manifest, Constraints>]: StateValue<Manifest, Name>;
  }
>;

export type EventNameFromCogs<Manifest extends CogsPluginManifest> = NonNullable<NonNullable<Manifest['events']>['fromCogs']>[number]['name'];

export type EventFromCogs<Manifest extends CogsPluginManifest> = NonNullable<NonNullable<Manifest['events']>['fromCogs']>[number];

export type EventFromCogsAsObject<Manifest extends CogsPluginManifest> = DistributeObject<
  {
    [Name in EventNameFromCogs<Manifest>]: 
      Extract<DeepMutable<EventFromCogs<Manifest>>, { name: Name }> extends { name: Name; value: infer V extends CogsValueType } ? TypeFromCogsValueType<V> :
      Extract<DeepMutable<EventFromCogs<Manifest>>, { name: Name }> extends { name: Name; value: infer V extends { name: string; value: CogsValueType }[] } ? DistributeObject<
        {
          [ValueName in V[number]['name']]: TypeFromCogsValueType<V[number]['value']>
        }
      > : undefined;
  }
>;

export type EventNameToCogs<Manifest extends CogsPluginManifest> = NonNullable<NonNullable<Manifest['events']>['toCogs']>[number]['name'];

export type EventToCogs<Manifest extends CogsPluginManifest> = NonNullable<NonNullable<Manifest['events']>['toCogs']>[number];

export type EventToCogsAsObject<Manifest extends CogsPluginManifest> = DistributeObject<
  {
    [Name in EventNameToCogs<Manifest>]: 
      Extract<DeepMutable<EventToCogs<Manifest>>, { name: Name }> extends { name: Name; value: infer V extends CogsValueType } ? TypeFromCogsValueType<V> :
      Extract<DeepMutable<EventToCogs<Manifest>>, { name: Name }> extends { name: Name; value: infer V extends { name: string; value: CogsValueType }[] } ? DistributeObject<
        {
          [ValueName in V[number]['name']]: TypeFromCogsValueType<V[number]['value']>
        }
      > : undefined;
  }
>;
