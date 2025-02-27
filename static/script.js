document.addEventListener('DOMContentLoaded', () => {
    console.log("Script loaded successfully!");
    initializeTabs();
});

// Tab functionality
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            
            // Remove active class from all buttons and panes
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));
            
            // Add active class to current button and pane
            button.classList.add('active');
            document.getElementById(tabId + 'Input').classList.add('active');
            
            // Reset webcam if switching to file tab
            if (tabId === 'file') {
                stopWebcam();
            }
        });
    });
}

// File upload handling
function triggerFileUpload() {
    console.log("Triggering file upload...");
    document.getElementById('imageUpload').click();
}

document.getElementById('imageUpload').addEventListener('change', function() {
    if (this.files && this.files[0]) {
        const file = this.files[0];
        const previewImage = document.getElementById('previewImage');
        const imagePreview = document.getElementById('imagePreview');
        
        previewImage.src = URL.createObjectURL(file);
        imagePreview.style.display = 'block';
        document.getElementById('predictButton').style.display = 'inline-flex';
        
        // Reset previous results
        resetResults();
    }
});

// Webcam handling
function startWebcam() {
    console.log("Starting webcam...");
    const video = document.getElementById('webcamVideo');
    const webcamButton = document.getElementById('webcamButton');
    const captureButton = document.getElementById('captureButton');

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(stream => {
                console.log("Webcam stream acquired.");
                video.srcObject = stream;
                video.style.display = 'block';
                webcamButton.style.display = 'none';
                captureButton.style.display = 'inline-flex';
                video.play();
            })
            .catch(err => {
                console.error("Webcam error:", err);
                alert(`Error accessing webcam: ${err.message}`);
            });
    } else {
        console.error("Webcam not supported.");
        alert('Webcam not supported in this browser.');
    }
}

function stopWebcam() {
    const video = document.getElementById('webcamVideo');
    if (video.srcObject) {
        const tracks = video.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        video.srcObject = null;
    }
    
    document.getElementById('webcamButton').style.display = 'inline-flex';
    document.getElementById('captureButton').style.display = 'none';
}

function captureWebcam() {
    console.log("Capturing webcam image...");
    const video = document.getElementById('webcamVideo');
    const canvas = document.getElementById('webcamCanvas');
    const context = canvas.getContext('2d');
    const previewImage = document.getElementById('previewImage');
    const imagePreview = document.getElementById('imagePreview');

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob(blob => {
        previewImage.src = URL.createObjectURL(blob);
        imagePreview.style.display = 'block';
        document.getElementById('predictButton').style.display = 'inline-flex';
        
        // Reset previous results
        resetResults();
    }, 'image/jpeg', 0.95);
    
    // Stop the webcam
    stopWebcam();
}

// Image analysis
function uploadImage() {
    console.log("Analyzing image...");
    const fileInput = document.getElementById('imageUpload');
    const previewImage = document.getElementById('previewImage');
    const loading = document.getElementById('loading');
    const progressContainer = document.getElementById('confidenceProgress');
    const progressBar = document.getElementById('progressBar');
    const predictButton = document.getElementById('predictButton');
    
    let file;
    
    // Check if we have a file from input or from canvas (webcam)
    if (fileInput.files && fileInput.files[0]) {
        file = fileInput.files[0];
    } else if (previewImage.src) {
        // Convert the preview image to a file
        fetch(previewImage.src)
            .then(res => res.blob())
            .then(blob => {
                const file = new File([blob], 'webcam-capture.jpg', { type: 'image/jpeg' });
                processImageFile(file);
            });
        return;
    } else {
        alert('Please select an image first.');
        return;
    }
    
    processImageFile(file);
    
    function processImageFile(file) {
        // Show loading and hide predict button
        loading.style.display = 'flex';
        predictButton.style.display = 'none';
        progressContainer.style.display = 'block';
        progressBar.style.width = '0%';
        
        // Reset previous results
        document.getElementById('fakeResult').style.display = 'none';
        document.getElementById('realResult').style.display = 'none';
        document.getElementById('predictionText').innerHTML = '';
        
        // Simulate progress while waiting for response
        let simulatedProgress = 0;
        const progressInterval = setInterval(() => {
            if (simulatedProgress < 50) {
                simulatedProgress += 5;
                progressBar.style.width = `${simulatedProgress}%`;
            }
        }, 100);
        
        const formData = new FormData();
        formData.append('file', file);
        
        fetch('/predict', { method: 'POST', body: formData })
            .then(response => response.json())
            .then(data => {
                clearInterval(progressInterval);
                loading.style.display = 'none';
                
                if (data.error) {
                    console.error("Prediction error:", data.error);
                    document.getElementById('predictionText').innerHTML = `<span style="color: #ff3b30;">Error: ${data.error}</span>`;
                    progressContainer.style.display = 'none';
                } else {
                    console.log("Prediction success:", data);
                    
                    // Update prediction text
                    document.getElementById('predictionText').innerHTML = `Prediction: ${data.label} (Confidence: ${data.confidence})`;
                    
                    // Update progress bar
                    const confidenceValue = parseFloat(data.confidence);
                    progressBar.style.width = `${confidenceValue}%`;
                    
                    // Show result card
                    if (data.label === 'Fake') {
                        document.getElementById('fakeResult').style.display = 'flex';
                        progressBar.style.backgroundColor = '#ff3b30';
                        document.getElementById('confidenceOverlay').style.backgroundColor = `rgba(255, 59, 48, ${confidenceValue / 100})`;
                    } else {
                        document.getElementById('realResult').style.display = 'flex';
                        progressBar.style.backgroundColor = '#4cd964';
                        document.getElementById('confidenceOverlay').style.backgroundColor = `rgba(76, 217, 100, ${confidenceValue / 100})`;
                    }
                    
                    // Show new analysis button
                    document.getElementById('newAnalysisButton').style.display = 'inline-flex';
                    
                    // Fetch updated history
                    fetchHistory();
                }
            })
            .catch(error => {
                clearInterval(progressInterval);
                loading.style.display = 'none';
                console.error("Fetch error:", error);
                document.getElementById('predictionText').innerHTML = `<span style="color: #ff3b30;">Error: ${error.message}</span>`;
                progressContainer.style.display = 'none';
            });
    }
}

// Toggle confidence overlay
function toggleOverlay() {
    const overlayToggle = document.getElementById('overlayToggle');
    const confidenceOverlay = document.getElementById('confidenceOverlay');
    
    confidenceOverlay.style.display = overlayToggle.checked ? 'block' : 'none';
}

// History handling
function toggleHistory() {
    const historyResult = document.getElementById('historyResult');
    const predictionResult = document.getElementById('predictionResult');
    const historyBtnText = document.getElementById('historyBtnText');
    
    if (historyResult.style.display === 'none' || historyResult.style.display === '') {
        historyResult.style.display = 'block';
        predictionResult.style.display = 'none';
        historyBtnText.textContent = 'Back to Detector';
        fetchHistory();
    } else {
        historyResult.style.display = 'none';
        predictionResult.style.display = 'block';
        historyBtnText.textContent = 'View History';
    }
}

function fetchHistory() {
    fetch('/history')
        .then(response => response.json())
        .then(data => {
            const historyList = document.getElementById('historyList');
            historyList.innerHTML = '';
            
            if (data.length === 0) {
                historyList.innerHTML = '<li>No prediction history yet</li>';
                return;
            }
            
            data.forEach(item => {
                const li = document.createElement('li');
                const confidencePercent = (item.confidence * 100).toFixed(2);
                const isReal = item.label === 'Real';
                
                li.innerHTML = `
                    <div class="history-item">
                        <div class="history-item-left">
                            <i class="fas ${isReal ? 'fa-check-circle' : 'fa-times-circle'}" 
                               style="color: ${isReal ? '#4cd964' : '#ff3b30'};"></i>
                            <span>${item.image_id}</span>
                        </div>
                        <div class="history-item-right" 
                             style="background-color: ${isReal ? 'rgba(76, 217, 100, 0.2)' : 'rgba(255, 59, 48, 0.2)'};
                                    color: ${isReal ? '#4cd964' : '#ff3b30'};">
                            ${confidencePercent}%
                        </div>
                    </div>
                    <span class="history-timestamp">${new Date(item.timestamp).toLocaleString()}</span>
                `;
                
                historyList.appendChild(li);
            });
        })
        .catch(error => {
            console.error("Error fetching history:", error);
            document.getElementById('historyList').innerHTML = '<li>Error loading history</li>';
        });
}

// Reset analysis for new image
function resetAnalysis() {
    // Clear image preview
    const previewImage = document.getElementById('previewImage');
    if (previewImage.src) {
        URL.revokeObjectURL(previewImage.src);
        previewImage.src = '';
    }
    
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('imageUpload').value = '';
    
    // Hide results
    resetResults();
    
    // Show file upload tab
    document.querySelector('.tab-btn[data-tab="file"]').click();
    
    // Hide new analysis button
    document.getElementById('newAnalysisButton').style.display = 'none';
}

// Reset result displays
function resetResults() {
    document.getElementById('fakeResult').style.display = 'none';
    document.getElementById('realResult').style.display = 'none';
    document.getElementById('predictionText').innerHTML = '';
    document.getElementById('confidenceProgress').style.display = 'none';
    document.getElementById('newAnalysisButton').style.display = 'none';
}

// The app.py file doesn't need any changes as it's working correctly with the frontend