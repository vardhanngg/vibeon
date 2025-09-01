let lastPlaylistId = null;
//const axios = require('axios');
import express from 'express';

const { PLAYLIST_SEARCH_ENDPOINT, PLAYLIST_SONGS_ENDPOINT, SEARCH_ENDPOINT } = require('../public/config');
;
import { PLAYLIST_SEARCH_ENDPOINT, PLAYLIST_SONGS_ENDPOINT, SEARCH_ENDPOINT } from '../public/config';
;

module.exports = async function handler(req, res) {
  // Ensure JSON response
  res.setHeader('Content-Type', 'application/json');

  try {
    const { mood } = req.query;
    if (!mood || typeof mood !== 'string') {
      console.error('[server] Invalid or missing mood parameter:', mood);
      return res.status(400).json({ error: 'Mood is required and must be a string' });
    }

    console.log(`[server] Searching playlists for mood: ${mood}`);
    // Step 1: Search for playlists
    let searchRes;
    try {
      searchRes = await axios.get(`${PLAYLIST_SEARCH_ENDPOINT}?query=${encodeURIComponent(mood)}&page=0&limit=10`);
    } catch (apiErr) {
      console.error(`[server] Playlist search API error: ${apiErr.message}`);
      throw new Error(`Playlist search failed: ${apiErr.message}`);
    }

    // Check for API error response
    if (!searchRes.data || searchRes.data.success === false) {
      console.error(`[server] Playlist search API returned error: ${JSON.stringify(searchRes.data.error || searchRes.data)}`);
      throw new Error('No valid playlists found for this mood');
    }

    // Validate playlist response structure
    if (!Array.isArray(searchRes.data.data?.results)) {
      console.error(`[server] Invalid playlist search response structure: ${JSON.stringify(searchRes.data)}`);
      throw new Error('Invalid playlist search response');
    }

    const playlists = searchRes.data.data.results;
    if (playlists.length === 0) {
      console.log(`[server] No playlists found for query: ${mood}`);
      throw new Error('No playlists found for this mood');
    }

    // Step 2: Select a playlist (highest songCount or first valid)
    // New random selection logic avoiding last played playlist
function getRandomPlaylist(playlists, lastId) {
  const filtered = playlists.filter(p => p.id !== lastId);
  if (filtered.length === 0) return playlists[0]; // fallback if no other playlists
  const randomIndex = Math.floor(Math.random() * filtered.length);
  return filtered[randomIndex];
}

const selectedPlaylist = getRandomPlaylist(playlists, lastPlaylistId);
lastPlaylistId = selectedPlaylist.id;

    const playlistId = selectedPlaylist.id;
    if (!playlistId) {
      console.error('[server] Selected playlist missing ID:', selectedPlaylist);
      throw new Error('Invalid playlist ID');
    }
    console.log(`[server] Selected playlist ID: ${playlistId}, Name: ${selectedPlaylist.name}`);

    // Step 3: Fetch songs from the selected playlist
    let playlistRes;
    try {
      playlistRes = await axios.get(`${PLAYLIST_SONGS_ENDPOINT}?id=${encodeURIComponent(playlistId)}&page=0&limit=10`);
    } catch (apiErr) {
      console.error(`[server] Playlist songs API error for ID ${playlistId}: ${apiErr.message}`);
      throw new Error(`Playlist songs fetch failed: ${apiErr.message}`);
    }

    // Check for API error response
    if (!playlistRes.data || playlistRes.data.success === false) {
      console.error(`[server] Playlist songs API returned error: ${JSON.stringify(playlistRes.data.message || playlistRes.data)}`);
      throw new Error('No valid songs found in this playlist');
    }

    // Validate song response structure
    const songs = playlistRes.data.data?.songs || [];
    if (!Array.isArray(songs)) {
      console.error(`[server] Invalid playlist songs response structure: ${JSON.stringify(playlistRes.data)}`);
      throw new Error('Invalid playlist songs response');
    }
    if (songs.length === 0) {
      console.log(`[server] No songs found in playlist ID: ${playlistId}`);
      throw new Error('No songs found in this playlist');
    }

    // Step 4: Format the response
    res.status(200).json({
      songs: {
        results: songs.map(song => ({
          id: song.id || 'unknown',
          title: song.name || song.title || 'Unknown',
          artist: Array.isArray(song.artists?.primary)
            ? song.artists.primary.map(artist => artist.name || 'Unknown').join(', ')
            : typeof song.artists?.primary === 'string'
              ? song.artists.primary
              : 'Unknown',
          image: song.image?.find(img => img.quality === '500x500')?.url
            || song.image?.[0]?.url
            || song.image?.[0]?.link
            || null,
          audioUrl: song.downloadUrl?.find(url => url.quality === '320kbps')?.url
            || song.downloadUrl?.find(url => url.quality === '320kbps')?.link
            || song.downloadUrl?.[0]?.url
            || song.downloadUrl?.[0]?.link
            || song.url
            || null,
        })),
        playlist: {
          id: selectedPlaylist.id,
          name: selectedPlaylist.name || 'Unknown',
          image: selectedPlaylist.image?.find(img => img.quality === '500x500')?.url
            || selectedPlaylist.image?.[0]?.url
            || selectedPlaylist.image?.[0]?.link
            || null,
        }
      }
    });
  } catch (err) {
    console.error('[server] songByMood error:', err.message);
    // Fallback to JioSaavn
    try {
      console.log(`[server] Falling back to JioSaavn for query: ${mood}`);
      const fallbackRes = await axios.get(`${SEARCH_ENDPOINT}?query=${encodeURIComponent(mood)}`);
      if (!fallbackRes.data || !Array.isArray(fallbackRes.data.data?.results)) {
        console.error(`[server] Invalid JioSaavn response: ${JSON.stringify(fallbackRes.data)}`);
        throw new Error('Invalid JioSaavn response');
      }

      const songs = fallbackRes.data.data.results;
      if (songs.length === 0) {
        throw new Error('No songs found in fallback search');
      }

      res.status(200).json({
        songs: {
          results: songs.map(song => ({
            id: song.id || 'unknown',
            title: song.name || song.title || 'Unknown',
            artist: typeof song.primaryArtists === 'string'
              ? song.primaryArtists
              : Array.isArray(song.primaryArtists)
                ? song.primaryArtists.join(', ')
                : Array.isArray(song.artists?.primary)
                  ? song.artists.primary.map(a => a.name || 'Unknown').join(', ')
                  : 'Unknown',
            image: song.image?.find(img => img.quality === '500x500')?.url
              || song.image?.find(img => img.quality === '500x500')?.link
              || song.image?.[2]?.link
              || song.image?.[0]?.url
              || null,
            audioUrl: song.downloadUrl?.find(url => url.quality === '320kbps')?.link
              || song.downloadUrl?.find(url => url.quality === '320kbps')?.url
              || song.downloadUrl?.[0]?.link
              || song.downloadUrl?.[0]?.url
              || song.url
              || null,
          })),
          playlist: null // No playlist info in fallback
        }
      });
    } catch (fallbackErr) {
      console.error('[server] JioSaavn fallback error:', fallbackErr.message);
      res.status(500).json({ error: 'Internal server error', details: err.message });
    }
  }
};
