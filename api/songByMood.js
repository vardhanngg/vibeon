const axios = require('axios');

module.exports = async function handler(req, res) {
  try {
    const { mood } = req.query;
    if (!mood) {
      return res.status(400).json({ error: 'Mood is required' });
    }

    console.log(`[server] Searching songs for mood: ${mood}`);
    const searchRes = await axios.get(`https://jiosaavn-api-privatecvc2.vercel.app/search/songs?query=${encodeURIComponent(mood)}`);
    const songs = searchRes.data.data?.results || [];
    if (songs.length === 0) {
      return res.status(404).json({ error: 'No songs found for this mood' });
    }

    res.status(200).json({
      songs: {
        results: songs.map(song => ({
          id: song.id,
          title: song.name,
          artist: typeof song.primaryArtists === 'string' ? song.primaryArtists : song.primaryArtists?.join(", ") || "Unknown",
          image: song.image?.[2]?.link || null,
          audioUrl: song.downloadUrl?.find(url => url.quality === '320kbps')?.link || song.downloadUrl?.[0]?.link || null,
        }))
      }
    });
  } catch (err) {
    console.error('[server] songByMood error:', err.message);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
};

