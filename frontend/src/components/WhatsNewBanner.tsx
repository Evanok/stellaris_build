import React, { useState } from 'react';

export interface NewsItem {
  date: string;
  title: string;
  description: string;
  type: 'feature' | 'update' | 'fix';
}

interface WhatsNewBannerProps {
  news: NewsItem[];
}

export const WhatsNewBanner: React.FC<WhatsNewBannerProps> = ({ news }) => {
  const [isHovered, setIsHovered] = useState(false);

  // If no news, don't render anything
  if (!news || news.length === 0) {
    return null;
  }

  // Display up to 2 most recent news items
  const recentNews = news.slice(0, 2);

  // Icon based on type
  const getIcon = (type: NewsItem['type']) => {
    switch (type) {
      case 'feature':
        return '🎉';
      case 'update':
        return '✨';
      case 'fix':
        return '🔧';
      default:
        return '📢';
    }
  };

  // Check if news is less than 7 days old
  const isNew = (dateString: string) => {
    const newsDate = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - newsDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 7;
  };

  return (
    <div
      className="alert border-0 shadow-sm h-100"
      style={{
        background: 'linear-gradient(135deg, #27ae60 0%, #229954 100%)',
        cursor: 'default',
        transition: 'transform 0.2s, box-shadow 0.2s',
        transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: isHovered ? '0 8px 16px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.1)',
        borderRadius: '0.5rem',
        padding: '0.75rem 1rem'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="mb-2">
        <span className="badge bg-light text-success small">
          What's New
        </span>
      </div>

      {recentNews.map((newsItem, index) => (
        <div key={index} className={index < recentNews.length - 1 ? 'mb-1' : ''}>
          <div className="d-flex align-items-center">
            <span className="me-2" style={{ fontSize: '1.1rem' }}>{getIcon(newsItem.type)}</span>
            <time className="badge bg-light text-dark small me-2" dateTime={newsItem.date} style={{ flexShrink: 0 }}>
              {newsItem.date}
            </time>
            {isNew(newsItem.date) && (
              <span className="badge bg-danger small me-2" style={{ flexShrink: 0 }}>NEW</span>
            )}
            <span className="text-white fw-bold" style={{ fontSize: '0.85rem', lineHeight: '1.2' }}>
              {newsItem.title}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};
