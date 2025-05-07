// Utility: normalize image
function normalizeSymbol(imgData) {
  const data = imgData.data;
  const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
  const std = Math.sqrt(data.reduce((sum, val) => sum + (val - mean) ** 2, 0) / data.length) || 1;
  return data.map(val => (val - mean) / std);
}

// Enhance image (contrast, gamma, sharpen)
function betterEnhance(image) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = image.width;
  canvas.height = image.height;
  ctx.drawImage(image, 0, 0);

  let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let data = imageData.data;

  // Gamma correction
  const gamma = 1.2;
  const invGamma = 1 / gamma;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 * ((data[i] / 255) ** invGamma);
    data[i + 1] = 255 * ((data[i + 1] / 255) ** invGamma);
    data[i + 2] = 255 * ((data[i + 2] / 255) ** invGamma);
  }
  ctx.putImageData(imageData, 0, 0);

  return canvas.toDataURL();
}

// Strip whitespace
function stripWhitespace(text) {
  return text.replace(/\s+/g, '');
}

// Frequency analysis
function frequencyAnalysis(text) {
  const EN_FREQ = {
    A: 8.17, B: 1.49, C: 2.78, D: 4.25, E: 12.70, F: 2.23, G: 2.02, H: 6.09, I: 6.97,
    J: 0.15, K: 0.77, L: 4.03, M: 2.41, N: 6.75, O: 7.51, P: 1.93, Q: 0.10, R: 5.99,
    S: 6.33, T: 9.06, U: 2.76, V: 0.98, W: 2.36, X: 0.15, Y: 1.97, Z: 0.07
  };
  const clean = text.toUpperCase().replace(/[^A-Z]/g, '');
  const total = clean.length;
  const counts = {};
  for (const c of clean) counts[c] = (counts[c] || 0) + 1;

  const result = [];
  for (const l in EN_FREQ) {
    const calc = counts[l] ? (counts[l] / total * 100) : 0;
    result.push({ letter: l, calculated: calc, expected: EN_FREQ[l] });
  }
  return result.sort((a, b) => b.calculated - a.calculated);
}

// Heatmap logic (QWERTY)
function keyboardHeatmap(text) {
  const clean = text.toUpperCase().replace(/[^A-Z]/g, '');
  const layout = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
  const counts = {};
  for (const c of clean) counts[c] = (counts[c] || 0) + 1;

  const total = clean.length;
  const heat = {};
  for (const row of layout) {
    for (const key of row) {
      heat[key] = (counts[key] || 0) / total * 100;
    }
  }
  return heat;
}

// N-gram transcription
function textTranscription(text, n) {
  const alnum = text.replace(/[^a-zA-Z0-9]/g, '');
  if (alnum.length % n !== 0) return null;
  const ngrams = [];
  for (let i = 0; i < alnum.length; i += n) {
    ngrams.push(alnum.slice(i, i + n));
  }
  const map = {};
  let curr = 'A'.charCodeAt(0);
  return ngrams.map(g => {
    if (!map[g]) map[g] = String.fromCharCode(curr++);
    return map[g];
  }).join('');
}

// Full /transcribe command from Discord bot, ported to JS using OpenCV.js
// Requirements: OpenCV.js must be loaded in the page (e.g., <script src="opencv.js"></script>)

async function transcribeSymbolsFromImage(file, accuracy = 85) {
  return new Promise((resolve, reject) => {
    const threshold = accuracy / 100;
    const reader = new FileReader();
    reader.onload = function () {
      const img = new Image();
      img.onload = function () {
        let src = cv.imread(img);
        let gray = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

        // Background color estimate and contrast
        const bgColor = mode(gray);
        let contrast = new cv.Mat();
        cv.absdiff(gray, new cv.Mat(gray.rows, gray.cols, gray.type(), new cv.Scalar(bgColor)), contrast);

        let binary = new cv.Mat();
        cv.threshold(contrast, binary, 30, 255, cv.THRESH_BINARY);
        let kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(2, 2));
        let opened = new cv.Mat();
        cv.morphologyEx(binary, opened, cv.MORPH_OPEN, kernel);
        let dilated = new cv.Mat();
        cv.dilate(opened, dilated, kernel);

        let stats = new cv.Mat();
        let centroids = new cv.Mat();
        let labels = new cv.Mat();
        let num = cv.connectedComponentsWithStats(dilated, labels, stats, centroids);

        let boxes = [];
        for (let i = 1; i < num; i++) {
          let x = stats.intPtr(i, 0)[0];
          let y = stats.intPtr(i, 1)[0];
          let w = stats.intPtr(i, 2)[0];
          let h = stats.intPtr(i, 3)[0];
          let area = stats.intPtr(i, 4)[0];
          if (area > 100 && area < 5000) boxes.push({ x, y, w, h });
        }

        // Remove nested boxes
        boxes = boxes.filter(b => !boxes.some(o => o !== b && inside(b, o)));

        let vectors = [];
        let positions = [];
        for (const { x, y, w, h } of boxes) {
          let roi = gray.roi(new cv.Rect(x, y, w, h));
          let resized = new cv.Mat();
          cv.resize(roi, resized, new cv.Size(40, 40), 0, 0, cv.INTER_AREA);
          vectors.push(normalize(resized));
          positions.push({ x, y, w, h });
          roi.delete(); resized.delete();
        }

        let refVecs = [];
        let symLabels = [];
        for (const vec of vectors) {
          let matched = false;
          for (let j = 0; j < refVecs.length; j++) {
            if (ssim(vec, refVecs[j]) > threshold) {
              symLabels.push(String.fromCharCode(65 + j));
              matched = true;
              break;
            }
          }
          if (!matched) {
            refVecs.push(vec);
            symLabels.push(String.fromCharCode(65 + refVecs.length - 1));
          }
        }

        const combined = positions.map((box, i) => ({ ...box, label: symLabels[i] }));
        combined.sort((a, b) => a.y - b.y || a.x - b.x);

        let lines = [];
        let current = [];
        let lastY = null;
        for (const box of combined) {
          if (lastY === null || Math.abs(box.y - lastY) < 20) {
            current.push(box);
          } else {
            lines.push([...current]);
            current = [box];
          }
          lastY = box.y;
        }
        if (current.length) lines.push(current);

        const result = lines.map(line => line.sort((a, b) => a.x - b.x).map(b => b.label).join('')).join('\n');

        // Draw boxes
        for (const { x, y, w, h, label } of combined) {
          cv.rectangle(src, new cv.Point(x, y), new cv.Point(x + w, y + h), [0, 0, 255, 255], 1);
          cv.putText(src, label, new cv.Point(x, y - 3), cv.FONT_HERSHEY_SIMPLEX, 0.5, [0, 0, 255, 255], 1);
        }

        cv.imshow('canvas-output', src);
        cleanup([src, gray, contrast, binary, opened, dilated, stats, centroids, labels]);
        resolve(result);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function inside(inner, outer) {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  );
}

function normalize(mat) {
  let mean = cv.mean(mat)[0];
  let std = Math.sqrt(cv.mean(mat.clone().convertTo(cv.CV_32F).sub(mean).pow(2))[0]) || 1;
  let out = new cv.Mat();
  mat.convertTo(out, cv.CV_32F);
  out = out.sub(mean).div(std);
  return out;
}

function ssim(img1, img2) {
  // Basic SSIM substitute, use cosine similarity here
  let dot = 0, norm1 = 0, norm2 = 0;
  for (let i = 0; i < img1.rows; i++) {
    for (let j = 0; j < img1.cols; j++) {
      let a = img1.floatAt(i, j);
      let b = img2.floatAt(i, j);
      dot += a * b;
      norm1 += a * a;
      norm2 += b * b;
    }
  }
  return dot / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

function mode(mat) {
  const hist = {};
  for (let i = 0; i < mat.rows; i++) {
    for (let j = 0; j < mat.cols; j++) {
      let val = mat.ucharAt(i, j);
      hist[val] = (hist[val] || 0) + 1;
    }
  }
  return parseInt(Object.entries(hist).sort((a, b) => b[1] - a[1])[0][0]);
}

function cleanup(mats) {
  for (const m of mats) m.delete();
}

let currentTool = null; // Keeps track of the selected tool

// This function handles when a button is clicked to open a tool
function openTool(tool) {
  currentTool = tool;
  const output = document.getElementById("tool-output");
  output.innerHTML = ''; // Clear previous content

  // Handle each tool selection and render the input fields
  if (tool === "frequency") {
    output.innerHTML = `
      <p>Enter text for frequency analysis:</p>
      <textarea id="tool-input"></textarea>
    `;
  } else if (tool === "transcribe") {
    output.innerHTML = `
      <p>Upload an image for transcription:</p>
      <input type="file" id="file-input" accept="image/*" />
    `;
  } else if (tool === "enhance") {
    output.innerHTML = `
      <p>Upload an image for enhancement:</p>
      <input type="file" id="enhance-file-input" accept="image/*" />
    `;
  } else if (tool === "strip") {
    output.innerHTML = `
      <p>Enter text to strip whitespace:</p>
      <textarea id="strip-input"></textarea>
    `;
  } else if (tool === "ngrams") {
    output.innerHTML = `
      <p>Enter text for N-Gram Transcription:</p>
      <textarea id="ngrams-input"></textarea>
      <input type="number" id="ngrams-size" value="3" min="2" max="6" />
    `;
  }
  // Add similar sections for other tools...
}

// Add event listener for the run button
document.getElementById("run-tool-button").addEventListener("click", () => {
  const output = document.getElementById("tool-output");

  if (currentTool === "frequency") {
    const inputText = document.getElementById("tool-input").value;
    const result = frequencyAnalysis(inputText);
    output.innerHTML = formatFrequencyResult(result);

  } else if (currentTool === "transcribe") {
    const fileInput = document.getElementById("file-input");
    if (fileInput.files.length > 0) {
      const file = fileInput.files[0];
      transcribeSymbolsFromImage(file).then(result => {
        output.innerHTML = `<p>Transcribed Text:</p><pre>${result}</pre>`;
      }).catch(err => {
        output.innerHTML = "Error during transcription.";
      });
    } else {
      output.innerHTML = "Please upload an image for transcription.";
    }

  } else if (currentTool === "enhance") {
    const fileInput = document.getElementById("enhance-file-input");
    if (fileInput.files.length > 0) {
      const file = fileInput.files[0];
      const img = new Image();
      const reader = new FileReader();
      reader.onload = function() {
        img.onload = function() {
          const enhancedImage = betterEnhance(img);
          output.innerHTML = `<p>Enhanced Image:</p><img src="${enhancedImage}" />`;
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    } else {
      output.innerHTML = "Please upload an image to enhance.";
    }

  } else if (currentTool === "strip") {
    const inputText = document.getElementById("strip-input").value;
    const result = stripWhitespace(inputText);
    output.innerHTML = `<p>Output (Whitespace Stripped):</p><pre>${result}</pre>`;

  } else if (currentTool === "ngrams") {
    const inputText = document.getElementById("ngrams-input").value;
    const n = document.getElementById("ngrams-size").value;
    const result = textTranscription(inputText, parseInt(n));
    output.innerHTML = `<p>Transcribed N-Grams:</p><pre>${result}</pre>`;
  }
  // Add similar logic for other tools...
});

// Helper function to format the frequency analysis result
function formatFrequencyResult(result) {
  return result.map(item => `
    <p>${item.letter}: ${item.calculated.toFixed(2)}% (Expected: ${item.expected}%)</p>
  `).join('');
}


