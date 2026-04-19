'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { analyzeOCR } from '@/lib/api';
import './ReceiptUploader.css';

interface ReceiptUploaderProps {
  onOCRComplete: (data: { monto: number | null; fecha: string | null; comprobanteBase64: string }) => void;
  onError: (error: string) => void;
  resetToken?: number;
}

export default function ReceiptUploader({ onOCRComplete, onError, resetToken }: ReceiptUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [lastDetected, setLastDetected] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const clearPreviewUrl = useCallback(() => {
    setPreviewUrl(null);
  }, []);

  // Helper para redimensionar la imagen antes de enviar a Vision API y persistirla.
  const resizeAndConvertImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1200;

        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('No canvas text'));
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Exportar como JPEG para reducir peso sin afectar OCR.
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      reader.readAsDataURL(file);
    });
  };

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      onError('Por favor, selecciona una imagen formato JPG o PNG');
      return;
    }
    
    try {
      setLoading(true);

      setLastDetected(null);

      // Process, resize, and convert to base64 JPEG.
      const base64Image = await resizeAndConvertImage(file);
      setPreviewUrl(base64Image);
      
      // Send to OCR API
      const result = await analyzeOCR(base64Image);
      
      const ocrMonto = result.data.monto;
      
      // In case of completely failing, but not an HTTP error
      if (!ocrMonto && !result.data.fecha) {
        onError('OCR no logró detectar texto legible numérico en esta imagen.');
      }
      
      setLastDetected(ocrMonto);
      onOCRComplete({ 
        monto: ocrMonto, 
        fecha: result.data.fecha, 
        comprobanteBase64: base64Image 
      });

    } catch (err) {
      console.error(err);
      onError(err instanceof Error ? err.message : 'Error al procesar la imagen con OCR');
      clearPreviewUrl();
    } finally {
      setLoading(false);
    }
  }, [clearPreviewUrl, onError, onOCRComplete]);

  // Drag and drop handlers
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  // Paste handler
  const handlePaste = useCallback((e: ClipboardEvent) => {
    // Only capture paste if active element is not an input (to allow normal typing)
    if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
      return; // Permite el paste de texto normal
    }
    if (e.clipboardData && e.clipboardData.files.length > 0) {
      processFile(e.clipboardData.files[0]);
    }
  }, [processFile]);

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  useEffect(() => {
    if (resetToken === undefined) {
      return;
    }

    clearPreviewUrl();
    setLastDetected(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [clearPreviewUrl, resetToken]);

  const clearImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    clearPreviewUrl();
    setLastDetected(null);
    onOCRComplete({ monto: null, fecha: null, comprobanteBase64: '' }); // Reset fields loosely
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div 
      className={`receipt-uploader ${isDragging ? 'drag-over' : ''} ${loading ? 'disabled' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => !previewUrl && fileInputRef.current?.click()}
    >
      {previewUrl ? (
        <div className="receipt-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Comprobante" />
          {!loading && (
            <button className="remove-receipt-btn" onClick={clearImage} title="Quitar imagen">✕</button>
          )}
          {loading && <div className="ocr-result-badge">⏳ Analizando OCR...</div>}
          {lastDetected && <div className="ocr-result-badge">✅ S/ {lastDetected.toFixed(2)}</div>}
        </div>
      ) : (
        <div className="uploader-content">
          <span className="uploader-icon">📸</span>
          <span className="uploader-text">
            {loading ? 'Procesando imagen...' : <>Arrastra o <strong>Pega (Ctrl+V)</strong> tu voucher aquí</>}
          </span>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={(e) => e.target.files && processFile(e.target.files[0])} 
            accept="image/*"
            style={{ display: 'none' }}
          />
        </div>
      )}
    </div>
  );
}
