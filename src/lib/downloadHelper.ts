import { Filesystem, Directory } from '@capacitor/filesystem';
import { Device } from '@capacitor/device';
import { Share } from '@capacitor/share';

/**
 * Robust file download helper for both Web and Capacitor (Android/iOS)
 */
export const downloadFile = async (blob: Blob, fileName: string) => {
  try {
    let platform = 'web';
    try {
      const info = await Device.getInfo();
      platform = info.platform;
    } catch (e) {
      console.warn('Capacitor check failed, assuming web:', e);
    }
    
    // If it's a native platform (Android or iOS)
    if (platform === 'android' || platform === 'ios') {
      const reader = new FileReader();
      
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          try {
            const base64String = reader.result as string;
            // Remove the data: part
            const base64Data = base64String.split(',')[1];
            resolve(base64Data);
          } catch (e) {
            reject(e);
          }
        };
        reader.onerror = reject;
      });
      
      reader.readAsDataURL(blob);
      const base64Data = await base64Promise;

      // Save to temporary cache first
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache,
      });
      
      console.log('Saved to cache:', savedFile.uri);

      // Trigger Share sheet - This is much safer on Android for "Downloading" 
      // as it avoids direct storage permission issues and allows user to save where they want
      await Share.share({
        title: fileName,
        text: '파일을 다운로드합니다.',
        url: savedFile.uri,
        dialogTitle: '파일 저장 또는 공유',
      });
      
      return true;
    } else {
      // Standard Web behavior
      return triggerWebDownload(blob, fileName);
    }
  } catch (error) {
    console.error('Download process failed:', error);
    // Fallback to web method anyway
    return triggerWebDownload(blob, fileName);
  }
};

const triggerWebDownload = (blob: Blob, fileName: string) => {
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
  } catch (err) {
    console.error('Web download fallback failed:', err);
    return false;
  }
};
