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
