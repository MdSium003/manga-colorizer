import { useState, useRef, useEffect } from 'react';
import './App.css';

function App() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  const [colorizedSrc, setColorizedSrc] = useState(null); // The AI result as a dataURL
  const [selectedColor, setSelectedColor] = useState('#ff00b7'); // Neon manga accent
  const [hints, setHints] = useState([]);
  const [imgMetrics, setImgMetrics] = useState(null); // { offsetX, offsetY, newWidth, newHeight }
  
  const workerRef = useRef(null);
  const cleanCanvasRef = useRef(null);
  const displayCanvasRef = useRef(null);
  const resultCanvasRef = useRef(null);

  useEffect(() => {
    workerRef.current = new Worker(new URL('./ml-worker.js', import.meta.url), { type: 'module' });
    
    workerRef.current.onmessage = (event) => {
      if (event.data.success) {
        paintResultToCanvas(event.data.pixels, event.data.width, event.data.height);
      } else {
        console.error(`ML Error: ${event.data.error}`);
      }
      setIsProcessing(false);
    };

    return () => workerRef.current.terminate();
  }, []);

  const drawImageToCanvases = (imgSrc) => {
    const img = new Image();
    img.onload = () => {
      [cleanCanvasRef.current, displayCanvasRef.current].forEach(canvas => {
        canvas.width = 512;   
        canvas.height = 512;  
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, 512, 512); 

        const scale = Math.min(512 / img.width, 512 / img.height); 
        const newWidth = img.width * scale;
        const newHeight = img.height * scale;
        const offsetX = (512 - newWidth) / 2;  
        const offsetY = (512 - newHeight) / 2; 

        setImgMetrics({ offsetX, offsetY, newWidth, newHeight });
        ctx.drawImage(img, offsetX, offsetY, newWidth, newHeight); 
      });
      // Clear previous result
      setColorizedSrc(null);
    };
    img.src = imgSrc;
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setImageSrc(event.target.result);
      setHints([]);
      drawImageToCanvases(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const hexToRgb = (hex) => {
    const bigint = parseInt(hex.slice(1), 16);
    return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
  };

  const handleCanvasClick = (e) => {
    if (!imageSrc) return;
    
    const canvas = displayCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    const rgb = hexToRgb(selectedColor);
    setHints(prev => [...prev, { x, y, r: rgb.r, g: rgb.g, b: rgb.b }]);
    
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = selectedColor;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  const handleClearHints = () => {
    setHints([]);
    if (imageSrc) drawImageToCanvases(imageSrc);
  };

  const handleColorize = () => {
    if (!imageSrc) return;
    setIsProcessing(true);
    
    const ctx = cleanCanvasRef.current.getContext('2d');
    const imageData = ctx.getImageData(0, 0, 512, 512);

    workerRef.current.postMessage({ 
      imageData: imageData, 
      hints: hints,
      modelPath: 'anime-model.onnx' // Removed leading slash for GitHub Pages compatibility
    });
  };

  const paintResultToCanvas = (pixelArray, width, height) => {
    const canvas = resultCanvasRef.current;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // 1. Paint AI colors
    const newImageData = new ImageData(pixelArray, width, height);
    ctx.putImageData(newImageData, 0, 0);

    // 2. Multiply lines
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(cleanCanvasRef.current, 0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';

    // 3. (Optional but better) Clear the areas outside the image bounds to white or black to remove artifacts
    if (imgMetrics) {
      const { offsetX, offsetY, newWidth, newHeight } = imgMetrics;
      ctx.fillStyle = "white";
      // Top
      if (offsetY > 0) ctx.fillRect(0, 0, width, offsetY);
      // Bottom
      if (offsetY + newHeight < height) ctx.fillRect(0, offsetY + newHeight, width, height - (offsetY + newHeight));
      // Left
      if (offsetX > 0) ctx.fillRect(0, 0, offsetX, height);
      // Right
      if (offsetX + newWidth < width) ctx.fillRect(offsetX + newWidth, 0, width - (offsetX + newWidth), height);
    }

    // 4. Store result as URL for the slider
    setColorizedSrc(canvas.toDataURL());
  };

  return (
    <div className="container">
      {/* Decorative Manga SFX */}
      <div className="sfx sfx-1">BOOM</div>
      <div className="sfx sfx-2">DOKAN</div>

      <header className="header animate-in">
        <div className="logo">
          <span className="logo-icon">✒️</span>
          <h1 className="gradient-text">COLOR-PANEL AI</h1>
        </div>
        <p className="subtitle">Manga Studio Grade Interactive Colorizer</p>
      </header>

      <main className="main-content">
        <section className="controls-panel card animate-in" style={{ animationDelay: '0.1s' }}>
          <div className="upload-section">
            <label className="upload-label">
              <span>{imageSrc ? 'REPLACE ARTWORK' : 'UPLOAD LINEART (INKED)'}</span>
              <input type="file" accept="image/png, image/jpeg" onChange={handleImageUpload} />
            </label>
          </div>

          <div className="tools-grid">
            <div className="tool-item">
              <label>INK MARKER</label>
              <div className="color-picker-wrapper">
                <input 
                  type="color" 
                  value={selectedColor} 
                  onChange={(e) => setSelectedColor(e.target.value)} 
                />
                <span className="color-value">{selectedColor}</span>
              </div>
            </div>

            <div className="tool-actions">
              <button className="btn-secondary" onClick={handleClearHints} disabled={hints.length === 0}>
                RESET PAGE
              </button>
              <button 
                className="btn-primary" 
                onClick={handleColorize} 
                disabled={isProcessing || !imageSrc}
              >
                {isProcessing ? <span className="loader"></span> : 'COLORIZE PANEL'}
              </button>
            </div>
          </div>
        </section>

        <section className="workspace animate-in" style={{ animationDelay: '0.2s' }}>
          {/* Input Panel */}
          <div className="canvas-wrapper">
            <div className="canvas-header">
              <h3>DRAFT & HINTS</h3>
              {hints.length > 0 && <span className="badge">{hints.length} POINTS</span>}
            </div>
            <div className="canvas-container">
              <canvas ref={cleanCanvasRef} style={{ display: 'none' }} /> 
              <canvas 
                ref={displayCanvasRef} 
                onClick={handleCanvasClick}
                className={!imageSrc ? 'empty' : ''}
              />
              {!imageSrc && (
                <div className="placeholder">
                  <p>FEED THE AI INKED ART</p>
                </div>
              )}
            </div>
          </div>

          {/* Result Panel with Slider */}
          <div className="canvas-wrapper">
            <div className="canvas-header">
              <h3>FINAL RENDER</h3>
            </div>
            
            <div className="canvas-container card">
              <canvas 
                ref={resultCanvasRef} 
                className={!imageSrc ? 'empty' : ''} 
                style={{ display: imageSrc ? 'block' : 'none' }}
              />
              {!imageSrc && (
                <div className="placeholder">
                  <p>AWAITING AI ENGINE...</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="footer animate-in">
        <p>MANGA-MIND ENGINE v2.0 // POWERED BY EDGE-ONNX</p>
      </footer>
    </div>
  );
}

export default App;