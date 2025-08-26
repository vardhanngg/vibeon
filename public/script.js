let lastPlayedSongId = null; // Cache to track the last played song's ID
let lastPlayedAudioUrl = null; // Cache to track the last played song's Audio URL

const startBtn = document.getElementById('startBtn');
const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const emotionDisplay = document.getElementById('emotion-display');
const changeSongBtn = document.getElementById('changeSongBtn');
const testMoodSelect = document.getElementById('testMood');
const languageSelect = document.getElementById('languageSelect');
const musicPlayer = document.getElementById('musicPlayer');

let detectedMood = null; // Will hold mood detected by face-api
let faceApiModelsLoaded = false;

// Simplified emotion map with mood templates
const emotionMap = {
  happy: '{lang} party songs',
  sad: '{lang} breakup songs',
  angry: '{lang} item songs',
  neutral: '{lang} love songs',
  surprised: '{lang} mass songs',
  disgusted: '{lang} instrumental songs',
  fearful: '{lang} romantic songs',
};

async function loadFaceApiModels() {
  const MODEL_URL = '/public/models'; // Adjust if your models are in a different folder
  try {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
    ]);
    faceApiModelsLoaded = true;
    console.log('Face API models loaded');
  } catch (err) {
    console.error('Error loading Face API models:', err);
    emotionDisplay.textContent = 'Failed to load face detection models.';
  }
}

async function startVideo() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
    video.srcObject = stream;
  } catch (err) {
    console.error('Error accessing camera:', err);
    emotionDisplay.textContent = 'Camera access denied or not available.';
  }
}

async function detectMoodFromFace() {
  if (!faceApiModelsLoaded) {
    console.log('Face API models not loaded yet');
    return;
  }

  try {
    const detections = await faceapi
      .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceExpressions();

    if (detections.length > 0) {
      const expressions = detections[0].expressions;
      // Find the dominant expression
      const maxExpression = Object.keys(expressions).reduce((a, b) =>
        expressions[a] > expressions[b] ? a : b
      );
      detectedMood = maxExpression;
      emotionDisplay.textContent = `Detected mood: ${detectedMood}`;
    } else {
      emotionDisplay.textContent = 'No face detected.';
    }
  } catch (err) {
    console.error('Error detecting mood:', err);
    emotionDisplay.textContent = 'Error detecting mood.';
  }
}

async function fetchSongByMood() {
  let mood = testMoodSelect.value;
  const language = languageSelect.value || 'english';

  if (mood === 'auto') {
    mood = detectedMood;
  }

  if (!mood || mood === 'auto' || !emotionMap[mood]) {
    emotionDisplay.textContent = 'Please select a valid mood or wait for detection.';
    return;
  }

  // Replace `{lang}` with the selected language in the song genre query
  const query = emotionMap[mood].replace('{lang}', language);
  emotionDisplay.textContent = `Searching for: ${query}`;

  try {
    const response = await fetch(`/api/songByMood?mood=${encodeURIComponent(query)}`);
    const data = await response.json();

    if (!data.songs || data.songs.results.length === 0) {
      emotionDisplay.textContent = 'No songs found for this mood and language.';
      return;
    }

    const songs = data.songs.results;

    // Pick a random song from the array
    let randomIndex;
    let song;
    let audioUrl;

    // Pick a new song, not previously played
    do {
      randomIndex = Math.floor(Math.random() * songs.length);
      song = songs[randomIndex];
      audioUrl = song.audioUrl;

      // Check if this song was already played (by comparing ID and Audio URL)
    } while (song.id === lastPlayedSongId || audioUrl === lastPlayedAudioUrl);

    if (!audioUrl) {
      emotionDisplay.textContent = 'No playable audio found.';
      return;
    }

    // Play the song
    musicPlayer.src = audioUrl;
    musicPlayer.play();

    emotionDisplay.textContent = `Playing: ${song.title} by ${song.artist}`;

    // Cache the last played song's ID and audio URL
    lastPlayedSongId = song.id;
    lastPlayedAudioUrl = audioUrl;

  } catch (error) {
    console.error('Error fetching song:', error);
    emotionDisplay.textContent = 'Failed to fetch song.';
  }
}

// Setup event listeners
startBtn.addEventListener('click', async () => {
  await loadFaceApiModels();
  await startVideo();

  // Start detecting mood every 3 seconds
  setInterval(detectMoodFromFace, 3000);
});

changeSongBtn.addEventListener('click', fetchSongByMood);
testMoodSelect.addEventListener('change', fetchSongByMood);
languageSelect.addEventListener('change', fetchSongByMood);

