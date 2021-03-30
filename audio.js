const volume = document.querySelector('#volume');
const highPass = document.querySelector('#high-pass');
const bass = document.querySelector('#bass');
const mid = document.querySelector('#mid');
const treble = document.querySelector('#treble');
const lowPass = document.querySelector('#low-pass');
const compressorThreshold = document.querySelector('#compressor-threshold');
const compressorRatio = document.querySelector('#compressor-ratio');
const compressorAttack = document.querySelector('#compressor-attack');
const compressorRelease = document.querySelector('#compressor-release');
const delay = document.querySelector('#delay');
const detune = document.querySelector('#detune');
const micButton = document.querySelector('#mic');
const stopSongButton = document.querySelector('#stop-song');
const songButtons = document.querySelectorAll('.song');
const visualizer = document.querySelector('#visualizer');

const context = new (window.AudioContext || window.webkitAudioContext)();
const analyzerNode = context.createAnalyser();
analyzerNode.fftSize = 256;

const gainNode = context.createGain();
gainNode.gain.value = volume.value;

const highPassEQ = context.createBiquadFilter();
highPassEQ.type = 'highpass';
highPassEQ.Q.value = Math.SQRT1_2;
highPassEQ.frequency.value = highPass.value;

const bassEQ = context.createBiquadFilter();
bassEQ.type = 'lowshelf';
bassEQ.frequency.value = 500;
bassEQ.gain.value = bass.value;

const midEQ = context.createBiquadFilter();
midEQ.type = 'peaking';
midEQ.Q.value = Math.SQRT1_2;
midEQ.frequency.value = 1500;
midEQ.gain.value = mid.value;

const trebleEQ = context.createBiquadFilter();
trebleEQ.type = 'highshelf';
trebleEQ.frequency.value = 3000;
trebleEQ.gain.value = treble.value;

const lowPassEQ = context.createBiquadFilter();
lowPassEQ.type = 'lowpass';
lowPassEQ.Q.value = Math.SQRT1_2;
lowPassEQ.frequency.value = Math.abs(lowPass.value);

const compressorNode = context.createDynamicsCompressor();
compressorNode.threshold.value = -Math.abs(compressorThreshold.value);
compressorNode.ratio.value = compressorRatio.value;
compressorNode.attack.value = compressorAttack.value;
compressorNode.release.value = compressorRelease.value;

const delayNode = context.createDelay();
delayNode.delayTime = delay.value;

const songBuffers = {};
let songSource;

setupEventListeners()
resize();
drawVisualizer();

function setupEventListeners() {
  window.addEventListener('resize', resize);

  volume.addEventListener('input', (event) => {
    const value = parseFloat(event.target.value);
    gainNode.gain.setTargetAtTime(value, context.currentTime, .01);
  });

  highPass.addEventListener('input', (event) => {
    const value = parseInt(event.target.value);
    highPassEQ.frequency.setTargetAtTime(value, context.currentTime, .01);
  });

  bass.addEventListener('input', (event) => {
    const value = parseInt(event.target.value);
    bassEQ.gain.setTargetAtTime(value, context.currentTime, .01);
  });

  mid.addEventListener('input', (event) => {
    const value = parseInt(event.target.value);
    midEQ.gain.setTargetAtTime(value, context.currentTime, .01);
  });

  treble.addEventListener('input', (event) => {
    const value = parseInt(event.target.value);
    trebleEQ.gain.setTargetAtTime(value, context.currentTime, .01);
  });

  lowPass.addEventListener('input', (event) => {
    const value = Math.abs(event.target.value);
    lowPassEQ.frequency.setTargetAtTime(value, context.currentTime, .01);
  });

  compressorThreshold.addEventListener('input', (event) => {
    const value = -Math.abs(event.target.value);
    compressorNode.threshold.setTargetAtTime(value, context.currentTime, .01);
  });

  compressorRatio.addEventListener('input', (event) => {
    const value = parseInt(event.target.value);
    compressorNode.ratio.setTargetAtTime(value, context.currentTime, .01);
  });

  compressorAttack.addEventListener('input', (event) => {
    const value = parseFloat(event.target.value);
    compressorNode.attack.setTargetAtTime(value, context.currentTime, .01);
  });

  compressorRelease.addEventListener('input', (event) => {
    const value = parseFloat(event.target.value);
    compressorNode.release.setTargetAtTime(value, context.currentTime, .01);
  });

  delay.addEventListener('input', (event) => {
    const value = parseFloat(event.target.value);
    delayNode.delayTime.setTargetAtTime(value, context.currentTime, .01);
  });

  detune.addEventListener('input', (event) => {
    const value = parseInt(event.target.value);
    if (songSource?.detune) {
      songSource.detune.value = value;
    }
  });

  micButton.addEventListener('click', setupAudioContext);

  stopSongButton.addEventListener('click', stopSong);

  songButtons.forEach((songButton) => {
    songButton.addEventListener('click', async (event) => {
      const songIndex = Number(event.currentTarget.dataset.song) - 1;
      const audioBuffer = await loadSong(songIndex);
      setupSongContext(audioBuffer, songIndex);
    });
  });
}

async function setupAudioContext() {
  const audio = await getAudio();
  if (context.state === 'suspended') {
    await context.resume();
  }
  const source = context.createMediaStreamSource(audio);
  connectSource(source);
}

function setupSongContext(buffer, songIndex) {
  if (songSource) {
    songSource.stop();
  }
  const source = context.createBufferSource();
  source.buffer = buffer;
  if (source.detune) {
    source.detune.value = detune.value;
  }
  connectSource(source);
  source.start();
  songSource = source;
  setTimeout(() => {
    stopSongButton.disabled = false;
    songButtons[songIndex].classList.add('active');
  }, 100);
  source.onended = () => {
    songButtons[songIndex].classList.remove('active');
    stopSongButton.disabled = true;
  };
}

function stopSong() {
  if (songSource) {
    songSource.stop();
  }
}

function connectSource(source) {
  source
    .connect(delayNode)
    .connect(compressorNode)
    .connect(highPassEQ)
    .connect(bassEQ)
    .connect(midEQ)
    .connect(trebleEQ)
    .connect(lowPassEQ)
    .connect(gainNode)
    .connect(analyzerNode)
    .connect(context.destination);
}

function getAudio() {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      autoGainControl: false,
      noiseSuppression: false,
      latency: 0,
    },
  });
}

function drawVisualizer() {
  requestAnimationFrame(drawVisualizer);

  const bufferLength = analyzerNode.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  analyzerNode.getByteFrequencyData(dataArray);
  const width = visualizer.width;
  const height = visualizer.height;
  const barWidth = width / bufferLength;

  const canvasContext = visualizer.getContext('2d');
  canvasContext.clearRect(0, 0, width, height);

  dataArray.forEach((item, index) => {
    const y = item / 255 * height / 2;
    const x = barWidth * index;
    canvasContext.fillStyle = `hsl(${y / height * 400}, 100%, 50%)`;
    canvasContext.fillRect(x, height - y, barWidth, y);
  });
}

function resize() {
  visualizer.width = visualizer.clientWidth * window.devicePixelRatio;
  visualizer.height = visualizer.clientHeight * window.devicePixelRatio;
}

function loadSong(songIndex) {
  const urls = [
    'https://upload.wikimedia.org/wikipedia/en/9/92/Israel_Kamakawiwo%27ole_-_Somewhere_Over_The_Rainbow_-_What_A_Wonderful_World.ogg',
    './killingfloor00atsoundcloud.mp3',
  ];
  const url = urls[songIndex];
  if (songBuffers[url]) {
    return Promise.resolve(songBuffers[url]);
  }
  return fetch(url)
    .then(response => response.arrayBuffer())
    .then(arrayBuffer =>
      context.decodeAudioData(
        arrayBuffer,
        (buffer) => Promise.resolve(buffer)
      )
    )
    .then(audioBuffer => {
      songBuffers[url] = audioBuffer;
      return audioBuffer;
    });
}
