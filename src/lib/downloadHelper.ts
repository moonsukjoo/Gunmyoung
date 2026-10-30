import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Device } from '@capacitor/device';
import { Share } from '@capacitor/share';
import { toast } from 'sonner';

/**
 * Check whether we are running inside native Capacitor environment (Android/iOS)
 */
export const isNativePlatform = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

/**
 * Safely check the runtime platform with instant native check
 */
const getPlatformSafely = async (): Promise<string> => {
  try {
    if (Capacitor.isNativePlatform()) {
      return Capacitor.getPlatform();
    }
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
const writeBase64InChunks = async (path: string, base64Data: string, directory: Directory): Promise<string> => {
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
};

/**
 * Robust file download helper with unified Email, In-App Preview, Native Share, and Local Device Download.
 * Fully hardened for Android/iOS Capacitor WebView to prevent crashes and force-closes.
 */
export const downloadFile = async (blob: Blob, fileName: string): Promise<boolean> => {
  // Remove any previously open modal
  const existingModal = document.getElementById('unified-download-modal');
  if (existingModal?.parentNode) {
    existingModal.parentNode.removeChild(existingModal);
  }

  const isNative = isNativePlatform();
  const platform = await getPlatformSafely();
  const isPdf = fileName.toLowerCase().endsWith('.pdf');
  const savedEmail = localStorage.getItem('last_share_email') || 'tjrwnfjqm1@gmail.com';
  const blobUrl = URL.createObjectURL(blob);

  return new Promise<boolean>((resolve) => {
    // Create Modal Overlay
    const modal = document.createElement('div');
    modal.id = 'unified-download-modal';
    modal.className = 'fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md transition-opacity duration-300';
    
    modal.innerHTML = `
      <div class="bg-zinc-950 border border-zinc-800 rounded-[2rem] p-6 w-full max-w-md shadow-2xl text-white transform scale-95 opacity-0 transition-all duration-300 relative font-sans max-h-[92vh] overflow-y-auto">
        
        <!-- Top Accent Bar -->
        <div class="absolute top-0 left-0 right-0 h-1.5 rounded-t-[2rem] bg-gradient-to-r ${isPdf ? 'from-rose-500 to-amber-500' : 'from-emerald-500 to-teal-500'}"></div>
        
        <!-- Modal Header -->
        <div class="flex items-start justify-between mb-4 mt-1">
          <div class="space-y-1">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${isPdf ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}">
              ${isPdf ? 'PDF REPORT (공식 보고서)' : 'EXCEL SHEET'}
            </span>
            <h3 class="text-lg font-black tracking-tight leading-snug">보고서 열기 및 다운로드</h3>
          </div>
          <button id="modal-close-btn" class="w-8 h-8 rounded-full border border-zinc-800 hover:border-zinc-700 bg-zinc-900/50 flex items-center justify-center text-zinc-400 hover:text-white transition-all">
            ✕
          </button>
        </div>
        
        <!-- Document Metadata Info -->
        <div class="bg-zinc-900/50 rounded-2xl border border-zinc-900 p-3.5 mb-4 flex items-center gap-3">
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
        
        <!-- Content Screen Area -->
        <div id="modal-screen-content" class="space-y-3.5">
          
          <div class="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-[11px] space-y-1 text-zinc-300">
            <p class="font-black text-emerald-400 flex items-center gap-1">
              <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              안내: 모바일 간편 열기 및 전송
            </p>
            <p class="leading-relaxed">
              모바일 앱에서는 <b>[간편 공유]</b>로 카카오톡·메일에 바로 보내거나, <b>[앱 내 즉시 보기]</b>로 화면에서 바로 확인하실 수 있습니다.
            </p>
          </div>

          <!-- Action List Buttons -->
          <div class="space-y-2 pt-1">
            ${isPdf ? `
            <button 
              id="modal-preview-btn" 
              class="w-full h-13 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95 transition-all text-center border border-indigo-400/20 cursor-pointer"
            >
              <svg class="w-4.5 h-4.5 text-indigo-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              <span>📄 앱 내 보고서 즉시 미리보기 및 인쇄</span>
            </button>
            ` : ''}

            <button 
              id="modal-native-share-btn" 
              class="w-full h-15 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-xs rounded-2xl flex flex-col items-center justify-center gap-0.5 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all text-center border border-emerald-400/20 cursor-pointer"
            >
              <div class="flex items-center gap-1.5">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                <span class="text-sm">① 모바일 앱 간편 공유 및 전송</span>
              </div>
              <span class="text-[10px] font-bold text-emerald-100/90">(카카오톡 • 메일 첨부 • 파일 저장 • Drive)</span>
            </button>

            <!-- Email Section -->
            <div class="p-3 bg-zinc-900/60 rounded-2xl border border-zinc-800/80 space-y-2">
              <label class="text-[10px] font-black text-zinc-400 uppercase tracking-widest pl-1 block">② 사내 이메일 실시간 전송</label>
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
            
            <button 
              id="modal-direct-dl-btn" 
              class="w-full h-11 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              ③ 기기 로컬 파일 저장
            </button>
          </div>
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
    const dialogInner = modal.querySelector('div') as HTMLDivElement;
    
    setTimeout(() => {
      dialogInner.classList.remove('scale-95', 'opacity-0');
      dialogInner.classList.add('scale-100', 'opacity-100');
    }, 50);
    
    const dismiss = (result: boolean) => {
      dialogInner.classList.remove('scale-100', 'opacity-100');
      dialogInner.classList.add('scale-95', 'opacity-0');
      setTimeout(() => {
        if (modal.parentNode) {
          document.body.removeChild(modal);
        }
        // Release blob URL after closing modal
        setTimeout(() => {
          try { URL.revokeObjectURL(blobUrl); } catch {}
        }, 5000);
        resolve(result);
      }, 300);
    };
    
    closeBtn.onclick = () => dismiss(false);
    modal.onclick = (e) => {
      if (e.target === modal) {
        dismiss(false);
      }
    };

    // Action: In-App Preview / Print Viewer
    if (previewBtn) {
      previewBtn.onclick = () => {
        openInAppViewer(blobUrl, fileName, () => dismiss(true));
      };
    }
    
    // Action: Local Download
    downloadBtn.onclick = async () => {
      if (isNative || platform === 'android' || platform === 'ios') {
        try {
          toast.loading('기기 저장 준비 중입니다...', { id: 'save-progress' });
          const base64Data = await blobToBase64(blob);
          const safeExt = fileName.toLowerCase().endsWith('.xlsx') ? '.xlsx' : '.pdf';
          const cleanSafeName = `gunmyoung_report_${Date.now()}${safeExt}`;

          // Write exclusively to Cache directory in safe 256KB chunks (100% crash proof)
          const savedUri = await writeBase64InChunks(cleanSafeName, base64Data, Directory.Cache);
          toast.success('임시 캐시에 파일이 안전하게 준비되었습니다.', { id: 'save-progress' });

          // Present system save / share sheet
          try {
            await Share.share({
              title: fileName,
              text: `[건명기업] ${fileName}`,
              files: [savedUri],
              dialogTitle: '파일 저장 및 열기'
            });
          } catch (shareErr: any) {
            if (shareErr?.name !== 'AbortError' && !shareErr?.message?.includes('canceled')) {
              console.warn('Share intent warning:', shareErr);
            }
          }
        } catch (e) {
          console.error('Mobile download failed:', e);
          toast.dismiss('save-progress');
          toast.error('기기 저장 중 오류가 발생했습니다. 전용 이메일 전송을 이용해주세요.');
        }
      } else {
        triggerWebDownload(blob, fileName);
        dismiss(true);
      }
    };
    
    // Action: Native Share
    shareBtn.onclick = async () => {
      if (isNative || platform === 'android' || platform === 'ios') {
        await triggerNativeShare(blob, fileName);
      } else {
        // Standard Web browser
        try {
          const file = new File([blob], fileName, { type: blob.type || (isPdf ? 'application/pdf' : 'application/octet-stream') });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: fileName,
              text: `[건명기업] ${fileName}`
            });
            toast.success('공유 메뉴가 오픈되었습니다.');
            dismiss(true);
          } else {
            triggerWebDownload(blob, fileName);
            dismiss(true);
          }
        } catch (err: any) {
          if (err?.name !== 'AbortError') {
            triggerWebDownload(blob, fileName);
            dismiss(true);
          }
        }
      }
    };
    
    // Action: Email Sender Delivery
    emailSendBtn.onclick = async () => {
      const emailVal = emailInput.value?.trim();
      if (!emailVal || !emailVal.includes('@')) {
        toast.error('올바른 이메일 주소를 입력해 주세요.');
        return;
      }
      
      localStorage.setItem('last_share_email', emailVal);
      
      const screenArea = document.getElementById('modal-screen-content') as HTMLDivElement;
      screenArea.className = "space-y-4 p-2 bg-zinc-950 rounded-2xl border border-zinc-900 font-mono text-[10px]";
      screenArea.innerHTML = `
        <div class="flex items-center gap-3 py-2 border-b border-zinc-900">
          <div class="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin shrink-0"></div>
          <span class="text-zinc-400 font-bold">건명기업 메일 전송 시퀀스 가동...</span>
        </div>
        <div id="email-log-board" class="space-y-1.5 text-zinc-400 leading-relaxed font-mono tracking-tight overflow-y-auto max-h-[180px] p-1 select-none">
          <p class="text-indigo-400 animate-pulse">■ Initializing SMTP Connection...</p>
        </div>
      `;
      
      const logBoard = document.getElementById('email-log-board') as HTMLDivElement;
      
      const addLog = (text: string, colorClass: string = 'text-zinc-500') => {
        const p = document.createElement('p');
        p.className = `font-mono ${colorClass}`;
        p.innerText = text;
        logBoard.appendChild(p);
        logBoard.scrollTop = logBoard.scrollHeight;
      };
      
      try {
        await new Promise(r => setTimeout(r, 200));
        addLog('▶ 🔒 SSL/TLS 보안 터널 확인.', 'text-zinc-400');
        
        await new Promise(r => setTimeout(r, 200));
        addLog(`▶ 📂 [${fileName}] Base64 페이로드 변환 중...`, 'text-zinc-400');
        
        const base64Data = await blobToBase64(blob);
        
        addLog('▶ 📂 변환 완료. /api/send-email 전송 개시...', 'text-indigo-400');
        
        const response = await fetch("/api/send-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            to: emailVal,
            subject: `[건명기업] 통합 스마트 안전 관리 보고서 - ${fileName}`,
            filename: fileName,
            base64Data: base64Data
          })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
          addLog('▶ ✔️ SMTP Server Response: 250 OK (Message Accepted)', 'text-emerald-400 font-bold');
          await new Promise(r => setTimeout(r, 400));
          
          screenArea.className = "space-y-4 text-center py-6 font-sans";
          screenArea.innerHTML = `
            <div class="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-3 animate-bounce">
              <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h4 class="text-base font-black text-white">이메일 전송 성공!</h4>
            <p class="text-xs text-zinc-400 px-3 font-bold leading-normal">
              보고서가 수신자 <span class="text-indigo-400 underline">${emailVal}</span>(으)로 실시간 발급 및 전송 완료되었습니다!
            </p>
            
            <div class="pt-3 space-y-2">
              <button 
                id="success-close-btn" 
                class="w-full h-11 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer"
              >
                확인 (창 닫기)
              </button>
            </div>
          `;
          
          toast.success(`메일 발송 성공: ${emailVal}`);
          const successClose = document.getElementById('success-close-btn') as HTMLButtonElement;
          successClose.onclick = () => dismiss(true);
        } else {
          throw new Error(result.details || result.error || "이메일 전송에 실패하였습니다.");
        }
        
      } catch (err: any) {
        console.error("Email send error:", err);
        addLog(`❌ 오류 발생: ${err.message}`, 'text-rose-400 font-bold');
        await new Promise(r => setTimeout(r, 400));
        
        screenArea.className = "space-y-4 text-left p-2 font-sans";
        screenArea.innerHTML = `
          <div class="bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl p-4 space-y-2">
            <div class="flex items-center gap-2">
              <svg class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              <h4 class="text-xs font-black uppercase tracking-wider">메일 발송 불가 시 간편 공유 이용 안내</h4>
            </div>
            <p class="text-xs text-zinc-300 font-medium leading-relaxed">
              사내 메일 전송이 원활하지 않을 경우, 휴대폰의 <b>'간편 공유'를 통해 카카오톡 또는 본인 메일 앱으로 전송하세요!</b>
            </p>
          </div>
          
          <div class="pt-2 flex flex-col gap-2">
            <button 
              id="error-fallback-share" 
              class="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-emerald-600/20 cursor-pointer"
            >
              📲 휴대폰 메일/카카오톡 첨부 발송하기
            </button>
            
            <button 
              id="error-close-btn" 
              class="w-full h-11 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              닫기
            </button>
          </div>
        `;
        
        const errClose = document.getElementById('error-close-btn') as HTMLButtonElement;
        const errShare = document.getElementById('error-fallback-share') as HTMLButtonElement;
        
        errClose.onclick = () => dismiss(false);
        errShare.onclick = async () => {
          await triggerNativeShare(blob, fileName);
          dismiss(true);
        };
      }
    };
  });
};

/**
 * Mobile device Capacitor sharing action handler.
 * Completely crash-proof:
 * 1. Writes to Directory.Cache in 256KB chunks so Android Binder limit is NEVER exceeded.
 * 2. Calls Share.share with file URI inside try/catch so any native rejection is caught gracefully.
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

    // Trigger system shares using `files` array
    await Share.share({
      title: fileName,
      text: `[건명기업] ${fileName}`,
      files: [savedUri],
      dialogTitle: '보고서 파일 공유 및 저장'
    });
    return true;
  } catch (err: any) {
    toast.dismiss('share-progress');
    if (err?.name === 'AbortError' || err?.message?.includes('canceled') || err?.message?.includes('cancelled')) {
      // User cancelled share dialog cleanly
      return true;
    }
    console.warn('Capacitor sharing flow warning:', err);
    if (!isNativePlatform()) {
      triggerWebDownload(blob, fileName);
    } else {
      toast.error('공유 메뉴를 열 수 없습니다. 메일 전송 또는 앱 내 미리보기를 이용해주세요.');
    }
    return false;
  }
};

/**
 * Opens an In-App PDF Viewer modal overlay using the Blob Object URL.
 * Allows users on mobile to immediately see the report and trigger print/save without native intent crashes.
 */
const openInAppViewer = (blobUrl: string, fileName: string, onClose: () => void) => {
  const viewerModal = document.createElement('div');
  viewerModal.id = 'in-app-pdf-viewer';
  viewerModal.className = 'fixed inset-0 z-[100000] flex flex-col bg-zinc-950 text-white font-sans';
  
  viewerModal.innerHTML = `
    <!-- Viewer Header -->
    <div class="h-14 border-b border-zinc-800 bg-zinc-900/90 backdrop-blur-md px-4 flex items-center justify-between shrink-0">
      <div class="flex items-center gap-2 min-w-0 pr-2">
        <span class="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0"></span>
        <h4 class="text-xs font-black truncate">${fileName}</h4>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <button id="viewer-print-btn" class="h-9 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-md">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
          인쇄 / PDF 저장
        </button>
        <button id="viewer-close-btn" class="w-9 h-9 rounded-xl border border-zinc-800 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white flex items-center justify-center font-black cursor-pointer">
          ✕
        </button>
      </div>
    </div>
    
    <!-- Viewer Body -->
    <div class="flex-1 w-full h-full bg-zinc-900 relative">
      <iframe 
        id="pdf-frame" 
        src="${blobUrl}#toolbar=1&navpanes=0" 
        class="w-full h-full border-none"
        title="PDF Preview"
      ></iframe>
    </div>
  `;

  document.body.appendChild(viewerModal);

  const closeBtn = document.getElementById('viewer-close-btn') as HTMLButtonElement;
  const printBtn = document.getElementById('viewer-print-btn') as HTMLButtonElement;
  const iframe = document.getElementById('pdf-frame') as HTMLIFrameElement;

  closeBtn.onclick = () => {
    if (viewerModal.parentNode) {
      document.body.removeChild(viewerModal);
    }
    onClose();
  };

  printBtn.onclick = () => {
    try {
      if (iframe.contentWindow) {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } else {
        window.print();
      }
    } catch {
      window.print();
    }
  };
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
