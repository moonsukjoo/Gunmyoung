import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { downloadFile } from './downloadHelper';

/**
 * Exports data to an Excel file
 * @param data Array of objects to export
 * @param fileName Name of the file (without extension)
 * @param sheetName Name of the sheet
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
 * Exports data to a standard table PDF file with memory optimization for mobile devices
 * @param title Title of the PDF
 * @param headers Table headers
 * @param data Table data rows
 * @param fileName Name of the file (without extension)
 */
export const exportToPDF = async (title: string, headers: string[], data: any[][], fileName: string) => {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.opacity = '1';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '-9999';
  container.style.width = '840px'; 
  container.style.padding = '0';
  container.style.margin = '0';
  container.style.backgroundColor = '#ffffff';
  
  container.innerHTML = `
    <style>
      * { 
        box-sizing: border-box; 
        font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", "Pretendard", "Noto Sans KR", sans-serif !important; 
      }
    </style>
    <div style="padding: 30px; background: white; min-height: 840px; position: relative; width: 840px;">
      <!-- Accent Top Bar -->
      <div style="position: absolute; top: 0; left: 0; width: 100%; height: 6px; background: linear-gradient(90deg, #3b82f6, #6366f1);"></div>
      
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111827; padding-bottom: 18px; margin-bottom: 20px;">
        <div>
          <h2 style="font-size: 22px; font-weight: 900; color: #111827; margin: 0; letter-spacing: -0.01em;">건명기업(주)</h2>
          <p style="font-size: 11px; color: #6b7280; font-weight: 600; margin: 3px 0 0 0;">스마트 안전 및 통합 인사 관리 시스템</p>
        </div>
        <div style="text-align: right;">
          <h1 style="font-size: 20px; font-weight: 900; color: #111827; margin: 0; letter-spacing: -0.02em;">${title}</h1>
          <p style="font-size: 10px; color: #3b82f6; font-weight: 700; margin: 3px 0 0 0;">출력일시: ${new Date().toLocaleDateString('ko-KR')} ${new Date().toLocaleTimeString('ko-KR')}</p>
        </div>
      </div>

      <!-- Info Grid -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px;">
        <div style="background: #f9fafb; padding: 10px 14px; border-radius: 10px; border: 1px solid #e5e7eb;">
          <p style="font-size: 9px; font-weight: 800; color: #6b7280; margin: 0 0 2px 0;">보고서 종류</p>
          <p style="font-size: 12px; font-weight: 800; color: #111827; margin: 0;">공식 정기 리포트</p>
        </div>
        <div style="background: #f9fafb; padding: 10px 14px; border-radius: 10px; border: 1px solid #e5e7eb;">
          <p style="font-size: 9px; font-weight: 800; color: #6b7280; margin: 0 0 2px 0;">데이터 건수</p>
          <p style="font-size: 12px; font-weight: 800; color: #111827; margin: 0;">총 ${data.length} 건</p>
        </div>
        <div style="background: #f9fafb; padding: 10px 14px; border-radius: 10px; border: 1px solid #e5e7eb;">
          <p style="font-size: 9px; font-weight: 800; color: #6b7280; margin: 0 0 2px 0;">보안 등급</p>
          <p style="font-size: 12px; font-weight: 800; color: #dc2626; margin: 0;">대외비 (기밀보호)</p>
        </div>
        <div style="background: #f9fafb; padding: 10px 14px; border-radius: 10px; border: 1px solid #e5e7eb;">
          <p style="font-size: 9px; font-weight: 800; color: #6b7280; margin: 0 0 2px 0;">인증 상태</p>
          <p style="font-size: 12px; font-weight: 800; color: #2563eb; margin: 0;">데이터 무결성 검증</p>
        </div>
      </div>

      <!-- Table Section -->
      <div style="background: white; border-radius: 10px; border: 1px solid #e5e7eb; overflow: hidden; margin-bottom: 20px;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #111827;">
              ${headers.map(h => `<th style="padding: 10px 8px; text-align: center; font-size: 11px; font-weight: 800; color: #ffffff; border-right: 1px solid rgba(255,255,255,0.1);">${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${data.length === 0 ? `
              <tr>
                <td colspan="${headers.length}" style="padding: 24px; text-align: center; font-size: 12px; color: #9ca3af; font-weight: 600;">해당 기간에 등록된 내역이 없습니다.</td>
              </tr>
            ` : data.map((row, idx) => `
              <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f9fafb'}; border-bottom: 1px solid #f3f4f6;">
                ${row.map(cell => {
                  const cellStr = (cell === undefined || cell === null) ? '' : String(cell).trim();
                  const isDataImg = cellStr.startsWith('data:image/');
                  const isHttpImg = cellStr.startsWith('http://') || cellStr.startsWith('https://');
                  const isImage = isDataImg || isHttpImg;
                  
                  const renderedVal = isImage 
                    ? `<div style="display: flex; justify-content: center; align-items: center;"><img src="${cellStr}" ${isHttpImg ? 'crossorigin="anonymous"' : ''} style="height: 65px; width: 90px; object-fit: cover; border-radius: 6px; border: 1px solid #d1d5db; display: block;" onerror="this.style.display='none'" /></div>` 
                    : cellStr;
                  return `<td style="padding: 10px 8px; font-size: 11px; font-weight: 600; color: #374151; vertical-align: middle; text-align: center; word-break: break-all;">${renderedVal}</td>`;
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- 3-Step Approval Box -->
      <div style="margin-top: 20px; display: flex; justify-content: flex-end;">
        <table style="border-collapse: collapse; width: 300px; text-align: center; border: 1.5px solid #111827; background: white;">
          <tr>
            <td style="border: 1px solid #111827; background: #f3f4f6; font-size: 10px; font-weight: 800; padding: 5px; width: 33.3%; color: #111827;">작성자</td>
            <td style="border: 1px solid #111827; background: #f3f4f6; font-size: 10px; font-weight: 800; padding: 5px; width: 33.3%; color: #111827;">검토자</td>
            <td style="border: 1px solid #111827; background: #f3f4f6; font-size: 10px; font-weight: 800; padding: 5px; width: 33.3%; color: #111827;">최종승인</td>
          </tr>
          <tr>
            <td style="border: 1px solid #111827; height: 42px; vertical-align: middle; font-size: 9px; color: #9ca3af; font-weight: 700;">(인 / 서명)</td>
            <td style="border: 1px solid #111827; height: 42px; vertical-align: middle; font-size: 9px; color: #9ca3af; font-weight: 700;">(인 / 서명)</td>
            <td style="border: 1px solid #111827; height: 42px; vertical-align: middle; font-size: 9px; color: #9ca3af; font-weight: 700;">(인 / 서명)</td>
          </tr>
        </table>
      </div>

      <!-- Footer Info -->
      <div style="margin-top: 30px; padding: 18px 24px; background: #111827; border-radius: 12px; color: white;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h3 style="font-size: 14px; font-weight: 900; margin: 0 0 3px 0;">건명기업(주)</h3>
            <p style="font-size: 9px; opacity: 0.6; margin: 0;">본 문서는 건명기업 공식 전산 시스템을 통해 적법하게 발급된 문서입니다.</p>
          </div>
          <div style="text-align: right;">
            <p style="font-size: 9px; opacity: 0.8; font-weight: 700; margin: 0;">&copy; ${new Date().getFullYear()} 건명기업. All Rights Reserved.</p>
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(container);

  const imgs = container.querySelectorAll('img');
  await Promise.race([
    Promise.all(
      Array.from(imgs).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => {
            img.style.display = 'none';
            resolve();
          };
        });
      })
    ),
    new Promise(resolve => setTimeout(resolve, 2000))
  ]);

  await new Promise(resolve => setTimeout(resolve, 100));
  
  let canvas: HTMLCanvasElement | null = null;
  try {
    canvas = await html2canvas(container, {
      scale: 1.2,
      useCORS: true,
      allowTaint: false,
      logging: false,
      backgroundColor: '#ffffff',
      scrollX: 0,
      scrollY: 0,
      width: 840,
      windowWidth: 900,
      windowHeight: Math.max(container.scrollHeight, 840) + 20
    });
    
    let imgData: string;
    try {
      imgData = canvas.toDataURL('image/jpeg', 0.82); 
    } catch {
      imgData = canvas.toDataURL('image/png');
    }

    // Explicitly free canvas memory immediately
    canvas.width = 1;
    canvas.height = 1;

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfPageHeight = pdf.internal.pageSize.getHeight();
    const imgProps = pdf.getImageProperties(imgData);
    const imgHeightInPdf = (imgProps.height * pdfWidth) / imgProps.width;
    
    let heightLeft = imgHeightInPdf;
    let position = 0;

    pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeightInPdf);
    heightLeft -= pdfPageHeight;

    while (heightLeft > 5) {
      position = heightLeft - imgHeightInPdf;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeightInPdf);
      heightLeft -= pdfPageHeight;
    }
    
    const pdfBlob = pdf.output('blob');
    await downloadFile(pdfBlob, `${fileName}_${new Date().getTime()}.pdf`);
  } catch (error) {
    console.error('PDF generation failed:', error);
    throw error;
  } finally {
    if (canvas) {
      canvas.width = 1;
      canvas.height = 1;
    }
    if (container.parentNode) {
      document.body.removeChild(container);
    }
  }
};

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
 * Exports data to a structured 4-items-per-page Photo Inspection / Reward Card PDF Report.
 * Designed with a memory-safe single-page streaming pipeline to prevent WebView/mobile OOM crashes.
 * Exactly 4 items per page with clear layout, sharp Korean typography, and 3-step approval stamps.
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

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
  const pdfPageHeight = pdf.internal.pageSize.getHeight(); // 297mm

  // Create a single offscreen page container.
  // Rendering ONE page at a time keeps mobile memory footprint low (<20MB) and prevents OOM crashes.
  const pageContainer = document.createElement('div');
  pageContainer.id = 'photo-card-pdf-single-page';
  pageContainer.style.position = 'fixed';
  pageContainer.style.left = '-9999px';
  pageContainer.style.top = '0';
  pageContainer.style.width = '840px'; 
  pageContainer.style.height = '1188px'; // Standard A4 aspect (1 : 1.414)
  pageContainer.style.backgroundColor = '#ffffff';
  pageContainer.style.zIndex = '-9999';
  pageContainer.style.opacity = '1';
  pageContainer.style.pointerEvents = 'none';
  pageContainer.style.overflow = 'hidden';
  document.body.appendChild(pageContainer);

  try {
    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      if (onProgress) {
        onProgress(pageIdx + 1, totalPages);
      }

      const chunk = chunks[pageIdx];

      // Build HTML ONLY for the current page
      pageContainer.innerHTML = `
        <style>
          * {
            box-sizing: border-box;
            font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", "Pretendard", "Noto Sans KR", sans-serif !important;
          }
        </style>
        <div style="width: 840px; height: 1188px; background: white; padding: 24px 28px 18px 28px; box-sizing: border-box; position: relative; display: flex; flex-direction: column; justify-content: space-between;">
          <!-- Top Accent Bar -->
          <div style="position: absolute; top: 0; left: 0; width: 100%; height: 6px; background: linear-gradient(90deg, #2563eb, #6366f1, #ec4899);"></div>

          <!-- Header -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 8px;">
            <div style="flex: 1; min-width: 0;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 18px; font-weight: 900; color: #0f172a; letter-spacing: -0.01em;">건명기업(주)</span>
                <span style="font-size: 10px; background: #e0e7ff; color: #3730a3; padding: 2px 7px; border-radius: 9999px; font-weight: 800;">공식 현장 보고서</span>
              </div>
              <h1 style="font-size: 20px; font-weight: 900; color: #1e3a8a; margin: 3px 0 0 0; letter-spacing: -0.02em;">${title}</h1>
              <p style="font-size: 10px; color: #64748b; font-weight: 600; margin: 2px 0 0 0;">${subtitle || '스마트 안전 및 통합 인사 관리 시스템'}</p>
            </div>

            <!-- 3-Step Approval Stamp Box -->
            <div style="margin-left: 16px; flex-shrink: 0;">
              <table style="border-collapse: collapse; width: 220px; text-align: center; border: 1.5px solid #0f172a; background: white;">
                <tr>
                  <td style="border: 1px solid #0f172a; background: #f8fafc; font-size: 9px; font-weight: 800; padding: 3px; width: 33.3%; color: #0f172a;">작성자</td>
                  <td style="border: 1px solid #0f172a; background: #f8fafc; font-size: 9px; font-weight: 800; padding: 3px; width: 33.3%; color: #0f172a;">검토자</td>
                  <td style="border: 1px solid #0f172a; background: #f8fafc; font-size: 9px; font-weight: 800; padding: 3px; width: 33.3%; color: #0f172a;">최종승인</td>
                </tr>
                <tr>
                  <td style="border: 1px solid #0f172a; height: 38px; vertical-align: middle; font-size: 9px; color: #94a3b8; font-weight: 700;">(인 / 서명)</td>
                  <td style="border: 1px solid #0f172a; height: 38px; vertical-align: middle; font-size: 9px; color: #94a3b8; font-weight: 700;">(인 / 서명)</td>
                  <td style="border: 1px solid #0f172a; height: 38px; vertical-align: middle; font-size: 9px; color: #94a3b8; font-weight: 700;">(인 / 서명)</td>
                </tr>
              </table>
            </div>
          </div>

          <!-- Metadata Strip -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 12px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; font-size: 10px; font-weight: 700; color: #475569;">
            <div><span>기준 월/일시: </span><strong style="color: #0f172a;">${monthStr || new Date().toLocaleDateString('ko-KR')}</strong></div>
            <div><span>총 데이터 건수: </span><strong style="color: #2563eb;">${items.length} 건</strong></div>
            <div><span>페이지: </span><strong style="color: #0f172a; font-weight: 900;">${pageIdx + 1} / ${totalPages} 쪽</strong></div>
            <div><span>보안 등급: </span><strong style="color: #dc2626;">대외비 (기밀보호)</strong></div>
          </div>

          <!-- 4-Card 2x2 Grid -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 12px; flex: 1; width: 100%; min-height: 0;">
            ${[0, 1, 2, 3].map(slotIdx => {
              const item = chunk[slotIdx];
              if (!item) {
                return `
                  <div style="background: #fafafa; border: 2px dashed #cbd5e1; border-radius: 12px; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #94a3b8; text-align: center; height: 100%;">
                    <span style="font-size: 12px; font-weight: 800; color: #94a3b8;">[ 여백 - 등록 내역 없음 ]</span>
                    <span style="font-size: 10px; color: #cbd5e1; margin-top: 4px;">1페이지 4건 표준 양식 규격</span>
                  </div>
                `;
              }

              const isDataImg = item.photoUrl?.startsWith('data:image/');
              const isHttpImg = item.photoUrl?.startsWith('http://') || item.photoUrl?.startsWith('https://');
              const hasPhoto = Boolean(isDataImg || isHttpImg);

              return `
                <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 10px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.03); overflow: hidden; height: 100%;">
                  <!-- Card Header -->
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px;">
                    <div style="display: flex; align-items: center; gap: 6px; min-width: 0;">
                      <span style="background: #0f172a; color: white; font-size: 10px; font-weight: 900; padding: 2px 6px; border-radius: 5px;">No. ${String(item.itemNumber).padStart(2, '0')}</span>
                      <div style="min-width: 0;">
                        <span style="font-size: 14px; font-weight: 900; color: #0f172a;">${item.targetName}</span>
                        <span style="font-size: 10px; font-weight: 700; color: #64748b; margin-left: 4px;">${item.targetSub || ''}</span>
                      </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
                      ${item.categoryBadge ? `
                        <span style="font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 5px; ${item.categoryType === 'penalty' ? 'background: #fee2e2; color: #b91c1c;' : 'background: #dbeafe; color: #1d4ed8;'}">
                          ${item.categoryBadge}
                        </span>
                      ` : ''}
                      <span style="font-size: 13px; font-weight: 900; padding: 2px 8px; border-radius: 6px; ${item.scoreBadgeType === 'negative' ? 'background: #fef2f2; color: #dc2626; border: 1px solid #fca5a5;' : 'background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0;'}">
                        ${item.scoreBadge}
                      </span>
                    </div>
                  </div>

                  <!-- Card Photo Area -->
                  <div style="width: 100%; flex: 1; min-height: 180px; max-height: 240px; border-radius: 8px; overflow: hidden; background: #f8fafc; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; margin-bottom: 6px;">
                    ${hasPhoto ? `
                      <img src="${item.photoUrl}" ${isHttpImg ? 'crossorigin="anonymous"' : ''} style="width: 100%; height: 100%; object-fit: cover; display: block;" onerror="this.style.display='none'" />
                    ` : `
                      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; color: #94a3b8; text-align: center;">
                        <svg style="width: 36px; height: 36px; margin-bottom: 4px; opacity: 0.5;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span style="font-size: 11px; font-weight: 800;">현장 사진 미첨부</span>
                        <span style="font-size: 9px; opacity: 0.7;">(기록 보관용 항목)</span>
                      </div>
                    `}
                  </div>

                  <!-- Card Meta Details -->
                  <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10px; font-weight: 700; color: #475569; margin-bottom: 4px; background: #f8fafc; padding: 3px 6px; border-radius: 5px;">
                    <span>일시: <strong style="color: #0f172a;">${item.date}</strong></span>
                    <span>${item.authorName || ''}</span>
                    ${item.location ? `<span>장소: <strong style="color: #0f172a;">${item.location}</strong></span>` : ''}
                  </div>

                  <!-- Card Reason Box -->
                  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 8px; max-height: 75px; overflow: hidden; display: flex; flex-direction: column;">
                    <span style="font-size: 9px; font-weight: 800; color: #2563eb; margin-bottom: 2px;">활동 내용 및 칭찬/점검 사유</span>
                    <p style="font-size: 11px; font-weight: 700; color: #1e293b; margin: 0; line-height: 1.35; word-break: break-all;">${item.reason}</p>
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <!-- Footer -->
          <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #64748b; font-weight: 600;">
            <div>건명기업(주) 스마트 현장 관리 시스템 | 공식 전자 인증 보고서</div>
            <div style="font-weight: 800; color: #0f172a;">페이지 ${pageIdx + 1} / ${totalPages}</div>
            <div>&copy; ${new Date().getFullYear()} 건명기업. All Rights Reserved.</div>
          </div>
        </div>
      `;

      // Pre-load images only for the current page
      const imgs = pageContainer.querySelectorAll('img');
      await Promise.race([
        Promise.all(
          Array.from(imgs).map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise<void>((resolve) => {
              img.onload = () => resolve();
              img.onerror = () => {
                img.style.display = 'none';
                resolve();
              };
            });
          })
        ),
        new Promise(resolve => setTimeout(resolve, 1500))
      ]);

      await new Promise(resolve => setTimeout(resolve, 60));

      const canvas = await html2canvas(pageContainer, {
        scale: 1.25, // 1050x1485 resolution: sharp text, low memory (<15MB)
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: '#ffffff',
        width: 840,
        height: 1188
      });

      let imgData: string;
      try {
        imgData = canvas.toDataURL('image/jpeg', 0.82);
      } catch {
        imgData = canvas.toDataURL('image/png');
      }

      // Explicitly release canvas pixel buffer immediately
      canvas.width = 1;
      canvas.height = 1;

      if (pageIdx > 0) {
        pdf.addPage();
      }
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfPageHeight);

      // Clear DOM for current page to free memory
      pageContainer.innerHTML = '';

      // Give browser time for GC between pages
      await new Promise(resolve => setTimeout(resolve, 40));
    }

    const pdfBlob = pdf.output('blob');
    await downloadFile(pdfBlob, `${fileName}_${new Date().getTime()}.pdf`);
  } catch (error) {
    console.error('Photo card PDF generation failed:', error);
    throw error;
  } finally {
    if (pageContainer.parentNode) {
      document.body.removeChild(pageContainer);
    }
  }
};
