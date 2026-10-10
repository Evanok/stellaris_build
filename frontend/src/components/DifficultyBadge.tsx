import React from 'react';
import { getDifficultyLevel } from '../utils/difficulty';

interface DifficultyBadgeProps {
  difficulty: string | undefined;
  className?: string;
}

export const DifficultyBadge: React.FC<DifficultyBadgeProps> = ({ difficulty, className }) => {
  const level = getDifficultyLevel(difficulty);
  if (!level) return null;

  return (
    <span className={`badge ${level.className}${className ? ` ${className}` : ''}`} title="How hard this build is to play">
      {level.label}
    </span>
  );
};
