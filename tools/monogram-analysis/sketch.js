const samples = [
  "The creatures outside looked from pig to man, and from man to pig, and from pig to man again; but already it was impossible to say which was which. [Plaintext]",
  "Pm ol ohk hufaopun jvumpkluaphs av zhf, ol dyval pa pu jpwoly, aoha pz, if zv johunpun aol vykly vm aol slaalyz vm aol hswohila, aoha uva h dvyk jvbsk il thml vba. [Caesar]",
  "Jds hmczf anbkg xbo rmtyu bisn jdcnjssg vqpl wbeu qgw usisnqv zqju, xbn cj cu bx q xbo'u gqjmns jb wb jdsus ubnju bx jdcgeu. [Substitution]"
];

let occurences = Array(26).fill(0);
let percentages = [];
const distribution = [
  8.55, 1.60, 3.16, 3.87, 12.10, 2.18, 2.09, 4.96, 7.33, 0.22, 0.81, 4.21, 2.53,
  7.17, 7.47, 2.07, 0.10, 6.33, 6.73, 8.94, 2.68, 1.06, 1.83, 0.19, 1.72, 0.11
];

// scaling factor for everything
let scaleFactor = 0.7 ;

function drawBars() {
  stroke(0);
  for (let i = 0; i < 79; i++) {
    if (i % 3 !== 0) {
      fill((i - 1) % 3 == 0 ? [150, 75, 255] : [255, 170, 0]);
      let scaling = ((i - 1) % 3 == 0)
        ? (percentages[(i - 1) / 3] / 100)
        : (distribution[(i - 2) / 3] / 100);
      if (!Number.isNaN(scaling)) {
        rect(i * barWidth, canvasHeight * (9 / 10), barWidth, -(maxBarHeight * scaling));
      }
    }
  }
  fill(200);
  noStroke();
  for (let i = 65; i < 91; i++) {
    text(
      String.fromCharCode(i),
      (canvasWidth * ((i - 64.6) / 26)),
      canvasHeight * (19 / 20)
    );
  }
}

function getMousePos(x, y) {
  let letter = Math.floor(x / (canvasWidth / 26));
  let percent = Number.isNaN(percentages[letter]) ? "0" : percentages[letter];
  let monogram = String.fromCharCode(letter + 65);
  let info = `${monogram}: ${occurences[letter]}\n${percent}%\n(${distribution[letter]}%)`;
  fill(100, 50); // highlight rectangle
  rect(letter * (canvasWidth / 26), -5, canvasWidth / 26, canvasHeight);
  fill(200);
  text(info, x, y);
}

function updateCipher() {
  ciphertext = (input.value()).toUpperCase();
  occurences = new Array(26).fill(0);
  percentages = [];
  for (let char of ciphertext) {
    let idx = char.charCodeAt(0) - 65;
    if (idx >= 0 && idx < 26) {
      occurences[idx] += 1;
    }
  }

  for (let i of occurences) {
    percentages.push(parseFloat(((i / ciphertext.length) * 100).toFixed(2)));
  }
}

function drawLines() {
  stroke(255, 255); //gray, alpha
  line(0, canvasHeight * (9 / 10), canvasWidth, canvasHeight * (9 / 10));
  for (let i = 10; i <= 110; i += 10) {
    stroke(255, 50);
    let yPos = canvasHeight * (9 / 10) - (maxBarHeight * (i / 100));
    line(0, yPos, canvasWidth, yPos);
    noStroke();
    fill(200);
    text(i + "%", 0, yPos);
  }
}

function setup() {
  input = createInput(samples[Math.floor(Math.random()*3)]);
  input.style("z-index", "10");
  input.style("position", "absolute"); 
  input.style("font-size", "20px");
  input.style("padding", "6px");
  input.style("width", "100%");
  input.style("margin-top", "110px");
  input.style("margin-left", "500px");
}

function draw() {
  canvasWidth = windowWidth * scaleFactor;
  canvasHeight = (windowHeight - 10) * scaleFactor;
  createCanvas(canvasWidth, canvasHeight);
  background(30);

  input.position(windowHeight / 100, windowHeight / 100);
  input.size(canvasWidth * 0.98);

  textSize(canvasWidth / 75);

  barWidth = canvasWidth / 79;
  let maxPercent = Number.isNaN(Math.max(...percentages)) ? 1 : Math.max(...percentages);
  maxBarHeight = canvasHeight * (85 / Math.max(15, maxPercent));

  updateCipher();
  drawBars();
  drawLines();
  getMousePos(mouseX, mouseY);
}
