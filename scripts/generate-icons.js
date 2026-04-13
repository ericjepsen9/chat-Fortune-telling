#!/usr/bin/env node
/**
 * 生成占位 App 图标（紫色渐变 + 星形）
 * 用法: node scripts/generate-icons.js
 * 输出: public/icons/icon-{180,192,512}.png
 *
 * 注意: 这是简化版占位图标。正式发布前建议用专业工具生成。
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const OUT_DIR = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const SIZES = [180, 192, 512];

function makeSVG(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#8B5CF6"/>
      <stop offset="100%" stop-color="#6366F1"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="url(#g)"/>
  <text x="50%" y="53%" font-family="'PingFang SC','Noto Serif SC',serif"
        font-size="${size * 0.45}" font-weight="700"
        fill="white" text-anchor="middle" dominant-baseline="middle">缘</text>
  <circle cx="${size * 0.78}" cy="${size * 0.22}" r="${size * 0.05}" fill="#FCD34D" opacity="0.9"/>
  <circle cx="${size * 0.22}" cy="${size * 0.78}" r="${size * 0.04}" fill="#F472B6" opacity="0.8"/>
</svg>`;
}

// Try to find a tool for SVG → PNG conversion
function detectConverter() {
  const tools = ['rsvg-convert', 'convert', 'inkscape'];
  for (const tool of tools) {
    try {
      execSync(`which ${tool}`, { stdio: 'ignore' });
      return tool;
    } catch {}
  }
  return null;
}

const converter = detectConverter();

for (const size of SIZES) {
  const svgPath = path.join(OUT_DIR, `icon-${size}.svg`);
  const pngPath = path.join(OUT_DIR, `icon-${size}.png`);
  fs.writeFileSync(svgPath, makeSVG(size));

  if (converter === 'rsvg-convert') {
    execSync(`rsvg-convert -o "${pngPath}" "${svgPath}"`);
  } else if (converter === 'convert') {
    execSync(`convert -background none "${svgPath}" "${pngPath}"`);
  } else if (converter === 'inkscape') {
    execSync(`inkscape "${svgPath}" --export-type=png --export-filename="${pngPath}"`);
  } else {
    console.log(`[!] 未找到 SVG→PNG 转换工具(rsvg-convert/ImageMagick/inkscape)`);
    console.log(`    SVG 已生成: ${svgPath}`);
    console.log(`    请手动转换为 ${pngPath} 或安装: sudo apt install librsvg2-bin`);
    continue;
  }
  console.log(`✓ ${pngPath}`);
}

console.log('\n完成。如需自定义图标，替换 public/icons/ 下的 PNG 文件即可。');
