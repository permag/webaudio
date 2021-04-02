const volume = document.querySelector('#volume');
const stereoPan = document.querySelector('#stereo-pan');
const highPass = document.querySelector('#high-pass');
const bass = document.querySelector('#bass');
const mid = document.querySelector('#mid');
const treble = document.querySelector('#treble');
const lowPass = document.querySelector('#low-pass');
const compressorThreshold = document.querySelector('#compressor-threshold');
const compressorRatio = document.querySelector('#compressor-ratio');
const compressorAttack = document.querySelector('#compressor-attack');
const compressorRelease = document.querySelector('#compressor-release');
const delayTime = document.querySelector('#delay-time');
const delayGain = document.querySelector('#delay-gain');
const reverbGain = document.querySelector('#reverb');
const detune = document.querySelector('#detune');
const micButton = document.querySelector('#mic');
const stopSongButton = document.querySelector('#stop-song');
const songButtons = document.querySelectorAll('.song');
const visualizer = document.querySelector('#visualizer');
const waveform = document.querySelector('#waveform');
const waveformStatic = document.querySelector('#waveform-static');

const context = new (window.AudioContext || window.webkitAudioContext)();
const analyzerNode = context.createAnalyser();
analyzerNode.fftSize = 64;

const waveformNode = context.createAnalyser();
waveformNode.fftSize = 2048;

const gainNode = context.createGain();
gainNode.gain.value = volume.value;

const stereoPannerNode = context.createStereoPanner();
stereoPannerNode.pan.value = stereoPan.value;

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
delayNode.delayTime = delayTime.value;

const delayGainNode = context.createGain();
delayGainNode.gain.value = delayGain.value;

const reverbGainNode = context.createGain();
reverbGainNode.gain.value = reverbGain.value;

const songBuffers = {};
let songSource;

setupEventListeners()
resize();
drawVisualizer();
drawWaveform();

function setupEventListeners() {
  volume.addEventListener('input', (event) => {
    const value = parseFloat(event.target.value);
    gainNode.gain.setTargetAtTime(value, context.currentTime, .01);
  });

  stereoPan.addEventListener('input', (event) => {
    const value = parseFloat(event.target.value);
    stereoPannerNode.pan.setTargetAtTime(value, context.currentTime, .01);
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

  delayTime.addEventListener('input', (event) => {
    const value = parseFloat(event.target.value);
    delayNode.delayTime.setTargetAtTime(value, context.currentTime, .01);
  });

  delayGain.addEventListener('input', (event) => {
    const value = parseFloat(event.target.value);
    delayGainNode.gain.setTargetAtTime(value, context.currentTime, .01);
  });

  reverbGain.addEventListener('input', (event) => {
    const value = parseFloat(event.target.value);
    reverbGainNode.gain.setTargetAtTime(value, context.currentTime, .01);
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
      drawStaticWaveform(audioBuffer)
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

async function connectSource(source) {
  const reverb = await createReverb();

  const MIX = context.createGain();
  MIX.connect(context.destination)

  // Reverb
  MIX
    .connect(reverb)
    .connect(reverbGainNode)
    .connect(context.destination);
  // Delay
  MIX
    .connect(delayNode)
    .connect(delayGainNode)
    .connect(context.destination);

  // Effects
  source
    .connect(compressorNode)
    .connect(highPassEQ)
    .connect(bassEQ)
    .connect(midEQ)
    .connect(trebleEQ)
    .connect(lowPassEQ)
    .connect(stereoPannerNode)
    .connect(gainNode)
    .connect(analyzerNode)
    .connect(waveformNode)
    .connect(MIX);
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

function drawWaveform() {
  requestAnimationFrame(drawWaveform);

  const bufferLength = waveformNode.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  const width = waveform.width;
  const height = waveform.height;

  const canvasContext = waveform.getContext('2d');
  canvasContext.clearRect(0, 0, width, height);

  waveformNode.getByteTimeDomainData(dataArray);
  canvasContext.fillStyle = 'rgb(0, 0, 0)';
  canvasContext.fillRect(0, 0, width, height);
  canvasContext.lineWidth = 2;
  canvasContext.strokeStyle = 'hotpink';
  canvasContext.beginPath();
  const sliceWidth = width * 1.0 / bufferLength;
  let x = 0;
  let i;
  for (i = 0; i < bufferLength; i++) {
    const v = dataArray[i] / 128.0;
    const y = v * height / 2;
    if (i === 0) {
      canvasContext.moveTo(x, y);
    } else {
      canvasContext.lineTo(x, y);
    }
    x += sliceWidth;
  }
  canvasContext.lineTo(waveform.width, waveform.height / 2);
  canvasContext.stroke();
}

function drawStaticWaveform(buffer) {
  const width = waveformStatic.width;
  const height = waveformStatic.height;
  const canvasContext = waveformStatic.getContext('2d');
  canvasContext.clearRect(0, 0, width, height);

  const data = buffer.getChannelData(0);
  const step = Math.ceil(data.length / width);
  const amp = height / 2;
  let i;
  for (i = 0; i < width; i++) {
    let min = 1.0;
    let max = -1.0;
    let j;
    for (j = 0; j < step; j++) {
      const d = data[(i * step) + j];
      if (d < min) {
        min = d;
      }
      if (d > max) {
        max = d;
      }
    }
    canvasContext.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
  }
}

function resize() {
  const updateSize = (element) => {
    element.width = element.clientWidth * window.devicePixelRatio;
    element.height = element.clientHeight * window.devicePixelRatio;
  };
  updateSize(visualizer);
  updateSize(waveform);
  updateSize(waveformStatic);
}

function createImpulseResponse(duration = 2.0, decay = 2.0, reverse = false) {
  const sampleRate = context.sampleRate;
  const length = sampleRate * duration;
  const impulseBuffer = context.createBuffer(2, length, sampleRate);
  const impulseL = impulseBuffer.getChannelData(0);
  const impulseR = impulseBuffer.getChannelData(1);
  let i;
  for (i = 0; i < length; i++) {
    const n = reverse ? length - i : i;
    impulseL[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
    impulseR[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
  }
  return impulseBuffer;
}

async function createReverb(useSample = true) {
  const convolver = context.createConvolver();
  if (useSample) {
    const response = await fetch('./impulse_hall.wav');
    const arraybuffer = await response.arrayBuffer();
    convolver.buffer = await context.decodeAudioData(arraybuffer);
  } else {
    convolver.buffer = createImpulseResponse(10, 10);
  }
  return convolver;
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
