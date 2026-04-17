'use client';

import { formatCurrency } from '@/lib/format';
import './StatsCard.css';

interface StatsCardProps {
  icon: string;
  label: string;
  value: string | number;
  variant?: 'neutral' | 'positive' | 'negative' | 'gold';
  subtitle?: string;
}

export default function StatsCard({ icon, label, value, variant = 'neutral', subtitle }: StatsCardProps) {
  return (
    <div className={`stats-card stats-card--${variant}`} id={`stat-${label.toLowerCase().replace(/\s/g, '-')}`}>
      <div className="stats-card-icon">{icon}</div>
      <div className="stats-card-content">
        <span className="stats-card-label">{label}</span>
        <span className="stats-card-value">{typeof value === 'number' ? formatCurrency(value) : value}</span>
        {subtitle && <span className="stats-card-subtitle">{subtitle}</span>}
      </div>
    </div>
  );
}
