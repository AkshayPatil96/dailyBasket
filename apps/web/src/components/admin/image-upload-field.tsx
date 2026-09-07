'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import Cropper, { type Area } from 'react-easy-crop';
import { ImagePlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { getCroppedImageBlob } from '@/lib/crop-image';
import { uploadsApi, type UploadFolder } from '@/lib/uploads-api';
import { getApiErrorMessage } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export function ImageUploadField({
  label,
  value,
  onChange,
  folder,
  aspect = 1,
  enableCrop = true,
}: {
  label: string;
  value?: string;
  onChange: (url: string | undefined) => void;
  folder: UploadFolder;
  /** Only meaningful when enableCrop is true. */
  aspect?: number;
  /**
   * Square-crop before upload — right for icon-style tiles (category tiles,
   * a future user avatar) where a consistent square is the actual design intent.
   * Wrong for brand logos and product photos, which have no consistent natural
   * shape — cropping those chops wordmark logos and tall/wide products. For those,
   * pass false: the original aspect is kept, resized server-side, and previewed/
   * displayed with object-contain instead of a forced crop.
   */
  enableCrop?: boolean;
}) {
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [cropPosition, setCropPosition] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const uploadFile = async (file: Blob) => {
    setIsUploading(true);
    try {
      const url = await uploadsApi.uploadImage(file, folder);
      onChange(url);
      toast.success('Image uploaded');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not upload image.'));
    } finally {
      setIsUploading(false);
    }
  };

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;
      if (!enableCrop) {
        void uploadFile(file);
        return;
      }
      setCropPosition({ x: 0, y: 0 });
      setZoom(1);
      setCroppedArea(null);
      setPendingImage(URL.createObjectURL(file));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uploadFile closes over stable folder/onChange
    [enableCrop],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/jpeg': [], 'image/png': [], 'image/webp': [] },
    maxFiles: 1,
    multiple: false,
  });

  const closeCropDialog = () => {
    if (pendingImage) URL.revokeObjectURL(pendingImage);
    setPendingImage(null);
  };

  const confirmCrop = async () => {
    if (!pendingImage || !croppedArea) return;
    const blob = await getCroppedImageBlob(pendingImage, croppedArea);
    await uploadFile(blob);
    closeCropDialog();
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-(--color-foreground)">{label}</span>

      {value ? (
        <div className="relative w-32">
          {/* eslint-disable-next-line @next/next/no-img-element -- uploaded S3 URLs aren't whitelisted in next/image remotePatterns per-key */}
          <img
            src={value}
            alt=""
            className={cn(
              'aspect-square w-32 rounded-(--radius-inner) border border-(--color-border)',
              enableCrop ? 'object-cover' : 'bg-(--color-muted) object-contain p-2',
            )}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute right-1 top-1 bg-(--color-background)/80"
            onClick={() => onChange(undefined)}
          >
            <X className="size-3.5" aria-hidden />
            <span className="sr-only">Remove</span>
          </Button>
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={cn(
            'flex h-32 w-32 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-(--radius-inner) border border-dashed text-center transition-colors',
            isDragActive
              ? 'border-(--color-primary) bg-(--color-primary)/5'
              : 'border-(--color-border) hover:border-(--color-primary)',
          )}
        >
          <input {...getInputProps()} />
          <ImagePlus className="size-5 text-(--color-muted-foreground)" aria-hidden />
          <span className="px-2 text-xs text-(--color-muted-foreground)">
            {isUploading ? 'Uploading…' : 'Drop image or click'}
          </span>
        </div>
      )}

      {enableCrop ? (
        <Dialog open={Boolean(pendingImage)} onOpenChange={(open) => !open && closeCropDialog()}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Crop image</DialogTitle>
            </DialogHeader>
            {pendingImage ? (
              <div className="flex flex-col gap-4">
                <div className="relative h-72 w-full overflow-hidden rounded-(--radius-inner) bg-black">
                  <Cropper
                    image={pendingImage}
                    crop={cropPosition}
                    zoom={zoom}
                    aspect={aspect}
                    onCropChange={setCropPosition}
                    onZoomChange={setZoom}
                    onCropComplete={(_, areaPixels) => setCroppedArea(areaPixels)}
                  />
                </div>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.1}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full accent-(--color-primary)"
                  aria-label="Zoom"
                />
                <Button
                  type="button"
                  onClick={confirmCrop}
                  loading={isUploading}
                  className="w-full"
                >
                  Save image
                </Button>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
