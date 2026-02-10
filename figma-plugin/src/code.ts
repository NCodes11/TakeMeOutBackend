async function loadJson(path: string) {
  const response = await fetch(path);
  return response.json();
}

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '');
  const bigint = parseInt(normalized, 16);
  return { r: ((bigint >> 16) & 255) / 255, g: ((bigint >> 8) & 255) / 255, b: (bigint & 255) / 255 };
}

async function run() {
  const tokens = await loadJson('../design/design-tokens.json');
  const componentsData = await loadJson('../design/components.json');
  const screensData = await loadJson('../design/screens.json');

  for (const c of componentsData.components) {
    const comp = figma.createComponent();
    comp.name = c.name;
    comp.resize(c.width, c.height);
    comp.fills = [{ type: 'SOLID', color: hexToRgb(tokens.colors.surface) }];
    const txt = figma.createText();
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
    txt.characters = c.text || c.placeholder || c.name;
    txt.x = 12;
    txt.y = 12;
    comp.appendChild(txt);
    figma.currentPage.appendChild(comp);
  }

  let xOffset = 0;
  for (const s of screensData.screens) {
    const frame = figma.createFrame();
    frame.name = s.name;
    frame.resize(s.width, s.height);
    frame.x = xOffset;
    frame.fills = [{ type: 'SOLID', color: hexToRgb(tokens.colors.background) }];
    xOffset += s.width + 60;

    let y = 20;
    for (const elementName of s.elements) {
      const node = figma.currentPage.findOne((n) => n.type === 'COMPONENT' && n.name === elementName);
      if (node && node.type === 'COMPONENT') {
        const instance = node.createInstance();
        instance.x = 20;
        instance.y = y;
        y += instance.height + 12;
        frame.appendChild(instance);
      }
    }
    figma.currentPage.appendChild(frame);
  }
  figma.closePlugin('DayDate screens generated/updated.');
}

run();
