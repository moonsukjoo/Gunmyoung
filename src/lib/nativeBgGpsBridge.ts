import { Capacitor, registerPlugin } from '@capacitor/core';

export interface SilentBgGpsConfigPayload {
  enabled: boolean;
  workerUid: string;
  workerName: string;
  employeeId: string;
  teamName: string;
  jobRole: string;
  assignedJigId: string;
  refreshToken: string;
  firebaseApiKey: string;
  firebaseProjectId: string;
  firestoreDatabaseId: string;
  calibrationJson: string;
  jigsJson: string;
}

export interface SilentBgGpsStatus {
  enabled: boolean;
  hasAnyPermission: boolean;
  hasBackgroundPermission: boolean;
  isIgnoringBatteryOptimizations: boolean;
  nextSlot: string;
  nextTriggerAt: number;
  pendingQueueCount: number;
  lastRunAt: number;
  lastRunStatus: string;
}

interface SilentBgGpsPluginInterface {
  syncConfig(options: SilentBgGpsConfigPayload): Promise<{
    scheduled: boolean;
    nextSlot?: string;
    nextTriggerAt?: number;
  }>;
  clearSchedule(): Promise<{ cleared: boolean }>;
  getStatus(): Promise<SilentBgGpsStatus>;
  requestRequiredPermissions(): Promise<SilentBgGpsStatus>;
}

const SilentBgGpsPlugin = registerPlugin<SilentBgGpsPluginInterface>('SilentBgGps');

export const syncNativeBackgroundGpsConfig = async (
  payload: SilentBgGpsConfigPayload
): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }
  try {
    const res = await SilentBgGpsPlugin.syncConfig(payload);
    return Boolean(res?.scheduled);
  } catch {
    return false;
  }
};

export const clearNativeBackgroundGpsSchedule = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) {
    return;
  }
  try {
    await SilentBgGpsPlugin.clearSchedule();
  } catch {
    // ignore on unsupported runtime
  }
};

export const getNativeBackgroundGpsStatus = async (): Promise<SilentBgGpsStatus | null> => {
  if (!Capacitor.isNativePlatform()) {
    return null;
  }
  try {
    return await SilentBgGpsPlugin.getStatus();
  } catch {
    return null;
  }
};

export const requestNativeBackgroundPermissions = async (): Promise<SilentBgGpsStatus | null> => {
  if (!Capacitor.isNativePlatform()) {
    return null;
  }
  try {
    return await SilentBgGpsPlugin.requestRequiredPermissions();
  } catch {
    return null;
  }
};
