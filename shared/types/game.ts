export type FieldType =
  | 'counter'
  | 'toggle'
  | 'select'
  | 'rating'
  | 'text'
  | 'textarea'
  | 'timer'
  | 'path';

export type FieldSection = 'auto' | 'teleop' | 'endgame' | 'general';

export interface GameField {
  id: string;
  label: string;
  type: FieldType;
  section: FieldSection;
  options?: string[];
  min?: number;
  max?: number;
  defaultValue?: number | boolean | string;
  pointsPerUnit?: number;
  required?: boolean;
  helpText?: string;
}

export interface FieldImage {
  src: string;
  widthFt: number;
  heightFt: number;
}

export interface GameConfig {
  year: number;
  name: string;
  season: string;
  match: {
    auto: GameField[];
    teleop: GameField[];
    endgame: GameField[];
  };
  pit: GameField[];
  field: FieldImage;
}
