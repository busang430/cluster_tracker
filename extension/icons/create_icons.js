const fs = require('fs');
const { createCanvas, Image } = require('canvas');

const svgData = `
<svg width="1024" height="1024" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <!-- Solid background block for the icon to avoid pure transparent holes blending poorly in taskbars -->
  <path d="M 10 10 L 90 10 L 90 90 L 10 90 Z" fill="transparent" />

  <!-- Left Ear (Brown/Tan) -->
  <path d="M 25 35 Q 12 50 15 75 Q 25 85 30 65 Q 35 45 25 35 Z" fill="#D3C1B3" stroke="#333" stroke-width="2"/>
  
  <!-- Right Ear (Brown/Tan) -->
  <path d="M 75 35 Q 88 50 85 75 Q 75 85 70 65 Q 65 45 75 35 Z" fill="#D3C1B3" stroke="#333" stroke-width="2"/>
  
  <!-- Main Body/Head -->
  <path d="M 20 60 Q 30 15 50 15 Q 70 15 80 60 Q 85 90 50 90 Q 15 90 20 60 Z" fill="#D3C1B3" stroke="#333" stroke-width="2"/>
  
  <!-- White Belly / Bib Area -->
  <path d="M 35 55 Q 50 60 65 55 L 75 80 Q 50 95 25 80 Z" fill="#FFFFFF" stroke="#333" stroke-width="2"/>
  
  <!-- Left Arm/Paw -->
  <path d="M 25 55 Q 35 65 30 70 Q 20 70 25 55 Z" fill="#D3C1B3" stroke="#333" stroke-width="2"/>
  
  <!-- Right Arm/Paw -->
  <path d="M 75 55 Q 65 65 70 70 Q 80 70 75 55 Z" fill="#D3C1B3" stroke="#333" stroke-width="2"/>
  
  <!-- Eyes (Large Black with White Highlights) -->
  <ellipse cx="35" cy="32" rx="6" ry="7" fill="#000"/>
  <circle cx="33" cy="29" r="2.5" fill="#fff"/>
  <circle cx="37" cy="34" r="1.2" fill="#fff"/>
  
  <ellipse cx="65" cy="32" rx="6" ry="7" fill="#000"/>
  <circle cx="63" cy="29" r="2.5" fill="#fff"/>
  <circle cx="67" cy="34" r="1.2" fill="#fff"/>
  
  <!-- Nose and Mouth (Y-shape) -->
  <path d="M 45 32 Q 50 35 55 32 L 50 38 Z" fill="#E6A19A" stroke="#333" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M 50 38 L 50 42" stroke="#333" stroke-width="2" stroke-linecap="round"/>
  <path d="M 50 42 Q 43 45 38 41" stroke="#333" stroke-width="2" fill="none" stroke-linecap="round"/>
  <path d="M 50 42 Q 57 45 62 41" stroke="#333" stroke-width="2" fill="none" stroke-linecap="round"/>
  
  <!-- Little Chin Fluff -->
  <path d="M 46 48 Q 50 51 54 48" stroke="#333" stroke-width="1" fill="none" stroke-linecap="round"/>
</svg>`;

async function renderIcon(size) {
    return new Promise((resolve, reject) => {
        const canvas = createCanvas(size, size);
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
            ctx.drawImage(img, 0, 0, size, size);
            const buffer = canvas.toBuffer('image/png');
            fs.writeFileSync(\`icon\${size}.png\`, buffer);
            console.log(\`Generated icon\${size}.png\`);
            resolve();
        };
        img.onerror = reject;
        img.src = 'data:image/svg+xml;base64,' + Buffer.from(svgData).toString('base64');
    });
}

async function main() {
    try {
        await renderIcon(16);
        await renderIcon(48);
        await renderIcon(128);
        console.log("All icons generated!");
    } catch (err) {
        console.error("Error:", err);
    }
}

main();
