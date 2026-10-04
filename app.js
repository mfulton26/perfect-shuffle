const STORAGE_KEY = 'perfect_shuffle_preferences_v1';

const DEFAULT_PREFERENCES = {
  mode: 'clock',
  deckPreset: '52',
  deckSize: 52,
  dealMode: 'counted',
  speechRate: 1.25,
  pacerInterval: 1.6,
  autoPacing: false,
  voiceEnabled: true,
  selectedVoiceURI: '',
  speakCenter: true,
  speakOclock: false,
  soundFxEnabled: true,
  wakeLockEnabled: true
};

class PerfectShuffleApp {
  constructor() {
    // Core Configuration (initialized from defaults, then loaded from localStorage)
    this.mode = DEFAULT_PREFERENCES.mode;
    this.deckSize = DEFAULT_PREFERENCES.deckSize;
    this.dealMode = DEFAULT_PREFERENCES.dealMode;
    this.speechRate = DEFAULT_PREFERENCES.speechRate;
    this.voiceEnabled = DEFAULT_PREFERENCES.voiceEnabled;
    this.soundFxEnabled = DEFAULT_PREFERENCES.soundFxEnabled;
    this.speakCenter = DEFAULT_PREFERENCES.speakCenter;
    this.speakOclock = DEFAULT_PREFERENCES.speakOclock;
    this.wakeLockEnabled = DEFAULT_PREFERENCES.wakeLockEnabled;
    this.selectedVoiceURI = DEFAULT_PREFERENCES.selectedVoiceURI;
    
    // Auto-Pacer
    this.autoPacing = DEFAULT_PREFERENCES.autoPacing;
    this.pacerInterval = DEFAULT_PREFERENCES.pacerInterval;
    this.pacerTimer = null;

    // Shuffle Engine State
    this.pickSequence = [];     // Array of zone IDs in randomized order
    this.currentIndex = -1;     // -1 = not started
    this.initialPiles = {};     // zone -> initial count
    this.currentPiles = {};     // zone -> current remaining count
    this.startTime = null;
    this.endTime = null;
    this.timerInterval = null;

    // Audio & Speech
    this.audioCtx = null;
    this.selectedVoice = null;
    this.availableVoices = [];

    // Wake Lock
    this.wakeLockSentinel = null;

    // Cache DOM Elements
    this.dom = {
      // Header
      btnModeClock: document.getElementById('btn-mode-clock'),
      btnModeGrid: document.getElementById('btn-mode-grid'),
      btnToggleVoice: document.getElementById('btn-toggle-voice'),
      iconVoiceOn: document.querySelector('.icon-voice-on'),
      iconVoiceOff: document.querySelector('.icon-voice-off'),
      btnHelp: document.getElementById('btn-help'),
      btnSettings: document.getElementById('btn-settings'),

      // Boards
      layoutViewport: document.getElementById('layout-viewport'),
      clockBoard: document.getElementById('clock-board'),
      gridBoard: document.getElementById('grid-board'),
      tapFeedback: document.getElementById('tap-feedback'),

      // Callout & Stats
      calloutCard: document.getElementById('callout-card'),
      calloutStatusBadge: document.getElementById('callout-status-badge'),
      calloutInstruction: document.getElementById('callout-instruction'),
      calloutTarget: document.getElementById('callout-target'),
      calloutPileInfo: document.getElementById('callout-pile-info'),
      statCardCount: document.getElementById('stat-card-count'),
      statCardsRemaining: document.getElementById('stat-cards-remaining'),
      statPercent: document.getElementById('stat-percent'),
      progressFill: document.getElementById('progress-fill'),

      // Bottom Controls
      btnUndo: document.getElementById('btn-undo'),
      btnPrimaryAction: document.getElementById('btn-primary-action'),
      primaryBtnLabel: document.getElementById('primary-btn-label'),
      primaryBtnSubtext: document.getElementById('primary-btn-subtext'),
      btnToggleAuto: document.getElementById('btn-toggle-auto'),
      autoBtnLabel: document.getElementById('auto-btn-label'),
      iconAutoPlay: document.getElementById('icon-auto-play'),
      iconAutoPause: document.getElementById('icon-auto-pause'),
      btnReset: document.getElementById('btn-reset'),

      // Modals
      modalHelp: document.getElementById('modal-help'),
      modalSettings: document.getElementById('modal-settings'),
      modalComplete: document.getElementById('modal-complete'),
      settingDeckPreset: document.getElementById('setting-deck-preset'),
      customDeckGroup: document.getElementById('custom-deck-group'),
      settingCustomDeck: document.getElementById('setting-custom-deck'),
      settingVoiceSelect: document.getElementById('setting-voice-select'),
      settingSpeechRate: document.getElementById('setting-speech-rate'),
      speechRateLabel: document.getElementById('speech-rate-label'),
      settingPacerInterval: document.getElementById('setting-pacer-interval'),
      pacerIntervalLabel: document.getElementById('pacer-interval-label'),
      settingSpeakCenter: document.getElementById('setting-speak-center'),
      settingSpeakOclock: document.getElementById('setting-speak-oclock'),
      settingSoundFx: document.getElementById('setting-sound-fx'),
      settingWakeLock: document.getElementById('setting-wake-lock'),
      settingDealMode: document.getElementById('setting-deal-mode'),
      casualActions: document.getElementById('casual-actions'),
      btnSkipSpot: document.getElementById('btn-skip-spot'),
      btnFinishCasual: document.getElementById('btn-finish-casual'),
      hintReroll: document.getElementById('hint-reroll'),
      btnRestoreDefaults: document.getElementById('btn-restore-defaults'),
      btnTestVoice: document.getElementById('btn-test-voice'),
      btnShuffleAgain: document.getElementById('btn-shuffle-again'),
      completeCardCount: document.getElementById('complete-card-count'),
      completeTime: document.getElementById('complete-time')
    };

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadPreferences();
    this.initVoices();
    this.initPiles();
    this.updateBoardDisplay();
    this.registerServiceWorker();
    if (this.wakeLockEnabled) {
      this.requestWakeLock();
    }
  }

  /* ========================================================================
     Event Handlers
     ======================================================================== */
  setupEventListeners() {
    // Mode Switchers
    this.dom.btnModeClock.addEventListener('click', () => this.switchMode('clock'));
    this.dom.btnModeGrid.addEventListener('click', () => this.switchMode('grid'));

    // Audio & Settings
    this.dom.btnToggleVoice.addEventListener('click', () => this.toggleVoice());
    this.dom.btnHelp.addEventListener('click', () => this.openModal(this.dom.modalHelp));
    this.dom.btnSettings.addEventListener('click', () => this.openModal(this.dom.modalSettings));

    // Test Voice Preview
    if (this.dom.btnTestVoice) {
      this.dom.btnTestVoice.addEventListener('click', (e) => {
        e.stopPropagation();
        this.speak("Testing voice synthesis: Seven, Center, Twelve.");
      });
    }

    // Close Modals (Button and Backdrop click)
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modalId = e.currentTarget.getAttribute('data-close');
        const modal = document.getElementById(modalId);
        if (modal) this.closeModal(modal);
      });
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          this.closeModal(overlay);
        }
      });
    });

    // Tap Anywhere in Layout Viewport to Advance
    this.dom.layoutViewport.addEventListener('click', (e) => {
      this.triggerTapAnimation(e);
      this.handlePrimaryAction();
    });

    // Primary Action Button (Next / Start)
    this.dom.btnPrimaryAction.addEventListener('click', (e) => {
      e.stopPropagation();
      this.handlePrimaryAction();
    });

    // Undo & Reset
    this.dom.btnUndo.addEventListener('click', (e) => {
      e.stopPropagation();
      this.undoPick();
    });

    this.dom.btnReset.addEventListener('click', (e) => {
      e.stopPropagation();
      this.resetShuffle();
    });

    // Auto Pacer Toggle
    this.dom.btnToggleAuto.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleAutoPacer();
    });

    // Celebration modal "Shuffle Again"
    this.dom.btnShuffleAgain.addEventListener('click', () => {
      this.closeModal(this.dom.modalComplete);
      this.resetShuffle();
      this.startShuffle();
    });

    // Settings Form Handlers
    this.dom.settingDeckPreset.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'custom') {
        this.dom.customDeckGroup.classList.remove('hidden');
        this.deckSize = parseInt(this.dom.settingCustomDeck.value, 10) || 52;
      } else {
        this.dom.customDeckGroup.classList.add('hidden');
        this.deckSize = parseInt(val, 10);
      }
      this.savePreferences();
      this.resetShuffle();
    });

    this.dom.settingCustomDeck.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      if (val && val >= 9 && val <= 500) {
        this.deckSize = val;
        this.savePreferences();
        this.resetShuffle();
      }
    });

    this.dom.settingVoiceSelect.addEventListener('change', (e) => {
      const uri = e.target.value;
      this.selectedVoice = this.availableVoices.find(v => v.voiceURI === uri) || null;
      this.selectedVoiceURI = uri;
      this.savePreferences();
    });

    this.dom.settingSpeechRate.addEventListener('input', (e) => {
      this.speechRate = parseFloat(e.target.value);
      this.dom.speechRateLabel.textContent = `${this.speechRate.toFixed(2)}x`;
      this.savePreferences();
    });

    this.dom.settingPacerInterval.addEventListener('input', (e) => {
      this.pacerInterval = parseFloat(e.target.value);
      this.dom.pacerIntervalLabel.textContent = `${this.pacerInterval.toFixed(1)}s / card`;
      this.savePreferences();
      if (this.autoPacing) {
        this.stopAutoPacer();
        this.startAutoPacer();
      }
    });

    this.dom.settingSpeakCenter.addEventListener('change', (e) => {
      this.speakCenter = e.target.checked;
      this.savePreferences();
    });

    this.dom.settingSpeakOclock.addEventListener('change', (e) => {
      this.speakOclock = e.target.checked;
      this.savePreferences();
    });

    this.dom.settingSoundFx.addEventListener('change', (e) => {
      this.soundFxEnabled = e.target.checked;
      this.savePreferences();
    });

    this.dom.settingWakeLock.addEventListener('change', (e) => {
      this.wakeLockEnabled = e.target.checked;
      this.savePreferences();
      if (this.wakeLockEnabled) {
        this.requestWakeLock();
      } else {
        this.releaseWakeLock();
      }
    });

    this.dom.settingDealMode.addEventListener('change', (e) => {
      this.dealMode = e.target.value;
      this.savePreferences();
      this.resetShuffle();
    });

    if (this.dom.btnRestoreDefaults) {
      this.dom.btnRestoreDefaults.addEventListener('click', (e) => {
        e.stopPropagation();
        this.restoreDefaults();
      });
    }

    if (this.dom.btnSkipSpot) {
      this.dom.btnSkipSpot.addEventListener('click', (e) => {
        e.stopPropagation();
        this.rerollCurrentSpot();
      });
    }

    if (this.dom.btnFinishCasual) {
      this.dom.btnFinishCasual.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onShuffleComplete();
      });
    }

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      // Don't intercept if an input is focused
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        this.handlePrimaryAction();
      } else if (e.code === 'ArrowLeft' || e.code === 'Backspace') {
        e.preventDefault();
        this.undoPick();
      } else if (e.code === 'KeyS' && this.dealMode === 'casual') {
        e.preventDefault();
        this.rerollCurrentSpot();
      } else if (e.code === 'KeyA') {
        e.preventDefault();
        this.toggleAutoPacer();
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        this.toggleVoice();
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        this.resetShuffle();
      } else if (e.code === 'Escape') {
        // Close any open modal
        document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(modal => {
          this.closeModal(modal);
        });
      }
    });

    // Re-acquire wake lock if page becomes visible again
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.wakeLockEnabled) {
        this.requestWakeLock();
      }
    });
  }

  /* ========================================================================
     Piles & Math Engine (Fisher-Yates CSPRNG)
     ======================================================================== */
  initPiles() {
    this.initialPiles = {};
    this.currentPiles = {};

    const zones = this.getZoneList();
    const zoneCount = zones.length;
    
    // Distribute deckSize cards across zoneCount piles
    const base = Math.floor(this.deckSize / zoneCount);
    const remainder = this.deckSize % zoneCount;

    zones.forEach((zone, idx) => {
      const count = base + (idx < remainder ? 1 : 0);
      this.initialPiles[zone] = count;
      this.currentPiles[zone] = count;
    });

    // Pre-generate true Fisher-Yates CSPRNG pick sequence
    this.generatePickSequence();
  }

  getZoneList() {
    if (this.mode === 'clock') {
      // Center (0), and hours 1 through 12
      return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    } else {
      // Grid 1 through 9
      return [1, 2, 3, 4, 5, 6, 7, 8, 9];
    }
  }

  generatePickSequence() {
    const zones = this.getZoneList();
    const zoneCount = zones.length;

    if (this.dealMode === 'casual') {
      // In casual mode, generate deckSize random uniform zone picks
      const deck = [];
      const randomBuffer = new Uint32Array(this.deckSize);
      window.crypto.getRandomValues(randomBuffer);
      for (let i = 0; i < this.deckSize; i++) {
        deck.push(zones[randomBuffer[i] % zoneCount]);
      }
      this.pickSequence = deck;
      return;
    }

    // Populate an array with exactly each card's designated pile origin
    const deck = [];
    Object.entries(this.initialPiles).forEach(([zone, count]) => {
      for (let i = 0; i < count; i++) {
        deck.push(parseInt(zone, 10));
      }
    });

    // Cryptographically secure Fisher-Yates Shuffle
    // Generate random 32-bit uints using Web Crypto API
    const randomBuffer = new Uint32Array(deck.length);
    window.crypto.getRandomValues(randomBuffer);

    for (let i = deck.length - 1; i > 0; i--) {
      // Unbiased random integer in [0, i]
      const j = randomBuffer[i] % (i + 1);
      const temp = deck[i];
      deck[i] = deck[j];
      deck[j] = temp;
    }

    this.pickSequence = deck;
  }

  rerollCurrentSpot() {
    if (this.currentIndex < 0 || this.currentIndex >= this.pickSequence.length) return;
    const zones = this.getZoneList();
    const currentZone = this.pickSequence[this.currentIndex];
    const otherZones = zones.filter(z => z !== currentZone);
    const randBuf = new Uint32Array(1);
    window.crypto.getRandomValues(randBuf);
    const newZone = otherZones[randBuf[0] % otherZones.length];
    this.pickSequence[this.currentIndex] = newZone;
    this.updateBoardDisplay();
    this.announceCurrentPick();
  }

  switchMode(newMode) {
    if (this.mode === newMode) return;
    this.mode = newMode;
    this.applyModeUI(newMode);
    this.savePreferences();
    this.resetShuffle();
  }

  applyModeUI(newMode) {
    if (newMode === 'clock') {
      this.dom.btnModeClock.classList.add('active');
      this.dom.btnModeClock.setAttribute('aria-pressed', 'true');
      this.dom.btnModeGrid.classList.remove('active');
      this.dom.btnModeGrid.setAttribute('aria-pressed', 'false');

      this.dom.clockBoard.classList.remove('hidden');
      this.dom.gridBoard.classList.add('hidden');
    } else {
      this.dom.btnModeGrid.classList.add('active');
      this.dom.btnModeGrid.setAttribute('aria-pressed', 'true');
      this.dom.btnModeClock.classList.remove('active');
      this.dom.btnModeClock.setAttribute('aria-pressed', 'false');

      this.dom.gridBoard.classList.remove('hidden');
      this.dom.clockBoard.classList.add('hidden');
    }
  }

  /* ========================================================================
     Preferences & Persistence (localStorage)
     ======================================================================== */
  loadPreferences() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;

      const prefs = Object.assign({}, DEFAULT_PREFERENCES, JSON.parse(stored));

      this.mode = prefs.mode === 'grid' ? 'grid' : 'clock';
      this.deckSize = typeof prefs.deckSize === 'number' && prefs.deckSize >= 9 ? prefs.deckSize : 52;
      this.dealMode = prefs.dealMode === 'casual' ? 'casual' : 'counted';
      this.speechRate = typeof prefs.speechRate === 'number' ? prefs.speechRate : 1.25;
      this.pacerInterval = typeof prefs.pacerInterval === 'number' ? prefs.pacerInterval : 1.6;
      this.autoPacing = Boolean(prefs.autoPacing);
      this.voiceEnabled = Boolean(prefs.voiceEnabled);
      this.selectedVoiceURI = prefs.selectedVoiceURI || '';
      this.speakCenter = Boolean(prefs.speakCenter);
      this.speakOclock = Boolean(prefs.speakOclock);
      this.soundFxEnabled = Boolean(prefs.soundFxEnabled);
      this.wakeLockEnabled = Boolean(prefs.wakeLockEnabled);

      // Reflect into UI elements
      if (prefs.deckPreset === 'custom' || !['52', '54', '60', '100', '32', '40'].includes(String(this.deckSize))) {
        this.dom.settingDeckPreset.value = 'custom';
        this.dom.customDeckGroup.classList.remove('hidden');
        this.dom.settingCustomDeck.value = this.deckSize;
      } else {
        this.dom.settingDeckPreset.value = String(this.deckSize);
        this.dom.customDeckGroup.classList.add('hidden');
        this.dom.settingCustomDeck.value = this.deckSize;
      }

      this.dom.settingDealMode.value = this.dealMode;
      this.dom.settingSpeechRate.value = this.speechRate;
      this.dom.speechRateLabel.textContent = `${this.speechRate.toFixed(2)}x`;
      this.dom.settingPacerInterval.value = this.pacerInterval;
      this.dom.pacerIntervalLabel.textContent = `${this.pacerInterval.toFixed(1)}s / card`;

      this.dom.settingSpeakCenter.checked = this.speakCenter;
      this.dom.settingSpeakOclock.checked = this.speakOclock;
      this.dom.settingSoundFx.checked = this.soundFxEnabled;
      this.dom.settingWakeLock.checked = this.wakeLockEnabled;

      this.applyModeUI(this.mode);
      this.applyVoiceUI(this.voiceEnabled);
      this.applyAutoPacerUI(this.autoPacing);
    } catch (e) {
      console.warn('Unable to load preferences from localStorage', e);
    }
  }

  savePreferences() {
    try {
      const prefs = {
        mode: this.mode,
        deckPreset: this.dom.settingDeckPreset.value,
        deckSize: this.deckSize,
        dealMode: this.dealMode,
        speechRate: this.speechRate,
        pacerInterval: this.pacerInterval,
        autoPacing: this.autoPacing,
        voiceEnabled: this.voiceEnabled,
        selectedVoiceURI: this.selectedVoice ? this.selectedVoice.voiceURI : this.selectedVoiceURI,
        speakCenter: this.speakCenter,
        speakOclock: this.speakOclock,
        soundFxEnabled: this.soundFxEnabled,
        wakeLockEnabled: this.wakeLockEnabled
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch (e) {
      // Storage unavailable or quota exceeded
    }
  }

  restoreDefaults() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}

    // Reset instance properties to defaults
    Object.assign(this, DEFAULT_PREFERENCES);
    this.selectedVoice = null;
    this.selectedVoiceURI = '';

    // Reset DOM controls
    this.dom.settingDeckPreset.value = '52';
    this.dom.customDeckGroup.classList.add('hidden');
    this.dom.settingCustomDeck.value = 52;
    this.dom.settingDealMode.value = 'counted';
    this.dom.settingSpeechRate.value = 1.25;
    this.dom.speechRateLabel.textContent = '1.25x';
    this.dom.settingPacerInterval.value = 1.6;
    this.dom.pacerIntervalLabel.textContent = '1.6s / card';
    this.dom.settingSpeakCenter.checked = true;
    this.dom.settingSpeakOclock.checked = false;
    this.dom.settingSoundFx.checked = true;
    this.dom.settingWakeLock.checked = true;
    this.dom.settingVoiceSelect.value = '';

    this.applyModeUI('clock');
    this.applyVoiceUI(true);
    this.applyAutoPacerUI(false);

    this.resetShuffle();

    // Visual button feedback
    const btn = this.dom.btnRestoreDefaults;
    if (btn) {
      const originalText = btn.textContent;
      btn.textContent = 'Defaults Restored ✓';
      btn.classList.add('success-flash');
      setTimeout(() => {
        btn.textContent = originalText;
        btn.classList.remove('success-flash');
      }, 1800);
    }
  }

  /* ========================================================================
     Shuffle Execution Flow
     ======================================================================== */
  handlePrimaryAction() {
    if (this.currentIndex === -1) {
      this.startShuffle();
    } else if (this.currentIndex < this.pickSequence.length - 1) {
      this.nextPick();
    } else {
      // Finished already
      this.openModal(this.dom.modalComplete);
    }
  }

  startShuffle() {
    this.currentIndex = 0;
    this.startTime = Date.now();
    this.updateCurrentPilesFromIndex();
    this.updateBoardDisplay();
    this.announceCurrentPick();
    this.triggerHaptic();

    if (this.autoPacing) {
      this.startAutoPacer();
    }
  }

  nextPick() {
    if (this.currentIndex >= this.pickSequence.length - 1) return;
    
    this.currentIndex++;
    this.updateCurrentPilesFromIndex();
    this.updateBoardDisplay();
    this.announceCurrentPick();
    this.triggerHaptic();

    // Check if that was the last card
    if (this.currentIndex === this.pickSequence.length - 1) {
      this.onShuffleComplete();
    } else if (this.autoPacing) {
      // Reset timer interval for smooth rhythm
      this.startAutoPacer();
    }
  }

  undoPick() {
    if (this.currentIndex <= 0) {
      this.resetShuffle();
      return;
    }

    this.currentIndex--;
    this.updateCurrentPilesFromIndex();
    this.updateBoardDisplay();
    this.announceCurrentPick();
    this.playTone(180, 0.08, 'sine');

    if (this.autoPacing) {
      this.startAutoPacer();
    }
  }

  resetShuffle() {
    if (this.pacerTimer) {
      clearTimeout(this.pacerTimer);
      this.pacerTimer = null;
    }
    this.applyAutoPacerUI(this.autoPacing);
    this.currentIndex = -1;
    this.startTime = null;
    this.endTime = null;
    this.initPiles();
    this.updateBoardDisplay();
  }

  updateCurrentPilesFromIndex() {
    // Recompute current counts from initialPiles minus drawn cards up to currentIndex
    const counts = { ...this.initialPiles };
    for (let i = 0; i <= this.currentIndex; i++) {
      const zone = this.pickSequence[i];
      if (counts[zone] > 0) counts[zone]--;
    }
    this.currentPiles = counts;
  }

  onShuffleComplete() {
    if (this.pacerTimer) {
      clearTimeout(this.pacerTimer);
      this.pacerTimer = null;
    }
    this.applyAutoPacerUI(this.autoPacing);
    this.endTime = Date.now();
    const durationSeconds = this.startTime ? Math.round((this.endTime - this.startTime) / 1000) : 0;
    const mins = Math.floor(durationSeconds / 60);
    const secs = durationSeconds % 60;
    const formattedTime = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

    const finalCount = this.dealMode === 'casual' && this.currentIndex >= 0 ? this.currentIndex + 1 : this.deckSize;
    this.dom.completeCardCount.textContent = finalCount;
    this.dom.completeTime.textContent = formattedTime;

    // Victory fanfare & speech
    this.playFanfare();
    this.speak("Shuffle complete! Your deck is ready.");

    setTimeout(() => {
      this.openModal(this.dom.modalComplete);
    }, 600);
  }

  /* ========================================================================
     Visual Board & Callout Updates
     ======================================================================== */
  updateBoardDisplay() {
    const isStarted = this.currentIndex >= 0;
    const isFinished = isStarted && this.currentIndex >= this.pickSequence.length - 1;
    const currentZone = isStarted ? this.pickSequence[this.currentIndex] : null;

    // 1. Stats and Progress
    const cardNum = isStarted ? this.currentIndex + 1 : 0;
    const remaining = this.deckSize - cardNum;
    const percent = Math.round((cardNum / this.deckSize) * 100);

    this.dom.statCardCount.innerHTML = `Card <strong>${cardNum}</strong> of <strong>${this.deckSize}</strong>`;
    this.dom.statCardsRemaining.textContent = `${remaining} remaining`;
    this.dom.statPercent.textContent = `${percent}%`;
    this.dom.progressFill.style.width = `${percent}%`;
    this.dom.progressFill.parentElement.setAttribute('aria-valuenow', percent);

    // 2. Callout Card
    if (!isStarted) {
      this.dom.calloutCard.classList.remove('active-pulse');
      this.dom.calloutStatusBadge.textContent = 'READY TO SHUFFLE';
      this.dom.calloutInstruction.textContent = 'Deal cards face-down into positions, then';
      this.dom.calloutTarget.textContent = 'TAP TO START';
      this.dom.calloutPileInfo.textContent = this.getSetupDealGuide();
      this.dom.btnUndo.disabled = true;
      this.dom.primaryBtnLabel.textContent = 'TAP TO START';
      this.dom.primaryBtnSubtext.textContent = 'or press Spacebar';
    } else if (isFinished) {
      this.dom.calloutCard.classList.add('active-pulse');
      this.dom.calloutStatusBadge.textContent = 'COMPLETE';
      this.dom.calloutInstruction.textContent = 'All cards collected!';
      this.dom.calloutTarget.textContent = 'SHUFFLE FINISHED';
      this.dom.calloutPileInfo.textContent = 'Your deck is fully randomized face-down';
      this.dom.btnUndo.disabled = false;
      this.dom.primaryBtnLabel.textContent = 'VIEW SUMMARY';
      this.dom.primaryBtnSubtext.textContent = 'Tap to see stats';
    } else {
      this.dom.calloutCard.classList.add('active-pulse');
      this.dom.calloutStatusBadge.textContent = `PICK CARD #${cardNum}`;
      this.dom.calloutInstruction.textContent = 'Take top card face-down from:';
      
      const zoneLabel = this.getZoneDisplayLabel(currentZone);
      this.dom.calloutTarget.textContent = zoneLabel;

      if (this.dealMode === 'casual') {
        this.dom.calloutPileInfo.textContent = 'Casual Mode • If spot is empty, take from next clockwise pile';
      } else {
        const remainingInThisPile = this.currentPiles[currentZone];
        this.dom.calloutPileInfo.textContent = `${remainingInThisPile} card${remainingInThisPile === 1 ? '' : 's'} remaining in this pile`;
      }
      this.dom.btnUndo.disabled = false;
      this.dom.primaryBtnLabel.textContent = 'NEXT CARD';
      this.dom.primaryBtnSubtext.textContent = `Card ${cardNum + 1} of ${this.deckSize}`;
    }

    // Toggle Casual Mode actions toolbar
    if (this.dealMode === 'casual' && isStarted && !isFinished) {
      this.dom.casualActions?.classList.remove('hidden');
      this.dom.hintReroll?.classList.remove('hidden');
    } else {
      this.dom.casualActions?.classList.add('hidden');
      this.dom.hintReroll?.classList.add('hidden');
    }

    // 3. Update Zone Nodes on Active Board
    const prefix = this.mode === 'clock' ? 'clock' : 'grid';
    const zones = this.getZoneList();

    zones.forEach(zone => {
      const node = document.getElementById(`zone-${prefix}-${zone}`);
      const counter = document.getElementById(`counter-${prefix}-${zone}`);
      if (!node || !counter) return;

      if (this.dealMode === 'casual') {
        counter.textContent = '~';
        node.classList.remove('is-empty');
      } else {
        const remainingCount = this.currentPiles[zone] !== undefined ? this.currentPiles[zone] : 0;
        counter.textContent = remainingCount;
        if (remainingCount === 0) {
          node.classList.add('is-empty');
        } else {
          node.classList.remove('is-empty');
        }
      }

      // Active state
      if (isStarted && currentZone === zone) {
        node.classList.add('is-active');
        node.setAttribute('aria-current', 'true');
      } else {
        node.classList.remove('is-active');
        node.removeAttribute('aria-current');
      }
    });
  }

  getSetupDealGuide() {
    if (this.dealMode === 'casual') {
      return 'Casual Mode: Roughly drop cards across the zones without counting';
    }
    const zones = this.getZoneList();
    const count = zones.length;
    const base = Math.floor(this.deckSize / count);
    const rem = this.deckSize % count;

    if (rem === 0) {
      return `Deal ${base} cards into each of the ${count} positions`;
    } else {
      return `Deal cards clockwise/in order: ${rem} piles get ${base + 1} cards, rest get ${base}`;
    }
  }

  getZoneDisplayLabel(zone) {
    if (this.mode === 'clock') {
      if (zone === 0) return 'CENTER (0)';
      return `${zone} O'CLOCK`;
    } else {
      const gridLabels = {
        1: '1 • TOP LEFT',
        2: '2 • TOP MID',
        3: '3 • TOP RIGHT',
        4: '4 • MID LEFT',
        5: '5 • CENTER',
        6: '6 • MID RIGHT',
        7: '7 • BTM LEFT',
        8: '8 • BTM MID',
        9: '9 • BTM RIGHT'
      };
      return gridLabels[zone] || `ZONE ${zone}`;
    }
  }

  triggerTapAnimation(e) {
    const feedback = this.dom.tapFeedback;
    feedback.classList.remove('flash');
    void feedback.offsetWidth; // Trigger reflow
    feedback.classList.add('flash');
    setTimeout(() => feedback.classList.remove('flash'), 220);
  }

  triggerHaptic() {
    if (navigator.vibrate) {
      try {
        navigator.vibrate(18);
      } catch (e) {
        // Ignore if unsupported or blocked
      }
    }
  }

  /* ========================================================================
     Voice Synthesis & Web Audio Engine
     ======================================================================== */
  initVoices() {
    if (!('speechSynthesis' in window)) {
      this.dom.btnToggleVoice.style.display = 'none';
      return;
    }

    const loadVoiceOptions = () => {
      this.availableVoices = window.speechSynthesis.getVoices();
      if (!this.availableVoices || this.availableVoices.length === 0) return;

      this.dom.settingVoiceSelect.innerHTML = '<option value="">Default System Voice</option>';
      
      // Sort English voices first for convenience
      const sorted = [...this.availableVoices].sort((a, b) => {
        const aEn = a.lang.startsWith('en');
        const bEn = b.lang.startsWith('en');
        if (aEn && !bEn) return -1;
        if (!aEn && bEn) return 1;
        return a.name.localeCompare(b.name);
      });

      sorted.forEach(voice => {
        const opt = document.createElement('option');
        opt.value = voice.voiceURI;
        opt.textContent = `${voice.name} (${voice.lang})`;
        this.dom.settingVoiceSelect.appendChild(opt);
      });

      // Restore saved voice preference
      if (this.selectedVoiceURI) {
        this.selectedVoice = this.availableVoices.find(v => v.voiceURI === this.selectedVoiceURI) || null;
        if (this.selectedVoice) {
          this.dom.settingVoiceSelect.value = this.selectedVoice.voiceURI;
        }
      }
    };

    loadVoiceOptions();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoiceOptions;
    }
  }

  toggleVoice() {
    this.voiceEnabled = !this.voiceEnabled;
    this.applyVoiceUI(this.voiceEnabled);
    this.savePreferences();
    if (this.voiceEnabled) {
      this.speak("Voice enabled");
    } else {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    }
  }

  applyVoiceUI(enabled) {
    if (enabled) {
      this.dom.btnToggleVoice.classList.add('active');
      this.dom.iconVoiceOn.classList.remove('hidden');
      this.dom.iconVoiceOff.classList.add('hidden');
    } else {
      this.dom.btnToggleVoice.classList.remove('active');
      this.dom.iconVoiceOn.classList.add('hidden');
      this.dom.iconVoiceOff.classList.remove('hidden');
    }
  }

  announceCurrentPick() {
    if (this.currentIndex < 0 || this.currentIndex >= this.pickSequence.length) return;
    const zone = this.pickSequence[this.currentIndex];

    // 1. Play soft tactile click tone
    if (this.soundFxEnabled) {
      this.playTone(520, 0.04, 'triangle');
    }

    // 2. Synthesize Voice
    if (!this.voiceEnabled || !('speechSynthesis' in window)) return;

    let phrase = '';
    if (this.mode === 'clock') {
      if (zone === 0) {
        phrase = this.speakCenter ? 'Center' : 'Zero';
      } else {
        phrase = this.speakOclock ? `${zone} o'clock` : `${zone}`;
      }
    } else {
      if (zone === 5 && this.speakCenter) {
        phrase = 'Center';
      } else {
        phrase = `${zone}`;
      }
    }

    this.speak(phrase);
  }

  speak(text) {
    if (!('speechSynthesis' in window) || !this.voiceEnabled) return;

    // Cancel any previous utterance to keep speech zero-latency & snappy
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = this.speechRate;
    utterance.pitch = 1.0;

    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    }

    window.speechSynthesis.speak(utterance);
  }

  getAudioContext() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.audioCtx = new AudioCtx();
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  playTone(freq, duration, type = 'sine') {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      // AudioContext unavailable
    }
  }

  playFanfare() {
    if (!this.soundFxEnabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const time = ctx.currentTime + (idx * 0.12);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, time);

        gain.gain.setValueAtTime(0.18, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(time);
        osc.stop(time + 0.35);
      });
    } catch (e) {
      // Audio error
    }
  }

  /* ========================================================================
     Auto-Advance (Pacer) Engine
     ======================================================================== */
  toggleAutoPacer() {
    if (this.autoPacing) {
      this.stopAutoPacer(true);
    } else {
      this.startAutoPacer(true);
    }
  }

  applyAutoPacerUI(active) {
    if (active) {
      this.dom.btnToggleAuto.classList.add('is-active');
      this.dom.iconAutoPlay.classList.add('hidden');
      this.dom.iconAutoPause.classList.remove('hidden');
      this.dom.autoBtnLabel.textContent = `Auto: ${this.pacerInterval.toFixed(1)}s`;
    } else {
      this.dom.btnToggleAuto.classList.remove('is-active');
      this.dom.iconAutoPlay.classList.remove('hidden');
      this.dom.iconAutoPause.classList.add('hidden');
      this.dom.autoBtnLabel.textContent = 'Auto: OFF';
    }
  }

  startAutoPacer(savePref = false) {
    if (this.pacerTimer) {
      clearTimeout(this.pacerTimer);
      this.pacerTimer = null;
    }
    this.autoPacing = true;
    this.applyAutoPacerUI(true);
    if (savePref) this.savePreferences();

    if (this.currentIndex === -1) {
      this.startShuffle();
      return;
    }

    const intervalMs = this.pacerInterval * 1000;
    this.pacerTimer = setTimeout(() => {
      if (this.autoPacing && this.currentIndex < this.pickSequence.length - 1) {
        this.nextPick();
      }
    }, intervalMs);
  }

  stopAutoPacer(savePref = false) {
    this.autoPacing = false;
    if (this.pacerTimer) {
      clearTimeout(this.pacerTimer);
      this.pacerTimer = null;
    }
    this.applyAutoPacerUI(false);
    if (savePref) this.savePreferences();
  }

  /* ========================================================================
     Screen Wake Lock (Prevents Screen Dimming/Sleep)
     ======================================================================== */
  async requestWakeLock() {
    if (!this.wakeLockEnabled || !('wakeLock' in navigator)) return;
    try {
      this.wakeLockSentinel = await navigator.wakeLock.request('screen');
      this.wakeLockSentinel.addEventListener('release', () => {
        this.wakeLockSentinel = null;
      });
    } catch (err) {
      // Wake Lock rejected or unsupported
    }
  }

  releaseWakeLock() {
    if (this.wakeLockSentinel) {
      this.wakeLockSentinel.release();
      this.wakeLockSentinel = null;
    }
  }

  /* ========================================================================
     Modal System
     ======================================================================== */
  openModal(modal) {
    if (!modal) return;
    modal.classList.remove('hidden');
  }

  closeModal(modal) {
    if (!modal) return;
    modal.classList.add('hidden');
  }

  /* ========================================================================
     Offline PWA Service Worker
     ======================================================================== */
  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {
        // Offline registration optional
      });
    }
  }
}

// Initialize on DOMContentLoaded
window.addEventListener('DOMContentLoaded', () => {
  window.app = new PerfectShuffleApp();
});
