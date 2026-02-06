/**
 * SparkEffect - Electrical spark effects for buttons
 * - Burst sparks on activation (like electrical disjunction)
 * - Falling sparks while active
 */

import { useEffect, useRef, useState, useCallback } from 'react';

// Individual spark particle
function Spark({ x, y, vx, vy, size, color, opacity, type }) {
  const isBright = type === 'bright';
  return (
    <div
      className="spark-particle"
      style={{
        left: x,
        top: y,
        width: size,
        height: size,
        backgroundColor: color,
        opacity,
        boxShadow: isBright
          ? `0 0 ${size * 2}px ${color}, 0 0 ${size * 4}px ${color}, 0 0 ${size * 6}px ${color}`
          : `0 0 ${size}px ${color}, 0 0 ${size * 2}px ${color}`,
        borderRadius: '50%',
      }}
    />
  );
}

export function SparkEffect({ active, color = '#00ff88', buttonRef }) {
  const [sparks, setSparks] = useState([]);
  const frameRef = useRef(null);
  const sparkIdRef = useRef(0);
  const wasActiveRef = useRef(false);

  // Spawn burst sparks (explosion on activation) - from LEFT and RIGHT sides
  const spawnBurst = useCallback(() => {
    if (!buttonRef?.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const burstSparks = [];

    // Create sparks bursting from LEFT side
    const leftCount = 15 + Math.floor(Math.random() * 5);
    for (let i = 0; i < leftCount; i++) {
      const y = (i / leftCount) * rect.height + Math.random() * 10 - 5;
      const speed = 1.5 + Math.random() * 1.5;
      burstSparks.push({
        id: sparkIdRef.current++,
        x: -2,
        y,
        vx: -(speed + Math.random() * 0.5), // Explode LEFT
        vy: (Math.random() - 0.5) * 1.5,
        size: 1 + Math.random() * 2,
        color: Math.random() > 0.3 ? color : '#ffffff',
        opacity: 1,
        life: 1,
        decay: 0.03 + Math.random() * 0.02,
        type: 'burst',
        gravity: 0.02,
      });
    }

    // Create sparks bursting from RIGHT side
    const rightCount = 15 + Math.floor(Math.random() * 5);
    for (let i = 0; i < rightCount; i++) {
      const y = (i / rightCount) * rect.height + Math.random() * 10 - 5;
      const speed = 1.5 + Math.random() * 1.5;
      burstSparks.push({
        id: sparkIdRef.current++,
        x: rect.width + 2,
        y,
        vx: speed + Math.random() * 0.5, // Explode RIGHT
        vy: (Math.random() - 0.5) * 1.5,
        size: 1 + Math.random() * 2,
        color: Math.random() > 0.3 ? color : '#ffffff',
        opacity: 1,
        life: 1,
        decay: 0.03 + Math.random() * 0.02,
        type: 'burst',
        gravity: 0.02,
      });
    }

    // Add 2-3 super bright sparks on each side that die quickly
    const brightCount = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < brightCount; i++) {
      // Left bright
      burstSparks.push({
        id: sparkIdRef.current++,
        x: -2,
        y: Math.random() * rect.height,
        vx: -(2 + Math.random() * 1),
        vy: (Math.random() - 0.5) * 0.8,
        size: 2.5 + Math.random() * 1.5,
        color: '#ffffff',
        opacity: 1,
        life: 1,
        decay: 0.1 + Math.random() * 0.05,
        type: 'bright',
        gravity: 0.005,
      });
      // Right bright
      burstSparks.push({
        id: sparkIdRef.current++,
        x: rect.width + 2,
        y: Math.random() * rect.height,
        vx: 2 + Math.random() * 1,
        vy: (Math.random() - 0.5) * 0.8,
        size: 2.5 + Math.random() * 1.5,
        color: '#ffffff',
        opacity: 1,
        life: 1,
        decay: 0.1 + Math.random() * 0.05,
        type: 'bright',
        gravity: 0.005,
      });
    }

    setSparks(prev => [...prev, ...burstSparks]);
  }, [buttonRef, color]);

  // No continuous falling sparks - only burst on click

  // Animation loop
  useEffect(() => {
    // Trigger burst on activation (click)
    if (active && !wasActiveRef.current) {
      spawnBurst();
    }
    wasActiveRef.current = active;

    const animate = () => {
      setSparks(prev => {
        const updated = prev
          .map(spark => ({
            ...spark,
            x: spark.x + spark.vx,
            y: spark.y + spark.vy,
            vy: spark.vy + spark.gravity,
            vx: spark.vx * 0.98, // Air resistance
            life: spark.life - spark.decay,
            opacity: spark.life,
          }))
          .filter(spark => spark.life > 0 && spark.x > -150 && spark.x < 350 && spark.y > -50 && spark.y < 150);

        return updated;
      });

      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [active, spawnBurst]);

  if (sparks.length === 0) return null;

  return (
    <div className="spark-container">
      {sparks.map(spark => (
        <Spark key={spark.id} {...spark} />
      ))}
    </div>
  );
}

export default SparkEffect;
