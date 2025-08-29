let lastPlayedSongId = null; // Cache to track the last played song's ID
let lastPlayedAudioUrl = null; // Cache to track the last played song's Audio URL
let songHistory = []; // Array to store history of played songs
let currentSongIndex = -1; // Track current position in song history

const startBtn = document.getElementById('startBtn');
const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const emotionDisplay = document.getElementById('emotion-display');
const changeSongBtn = document.getElementById('changeSongBtn');
const prevSongBtn = document.getElementById('prevSongBtn');
const testMoodSelect = document.getElementById('testMood');
const languageSelect = document.getElementById('languageSelect');
const musicPlayer = document.getElementById('musicPlayer');

let detectedMood = null; // Will hold mood detected by face-api

// Simplified emotion map with mood templates
const emotionMap = {
  happy: '{lang} party songs',
  sad: '{lang} sad songs',
  angry: '{lang} item songs',
  neutral: '{lang} love songs',
  surprised: '{lang} mass songs',
  disgusted: '{lang} instrumental songs',
  fearful: '{lang} romantic songs',
};

// --- NEW robust face detection code ---
let useTinyFace = true;
let modelsLoaded = false;
let currentEmotion = null;

async function detectOnce() {
  if (!modelsLoaded || !video.srcObject) return false;

  try {
    const emotions = [];
    const startTime = Date.now();
    const duration = 6000; // 6 seconds

    while (Date.now() - startTime < duration) {
      let detections;
      if (useTinyFace) {
        detections = await faceapi
          .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.2 }))
          .withFaceExpressions();
      } else {
        detections = await faceapi
          .detectAllFaces(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.1 }))
          .withFaceExpressions();
      }

      if (detections.length) {
        const expr = detections[0].expressions;
        const top = Object.entries(expr).sort((a, b) => b[1] - a[1])[0][0];
        emotions.push(top);
        emotionDisplay.textContent = `Detecting emotion... (${top})`;
      } else {
        emotions.push("neutral");
        emotionDisplay.textContent = "No face detected";
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const emotionCounts = emotions.reduce((acc, emo) => {
      acc[emo] = (acc[emo] || 0) + 1;
      return acc;
    }, {});

    const finalEmotion = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "neutral";
    currentEmotion = finalEmotion;
    emotionDisplay.textContent = `Detected mood: ${finalEmotion}`;
    return finalEmotion;
  } catch (err) {
    console.error("Detection error:", err);
    emotionDisplay.textContent = "Error detecting mood.";
    return false;
  }
}

async function startAll() {
  try {
    emotionDisplay.textContent = "Loading models...";
    await faceapi.tf.setBackend("cpu");
    await faceapi.tf.ready();

    try {
      await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
      useTinyFace = true;
    } catch (e) {
      console.warn("tinyFace load failed, trying ssd:", e.message);
      await faceapi.nets.ssdMobilenetv1.loadFromUri("/models");
      useTinyFace = false;
    }
    await faceapi.nets.faceExpressionNet.loadFromUri("/models");
    modelsLoaded = true;

    emotionDisplay.textContent = "Requesting camera...";
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
    video.srcObject = stream;

    await new Promise((r) => (video.onloadedmetadata = r));
    await video.play();

    emotionDisplay.textContent = "Detecting emotion...";
    const emotion = await detectOnce();

    if (emotion) {
      detectedMood = emotion;
      await fetchSongByMood();
    } else {
      emotionDisplay.textContent = "Failed to detect emotion. Use Test Mood to play music.";
    }

    // Stop camera after detection to save resources
    video.srcObject.getTracks().forEach(track => track.stop());
    video.srcObject = null;  // Remove stream from video element

  } catch (err) {
    console.error("Init error:", err);
    emotionDisplay.textContent = "Camera or models failed. Use Test Mood to play music.";
  }
}

// --- END of new face detection ---

// Existing fetchSongByMood and playPreviousSong remain unchanged:

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
  const query = emotionMap[mood].replace('{lang}', language);
  emotionDisplay.textContent = "Finding You the best song...";
  try {
    const response = await fetch(`/api/songByMood?mood=${encodeURIComponent(query)}`);
    if (!response.ok) {
      const text = await response.text();
      console.error(`[client] API error: ${text}`);
      emotionDisplay.textContent = text.includes('No valid playlists found')
        ? `No songs found for ${query}. Try another mood or language.`
        : `Failed to fetch song: ${text}`;
      return;
    }
    const data = await response.json();
    if (!data.songs || data.songs.results.length === 0) {
      emotionDisplay.textContent = 'No songs found for this mood and language.';
      return;
    }
    const songs = data.songs.results;
    let song, audioUrl;
    let attempts = 0;
    const maxAttempts = songs.length * 2;
    do {
      const randomIndex = Math.floor(Math.random() * songs.length);
      song = songs[randomIndex];
      audioUrl = song.audioUrl;
      attempts++;
    } while (
      (song.id === lastPlayedSongId || audioUrl === lastPlayedAudioUrl) &&
      attempts < maxAttempts
    );
    if (!audioUrl) {
      emotionDisplay.textContent = 'No playable audio found.';
      return;
    }
    // Add song to history
    songHistory.push({ id: song.id, audioUrl: audioUrl, title: song.title, artist: song.artist });
    currentSongIndex = songHistory.length - 1;
    // Update last played
    lastPlayedSongId = song.id;
    lastPlayedAudioUrl = audioUrl;
    // Play song
    musicPlayer.src = audioUrl;
    musicPlayer.play();
    emotionDisplay.textContent = `Playing: ${song.title} by ${song.artist}`;
  } catch (error) {
    console.error('[client] Error fetching song:', error.message);
    emotionDisplay.textContent = `Failed to fetch song: ${error.message}`;
  }
}

async function playPreviousSong() {
  if (currentSongIndex <= 0) {
    emotionDisplay.textContent = 'No previous song available.';
    return;
  }
  currentSongIndex--;
  const prevSong = songHistory[currentSongIndex];
  lastPlayedSongId = prevSong.id;
  lastPlayedAudioUrl = prevSong.audioUrl;
  musicPlayer.src = prevSong.audioUrl;
  musicPlayer.play();
  emotionDisplay.textContent = `Playing: ${prevSong.title} by ${prevSong.artist}`;
}

// Event listeners updated to use new detection logic
startBtn.addEventListener('click', async () => {
  await startAll();  // Use robust start with 6s detection
});

changeSongBtn.addEventListener('click', fetchSongByMood);
prevSongBtn.addEventListener('click', playPreviousSong);
testMoodSelect.addEventListener('change', fetchSongByMood);
languageSelect.addEventListener('change', fetchSongByMood);

musicPlayer.addEventListener('ended', () => {
  fetchSongByMood();
});
