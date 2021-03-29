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

const context = new AudioContext();
const analyzerNode = new AnalyserNode(context, { fftSize: 256 });
const gainNode = new GainNode(context, { gain: volume.value });
const highPassEQ = new BiquadFilterNode(context, {
  type: 'highpass',
  Q: Math.SQRT1_2,
  frequency: highPass.value,
});
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
const lowPassEQ = new BiquadFilterNode(context, {
  type: 'lowpass',
  Q: Math.SQRT1_2,
  frequency: Math.abs(lowPass.value),
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
  source.detune.value = detune.value;
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

  return fetch(urls[songIndex])
    .then(response => response.arrayBuffer())
    .then(arrayBuffer => context.decodeAudioData(arrayBuffer));
}
