export interface NumberConfig {
  kind: "number";
  entity: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  help?: string;
}

export interface BooleanConfig {
  kind: "boolean";
  entity: string;
  label: string;
  description?: string;
  help?: string;
}

export type SettingConfig = NumberConfig | BooleanConfig;
