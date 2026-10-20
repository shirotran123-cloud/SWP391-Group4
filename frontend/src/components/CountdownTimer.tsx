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
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '12px', backgroundColor: 'rgba(11, 18, 32, 0.06)', border: '1px solid rgba(11, 18, 32, 0.13)', color: 'var(--text-main)', fontSize: '13px', fontWeight: 700 }}>
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
      borderRadius: '12px',
      backgroundColor: isUrgent ? 'rgba(11, 18, 32, 0.05)' : 'rgba(59, 130, 246, 0.1)',
      border: `1px solid ${isUrgent ? 'rgba(11, 18, 32, 0.144)' : 'rgba(59, 130, 246, 0.24)'}`,
      color: isUrgent ? 'var(--text-main)' : '#2563eb',
      fontWeight: 600,
      fontSize: '13px',
      boxShadow: isUrgent ? '0 0 12px rgba(11, 18, 32, 0.09)' : 'none',
    }}>
      <Clock size={15} className="pulse-animation" />
      <span>Thời gian còn lại:</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', color: 'var(--text-main)', fontWeight: 600 }}>
        {timeLeft.days > 0 ? `${timeLeft.days} ngày ` : ''}
        {String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
      </span>
    </div>
  );
};
