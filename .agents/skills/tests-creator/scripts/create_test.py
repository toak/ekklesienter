import sys
import os
import argparse
import re

TEMPLATE_RENDERER = """import {{ describe, it, expect, vi }} from 'vitest';
{imports}

{mocks}

describe('{name}', () => {{
  it('should be defined', () => {{
    expect(true).toBe(true);
  }});
}});
"""

TEMPLATE_MAIN = """import {{ describe, it, expect, vi }} from 'vitest';

// Mock electron before imports
vi.mock('electron', () => ({{
  app: {{ getPath: vi.fn().mockReturnValue('/tmp'), isPackaged: false, on: vi.fn(), whenReady: vi.fn().mockResolvedValue(undefined) }},
  ipcMain: {{ handle: vi.fn(), on: vi.fn() }},
  BrowserWindow: vi.fn().mockImplementation(() => ({{ loadURL: vi.fn(), loadFile: vi.fn(), webContents: {{ send: vi.fn(), on: vi.fn() }}, on: vi.fn() }})),
  screen: {{ getAllDisplays: vi.fn().mockReturnValue([]), on: vi.fn() }},
  protocol: {{ registerSchemesAsPrivileged: vi.fn(), handle: vi.fn() }}
}}));

{imports}

{mocks}

describe('{name} (Main Process)', () => {{
  it('should initialize correctly', () => {{
    expect(true).toBe(true);
  }});
}});
"""

MOCK_RECIPES = {
    'framer-motion': "vi.mock('framer-motion', () => ({ motion: { div: ({ children, ...props }) => <div {...props}>{children}</div> }, AnimatePresence: ({ children }) => children }));",
    'zustand': "// Mock Zustand store if needed\nvi.mock('@/core/store/...');",
    '@supabase/supabase-js': "vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));",
    'electron_renderer': "vi.stubGlobal('electron', { ipcRenderer: { invoke: vi.fn(), on: vi.fn(), send: vi.fn() } });",
    '@telegram-apps/sdk': "vi.mock('@telegram-apps/sdk', () => ({ useLaunchParams: vi.fn() }));",
    'fs': "vi.mock('fs', () => ({ existsSync: vi.fn(), mkdirSync: vi.fn(), readdirSync: vi.fn(), copyFileSync: vi.fn(), promises: { readFile: vi.fn(), writeFile: vi.fn(), readdir: vi.fn(), unlink: vi.fn() } }));"
}

def detect_dependencies(content, is_main):
    deps = []
    content_lower = content.lower()
    
    if 'framer-motion' in content_lower or 'motion.' in content_lower:
        deps.append('framer-motion')
    if 'zustand' in content_lower or 'from \'zustand\'' in content_lower:
        deps.append('zustand')
    if 'supabase' in content_lower:
        deps.append('@supabase/supabase-js')
    if 'telegram-apps/sdk' in content_lower or 'tma' in content_lower:
        deps.append('@telegram-apps/sdk')
    
    if is_main:
        if 'fs' in content_lower or 'path' in content_lower:
            deps.append('fs')
    else:
        if 'electron' in content_lower:
            deps.append('electron_renderer')
            
    return deps

def create_test(file_path):
    if not os.path.exists(file_path):
        print(f"Error: File {file_path} not found.")
        return

    is_main = "electron/" in file_path.replace("\\", "/")
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            file_content = f.read()
    except Exception as e:
        print(f"Error reading file: {e}")
        return

    base_name = os.path.basename(file_path)
    name, ext = os.path.splitext(base_name)
    
    test_ext = ".test.tsx" if ext == ".tsx" else ".test.ts"
    test_file = os.path.join(os.path.dirname(file_path), name + test_ext)

    if os.path.exists(test_file):
        print(f"Error: Test file {test_file} already exists.")
        return

    imports = f"import {{ {name} }} from './{name}';" if not is_main else f"// import {{ {name} }} from './{name}'; // Adjust as needed for main process exports"
    
    deps = detect_dependencies(file_content, is_main)
    mocks_list = [MOCK_RECIPES[d] for d in deps if d in MOCK_RECIPES]
    mocks = "\n\n".join(mocks_list) if mocks_list else ""
    
    template = TEMPLATE_MAIN if is_main else TEMPLATE_RENDERER
    content = template.format(name=name, imports=imports, mocks=mocks)

    try:
        with open(test_file, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"✅ Created precision test file: {test_file}")
    except Exception as e:
        print(f"Error writing test file: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create a precision test boilerplate")
    parser.add_argument("file", help="Path to the file to create a test for")
    args = parser.parse_args()
    create_test(args.file)
