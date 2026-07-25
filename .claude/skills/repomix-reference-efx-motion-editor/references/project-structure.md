# Directory Structure

```
.agents/
  skills/
    ask-matt/
      SKILL.md (61 lines)
    codebase-design/
      DEEPENING.md (37 lines)
      DESIGN-IT-TWICE.md (44 lines)
      SKILL.md (114 lines)
    decision-mapping/
      SKILL.md (103 lines)
    design-an-interface/
      SKILL.md (94 lines)
    diagnosing-bugs/
      scripts/
        hitl-loop.template.sh (17 lines)
      SKILL.md (134 lines)
    domain-modeling/
      ADR-FORMAT.md (47 lines)
      CONTEXT-FORMAT.md (60 lines)
      SKILL.md (74 lines)
    edit-article/
      SKILL.md (15 lines)
    git-guardrails-claude-code/
      scripts/
        block-dangerous-git.sh (20 lines)
      SKILL.md (95 lines)
    grill-me/
      SKILL.md (7 lines)
    grill-with-docs/
      SKILL.md (7 lines)
    grilling/
      SKILL.md (10 lines)
    handoff/
      SKILL.md (16 lines)
    implement/
      SKILL.md (15 lines)
    improve-codebase-architecture/
      HTML-REPORT.md (123 lines)
      SKILL.md (66 lines)
    loop-me/
      SKILL.md (32 lines)
    migrate-to-shoehorn/
      SKILL.md (118 lines)
    obsidian-vault/
      SKILL.md (59 lines)
    prototype/
      LOGIC.md (79 lines)
      SKILL.md (30 lines)
      UI.md (112 lines)
    qa/
      SKILL.md (130 lines)
    repomix-explorer/
      SKILL.md (301 lines)
    repomix-reference-efx-motion-editor/
      references/
        files.md (8523 lines)
        project-structure.md (257 lines)
        summary.md (72 lines)
        tech-stacks.md (105 lines)
      SKILL.md (79 lines)
    request-refactor-plan/
      SKILL.md (68 lines)
    resolving-merge-conflicts/
      SKILL.md (14 lines)
    review/
      SKILL.md (89 lines)
    scaffold-exercises/
      SKILL.md (106 lines)
    setup-matt-pocock-skills/
      domain.md (51 lines)
      issue-tracker-github.md (34 lines)
      issue-tracker-gitlab.md (35 lines)
      issue-tracker-local.md (19 lines)
      SKILL.md (127 lines)
      triage-labels.md (15 lines)
    setup-pre-commit/
      SKILL.md (91 lines)
    tdd/
      mocking.md (59 lines)
      refactoring.md (10 lines)
      SKILL.md (111 lines)
      tests.md (77 lines)
    teach/
      GLOSSARY-FORMAT.md (35 lines)
      LEARNING-RECORD-FORMAT.md (46 lines)
      MISSION-FORMAT.md (31 lines)
      RESOURCES-FORMAT.md (32 lines)
      SKILL.md (140 lines)
    to-issues/
      SKILL.md (84 lines)
    to-prd/
      SKILL.md (75 lines)
    triage/
      AGENT-BRIEF.md (207 lines)
      OUT-OF-SCOPE.md (105 lines)
      SKILL.md (112 lines)
    ubiquitous-language/
      SKILL.md (93 lines)
    wizard/
      SKILL.md (45 lines)
      template.sh (154 lines)
    writing-beats/
      SKILL.md (67 lines)
    writing-fragments/
      SKILL.md (79 lines)
    writing-great-skills/
      GLOSSARY.md (195 lines)
      SKILL.md (82 lines)
    writing-shape/
      SKILL.md (79 lines)
.efx-planning/
  decision-maps/
    physics-paint-strategy-decision-map.md (210 lines)
  docs/
    matt-skills-workflow.md (262 lines)
  handoffs/
    resume-physics-paint-strategy.md (111 lines)
  research/
    krita-license-assets.md (74 lines)
    krita-roundtrip.md (140 lines)
    onion-skinning-contract.md (91 lines)
    roto-data-contract.md (287 lines)
app/
  src/
    components/
      canvas/
        coordinateMapper.ts (57 lines)
        hitTest.ts (51 lines)
        MotionPath.tsx (172 lines)
        motionPathHitTest.ts (24 lines)
        OnionSkinOverlay.tsx (75 lines)
        PaintCursor.tsx (29 lines)
        PaintOverlay.tsx (2017 lines)
        transformHandles.ts (221 lines)
        TransformOverlay.tsx (601 lines)
      export/
        ExportPreview.tsx (114 lines)
        ExportProgress.tsx (95 lines)
        FormatSelector.tsx (281 lines)
      import/
        DropZone.tsx (17 lines)
        ImportGrid.tsx (328 lines)
        UsageBadge.tsx (51 lines)
        UsagePopover.tsx (111 lines)
      layer/
        AddLayerMenu.tsx (106 lines)
        LayerList.tsx (163 lines)
      layout/
        CanvasArea.tsx (394 lines)
        EditorShell.tsx (88 lines)
        LeftPanel.tsx (297 lines)
        ThemeSwitcher.tsx (30 lines)
        TimelinePanel.tsx (214 lines)
        TitleBar.tsx (15 lines)
        Toolbar.tsx (243 lines)
      overlay/
        FullscreenOverlay.tsx (152 lines)
        FullSpeedBadge.tsx (10 lines)
        PaintToolbar.tsx (198 lines)
        ShortcutsOverlay.tsx (254 lines)
        SpeedBadge.tsx (19 lines)
      physic-paint/
        bridge/
          physicsPaintBridgeTransport.ts (102 lines)
          physicsPaintLaunchContext.ts (99 lines)
          physicsPaintSessionFile.ts (135 lines)
          usePhysicsPaintParentBridge.ts (180 lines)
        engine/
          PhysicsPaintCanvasMount.tsx (67 lines)
          physicsPaintCanvasSizing.ts (42 lines)
          physicsPaintDevExport.ts (142 lines)
          physicsPaintStudioSettings.ts (58 lines)
          usePhysicsPaintEngineActions.ts (113 lines)
          usePhysicsPaintEngineLifecycle.ts (70 lines)
        hooks/
          usePhysicsPaintApplyResultController.ts (160 lines)
          usePhysicsPaintLaunchIntegration.ts (154 lines)
          usePhysicsPaintSessionController.ts (143 lines)
          usePhysicsPaintStudioKeyboard.ts (18 lines)
          usePhysicsPaintStudioViewModel.ts (8 lines)
          usePhysicsPaintWorkflowIntegration.ts (8 lines)
          useRotoBackgroundMetadataSync.ts (20 lines)
          useRotoCachedPlayback.ts (147 lines)
          useRotoEditBufferController.ts (77 lines)
          useRotoFrameEditingController.ts (173 lines)
          useRotoFramePersistenceCoordinator.ts (283 lines)
          useRotoInterpolationController.ts (68 lines)
          useRotoKeyUtilities.ts (214 lines)
          useRotoNavigationCoordinator.ts (90 lines)
          useRotoPersistenceIntegration.ts (145 lines)
          useRotoPhysicalEditCoordinator.ts (1021 lines)
          useRotoPhysicalEditHistory.ts (371 lines)
          useRotoPlaybackSettingsController.ts (199 lines)
          useRotoPlayScriptController.ts (158 lines)
          useRotoReferenceController.ts (155 lines)
          useRotoScriptClipboardController.ts (25 lines)
          useRotoScriptLibraryController.ts (101 lines)
          useRotoTimelineActions.ts (504 lines)
          useRotoTimelineModel.ts (68 lines)
        performance/
          physicsPaintPerformanceTrace.ts (113 lines)
        roto/
          physicsPaintRotoAlphaMerge.ts (42 lines)
          physicsPaintRotoKeyController.ts (602 lines)
          physicsPaintRotoPhysicalModel.ts (391 lines)
          physicsPaintRotoPhysicalResolver.ts (1237 lines)
          physicsPaintRotoPlayScriptController.ts (317 lines)
          physicsPaintRotoPlayScriptRenderer.ts (129 lines)
          physicsPaintRotoScriptClipboard.ts (825 lines)
          physicsPaintRotoScriptLibrary.ts (266 lines)
          physicsPaintRotoScriptThumbnail.ts (99 lines)
          physicsPaintRotoSession.ts (224 lines)
          physicsPaintRotoWorkflow.ts (335 lines)
          rotoCacheTransactions.ts (78 lines)
          rotoCanvasFrames.ts (169 lines)
          rotoCoordinatorPorts.ts (172 lines)
          rotoEditBufferTransactions.ts (96 lines)
          rotoLaunchHydration.ts (97 lines)
          rotoLivePixelCacheTransactions.ts (117 lines)
          rotoNavigationActions.ts (29 lines)
          rotoOnionPreview.ts (117 lines)
          rotoPhysicalOwnership.ts (139 lines)
          rotoPhysicalTimelinePorts.ts (65 lines)
          rotoSaveTransactions.ts (124 lines)
          rotoTimelineSelectors.ts (226 lines)
        view/
          PhysicsPaintPlayScriptDialog.tsx (83 lines)
          PhysicsPaintRightPanel.tsx (604 lines)
          PhysicsPaintScriptsPanel.tsx (122 lines)
          physicsPaintStudioKeyboard.ts (131 lines)
          physicsPaintStudioSelectors.ts (27 lines)
          PhysicsPaintStudioToolbar.tsx (340 lines)
          PhysicsPaintStudioView.tsx (172 lines)
          PhysicsPaintToolRail.tsx (142 lines)
          PhysicsPaintTopBar.tsx (168 lines)
          physicsPaintWorkflowPresentation.ts (359 lines)
          PhysicsPaintWorkflowStrip.tsx (899 lines)
        physicsPaintStudio.css (2224 lines)
        PhysicsPaintStudio.tsx (1042 lines)
      project/
        NewProjectDialog.tsx (168 lines)
        WelcomeScreen.tsx (350 lines)
      sequence/
        KeyPhotoStrip.tsx (464 lines)
        SequenceList.tsx (414 lines)
      shader-browser/
        ShaderBrowser.tsx (586 lines)
      shared/
        ColorPickerModal.tsx (549 lines)
        GradientBar.tsx (172 lines)
        NumericInput.tsx (120 lines)
        SectionLabel.tsx (7 lines)
      sidebar/
        AudioProperties.tsx (353 lines)
        CollapseHandle.tsx (65 lines)
        CollapsibleSection.tsx (47 lines)
        InlineColorPicker.tsx (470 lines)
        InlineInterpolation.tsx (50 lines)
        KeyframeNavBar.tsx (114 lines)
        PaintModeSelector.tsx (257 lines)
        PaintProperties.tsx (1112 lines)
        PanelResizer.tsx (35 lines)
        PhysicPaintProperties.tsx (209 lines)
        SidebarFxProperties.tsx (802 lines)
        SidebarProperties.tsx (264 lines)
        SidebarResizer.tsx (32 lines)
        SidebarScrollArea.tsx (149 lines)
        StrokeList.tsx (236 lines)
        TransitionProperties.tsx (287 lines)
      timeline/
        AddAudioButton.tsx (17 lines)
        AddFxMenu.tsx (252 lines)
        AddTransitionMenu.tsx (112 lines)
        ThumbnailCache.ts (27 lines)
        TimelineCanvas.tsx (121 lines)
        TimelineInteraction.ts (1018 lines)
        TimelineRenderer.ts (1203 lines)
        TimelineScrollbar.tsx (96 lines)
      views/
        ExportView.tsx (48 lines)
        ImportedView.tsx (449 lines)
        SettingsView.tsx (75 lines)
      AssetProtocolTest.tsx (68 lines)
      Preview.tsx (78 lines)
    lib/
      appConfig.ts (94 lines)
      assetRemoval.ts (163 lines)
      assetUsage.ts (113 lines)
      audioEngine.ts (179 lines)
      audioExportMixer.ts (97 lines)
      audioPeaksCache.ts (10 lines)
      audioWaveform.ts (45 lines)
      autoSave.ts (52 lines)
      beatMarkerEngine.ts (75 lines)
      bezierPath.ts (380 lines)
      bpmDetector.ts (76 lines)
      brushP5Adapter.ts (278 lines)
      brushPreviewData.ts (15 lines)
      colorUtils.ts (97 lines)
      dragDrop.ts (50 lines)
      exportEngine.ts (316 lines)
      exportRenderer.ts (373 lines)
      exportSidecar.ts (78 lines)
      frameMap.ts (248 lines)
      fullscreenManager.ts (21 lines)
      fxBlur.ts (26 lines)
      fxColorGrade.ts (115 lines)
      fxGenerators.ts (124 lines)
      fxPresets.ts (11 lines)
      glBlur.ts (278 lines)
      glMotionBlur.ts (269 lines)
      glslRuntime.ts (416 lines)
      history.ts (65 lines)
      ipc.ts (174 lines)
      jklShuttle.ts (107 lines)
      keyframeEngine.ts (139 lines)
      keyframeNav.ts (26 lines)
      keyPhotoNav.ts (8 lines)
      layerSelection.ts (4 lines)
      motionBlurEngine.ts (44 lines)
      paintFloodFill.ts (58 lines)
      paintPersistence.ts (117 lines)
      paintPreferences.ts (41 lines)
      paintRenderer.ts (214 lines)
      panelResize.ts (108 lines)
      physicPaintBridge.ts (1124 lines)
      physicPaintPersistence.ts (287 lines)
      playbackEngine.ts (270 lines)
      previewBridge.ts (2 lines)
      previewRenderer.ts (985 lines)
      projectDir.ts (8 lines)
      projectPaperRaster.ts (106 lines)
      rotoFrameDraw.ts (135 lines)
      sequenceNav.ts (17 lines)
      shaderLibrary.ts (112 lines)
      shaderPreviewCapture.ts (17 lines)
      shortcuts.ts (492 lines)
      strokeAnimation.ts (49 lines)
      themeManager.ts (35 lines)
      transitionEngine.ts (52 lines)
      unsavedGuard.ts (35 lines)
    scenes/
      previewScene.meta (3 lines)
      previewScene.tsx (11 lines)
      testScene.meta (5 lines)
      testScene.tsx (17 lines)
    stores/
      audioStore.ts (266 lines)
      blurStore.ts (14 lines)
      canvasStore.ts (120 lines)
      exportStore.ts (112 lines)
      historyStore.ts (8 lines)
      imageStore.ts (171 lines)
      isolationStore.ts (45 lines)
      keyframeStore.ts (236 lines)
      layerStore.ts (48 lines)
      motionBlurStore.ts (33 lines)
      paintStore.ts (684 lines)
      physicPaintStore.ts (1282 lines)
      projectStore.ts (732 lines)
      sequenceStore.ts (924 lines)
      soloStore.ts (12 lines)
      timelineFrameSignal.ts (2 lines)
      timelineStore.ts (147 lines)
      uiStore.ts (180 lines)
    types/
      audio.ts (61 lines)
      audiobuffer-to-wav.d.ts (3 lines)
      bezier-js.d.ts (28 lines)
      export.ts (29 lines)
      fit-curve.d.ts (6 lines)
      history.ts (7 lines)
      image.ts (23 lines)
      layer.ts (155 lines)
      motion-canvas.d.ts (22 lines)
      p5brush.d.ts (110 lines)
      paint.ts (106 lines)
      physicPaint.ts (858 lines)
      project.ts (208 lines)
      sequence.ts (74 lines)
      timeline.ts (82 lines)
      ui.ts (8 lines)
    app.tsx (8 lines)
    index.css (290 lines)
    main.tsx (63 lines)
    project.meta (32 lines)
    project.ts (5 lines)
    vite-env.d.ts (29 lines)
  src-tauri/
    capabilities/
      default.json (35 lines)
      physics-paint.json (14 lines)
    src/
      commands/
        config.rs (149 lines)
        export.rs (111 lines)
        image.rs (56 lines)
        mod.rs (5 lines)
        project.rs (102 lines)
        script_library.rs (112 lines)
      models/
        image.rs (28 lines)
        mod.rs (3 lines)
        project.rs (288 lines)
        sequence.rs (0 lines)
      services/
        ffmpeg.rs (169 lines)
        image_pool.rs (169 lines)
        mod.rs (6 lines)
        project_io.rs (500 lines)
        script_library.rs (418 lines)
        tablet.rs (59 lines)
      lib.rs (532 lines)
      main.rs (4 lines)
      script_library_test_support.rs (68 lines)
    tests/
      script_library_filesystem.rs (53 lines)
      script_library_lifecycle.rs (47 lines)
      script_library_schema.rs (71 lines)
    build.rs (3 lines)
    Cargo.toml (45 lines)
    tauri.conf.json (35 lines)
  CLAUDE.md (0 lines)
  index.html (12 lines)
  package.json (50 lines)
  tsconfig.json (20 lines)
  vite.config.ts (73 lines)
  vitest.config.ts (10 lines)
packages/
  efx-physic-paint/
    demo/
      src/
        App.tsx (408 lines)
        main.tsx (16 lines)
        styles.css (355 lines)
        Toolbar.tsx (352 lines)
      index.html (12 lines)
      vite.config.ts (13 lines)
    src/
      animation/
        AnimationPlayer.ts (91 lines)
        index.ts (5 lines)
        progressiveStrokeSchedule.ts (140 lines)
        recordedStrokeMotion.ts (80 lines)
        types.ts (30 lines)
      brush/
        erase.ts (99 lines)
        paint.ts (545 lines)
        stroke.ts (92 lines)
      core/
        diffusion.ts (39 lines)
        drying.ts (139 lines)
        fluids.ts (486 lines)
        paper.ts (88 lines)
        wet-layer.ts (352 lines)
      engine/
        EfxPaintEngine.ts (1668 lines)
      render/
        canvas.ts (176 lines)
        compositor.ts (49 lines)
      util/
        color.ts (108 lines)
        math.ts (74 lines)
        noise.ts (40 lines)
      index.ts (15 lines)
      preact.tsx (82 lines)
      types.ts (159 lines)
    package.json (69 lines)
    README.md (129 lines)
    tsconfig.build.json (9 lines)
    tsconfig.json (16 lines)
    tsup.config.ts (15 lines)
.gitignore (41 lines)
AGENTS.md (72 lines)
CLAUDE.md (139 lines)
package.json (31 lines)
pnpm-workspace.yaml (3 lines)
README.md (305 lines)
repomix.config.json (64 lines)
skills-lock.json (227 lines)
```