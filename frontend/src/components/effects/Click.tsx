import * as React from 'react';
import { createPortal } from 'react-dom';

export type ClickVariant = 'ring' | 'ripple' | 'crosshair' | 'burst' | 'particles';

export interface ClickProps {
  variant?: ClickVariant;
  scope?: React.RefObject<HTMLElement | null>;
  color?: string;
  size?: number;
  duration?: number;
  children?: React.ReactNode;
}

interface ClickInstance {
  id: number;
  x: number;
  y: number;
}

const PARTICLE_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
const BURST_ANGLES = [0, 36, 72, 108, 144, 180, 216, 252, 288, 324];

export const Click: React.FC<ClickProps> = ({
  variant = 'ring',
  scope,
  color = 'var(--medici-blue, #0E4274)',
  size = 100,
  duration = 400,
  children,
}) => {
  const [clicks, setClicks] = React.useState<ClickInstance[]>([]);
  const nextId = React.useRef(1);

  React.useEffect(() => {
    const target: EventTarget | null = scope ? scope.current : window;
    if (!target) return;

    const handlePointerDown = (e: Event) => {
      const pe = e as PointerEvent;
      if (pe.button !== undefined && pe.button !== 0) return;

      const id = nextId.current++;
      const x = pe.clientX;
      const y = pe.clientY;

      setClicks((prev) => [...prev.slice(-14), { id, x, y }]);

      window.setTimeout(() => {
        setClicks((prev) => prev.filter((item) => item.id !== id));
      }, duration + 60);
    };

    target.addEventListener('pointerdown', handlePointerDown, { capture: true });
    return () => {
      target.removeEventListener('pointerdown', handlePointerDown, { capture: true });
    };
  }, [scope, duration]);

  const portal =
    typeof document !== 'undefined'
      ? createPortal(
          <div
            aria-hidden="true"
            style={{
              position: 'fixed',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 99999,
              overflow: 'hidden',
            }}
          >
            {clicks.map((item) => {
              const half = size / 2;
              const commonStyle: React.CSSProperties = {
                position: 'fixed',
                left: item.x - half,
                top: item.y - half,
                width: size,
                height: size,
                color,
                pointerEvents: 'none',
                ['--click-duration' as string]: `${duration}ms`,
              };

              if (variant === 'ripple') {
                return (
                  <span
                    key={item.id}
                    className="aita-click-ripple"
                    style={commonStyle}
                  />
                );
              }

              if (variant === 'crosshair') {
                return (
                  <span
                    key={item.id}
                    className="aita-click-crosshair"
                    style={commonStyle}
                  >
                    <span className="aita-crosshair-arm arm-top" />
                    <span className="aita-crosshair-arm arm-right" />
                    <span className="aita-crosshair-arm arm-bottom" />
                    <span className="aita-crosshair-arm arm-left" />
                  </span>
                );
              }

              if (variant === 'burst') {
                return (
                  <span key={item.id} className="aita-click-burst" style={commonStyle}>
                    {BURST_ANGLES.map((deg) => (
                      <span
                        key={deg}
                        className="aita-burst-ray"
                        style={{ ['--deg' as string]: `${deg}deg` }}
                      />
                    ))}
                  </span>
                );
              }

              if (variant === 'particles') {
                return (
                  <span key={item.id} className="aita-click-particles" style={commonStyle}>
                    {PARTICLE_ANGLES.map((deg, idx) => (
                      <span
                        key={deg}
                        className="aita-particle-dot"
                        style={{
                          ['--deg' as string]: `${deg}deg`,
                          ['--dist' as string]: `${size * (idx % 2 === 0 ? 0.44 : 0.34)}px`,
                        }}
                      />
                    ))}
                  </span>
                );
              }

              return (
                <span
                  key={item.id}
                  className="aita-click-ring"
                  style={commonStyle}
                />
              );
            })}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      {children}
      {portal}
    </>
  );
};

