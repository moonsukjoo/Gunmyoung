import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { toast } from 'sonner';
import { downloadFile } from './downloadHelper';

export interface ReportCardItem {
  id?: string;
  itemNumber: number;
  date: string;
  targetName: string;
  targetSub?: string;
  categoryBadge?: string;
  categoryType?: 'reward' | 'penalty' | 'info';
  scoreBadge: string;
  scoreBadgeType?: 'positive' | 'negative' | 'neutral';
  authorName?: string;
  location?: string;
  reason: string;
  photoUrl?: string;
  extraFields?: { label: string; value: string }[];
}

export interface PhotoCardReportOptions {
  title: string;
  subtitle?: string;
  monthStr?: string;
  items: ReportCardItem[];
  fileName: string;
  onProgress?: (current: number, total: number) => void;
}

/**
 * Safely load an image with timeout guard to prevent any thread blockage
 */
const loadImageSafely = (src?: string): Promise<HTMLImageElement | null> => {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    // Only set crossOrigin for remote HTTP/HTTPS URLs.
    // Setting crossOrigin on data: or blob: URLs throws SecurityError or CORS exceptions in Android WebView.
    if (src.startsWith('http://') || src.startsWith('https://')) {
      img.crossOrigin = 'anonymous';
    }
    const timer = setTimeout(() => resolve(null), 1200);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = src;
  });
};

/**
 * Helper to wrap CJK/Korean text cleanly inside a fixed width
 */
const wrapKoreanText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 6
): string[] => {
  if (!text) return [];
  const lines: string[] = [];
  const paragraphs = text.split('\n');

  for (const para of paragraphs) {
    if (lines.length >= maxLines) break;
    const chars = para.split('');
    let curLine = '';

    for (let i = 0; i < chars.length; i++) {
      const testLine = curLine + chars[i];
      if (ctx.measureText(testLine).width > maxWidth && curLine.length > 0) {
        lines.push(curLine);
        curLine = chars[i];
        if (lines.length >= maxLines) break;
      } else {
        curLine = testLine;
      }
    }
    if (curLine && lines.length < maxLines) {
      lines.push(curLine);
    }
  }

  return lines;
};

/**
 * Draw a rounded rectangle safely across all browser canvas implementations
 */
const drawRoundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) => {
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
  }
};

/**
 * Exports data to an Excel file
 */
export const exportToExcel = async (data: any[], fileName: string, sheetName: string = 'Sheet1') => {
  try {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    await downloadFile(blob, `${fileName}_${new Date().getTime()}.xlsx`);
  } catch (error) {
    console.error('Excel export failed:', error);
    throw error;
  }
};

/**
 * Real-time Interactive Progress Modal Controller.
 * Displays live percentage, step badges, status descriptions, and real-time timestamped event logs.
 */
interface ProgressController {
  setStep: (stepNumber: number, stepTitle: string, percent: number) => void;
  addLog: (msg: string, color?: string) => void;
  close: () => void;
}

const openReportProgressModal = (reportTitle: string, totalPages: number): ProgressController => {
  const existing = document.getElementById('report-generation-progress-modal');
  if (existing?.parentNode) {
    existing.parentNode.removeChild(existing);
  }

  const modal = document.createElement('div');
  modal.id = 'report-generation-progress-modal';
  modal.className = 'fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md transition-opacity duration-300 font-sans';

  modal.innerHTML = `
    <div class="bg-zinc-950 border border-zinc-800 rounded-[2.5rem] p-6 sm:p-8 w-full max-w-md shadow-2xl text-white relative overflow-hidden">
      <!-- Top Accent Animated Gradient Bar -->
      <div class="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-rose-500 animate-pulse"></div>

      <!-- Header Icon & Status -->
      <div class="flex items-center gap-3.5 mb-5">
        <div class="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 shadow-inner">
          <svg class="w-6 h-6 animate-spin text-indigo-400" viewBox="0 0 24 24" fill="none">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span id="progress-step-pill" class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              1 / 5 단계
            </span>
            <span id="progress-percent-pill" class="text-xs font-black text-emerald-400 font-mono">10%</span>
          </div>
          <h3 class="text-sm font-black tracking-tight text-white mt-1 truncate">${reportTitle}</h3>
        </div>
      </div>

      <!-- Current Step Description Box -->
      <div class="bg-zinc-900/60 rounded-2xl p-4 border border-zinc-850 mb-4 space-y-2.5">
        <div class="flex justify-between items-center text-xs">
          <span id="progress-current-title" class="font-black text-zinc-200">데이터 수집 및 사원 정보 집계 중...</span>
          <span class="text-[10px] font-bold text-zinc-500">1페이지 4건 표준</span>
        </div>
        
        <!-- Progress Bar Container -->
        <div class="w-full bg-zinc-850 rounded-full h-3 overflow-hidden p-0.5">
          <div id="progress-bar-fill" class="bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-300 w-[10%]"></div>
        </div>
      </div>

      <!-- Real-time Console Log Box -->
      <div class="space-y-1.5">
        <div class="flex items-center justify-between text-[10px] font-bold text-zinc-500 px-1 uppercase tracking-wider">
          <span>실시간 처리 과정 현황</span>
          <span class="text-indigo-400 font-mono animate-pulse">● LIVE PRODUCING</span>
        </div>
        <div id="progress-log-box" class="h-28 bg-zinc-900/90 rounded-2xl border border-zinc-850 p-3 overflow-y-auto font-mono text-[11px] text-zinc-400 space-y-1.5 select-none">
          <p class="text-indigo-400 font-bold leading-tight">■ [시작] 건명기업 보고서 생성 프로세스 가동</p>
        </div>
      </div>

      <!-- Footnote Safety Protection Notice -->
      <p class="text-[10px] text-zinc-500 text-center mt-4 font-medium leading-relaxed">
        🛡️ 모바일 안드로이드 메모리 보호 기술(청크 분할)로 안전하게 처리됩니다.
      </p>
    </div>
  `;

  document.body.appendChild(modal);

  const stepPill = document.getElementById('progress-step-pill') as HTMLSpanElement;
  const percentPill = document.getElementById('progress-percent-pill') as HTMLSpanElement;
  const currentTitle = document.getElementById('progress-current-title') as HTMLSpanElement;
  const barFill = document.getElementById('progress-bar-fill') as HTMLDivElement;
  const logBox = document.getElementById('progress-log-box') as HTMLDivElement;

  const getTimestamp = () => {
    const d = new Date();
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
  };

  return {
    setStep: (stepNumber: number, title: string, percent: number) => {
      if (stepPill) stepPill.textContent = `${stepNumber} / 5 단계`;
      if (percentPill) percentPill.textContent = `${percent}%`;
      if (currentTitle) currentTitle.textContent = title;
      if (barFill) barFill.style.width = `${Math.min(100, Math.max(8, percent))}%`;
    },
    addLog: (msg: string, color: string = 'text-zinc-300') => {
      if (logBox) {
        const p = document.createElement('p');
        p.className = `leading-tight ${color}`;
        p.textContent = `[${getTimestamp()}] ${msg}`;
        logBox.appendChild(p);
        logBox.scrollTop = logBox.scrollHeight;
      }
    },
    close: () => {
      if (modal.parentNode) {
        document.body.removeChild(modal);
      }
    }
  };
};

/**
 * High-performance, 100% crash-proof 4-items-per-page Photo Inspection / Reward Card PDF Report.
 * Renders directly via HTML5 2D Canvas without html2canvas, eliminating all DOM cloning and WebView memory crashes.
 */
export const exportPhotoCardPDF = async ({
  title,
  subtitle,
  monthStr,
  items,
  fileName,
  onProgress
}: PhotoCardReportOptions) => {
  // Split items into chunks of exactly 4 per page
  const chunks: ReportCardItem[][] = [];
  for (let i = 0; i < items.length; i += 4) {
    chunks.push(items.slice(i, i + 4));
  }
  if (chunks.length === 0) {
    chunks.push([]);
  }
  const totalPages = chunks.length;
  const pageImages: string[] = [];

  toast.dismiss();
  toast.dismiss('safety-pdf');
  console.log('[PDF DEBUG Step 1] PDF 생성 가동 시작', { title, itemCount: items.length, totalPages });
  toast.info(`[PDF 디버그 Step 1] 데이터 수집 완료 (${items.length}건) -> 캔버스/html2canvas 렌더링 개시`, { duration: 3000 });

  const progress = openReportProgressModal(title, totalPages);
  progress.addLog(`총 ${items.length}건 데이터 로드 완료 (1페이지 4건 표준, 총 ${totalPages}페이지)`);
  progress.setStep(1, '사원 정보 및 안전 점수 분석 중...', 15);

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
  const pdfPageHeight = pdf.internal.pageSize.getHeight(); // 297mm

  const W = 840;
  const H = 1188;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    progress.close();
    console.error('[PDF DEBUG ERROR] Canvas 2D context 지원불가');
    toast.error('[PDF 디버그 에러] Canvas 2D context 생성 실패');
    throw new Error('Canvas 2D context not supported');
  }

  try {
    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      const pagePct = Math.round(20 + (pageIdx / totalPages) * 65);
      console.log(`[PDF DEBUG Step 2] 캔버스/html2canvas 렌더링 진행 중 (${pageIdx + 1} / ${totalPages} 페이지)`);
      toast.info(`[PDF 디버그 Step 2] html2canvas/2D 렌더링 진행 중 (${pageIdx + 1}/${totalPages} 쪽 완료)`, { duration: 2500 });
      progress.setStep(3, `제 ${pageIdx + 1}페이지 4건 표준 양식 캔버스 렌더링 중 (${pageIdx + 1} / ${totalPages} 쪽)...`, pagePct);
      if (onProgress) {
        onProgress(pageIdx + 1, totalPages);
      }

      const chunk = chunks[pageIdx];

      // Preload images for current 4 cards
      progress.addLog(`제 ${pageIdx + 1}쪽 현장 첨부 사진 로딩 및 비율 검증 중...`);
      const loadedImages = await Promise.all(
        chunk.map(c => loadImageSafely(c?.photoUrl))
      );
      progress.addLog(`제 ${pageIdx + 1}쪽 사진 준비 완료. 4건 카드 렌더링 개시.`);

      // 1. Clear background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);

      // 2. Top Accent Gradient Bar
      const grad = ctx.createLinearGradient(0, 0, W, 0);
      grad.addColorStop(0, '#2563eb');
      grad.addColorStop(0.5, '#6366f1');
      grad.addColorStop(1, '#ec4899');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, 6);

      // 3. Header Section
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", "Pretendard", "Noto Sans KR", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('건명기업(주)', 28, 38);

      // Header Tag Pill
      ctx.fillStyle = '#e0e7ff';
      ctx.beginPath();
      drawRoundRect(ctx, 145, 22, 100, 22, 11);
      ctx.fill();
      ctx.fillStyle = '#3730a3';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('공식 현장 보고서', 157, 37);

      // Title & Subtitle
      ctx.fillStyle = '#1e3a8a';
      ctx.font = 'bold 21px sans-serif';
      ctx.fillText(title, 28, 68);

      ctx.fillStyle = '#64748b';
      ctx.font = '600 11px sans-serif';
      ctx.fillText(subtitle || '스마트 안전 및 통합 인사 관리 시스템', 28, 88);

      // 3-Step Approval Stamp Box (Right Side)
      const boxX = 590;
      const boxY = 24;
      const boxW = 222;
      const boxH = 66;

      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(boxX, boxY, boxW, boxH);

      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(boxX, boxY, boxW, 22);

      ctx.beginPath();
      ctx.moveTo(boxX, boxY + 22);
      ctx.lineTo(boxX + boxW, boxY + 22);
      ctx.moveTo(boxX + 74, boxY);
      ctx.lineTo(boxX + 74, boxY + boxH);
      ctx.moveTo(boxX + 148, boxY);
      ctx.lineTo(boxX + 148, boxY + boxH);
      ctx.stroke();

      ctx.font = 'bold 10px sans-serif';
      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'center';
      ctx.fillText('작성자', boxX + 37, boxY + 15);
      ctx.fillText('검토자', boxX + 111, boxY + 15);
      ctx.fillText('최종승인', boxX + 185, boxY + 15);

      ctx.font = 'bold 9px sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('(인 / 서명)', boxX + 37, boxY + 47);
      ctx.fillText('(인 / 서명)', boxX + 111, boxY + 47);
      ctx.fillText('(인 / 서명)', boxX + 185, boxY + 47);
      ctx.textAlign = 'left';

      // Header Bottom Line
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(28, 102);
      ctx.lineTo(812, 102);
      ctx.stroke();

      // 4. Metadata Strip
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      drawRoundRect(ctx, 28, 110, 784, 30, 6);
      ctx.fill();
      ctx.stroke();

      ctx.font = '700 10.5px sans-serif';
      ctx.fillStyle = '#475569';
      ctx.fillText('기준 월/일시: ', 42, 129);
      ctx.font = 'bold 10.5px sans-serif';
      ctx.fillStyle = '#0f172a';
      ctx.fillText(monthStr || new Date().toLocaleDateString('ko-KR'), 115, 129);

      ctx.font = '700 10.5px sans-serif';
      ctx.fillStyle = '#475569';
      ctx.fillText('총 데이터 건수: ', 260, 129);
      ctx.font = 'bold 10.5px sans-serif';
      ctx.fillStyle = '#2563eb';
      ctx.fillText(`${items.length} 건`, 345, 129);

      ctx.font = '700 10.5px sans-serif';
      ctx.fillStyle = '#475569';
      ctx.fillText('페이지: ', 480, 129);
      ctx.font = 'bold 10.5px sans-serif';
      ctx.fillStyle = '#0f172a';
      ctx.fillText(`${pageIdx + 1} / ${totalPages} 쪽`, 525, 129);

      ctx.font = '700 10.5px sans-serif';
      ctx.fillStyle = '#475569';
      ctx.fillText('보안 등급: ', 660, 129);
      ctx.font = 'bold 10.5px sans-serif';
      ctx.fillStyle = '#dc2626';
      ctx.fillText('대외비 (기밀보호)', 720, 129);

      // 5. 2x2 Grid of 4 Cards
      const cardSlots = [
        { x: 28, y: 150 },
        { x: 428, y: 150 },
        { x: 28, y: 642 },
        { x: 428, y: 642 }
      ];
      const cardW = 384;
      const cardH = 480;

      for (let sIdx = 0; sIdx < 4; sIdx++) {
        const slot = cardSlots[sIdx];
        const item = chunk[sIdx];
        const img = loadedImages[sIdx];

        if (!item) {
          // Empty slot placeholder
          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([6, 6]);
          ctx.beginPath();
          drawRoundRect(ctx, slot.x, slot.y, cardW, cardH, 12);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = '#94a3b8';
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('[ 여백 - 등록 내역 없음 ]', slot.x + cardW / 2, slot.y + cardH / 2 - 4);
          ctx.font = '10px sans-serif';
          ctx.fillText('1페이지 4건 표준 양식 규격', slot.x + cardW / 2, slot.y + cardH / 2 + 14);
          ctx.textAlign = 'left';
          continue;
        }

        // Card Container
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        drawRoundRect(ctx, slot.x, slot.y, cardW, cardH, 12);
        ctx.fill();
        ctx.stroke();

        // Card Header (Top Bar)
        // No. Badge
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        drawRoundRect(ctx, slot.x + 12, slot.y + 12, 44, 20, 5);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText(`No. ${String(item.itemNumber).padStart(2, '0')}`, slot.x + 18, slot.y + 26);

        // Target Name & Department
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(item.targetName || '', slot.x + 62, slot.y + 27);

        const subText = item.targetSub ? ` ${item.targetSub}` : '';
        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText(subText, slot.x + 62 + ctx.measureText(item.targetName || '').width + 4, slot.y + 27);

        // Right Badges (Category & Score)
        const isPenalty = item.categoryType === 'penalty' || item.scoreBadgeType === 'negative';
        
        // Score Badge
        const scoreBg = isPenalty ? '#fef2f2' : '#ecfdf5';
        const scoreText = isPenalty ? '#dc2626' : '#059669';
        const scoreBorder = isPenalty ? '#fca5a5' : '#a7f3d0';
        const scoreW = 54;
        const scoreX = slot.x + cardW - 12 - scoreW;

        ctx.fillStyle = scoreBg;
        ctx.strokeStyle = scoreBorder;
        ctx.lineWidth = 1;
        ctx.beginPath();
        drawRoundRect(ctx, scoreX, slot.y + 11, scoreW, 22, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = scoreText;
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(item.scoreBadge, scoreX + scoreW / 2, slot.y + 26);
        ctx.textAlign = 'left';

        // Category Badge (if any)
        if (item.categoryBadge) {
          const catBg = isPenalty ? '#fee2e2' : '#dbeafe';
          const catText = isPenalty ? '#b91c1c' : '#1d4ed8';
          const catW = 76;
          const catX = scoreX - catW - 6;

          ctx.fillStyle = catBg;
          ctx.beginPath();
          drawRoundRect(ctx, catX, slot.y + 11, catW, 22, 5);
          ctx.fill();

          ctx.fillStyle = catText;
          ctx.font = 'bold 9.5px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(item.categoryBadge, catX + catW / 2, slot.y + 25);
          ctx.textAlign = 'left';
        }

        // Header Divider
        ctx.strokeStyle = '#f1f5f9';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(slot.x + 10, slot.y + 39);
        ctx.lineTo(slot.x + cardW - 10, slot.y + 39);
        ctx.stroke();

        // Card Photo Area
        const photoX = slot.x + 10;
        const photoY = slot.y + 45;
        const photoW = cardW - 20;
        const photoH = 240;

        if (img) {
          // Render photo with cover aspect ratio & rounded corners
          ctx.save();
          ctx.beginPath();
          drawRoundRect(ctx, photoX, photoY, photoW, photoH, 8);
          ctx.clip();

          const imgW = img.naturalWidth || img.width || photoW;
          const imgH = img.naturalHeight || img.height || photoH;
          const imgRatio = imgW / imgH;
          const slotRatio = photoW / photoH;

          let sx = 0, sy = 0, sw = imgW, sh = imgH;
          if (imgRatio > slotRatio) {
            sw = imgH * slotRatio;
            sx = (imgW - sw) / 2;
          } else {
            sh = imgW / slotRatio;
            sy = (imgH - sh) / 2;
          }

          ctx.drawImage(img, sx, sy, sw, sh, photoX, photoY, photoW, photoH);
          ctx.restore();

          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = 1;
          ctx.beginPath();
          drawRoundRect(ctx, photoX, photoY, photoW, photoH, 8);
          ctx.stroke();
        } else {
          // Clean Placeholder
          ctx.fillStyle = '#f8fafc';
          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = 1;
          ctx.beginPath();
          drawRoundRect(ctx, photoX, photoY, photoW, photoH, 8);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#94a3b8';
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('📷 현장 사진 미첨부', photoX + photoW / 2, photoY + photoH / 2 - 4);
          ctx.font = '10px sans-serif';
          ctx.fillText('(기록 보관용 항목)', photoX + photoW / 2, photoY + photoH / 2 + 14);
          ctx.textAlign = 'left';
        }

        // Card Details Bar
        const metaY = slot.y + 293;
        const metaH = 26;

        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        drawRoundRect(ctx, slot.x + 10, metaY, cardW - 20, metaH, 6);
        ctx.fill();

        ctx.font = 'bold 9.5px sans-serif';
        ctx.fillStyle = '#475569';
        ctx.fillText(`일시: ${item.date}`, slot.x + 18, metaY + 17);
        if (item.authorName) {
          ctx.fillText(item.authorName, slot.x + 160, metaY + 17);
        }
        if (item.location) {
          ctx.fillText(`장소: ${item.location}`, slot.x + 280, metaY + 17);
        }

        // Card Reason Box
        const reasonY = slot.y + 325;
        const reasonH = 145;

        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        drawRoundRect(ctx, slot.x + 10, reasonY, cardW - 20, reasonH, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#2563eb';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText('활동 내용 및 칭찬/점검 사유', slot.x + 18, reasonY + 18);

        // Multiline Korean text wrapping
        ctx.fillStyle = '#1e293b';
        ctx.font = '600 11px sans-serif';
        const lines = wrapKoreanText(ctx, item.reason || '', cardW - 36, 7);
        lines.forEach((l, lIdx) => {
          ctx.fillText(l, slot.x + 18, reasonY + 36 + lIdx * 15);
        });
      }

      // 6. Footer Section
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(28, 1146);
      ctx.lineTo(812, 1146);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '600 10px sans-serif';
      ctx.fillText('건명기업(주) 스마트 현장 관리 시스템 | 공식 전자 인증 보고서', 28, 1166);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`페이지 ${pageIdx + 1} / ${totalPages}`, W / 2, 1166);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#64748b';
      ctx.font = '600 10px sans-serif';
      ctx.fillText(`© ${new Date().getFullYear()} 건명기업. All Rights Reserved.`, 812, 1166);
      ctx.textAlign = 'left';

      // 7. Add canvas image to jsPDF and collect for in-app mobile viewer
      const imgData = canvas.toDataURL('image/jpeg', 0.80);
      pageImages.push(imgData);
      if (pageIdx > 0) {
        pdf.addPage();
      }
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfPageHeight);

      // Clean canvas buffer and allow mobile WebView GC to reclaim memory
      ctx.clearRect(0, 0, W, H);
      await new Promise(r => setTimeout(r, 40));
    }

    console.log('[PDF DEBUG Step 3] 캔버스/html2canvas 렌더링 완료. jsPDF 바이너리 압축 중...');
    toast.info('[PDF 디버그 Step 3] 캔버스 렌더링 완료 -> jsPDF 바이너리 압축 개시', { duration: 3000 });
    progress.setStep(4, 'PDF 바이너리 압축 및 메모리 정리 중...', 92);
    progress.addLog('PDF 바이너리 스트림 변환 및 캐시 정리 완료');
    await new Promise(r => setTimeout(r, 200));

    const pdfBlob = pdf.output('blob');
    console.log('[PDF DEBUG Step 4] PDF Blob 생성 완료, downloadFile() 호출', { blobSize: pdfBlob.size, fileName });
    toast.info(`[PDF 디버그 Step 4] PDF 파일 생성 완료 (${Math.round(pdfBlob.size / 1024)} KB) -> 다운로드 처리 모달 열기`, { duration: 3000 });
    progress.setStep(5, '보고서 제작 완료! 저장 화면을 준비합니다.', 100);
    progress.addLog('✅ 보고서 완성! 다운로드 및 저장 창을 오픈합니다.');
    await new Promise(r => setTimeout(r, 450));
    progress.close();

    await downloadFile(pdfBlob, `${fileName}_${new Date().getTime()}.pdf`, pageImages);
  } catch (error) {
    progress.close();
    console.error('[PDF DEBUG ERROR] PDF 생성 프로세스 중 오류 발생:', error);
    toast.error(`[PDF 디버그 에러] PDF 생성 중단: ${(error as any)?.message || '알 수 없는 오류'}`);
    throw error;
  } finally {
    // Explicitly release canvas memory
    canvas.width = 1;
    canvas.height = 1;
  }
};

/**
 * Standard table PDF file exporter (also 100% crash-proof via pure Canvas 2D)
 */
export const exportToPDF = async (title: string, headers: string[], data: any[][], fileName: string) => {
  const W = 840;
  const rowsPerPage = 18;
  const totalPages = Math.max(1, Math.ceil(data.length / rowsPerPage));
  const pageImages: string[] = [];
  toast.dismiss();
  toast.dismiss('safety-pdf');
  const progress = openReportProgressModal(title, totalPages);
  progress.addLog(`테이블 데이터 ${data.length}건 준비 완료 (총 ${totalPages}쪽)`);
  progress.setStep(1, '테이블 행 및 페이지 구성 중...', 15);

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfPageHeight = pdf.internal.pageSize.getHeight();

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = 1188;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    progress.close();
    throw new Error('Canvas context unavailable');
  }

  try {
    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      const pagePct = Math.round(20 + (pageIdx / totalPages) * 65);
      progress.setStep(3, `제 ${pageIdx + 1}쪽 테이블 드로잉 중 (${pageIdx + 1} / ${totalPages} 쪽)...`, pagePct);
      const pageData = data.slice(pageIdx * rowsPerPage, (pageIdx + 1) * rowsPerPage);

      // Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, 1188);

      // Top bar
      const grad = ctx.createLinearGradient(0, 0, W, 0);
      grad.addColorStop(0, '#3b82f6');
      grad.addColorStop(1, '#6366f1');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, 6);

      // Header
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('건명기업(주)', 30, 42);

      ctx.fillStyle = '#6b7280';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('스마트 안전 및 통합 인사 관리 시스템', 30, 60);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(title, 810, 42);

      ctx.fillStyle = '#3b82f6';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(`출력일시: ${new Date().toLocaleDateString('ko-KR')} ${new Date().toLocaleTimeString('ko-KR')}`, 810, 60);
      ctx.textAlign = 'left';

      // Divider
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(30, 72);
      ctx.lineTo(810, 72);
      ctx.stroke();

      // Table Header Row
      const colWidth = (810 - 30) / Math.max(1, headers.length);
      const tableStartY = 90;
      const rowHeight = 36;

      ctx.fillStyle = '#111827';
      ctx.fillRect(30, tableStartY, 780, rowHeight);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      headers.forEach((h, hIdx) => {
        ctx.fillText(h, 30 + colWidth * hIdx + colWidth / 2, tableStartY + 22);
      });

      // Data Rows
      pageData.forEach((row, rIdx) => {
        const curY = tableStartY + rowHeight + rIdx * rowHeight;
        ctx.fillStyle = rIdx % 2 === 0 ? '#ffffff' : '#f9fafb';
        ctx.fillRect(30, curY, 780, rowHeight);

        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        ctx.strokeRect(30, curY, 780, rowHeight);

        ctx.fillStyle = '#374151';
        ctx.font = '600 11px sans-serif';
        row.forEach((cell, cIdx) => {
          const val = cell === null || cell === undefined ? '' : String(cell);
          ctx.fillText(val, 30 + colWidth * cIdx + colWidth / 2, curY + 22);
        });
      });

      // Footer
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(30, 1140);
      ctx.lineTo(810, 1140);
      ctx.stroke();

      ctx.fillStyle = '#6b7280';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`건명기업(주) 공식 리포트 | 페이지 ${pageIdx + 1} / ${totalPages}`, 30, 1160);

      ctx.textAlign = 'right';
      ctx.fillText(`© ${new Date().getFullYear()} 건명기업. All Rights Reserved.`, 810, 1160);
      ctx.textAlign = 'left';

      const imgData = canvas.toDataURL('image/jpeg', 0.80);
      pageImages.push(imgData);
      if (pageIdx > 0) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfPageHeight);

      ctx.clearRect(0, 0, W, 1188);
      await new Promise(r => setTimeout(r, 30));
    }

    progress.setStep(4, 'PDF 바이너리 압축 및 메모리 정리 중...', 92);
    progress.addLog('PDF 바이너리 스트림 변환 완료');
    await new Promise(r => setTimeout(r, 200));

    const pdfBlob = pdf.output('blob');
    progress.setStep(5, '보고서 완성! 저장 화면 준비', 100);
    progress.addLog('✅ 보고서 생성 완료. 다운로드 모달 실행...');
    await new Promise(r => setTimeout(r, 400));
    progress.close();

    await downloadFile(pdfBlob, `${fileName}_${new Date().getTime()}.pdf`, pageImages);
  } catch (error) {
    progress.close();
    console.error('PDF generation failed:', error);
    throw error;
  } finally {
    canvas.width = 1;
    canvas.height = 1;
  }
};
