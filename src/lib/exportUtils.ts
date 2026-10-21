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
