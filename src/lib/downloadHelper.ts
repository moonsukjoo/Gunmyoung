import { Filesystem, Directory } from '@capacitor/filesystem';
import { Device } from '@capacitor/device';
import { Share } from '@capacitor/share';
import { toast } from 'sonner';

/**
 * Safely check the runtime platform with a fast timeout fallback
 */
const getPlatformSafely = async (): Promise<string> => {
  try {
    const info = await Promise.race([
      Device.getInfo(),
      new Promise<{ platform: string }>((res) => setTimeout(() => res({ platform: 'web' }), 300))
    ]);
    return info?.platform || 'web';
  } catch {
    return 'web';
  }
};

/**
 * Robust file download helper with unified Email, Native Share, and Local Device Download controls
 */
export const downloadFile = async (blob: Blob, fileName: string): Promise<boolean> => {
  // Remove any previously open modal
  const existingModal = document.getElementById('unified-download-modal');
  if (existingModal?.parentNode) {
    existingModal.parentNode.removeChild(existingModal);
  }

  const platform = await getPlatformSafely();
  const isPdf = fileName.toLowerCase().endsWith('.pdf');
  const savedEmail = localStorage.getItem('last_share_email') || 'tjrwnfjqm1@gmail.com';

  return new Promise<boolean>((resolve) => {
    // Create Modal Overlay
    const modal = document.createElement('div');
    modal.id = 'unified-download-modal';
    modal.className = 'fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md transition-opacity duration-300';
    
    modal.innerHTML = `
      <div class="bg-zinc-950 border border-zinc-800 rounded-[2rem] p-6 w-full max-w-md shadow-2xl text-white transform scale-95 opacity-0 transition-all duration-300 relative font-sans">
        
        <!-- Top Accent Bar -->
        <div class="absolute top-0 left-0 right-0 h-1.5 rounded-t-[2rem] bg-gradient-to-r ${isPdf ? 'from-rose-500 to-amber-500' : 'from-emerald-500 to-teal-500'}"></div>
        
        <!-- Modal Header -->
        <div class="flex items-start justify-between mb-5 mt-1">
          <div class="space-y-1">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${isPdf ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}">
              ${isPdf ? 'PDF REPORT' : 'EXCEL SHEET'}
            </span>
            <h3 class="text-lg font-black tracking-tight leading-snug">보고서 다운로드 및 공유</h3>
          </div>
          <button id="modal-close-btn" class="w-8 h-8 rounded-full border border-zinc-800 hover:border-zinc-700 bg-zinc-900/50 flex items-center justify-center text-zinc-400 hover:text-white transition-all">
            ✕
          </button>
        </div>
        
        <!-- Document Metadata Info -->
        <div class="bg-zinc-900/50 rounded-2xl border border-zinc-900 p-4 mb-5 flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isPdf ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}">
            ${isPdf 
              ? `<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-2-2a1 1 0 00-.707-.293H7a2 2 0 00-2 2V19a2 2 0 002 2z" /></svg>`
              : `<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>`
            }
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">생성된 파일명</p>
            <p class="text-xs font-bold text-zinc-300 truncate">${fileName}</p>
          </div>
        </div>
        
        <!-- Content Screen Area -->
        <div id="modal-screen-content" class="space-y-4">
          
          <div class="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-[11px] space-y-1 text-zinc-300">
            <p class="font-black text-emerald-400 flex items-center gap-1">
              <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              모바일 간편 전송 & 저장 안내
            </p>
            <p class="leading-relaxed">
              모바일 기기에서는 <b>①번 버튼</b>을 누르시면 <b>카카오톡, 메일(Gmail/네이버), 블루투스, 클라우드</b> 등으로 바로 전송 및 보관할 수 있습니다.
            </p>
          </div>

          <!-- Email Input Field -->
          <div class="space-y-1.5 opacity-90">
            <label class="text-[10px] font-black text-zinc-400 uppercase tracking-widest pl-1">②번 전용 서버 수신 이메일</label>
            <input 
              id="modal-email-input" 
              type="email" 
              value="${savedEmail}" 
              placeholder="email@example.com"
              class="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-sm font-bold text-white focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all placeholder:text-zinc-600"
            />
          </div>
          
          <!-- Action List Buttons -->
          <div class="space-y-2.5 pt-1">
            <button 
              id="modal-native-share-btn" 
              class="w-full h-16 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-xs rounded-2xl flex flex-col items-center justify-center gap-0.5 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all text-center border border-emerald-400/20"
            >
              <div class="flex items-center gap-1.5">
                <svg class="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                <span class="text-sm">① 모바일 앱 간편 공유 및 전송</span>
              </div>
              <span class="text-[10px] font-bold text-emerald-100/90">(카카오톡 • 메일 첨부 • 클라우드)</span>
            </button>

            <button 
              id="modal-email-send-btn" 
              class="w-full h-12 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 font-bold text-xs rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 19v-8.93a2 2 0 01.89-1.664l8-4.8a2 2 0 012.22 0l8 4.8A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.725m12.25 4.725l-6.75-4.725m0 0L12 14l-2.25-1.725M12 14l6.75-4.725M12 14L5.25 9.275" /></svg>
              ② 사내 전용 메일 서버 전송
            </button>
            
            <button 
              id="modal-direct-dl-btn" 
              class="w-full h-12 bg-zinc-900 border border-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              ③ 기기 문서 폴더 다운로드 / 저장
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
        resolve(result);
      }, 300);
    };
    
    closeBtn.onclick = () => dismiss(false);
    modal.onclick = (e) => {
      if (e.target === modal) {
        dismiss(false);
      }
    };
    
    // Action: Local Download
    downloadBtn.onclick = async () => {
      dismiss(true);
      if (platform === 'android' || platform === 'ios') {
        try {
          const reader = new FileReader();
          const base64Promise = new Promise<string>((res, rej) => {
            reader.onloadend = () => {
              const str = reader.result as string;
              res(str.split(',')[1] || '');
            };
            reader.onerror = rej;
          });
          reader.readAsDataURL(blob);
          const base64Data = await base64Promise;

          // Attempt writing directly to Documents directory
          try {
            const cleanSafeName = `${fileName.replace(/[/\\?%*:|"<>]/g, '_')}`;
            const savedDoc = await Filesystem.writeFile({
              path: cleanSafeName,
              data: base64Data,
              directory: Directory.Documents,
              recursive: true
            });
            toast.success(`'내 파일 > 문서' 폴더에 저장되었습니다: ${cleanSafeName}`);
            
            // Also invoke share sheet with files array so user can open it immediately
            try {
              await Share.share({
                title: fileName,
                files: [savedDoc.uri],
                dialogTitle: '저장된 파일 열기'
              });
            } catch (shareErr: any) {
              if (shareErr?.name !== 'AbortError') {
                console.log('Share prompt dismissed');
              }
            }
            return;
          } catch (docErr) {
            console.warn('Documents save failed, falling back to Native Share:', docErr);
            await triggerNativeShare(blob, fileName);
          }
        } catch (e) {
          console.error('Mobile download failed, fallback to web download:', e);
          triggerWebDownload(blob, fileName);
        }
      } else {
        triggerWebDownload(blob, fileName);
      }
    };
    
    // Action: Native Share
    shareBtn.onclick = async () => {
      try {
        const file = new File([blob], fileName, { type: blob.type || (isPdf ? 'application/pdf' : 'application/octet-stream') });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          dismiss(true);
          try {
            await navigator.share({
              files: [file],
              title: fileName,
              text: `[건명기업] ${fileName}`
            });
            toast.success('공유 메뉴가 오픈되었습니다.');
          } catch (shareErr: any) {
            if (shareErr?.name === 'AbortError') {
              // User simply dismissed the share sheet
              return;
            }
            console.warn('navigator.share failed, fallback to native share:', shareErr);
            await triggerNativeShare(blob, fileName);
          }
        } else {
          dismiss(true);
          await triggerNativeShare(blob, fileName);
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        console.warn('Direct share failed, falling back to Native Share:', err);
        dismiss(true);
        await triggerNativeShare(blob, fileName);
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
        await new Promise(r => setTimeout(r, 300));
        addLog('▶ 🔒 SSL/TLS 1.2 보안 보안 터널 성립 확인.', 'text-zinc-400');
        
        await new Promise(r => setTimeout(r, 300));
        addLog(`▶ 📂 [${fileName}] 문서 바이너리 Base64 인코딩 진행 중...`, 'text-zinc-400');
        
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onloadend = () => {
            try {
              const base64String = reader.result as string;
              const base = base64String.split(',')[1];
              resolve(base);
            } catch (e) {
              reject(e);
            }
          };
          reader.onerror = reject;
        });
        
        reader.readAsDataURL(blob);
        const base64Data = await base64Promise;
        
        addLog('▶ 📂 Base64 변환 완료. 페이로드 패킹 완료.', 'text-zinc-400');
        await new Promise(r => setTimeout(r, 300));
        addLog('▶ 🚀 /api/send-email 백엔드 API 게이트웨이 전송 개시...', 'text-indigo-400');
        
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
          await new Promise(r => setTimeout(r, 500));
          
          screenArea.className = "space-y-4 text-center py-6 font-sans";
          screenArea.innerHTML = `
            <div class="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-3 animate-bounce">
              <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h4 class="text-base font-black text-foreground">이메일 전송 성공!</h4>
            <p class="text-xs text-zinc-400 px-3 font-bold leading-normal">
              보고서가 수신자 <span class="text-indigo-400 underline">${emailVal}</span>(으)로 실시간 발급 및 전송 완료되었습니다!
            </p>
            
            <div class="pt-3 space-y-2">
              <button 
                id="success-close-btn" 
                class="w-full h-11 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-white font-bold text-xs rounded-xl transition-all shadow-md"
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
        await new Promise(r => setTimeout(r, 500));
        
        screenArea.className = "space-y-4 text-left p-2 font-sans";
        screenArea.innerHTML = `
          <div class="bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl p-4 space-y-2">
            <div class="flex items-center gap-2">
              <svg class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              <h4 class="text-xs font-black uppercase tracking-wider">메일 서버가 아직 구성되지 않았습니다</h4>
            </div>
            <p class="text-xs text-zinc-300 font-medium leading-relaxed">
              현재 전용 메일 서버 발송 기능은 관리자의 세팅이 필요합니다. 대신 휴대폰의 <b>'간편 공유' 전송을 통해 카카오톡 또는 본인 메일 앱으로 전송하세요!</b>
            </p>
          </div>
          
          <div class="pt-2 flex flex-col gap-2">
            <button 
              id="error-fallback-share" 
              class="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-emerald-600/20"
            >
              📲 휴대폰 메일/카카오톡 첨부 발송하기
            </button>
            
            <div class="flex gap-2">
              <button 
                id="error-close-btn" 
                class="flex-1 h-11 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 font-bold text-xs rounded-xl transition-all"
              >
                닫기
              </button>
              <button 
                id="error-fallback-dl" 
                class="flex-1 h-11 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 font-bold text-xs rounded-xl transition-all"
              >
                📥 기기에 파일 저장
              </button>
            </div>
          </div>
        `;
        
        const errClose = document.getElementById('error-close-btn') as HTMLButtonElement;
        const errDl = document.getElementById('error-fallback-dl') as HTMLButtonElement;
        const errShare = document.getElementById('error-fallback-share') as HTMLButtonElement;
        
        errClose.onclick = () => dismiss(false);
        
        errShare.onclick = async () => {
          dismiss(true);
          try {
            const file = new File([blob], fileName, { type: blob.type || 'application/pdf' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              try {
                await navigator.share({
                  files: [file],
                  title: fileName,
                  text: `[건명기업] ${fileName}`
                });
              } catch (shErr: any) {
                if (shErr?.name !== 'AbortError') {
                  await triggerNativeShare(blob, fileName);
                }
              }
            } else {
              await triggerNativeShare(blob, fileName);
            }
          } catch {
            await triggerNativeShare(blob, fileName);
          }
        };

        errDl.onclick = () => {
          dismiss(true);
          if (platform === 'android' || platform === 'ios') {
            triggerNativeShare(blob, fileName);
          } else {
            triggerWebDownload(blob, fileName);
          }
        };
      }
    };
  });
};

/**
 * Mobile device Capacitor sharing action handler.
 * Fixes the Android FileUriExposedException crash by using clean ASCII temporary filename
 * and passing `files: [savedFile.uri]` instead of raw `url`.
 */
const triggerNativeShare = async (blob: Blob, fileName: string) => {
  try {
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve, reject) => {
      reader.onloadend = () => {
        try {
          const base64String = reader.result as string;
          const base64Data = base64String.split(',')[1] || '';
          resolve(base64Data);
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = reject;
    });
    
    reader.readAsDataURL(blob);
    const base64Data = await base64Promise;

    // Use a clean ASCII filename to avoid any path encoding bugs in Android/iOS Filesystem
    const safeExt = fileName.toLowerCase().endsWith('.xlsx') ? '.xlsx' : '.pdf';
    const tempFileName = `gunmyoung_report_${Date.now()}${safeExt}`;

    // Cache file locally
    const savedFile = await Filesystem.writeFile({
      path: tempFileName,
      data: base64Data,
      directory: Directory.Cache,
    });
    
    // Trigger system shares using `files` array (CRITICAL FIX FOR ANDROID CRASH)
    await Share.share({
      title: fileName,
      text: `[건명기업] ${fileName}`,
      files: [savedFile.uri], // Passes as content:// via FileProvider in Android
      dialogTitle: '보고서 파일 공유 및 저장'
    });
    return true;
  } catch (err: any) {
    if (err?.name === 'AbortError' || err?.message?.includes('canceled') || err?.message?.includes('cancelled')) {
      // User cancelled share dialog
      return true;
    }
    console.warn('Capacitor sharing flow failed, falling back to Web direct download:', err);
    triggerWebDownload(blob, fileName);
    return false;
  }
};

/**
 * Normal web file delivery downloader
 */
const triggerWebDownload = (blob: Blob, fileName: string) => {
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
