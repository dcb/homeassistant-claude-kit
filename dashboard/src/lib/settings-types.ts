interface BaseSettingConfig {
  entity: string;
  label: string;
  help?: string;
  advanced?: boolean;
}

export interface NumberConfig extends BaseSettingConfig {
  kind: "number";
  unit: string;
  min: number;
  max: number;
  step: number;
}

export interface BooleanConfig extends BaseSettingConfig {
  kind: "boolean";
  description?: string;
}

export type SettingConfig = NumberConfig | BooleanConfig;
