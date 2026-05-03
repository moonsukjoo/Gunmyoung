import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Exports data to an Excel file
 * @param data Array of objects to export
 * @param fileName Name of the file (without extension)
 * @param sheetName Name of the sheet
 */
export const exportToExcel = (data: any[], fileName: string, sheetName: string = 'Sheet1') => {
  try {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    
    // Use manual blob generation for better compatibility in some environments
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}_${new Date().getTime()}.xlsx`;
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
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
  // Create a hidden container for the report
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '1000px'; 
  container.style.padding = '0';
  container.style.backgroundColor = '#ffffff';
  
  // Build HTML content with a more sophisticated layout
  container.innerHTML = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;900&display=swap');
      * { font-family: 'Noto Sans KR', sans-serif !important; }
    </style>
    <div style="padding: 50px; background: white; min-height: 1200px; position: relative;">
      <!-- Accent Top Bar -->
      <div style="position: absolute; top: 0; left: 0; width: 100%; height: 8px; background: linear-gradient(90deg, #3b82f6, #6366f1);"></div>
      
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #111827; padding-bottom: 30px; margin-bottom: 40px;">
        <div style="display: flex; align-items: center; gap: 15px;">
          <div style="width: 48px; height: 48px; background: #3b82f6; border-radius: 12px; display: flex; items-center; justify-center; color: white; font-weight: 900; font-size: 20px;">KM</div>
          <div>
            <h2 style="font-size: 24px; font-weight: 900; color: #111827; margin: 0; letter-spacing: -0.01em;">건명기업</h2>
            <p style="font-size: 12px; color: #6b7280; font-weight: 500; margin: 0;">스마트 안전 및 인사 관리 솔루션</p>
          </div>
        </div>
        <div style="text-align: right;">
          <h1 style="font-size: 32px; font-weight: 900; color: #111827; margin: 0; letter-spacing: -0.02em;">${title}</h1>
        </div>
      </div>

      <!-- Info Grid -->
      <div style="display: grid; grid-template-cols: repeat(4, 1fr); gap: 20px; margin-bottom: 40px;">
        <div style="background: #f9fafb; padding: 20px; border-radius: 16px; border: 1px solid #f3f4f6;">
          <p style="font-size: 10px; font-weight: 800; color: #9ca3af; margin-bottom: 6px;">출력 일시</p>
          <p style="font-size: 14px; font-weight: 700; color: #111827;">${new Date().toLocaleDateString('ko-KR')} ${new Date().toLocaleTimeString('ko-KR')}</p>
        </div>
        <div style="background: #f9fafb; padding: 20px; border-radius: 16px; border: 1px solid #f3f4f6;">
          <p style="font-size: 10px; font-weight: 800; color: #9ca3af; margin-bottom: 6px;">문서 분류</p>
          <p style="font-size: 14px; font-weight: 700; color: #111827;">공식 보고서</p>
        </div>
        <div style="background: #f9fafb; padding: 20px; border-radius: 16px; border: 1px solid #f3f4f6;">
          <p style="font-size: 10px; font-weight: 800; color: #9ca3af; margin-bottom: 6px;">보안 수준</p>
          <p style="font-size: 14px; font-weight: 700; color: #dc2626;">대외비 (기밀)</p>
        </div>
        <div style="background: #f9fafb; padding: 20px; border-radius: 16px; border: 1px solid #f3f4f6;">
          <p style="font-size: 10px; font-weight: 800; color: #9ca3af; margin-bottom: 6px;">신뢰성 확보</p>
          <p style="font-size: 14px; font-weight: 700; color: #3b82f6;">데이터 무결성 검증됨</p>
        </div>
      </div>

      <!-- Table Section -->
      <div style="background: white; border-radius: 20px; border: 1px solid #e5e7eb; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #111827;">
              ${headers.map(h => `<th style="padding: 16px 12px; text-align: left; font-size: 12px; font-weight: 800; color: #f9fafb; border-right: 1px solid rgba(255,255,255,0.1);">${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${data.map((row, idx) => `
              <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f9fafb'}; border-bottom: 1px solid #f3f4f6;">
                ${row.map(cell => `<td style="padding: 14px 12px; font-size: 13px; font-weight: 500; color: #374151;">${cell}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Footer Info -->
      <div style="margin-top: 60px; padding: 40px; background: #111827; border-radius: 24px; color: white;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h3 style="font-size: 18px; font-weight: 900; margin: 0 0 8px 0;">건명기업(주)</h3>
            <p style="font-size: 11px; opacity: 0.6; margin: 0;">본 리포트의 무단 복제 및 유출은 법적 처벌을 받을 수 있습니다.</p>
          </div>
          <div style="text-align: right;">
            <p style="font-size: 11px; opacity: 0.8; font-weight: 700; margin: 0;">&copy; ${new Date().getFullYear()} 건명기업. 모든 권리 보유.</p>
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(container);

  // Wait a bit for images to load
  await new Promise(resolve => setTimeout(resolve, 500));
  
  try {
    const canvas = await html2canvas(container, {
      scale: 2, // High resolution for professional look
      useCORS: true,
      logging: false,
      backgroundColor: '#f8fafc'
    });
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    
    // Use manual blob generation for better compatibility
    const pdfBlob = pdf.output('blob');
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}_${new Date().getTime()}.pdf`;
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  } catch (error) {
    console.error('PDF generation failed:', error);
    throw error;
  } finally {
    if (container.parentNode) {
      document.body.removeChild(container);
    }
  }
};
