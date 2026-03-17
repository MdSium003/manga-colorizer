import { useState, useRef, useEffect, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial, Sphere, PerspectiveCamera } from '@react-three/drei';
import './App.css';

// --- 3D Anime Background Elements ---
function AnimeShapes() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} color="#c084fc" />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#6366f1" />
      
      <Float speed={2} rotationIntensity={1} floatIntensity={2}>
        <Sphere args={[1, 64, 64]} position={[4, 2, -5]} scale={1.5}>
          <MeshDistortMaterial
            color="#c084fc"
            speed={3}
            distort={0.4}
            radius={1}
          />
        </Sphere>
      </Float>

      <Float speed={3} rotationIntensity={2} floatIntensity={1}>
        <mesh position={[-5, -2, -8]} rotation={[45, 45, 45]}>
          <boxGeometry args={[1.5, 1.5, 1.5]} />
          <meshStandardMaterial color="#f472b6" wireframe />
        </mesh>
      </Float>

      <Float speed={1.5} rotationIntensity={0.5} floatIntensity={3}>
        <mesh position={[0, -4, -10]}>
          <torusGeometry args={[3, 0.5, 16, 100]} />
          <meshStandardMaterial color="#6366f1" opacity={0.3} transparent />
        </mesh>
      </Float>
    </>
  );
}

function App() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  const [colorizedSrc, setColorizedSrc] = useState(null);
  const [selectedColor, setSelectedColor] = useState('#ff00b7');
  const [hints, setHints] = useState([]);
  const [imgMetrics, setImgMetrics] = useState(null);
  
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

    const basePath = window.location.pathname.endsWith('/') ? window.location.pathname : window.location.pathname + '/';
    const modelUrl = window.location.origin + basePath + 'anime-model.onnx';

    workerRef.current.postMessage({ 
      imageData: imageData, 
      hints: hints,
      modelPath: modelUrl 
    });
  };

  const paintResultToCanvas = (pixelArray, width, height) => {
    const canvas = resultCanvasRef.current;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const newImageData = new ImageData(pixelArray, width, height);
    ctx.putImageData(newImageData, 0, 0);

    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(cleanCanvasRef.current, 0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';

    if (imgMetrics) {
      const { offsetX, offsetY, newWidth, newHeight } = imgMetrics;
      ctx.fillStyle = "white";
      if (offsetY > 0) ctx.fillRect(0, 0, width, offsetY);
      if (offsetY + newHeight < height) ctx.fillRect(0, offsetY + newHeight, width, height - (offsetY + newHeight));
      if (offsetX > 0) ctx.fillRect(0, 0, offsetX, height);
      if (offsetX + newWidth < width) ctx.fillRect(offsetX + newWidth, 0, width - (offsetX + newWidth), height);
    }

    setColorizedSrc(canvas.toDataURL());
  };

  return (
    <>
      <div className="three-bg">
        <Canvas>
          <PerspectiveCamera makeDefault position={[0, 0, 10]} />
          <Suspense fallback={null}>
            <AnimeShapes />
          </Suspense>
        </Canvas>
      </div>

      <div className="container">
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

          <section className="info-section animate-in" style={{ animationDelay: '0.3s' }}>
            <div className="info-card card">
              <h3>Direct-to-Browser AI</h3>
              <p>
                Our engine uses <strong>ONNX Runtime Web</strong> to run high-speed neural network inference directly in your browser. 
                Instead of sending your private artwork to a remote server, your device's <strong>GPU (via WebGPU)</strong> or CPU calculates the colors locally.
              </p>
              <div style={{ marginTop: '15px' }}>
                <span className="tech-tag">React 19</span>
                <span className="tech-tag">Vite</span>
                <span className="tech-tag">ONNX Runtime</span>
                <span className="tech-tag">Three.js</span>
              </div>
            </div>
            
            <div className="warning-card card">
              <h4>⚠️ Artist Notice</h4>
              <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>
                This model is a research prototype. Results may vary significantly based on your line weight. 
                Don't be shocked if colors aren't perfect yet—it's still learning the nuances of different art styles!
              </p>
            </div>
          </section>
        </main>

        <footer className="footer animate-in">
          <p>MANGA-MIND ENGINE v2.0 // POWERED BY EDGE-ONNX</p>
        </footer>
      </div>
    </>
  );
}

export default App;