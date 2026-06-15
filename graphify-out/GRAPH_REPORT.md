# Graph Report - ekklesienter  (2026-05-17)

## Corpus Check
- 418 files · ~7,147,312 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1142 nodes · 1179 edges · 43 communities detected
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 60 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 77|Community 77]]

## God Nodes (most connected - your core abstractions)
1. `requireGetIntrinsic()` - 29 edges
2. `AudioService` - 25 edges
3. `requireSafer()` - 17 edges
4. `requireResponse()` - 16 edges
5. `requireSrc()` - 14 edges
6. `requireSend()` - 14 edges
7. `requireEncodings$1()` - 12 edges
8. `requireEncodings()` - 12 edges
9. `requireHttpErrors()` - 11 edges
10. `requireRead()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `ensureLayers()` --calls--> `async()`  [INFERRED]
  src/core/utils/styleMigration.ts → src/features/presenter/components/SlideDesignPanel.tsx
- `ensureLayers()` --calls--> `TimerFillPicker()`  [INFERRED]
  src/core/utils/styleMigration.ts → src/features/presenter/components/slide-properties/TimerFillPicker.tsx
- `useLogoUrl()` --calls--> `useControllerLogic()`  [INFERRED]
  src/core/hooks/useLogoUrl.ts → src/app/hooks/useControllerLogic.ts
- `useGlobalShortcuts()` --calls--> `useControllerLogic()`  [INFERRED]
  src/app/hooks/useGlobalShortcuts.ts → src/app/hooks/useControllerLogic.ts
- `useControllerLogic()` --calls--> `useAppInitialization()`  [INFERRED]
  src/app/hooks/useControllerLogic.ts → src/app/hooks/useAppInitialization.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.04
Nodes (110): require_eval(), require_isNaN(), requireAbs(), requireAccepts(), requireActualApply(), requireBomHandling(), requireBomHandling$1(), requireBufferUtil() (+102 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (55): requireApplication(), requireBodyParser(), requireBrowser(), requireBytes(), requireCommon(), requireContentDisposition(), requireContentType(), requireCookie() (+47 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (22): MultiVerseDisplay(), ParallelVerseDisplay(), VerseDisplay(), findTopics(), ScriptureDatabase, useTextFit(), getBookName(), cleanText() (+14 more)

### Community 3 - "Community 3"
Cohesion: 0.1
Nodes (23): applyBlendMode(), clamp01(), clipColor(), compositeOver(), cssToLinearRGBA(), findOcclusionCutoff(), getComputedColor(), hex2() (+15 more)

### Community 4 - "Community 4"
Cohesion: 0.12
Nodes (2): AudioService, generateWaveformPoints()

### Community 5 - "Community 5"
Cohesion: 0.13
Nodes (5): async(), ThumbnailService, TimerFillPicker(), ensureLayers(), migrateBackgroundToLayers()

### Community 6 - "Community 6"
Cohesion: 0.14
Nodes (3): getLocalResourceUrl(), togglePlayback(), LibraryImportService

### Community 7 - "Community 7"
Cohesion: 0.13
Nodes (7): handleBlur(), handleKeyDown(), handlePaste(), applyBlockStyle(), normalizeHtml(), stripInlineStyleProp(), sanitizePasteHtml()

### Community 8 - "Community 8"
Cohesion: 0.15
Nodes (8): fetchSystemFonts(), fetchStyles(), getBundledWeights(), getSystemFontData(), getSystemFonts(), needsFauxBold(), normalizeFontStyle(), fetchStyles()

### Community 9 - "Community 9"
Cohesion: 0.18
Nodes (7): collectMediaRefs(), extractPathFromLocalResource(), getMediaBlob(), patchMediaIds(), readLocalFileSafe(), sha256(), MediaPersistenceService

### Community 10 - "Community 10"
Cohesion: 0.15
Nodes (2): handleKeyDown(), PresentationService

### Community 11 - "Community 11"
Cohesion: 0.2
Nodes (1): RemoteServer

### Community 12 - "Community 12"
Cohesion: 0.31
Nodes (7): invoke(), on(), onAspectRatioChanged(), readDirectoryRecursive(), readFileData(), selectFile(), selectFolder()

### Community 13 - "Community 13"
Cohesion: 0.22
Nodes (3): ResizeHandle(), getCursorForCorner(), getRotateAngle()

### Community 14 - "Community 14"
Cohesion: 0.2
Nodes (5): useAppInitialization(), useAudioSync(), useControllerLogic(), useGlobalShortcuts(), useLogoUrl()

### Community 15 - "Community 15"
Cohesion: 0.39
Nodes (1): IpcService

### Community 16 - "Community 16"
Cohesion: 0.22
Nodes (1): RemoteServer

### Community 17 - "Community 17"
Cohesion: 0.22
Nodes (1): CanvasService

### Community 18 - "Community 18"
Cohesion: 0.33
Nodes (5): handleHueMove(), handleHuePointerDown(), handleSaturationMove(), handleSaturationPointerDown(), onMove()

### Community 19 - "Community 19"
Cohesion: 0.29
Nodes (2): handleFileSelect(), updateLayer()

### Community 21 - "Community 21"
Cohesion: 0.32
Nodes (4): useSlideTransitionManager(), getTransitionVariables(), normalizeTransitionDirection(), normalizeTransitionType()

### Community 23 - "Community 23"
Cohesion: 0.43
Nodes (5): fetchDisplays(), setPresenterDisplay(), setPreviewDisplay(), toggleAutoDefine(), updateDisplay()

### Community 27 - "Community 27"
Cohesion: 0.38
Nodes (3): handleFileSelect(), if(), updateLayer()

### Community 28 - "Community 28"
Cohesion: 0.33
Nodes (2): handleSelectChapter(), handleSelectTranslation()

### Community 29 - "Community 29"
Cohesion: 0.4
Nodes (1): MediaCache

### Community 30 - "Community 30"
Cohesion: 0.53
Nodes (1): WakeLockService

### Community 31 - "Community 31"
Cohesion: 0.53
Nodes (4): calculateStyleUpdates(), extractColorsFromHtml(), getStyleHash(), normalizeColor()

### Community 32 - "Community 32"
Cohesion: 0.33
Nodes (2): handleSelect(), findOverlappingScopes()

### Community 39 - "Community 39"
Cohesion: 0.33
Nodes (3): FloatingPopover(), createPortal(), ContextMenu()

### Community 42 - "Community 42"
Cohesion: 0.4
Nodes (1): MockResizeObserver

### Community 43 - "Community 43"
Cohesion: 0.5
Nodes (2): getBookSection(), getSectionColors()

### Community 44 - "Community 44"
Cohesion: 0.6
Nodes (1): FFmpegService

### Community 46 - "Community 46"
Cohesion: 0.5
Nodes (2): handleRotationChange(), onMove()

### Community 49 - "Community 49"
Cohesion: 0.5
Nodes (2): findLogo(), handleCommand()

### Community 53 - "Community 53"
Cohesion: 0.5
Nodes (2): handleAngleChange(), onMove()

### Community 56 - "Community 56"
Cohesion: 0.5
Nodes (2): useIntersection(), SlideTile()

### Community 60 - "Community 60"
Cohesion: 0.5
Nodes (2): useMetadata(), useSlideDisplayData()

### Community 61 - "Community 61"
Cohesion: 0.5
Nodes (2): App(), useWakeLock()

### Community 62 - "Community 62"
Cohesion: 0.5
Nodes (1): BibleNavigationService

### Community 63 - "Community 63"
Cohesion: 0.83
Nodes (3): handleCancel(), handleConfirm(), handleKeyDown()

### Community 64 - "Community 64"
Cohesion: 1.0
Nodes (2): main(), walk_source_files()

### Community 65 - "Community 65"
Cohesion: 0.67
Nodes (1): ZefaniaParser

### Community 77 - "Community 77"
Cohesion: 1.0
Nodes (2): handleFontSelect(), updateLabel()

## Knowledge Gaps
- **Thin community `Community 4`** (29 nodes): `AudioService`, `.clearPendingDelays()`, `.constructor()`, `.dispose()`, `.ensureContext()`, `.findActiveScope()`, `.getDuration()`, `.getFileId()`, `.getFileStats()`, `.getInstance()`, `.getPosition()`, `.getTrackProgress()`, `.getWaveform()`, `.isPlaying()`, `.loadAudio()`, `.pauseTrack()`, `.playScope()`, `.playTrack()`, `.resolveEffectiveUrl()`, `.resume()`, `.seekTrack()`, `.stopAll()`, `.stopScope()`, `.sync()`, `audioUtils.ts`, `AudioService.ts`, `dbToGain()`, `gainToDb()`, `generateWaveformPoints()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 10`** (14 nodes): `handleKeyDown()`, `handleMouseDown()`, `handleMouseEnter()`, `handleSave()`, `handleSelect()`, `up()`, `PresentationService`, `.closeProjector()`, `.navigateNext()`, `.navigatePrev()`, `.openGlobalModal()`, `.openProjector()`, `PresentationService.ts`, `VerseList.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 11`** (10 nodes): `RemoteServer`, `.broadcast()`, `.constructor()`, `.getLocalIp()`, `.setupExpress()`, `.setupIpcListeners()`, `.setupWebSocket()`, `.start()`, `.stop()`, `remote-server.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 15`** (9 nodes): `IpcService`, `.invoke()`, `.isElectron()`, `.on()`, `.onAspectRatioChanged()`, `.selectFile()`, `.selectFolder()`, `.send()`, `IpcService.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 16`** (9 nodes): `RemoteServer`, `.broadcast()`, `.constructor()`, `.getLocalIp()`, `.setupExpress()`, `.setupIpcListeners()`, `.setupWebSocket()`, `.start()`, `.stop()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 17`** (9 nodes): `CanvasService`, `.calculateCropResult()`, `.calculateDimensionScale()`, `.calculatePivotTransformation()`, `.calculateRadiusUpdates()`, `.clampCropOffset()`, `.getAlignmentUpdates()`, `.getSelectionState()`, `CanvasService.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 19`** (8 nodes): `addLayer()`, `handleFileSelect()`, `removeLayer()`, `reorderLayers()`, `searchPexels()`, `searchUnsplash()`, `updateLayer()`, `BackgroundPicker.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (7 nodes): `handleProjectSelected()`, `handleSelectBook()`, `handleSelectChapter()`, `handleSelectTranslation()`, `loadTranslations()`, `toggleVerse()`, `BibleBrowser.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (6 nodes): `mediaCache.ts`, `MediaCache`, `.clear()`, `.getBackgroundUrl()`, `.put()`, `.release()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (6 nodes): `WakeLockService`, `.handleVisibilityChange()`, `.setElectronWakeLock()`, `.setWakeLock()`, `.setWebWakeLock()`, `WakeLockService.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (6 nodes): `handleConfirm()`, `handleImport()`, `handleSelect()`, `AudioPickerModal.tsx`, `timelineUtils.ts`, `findOverlappingScopes()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (5 nodes): `MockResizeObserver`, `.disconnect()`, `.observe()`, `.unobserve()`, `useTextFit.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (5 nodes): `getBookName()`, `getBookOrder()`, `getBookSection()`, `getSectionColors()`, `bookData.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (5 nodes): `FFmpegService`, `.load()`, `.trimMedia()`, `.trimMediaById()`, `FFmpegService.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 46`** (5 nodes): `async()`, `handleRotationChange()`, `onMove()`, `onUp()`, `RotationDial.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 49`** (5 nodes): `findLogo()`, `handleCommand()`, `handleKeyDown()`, `reportRatio()`, `ProjectorView.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 53`** (5 nodes): `handleAngleChange()`, `onMove()`, `onUp()`, `swapColors()`, `GradientPicker.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 56`** (4 nodes): `useIntersection()`, `useIntersection.ts`, `SlideTile.tsx`, `SlideTile()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 60`** (4 nodes): `useMetadata()`, `useSlideDisplayData()`, `useMetadata.ts`, `useSlideDisplayData.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 61`** (4 nodes): `App()`, `useWakeLock()`, `App.tsx`, `useWakeLock.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 62`** (4 nodes): `BibleNavigationService`, `.getNextVerse()`, `.getPrevVerse()`, `BibleNavigationService.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 64`** (3 nodes): `main()`, `walk_source_files()`, `find_i18n_issues.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 65`** (3 nodes): `ZefaniaParser`, `.parse()`, `zefaniaParser.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 77`** (3 nodes): `handleFontSelect()`, `updateLabel()`, `TranslationLabelPicker.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `requireResponse()` connect `Community 1` to `Community 0`, `Community 15`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **Why does `RemoteServer` connect `Community 16` to `Community 0`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._