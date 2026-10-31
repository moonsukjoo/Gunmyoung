import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Device } from '@capacitor/device';
import { Share } from '@capacitor/share';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

/**
 * Cloud Run Production Backend URL used for APK clients running on localhost
 */
const CLOUD_BACKEND_URL = 'https://ais-pre-dt46w2jtf2jgylnqy6fvua-201930950703.asia-east1.run.app';

/**
 * Get active backend base URL (resolves localhost in APK to Cloud Run)
 */
const getBackendBaseUrl = (): string => {
  if (typeof window === 'undefined') return CLOUD_BACKEND_URL;
  const origin = window.location.origin;
  if (!origin || origin.includes('localhost') || origin.includes('capacitor://') || origin.includes('ionic://')) {
    return CLOUD_BACKEND_URL;
  }
  return origin;
};

/**
 * Check whether we are running inside native Capacitor environment (Android/iOS)
 */
export const isNativePlatform = (): boolean => {
  try {
    if (Capacitor.isNativePlatform()) return true;
    const p = Capacitor.getPlatform();
    return p === 'android' || p === 'ios';
  } catch {
    return false;
  }
};

/**
 * Safely check the runtime platform with instant native check
 */
const getPlatformSafely = async (): Promise<string> => {
  try {
    const p = Capacitor.getPlatform();
    if (p === 'android' || p === 'ios') return p;
    const info = await Promise.race([
      Device.getInfo(),
      new Promise<{ platform: string }>((res) => setTimeout(() => res({ platform: 'web' }), 200))
    ]);
    return info?.platform || 'web';
  } catch {
    return 'web';
  }
};

/**
 * Convert Blob to Base64 cleanly and safely
 */
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      try {
        const base64String = reader.result as string;
        resolve(base64String.split(',')[1] || '');
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Write large Base64 data in 256KB chunks over the Capacitor Android Bridge.
 * This GUARANTEES that Android's 1MB Binder transaction limit (TransactionTooLargeException)
 * is NEVER exceeded, completely eliminating Android native bridge crashes.
 */
const writeBase64InChunks = async (path: string, base64Data: string, directory: Directory): Promise<string | null> => {
  try {
    const CHUNK_SIZE = 256 * 1024; // 256KB per slice (safely below Android 1MB IPC limit)
    
    // Write first chunk (replaces/creates file)
    const firstChunk = base64Data.slice(0, CHUNK_SIZE);
    const result = await Filesystem.writeFile({
      path,
      data: firstChunk,
      directory,
      recursive: true
    });
    
    // Append subsequent chunks if file is larger than 256KB
    let offset = CHUNK_SIZE;
    while (offset < base64Data.length) {
      const nextChunk = base64Data.slice(offset, offset + CHUNK_SIZE);
      await Filesystem.appendFile({
        path,
        data: nextChunk,
        directory
      });
      offset += CHUNK_SIZE;
    }
    
    return result.uri;
  } catch (err) {
    console.warn('Filesystem plugin native call caught safely:', err);
    return null;
  }
};

/**
 * Robust file download helper with unified Email, Native Image-Based In-App Preview,
 * Cloud Download Gateway, and safe Cache writes.
 * 
 * NEVER launches unhandled blob: links or chooser intents that crash modern Android WebViews.
 */
export const downloadFile = async (
  blob: Blob, 
  fileName: string, 
  pageImages?: string[]
): Promise<boolean> => {
  // Dismiss any existing loading or toast indicators immediately
  toast.dismiss();

  // Remove any previously open modal
  const existingModal = document.getElementById('unified-download-modal');
  if (existingModal?.parentNode) {
    existingModal.parentNode.removeChild(existingModal);
  }

  const isNative = isNativePlatform();
  const platform = await getPlatformSafely();
  const isPdf = fileName.toLowerCase().endsWith('.pdf');
  const savedEmail = localStorage.getItem('last_share_email') || 'tjrwnfjqm1@gmail.com';
  const backendBase = getBackendBaseUrl();

  return new Promise<boolean>((resolve) => {
    // Create Modal Overlay
    const modal = document.createElement('div');
    modal.id = 'unified-download-modal';
    modal.className = 'fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md font-sans';
    
    modal.innerHTML = `
      <div id="unified-download-modal-inner" class="bg-zinc-950 border border-zinc-800 rounded-[2.5rem] p-6 sm:p-7 w-full max-w-md shadow-2xl text-white relative font-sans max-h-[92vh] overflow-y-auto">
        
        <!-- Top Accent Bar -->
        <div class="absolute top-0 left-0 right-0 h-1.5 rounded-t-[2.5rem] bg-gradient-to-r ${isPdf ? 'from-rose-500 via-indigo-500 to-amber-500' : 'from-emerald-500 to-teal-500'}"></div>
        
        <!-- Modal Header -->
        <div class="flex items-start justify-between mb-4 mt-1">
          <div class="space-y-1">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${isPdf ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}">
              ${isPdf ? 'PDF REPORT (공식 보고서)' : 'EXCEL SHEET'}
            </span>
            <h3 class="text-lg font-black tracking-tight leading-snug">보고서 열기 및 기기 저장</h3>
          </div>
          <button id="modal-close-btn" class="w-8 h-8 rounded-full border border-zinc-800 hover:border-zinc-700 bg-zinc-900/50 flex items-center justify-center text-zinc-400 hover:text-white transition-all cursor-pointer">
            ✕
          </button>
        </div>
        
        <!-- Document Metadata Info -->
        <div class="bg-zinc-900/60 rounded-2xl border border-zinc-850 p-3.5 mb-4 flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isPdf ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}">
            ${isPdf 
              ? `<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-2-2a1 1 0 00-.707-.293H7a2 2 0 00-2 2V19a2 2 0 002 2z" /></svg>`
              : `<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>`
            }
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">생성된 파일명</p>
            <p class="text-xs font-bold text-zinc-200 truncate">${fileName}</p>
          </div>
        </div>
        
        <!-- Action List Buttons -->
        <div class="space-y-2.5 pt-1">
          <!-- 1. Native Image-Based In-App Preview (100% visible, no black screen) -->
          ${(pageImages && pageImages.length > 0) ? `
          <button 
            id="modal-preview-btn" 
            class="w-full h-15 bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white font-black text-xs rounded-2xl flex flex-col items-center justify-center gap-0.5 shadow-lg shadow-indigo-600/20 active:scale-95 transition-all text-center border border-indigo-400/20 cursor-pointer"
          >
            <div class="flex items-center gap-1.5">
              <svg class="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              <span class="text-sm">👁️ 내 앱에서 바로보기 (전체 페이지 열람)</span>
            </div>
            <span class="text-[10px] font-bold text-indigo-100/90">(검은 화면 없이 앱 내 고화질 즉시 표시 • 갤러리 저장)</span>
          </button>
          ` : ''}

          <!-- 2. Direct Device Download Button (Local Storage + Cloud HTTPS Gateway) -->
          <button 
            id="modal-direct-dl-btn" 
            class="w-full h-14 bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-500 hover:to-teal-500 text-white font-black text-xs rounded-2xl flex flex-col items-center justify-center gap-0.5 shadow-lg shadow-blue-600/20 active:scale-95 transition-all text-center border border-blue-400/20 cursor-pointer"
          >
            <div class="flex items-center gap-1.5">
              <svg class="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              <span class="text-sm">📥 기기로 다운받기 (내 파일/Documents 저장)</span>
            </div>
            <span class="text-[10px] font-bold text-blue-100/90">(기기 저장소 직통 저장 • 안드로이드 14 호환 완료)</span>
          </button>

          <!-- 3. Email Section -->
          <div class="p-3 bg-zinc-900/60 rounded-2xl border border-zinc-850 space-y-2">
            <label class="text-[10px] font-black text-zinc-400 uppercase tracking-widest pl-1 block">✉️ 사내 이메일 실시간 전송</label>
            <div class="flex gap-2">
              <input 
                id="modal-email-input" 
                type="email" 
                value="${savedEmail}" 
                placeholder="email@example.com"
                class="flex-1 h-11 bg-zinc-950 border border-zinc-800 rounded-xl px-3 text-xs font-bold text-white focus:outline-none focus:border-zinc-600 transition-all placeholder:text-zinc-600"
              />
              <button 
                id="modal-email-send-btn" 
                class="h-11 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all shrink-0 cursor-pointer"
              >
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                전송
              </button>
            </div>
          </div>
          
          <!-- 4. Native App Share Button (Safe Link Share) -->
          <button 
            id="modal-native-share-btn" 
            class="w-full h-11 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-zinc-400 hover:text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all text-center cursor-pointer"
          >
            <svg class="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
            <span>외부 앱 공유 (카카오톡 • 문자 • 메일 링크 공유)</span>
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const closeBtn = document.getElementById('modal-close-btn') as HTMLButtonElement;
    const emailInput = document.getElementById('modal-email-input') as HTMLInputElement;
    const emailSendBtn = document.getElementById('modal-email-send-btn') as HTMLButtonElement;
    const shareBtn = document.getElementById('modal-native-share-btn') as HTMLButtonElement;
    const downloadBtn = document.getElementById('modal-direct-dl-btn') as HTMLButtonElement;
    const previewBtn = document.getElementById('modal-preview-btn') as HTMLButtonElement | null;
    
    const dismiss = (result: boolean) => {
      if (modal.parentNode) {
        document.body.removeChild(modal);
      }
      resolve(result);
    };
    
    closeBtn.onclick = () => dismiss(false);
    modal.onclick = (e) => {
      if (e.target === modal) {
        dismiss(false);
      }
    };

    // Action 1: Native Image-Based In-App Preview (100% visible on Android)
    if (previewBtn && pageImages && pageImages.length > 0) {
      previewBtn.onclick = () => {
        openImageBasedInAppViewer(pageImages, fileName, blob, () => dismiss(true));
      };
    }
    
    // Action 2: Direct Device Download (Local storage direct write + Cloud Gateway)
    downloadBtn.onclick = async () => {
      try {
        toast.loading('기기 다운로드 준비 중...', { id: 'save-progress' });
        const base64Data = await blobToBase64(blob);
        let savedLocally = false;

        // A. If running on native Android/iOS, write directly to phone's Documents or Cache folder
        if (isNative || platform === 'android' || platform === 'ios') {
          try {
            await writeBase64InChunks(fileName, base64Data, Directory.Documents);
            savedLocally = true;
          } catch (docErr) {
            console.warn('Documents directory write fallback to Cache:', docErr);
            try {
              await writeBase64InChunks(fileName, base64Data, Directory.Cache);
              savedLocally = true;
            } catch (cacheErr) {
              console.warn('Cache write note:', cacheErr);
            }
          }
        }

        // B. Also prepare Cloud Run HTTPS download URL for system DownloadManager
        let downloadUrl = '';
        try {
          const resp = await fetch(`${backendBase}/api/reports/prepare-download`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: fileName,
              base64Data,
              mimeType: isPdf ? 'application/pdf' : 'application/octet-stream'
            })
          });
          if (resp.ok) {
            const data = await resp.json();
            if (data.downloadUrl) {
              downloadUrl = data.downloadUrl.startsWith('http') 
                ? data.downloadUrl 
                : `${backendBase}${data.downloadUrl}`;
            }
          }
        } catch (netErr) {
          console.warn('Backend download gateway unreachable:', netErr);
        }

        if (isNative || platform === 'android' || platform === 'ios') {
          if (downloadUrl) {
            // Hand off to Android system browser (Chrome) using _system to download cleanly to Downloads folder
            try {
              window.open(downloadUrl, '_system');
            } catch (e) {
              console.warn('window.open _system fallback:', e);
            }
          }
          toast.success(
            savedLocally 
              ? '휴대폰 [내 파일 > 문서(Documents)]에 저장되었습니다!' 
              : '다운로드가 시작되었습니다.', 
            { id: 'save-progress', duration: 4000 }
          );
        } else {
          // Standard web browser download
          triggerWebDownload(blob, fileName);
          toast.success('기기에 파일 저장이 완료되었습니다.', { id: 'save-progress' });
        }

        dismiss(true);
      } catch (err: any) {
        console.error('Device download error:', err);
        toast.dismiss('save-progress');
        toast.error('기기 다운로드 중 오류가 발생했습니다. [내 앱에서 바로보기] 또는 이메일 전송을 이용해주세요.');
      }
    };
    
    // Action 3: Native Share (Safe Link Share without FLAG_IMMUTABLE Android 14 crash)
    shareBtn.onclick = async () => {
      try {
        toast.loading('공유 링크 생성 중...', { id: 'share-progress' });
        const base64Data = await blobToBase64(blob);

        let downloadUrl = '';
        try {
          const resp = await fetch(`${backendBase}/api/reports/prepare-download`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: fileName,
              base64Data,
              mimeType: isPdf ? 'application/pdf' : 'application/octet-stream'
            })
          });
          if (resp.ok) {
            const data = await resp.json();
            if (data.downloadUrl) {
              downloadUrl = data.downloadUrl.startsWith('http') 
                ? data.downloadUrl 
                : `${backendBase}${data.downloadUrl}`;
            }
          }
        } catch (err) {
          console.warn('Share link prepare warning:', err);
        }

        toast.dismiss('share-progress');

        const shareText = downloadUrl 
          ? `[건명기업] ${fileName}\n다운로드: ${downloadUrl}` 
          : `[건명기업] ${fileName}`;

        if (isNative || platform === 'android' || platform === 'ios') {
          await Share.share({
            title: fileName,
            text: shareText,
            url: downloadUrl || undefined,
            dialogTitle: '보고서 링크 공유'
          });
        } else if (navigator.share) {
          await navigator.share({
            title: fileName,
            text: shareText,
            url: downloadUrl || window.location.href
          });
        } else {
          await navigator.clipboard.writeText(shareText);
          toast.success('공유 텍스트가 클립보드에 복사되었습니다.');
        }
      } catch (shareErr: any) {
        toast.dismiss('share-progress');
        if (shareErr?.name !== 'AbortError') {
          console.warn('Share warning:', shareErr);
          toast.error('공유 메뉴를 실행할 수 없습니다.');
        }
      }
    };
    
    // Action 4: Email Sender Delivery
    emailSendBtn.onclick = async () => {
      const emailVal = emailInput.value?.trim();
      if (!emailVal || !emailVal.includes('@')) {
        toast.error('올바른 이메일 주소를 입력해 주세요.');
        return;
      }
      
      localStorage.setItem('last_share_email', emailVal);
      
      try {
        toast.loading('사내 메일 서버로 발송 중입니다...', { id: 'email-progress' });
        const base64Data = await blobToBase64(blob);
        
        const response = await fetch(`${backendBase}/api/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: emailVal,
            subject: `[건명기업] 통합 스마트 안전 관리 보고서 - ${fileName}`,
            filename: fileName,
            base64Data: base64Data
          })
        });
        
        const result = await response.json();
        if (response.ok && result.success) {
          toast.success(`보고서가 ${emailVal} (으)로 실시간 발급 전송되었습니다!`, { id: 'email-progress', duration: 4000 });
          dismiss(true);
        } else {
          throw new Error(result.details || result.error || '이메일 전송에 실패하였습니다.');
        }
      } catch (err: any) {
        console.error('Email send error:', err);
        toast.error(`메일 발송 안내: ${err.message}`, { id: 'email-progress', duration: 4000 });
      }
    };
  });
};

/**
 * Mobile device Capacitor sharing action handler.
 * Completely crash-proof:
 * 1. Writes to Directory.Cache in 256KB chunks so Android Binder limit is NEVER exceeded.
 * 2. Calls Share.share inside strict try/catch so any native rejection does NOT kill the app.
 */
const triggerNativeShare = async (blob: Blob, fileName: string) => {
  try {
    toast.loading('공유 메뉴를 준비하는 중입니다...', { id: 'share-progress' });
    const base64Data = await blobToBase64(blob);
    const safeExt = fileName.toLowerCase().endsWith('.xlsx') ? '.xlsx' : '.pdf';
    const tempFileName = `gunmyoung_share_${Date.now()}${safeExt}`;

    // Write in safe 256KB slices to avoid Android Binder TransactionTooLargeException
    const savedUri = await writeBase64InChunks(tempFileName, base64Data, Directory.Cache);
    toast.dismiss('share-progress');

    // Trigger system shares using `files` array if available
    await Share.share({
      title: fileName,
      text: `[건명기업] ${fileName}`,
      files: savedUri ? [savedUri] : undefined,
      dialogTitle: '보고서 파일 공유'
    });
    return true;
  } catch (err: any) {
    toast.dismiss('share-progress');
    if (err?.name === 'AbortError' || err?.message?.includes('canceled') || err?.message?.includes('cancelled')) {
      return true;
    }
    console.warn('Capacitor sharing flow warning:', err);
    toast.error('기기 공유 시트가 지원되지 않는 환경입니다. [기기로 다운받기] 또는 [내 앱에서 바로보기]를 이용해주세요.');
    return false;
  }
};

/**
 * Opens an In-App Native Image-Based Report Viewer modal.
 * Completely eliminates the black screen caused by Android WebView's lack of iframe PDF support.
 * Renders all pages as crisp, responsive, hardware-accelerated image cards with zoom and individual page saves.
 */
const openImageBasedInAppViewer = (
  pageImages: string[], 
  fileName: string, 
  blob?: Blob,
  onClose?: () => void
) => {
  // Dismiss any lingering toast popups so they never obscure header controls
  toast.dismiss();

  const existingViewer = document.getElementById('in-app-image-report-viewer');
  if (existingViewer?.parentNode) {
    existingViewer.parentNode.removeChild(existingViewer);
  }

  const viewerModal = document.createElement('div');
  viewerModal.id = 'in-app-image-report-viewer';
  viewerModal.className = 'fixed inset-0 z-[100000] flex flex-col bg-zinc-950 text-white font-sans';
  
  viewerModal.innerHTML = `
    <!-- Viewer Header -->
    <div class="h-16 border-b border-zinc-800 bg-zinc-900/95 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between shrink-0 shadow-lg z-20">
      <div class="flex items-center gap-2 min-w-0 pr-1">
        <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
        <div class="min-w-0">
          <h4 class="text-xs sm:text-sm font-black truncate text-white">${fileName}</h4>
          <span class="text-[10px] font-bold text-zinc-400 shrink-0">총 ${pageImages.length}페이지 공식 리포트</span>
        </div>
      </div>
      
      <div class="flex items-center gap-1.5 shrink-0">
        <!-- Prominent "📥 파일로 저장" Download Button -->
        <button 
          id="viewer-dl-btn" 
          class="h-10 px-3 sm:px-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-teal-600 hover:from-blue-500 hover:to-teal-500 text-white font-black text-xs rounded-xl flex items-center gap-1.5 shadow-md active:scale-95 transition-all border border-blue-400/30 cursor-pointer"
        >
          <svg class="w-4 h-4 text-blue-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span class="font-bold">📥 파일 저장</span>
        </button>

        <!-- Print Button -->
        <button 
          id="viewer-print-btn" 
          class="h-10 px-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer active:scale-95 transition-all border border-zinc-700/50"
        >
          <svg class="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          <span class="hidden sm:inline">인쇄</span>
        </button>

        <!-- Close Button -->
        <button 
          id="viewer-close-btn" 
          class="h-10 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-black text-xs rounded-xl flex items-center justify-center cursor-pointer active:scale-95 transition-all border border-zinc-700/50"
        >
          ✕ 닫기
        </button>
      </div>
    </div>
    
    <!-- Viewer Scrollable Body: Image Page Stream -->
    <div class="flex-1 w-full h-full bg-zinc-950 overflow-y-auto p-4 flex flex-col items-center gap-6">
      ${pageImages.length === 0 ? `
        <div class="py-20 text-center text-zinc-400 space-y-2">
          <p class="text-sm font-bold">표시할 페이지 이미지가 없습니다.</p>
          <p class="text-xs text-zinc-500">상단의 [닫기]를 누른 후 [기기로 다운받기]를 이용해주세요.</p>
        </div>
      ` : pageImages.map((img, idx) => `
        <div class="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-2.5 border border-zinc-700/60 flex flex-col items-center">
          <div class="w-full flex items-center justify-between pb-2 px-1 text-[11px] font-black text-zinc-700 border-b border-zinc-200 mb-2">
            <span class="flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-blue-600"></span>
              건명기업(주) 공식 리포트
            </span>
            <span class="bg-zinc-100 text-zinc-800 px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold">[ ${idx + 1} / ${pageImages.length} 쪽 ]</span>
          </div>
          <img 
            src="${img}" 
            alt="보고서 ${idx + 1}페이지" 
            class="w-full h-auto rounded-lg shadow-inner block select-none bg-white" 
            loading="eager"
            decoding="sync"
          />
          <button 
            data-page-index="${idx}" 
            class="save-single-page-btn mt-3 w-full h-10 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
          >
            💾 제 ${idx + 1}쪽 사진(갤러리) 저장
          </button>
        </div>
      `).join('')}
      
      <div class="py-6 text-center text-xs text-zinc-500 font-bold space-y-1">
        <p>건명기업(주) 스마트 현장 관리 시스템 공식 인증 문서</p>
        <p class="text-[10px] text-zinc-600">상단의 [✕ 닫기] 버튼을 누르면 이전 화면으로 돌아갑니다.</p>
      </div>
    </div>
  `;

  document.body.appendChild(viewerModal);

  const closeBtn = document.getElementById('viewer-close-btn') as HTMLButtonElement;
  const printBtn = document.getElementById('viewer-print-btn') as HTMLButtonElement;
  const dlBtn = document.getElementById('viewer-dl-btn') as HTMLButtonElement | null;
  const pageSaveButtons = viewerModal.querySelectorAll('.save-single-page-btn');

  closeBtn.onclick = () => {
    if (viewerModal.parentNode) {
      document.body.removeChild(viewerModal);
    }
    if (onClose) onClose();
  };

  if (dlBtn) {
    dlBtn.onclick = async () => {
      try {
        toast.dismiss();
        toast.loading('기기 다운로드 준비 중...', { id: 'viewer-dl' });

        let targetBlob = blob;
        if (!targetBlob && pageImages.length > 0) {
          const pdf = new jsPDF('p', 'mm', 'a4');
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfPageHeight = pdf.internal.pageSize.getHeight();
          pageImages.forEach((img, idx) => {
            if (idx > 0) pdf.addPage();
            pdf.addImage(img, 'JPEG', 0, 0, pdfWidth, pdfPageHeight);
          });
          targetBlob = pdf.output('blob');
        }

        if (!targetBlob) {
          toast.error('저장할 데이터가 없습니다.', { id: 'viewer-dl' });
          return;
        }

        const base64Data = await blobToBase64(targetBlob);
        const isPdf = fileName.toLowerCase().endsWith('.pdf');
        const isNative = isNativePlatform();
        const platform = await getPlatformSafely();
        const backendBase = getBackendBaseUrl();

        let savedLocally = false;
        if (isNative || platform === 'android' || platform === 'ios') {
          try {
            await writeBase64InChunks(fileName, base64Data, Directory.Documents);
            savedLocally = true;
          } catch (docErr) {
            console.warn('Documents directory write note:', docErr);
            try {
              await writeBase64InChunks(fileName, base64Data, Directory.Cache);
              savedLocally = true;
            } catch (cacheErr) {
              console.warn('Cache write note:', cacheErr);
            }
          }
        }

        let downloadUrl = '';
        try {
          const resp = await fetch(`${backendBase}/api/reports/prepare-download`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: fileName,
              base64Data,
              mimeType: isPdf ? 'application/pdf' : 'application/octet-stream'
            })
          });
          if (resp.ok) {
            const data = await resp.json();
            if (data.downloadUrl) {
              downloadUrl = data.downloadUrl.startsWith('http') 
                ? data.downloadUrl 
                : `${backendBase}${data.downloadUrl}`;
            }
          }
        } catch (netErr) {
          console.warn('Download gateway note:', netErr);
        }

        if (isNative || platform === 'android' || platform === 'ios') {
          if (downloadUrl) {
            try {
              window.open(downloadUrl, '_system');
            } catch (e) {
              console.warn('window.open fallback:', e);
            }
          }
          toast.success(
            savedLocally 
              ? '휴대폰 [내 파일 > 문서(Documents)]에 저장되었습니다!' 
              : '다운로드가 시작되었습니다. (상단 알림창 확인)', 
            { id: 'viewer-dl', duration: 4000 }
          );
        } else {
          triggerWebDownload(targetBlob, fileName);
          toast.success('기기에 파일 저장이 완료되었습니다.', { id: 'viewer-dl' });
        }
      } catch (err: any) {
        console.error('Viewer download error:', err);
        toast.error('저장 중 오류가 발생했습니다.', { id: 'viewer-dl' });
      }
    };
  }


  printBtn.onclick = () => {
    window.print();
  };

  // Allow users on Android to save any single page directly as a JPEG to their photo gallery!
  pageSaveButtons.forEach((btn) => {
    (btn as HTMLButtonElement).onclick = async () => {
      const pIdx = parseInt((btn as HTMLButtonElement).dataset.pageIndex || '0', 10);
      const pageDataUrl = pageImages[pIdx];
      if (!pageDataUrl) return;

      try {
        const cleanBase64 = pageDataUrl.split(',')[1] || '';
        const pageFileName = `건명기업_보고서_${pIdx + 1}쪽_${Date.now()}.jpg`;

        if (isNativePlatform()) {
          await writeBase64InChunks(pageFileName, cleanBase64, Directory.Cache);
          toast.success(`제 ${pIdx + 1}쪽이 기기에 저장되었습니다!`);
        } else {
          const a = document.createElement('a');
          a.href = pageDataUrl;
          a.download = pageFileName;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => document.body.removeChild(a), 1000);
          toast.success(`제 ${pIdx + 1}쪽 이미지가 다운로드되었습니다.`);
        }
      } catch (e) {
        console.error('Page image save error:', e);
        toast.error('페이지 이미지 저장 중 오류가 발생했습니다.');
      }
    };
  });
};

/**
 * Normal web file delivery downloader (ONLY called on Web / Desktop browser).
 * Guarded against execution on native mobile WebView to prevent ActivityNotFoundException crashes.
 */
const triggerWebDownload = (blob: Blob, fileName: string) => {
  if (isNativePlatform()) {
    console.warn('triggerWebDownload aborted on native platform to prevent Android WebView crash.');
    return false;
  }
  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    
    setTimeout(() => {
      if (link.parentNode) {
        document.body.removeChild(link);
      }
      URL.revokeObjectURL(url);
    }, 1000);
    return true;
  } catch (err) {
    console.error('Web download failed:', err);
    toast.error('기기 다운로드 중 오류가 발생했습니다.');
    return false;
  }
};
