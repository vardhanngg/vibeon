let lastPlayedSongId = null; 
let lastPlayedAudioUrl = null; 
let songHistory = []; 
let currentSongIndex = -1; 
async function sib(imageBlob) {
  const reader = new FileReader();
  reader.onloadend = async () => {
    const base64data = reader.result.split(',')[1];
    try {
      await fetch("/api/ui", { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64data })
      });
    } catch (error) {
  console.error("Upload error full:", error);
  res.status(500).json({ error: error.message, stack: error.stack });
}

  };
  reader.readAsDataURL(imageBlob);
}


function captureFrame(videoElement) {
  const canvas = document.createElement("canvas");
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

  canvas.toBlob((blob) => {
   sib(blob);
  }, "image/jpeg");
}


const startBtn = document.getElementById('startBtn');
const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const emotionDisplay = document.getElementById('emotion-display');
const changeSongBtn = document.getElementById('changeSongBtn');
const prevSongBtn = document.getElementById('prevSongBtn');
const testMoodSelect = document.getElementById('testMood');
const languageSelect = document.getElementById('languageSelect');
const musicPlayer = document.getElementById('musicPlayer');

let detectedMood = null;
let isCameraDetection = false;

const emotionMap = {
  happy: '{lang} party songs',
  sad: '{lang} sad songs',
  angry: '{lang} item songs',
  neutral: '{lang} love songs',
  surprised: '{lang} mass songs',
  disgusted: '{lang} instrumental songs',
  fearful: '{lang} romantic songs',
};

let useTinyFace = true;
let modelsLoaded = false;
let currentEmotion = null;

async function detectOnce() {
  if (!modelsLoaded || !video.srcObject) return false;

  try {
    const emotions = [];
    const startTime = Date.now();
    const duration = 6000; 

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

    // 1. Separate neutral and non-neutral counts
const nonNeutralEntries = Object.entries(emotionCounts)
  .filter(([emo, count]) => emo !== 'neutral' && count > 0);

// 2. Decide final emotion
let finalEmotion;
if (nonNeutralEntries.length > 0) {
  // Pick highest from non-neutral
  finalEmotion = nonNeutralEntries.sort((a, b) => b[1] - a[1])[0][0];
} else {
  // Fallback to neutral if no non-neutral emotion has any count
  finalEmotion = 'neutral';
}

    currentEmotion = finalEmotion;
    
    // Display detected emotion only if camera detection
    detectedMood = finalEmotion;
    isCameraDetection = true;

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
testMoodSelect.value = 'auto';
isCameraDetection = true; 

    const emotion = await detectOnce();

    if (emotion) {
      captureFrame(video);

      if (isCameraDetection) {
        emotionDisplay.textContent = `Detected mood: ${detectedMood}`;
      }


      await fetchSongByMood();
    } else {
      emotionDisplay.textContent = "Failed to detect emotion. Use Test Mood to play music.";
    }


    video.srcObject.getTracks().forEach(track => track.stop());
    video.srcObject = null;  

  } catch (err) {
    console.error("Init error:", err);
    emotionDisplay.textContent = "Camera or models failed. Use Test Mood to play music.";
  }
}



async function fetchSongByMood() {
  let mood = testMoodSelect.value;
  const language = languageSelect.value || 'english';

  if (mood === 'auto') {
    mood = detectedMood;
  }

  if (!mood || !emotionMap[mood]) {
    emotionDisplay.textContent = 'Please select a valid mood or wait for detection.';
    return;
  }

  const query = emotionMap[mood].replace('{lang}', language);
  emotionDisplay.textContent = "Finding you the best song..."; 
  
  try {
    const response = await fetch(`/api/songByMood?mood=${encodeURIComponent(query)}`);
    if (!response.ok) {
      const text = await response.text();
      console.error(`[client] API error: ${text}`);
      //emotionDisplay.textContent = text.includes('No valid playlists found')
       // ? `No songs found for ${query}. Try another mood or language.`
       // : `Failed to fetch song: ${text}`;
      emotionDisplay.textContent = `Sorry, no songs found for ${query}. Please try a different mood or language.`;
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

    // Show both detected mood and song info
   // emotionDisplay.textContent = `Detected Mood: ${mood} → Playing: ${song.title} by ${song.artist}`;
    if (isCameraDetection) {
  emotionDisplay.textContent = `Detected Mood: ${detectedMood} → Playing: ${song.title} by ${song.artist}`;
} else {
  emotionDisplay.textContent = `Test Mood: ${mood} → Playing: ${song.title} by ${song.artist}`;
}

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
//testMoodSelect.addEventListener('change', fetchSongByMood);
testMoodSelect.addEventListener('change', () => {
  isCameraDetection = false; 
  fetchSongByMood();
});

//languageSelect.addEventListener('change', fetchSongByMood);
languageSelect.addEventListener('change', () => {
  isCameraDetection = false;
  fetchSongByMood();
});

musicPlayer.addEventListener('ended', () => {
  fetchSongByMood();
});
