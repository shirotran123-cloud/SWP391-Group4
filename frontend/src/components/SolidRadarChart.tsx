import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import type { AIRating } from '../types';

interface SolidRadarChartProps {
  rating: AIRating;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: { subject: string; score: number; description: string } }>;
}

const CustomSolidTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const item = payload[0].payload;
    return (
      <div style={{ backgroundColor: '#f7f9fc', border: '1px solid #c8d2e0', borderRadius: '8px', padding: '8px 12px', boxShadow: '0 10px 15px -3px rgba(11, 18, 32, 0.06)' }}>
        <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: 'var(--blue-300)' }}>{item.subject}</p>
        <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#4d5c76' }}>{item.description}</p>
        <p style={{ margin: '4px 0 0', fontSize: '14px', fontWeight: 600, color: 'var(--blue-300)' }}>{item.score} / 10 điểm</p>
      </div>
    );
  }
  return null;
};

export const SolidRadarChart: React.FC<SolidRadarChartProps> = ({ rating }) => {
  const data = [
    { subject: 'S (Đơn trách nhiệm)', score: rating.solidScore.s, fullMark: 10, description: 'Single Responsibility Principle' },
    { subject: 'O (Mở / Đóng)', score: rating.solidScore.o, fullMark: 10, description: 'Open/Closed Principle' },
    { subject: 'L (Thay thế Liskov)', score: rating.solidScore.l, fullMark: 10, description: 'Liskov Substitution Principle' },
    { subject: 'I (Phân tách Interface)', score: rating.solidScore.i, fullMark: 10, description: 'Interface Segregation Principle' },
    { subject: 'D (Đảo ngược phụ thuộc)', score: rating.solidScore.d, fullMark: 10, description: 'Dependency Inversion Principle' },
  ];

  const avgScore = (
    (rating.solidScore.s +
      rating.solidScore.o +
      rating.solidScore.l +
      rating.solidScore.i +
      rating.solidScore.d) /
    5
  ).toFixed(1);

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '100%', height: '280px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
            <PolarGrid stroke="rgba(11, 18, 32, 0.08)" />
            <PolarAngleAxis dataKey="subject" stroke="#4d5c76" tick={{ fill: '#33415a', fontSize: 11, fontWeight: 600 }} />
            <PolarRadiusAxis angle={30} domain={[0, 10]} stroke="#8695ab" />
            <Radar
              name="Điểm SOLID"
              dataKey="score"
              stroke="#2563eb"
              fill="#2563eb"
              fillOpacity={0.45}
            />
            <Tooltip content={<CustomSolidTooltip />} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ marginTop: '8px', display: 'flex', gap: '12px', alignItems: 'center', fontSize: '13px' }}>
        <span style={{ color: 'var(--text-muted)' }}>
          Mã Sạch (Clean Code): <strong style={{ color: 'var(--blue-300)' }}>{rating.cleanCodeScore}/10</strong>
        </span>
        <span style={{ color: 'var(--border-color)' }}>•</span>
        <span style={{ color: 'var(--text-muted)' }}>
          Điểm SOLID Trung Bình: <strong style={{ color: 'var(--blue-300)' }}>{avgScore}/10</strong>
        </span>
      </div>
    </div>
  );
};
