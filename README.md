# VIBRON
Overview

This is an intelligent music player application that uses facial emotion recognition to detect the user's mood in real-time and dynamically suggests or plays songs that match or elevate their emotional state. The goal is to create a deeply personalized and empathetic music experience, enhancing how users interact with their music libraries or streaming platforms.

Key Features
1. Facial Emotion Detection

Uses the webcam (or device camera) to capture the user's face.

Employs computer vision and machine learning (e.g., CNNs or pretrained models like OpenCV + DeepFace, MediaPipe, or Affectiva) to detect facial expressions.

Recognizes core emotions such as:

Happy 😊

Sad 😢

Angry 😠

Surprised 😮

Neutral 😐

Fear 😨

Disgust 😒

2. Mood-Based Song Recommendations

Based on the detected emotion, the app:

Plays songs that match the mood.
