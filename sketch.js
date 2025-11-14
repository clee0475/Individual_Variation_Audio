// Color schemes
const COLOR_SCHEMES = {
  day: {
    bg: [220, 220, 220],
    primary: [[221, 1, 0], [244, 196, 48], [0, 72, 186]],
    accent: [255, 255, 255],
    grid: [0, 0, 0]
  },
  night: {
    bg: [8, 8, 15],
    primary: [[119, 101, 213], [252, 101, 154], [255, 114, 59]],
    accent: [85, 237, 189],
    grid: [30, 42, 72]
  }
};

// Audio file path
const AUDIO_FILE = '501.mp3'; 

// Global variables
let isNightMode = false;
let is3DMode = false;
let audioLoaded = false;
let gridLines = [];
let blocks = [];

// Audio variables
let song;
let fft;
let amplitude;

// GridLine class
class GridLine {
  constructor(x1, y1, x2, y2, isVertical) {
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
    this.isVertical = isVertical;
    this.thickness = 12;
    this.cubes = [];
    this.initCubes();
  }

  initCubes() {
    const length = this.isVertical ? this.y2 - this.y1 : this.x2 - this.x1;
    const numCubes = Math.floor(length / 30);
    
    for (let i = 0; i < numCubes; i++) {
      const pos = Math.random() * length;
      const size = random(6, 14);
      const speed = random(0.5, 2) * (random() > 0.5 ? 1 : -1);
      const colorIndex = floor(random(3));
      
      this.cubes.push({
        pos: pos,
        size: size,
        speed: speed,
        colorIndex: colorIndex
      });
    }
  }

  update() {
    const length = this.isVertical ? this.y2 - this.y1 : this.x2 - this.x1;
    
    this.cubes.forEach(cube => {
      cube.pos += cube.speed;
      
      if (cube.speed > 0 && cube.pos > length) {
        cube.pos = 0;
      } else if (cube.speed < 0 && cube.pos < 0) {
        cube.pos = length;
      }
    });
  }

  draw() {
    const colors = isNightMode ? COLOR_SCHEMES.night : COLOR_SCHEMES.day;
    
    // Draw line
    stroke(...colors.grid);
    strokeWeight(this.thickness);
    line(this.x1, this.y1, this.x2, this.y2);
    
    // Draw moving cubes
    noStroke();
    this.cubes.forEach(cube => {
      fill(...colors.primary[cube.colorIndex]);
      
      if (this.isVertical) {
        const y = this.y1 + cube.pos;
        const x = this.x1 - cube.size / 2;
        rect(x, y, cube.size, cube.size);
      } else {
        const x = this.x1 + cube.pos;
        const y = this.y1 - cube.size / 2;
        rect(x, y, cube.size, cube.size);
      }
    });
  }
}

// IntersectionBlock class with 3D capabilities
class IntersectionBlock {
  constructor(x, y, size, frequencyBand) {
    this.x = x;
    this.y = y;
    this.baseSize = size;
    this.size = size;
    this.colorIndex = floor(random(4));
    this.frequencyBand = frequencyBand;
    this.height = 0;
    this.targetHeight = 0;
    this.pulseScale = 1.0;
  }

  updateSound() {
    if (!audioLoaded || !fft || !song.isPlaying()) return;
    
    // Get frequency spectrum
    let spectrum = fft.analyze();
    
    // Get amplitude for pulsing
    let level = amplitude.getLevel();
    
    // Map frequency band to building height (0-200 pixels)
    let freqValue = spectrum[this.frequencyBand] || 0;
    this.targetHeight = map(freqValue, 0, 255, 0, 200);
    
    // Smooth height transition
    this.height = lerp(this.height, this.targetHeight, 0.2);
    
    // Pulse effect based on amplitude
    this.pulseScale = 1.0 + level * 0.3;
  }

  draw() {
    const colors = isNightMode ? COLOR_SCHEMES.night : COLOR_SCHEMES.day;
    
    if (is3DMode) {
      this.draw3D(colors);
    } else {
      this.draw2D(colors);
    }
  }

  draw2D(colors) {
    noStroke();
    
    if (this.colorIndex < 3) {
      fill(...colors.primary[this.colorIndex]);
    } else {
      fill(...colors.accent);
    }
    
    // Apply pulse scale
    let displaySize = this.size * this.pulseScale;
    rect(this.x - displaySize / 2, this.y - displaySize / 2, displaySize, displaySize);
  }

  draw3D(colors) {
    push();
    
    // Isometric projection
    let isoX = this.x - this.y;
    let isoY = (this.x + this.y) / 2 - this.height;
    
    // Building color
    if (this.colorIndex < 3) {
      fill(...colors.primary[this.colorIndex]);
    } else {
      fill(...colors.accent);
    }
    
    let displaySize = this.size * this.pulseScale;
    
    // Draw top face
    noStroke();
    beginShape();
    vertex(isoX, isoY);
    vertex(isoX + displaySize / 2, isoY + displaySize / 4);
    vertex(isoX, isoY + displaySize / 2);
    vertex(isoX - displaySize / 2, isoY + displaySize / 4);
    endShape(CLOSE);
    
    // Draw left face (darker)
    if (this.height > 5) {
      let darkerColor = colors.primary[this.colorIndex] || colors.accent;
      fill(darkerColor[0] * 0.7, darkerColor[1] * 0.7, darkerColor[2] * 0.7);
      beginShape();
      vertex(isoX - displaySize / 2, isoY + displaySize / 4);
      vertex(isoX, isoY + displaySize / 2);
      vertex(isoX, isoY + displaySize / 2 + this.height);
      vertex(isoX - displaySize / 2, isoY + displaySize / 4 + this.height);
      endShape(CLOSE);
    }
    
    // Draw right face (even darker)
    if (this.height > 5) {
      let darkestColor = colors.primary[this.colorIndex] || colors.accent;
      fill(darkestColor[0] * 0.5, darkestColor[1] * 0.5, darkestColor[2] * 0.5);
      beginShape();
      vertex(isoX, isoY + displaySize / 2);
      vertex(isoX + displaySize / 2, isoY + displaySize / 4);
      vertex(isoX + displaySize / 2, isoY + displaySize / 4 + this.height);
      vertex(isoX, isoY + displaySize / 2 + this.height);
      endShape(CLOSE);
    }
    
    pop();
  }
}

// Initialize grid lines
function initializeGridLines() {
  const verticalPositions = [100, 180, 280, 360, 450, 520];
  verticalPositions.forEach(x => {
    gridLines.push(new GridLine(x, 50, x, 550, true));
  });
  
  const horizontalPositions = [80, 160, 250, 330, 420, 500];
  horizontalPositions.forEach(y => {
    gridLines.push(new GridLine(50, y, 550, y, false));
  });
  
  return { verticalPositions, horizontalPositions };
}

// Initialize blocks using a city map grid system
function initializeBlocks(verticalPositions, horizontalPositions) {
  const cityMap = [
    [1, 0, 1, 1, 0],
    [0, 1, 0, 1, 1],
    [1, 1, 0, 0, 1],
    [0, 0, 1, 1, 0],
    [1, 1, 1, 0, 1],
  ];
  
  const roadThickness = 12;
  const roadHalf = roadThickness / 2;
  
  let blockIndex = 0;
  
  for (let i = 0; i < cityMap.length; i++) {
    for (let j = 0; j < cityMap[i].length; j++) {
      if (cityMap[i][j] === 1) {
        const leftX = verticalPositions[j];
        const rightX = verticalPositions[j + 1];
        const topY = horizontalPositions[i];
        const bottomY = horizontalPositions[i + 1];
        
        const size = random(30, 60);
        const corner = floor(random(4));
        let x, y;
        
        if (corner === 0) {
          x = leftX + roadHalf + size / 2;
          y = topY + roadHalf + size / 2;
        } else if (corner === 1) {
          x = rightX - roadHalf - size / 2;
          y = topY + roadHalf + size / 2;
        } else if (corner === 2) {
          x = leftX + roadHalf + size / 2;
          y = bottomY - roadHalf - size / 2;
        } else {
          x = rightX - roadHalf - size / 2;
          y = bottomY - roadHalf - size / 2;
        }
        
        // Assign different frequency bands to different buildings
        let frequencyBand = floor(map(blockIndex, 0, 25, 0, 512));
        blocks.push(new IntersectionBlock(x, y, size, frequencyBand));
        blockIndex++;
      }
    }
  }
}

// p5.js preload function - loads audio before setup
function preload() {
  const statusElement = document.getElementById('status');

  // Load the audio file
  song = loadSound(AUDIO_FILE, 
    () => {
      // Success callback
      console.log('Audio loaded successfully!');
      statusElement.textContent = 'Audio ready! Press Play to start.';
      statusElement.style.color = '#666';
      audioLoaded = true;
    },
    (err) => {
      // Error callback
      console.error('Error loading audio:', err);
      statusElement.textContent = 'Error loading audio. Please check the file path.';
      statusElement.style.color = '#9b2921ff';
    }
  );
}

// p5.js setup function
function setup() {
  let canvas = createCanvas(600, 600);
  canvas.parent('canvas-container');
  frameRate(60);
  
  const { verticalPositions, horizontalPositions } = initializeGridLines();
  initializeBlocks(verticalPositions, horizontalPositions);
  
  // Initialize audio analysis tools
  fft = new p5.FFT(0.8, 512);
  amplitude = new p5.Amplitude();
  
  // Connect audio to analyzers
  if (song) {
    fft.setInput(song);
    amplitude.setInput(song);
  }

  const modeBtn = document.getElementById('mode-btn');
  const viewBtn = document.getElementById('view-btn');
  const audioBtn = document.getElementById('audio-btn');
  
  if (modeBtn && viewBtn && audioBtn) { // Make sure the elements exist
    modeBtn.addEventListener('click', toggleColorMode);
    viewBtn.addEventListener('click', toggle3DMode);
    audioBtn.addEventListener('click', toggleAudio);
  } else {
    console.error("One or more buttons were not found in the DOM.");
  }
}

// p5.js draw function
function draw() {
  const colors = isNightMode ? COLOR_SCHEMES.night : COLOR_SCHEMES.day;
  background(...colors.bg);
  
  // Update sound analysis for all blocks
  if (audioLoaded && is3DMode && song && song.isPlaying()) {
    blocks.forEach(block => {
      block.updateSound();
    });
  }
  
  // Update and draw grid lines
  gridLines.forEach(line => {
    line.update();
    line.draw();
  });
  
  // Draw intersection blocks
  blocks.forEach(block => {
    block.draw();
  });
}

// Toggle color mode function
function toggleColorMode() {
  isNightMode = !isNightMode;
  const btn = document.getElementById('mode-btn');
  
  if (isNightMode) {
    btn.textContent = '☀️ Day Mode';
    btn.className = 'night-mode';
  } else {
    btn.textContent = '🌙 Night Mode';
    btn.className = 'day-mode';
  }
}

// Toggle 3D mode
function toggle3DMode() {
  is3DMode = !is3DMode;
  const btn = document.getElementById('view-btn');
  
  if (is3DMode) {
    btn.textContent = '🗺️ 2D Mode';
    btn.className = 'mode-3d';
  } else {
    btn.textContent = '🗽 3D Mode';
    btn.className = 'mode-2d';
  }
}

// Toggle audio playback
function toggleAudio() {
  if (!audioLoaded || !song) {
    alert('Audio is not loaded yet. Please wait...');
    return;
  }
  
  const btn = document.getElementById('audio-btn');
  
  if (song.isPlaying()) {
    song.pause();
    btn.textContent = '▶️ Play Audio';
    
    // Reset all building heights
    blocks.forEach(block => {
      block.height = 0;
      block.targetHeight = 0;
    });
  } else {
    song.play();
    btn.textContent = '⏸️ Pause Audio';
  }
}