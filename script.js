// Theme Management
(function () {
  const body = document.body;

  function applyTheme(mode) {
      body.classList.remove("light", "dark");
      body.classList.add(mode);
      localStorage.setItem("theme", mode);
  }

  window.toggleTheme = function () {
      const current = localStorage.getItem("theme") || "dark";
      const next = current === "light" ? "dark" : "light";
      applyTheme(next);
  };

  const savedTheme = localStorage.getItem("theme") || "dark";
  applyTheme(savedTheme);
})();

// AWS Configuration
AWS.config.region = "eu-north-1";
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
  IdentityPoolId: "eu-north-1:ea9bd0f8-6a25-4ec1-9be6-4e0b7409344e"
});

AWS.config.credentials.get((err) => {
  if (err) {
      console.error("Cognito Authentication Error:", err);
      alert("Failed to authenticate with AWS Cognito.");
  } else {
      console.log("Cognito Authentication Successful");
      if (typeof listSongs === "function") listSongs();
      if (typeof initUploader === "function") initUploader();
  }
});

const s3 = new AWS.S3();
let currentSongIndex = 0;
let songList = [];

// Fetch & List Songs
function listSongs() {
  const playlist = document.getElementById("playlist");
  if (!playlist) return;

  s3.listObjectsV2({ Bucket: "cloudjukebox" }, (err, data) => {
      if (err) {
          console.error("Error loading playlist:", err);
          playlist.innerHTML = "<li>Error loading songs</li>";
          return;
      }

      playlist.innerHTML = "";
      songList = data.Contents.filter(item => item.Key.endsWith(".mp3"));

      songList.forEach((item, index) => {
          const li = document.createElement("li");
          li.innerText = decodeURIComponent(item.Key);
          li.onclick = () => {
              currentSongIndex = index;
              playSong(getSongUrl(item.Key));
          };
          playlist.appendChild(li);
      });
  });
}

// Play Song
function playSong(url) {
  const player = document.getElementById("audioPlayer");
  const source = document.getElementById("audioSource");
  if (!player || !source) return;

  // Pause and reset
  player.pause();
  player.currentTime = 0;

  // Update source
  source.src = url;
  player.load();

  // Play and auto-next
  player.oncanplay = () => {
      player.play().catch(err => console.error("Play error:", err));
  };
  player.onended = playNextSong; // Auto play next on end
}

// Get Song URL (added content-type to fix CORB)
function getSongUrl(songKey) {
  // Only encode parts that need encoding
  const encodedKey = songKey.split("/").map(encodeURIComponent).join("/");
  return `https://cloudjukebox.s3.eu-north-1.amazonaws.com/${encodedKey}`;
}


function playPreviousSong() {
  if (songList.length === 0) return;

  // Go to previous index; wrap around if at the beginning
  currentSongIndex = (currentSongIndex - 1 + songList.length) % songList.length;
  const prevKey = songList[currentSongIndex].Key;
  playSong(getSongUrl(prevKey));
}



function playNextSong() {
  if (songList.length === 0) return;

  currentSongIndex = (currentSongIndex + 1) % songList.length;
  const nextKey = songList[currentSongIndex].Key;
  playSong(getSongUrl(nextKey));
}

// Upload File Function
let uploaderS3;
function initUploader() {
  uploaderS3 = new AWS.S3({ params: { Bucket: "cloudjukebox" } });
}

function uploadFile() {
  const fileInput = document.getElementById("fileInput");
  const file = fileInput?.files[0];
  const progressBar = document.getElementById("uploadProgress");
  const status = document.getElementById("status");

  if (!file) {
      if (status) status.innerText = "Please choose a file first.";
      return;
  }

  if (progressBar) {
      progressBar.style.display = "block";
      progressBar.value = 0;
  }
  if (status) status.innerText = "";

  const params = {
      Key: file.name,
      Body: file,
      ContentType: file.type,
  };

  const options = { partSize: 5 * 1024 * 1024, queueSize: 1 };
  const upload = uploaderS3.upload(params, options);

  upload.on("httpUploadProgress", function (evt) {
      if (progressBar) {
          const percent = Math.round((evt.loaded / evt.total) * 100);
          progressBar.value = percent;
      }
  });

  upload.send(function (err, data) {
      if (progressBar) progressBar.style.display = "none";
      if (err) {
          console.error("Upload error:", err);
          if (status) status.innerText = "Upload failed. Check console for error.";
      } else {
          console.log("Successfully uploaded:", data);
          if (status)
              status.innerHTML = `Uploaded successfully!<br><a href="${data.Location}" target="_blank">View File</a>`;
      }
  });
}

document.getElementById("searchInput").addEventListener("input", function () {
  const searchTerm = this.value.toLowerCase();
  const playlist = document.getElementById("playlist"); // Ensure this is the actual list
  const songItems = playlist.querySelectorAll("li"); // Get all song elements

  songItems.forEach((item) => {
      const songName = item.textContent.toLowerCase();
      item.style.display = songName.includes(searchTerm) ? "block" : "none";
  });
});


document.addEventListener("keydown", function(event) {
  if (event.key === "ArrowRight") { // Right Arrow for Next Song
      playNextSong();
  }
  if (event.key === "ArrowLeft") { // Left Arrow for Previous Song
      playPreviousSong();
  }
});


// Expose uploadFile globally
window.uploadFile = uploadFile;
