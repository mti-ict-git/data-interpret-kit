import { useRef } from "react";
import { Upload } from "lucide-react";
import { Card } from "@/components/ui/card";

interface FileUploadZoneProps {
  onFilesSelected: (files: FileList | null) => void;
  accept: string;
  label: string;
  sublabel: string;
  fileCount?: number;
}

const FileUploadZone = ({
  onFilesSelected,
  accept,
  label,
  sublabel,
  fileCount = 0,
}: FileUploadZoneProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    onFilesSelected(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilesSelected(e.target.files);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Card
      className="cursor-pointer border-2 border-dashed border-border bg-card transition-colors hover:border-muted-foreground/50"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <div className="flex flex-col items-center justify-center py-12">
        <Upload className="h-12 w-12 text-muted-foreground/50" />
        <p className="mt-4 text-base font-medium text-foreground">{label}</p>
        <p className="mt-1 text-sm text-muted-foreground">{sublabel}</p>
        {fileCount > 0 && (
          <p className="mt-2 text-sm font-medium text-primary">
            {fileCount} file{fileCount !== 1 ? "s" : ""} selected
          </p>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
      />
    </Card>
  );
};

export default FileUploadZone;
