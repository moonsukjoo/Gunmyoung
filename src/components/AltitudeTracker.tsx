import React, { useEffect, useRef } from 'react';
import { useAuth } from '@/src/components/AuthProvider';
import { db } from '@/src/firebase';
import { doc, updateDoc } from 'firebase/firestore';

// Pressure to Altitude conversion helper
// Standard formula: h = (1 - (P/P0)^0.190284) * 145366.45 * 0.3048
// Simplified for relative height: delta_h = (P_baseline - P_current) * 8.5 (approx meters per hPa)

export const AltitudeTracker: React.FC = () => {
  const { profile } = useAuth();
  const lastUpdateRef = useRef<number>(0);
  const basePressureRef = useRef<number | null>(null);

  useEffect(() => {
    if (!profile || !profile.uid) return;

    // Check lunch time (12:00 - 13:00)
    const checkLunchTime = () => {
      const now = new Date();
      const hour = now.getHours();
      return hour === 12; // 12:00 ~ 12:59
    };

    const updateAltitudeState = async (pressure: number) => {
      if (checkLunchTime()) return;

      // Initialize base pressure if not set
      if (basePressureRef.current === null) {
        basePressureRef.current = pressure;
      }

      const now = Date.now();
      // Throttle updates to every 30 seconds to save battery/quota
      if (now - lastUpdateRef.current < 30000) return;

      const relativeAltitude = (basePressureRef.current - pressure) * 8.5; // Approx meters
      
      try {
        await updateDoc(doc(db, 'users', profile.uid), {
          currentAltitude: Math.max(0, Number(relativeAltitude.toFixed(1))),
          altitudeUpdatedAt: new Date().toISOString(),
          basePressure: basePressureRef.current
        });
        lastUpdateRef.current = now;
      } catch (err) {
        console.error("Altitude update error:", err);
      }
    };

    // Generic Sensor API if available
    let sensor: any = null;
    try {
      if ('PressureSensor' in window) {
        sensor = new (window as any).PressureSensor({ frequency: 1 });
        sensor.addEventListener('reading', () => {
          updateAltitudeState(sensor.pressure);
        });
        sensor.start();
      } else {
        // Fallback or Simulation for desktop/unsupported devices
        // In a real production app, we would use a Capacitor plugin here
        console.log("Barometer not supported, using simulation/idle state");
      }
    } catch (err) {
      console.error("Sensor initialization error:", err);
    }

    return () => {
      if (sensor) sensor.stop();
    };
  }, [profile?.uid]);

  return null; // Silent background component
};
