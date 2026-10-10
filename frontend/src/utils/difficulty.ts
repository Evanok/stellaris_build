// Single difficulty axis: how hard the build is to play.
// `value` is what is stored in the database (builds.difficulty) and must never change -
// only the labels may be renamed. The original values described build power
// (overpowered/strong/balanced) and were mixed with difficulty labels, which confused users.
export interface DifficultyLevel {
  value: string;
  label: string;
  className: string;
}

export const DIFFICULTY_LEVELS: DifficultyLevel[] = [
  { value: 'overpowered', label: 'Very Easy', className: 'bg-success' },
  { value: 'strong', label: 'Easy', className: 'bg-info text-dark' },
  { value: 'balanced', label: 'Medium', className: 'bg-primary' },
  { value: 'challenging', label: 'Hard', className: 'bg-warning text-dark' },
  { value: 'extreme', label: 'Very Hard', className: 'bg-danger' },
];

export const getDifficultyLevel = (value: string | undefined): DifficultyLevel | undefined =>
  value ? DIFFICULTY_LEVELS.find(level => level.value === value) : undefined;
