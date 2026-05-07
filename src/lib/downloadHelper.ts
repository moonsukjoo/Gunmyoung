import { Filesystem, Directory } from '@capacitor/filesystem';
import { Device } from '@capacitor/device';

/**
 * Robust file download helper for both Web and Capacitor (Android/iOS)
 */
export const downloadFile = async (blob: Blob, fileName: string) => {
  try {
    const info = await Device.getInfo();
    
    // If it's a native platform (Android or iOS)
    if (info.platform === 'android' || info.platform === 'ios') {
      const reader = new FileReader();
      
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64String = reader.result as string;
          // Remove the data:application/octet-stream;base64, part
          const base64Data = base64String.split(',')[1];
          resolve(base64Data);
        };
      });
      
      reader.readAsDataURL(blob);
      const base64Data = await base64Promise;

      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Documents, // Or Directory.Data
      });
      
      console.log('Saved file:', savedFile);
      return true;
    } else {
      // Standard Web fallback
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);
      return true;
    }
  } catch (error) {
    console.error('Download failed:', error);
    // Even if Capacitor fails, try the web fallback as a last resort
    try {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);
      return true;
    } catch (innerError) {
      console.error('Final fallback failed:', innerError);
      return false;
    }
  }
};
