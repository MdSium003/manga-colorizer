import { useState, useRef, useEffect } from 'react';

function App() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  const [selectedColor, setSelectedColor] = useState('#ff0000'); // Default to red
  const [hints, setHints] = useState([]); 
  
  const workerRef = useRef(null);
  const cleanCanvasRef = useRef(null);   // Hidden: Pure lineart for ML & Multiply trick
  const displayCanvasRef = useRef(null); // Visible: Where user clicks and sees dots
  const resultCanvasRef = useRef(null);

  useEffect(() => {
    workerRef.current = new Worker(new URL('./ml-worker.js', import.meta.url), { type: 'module' });
    
    workerRef.current.onmessage = (event) => {
      if (event.data.success) {
        paintResultToCanvas(event.data.pixels, event.data.width, event.data.height);
      } else {
        alert(`Failed to colorize: ${event.data.error}`);
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

        ctx.drawImage(img, offsetX, offsetY, newWidth, newHeight); 
      });
    };
    img.src = imgSrc;
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setImageSrc(event.target.result);
      setHints([]); // Clear old hints
      drawImageToCanvases(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  // Convert Hex string to RGB numbers for the AI
  const hexToRgb = (hex) => {
    const bigint = parseInt(hex.slice(1), 16);
    return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
  };

  // Handle clicking the canvas to drop a color hint
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
    
    // Visually draw the dot on the display canvas
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = selectedColor;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, 2 * Math.PI); // 6px radius dot
    ctx.fill();
  };

  const handleClearHints = () => {
    setHints([]);
    if (imageSrc) drawImageToCanvases(imageSrc); // Redraw clean image
  };

  const handleColorize = () => {
    if (!imageSrc) return;
    setIsProcessing(true);
    
    // We grab the pixels from the CLEAN canvas so the AI doesn't see our UI dots as part of the lineart
    const ctx = cleanCanvasRef.current.getContext('2d');
    const imageData = ctx.getImageData(0, 0, 512, 512);

    workerRef.current.postMessage({ 
      imageData: imageData, 
      hints: hints, // Pass the array of clicks to the Web Worker!
      modelPath: '/anime-model.onnx' 
    });
  };

  const paintResultToCanvas = (pixelArray, width, height) => {
    const canvas = resultCanvasRef.current;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // 1. Paint the AI colors
    const newImageData = new ImageData(pixelArray, width, height);
    ctx.putImageData(newImageData, 0, 0);

    // 2. The Pro Trick: Multiply the clean, sharp black lines back over the colors!
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(cleanCanvasRef.current, 0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over'; 
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Edge ML Interactive Manga Colorizer</h1>
      
      <div style={{ marginBottom: '20px', display: 'flex', gap: '15px', alignItems: 'center' }}>
        <input type="file" accept="image/png, image/jpeg" onChange={handleImageUpload} />
        
        {/* The New Color Picker Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', paddingLeft: '20px', borderLeft: '2px solid #ccc' }}>
          <label><strong>Hint Color:</strong></label>
          <input 
            type="color" 
            value={selectedColor} 
            onChange={(e) => setSelectedColor(e.target.value)} 
            style={{ cursor: 'pointer', height: '30px', width: '40px' }}
          />
          <button onClick={handleClearHints} disabled={hints.length === 0}>Clear Hints</button>
        </div>

        <button 
          onClick={handleColorize} 
          disabled={isProcessing || !imageSrc}
          style={{ padding: '8px 16px', fontWeight: 'bold' }}
        >
          {isProcessing ? 'Processing AI...' : 'Colorize Manga'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        <div>
          <h3>Click to add colors!</h3>
          <canvas ref={cleanCanvasRef} style={{ display: 'none' }} /> 
          <canvas 
            ref={displayCanvasRef} 
            onClick={handleCanvasClick}
            style={{ maxWidth: '400px', border: '2px solid #333', cursor: 'crosshair', boxShadow: '2px 2px 10px rgba(0,0,0,0.2)' }} 
          />
        </div>

        <div>
          <h3>Result</h3>
          <canvas ref={resultCanvasRef} style={{ maxWidth: '400px', border: '1px solid black' }} />
        </div>
      </div>
    </div>
  );
}

export default App;