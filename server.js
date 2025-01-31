import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import path from "path";
import os from "os";

import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getServerIP = () => {
    const interfaces = os.networkInterfaces();
    for (const devName in interfaces) {
        const iface = interfaces[devName];
        for (const alias of iface) {
            if (alias.family === "IPv4" && !alias.internal) {
            return alias.address;
            }
        }
    }
    return "localhost";
};

const SERVER_IP_PREFIX = getServerIP();
let SERVER_IP = "";
if (SERVER_IP_PREFIX.includes("192.168")){
    SERVER_IP = "localhost"
} else {
    SERVER_IP = SERVER_IP_PREFIX;
}

dotenv.config();

const app = express();
const PORT = 5000;

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = `http://${SERVER_IP}:${PORT}/callback`;

let spotifyAccessToken = "";

// **GET** `/spotify` untuk memulai proses OAuth
app.get("/spotify", (req, res) => {
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(
        REDIRECT_URI
    )}&scope=user-read-currently-playing`;
  
    // Arahkan langsung ke URL Spotify OAuth
    res.redirect(authUrl);
});  

// **GET** `/callback` untuk menangkap kode OAuth dari Spotify
app.get("/callback", async (req, res) => {
  const code = req.query.code;

  try {
    const response = await axios.post(
      "https://accounts.spotify.com/api/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    spotifyAccessToken = response.data.access_token;
    res.redirect('/lyrics');
  } catch (error) {
    res.status(500).json({ error: "Gagal mendapatkan token akses", details: error.message });
  }
});

// **GET** `/lyrics/current`
app.get("/lyrics/current", async (req, res) => {
  if (!spotifyAccessToken) {
    return res.status(401).json({ error: "Belum login ke Spotify" });
  }

  try {
    const nowPlaying = await axios.get(
      "https://api.spotify.com/v1/me/player/currently-playing",
      {
        headers: {
          Authorization: `Bearer ${spotifyAccessToken}`,
        },
      }
    );

    const track = nowPlaying.data.item;
    const title = track.name;
    const artist = track.artists[0].name;

    const lyricsResponse = await axios.get(`https://api.lyrics.ovh/v1/${artist}/${title}`);

    res.json({
      title,
      artist,
      lyrics: lyricsResponse.data.lyrics || "Lirik tidak ditemukan",
    });
  } catch (error) {
    res.status(500).json({ error: "Gagal mengambil lirik lagu", details: error.message });
  }
});

app.get("/lyrics", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "lyrics.html"));
});

app.listen(PORT, () => {
  console.log(`Server berjalan di: http://${SERVER_IP}:${PORT}/spotify`);
  console.log(`Akses /spotify untuk memulai proses login.`);
});
