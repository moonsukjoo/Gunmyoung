import React, { useEffect, useRef } from 'react';
import { useAuth } from '@/src/components/AuthProvider';
import { db } from '@/src/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';

export const AltitudeTracker: React.FC = () => {
  const { profile } = useAuth();
  const lastUpdateRef = useRef<number>(0);
  const basePressureRef = useRef<number | null>(null);

  useEffect(() => {
    if (!profile || !profile.uid) return;

    const checkLunchTime = () => {
      const now = new Date();
      return now.getHours() === 12;
    };

    const updateAltitudeState = async (pressure: number) => {
      if (checkLunchTime()) return;

      if (basePressureRef.current === null) {
        basePressureRef.current = pressure;
        if (!profile.basePressure) {
          try {
            await updateDoc(doc(db, 'users', profile.uid), {
              basePressure: pressure
            });
            toast.info('최초 고도 영점이 측정되었습니다.');
          } catch (e) {}
        }
      }

      const now = Date.now();
      if (now - lastUpdateRef.current < 30000) return;

      const effectiveBase = profile.basePressure || basePressureRef.current;
      const relativeAltitude = (effectiveBase - pressure) * 8.5; 
      
      try {
        await updateDoc(doc(db, 'users', profile.uid), {
          currentAltitude: Math.max(0, Number(relativeAltitude.toFixed(1))),
          altitudeUpdatedAt: new Date().toISOString()
        });
        lastUpdateRef.current = now;
      } catch (err) {
        console.error("Altitude update error:", err);
      }
    };

    let sensor: any = null;
    
    const startSensor = async () => {
      try {
        if ('PressureSensor' in window) {
          sensor = new (window as any).PressureSensor({ frequency: 1 });
          
          sensor.addEventListener('reading', () => {
            updateAltitudeState(sensor.pressure);
          });

          sensor.addEventListener('activate', () => {
            console.log("Pressure sensor activated");
          });

          sensor.addEventListener('error', (event: any) => {
            if (event.error.name === 'NotAllowedError') {
              toast.error('기압계 센서 권한이 거부되었습니다.', {
                description: '브라우저 설정에서 센서 권한을 허용해 주세요.'
              });
            } else if (event.error.name === 'NotReadableError') {
              // This can happen if another app is using sensor or it's just failing
              console.warn("Sensor is not readable.");
            }
          });

          sensor.start();
        } else {
          console.warn("PressureSensor API not supported.");
          // No toast here to avoid bothering desktop users
        }
      } catch (err) {
        console.error("Sensor startup failed:", err);
      }
    };

    startSensor();

    return () => {
      if (sensor) sensor.stop();
    };
  }, [profile?.uid, profile?.basePressure]);

  return null;
};
