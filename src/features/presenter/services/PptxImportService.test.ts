import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PptxImportService } from './PptxImportService';
import JSZip from 'jszip';

// Mock MediaPersistenceService
vi.mock('./MediaPersistenceService', () => ({
  MediaPersistenceService: {
    importMediaBatch: vi.fn().mockResolvedValue([]),
  },
}));

// Mock JSZip loadAsync
vi.mock('jszip', () => {
  const mockJSZip = vi.fn().mockImplementation(function (this: any) {
    return {
      file: vi.fn(),
      filter: vi.fn().mockReturnValue([]),
    };
  });
  (mockJSZip as any).loadAsync = vi.fn();
  return {
    default: mockJSZip,
  };
});

describe('PptxImportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should import a valid PPTX with custom namespace prefixes correctly', async () => {
    // We will simulate XML that uses "custom" prefixes instead of standard "p" / "a" / "r"
    // e.g. "pres:" for presentation, "draw:" for drawing, "rel:" for relationships
    const mockPresentationXml = `
      <pres:presentation xmlns:pres="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:rel="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <pres:sldSz cx="12192000" cy="6858000"/>
        <pres:sldIdLst>
          <pres:sldId id="256" rel:id="rId1"/>
        </pres:sldIdLst>
      </pres:presentation>
    `;

    const mockPresentationRelsXml = `
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
      </Relationships>
    `;

    const mockSlideXml = `
      <pres:sld xmlns:pres="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:draw="http://schemas.openxmlformats.org/drawingml/2006/main">
        <pres:cSld>
          <pres:spTree>
            <pres:sp>
              <pres:nvSpPr>
                <pres:cNvPr id="2" name="Title 1"/>
                <pres:cNvSpPr/>
                <pres:nvPr/>
              </pres:nvSpPr>
              <pres:spPr>
                <draw:xfrm>
                  <draw:off x="2000000" y="1000000"/>
                  <draw:ext cx="8000000" cy="4000000"/>
                </draw:xfrm>
              </pres:spPr>
              <pres:txBody>
                <draw:bodyPr anchor="t"/>
                <draw:p>
                  <draw:pPr algn="ctr"/>
                  <draw:r>
                    <draw:rPr sz="4400">
                      <draw:latin typeface="Arial"/>
                    </draw:rPr>
                    <draw:t>Hello World PPTX</draw:t>
                  </draw:r>
                </draw:p>
              </pres:txBody>
            </pres:sp>
          </pres:spTree>
        </pres:cSld>
      </pres:sld>
    `;

    const mockZip = {
      file: vi.fn().mockImplementation((path: string) => {
        if (path === 'ppt/presentation.xml') {
          return { async: vi.fn().mockResolvedValue(mockPresentationXml) };
        }
        if (path === 'ppt/_rels/presentation.xml.rels') {
          return { async: vi.fn().mockResolvedValue(mockPresentationRelsXml) };
        }
        if (path === 'ppt/slides/slide1.xml') {
          return { async: vi.fn().mockResolvedValue(mockSlideXml) };
        }
        return null;
      }),
      filter: vi.fn().mockReturnValue([]),
    };

    vi.mocked(JSZip.loadAsync).mockResolvedValue(mockZip as any);

    const file = new File(['fake-binary'], 'test.pptx', { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
    const result = await PptxImportService.convert(file);

    expect(result).toBeDefined();
    expect(result.name).toBe('test');
    expect(result.slides).toHaveLength(1);
    
    const slide = result.slides[0] as any;
    expect(slide.content.canvasItems).toHaveLength(1);
    
    const textItem = slide.content.canvasItems[0];
    expect(textItem.type).toBe('text');
    expect(textItem.text.content).toBe('Hello World PPTX');
    expect(textItem.text.fontFamily).toBe('Arial');
  });

  it('should extract text styling formatting properties and border outlines correctly', async () => {
    const mockPresentationXml = `
      <pres:presentation xmlns:pres="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:rel="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <pres:sldSz cx="12192000" cy="6858000"/>
        <pres:sldIdLst>
          <pres:sldId id="256" rel:id="rId1"/>
        </pres:sldIdLst>
      </pres:presentation>
    `;

    const mockPresentationRelsXml = `
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
      </Relationships>
    `;

    const mockSlideXml = `
      <pres:sld xmlns:pres="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:draw="http://schemas.openxmlformats.org/drawingml/2006/main">
        <pres:cSld>
          <pres:spTree>
            <pres:sp>
              <pres:nvSpPr>
                <pres:cNvPr id="2" name="Title 1"/>
                <pres:cNvSpPr/>
                <pres:nvPr/>
              </pres:nvSpPr>
              <pres:spPr>
                <draw:xfrm>
                  <draw:off x="2000000" y="1000000"/>
                  <draw:ext cx="8000000" cy="4000000"/>
                </draw:xfrm>
                <draw:ln w="12700">
                  <draw:solidFill>
                    <draw:srgbClr val="FF0000"/>
                  </draw:solidFill>
                </draw:ln>
              </pres:spPr>
              <pres:txBody>
                <draw:bodyPr anchor="t"/>
                <draw:p>
                  <draw:pPr algn="ctr"/>
                  <draw:r>
                    <draw:rPr sz="4400" b="1" i="1" u="sng" strike="sngStrike">
                      <draw:latin typeface="Georgia"/>
                      <draw:solidFill>
                        <draw:srgbClr val="0000FF"/>
                      </draw:solidFill>
                    </draw:rPr>
                    <draw:t>Hello Styled Text</draw:t>
                  </draw:r>
                </draw:p>
              </pres:txBody>
            </pres:sp>
          </pres:spTree>
        </pres:cSld>
      </pres:sld>
    `;

    const mockZip = {
      file: vi.fn().mockImplementation((path: string) => {
        if (path === 'ppt/presentation.xml') {
          return { async: vi.fn().mockResolvedValue(mockPresentationXml) };
        }
        if (path === 'ppt/_rels/presentation.xml.rels') {
          return { async: vi.fn().mockResolvedValue(mockPresentationRelsXml) };
        }
        if (path === 'ppt/slides/slide1.xml') {
          return { async: vi.fn().mockResolvedValue(mockSlideXml) };
        }
        return null;
      }),
      filter: vi.fn().mockReturnValue([]),
    };

    vi.mocked(JSZip.loadAsync).mockResolvedValue(mockZip as any);

    const file = new File(['fake-binary'], 'test.pptx', { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
    const result = await PptxImportService.convert(file);

    expect(result.slides).toHaveLength(1);
    const slide = result.slides[0] as any;
    expect(slide.content.canvasItems).toHaveLength(1);
    
    const textItem = slide.content.canvasItems[0];
    expect(textItem.type).toBe('text');
    expect(textItem.text.content).toBe('Hello Styled Text');
    expect(textItem.text.fontFamily).toBe('Georgia');
    expect(textItem.text.isBold).toBe(true);
    expect(textItem.text.isItalic).toBe(true);
    expect(textItem.text.isUnderline).toBe(true);
    expect(textItem.text.isStrikethrough).toBe(true);
    expect(textItem.text.color).toBe('#0000FF');
    
    // Border check
    expect(textItem.borderWidth).toBe(2); // 12700 EMU relative to slide height cy="6858000" and BASE_HEIGHT=1080 -> 12700 / 6858000 * 1080 = 2
    expect(textItem.borderColor).toBe('#FF0000');
  });

  it('should inherit placeholder dimensions (xfrm) from layout or master slide in processShape', async () => {
    const mockPresentationXml = `
      <pres:presentation xmlns:pres="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:rel="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <pres:sldSz cx="12192000" cy="6858000"/>
        <pres:sldIdLst>
          <pres:sldId id="256" rel:id="rId1"/>
        </pres:sldIdLst>
      </pres:presentation>
    `;

    const mockPresentationRelsXml = `
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
      </Relationships>
    `;

    // Slide rels point to slideLayout1.xml
    const mockSlideRelsXml = `
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rIdLayout" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
      </Relationships>
    `;

    // Slide has shape without xfrm but with ph (placeholder) type="title"
    const mockSlideXml = `
      <pres:sld xmlns:pres="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:draw="http://schemas.openxmlformats.org/drawingml/2006/main">
        <pres:cSld>
          <pres:spTree>
            <pres:sp>
              <pres:nvSpPr>
                <pres:cNvPr id="2" name="Title 1"/>
                <pres:cNvSpPr/>
                <pres:nvPr>
                  <pres:ph type="title"/>
                </pres:nvPr>
              </pres:nvSpPr>
              <pres:spPr/>
              <pres:txBody>
                <draw:bodyPr anchor="t"/>
                <draw:p>
                  <draw:r>
                    <draw:t>Inherited Title text</draw:t>
                  </draw:r>
                </draw:p>
              </pres:txBody>
            </pres:sp>
          </pres:spTree>
        </pres:cSld>
      </pres:sld>
    `;

    // Layout has a matching placeholder shape with xfrm defined
    const mockLayoutXml = `
      <pres:sldLayout xmlns:pres="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:draw="http://schemas.openxmlformats.org/drawingml/2006/main">
        <pres:cSld>
          <pres:spTree>
            <pres:sp>
              <pres:nvSpPr>
                <pres:cNvPr id="10" name="Title Placeholder"/>
                <pres:cNvSpPr/>
                <pres:nvPr>
                  <pres:ph type="title"/>
                </pres:nvPr>
              </pres:nvSpPr>
              <pres:spPr>
                <draw:xfrm>
                  <draw:off x="2000000" y="1000000"/>
                  <draw:ext cx="8000000" cy="4000000"/>
                </draw:xfrm>
              </pres:spPr>
            </pres:sp>
          </pres:spTree>
        </pres:cSld>
      </pres:sldLayout>
    `;

    const mockZip = {
      file: vi.fn().mockImplementation((path: string) => {
        if (path === 'ppt/presentation.xml') {
          return { async: vi.fn().mockResolvedValue(mockPresentationXml) };
        }
        if (path === 'ppt/_rels/presentation.xml.rels') {
          return { async: vi.fn().mockResolvedValue(mockPresentationRelsXml) };
        }
        if (path === 'ppt/slides/slide1.xml') {
          return { async: vi.fn().mockResolvedValue(mockSlideXml) };
        }
        if (path === 'ppt/slides/_rels/slide1.xml.rels') {
          return { async: vi.fn().mockResolvedValue(mockSlideRelsXml) };
        }
        if (path === 'ppt/slideLayouts/slideLayout1.xml') {
          return { async: vi.fn().mockResolvedValue(mockLayoutXml) };
        }
        return null;
      }),
      filter: vi.fn().mockReturnValue([]),
    };

    vi.mocked(JSZip.loadAsync).mockResolvedValue(mockZip as any);

    const file = new File(['fake-binary'], 'test.pptx', { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
    const result = await PptxImportService.convert(file);

    expect(result.slides).toHaveLength(1);
    const slide = result.slides[0] as any;
    expect(slide.content.canvasItems).toHaveLength(1);

    const textItem = slide.content.canvasItems[0];
    expect(textItem.type).toBe('text');
    expect(textItem.text.content).toBe('Inherited Title text');
    // Ensure layout dimensions were correctly inherited
    expect(textItem.width).toBeGreaterThan(0);
    expect(textItem.height).toBeGreaterThan(0);
  });
});

