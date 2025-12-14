const { JSDOM } = require('jsdom');

function hexToHSLObject(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { h: 0, s: 0, l: 0 };

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function applyThemeColorsSim(colors) {
  const root = document.documentElement;
  const primary = hexToHSLObject(colors.primary);
  const secondary = hexToHSLObject(colors.secondary);

  root.style.setProperty('--primary', `${primary.h} ${primary.s}% ${primary.l}%`);
  root.style.setProperty('--primary-foreground', primary.l > 50 ? '0 0% 0%' : '0 0% 100%');
  root.style.setProperty('--secondary', `${secondary.h} ${secondary.s}% ${secondary.l}%`);
  root.style.setProperty('--secondary-foreground', secondary.l > 50 ? '0 0% 0%' : '0 0% 100%');

  root.style.setProperty('--accent', `${primary.h} ${primary.s}% ${primary.l}%`);
  root.style.setProperty('--ring', `${primary.h} ${primary.s}% ${primary.l}%`);

  root.style.setProperty('--sidebar-primary', `${primary.h} ${primary.s}% ${primary.l}%`);
  root.style.setProperty('--sidebar-primary-foreground', primary.l > 50 ? '0 0% 0%' : '0 0% 100%');

  const sidebarAccentL = Math.min(primary.l + 35, 95);
  root.style.setProperty('--sidebar-accent', `${primary.h} ${primary.s}% ${sidebarAccentL}%`);
  root.style.setProperty('--sidebar-accent-foreground', sidebarAccentL > 50 ? '0 0% 0%' : '0 0% 100%');

  root.style.setProperty('--sidebar-border', `${primary.h} ${Math.min(primary.s, 20)}% ${Math.min(primary.l + 60, 97)}%`);
  root.style.setProperty('--sidebar-ring', `${primary.h} ${primary.s}% ${primary.l}%`);

  root.style.setProperty('--sidebar-accent-50', `hsl(${primary.h} ${primary.s}% ${primary.l}% / 0.5)`);
  root.style.setProperty('--accent-50', `hsl(${primary.h} ${primary.s}% ${primary.l}% / 0.5)`);
  root.style.setProperty('--sidebar-primary-50', `hsl(${primary.h} ${primary.s}% ${primary.l}% / 0.5)`);
}

// Run test
(function () {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;

  const sample = { primary: '#ff0000', secondary: '#00ff00' };
  applyThemeColorsSim(sample);

  const vars = ['--sidebar-primary','--sidebar-accent','--sidebar-accent-50','--accent-50','--sidebar-primary-50'];
  console.log('Checking theme vars after applying', sample);
  vars.forEach(v => console.log(v, '=>', document.documentElement.style.getPropertyValue(v)));
})();
