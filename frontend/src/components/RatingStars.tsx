import React, { useState } from 'react';

interface RatingStarsProps {
  rating: number; // Current rating (0-5, can be decimal for average)
  ratingCount?: number; // Number of ratings (optional, for display)
  onRate?: (rating: number) => void; // Callback when user clicks a star (optional, makes it interactive)
  interactive?: boolean; // Whether the user can click stars
  size?: 'sm' | 'md' | 'lg'; // Size of the stars
}

const RatingStars: React.FC<RatingStarsProps> = ({
  rating,
  ratingCount,
  onRate,
  interactive = false,
  size = 'md'
}) => {
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const sizeClasses = {
    sm: 'fs-6',
    md: 'fs-5',
    lg: 'fs-4'
  };

  const handleClick = (starRating: number) => {
    if (interactive && onRate) {
      onRate(starRating);
    }
  };

  const handleMouseEnter = (starRating: number) => {
    if (interactive) {
      setHoverRating(starRating);
    }
  };

  const handleMouseLeave = () => {
    if (interactive) {
      setHoverRating(null);
    }
  };

  const displayRating = hoverRating !== null ? hoverRating : rating;

  const renderStar = (index: number) => {
    const starValue = index + 1;
    const filled = displayRating >= starValue;
    const partialFill = displayRating > index && displayRating < starValue;

    return (
      <i
        key={index}
        className={`${filled || partialFill ? 'bi-globe' : 'bi-circle'} ${sizeClasses[size]} ${interactive ? 'cursor-pointer' : ''}`}
        style={{
          color: filled || partialFill ? '#4a9eff' : '#6c757d',
          cursor: interactive ? 'pointer' : 'default',
          userSelect: 'none',
          transition: 'color 0.1s ease'
        }}
        onClick={() => handleClick(starValue)}
        onMouseEnter={() => handleMouseEnter(starValue)}
        onMouseLeave={handleMouseLeave}
      />
    );
  };

  return (
    <div className="d-flex align-items-center gap-2">
      <div className="d-flex gap-1">
        {[0, 1, 2, 3, 4].map(index => renderStar(index))}
      </div>
      {ratingCount !== undefined && (
        <span className="text-secondary" style={{ fontSize: '0.9rem' }}>
          ({rating.toFixed(1)} - {ratingCount} {ratingCount === 1 ? 'vote' : 'votes'})
        </span>
      )}
    </div>
  );
};

export default RatingStars;
