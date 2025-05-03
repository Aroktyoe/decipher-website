function identifyCipher() {
  const input = document.getElementById("cipherInput").value.trim();
  const results = document.getElementById("identifierResults");
  results.innerHTML = ""; // Clear previous

  let found = false;

// Morse Code: only contains ., -, /, spaces, and newlines
if (/^[.\-/[\s\n]]+$/.test(input)) {
  results.innerHTML += "<p><strong>Possible Cipher:</strong> Morse Code</p>";
  found = true;
}

// Binary: only contains 0, 1, and spaces/newlines
if (/^[01[\s\n]]+$/.test(input)) {
  results.innerHTML += "<p><strong>Possible Cipher:</strong> Binary</p>";
  found = true;
}

if (/^[A-Za-z0-9\s.,'"():;!?-]+$/.test(input)) {
  const ic = getIndexOfCoincidence(input);
  if (ic < 0.06) {
    results.innerHTML += "<p><strong>Possible Cipher:</strong> Polyalphabetic Substitution Cipher</p>";
  } else {
    results.innerHTML += "<p><strong>Possible Cipher:</strong> Monoalphabetic Substitution Cipher</p>";
  }
  found = true;
}




// Base64
if (/^[A-Za-z0-9+/=\s\n]+$/.test(input)) {
  const b64 = input.replace(/\s/g, '');
  if (b64.length % 4 === 0) {
    try {
      const decoded = atob(b64);
      if ([...decoded].every(c => isPrintableOrWhitespace(c.charCodeAt(0)))) {
        results.innerHTML += "<p><strong>Possible Cipher:</strong> Base64</p>";
        found = true;
      }
    } catch (e) {}
  }
}

// Base32
if (/^[A-Z2-7= \n]+$/i.test(input)) {
  const cleaned = input.replace(/\s/g, '').toUpperCase();
  if (cleaned.length % 4 === 0) {
    try {
      const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
      const bytes = [];
      let buffer = 0, bitsLeft = 0;

      for (const char of cleaned.replace(/=+$/, '')) {
        const val = base32chars.indexOf(char);
        if (val === -1) throw new Error();
        buffer = (buffer << 5) | val;
        bitsLeft += 5;
        if (bitsLeft >= 8) {
          bitsLeft -= 8;
          const byte = (buffer >> bitsLeft) & 0xff;
          bytes.push(byte);
        }
      }

      if (bytes.every(b => isPrintableOrWhitespace(b))) {
        results.innerHTML += "<p><strong>Possible Cipher:</strong> Base32</p>";
        found = true;
      }
    } catch (e) {}
  }
}


// Base16 (Hex)
if (/^[0-9A-Fa-f\s\n]+$/.test(input)) {
  const hex = input.replace(/\s/g, '');
  if (hex.length % 2 === 0) {
    try {
      const bytes = hex.match(/.{1,2}/g).map(h => parseInt(h, 16));
      if (bytes.every(b => !isNaN(b) && isPrintableOrWhitespace(b))) {
        results.innerHTML += "<p><strong>Possible Cipher:</strong> Base16 (Hex)</p>";
        found = true;
      }
    } catch (e) {}
  }
}

// Base8 (Octal)
if (/^[0-7\s\n]+$/.test(input)) {
  const oct = input.replace(/\s/g, '');
  if (oct.length % 3 === 0) {
    try {
      const bytes = oct.match(/.{1,3}/g).map(o => parseInt(o, 8));
      if (bytes.every(b => !isNaN(b) && isPrintableOrWhitespace(b))) {
        results.innerHTML += "<p><strong>Possible Cipher:</strong> Base8 (Octal)</p>";
        found = true;
      }
    } catch (e) {}
  }
}

// Bacon Cipher: only 0s and 1s, length divisible by 5 (ignoring whitespace)
const cleanedBacon = input.replace(/\s/g, '');
if (/^[01]+$/.test(cleanedBacon) && cleanedBacon.length % 5 === 0) {
  results.innerHTML += "<p><strong>Possible Cipher:</strong> Bacon Cipher</p>";
  found = true;
}

// Decimal: only 0-9, decodable as ASCII, all printable or space/newline
if (/^[0-9\s\n]+$/.test(input)) {
  const decimalChunks = input.trim().split(/\s+/);
  try {
    const bytes = decimalChunks.map(n => parseInt(n, 10));
    if (bytes.every(b => !isNaN(b) && isPrintableOrWhitespace(b))) {
      results.innerHTML += "<p><strong>Possible Cipher:</strong> Decimal (ASCII)</p>";
      found = true;
    }
  } catch (e) {}
}



  if (!found) {
    results.innerHTML = "<p>❌ Could not identify the cipher.</p>";
  }
}

function getIndexOfCoincidence(text) {
  const clean = text.replace(/[^A-Za-z]/g, "").toUpperCase();
  const freq = {};
  for (const char of clean) freq[char] = (freq[char] || 0) + 1;
  const n = clean.length;
  if (n < 2) return 0;

  let ic = 0;
  for (const c in freq) {
    ic += freq[c] * (freq[c] - 1);
  }
  return ic / (n * (n - 1));
}


function isPrintableOrWhitespace(charCode) {
  return (
    (charCode >= 32 && charCode <= 126) || // Printable
    charCode === 10 || charCode === 13     // Newlines
  );
}