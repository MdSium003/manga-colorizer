import { useState } from 'react';
import { supabase } from './supabaseClient';

export default function PublishPanel({ originalFile, colorizedFile, user }) {
  const [isPublishing, setIsPublishing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const handlePublish = async () => {
    // 1. Basic validation
    if (!originalFile || !colorizedFile) {
      setStatusMessage('Error: Missing images to publish.');
      return;
    }
    if (!user) {
      setStatusMessage('Error: You must be logged in to publish.');
      return;
    }

    setIsPublishing(true);
    setStatusMessage('Uploading images to storage...');

    try {
      // Create unique filenames to prevent overwriting
      const timestamp = Date.now();
      const origFileName = `public/${user.id}/orig_${timestamp}.png`;
      const colorFileName = `public/${user.id}/color_${timestamp}.png`;

      // 2. Upload Original Image to Supabase Storage
      const { data: origData, error: origError } = await supabase.storage
        .from('manga-images')
        .upload(origFileName, originalFile);

      if (origError) throw origError;

      // 3. Upload Colorized Image to Supabase Storage
      const { data: colorData, error: colorError } = await supabase.storage
        .from('manga-images')
        .upload(colorFileName, colorizedFile);

      if (colorError) throw colorError;

      setStatusMessage('Saving to database...');

      // 4. Insert the record into the PostgreSQL database
      // RLS (Row Level Security) will automatically verify the user_id matches the logged-in user
      const { error: dbError } = await supabase
        .from('generations')
        .insert([
          {
            user_id: user.id,
            original_url: origData.path,
            colorized_url: colorData.path,
            prompt: "Auto-colorized using Edge ML" // Optional: if you add text prompts later
          }
        ]);

      if (dbError) throw dbError;

      setStatusMessage('Successfully published to the gallery!');

    } catch (error) {
      console.error("Publishing error:", error);
      setStatusMessage(`Failed to publish: ${error.message}`);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', maxWidth: '400px' }}>
      <h3>Publish Your Colorization</h3>
      
      <button 
        onClick={handlePublish} 
        disabled={isPublishing}
        style={{ padding: '10px 20px', cursor: isPublishing ? 'not-allowed' : 'pointer' }}
      >
        {isPublishing ? 'Publishing...' : 'Publish to Gallery'}
      </button>

      {statusMessage && (
        <p style={{ marginTop: '15px', fontWeight: 'bold' }}>
          {statusMessage}
        </p>
      )}
    </div>
  );
}