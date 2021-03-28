const volume = document.querySelector('#volume');
const bass = document.querySelector('#bass');
const mid = document.querySelector('#mid');
const treble = document.querySelector('#treble');
const compressorThreshold = document.querySelector('#compressor-threshold');
const compressorRatio = document.querySelector('#compressor-ratio');
const compressorAttack = document.querySelector('#compressor-attack');
const compressorRelease = document.querySelector('#compressor-release');
const delay = document.querySelector('#delay');
const detune = document.querySelector('#detune');
const song = document.querySelector('#song');
const visualizer = document.querySelector('#visualizer');

const context = new AudioContext();
const analyzerNode = new AnalyserNode(context, { fftSize: 256 });
const gainNode = new GainNode(context, { gain: volume.value });
const bassEQ = new BiquadFilterNode(context, {
  type: 'lowshelf',
  frequency: 500,
  gain: bass.value,
});
const midEQ = new BiquadFilterNode(context, {
  type: 'peaking',
  Q: Math.SQRT1_2,
  frequency: 1500,
  gain: mid.value,
});
const trebleEQ = new BiquadFilterNode(context, {
  type: 'highshelf',
  frequency: 3000,
  gain: treble.value,
});
const compressorNode = new DynamicsCompressorNode(context, {
  threshold: -Math.abs(compressorThreshold.value),
  ratio: compressorRatio.value,
  attack: compressorAttack.value,
  release: compressorRelease.value,
});
const delayNode = new DelayNode(context, {
  delayTime: delay.value,
});

let songSource;

setupEventListeners()
setupAudioContext();
resize();
drawVisualizer();

function setupEventListeners() {
  window.addEventListener('resize', resize);

  volume.addEventListener('input', (event) => {
    const value = parseFloat(event.target.value);
    gainNode.gain.setTargetAtTime(value, context.currentTime, .01);
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

  song.addEventListener('click', async () => {
    const audioBuffer = await loadSong();
    setupSongContext(audioBuffer);
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

function setupSongContext(buffer) {
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.detune.value = detune.value;
  connectSource(source);
  source.start();
  songSource = source;
  song.disabled = true;
  source.onended = () => {
    song.disabled = false;
  };
}

function connectSource(source) {
  source
    .connect(delayNode)
    .connect(compressorNode)
    .connect(trebleEQ)
    .connect(midEQ)
    .connect(bassEQ)
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
  visualizer.width = visualizer.clientWidth;
  visualizer.height = visualizer.clientHeight;
}

function loadSong() {
  const url = 'https://upload.wikimedia.org/wikipedia/en/9/92/Israel_Kamakawiwo%27ole_-_Somewhere_Over_The_Rainbow_-_What_A_Wonderful_World.ogg';
  return fetch(url)
    .then(response => response.arrayBuffer())
    .then(arrayBuffer => context.decodeAudioData(arrayBuffer));
}
