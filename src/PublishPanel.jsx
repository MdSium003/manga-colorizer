import { useState } from 'react';
import { supabase } from './supabaseClient';

export default function PublishPanel({ originalFile, colorizedFile, user }) {
  const [isPublishing, setIsPublishing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const handlePublish = async () => {
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
      const timestamp = Date.now();
      const origFileName = `public/${user.id}/orig_${timestamp}.png`;
      const colorFileName = `public/${user.id}/color_${timestamp}.png`;

      const { data: origData, error: origError } = await supabase.storage
        .from('manga-images')
        .upload(origFileName, originalFile);

      if (origError) throw origError;

      const { data: colorData, error: colorError } = await supabase.storage
        .from('manga-images')
        .upload(colorFileName, colorizedFile);

      if (colorError) throw colorError;

      setStatusMessage('Saving to database...');

      const { error: dbError } = await supabase
        .from('generations')
        .insert([
          {
            user_id: user.id,
            original_url: origData.path,
            colorized_url: colorData.path,
            prompt: "Auto-colorized using MangaMind AI"
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
    <div className="card publish-panel">
      <h3>Gallery Submission</h3>
      <p className="tool-description">Share your creation with the community.</p>
      
      <button 
        className="btn-primary"
        onClick={handlePublish} 
        disabled={isPublishing || !originalFile}
        style={{ width: '100%', marginTop: '16px' }}
      >
        {isPublishing ? <span className="loader"></span> : 'Publish to Gallery'}
      </button>

      {statusMessage && (
        <p className="status-message animate-in">
          {statusMessage}
        </p>
      )}
    </div>
  );
}