import { useState } from "react";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import FileUploadZone from "@/components/FileUploadZone";

const Index = () => {
  const [processingMode, setProcessingMode] = useState("excel");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [excelFiles, setExcelFiles] = useState<File[]>([]);
  const [radiusPercentage, setRadiusPercentage] = useState([50]);
  const { toast } = useToast();

  const handleImageFiles = (files: FileList | null) => {
    if (!files) return;
    setImageFiles(Array.from(files));
  };

  const handleExcelFiles = (files: FileList | null) => {
    if (!files) return;
    setExcelFiles(Array.from(files));
  };

  const handleProcess = () => {
    if (imageFiles.length === 0) {
      toast({
        title: "No images selected",
        description: "Please upload image files to process",
        variant: "destructive",
      });
      return;
    }

    if (processingMode === "excel" && excelFiles.length === 0) {
      toast({
        title: "No Excel files selected",
        description: "Please upload Excel files to process",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Processing started",
      description: `Processing ${imageFiles.length} image(s) with ${radiusPercentage[0]}% adaptive radius`,
    });
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-foreground">
            Employee Image Processor
          </h1>
          <p className="mt-2 text-muted-foreground">
            Upload employee images, adjust processing options, and download the processed images in a zip file.
          </p>
        </div>

        {/* Processing Options */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">
            Select Processing Options:
          </h2>
          <RadioGroup
            value={processingMode}
            onValueChange={setProcessingMode}
            className="space-y-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="images" id="images" />
              <Label htmlFor="images" className="cursor-pointer font-normal">
                Process Images Only
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="excel" id="excel" />
              <Label htmlFor="excel" className="cursor-pointer font-normal">
                Process Images and Excel Files
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Image Files Upload */}
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <FileDown className="h-4 w-4" />
            Image Files
          </h3>
          <FileUploadZone
            onFilesSelected={handleImageFiles}
            accept="image/jpeg,image/jpg,image/png"
            label="Drop image files here"
            sublabel="or click to browse (JPG, JPEG, PNG)"
            fileCount={imageFiles.length}
          />
        </div>

        {/* Excel Files Upload - Only show when excel mode is selected */}
        {processingMode === "excel" && (
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              Excel Files
            </h3>
            <FileUploadZone
              onFilesSelected={handleExcelFiles}
              accept=".xlsx,.xls"
              label="Drop Excel files here"
              sublabel="or click to browse (XLSX, XLS)"
              fileCount={excelFiles.length}
            />
          </div>
        )}

        {/* Adaptive Radius Percentage Slider */}
        <div className="space-y-4 rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-card-foreground">
              Adaptive Radius Percentage: {radiusPercentage[0]}%
            </h3>
          </div>
          <Slider
            value={radiusPercentage}
            onValueChange={setRadiusPercentage}
            max={100}
            min={10}
            step={5}
            className="w-full"
          />
        </div>

        {/* Process Button */}
        <Button
          onClick={handleProcess}
          className="w-full bg-muted text-muted-foreground hover:bg-muted/90"
          size="lg"
        >
          <FileDown className="mr-2 h-5 w-5" />
          {processingMode === "excel"
            ? "Process Images & Generate Excel Files"
            : "Process Images"}
        </Button>
      </div>
    </div>
  );
};

export default Index;
