const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const componentsDir = path.join(srcDir, 'features', 'presenter', 'components');

const moves = [
  { file: 'PresentationLibrary.tsx', dir: 'library' },
  { file: 'GraceLibBin.tsx', dir: 'library' },
  { file: 'ServicePicker.tsx', dir: 'library' },
  { file: 'PresentationSelector.tsx', dir: 'library' },
  { file: 'PresentationSelector.test.tsx', dir: 'library' },

  { file: 'SlideCanvas.tsx', dir: 'slide-editor' },
  { file: 'CanvasItemView.tsx', dir: 'slide-editor' },
  { file: 'InlineTextEditor.tsx', dir: 'slide-editor' },
  { file: 'LogicalCanvas.tsx', dir: 'slide-editor' },
  { file: 'SlideContentRenderer.tsx', dir: 'slide-editor' },
  { file: 'VariableEditor.tsx', dir: 'slide-editor' },
  { file: 'RotationDial.tsx', dir: 'slide-editor' },

  { file: 'BackgroundPicker.tsx', dir: 'slide-properties' },
  { file: 'CustomizationPanel.tsx', dir: 'slide-properties' },
  { file: 'LayoutSettingsPicker.tsx', dir: 'slide-properties' },
  { file: 'ReferenceStylePicker.tsx', dir: 'slide-properties' },
  { file: 'TranslationLabelPicker.tsx', dir: 'slide-properties' },

  { file: 'FontLibrary.tsx', dir: 'fonts' },
  { file: 'FontPicker.tsx', dir: 'fonts' },
  { file: 'FontWeightPicker.tsx', dir: 'fonts' },
  { file: 'FontPrewarmer.tsx', dir: 'fonts' },

  { file: 'SlideDisplay.tsx', dir: 'display' },
  { file: 'ProjectorView.tsx', dir: 'display' },
  { file: 'ProjectorView.test.tsx', dir: 'display' },
  { file: 'SlideBackground.tsx', dir: 'display' },
  { file: 'TimerSlideRenderer.tsx', dir: 'display' },

  { file: 'VerseDisplay.tsx', dir: 'bible' },
  { file: 'MultiVerseDisplay.tsx', dir: 'bible' },
  { file: 'ParallelVerseDisplay.tsx', dir: 'bible' },

  { file: 'AudioConflictModal.tsx', dir: 'modals' },
  { file: 'AudioPickerModal.tsx', dir: 'modals' },
  { file: 'BibleSelectionModal.tsx', dir: 'modals' },
  { file: 'PresentationImportModal.tsx', dir: 'modals' },
  { file: 'SaveNestedConfirmModal.tsx', dir: 'modals' },
  { file: 'TemplatePickerModal.tsx', dir: 'modals' },

  { file: 'SlideTimeline.tsx', dir: 'timeline' },
  { file: 'SlideTimeline.test.tsx', dir: 'timeline' },
];

// First, make directories
const dirsToCreate = [...new Set(moves.map(m => m.dir)), 'media'];
for (const dir of dirsToCreate) {
  const targetDir = path.join(componentsDir, dir);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
}

// Rename slide-design to slide-properties and copy its contents
const slideDesignDir = path.join(componentsDir, 'slide-design');
const slidePropertiesDir = path.join(componentsDir, 'slide-properties');
if (fs.existsSync(slideDesignDir)) {
    const files = fs.readdirSync(slideDesignDir);
    for (const f of files) {
        fs.renameSync(path.join(slideDesignDir, f), path.join(slidePropertiesDir, f));
    }
    fs.rmdirSync(slideDesignDir);
}

// Rename media-pool to media and copy its contents
const mediaPoolDir = path.join(componentsDir, 'media-pool');
const mediaDir = path.join(componentsDir, 'media');
if (fs.existsSync(mediaPoolDir)) {
    const files = fs.readdirSync(mediaPoolDir);
    for (const f of files) {
        fs.renameSync(path.join(mediaPoolDir, f), path.join(mediaDir, f));
    }
    fs.rmdirSync(mediaPoolDir);
}

// Now move component files
for (const move of moves) {
  const oldPath = path.join(componentsDir, move.file);
  const newPath = path.join(componentsDir, move.dir, move.file);
  if (fs.existsSync(oldPath)) {
    fs.renameSync(oldPath, newPath);
  }
}

// Build map of filename without extension to new path
const componentMap = {}; // name -> new absolute import path
for (const move of moves) {
    const parsed = path.parse(move.file);
    if (parsed.ext === '.tsx' && !parsed.name.endsWith('.test')) {
        componentMap[parsed.name] = `@/features/presenter/components/${move.dir}/${parsed.name}`;
    }
}
// Add media/ and slide-properties/ files mapped as well
if (fs.existsSync(mediaDir)) {
    const files = fs.readdirSync(mediaDir);
    for (const f of files) {
        const parsed = path.parse(f);
        if (parsed.ext === '.tsx' || parsed.ext === '.ts') {
             componentMap[parsed.name] = `@/features/presenter/components/media/${parsed.name}`;
        }
    }
}
if (fs.existsSync(slidePropertiesDir)) {
    const files = fs.readdirSync(slidePropertiesDir);
    for (const f of files) {
        const parsed = path.parse(f);
         if (parsed.ext === '.tsx' || parsed.ext === '.ts') {
             if (parsed.name !== 'index') {
                 componentMap[parsed.name] = `@/features/presenter/components/slide-properties/${parsed.name}`;
             }
         }
    }
}

// Recursively find all TS/TSX files
function getFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getFiles(fullPath, files);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }
  return files;
}

const allFiles = getFiles(srcDir);

console.log('Processing files to update component imports:');
for (const file of allFiles) {
  let content = fs.readFileSync(file, 'utf-8');
  let originalContent = content;

  // Regex replacement: replace relative/absolute imports to any of our moved components
  for (const [compName, newImportPath] of Object.entries(componentMap)) {
      // Regex detects standard ES6 imports that end with the component name 
      // i.e., import XYZ from '...' where the path ends with compName
      // Needs to handle double and single quotes. Let's match from (['"])(.*?\/)?CompName\1
      const regexStr = "from\\s+(['\"])(?:[^'\"]*?/|\\.\\/|\\.\\.\\/)?" + compName + "\\1";
      const regex = new RegExp(regexStr, 'g');
      content = content.replace(regex, `from '${newImportPath}'`);
      
      // Also catch dynamic imports: import('...')
      const dynRegexStr = "import\\s*\\(\\s*(['\"])(?:[^'\"]*?/|\\.\\/|\\.\\.\\/)?" + compName + "\\1\\s*\\)";
      const dynRegex = new RegExp(dynRegexStr, 'g');
      content = content.replace(dynRegex, `import('${newImportPath}')`);
  }

  // Also replace `slide-design` -> `slide-properties` and `media-pool` -> `media` in paths that map directories
  content = content.replace(/@\/features\/presenter\/components\/slide-design\//g, '@/features/presenter/components/slide-properties/');
  content = content.replace(/@\/features\/presenter\/components\/media-pool\//g, '@/features/presenter/components/media/');
  content = content.replace(/\.\.?\/slide-design\//g, '@/features/presenter/components/slide-properties/');
  content = content.replace(/\.\.?\/media-pool\//g, '@/features/presenter/components/media/');
  content = content.replace(/\.\.?\/components\/slide-design\//g, '@/features/presenter/components/slide-properties/');
  content = content.replace(/\.\.?\/components\/media-pool\//g, '@/features/presenter/components/media/');

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf-8');
  }
}

console.log('Done moving files and updating imports!');
