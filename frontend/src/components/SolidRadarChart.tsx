import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import type { AIRating } from '../types';

interface SolidRadarChartProps {
  rating: AIRating;
}

export const SolidRadarChart: React.FC<SolidRadarChartProps> = ({ rating }) => {
  const data = [
    { subject: 'S (Single Resp)', score: rating.solidScore.s, fullMark: 10 },
    { subject: 'O (Open-Closed)', score: rating.solidScore.o, fullMark: 10 },
    { subject: 'L (Liskov Sub)', score: rating.solidScore.l, fullMark: 10 },
    { subject: 'I (Interface Seg)', score: rating.solidScore.i, fullMark: 10 },
    { subject: 'D (Dependency Inv)', score: rating.solidScore.d, fullMark: 10 },
  ];

  return (
    <div style={{ width: '100%', height: '280px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
          <PolarGrid stroke="rgba(255, 255, 255, 0.15)" />
          <PolarAngleAxis dataKey="subject" stroke="#9ca3af" tick={{ fill: '#d1d5db', fontSize: 12, fontWeight: 600 }} />
          <PolarRadiusAxis angle={30} domain={[0, 10]} stroke="#4b5563" />
          <Radar
            name="SOLID Score"
            dataKey="score"
            stroke="#8b5cf6"
            fill="#8b5cf6"
            fillOpacity={0.45}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};
