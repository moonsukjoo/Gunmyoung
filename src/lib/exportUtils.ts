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
    
    // Use manual blob generation for better compatibility in some environments
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    await downloadFile(blob, `${fileName}_${new Date().getTime()}.xlsx`);
  } catch (error) {
    console.error('Excel export failed:', error);
    throw error;
  }
};

/**
 * Exports data to a PDF file using a capture method to support Korean characters
 * @param title Title of the PDF
 * @param headers Table headers
 * @param data Table data rows
 * @param fileName Name of the file (without extension)
 */
export const exportToPDF = async (title: string, headers: string[], data: any[][], fileName: string) => {
  // Create an offscreen-rendered container for the report with full opacity
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '0';
  container.style.top = '0';
  container.style.opacity = '1'; // Must remain 1 so html2canvas renders content instead of a blank canvas
  container.style.pointerEvents = 'none';
  container.style.zIndex = '-9999';
  container.style.width = '1000px'; 
  container.style.padding = '0';
  container.style.margin = '0';
  container.style.backgroundColor = '#ffffff';
  
  // Build HTML content with clean Korean fonts without external network blocking
  container.innerHTML = `
    <style>
      * { 
        box-sizing: border-box; 
        font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", "Pretendard", "Noto Sans KR", sans-serif !important; 
      }
    </style>
    <div style="padding: 40px; background: white; min-height: 1000px; position: relative; width: 1000px;">
      <!-- Accent Top Bar -->
      <div style="position: absolute; top: 0; left: 0; width: 100%; height: 8px; background: linear-gradient(90deg, #3b82f6, #6366f1);"></div>
      
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #111827; padding-bottom: 24px; margin-bottom: 30px;">
        <div style="display: flex; align-items: center; gap: 15px;">
          <div>
            <h2 style="font-size: 26px; font-weight: 900; color: #111827; margin: 0; letter-spacing: -0.01em;">건명기업(주)</h2>
            <p style="font-size: 12px; color: #6b7280; font-weight: 600; margin: 4px 0 0 0;">스마트 안전 및 통합 인사 관리 시스템</p>
          </div>
        </div>
        <div style="text-align: right;">
          <h1 style="font-size: 26px; font-weight: 900; color: #111827; margin: 0; letter-spacing: -0.02em;">${title}</h1>
          <p style="font-size: 11px; color: #3b82f6; font-weight: 700; margin: 4px 0 0 0;">출력일시: ${new Date().toLocaleDateString('ko-KR')} ${new Date().toLocaleTimeString('ko-KR')}</p>
        </div>
      </div>

      <!-- Info Grid -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 30px;">
        <div style="background: #f9fafb; padding: 14px 18px; border-radius: 12px; border: 1px solid #e5e7eb;">
          <p style="font-size: 10px; font-weight: 800; color: #6b7280; margin: 0 0 4px 0;">보고서 종류</p>
          <p style="font-size: 13px; font-weight: 800; color: #111827; margin: 0;">공식 정기 리포트</p>
        </div>
        <div style="background: #f9fafb; padding: 14px 18px; border-radius: 12px; border: 1px solid #e5e7eb;">
          <p style="font-size: 10px; font-weight: 800; color: #6b7280; margin: 0 0 4px 0;">데이터 건수</p>
          <p style="font-size: 13px; font-weight: 800; color: #111827; margin: 0;">총 ${data.length} 건</p>
        </div>
        <div style="background: #f9fafb; padding: 14px 18px; border-radius: 12px; border: 1px solid #e5e7eb;">
          <p style="font-size: 10px; font-weight: 800; color: #6b7280; margin: 0 0 4px 0;">보안 등급</p>
          <p style="font-size: 13px; font-weight: 800; color: #dc2626; margin: 0;">대외비 (기밀보호)</p>
        </div>
        <div style="background: #f9fafb; padding: 14px 18px; border-radius: 12px; border: 1px solid #e5e7eb;">
          <p style="font-size: 10px; font-weight: 800; color: #6b7280; margin: 0 0 4px 0;">인증 상태</p>
          <p style="font-size: 13px; font-weight: 800; color: #2563eb; margin: 0;">데이터 무결성 검증</p>
        </div>
      </div>

      <!-- Table Section -->
      <div style="background: white; border-radius: 14px; border: 1px solid #e5e7eb; overflow: hidden; margin-bottom: 25px;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #111827;">
              ${headers.map(h => `<th style="padding: 14px 10px; text-align: center; font-size: 12px; font-weight: 800; color: #ffffff; border-right: 1px solid rgba(255,255,255,0.1);">${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${data.length === 0 ? `
              <tr>
                <td colspan="${headers.length}" style="padding: 30px; text-align: center; font-size: 13px; color: #9ca3af; font-weight: 600;">해당 기간에 등록된 내역이 없습니다.</td>
              </tr>
            ` : data.map((row, idx) => `
              <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f9fafb'}; border-bottom: 1px solid #f3f4f6;">
                ${row.map(cell => {
                  const cellStr = (cell === undefined || cell === null) ? '' : String(cell).trim();
                  const isDataImg = cellStr.startsWith('data:image/');
                  const isHttpImg = cellStr.startsWith('http://') || cellStr.startsWith('https://');
                  const isImage = isDataImg || isHttpImg;
                  
                  const renderedVal = isImage 
                    ? `<div style="display: flex; justify-content: center; align-items: center;"><img src="${cellStr}" ${isHttpImg ? 'crossorigin="anonymous"' : ''} style="height: 85px; width: 115px; object-fit: cover; border-radius: 8px; border: 1px solid #d1d5db; box-shadow: 0 2px 4px rgba(0,0,0,0.08); display: block;" onerror="this.style.display='none'" /></div>` 
                    : cellStr;
                  return `<td style="padding: 12px 10px; font-size: 12px; font-weight: 600; color: #374151; vertical-align: middle; text-align: ${isImage ? 'center' : 'center'}; word-break: break-all;">${renderedVal}</td>`;
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- 3-Step Approval Box (작성자 / 검토자 / 최종 승인자) -->
      <div style="margin-top: 30px; display: flex; justify-content: flex-end;">
        <table style="border-collapse: collapse; width: 340px; text-align: center; border: 2px solid #111827; background: white;">
          <tr>
            <td style="border: 1px solid #111827; background: #f3f4f6; font-size: 11px; font-weight: 800; padding: 7px; width: 33.3%; color: #111827;">작성자</td>
            <td style="border: 1px solid #111827; background: #f3f4f6; font-size: 11px; font-weight: 800; padding: 7px; width: 33.3%; color: #111827;">검토자</td>
            <td style="border: 1px solid #111827; background: #f3f4f6; font-size: 11px; font-weight: 800; padding: 7px; width: 33.3%; color: #111827;">최종승인</td>
          </tr>
          <tr>
            <td style="border: 1px solid #111827; height: 50px; vertical-align: middle; font-size: 10px; color: #9ca3af; font-weight: 700;">(인 / 서명)</td>
            <td style="border: 1px solid #111827; height: 50px; vertical-align: middle; font-size: 10px; color: #9ca3af; font-weight: 700;">(인 / 서명)</td>
            <td style="border: 1px solid #111827; height: 50px; vertical-align: middle; font-size: 10px; color: #9ca3af; font-weight: 700;">(인 / 서명)</td>
          </tr>
        </table>
      </div>

      <!-- Footer Info -->
      <div style="margin-top: 40px; padding: 24px 30px; background: #111827; border-radius: 16px; color: white;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h3 style="font-size: 16px; font-weight: 900; margin: 0 0 4px 0;">건명기업(주)</h3>
            <p style="font-size: 10px; opacity: 0.6; margin: 0;">본 문서는 건명기업 공식 전산 시스템을 통해 적법하게 발급된 문서입니다.</p>
          </div>
          <div style="text-align: right;">
            <p style="font-size: 10px; opacity: 0.8; font-weight: 700; margin: 0;">&copy; ${new Date().getFullYear()} 건명기업. All Rights Reserved.</p>
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(container);

  // Wait for all images inside container to load completely with a safety timeout fallback
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
    new Promise(resolve => setTimeout(resolve, 2500))
  ]);

  // Brief delay for CSS layout settling
  await new Promise(resolve => setTimeout(resolve, 200));
  
  try {
    const canvas = await html2canvas(container, {
      scale: 1.5,
      useCORS: true,
      allowTaint: false,
      logging: false,
      backgroundColor: '#ffffff',
      scrollX: 0,
      scrollY: 0,
      x: 0,
      y: 0,
      width: 1000,
      windowWidth: 1050,
      windowHeight: Math.max(container.scrollHeight, 1000) + 50
    });
    
    let imgData: string;
    try {
      imgData = canvas.toDataURL('image/jpeg', 0.85); 
    } catch (e) {
      console.warn('Canvas toDataURL image/jpeg fallback:', e);
      imgData = canvas.toDataURL('image/png');
    }

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfPageHeight = pdf.internal.pageSize.getHeight();
    const imgProps = pdf.getImageProperties(imgData);
    const imgHeightInPdf = (imgProps.height * pdfWidth) / imgProps.width;
    
    let heightLeft = imgHeightInPdf;
    let position = 0;

    // Add first page
    pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeightInPdf);
    heightLeft -= pdfPageHeight;

    // Add subsequent pages if content spans across multiple pages (threshold 5mm avoids blank trailing page)
    while (heightLeft > 5) {
      position = heightLeft - imgHeightInPdf;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeightInPdf);
      heightLeft -= pdfPageHeight;
    }
    
    // Download PDF via unified download helper
    const pdfBlob = pdf.output('blob');
    await downloadFile(pdfBlob, `${fileName}_${new Date().getTime()}.pdf`);
  } catch (error) {
    console.error('PDF generation failed:', error);
    throw error;
  } finally {
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
}

/**
 * Exports data to a structured 4-items-per-page Photo Inspection / Reward Card PDF Report.
 * Exactly 4 items per page with large high-definition photos, bold typography, and 3-step approval stamps.
 */
export const exportPhotoCardPDF = async ({
  title,
  subtitle,
  monthStr,
  items,
  fileName
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

  const rootContainer = document.createElement('div');
  rootContainer.id = 'photo-card-pdf-root';
  rootContainer.style.position = 'absolute';
  rootContainer.style.left = '0';
  rootContainer.style.top = '0';
  rootContainer.style.opacity = '1';
  rootContainer.style.pointerEvents = 'none';
  rootContainer.style.zIndex = '-9999';
  rootContainer.style.width = '1000px';
  rootContainer.style.backgroundColor = '#ffffff';

  // Build HTML for each page
  rootContainer.innerHTML = `
    <style>
      * {
        box-sizing: border-box;
        font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", "Pretendard", "Noto Sans KR", sans-serif !important;
      }
    </style>
    ${chunks.map((chunk, pageIdx) => `
      <div id="pdf-card-page-${pageIdx}" style="width: 1000px; height: 1414px; background: white; position: absolute; top: 0; left: 0; padding: 34px 38px 24px 38px; box-sizing: border-box; overflow: hidden; display: ${pageIdx === 0 ? 'block' : 'none'};">
        <!-- Top Accent Bar -->
        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 8px; background: linear-gradient(90deg, #2563eb, #6366f1, #ec4899);"></div>

        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 12px;">
          <div style="flex: 1; min-width: 0;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 20px; font-weight: 900; color: #0f172a; letter-spacing: -0.01em;">건명기업(주)</span>
              <span style="font-size: 11px; background: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 9999px; font-weight: 800;">공식 현장 보고서</span>
            </div>
            <h1 style="font-size: 22px; font-weight: 900; color: #1e3a8a; margin: 4px 0 0 0; letter-spacing: -0.02em;">${title}</h1>
            <p style="font-size: 11px; color: #64748b; font-weight: 600; margin: 2px 0 0 0;">${subtitle || '스마트 안전 및 통합 인사 관리 시스템'}</p>
          </div>

          <!-- 3-Step Approval Stamp Box -->
          <div style="margin-left: 20px; flex-shrink: 0;">
            <table style="border-collapse: collapse; width: 250px; text-align: center; border: 1.5px solid #0f172a; background: white;">
              <tr>
                <td style="border: 1px solid #0f172a; background: #f8fafc; font-size: 10px; font-weight: 800; padding: 4px; width: 33.3%; color: #0f172a;">작성자</td>
                <td style="border: 1px solid #0f172a; background: #f8fafc; font-size: 10px; font-weight: 800; padding: 4px; width: 33.3%; color: #0f172a;">검토자</td>
                <td style="border: 1px solid #0f172a; background: #f8fafc; font-size: 10px; font-weight: 800; padding: 4px; width: 33.3%; color: #0f172a;">최종승인</td>
              </tr>
              <tr>
                <td style="border: 1px solid #0f172a; height: 42px; vertical-align: middle; font-size: 10px; color: #94a3b8; font-weight: 700;">(인 / 서명)</td>
                <td style="border: 1px solid #0f172a; height: 42px; vertical-align: middle; font-size: 10px; color: #94a3b8; font-weight: 700;">(인 / 서명)</td>
                <td style="border: 1px solid #0f172a; height: 42px; vertical-align: middle; font-size: 10px; color: #94a3b8; font-weight: 700;">(인 / 서명)</td>
              </tr>
            </table>
          </div>
        </div>

        <!-- Metadata Strip -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 7px 14px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; font-size: 11px; font-weight: 700; color: #475569;">
          <div><span>기준 월/일시: </span><strong style="color: #0f172a;">${monthStr || new Date().toLocaleDateString('ko-KR')}</strong></div>
          <div><span>총 데이터 건수: </span><strong style="color: #2563eb;">${items.length} 건</strong></div>
          <div><span>페이지: </span><strong style="color: #0f172a; font-weight: 900;">${pageIdx + 1} / ${totalPages} 쪽</strong></div>
          <div><span>보안 등급: </span><strong style="color: #dc2626;">대외비 (기밀보호)</strong></div>
        </div>

        <!-- 4-Card 2x2 Grid -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 16px; height: 1150px; width: 100%;">
          ${[0, 1, 2, 3].map(slotIdx => {
            const item = chunk[slotIdx];
            if (!item) {
              return `
                <div style="background: #fafafa; border: 2px dashed #cbd5e1; border-radius: 14px; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #94a3b8; text-align: center;">
                  <span style="font-size: 13px; font-weight: 800; color: #94a3b8;">[ 여백 - 등록 내역 없음 ]</span>
                  <span style="font-size: 11px; color: #cbd5e1; margin-top: 4px;">1페이지 4건 표준 양식 규격</span>
                </div>
              `;
            }

            const isDataImg = item.photoUrl?.startsWith('data:image/');
            const isHttpImg = item.photoUrl?.startsWith('http://') || item.photoUrl?.startsWith('https://');
            const hasPhoto = isDataImg || isHttpImg;

            return `
              <div style="background: #ffffff; border: 2px solid #e2e8f0; border-radius: 14px; padding: 14px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.04); overflow: hidden;">
                <!-- Card Header -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;">
                  <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
                    <span style="background: #0f172a; color: white; font-size: 11px; font-weight: 900; padding: 2px 7px; border-radius: 6px;">No. ${String(item.itemNumber).padStart(2, '0')}</span>
                    <div style="min-width: 0;">
                      <span style="font-size: 16px; font-weight: 900; color: #0f172a;">${item.targetName}</span>
                      <span style="font-size: 11px; font-weight: 700; color: #64748b; margin-left: 6px;">${item.targetSub || ''}</span>
                    </div>
                  </div>
                  <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                    ${item.categoryBadge ? `
                      <span style="font-size: 11px; font-weight: 800; padding: 2px 7px; border-radius: 6px; ${item.categoryType === 'penalty' ? 'background: #fee2e2; color: #b91c1c;' : 'background: #dbeafe; color: #1d4ed8;'}">
                        ${item.categoryBadge}
                      </span>
                    ` : ''}
                    <span style="font-size: 15px; font-weight: 900; padding: 3px 10px; border-radius: 8px; ${item.scoreBadgeType === 'negative' ? 'background: #fef2f2; color: #dc2626; border: 1px solid #fca5a5;' : 'background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0;'}">
                      ${item.scoreBadge}
                    </span>
                  </div>
                </div>

                <!-- Card Photo Area -->
                <div style="width: 100%; height: 275px; border-radius: 10px; overflow: hidden; background: #f8fafc; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; margin-bottom: 8px;">
                  ${hasPhoto ? `
                    <img src="${item.photoUrl}" ${isHttpImg ? 'crossorigin="anonymous"' : ''} style="width: 100%; height: 100%; object-fit: cover; display: block;" onerror="this.style.display='none'" />
                  ` : `
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; color: #94a3b8; text-align: center;">
                      <svg style="width: 44px; height: 44px; margin-bottom: 6px; opacity: 0.5;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span style="font-size: 12px; font-weight: 800;">현장 사진 미첨부</span>
                      <span style="font-size: 10px; opacity: 0.7;">(기록 보관용 항목)</span>
                    </div>
                  `}
                </div>

                <!-- Card Meta Details -->
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 6px; background: #f8fafc; padding: 4px 8px; border-radius: 6px;">
                  <span>일시: <strong style="color: #0f172a;">${item.date}</strong></span>
                  <span>${item.authorName || ''}</span>
                  ${item.location ? `<span>장소: <strong style="color: #0f172a;">${item.location}</strong></span>` : ''}
                </div>

                <!-- Card Reason Box -->
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; flex: 1; max-height: 90px; overflow: hidden; display: flex; flex-direction: column;">
                  <span style="font-size: 10px; font-weight: 800; color: #2563eb; margin-bottom: 2px;">활동 내용 및 칭찬/점검 사유</span>
                  <p style="font-size: 13px; font-weight: 700; color: #1e293b; margin: 0; line-height: 1.4; word-break: break-all;">${item.reason}</p>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Footer -->
        <div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #64748b; font-weight: 600;">
          <div>건명기업(주) 스마트 현장 관리 시스템 | 공식 전자 인증 보고서</div>
          <div style="font-weight: 800; color: #0f172a;">페이지 ${pageIdx + 1} / ${totalPages}</div>
          <div>&copy; ${new Date().getFullYear()} 건명기업. All Rights Reserved.</div>
        </div>
      </div>
    `).join('')}
  `;

  document.body.appendChild(rootContainer);

  // Pre-load all images inside container with safety timeout
  const imgs = rootContainer.querySelectorAll('img');
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
    new Promise(resolve => setTimeout(resolve, 3000))
  ]);

  await new Promise(resolve => setTimeout(resolve, 200));

  try {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
    const pdfPageHeight = pdf.internal.pageSize.getHeight(); // 297mm

    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      // Hide all pages, show only the current one at (0, 0)
      for (let i = 0; i < totalPages; i++) {
        const el = document.getElementById(`pdf-card-page-${i}`);
        if (el) el.style.display = i === pageIdx ? 'block' : 'none';
      }

      const currentPageEl = document.getElementById(`pdf-card-page-${pageIdx}`);
      if (!currentPageEl) continue;

      const canvas = await html2canvas(currentPageEl, {
        scale: 1.5,
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0,
        width: 1000,
        height: 1414,
        windowWidth: 1050,
        windowHeight: 1500
      });

      let imgData: string;
      try {
        imgData = canvas.toDataURL('image/jpeg', 0.85);
      } catch (e) {
        console.warn('Canvas toDataURL image/jpeg fallback:', e);
        imgData = canvas.toDataURL('image/png');
      }

      if (pageIdx > 0) {
        pdf.addPage();
      }
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfPageHeight);
    }

    const pdfBlob = pdf.output('blob');
    await downloadFile(pdfBlob, `${fileName}_${new Date().getTime()}.pdf`);
  } catch (error) {
    console.error('Photo card PDF generation failed:', error);
    throw error;
  } finally {
    if (rootContainer.parentNode) {
      document.body.removeChild(rootContainer);
    }
  }
};
