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

/**
 * Custom renderer cho nhãn 5 trục SOLID trên RadarChart.
 * Tự động ngắt dòng thông minh và căn lề linh hoạt để không bị tràn mép trái/phải trên mọi kích thước màn hình.
 */
const renderPolarAngleTick = (props: any) => {
  const { x, y, cx, cy, payload } = props;
  const text: string = payload?.value || '';

  // Xác định textAnchor chính xác theo tọa độ x so với tâm cx
  let textAnchor: 'inherit' | 'middle' | 'end' | 'start' = 'middle';
  if (x < cx - 12) {
    textAnchor = 'end';
  } else if (x > cx + 12) {
    textAnchor = 'start';
  }

  // Ngắt dòng cho các nhãn dài để luôn nằm trọn vẹn trong khung vẽ
  let lines: string[] = [text];
  if (text.includes('D (Đảo ngược') || text.includes('Đảo ngược')) {
    lines = ['D (Đảo ngược', 'phụ thuộc)'];
  } else if (text.includes('I (Phân tách') || text.includes('Phân tách')) {
    lines = ['I (Phân tách', 'Interface)'];
  } else if (text.includes('L (Thay thế') || text.includes('Thay thế')) {
    lines = ['L (Thay thế', 'Liskov)'];
  }

  if (lines.length === 1) {
    return (
      <text
        x={x}
        y={y}
        textAnchor={textAnchor}
        fill="#33415a"
        fontSize={11}
        fontWeight={600}
      >
        {lines[0]}
      </text>
    );
  }

  // Với nhãn 2 dòng: căn chỉnh khoảng cách dòng dy để cân đối với điểm đỉnh radar
  return (
    <text
      x={x}
      y={y - 6}
      textAnchor={textAnchor}
      fill="#33415a"
      fontSize={10.5}
      fontWeight={600}
    >
      <tspan x={x} dy="0">
        {lines[0]}
      </tspan>
      <tspan x={x} dy="13">
        {lines[1]}
      </tspan>
    </text>
  );
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
          <RadarChart
            cx="50%"
            cy="50%"
            outerRadius="55%"
            margin={{ top: 14, right: 36, bottom: 14, left: 36 }}
            data={data}
          >
            <PolarGrid stroke="rgba(11, 18, 32, 0.08)" />
            <PolarAngleAxis
              dataKey="subject"
              stroke="#4d5c76"
              tick={renderPolarAngleTick}
            />
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
      <div style={{ marginTop: '8px', display: 'flex', gap: '12px', alignItems: 'center', fontSize: '13px', flexWrap: 'wrap', justifyContent: 'center' }}>
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
