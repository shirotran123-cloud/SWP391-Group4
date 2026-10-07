import React, { useState, useEffect } from 'react';
import { Clock, AlertCircle } from 'lucide-react';

interface CountdownTimerProps {
  deadline: string;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({ deadline }) => {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number; expired: boolean }>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    expired: false,
  });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = +new Date(deadline) - +new Date();
      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
          expired: false,
        });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: true });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [deadline]);

  if (timeLeft.expired) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '20px', backgroundColor: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.4)', color: '#f43f5e', fontSize: '13px', fontWeight: 700 }}>
        <AlertCircle size={15} /> Quá hạn nộp bài
      </div>
    );
  }

  const isUrgent = timeLeft.days === 0 && timeLeft.hours < 24;

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      padding: '7px 15px',
      borderRadius: '20px',
      backgroundColor: isUrgent ? 'rgba(244, 63, 94, 0.16)' : 'rgba(99, 102, 241, 0.14)',
      border: `1px solid ${isUrgent ? 'rgba(244, 63, 94, 0.45)' : 'rgba(99, 102, 241, 0.35)'}`,
      color: isUrgent ? '#fb7185' : '#818cf8',
      fontWeight: 600,
      fontSize: '13px',
      boxShadow: isUrgent ? '0 0 12px rgba(244, 63, 94, 0.25)' : 'none',
    }}>
      <Clock size={15} className="pulse-animation" />
      <span>Thời gian còn lại:</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', color: '#ffffff', fontWeight: 800 }}>
        {timeLeft.days > 0 ? `${timeLeft.days} ngày ` : ''}
        {String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
      </span>
    </div>
  );
};
