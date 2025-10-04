import { useCallback } from 'react';
import { Upload, FileText, X, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  accept: string;
  multiple?: boolean;
  title: string;
  description: string;
  files: File[];
  onRemoveFile?: (index: number) => void;
}

export const FileUpload = ({
  onFilesSelected,
  accept,
  multiple = true,
  title,
  description,
  files,
  onRemoveFile
}: FileUploadProps) => {
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const droppedFiles = Array.from(e.dataTransfer.files);
      onFilesSelected(droppedFiles);
    },
    [onFilesSelected]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onFilesSelected(Array.from(e.target.files));
    }
  };

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-8",
          "hover:border-primary hover:bg-secondary/50 transition-all duration-300",
          "cursor-pointer group bg-gradient-card shadow-soft"
        )}
      >
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div className="flex flex-col items-center justify-center text-center space-y-3">
          <Upload className="w-12 h-12 text-muted-foreground group-hover:text-primary transition-colors" />
          <div>
            <h3 className="font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>
        </div>
        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mt-4">
          <Lock className="w-3 h-3" />
          <span>Files stay private</span>
        </div>
      </div>
      
      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">
            {files.length} file{files.length > 1 ? 's' : ''} selected
          </p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between gap-2 text-sm text-muted-foreground bg-secondary/50 px-3 py-2 rounded"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <FileText className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{file.name}</span>
                </div>
                {onRemoveFile && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveFile(index)}
                    className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
