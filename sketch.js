// Color schemes
const COLORS = {
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

// Global state
let isNightMode = false;
let is3DMode = false;
let song, fft, amplitude;
let gridLines = [];
let blocks = [];
let audioLoaded = false;

// Helper functions
const isPlaying = () => audioLoaded && song && song.isPlaying();
const colors = () => isNightMode ? COLORS.night : COLORS.day;

// GridLine class
class GridLine {
  constructor(x1, y1, x2, y2, isVertical) {
    Object.assign(this, { x1, y1, x2, y2, isVertical });
    this.cubes = this.createCubes();
  }

  createCubes() {
    const length = this.isVertical ? this.y2 - this.y1 : this.x2 - this.x1;
    return Array.from({ length: floor(length / 30) }, () => ({
      pos: random(length),
      baseSize: random(6, 14),
      speed: random(0.5, 2) * (random() > 0.5 ? 1 : -1),
      colorIndex: floor(random(3)),
      freqBand: floor(random(50, 400)),
      scale: 1.0,
      trail: []
    }));
  }

  update() {
    const length = this.isVertical ? this.y2 - this.y1 : this.x2 - this.x1;
    
    this.cubes.forEach(cube => {
      // FIX 1: Cars only have audio reactivity (size change/trails) in 2D mode.
      if (!is3DMode && isPlaying()) { 
        const spectrum = fft.analyze();
        const level = amplitude.getLevel();
        const targetScale = map(spectrum[cube.freqBand] || 0, 0, 255, 1.0, 3.5) + level * 1.5;
        cube.scale = lerp(cube.scale, targetScale, 0.3);
        
        const pos = this.isVertical 
          ? { x: this.x1, y: this.y1 + cube.pos }
          : { x: this.x1 + cube.pos, y: this.y1 };
        cube.trail.push({ ...pos, size: cube.baseSize * cube.scale, alpha: 255 });
        
        if (cube.trail.length > 50) cube.trail.shift();
        cube.trail.forEach((t, i) => t.alpha = map(i, 0, cube.trail.length - 1, 20, 255));
      } else {
        // In 3D mode (or 2D/paused), scale remains 1.0, and trail is NOT drawn/updated.
        cube.scale = lerp(cube.scale, 1.0, 0.1); 
        // FIX: Ensure no trails are built in 3D mode or when paused.
        cube.trail = []; 
      }
      
      // Car movement is independent of mode/music
      cube.pos += cube.speed;
      if ((cube.speed > 0 && cube.pos > length) || (cube.speed < 0 && cube.pos < 0)) {
        cube.pos = cube.speed > 0 ? 0 : length;
        cube.trail = [];
      }
    });
  }

draw() {
    const c = colors();
        
    if (is3DMode) {
      // Z-position for the center of the road structure 
      const roadZ = 5; 
      // Car Z-position
      const trafficZ = 10; 

      // 1. Draw traffic cubes
      this.cubes.forEach(cube => {
        const color = c.primary[cube.colorIndex];
        // In 3D mode, scale is 1.0, so size is just baseSize
        const size = cube.baseSize; 
        noStroke();
                
        // Draw trail (will be empty due to FIX 1)
        cube.trail.forEach((t, i) => {
          push();
          fill(color[0], color[1], color[2], t.alpha * 0.6);
          translate(t.x, t.y, trafficZ); 
          box(t.size, t.size, t.size);
          pop();
        });
                
        // Draw main cube
        push();
        fill(...color);
        if (this.isVertical) {
          const y = this.y1 + cube.pos;
          translate(this.x1, y, trafficZ);
        } else {
          const x = this.x1 + cube.pos;
          translate(x, this.y1, trafficZ);
        }
        box(size, size, size);
        pop();
      });


      // 2. Draw streets
      push();
      fill(...c.grid);
      noStroke();
            
      if (this.isVertical) {
        const midX = this.x1;
        const midY = (this.y1 + this.y2) / 2;
        const length = this.y2 - this.y1;
        translate(midX, midY, roadZ); 
        box(12, length, 8);
      } else {
        const midX = (this.x1 + this.x2) / 2;
        const midY = this.y1;
        const length = this.x2 - this.x1;
        translate(midX, midY, roadZ); 
        box(length, 12, 8);
      }
      pop();
            
    } else {
      // 2D mode - Existing logic (Audio reactivity is ENABLED here)
      push();
      
      const drawCubes = () => {
        // Draw traffic cubes (cars) and their trails
        this.cubes.forEach(cube => {
          const color = c.primary[cube.colorIndex];
          noStroke(); 
          
          // Draw trail
          cube.trail.forEach(t => {
            fill(color[0], color[1], color[2], t.alpha * 0.6);
            const x = this.isVertical ? t.x - t.size / 2 : t.x;
            const y = this.isVertical ? t.y : t.y - t.size / 2;
            rect(x, y, t.size, t.size);
          });
          
          // Draw main cube
          fill(...color);
          const size = cube.baseSize * cube.scale;
          const x = this.isVertical ? this.x1 - size / 2 : this.x1 + cube.pos;
          const y = this.isVertical ? this.y1 + cube.pos : this.y1 - size / 2;
          rect(x, y, size, size);
        });
      };
      
      const drawRoads = () => {
        // Draw street lines
        noFill(); 
        stroke(...c.grid);
        strokeWeight(12);
        line(this.x1, this.y1, this.x2, this.y2);
      };
      
      if (isPlaying()) {
        // Music ON: Cars underneath 
        drawCubes();
        drawRoads();
      } else {
        // Music OFF: Cars on top 
        drawRoads();
        drawCubes();
      }
      
      pop();
    }
  }
}

// Block class
class Block {
  constructor(x, y, size, freqBand) {
    Object.assign(this, { x, y, size, freqBand });
    this.colorIndex = floor(random(4));
    
    // FIX 1: Buildings start with a safe, flat height of 0.
    // Random height for 3D is now applied ONLY in toggle3D().
    this.height = 0; 
    this.pulse = 1.0;
  }

  update() {
    if (isPlaying()) {
      const spectrum = fft.analyze();
      const targetHeight = map(spectrum[this.freqBand] || 0, 0, 255, 0, 350); 
      this.height = lerp(this.height, targetHeight, 0.2);
      this.pulse = 1.0 + amplitude.getLevel() * 0.6;
    } else {
      // FIX 2: When paused, the building holds its current height.
      // We no longer want it to shrink back to 0 at all.
      this.pulse = lerp(this.pulse, 1.0, 0.2); 
    }
  }

draw() {
    const c = colors();
    const color = this.colorIndex < 3 ? c.primary[this.colorIndex] : c.accent;
    if (is3DMode) {
      push();
      noStroke();
      // Buildings are centered at Z=height/2
      translate(this.x, this.y, this.height / 2); 
      fill(...color);
      box(this.size * this.pulse, this.size * this.pulse, this.height);
      pop();
    } else {
      // 2D mode: The height will reflect the random start but the pulse will shrink.
      // Since you only care about 3D, we leave this as-is.
      push();
      noStroke();
      fill(...color);
      const s = (this.size + this.height * 0.3) * this.pulse;
      rect(this.x - s / 2, this.y - s / 2, s, s);
      pop();
    }
  }
}

// Initialize scene
function initScene() {
  const vPos = [100, 180, 280, 360, 450, 520];
  const hPos = [80, 160, 250, 330, 420, 500];
  
  gridLines = []; // Ensure old lines are cleared
  blocks = []; // Ensure old blocks are cleared

  vPos.forEach(x => gridLines.push(new GridLine(x, 50, x, 550, true)));
  hPos.forEach(y => gridLines.push(new GridLine(50, y, 550, y, false)));
  
  const cityMap = [
    [1, 0, 1, 1, 0],
    [0, 1, 0, 1, 1],
    [1, 1, 0, 0, 1],
    [0, 0, 1, 1, 0],
    [1, 1, 1, 0, 1]
  ];
  
  let idx = 0;
  cityMap.forEach((row, i) => {
    row.forEach((cell, j) => {
      if (cell === 1) {
        const size = random(30, 60);
        const corner = floor(random(4));
        const half = 6;
        
        const x = corner % 2 === 0 
          ? vPos[j] + half + size / 2 
          : vPos[j + 1] - half - size / 2;
        const y = corner < 2 
          ? hPos[i] + half + size / 2 
          : hPos[i + 1] - half - size / 2;
        
        blocks.push(new Block(x, y, size, floor(map(idx, 0, 25, 350, 0))));
        idx++;
      }
    });
  });
}

// p5.js preload
function preload() {
  song = loadSound('501.mp3',
    () => {
      audioLoaded = true;
      document.getElementById('status').textContent = 'Audio ready! Press Play to start.';
    },
    () => {
      document.getElementById('status').textContent = 'Error loading audio file.';
      document.getElementById('status').style.color = '#e74c3c';
    }
  );
}

// p5.js setup
function setup() {
  createCanvas(600, 600).parent('canvas-container');
  frameRate(60);
  initScene();
  
  fft = new p5.FFT(0.8, 512);
  amplitude = new p5.Amplitude();
  if (song) {
    fft.setInput(song);
    amplitude.setInput(song);
  }

  document.getElementById('mode-btn').onclick = toggleMode;
  document.getElementById('view-btn').onclick = toggle3D;
  document.getElementById('audio-btn').onclick = toggleAudio;
}

// p5.js draw
function draw() {
  const c = colors();
  background(...c.bg);

  // Updates must run before drawing
  blocks.forEach(b => b.update());
  gridLines.forEach(l => l.update());

  if (is3DMode) {
    // START ISOLATION BLOCK
    push(); 
    
    // 1. Shift the 3D origin from the center to the top-left
    translate(-width / 2, -height / 2); 
    
    // Ambient Light: Brightens everything equally, ensuring shadows aren't pitch black.
    // Increased intensity to 100 (out of 255) for a strong base illumination.
    ambientLight(100); 

    // Directional Light: Simulates the sun, giving defined shadows and highlights.
    // Bright white light (255, 255, 255) shining down and from the front-right.
    directionalLight(255, 255, 255, 0.5, 0.5, -1);

    // 2. Set the camera view. (Angle maintained)
    camera(300, 700, 500, 300, 300, 0, 0, 1, 0); 
  } 

  gridLines.forEach(l => l.draw());
  blocks.forEach(b => b.draw());

  if (is3DMode) {
    pop(); // END ISOLATION BLOCK 
  }
}

// Toggle color mode
function toggleMode() {
  isNightMode = !isNightMode;
  const btn = document.getElementById('mode-btn');
  btn.textContent = isNightMode ? '☀️ Day Mode' : '🌙 Night Mode';
  btn.className = isNightMode ? 'night-mode' : 'day-mode';
}

// Toggle 3D mode
function toggle3D() {
  is3DMode = !is3DMode;

  const currentCanvas = select('canvas');
  if (currentCanvas) {
    currentCanvas.remove(); 
  }

  const canvas = is3DMode ? createCanvas(600, 600, WEBGL) : createCanvas(600, 600);
  canvas.parent('canvas-container'); 
  
  // Clear and regenerate the city. All blocks are created with height=0.
  gridLines = [];
  blocks = [];
  initScene();

  if (is3DMode) {
    // FIX A: Applying a cap to the random starting height (now 200 instead of 300).
    blocks.forEach(b => {
      // Starting height will be between 50 and 200.
      b.height = random(50, 200); 
    });
  } else {
    // When entering 2D mode, we ensure the height is 0.
    blocks.forEach(b => {
      b.height = 0;
    });

    // Ensures 2D canvas is centered.
    resetMatrix();   
    translate(0, 0); 
  }

  // Re-assign audio inputs
  if (song) {
    fft.setInput(song);
    amplitude.setInput(song);
  }
  
  // Update button
  const btn = document.getElementById('view-btn');
  btn.textContent = is3DMode ? '🗺️ 2D Mode' : '🗽 3D Mode';
  btn.className = is3DMode ? 'mode-3d' : 'mode-2d';
  
  redraw();
}

// Toggle audio
function toggleAudio() {
  if (!audioLoaded) {
    console.log('Audio not loaded yet!'); 
    return;
  }
  
  const btn = document.getElementById('audio-btn');
  if (song.isPlaying()) {
    song.pause();
    btn.textContent = '▶️ Play Audio';
    btn.className = 'play';
  } else {
    song.play();
    btn.textContent = '⏸️ Pause Audio';
    btn.className = 'pause';
  }
}