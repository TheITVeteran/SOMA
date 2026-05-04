const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const destDir = path.join(__dirname, 'cognitive-terminal', 'services', 'bin');
const zipPath = path.join(destDir, 'ffmpeg.zip');
// Using a specific release from github to ensure stability
const url = 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip';

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

console.log('Downloading FFmpeg from:', url);

const file = fs.createWriteStream(zipPath);
https.get(url, (response) => {
  if (response.statusCode !== 200) {
      console.error(`Failed to download: ${response.statusCode}`);
      return;
  }
  response.pipe(file);
  file.on('finish', () => {
    file.close();
    console.log('Download complete. Extracting...');
    
    try {
      // Use powershell to unzip because it's built-in on Windows
      execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`);
      console.log('Extraction complete.');
      
      // Find the bin folder inside the extracted folder
      const items = fs.readdirSync(destDir);
      const folderName = items.find(item => item.startsWith('ffmpeg-') && fs.statSync(path.join(destDir, item)).isDirectory());
      
      if (folderName) {
        const binSource = path.join(destDir, folderName, 'bin');
        // Move exe files to root of bin
        if (fs.existsSync(binSource)) {
            fs.readdirSync(binSource).forEach(exe => {
                const srcPath = path.join(binSource, exe);
                const destPath = path.join(destDir, exe);
                // Remove dest if exists
                if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
                fs.renameSync(srcPath, destPath);
            });
        }
        // Cleanup
        fs.rmSync(path.join(destDir, folderName), { recursive: true, force: true });
      }
      
      if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
      console.log('FFmpeg installed successfully to:', destDir);
      
    } catch (err) {
      console.error('Error extracting/installing:', err);
    }
  });
}).on('error', (err) => {
  fs.unlink(zipPath, () => {}); // Delete the file async. (But we don't check result)
  console.error('Error downloading:', err.message);
});
