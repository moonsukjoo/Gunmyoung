import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

export interface GpsCoordinateResult {
  lat: number;
  lng: number;
  accuracy: number;
  source: 'CAPACITOR_NATIVE' | 'WEB_GEOLOCATION';
  isFallbackCoarse?: boolean;
  timestamp: number;
}

export interface GpsDiagnosticInfo {
  isNative: boolean;
  platform: string;
  isSecureContext: boolean;
  hasNavigatorGeolocation: boolean;
}

export const getGpsDiagnosticInfo = (): GpsDiagnosticInfo => {
  const isNative = Capacitor.isNativePlatform();
  const platform = Capacitor.getPlatform();
  const isSecureContext =
    typeof window !== 'undefined' ? Boolean(window.isSecureContext || window.location.hostname === 'localhost') : true;
  const hasNavigatorGeolocation = typeof navigator !== 'undefined' && 'geolocation' in navigator;

  return {
    isNative,
    platform,
    isSecureContext,
    hasNavigatorGeolocation
  };
};

const formatWebGeolocationError = (err: GeolocationPositionError | Error | any, isSecureContext: boolean): Error => {
  const code = err?.code;
  const rawMsg = err?.message || '';

  if (!isSecureContext) {
    return new Error(
      '보안 연결(HTTPS)이 아닌 주소에서는 브라우저 GPS가 차단됩니다. HTTPS 주소 또는 Android APK 앱으로 접속해 주세요.'
    );
  }
  if (code === 1 || rawMsg.toLowerCase().includes('denied') || rawMsg.toLowerCase().includes('permission')) {
    return new Error(
      '위치 권한이 거부되었습니다. 기기 설정 또는 브라우저 주소창에서 위치 권한을 [허용]으로 변경해 주세요.'
    );
  }
  if (code === 3 || rawMsg.toLowerCase().includes('timeout')) {
    return new Error(
      'GPS 위성 수신 시간이 초과되었습니다. 공장 철골 지붕 아래에서는 창가나 출입문 쪽으로 이동해 다시 시도해 주세요.'
    );
  }
  if (code === 2 || rawMsg.toLowerCase().includes('unavailable')) {
    return new Error('단말기의 위치 서비스(GPS)가 꺼져 있거나 신호를 잡을 수 없습니다.');
  }
  return new Error(rawMsg || 'GPS 좌표를 가져오지 못했습니다.');
};

const getWebPosition = (options: PositionOptions): Promise<GeolocationPosition> => {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('이 기기/브라우저에서는 위치 정보를 지원하지 않습니다.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
};

/**
 * Unified cross-platform GPS acquisition helper for both:
 *  - Capacitor Android/iOS APK (@capacitor/geolocation with runtime permission request)
 *  - Web browser (navigator.geolocation)
 * Automatically falls back from high-accuracy satellite lock to network/Fused coarse fix indoors.
 */
export const getCurrentGpsPosition = async (options?: {
  timeoutMs?: number;
  maximumAgeMs?: number;
  skipCoarseFallback?: boolean;
}): Promise<GpsCoordinateResult> => {
  const timeoutMs = options?.timeoutMs ?? 12000;
  const maximumAgeMs = options?.maximumAgeMs ?? 5000;
  const { isNative, isSecureContext } = getGpsDiagnosticInfo();

  // 1. Native Android / iOS via Capacitor Geolocation
  if (isNative) {
    try {
      let perm = await Geolocation.checkPermissions();
      if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
        perm = await Geolocation.requestPermissions({ permissions: ['location', 'coarseLocation'] });
      }

      if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
        throw new Error(
          '앱 위치 권한이 허용되지 않았습니다. 휴대폰 [설정 -> 앱 -> 건명기업 HRM -> 권한 -> 위치]에서 허용해 주세요.'
        );
      }

      try {
        const nativeHigh = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: timeoutMs,
          maximumAge: maximumAgeMs
        });
        return {
          lat: Number(nativeHigh.coords.latitude.toFixed(7)),
          lng: Number(nativeHigh.coords.longitude.toFixed(7)),
          accuracy: Math.round((nativeHigh.coords.accuracy || 10) * 10) / 10,
          source: 'CAPACITOR_NATIVE',
          isFallbackCoarse: false,
          timestamp: nativeHigh.timestamp || Date.now()
        };
      } catch (highErr: any) {
        if (options?.skipCoarseFallback) throw highErr;
        // Fallback inside steel factory buildings: Wi-Fi / Cell / Fused coarse location
        try {
          const nativeCoarse = await Geolocation.getCurrentPosition({
            enableHighAccuracy: false,
            timeout: Math.max(8000, timeoutMs - 2000),
            maximumAge: 20000
          });
          return {
            lat: Number(nativeCoarse.coords.latitude.toFixed(7)),
            lng: Number(nativeCoarse.coords.longitude.toFixed(7)),
            accuracy: Math.round((nativeCoarse.coords.accuracy || 25) * 10) / 10,
            source: 'CAPACITOR_NATIVE',
            isFallbackCoarse: true,
            timestamp: nativeCoarse.timestamp || Date.now()
          };
        } catch (coarseErr: any) {
          // Last resort: try WebView geolocation
          const webPos = await getWebPosition({
            enableHighAccuracy: false,
            timeout: 8000,
            maximumAge: 20000
          });
          return {
            lat: Number(webPos.coords.latitude.toFixed(7)),
            lng: Number(webPos.coords.longitude.toFixed(7)),
            accuracy: Math.round((webPos.coords.accuracy || 25) * 10) / 10,
            source: 'WEB_GEOLOCATION',
            isFallbackCoarse: true,
            timestamp: webPos.timestamp || Date.now()
          };
        }
      }
    } catch (nativeErr: any) {
      throw formatWebGeolocationError(nativeErr, true);
    }
  }

  // 2. Web Browser Geolocation
  try {
    const pos = await getWebPosition({
      enableHighAccuracy: true,
      timeout: timeoutMs,
      maximumAge: maximumAgeMs
    });
    return {
      lat: Number(pos.coords.latitude.toFixed(7)),
      lng: Number(pos.coords.longitude.toFixed(7)),
      accuracy: Math.round((pos.coords.accuracy || 10) * 10) / 10,
      source: 'WEB_GEOLOCATION',
      isFallbackCoarse: false,
      timestamp: pos.timestamp || Date.now()
    };
  } catch (err: any) {
    // Do not retry if user explicitly denied permission
    if (err?.code === 1 || options?.skipCoarseFallback) {
      throw formatWebGeolocationError(err, isSecureContext);
    }

    try {
      const coarsePos = await getWebPosition({
        enableHighAccuracy: false,
        timeout: Math.max(8000, timeoutMs - 2000),
        maximumAge: 20000
      });
      return {
        lat: Number(coarsePos.coords.latitude.toFixed(7)),
        lng: Number(coarsePos.coords.longitude.toFixed(7)),
        accuracy: Math.round((coarsePos.coords.accuracy || 25) * 10) / 10,
        source: 'WEB_GEOLOCATION',
        isFallbackCoarse: true,
        timestamp: coarsePos.timestamp || Date.now()
      };
    } catch (fallbackErr: any) {
      throw formatWebGeolocationError(fallbackErr, isSecureContext);
    }
  }
};

export type GpsPermissionState = 'granted' | 'prompt' | 'denied';

/**
 * Checks GPS permission passively without triggering an OS permission dialog.
 */
export const checkGpsPermissionState = async (): Promise<GpsPermissionState> => {
  const { isNative, hasNavigatorGeolocation } = getGpsDiagnosticInfo();

  if (isNative) {
    try {
      const perm = await Geolocation.checkPermissions();
      if (perm.location === 'granted' || perm.coarseLocation === 'granted') {
        return 'granted';
      }
      if (perm.location === 'denied' && perm.coarseLocation === 'denied') {
        return 'denied';
      }
      return 'prompt';
    } catch {
      return 'prompt';
    }
  }

  if (!hasNavigatorGeolocation) return 'denied';
  try {
    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      if (status.state === 'granted' || status.state === 'denied' || status.state === 'prompt') {
        return status.state;
      }
    }
  } catch {
    // Safari / older WebViews may not support Permissions API for geolocation
  }
  return 'prompt';
};

export interface GpsWatchSubscription {
  unsubscribe: () => Promise<void>;
}

/**
 * Subscribes to continuous GPS updates across Capacitor Native and Web browsers.
 */
export const subscribeGpsPosition = async (
  onUpdate: (pos: GpsCoordinateResult) => void,
  onError?: (err: Error) => void,
  options?: {
    enableHighAccuracy?: boolean;
    timeoutMs?: number;
    maximumAgeMs?: number;
    requestPermissionIfNeeded?: boolean;
  }
): Promise<GpsWatchSubscription> => {
  const enableHighAccuracy = options?.enableHighAccuracy ?? true;
  const timeoutMs = options?.timeoutMs ?? 12000;
  const maximumAgeMs = options?.maximumAgeMs ?? 2000;
  const { isNative, isSecureContext, hasNavigatorGeolocation } = getGpsDiagnosticInfo();

  let active = true;

  if (isNative) {
    let callbackId: string | null = null;
    try {
      let perm = await Geolocation.checkPermissions();
      if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
        if (options?.requestPermissionIfNeeded) {
          perm = await Geolocation.requestPermissions({ permissions: ['location', 'coarseLocation'] });
        } else {
          throw new Error('앱 위치 권한이 아직 허용되지 않았습니다.');
        }
      }
      if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
        throw new Error('앱 위치 권한이 거부되어 백그라운드 추적을 시작할 수 없습니다.');
      }

      callbackId = await Geolocation.watchPosition(
        {
          enableHighAccuracy,
          timeout: timeoutMs,
          maximumAge: maximumAgeMs
        },
        (position, err) => {
          if (!active) return;
          if (err) {
            onError?.(formatWebGeolocationError(err, true));
            return;
          }
          if (position) {
            onUpdate({
              lat: Number(position.coords.latitude.toFixed(7)),
              lng: Number(position.coords.longitude.toFixed(7)),
              accuracy: Math.round((position.coords.accuracy || 10) * 10) / 10,
              source: 'CAPACITOR_NATIVE',
              isFallbackCoarse: !enableHighAccuracy,
              timestamp: position.timestamp || Date.now()
            });
          }
        }
      );
    } catch (err: any) {
      onError?.(formatWebGeolocationError(err, true));
    }

    return {
      unsubscribe: async () => {
        active = false;
        if (callbackId) {
          try {
            await Geolocation.clearWatch({ id: callbackId });
          } catch {
            // ignore clearWatch cleanup error
          }
        }
      }
    };
  }

  if (!hasNavigatorGeolocation) {
    onError?.(new Error('이 기기/브라우저에서는 위치 정보를 지원하지 않습니다.'));
    return { unsubscribe: async () => {} };
  }

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      if (!active) return;
      onUpdate({
        lat: Number(position.coords.latitude.toFixed(7)),
        lng: Number(position.coords.longitude.toFixed(7)),
        accuracy: Math.round((position.coords.accuracy || 10) * 10) / 10,
        source: 'WEB_GEOLOCATION',
        isFallbackCoarse: !enableHighAccuracy,
        timestamp: position.timestamp || Date.now()
      });
    },
    (err) => {
      if (!active) return;
      onError?.(formatWebGeolocationError(err, isSecureContext));
    },
    {
      enableHighAccuracy,
      timeout: timeoutMs,
      maximumAge: maximumAgeMs
    }
  );

  return {
    unsubscribe: async () => {
      active = false;
      try {
        navigator.geolocation.clearWatch(watchId);
      } catch {
        // ignore clearWatch error
      }
    }
  };
};

export interface AveragedGpsResult extends GpsCoordinateResult {
  sampleCount: number;
  attemptedCount: number;
  discardedOutliers: number;
  spreadMeters: number;
  samples: Array<{
    lat: number;
    lng: number;
    accuracy: number;
    timestamp: number;
  }>;
}

const calcMetersBetween = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Pure helper computing outlier-filtered, inverse-variance accuracy-weighted average
 * from multiple raw GPS samples (exposed for unit testing & reuse).
 */
export const computeFilteredAverageCoordinate = (
  samples: Array<{ lat: number; lng: number; accuracy: number; timestamp: number; source?: GpsCoordinateResult['source'] }>
): AveragedGpsResult => {
  if (samples.length === 0) {
    throw new Error('유효한 GPS 좌표 샘플이 없습니다.');
  }

  if (samples.length === 1) {
    const only = samples[0];
    return {
      lat: Number(only.lat.toFixed(7)),
      lng: Number(only.lng.toFixed(7)),
      accuracy: Math.round((only.accuracy || 10) * 10) / 10,
      source: only.source || 'WEB_GEOLOCATION',
      timestamp: only.timestamp || Date.now(),
      sampleCount: 1,
      attemptedCount: 1,
      discardedOutliers: 0,
      spreadMeters: 0,
      samples: [{ lat: only.lat, lng: only.lng, accuracy: only.accuracy, timestamp: only.timestamp }]
    };
  }

  const sortedLat = [...samples].map(s => s.lat).sort((a, b) => a - b);
  const sortedLng = [...samples].map(s => s.lng).sort((a, b) => a - b);
  const sortedAcc = [...samples].map(s => Math.max(3, s.accuracy || 10)).sort((a, b) => a - b);
  const mid = Math.floor(samples.length / 2);
  const medianLat = sortedLat[mid];
  const medianLng = sortedLng[mid];
  const medianAcc = sortedAcc[mid];
  const outlierThresholdMeters = Math.max(35, medianAcc * 2);

  let filtered = samples.filter(
    s => calcMetersBetween(s.lat, s.lng, medianLat, medianLng) <= outlierThresholdMeters
  );
  if (filtered.length === 0) {
    // Fallback to the two lowest-accuracy-error samples if spread is wide
    filtered = [...samples].sort((a, b) => (a.accuracy || 999) - (b.accuracy || 999)).slice(0, 2);
  }
  const discardedOutliers = Math.max(0, samples.length - filtered.length);

  let weightSum = 0;
  let latWeighted = 0;
  let lngWeighted = 0;
  let accWeighted = 0;

  filtered.forEach(s => {
    const acc = Math.max(3, s.accuracy || 12);
    const weight = 1 / (acc * acc);
    weightSum += weight;
    latWeighted += s.lat * weight;
    lngWeighted += s.lng * weight;
    accWeighted += acc * weight;
  });

  const avgLat = Number((latWeighted / weightSum).toFixed(7));
  const avgLng = Number((lngWeighted / weightSum).toFixed(7));
  const avgAcc = Math.round((accWeighted / weightSum) * 10) / 10;

  const spreadMeters = Math.round(
    Math.max(...filtered.map(s => calcMetersBetween(s.lat, s.lng, avgLat, avgLng))) * 10
  ) / 10;

  const latestSample = filtered[filtered.length - 1];
  return {
    lat: avgLat,
    lng: avgLng,
    accuracy: avgAcc,
    source: latestSample.source || 'WEB_GEOLOCATION',
    timestamp: latestSample.timestamp || Date.now(),
    sampleCount: filtered.length,
    attemptedCount: samples.length,
    discardedOutliers,
    spreadMeters,
    samples: filtered.map(s => ({ lat: s.lat, lng: s.lng, accuracy: s.accuracy, timestamp: s.timestamp }))
  };
};

/**
 * Multi-attempt GPS sampler that retries several times and averages out indoor steel-roof jitter.
 * When `silent: true`, aborts cleanly without triggering an OS permission dialog if not granted yet.
 */
export const getAveragedGpsPosition = async (options?: {
  attempts?: number;
  minSamples?: number;
  intervalMs?: number;
  timeoutPerAttemptMs?: number;
  silent?: boolean;
}): Promise<AveragedGpsResult> => {
  const attempts = Math.max(1, Math.min(8, options?.attempts ?? 5));
  const minSamples = Math.max(1, options?.minSamples ?? 2);
  const intervalMs = Math.max(300, options?.intervalMs ?? 1100);
  const timeoutPerAttemptMs = options?.timeoutPerAttemptMs ?? 8000;

  if (options?.silent) {
    const perm = await checkGpsPermissionState();
    if (perm !== 'granted') {
      throw new Error('위치 권한이 아직 승인되지 않아 무음 측정을 건너뜁니다.');
    }
  }

  const collected: Array<{
    lat: number;
    lng: number;
    accuracy: number;
    timestamp: number;
    source: GpsCoordinateResult['source'];
  }> = [];
  let lastError: any = null;

  for (let i = 0; i < attempts; i++) {
    try {
      const fix = await getCurrentGpsPosition({
        timeoutMs: timeoutPerAttemptMs,
        maximumAgeMs: 0,
        skipCoarseFallback: i < attempts - 1
      });
      collected.push({
        lat: fix.lat,
        lng: fix.lng,
        accuracy: fix.accuracy,
        timestamp: fix.timestamp,
        source: fix.source
      });
    } catch (err: any) {
      lastError = err;
      // Stop early if permission was explicitly denied
      if (err?.message?.includes('거부') || err?.message?.includes('권한')) {
        break;
      }
    }

    if (i < attempts - 1) {
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }

  if (collected.length === 0) {
    throw lastError || new Error('다중 GPS 평균 측정에 실패했습니다.');
  }

  if (collected.length < minSamples && collected.length === 1) {
    const averagedSingle = computeFilteredAverageCoordinate(collected);
    return {
      ...averagedSingle,
      attemptedCount: attempts
    };
  }

  const averaged = computeFilteredAverageCoordinate(collected);
  return {
    ...averaged,
    attemptedCount: attempts
  };
};


