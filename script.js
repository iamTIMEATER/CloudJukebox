// Theme management
(function() {
    const body = document.body;
  
    function applyTheme(mode) {
      body.classList.remove('light', 'dark');
      body.classList.add(mode);
      localStorage.setItem('theme', mode);
    }
  
    window.toggleTheme = function() {
      const current = localStorage.getItem('theme') || 'dark';
      const next = current === 'light' ? 'dark' : 'light';
      applyTheme(next);
    };
  
    // Initialize theme on page load
    const savedTheme = localStorage.getItem('theme') || 'dark';
    applyTheme(savedTheme);
  })();
  
  // AWS Configuration
  AWS.config.region = "eu-north-1"; // Your AWS Region
  
  AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: "eu-north-1:ea9bd0f8-6a25-4ec1-9be6-4e0b7409344e" // Replace with your actual Cognito Identity Pool ID
  });
  
  AWS.config.credentials.get((err) => {
    if (err) {
      console.error("Cognito Authentication Error:", err);
      alert("Failed to authenticate with AWS Cognito.");
    } else {
      console.log("Cognito Authentication Successful");
      if (typeof listSongs === "function") {
        listSongs();
      }
      if (typeof initUploader === "function") {
        initUploader();
      }
    }
  });
  
  const s3 = new AWS.S3();
  
  // Functions for index.html (playlist & player)
  function playSong(url) {
    const player = document.getElementById("audioPlayer");
    const source = document.getElementById("audioSource");
    if (!player || !source) return;
    source.src = url;
    player.load();
    player.play();
  }
  
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
      data.Contents.forEach(item => {
        if (item.Key.endsWith(".mp3")) {
          const li = document.createElement("li");
          li.innerText = "🎵 " + decodeURIComponent(item.Key);
          li.onclick = () =>
            playSong(`https://cloudjukebox.s3.eu-north-1.amazonaws.com/${encodeURIComponent(item.Key)}`);
          playlist.appendChild(li);
        }
      });
    });
  }
  
  // Functions for upload.html (file uploader)
  let uploaderS3;
  
  function initUploader() {
    uploaderS3 = new AWS.S3({ params: { Bucket: "cloudjukebox" } });
  }
  
  function uploadFile() {
    const fileInput = document.getElementById("fileInput");
    const file = fileInput ? fileInput.files[0] : null;
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
  
    const options = {
      partSize: 5 * 1024 * 1024,
      queueSize: 1
    };
  
    const upload = uploaderS3.upload(params, options);
  
    upload.on('httpUploadProgress', function(evt) {
      if (progressBar) {
        const percent = Math.round((evt.loaded / evt.total) * 100);
        progressBar.value = percent;
      }
    });
  
    upload.send(function(err, data) {
      if (progressBar) progressBar.style.display = "none";
  
      if (err) {
        console.error("Upload error:", err);
        if (status) status.innerText = "Upload failed 😢 Check console for error.";
      } else {
        console.log("Successfully uploaded:", data);
        if (status) status.innerHTML = `✅ Uploaded successfully!<br><a href="${data.Location}" target="_blank">View File</a>`;
      }
    });
  }
  
  // Expose uploadFile globally for button onclick
  window.uploadFile = uploadFile;
  