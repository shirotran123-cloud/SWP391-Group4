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
      <div style={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', padding: '8px 12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}>
        <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#8b5cf6' }}>{item.subject}</p>
        <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#9ca3af' }}>{item.description}</p>
        <p style={{ margin: '4px 0 0', fontSize: '14px', fontWeight: 800, color: '#10b981' }}>{item.score} / 10 điểm</p>
      </div>
    );
  }
  return null;
};

export const SolidRadarChart: React.FC<SolidRadarChartProps> = ({ rating }) => {
  // Nhãn trục phải NGẮN: nhãn dài như "D (Đảo ngược phụ thuộc)" bị container cắt mất
  // ở hai trục nằm ngang (I và D). Dùng chữ viết tắt chuẩn SOLID ở trục, còn tên đầy đủ
  // hiển thị trong tooltip khi rê chuột.
  const data = [
    { subject: 'S · SRP', score: rating.solidScore.s, fullMark: 10, description: 'Single Responsibility — Đơn trách nhiệm' },
    { subject: 'O · OCP', score: rating.solidScore.o, fullMark: 10, description: 'Open/Closed — Mở để mở rộng, đóng để sửa đổi' },
    { subject: 'L · LSP', score: rating.solidScore.l, fullMark: 10, description: 'Liskov Substitution — Thay thế Liskov' },
    { subject: 'I · ISP', score: rating.solidScore.i, fullMark: 10, description: 'Interface Segregation — Phân tách Interface' },
    { subject: 'D · DIP', score: rating.solidScore.d, fullMark: 10, description: 'Dependency Inversion — Đảo ngược phụ thuộc' },
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
      <div style={{ width: '100%', height: '300px' }}>
        <ResponsiveContainer width="100%" height="100%">
          {/* margin chừa chỗ cho nhãn trục; outerRadius hạ xuống để nhãn không bị cắt. */}
          <RadarChart cx="50%" cy="50%" outerRadius="68%" margin={{ top: 18, right: 26, bottom: 18, left: 26 }} data={data}>
            <PolarGrid stroke="rgba(255, 255, 255, 0.15)" />
            <PolarAngleAxis dataKey="subject" stroke="#9ca3af" tick={{ fill: '#d1d5db', fontSize: 12, fontWeight: 700 }} />
            <PolarRadiusAxis angle={30} domain={[0, 10]} stroke="#4b5563" tick={{ fill: '#6b7280', fontSize: 10 }} />
            <Radar
              name="Điểm SOLID"
              dataKey="score"
              stroke="#8b5cf6"
              fill="#8b5cf6"
              fillOpacity={0.45}
            />
            <Tooltip content={<CustomSolidTooltip />} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Bảng điểm từng trục: bảo đảm CẢ 5 trục luôn đọc được, kể cả khi nhãn radar bị chật. */}
      <div
        style={{
          width: '100%',
          marginTop: '10px',
          display: 'grid',
          gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
          gap: '6px',
        }}
      >
        {[
          { key: 'S', label: 'Đơn trách nhiệm', value: rating.solidScore.s },
          { key: 'O', label: 'Mở / Đóng', value: rating.solidScore.o },
          { key: 'L', label: 'Thay thế Liskov', value: rating.solidScore.l },
          { key: 'I', label: 'Phân tách Interface', value: rating.solidScore.i },
          { key: 'D', label: 'Đảo ngược phụ thuộc', value: rating.solidScore.d },
        ].map((axis) => (
          <div
            key={axis.key}
            title={`${axis.key} — ${axis.label}`}
            style={{
              padding: '7px 4px',
              borderRadius: '8px',
              backgroundColor: 'rgba(139, 92, 246, 0.10)',
              border: '1px solid rgba(139, 92, 246, 0.28)',
              textAlign: 'center',
              minWidth: 0,
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#a78bfa', lineHeight: 1.2 }}>{axis.key}</div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: '#ffffff', lineHeight: 1.3 }}>
              {Number(axis.value).toFixed(1)}
            </div>
            <div
              style={{
                fontSize: '9.5px',
                color: 'var(--text-muted)',
                lineHeight: 1.25,
                marginTop: '2px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {axis.label}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '10px', display: 'flex', gap: '12px', alignItems: 'center', fontSize: '13px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <span style={{ color: 'var(--text-muted)' }}>
          Mã Sạch (Clean Code): <strong style={{ color: '#38bdf8' }}>{rating.cleanCodeScore}/10</strong>
        </span>
        <span style={{ color: 'var(--border-color)' }}>•</span>
        <span style={{ color: 'var(--text-muted)' }}>
          Điểm SOLID Trung Bình: <strong style={{ color: '#a78bfa' }}>{avgScore}/10</strong>
        </span>
      </div>
    </div>
  );
};
