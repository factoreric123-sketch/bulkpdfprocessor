import { useState } from 'react';
import { FileText, Merge, Scissors } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileUpload } from '@/components/FileUpload';
import { ProcessingStatus } from '@/components/ProcessingStatus';
import { useToast } from '@/hooks/use-toast';
import {
  parseMergeExcel,
  parseDeletePagesExcel,
  mergePDFs,
  deletePagesFromPDF,
  downloadPDF,
  type MergeInstruction,
  type DeletePagesInstruction,
} from '@/lib/pdfProcessor';

const Index = () => {
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [excelFile, setExcelFile] = useState<File[]>([]);
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('merge');
  const { toast } = useToast();

  const handlePdfFiles = (files: File[]) => {
    setPdfFiles(files);
  };

  const handleExcelFile = (files: File[]) => {
    setExcelFile(files);
  };

  const processMerge = async () => {
    if (pdfFiles.length === 0 || excelFile.length === 0) {
      toast({
        title: 'Missing files',
        description: 'Please upload both PDF files and an Excel instruction file.',
        variant: 'destructive',
      });
      return;
    }

    setStatus('processing');
    setMessage('Parsing Excel instructions...');
    setProgress(0);

    try {
      const instructions = await parseMergeExcel(excelFile[0]);
      const pdfMap = new Map(pdfFiles.map((file) => [file.name, file]));

      for (let i = 0; i < instructions.length; i++) {
        const instruction = instructions[i];
        setMessage(`Merging PDFs for ${instruction.outputName}...`);
        
        const mergedPdfBytes = await mergePDFs(instruction, pdfMap, (fileProgress) => {
          const totalProgress = ((i / instructions.length) * 100) + (fileProgress / instructions.length);
          setProgress(totalProgress);
        });

        downloadPDF(mergedPdfBytes, instruction.outputName);
      }

      setStatus('success');
      setMessage(`Successfully merged ${instructions.length} PDF${instructions.length > 1 ? 's' : ''}!`);
      setProgress(100);
    } catch (error) {
      console.error('Error processing PDFs:', error);
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'An error occurred while processing PDFs');
      toast({
        title: 'Processing failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  const processDeletePages = async () => {
    if (pdfFiles.length === 0 || excelFile.length === 0) {
      toast({
        title: 'Missing files',
        description: 'Please upload both PDF files and an Excel instruction file.',
        variant: 'destructive',
      });
      return;
    }

    setStatus('processing');
    setMessage('Parsing Excel instructions...');
    setProgress(0);

    try {
      const instructions = await parseDeletePagesExcel(excelFile[0]);
      const pdfMap = new Map(pdfFiles.map((file) => [file.name, file]));

      for (let i = 0; i < instructions.length; i++) {
        const instruction = instructions[i];
        setMessage(`Processing ${instruction.sourceFile}...`);
        
        const processedPdfBytes = await deletePagesFromPDF(instruction, pdfMap, (fileProgress) => {
          const totalProgress = ((i / instructions.length) * 100) + (fileProgress / instructions.length);
          setProgress(totalProgress);
        });

        downloadPDF(processedPdfBytes, instruction.outputName);
      }

      setStatus('success');
      setMessage(`Successfully processed ${instructions.length} PDF${instructions.length > 1 ? 's' : ''}!`);
      setProgress(100);
    } catch (error) {
      console.error('Error processing PDFs:', error);
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'An error occurred while processing PDFs');
      toast({
        title: 'Processing failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  const handleProcess = () => {
    if (activeTab === 'merge') {
      processMerge();
    } else {
      processDeletePages();
    }
  };

  const resetFiles = () => {
    setPdfFiles([]);
    setExcelFile([]);
    setStatus('idle');
    setProgress(0);
    setMessage('');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <header className="bg-gradient-primary text-primary-foreground py-16 px-4">
        <div className="container max-w-6xl mx-auto text-center">
          <div className="flex justify-center mb-6">
            <FileText className="w-16 h-16" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            PDF Bulk Processor
          </h1>
          <p className="text-lg md:text-xl opacity-90 max-w-2xl mx-auto">
            Merge multiple PDFs or delete specific pages in bulk using Excel instructions
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="container max-w-6xl mx-auto px-4 py-12">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 bg-card shadow-soft">
            <TabsTrigger value="merge" className="flex items-center gap-2">
              <Merge className="w-4 h-4" />
              Merge PDFs
            </TabsTrigger>
            <TabsTrigger value="delete" className="flex items-center gap-2">
              <Scissors className="w-4 h-4" />
              Delete Pages
            </TabsTrigger>
          </TabsList>

          <TabsContent value="merge" className="space-y-6">
            <div className="bg-card rounded-lg p-6 shadow-medium border border-border">
              <h2 className="text-2xl font-semibold mb-4 text-foreground">
                Bulk PDF Merger
              </h2>
              <p className="text-muted-foreground mb-6">
                Upload your PDF files and an Excel file with merge instructions. The Excel file should have columns for source PDFs (PDF1, PDF2, etc.) and a final column for the output name.
              </p>

              <div className="grid md:grid-cols-2 gap-6">
                <FileUpload
                  onFilesSelected={handlePdfFiles}
                  accept=".pdf"
                  multiple={true}
                  title="Upload PDF Files"
                  description="Drag & drop or click to select multiple PDFs"
                  files={pdfFiles}
                />
                <FileUpload
                  onFilesSelected={handleExcelFile}
                  accept=".xlsx,.xls"
                  multiple={false}
                  title="Upload Excel Instructions"
                  description="Excel file with merge instructions"
                  files={excelFile}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="delete" className="space-y-6">
            <div className="bg-card rounded-lg p-6 shadow-medium border border-border">
              <h2 className="text-2xl font-semibold mb-4 text-foreground">
                Bulk Page Deletion
              </h2>
              <p className="text-muted-foreground mb-6">
                Upload your PDF files and an Excel file with deletion instructions. The Excel file should have columns: PDF1 (source file), Delete Pages (e.g., "1,2-4,7"), and New PDF Name.
              </p>

              <div className="grid md:grid-cols-2 gap-6">
                <FileUpload
                  onFilesSelected={handlePdfFiles}
                  accept=".pdf"
                  multiple={true}
                  title="Upload PDF Files"
                  description="Drag & drop or click to select multiple PDFs"
                  files={pdfFiles}
                />
                <FileUpload
                  onFilesSelected={handleExcelFile}
                  accept=".xlsx,.xls"
                  multiple={false}
                  title="Upload Excel Instructions"
                  description="Excel file with page deletion instructions"
                  files={excelFile}
                />
              </div>
            </div>
          </TabsContent>

          {/* Processing Status */}
          <ProcessingStatus status={status} progress={progress} message={message} />

          {/* Action Buttons */}
          <div className="flex justify-center gap-4">
            <Button
              onClick={handleProcess}
              disabled={pdfFiles.length === 0 || excelFile.length === 0 || status === 'processing'}
              size="lg"
              className="min-w-[200px]"
            >
              {status === 'processing' ? 'Processing...' : 'Process PDFs'}
            </Button>
            {(pdfFiles.length > 0 || excelFile.length > 0) && (
              <Button
                onClick={resetFiles}
                variant="outline"
                size="lg"
                disabled={status === 'processing'}
              >
                Reset
              </Button>
            )}
          </div>
        </Tabs>

        {/* Instructions */}
        <div className="mt-12 bg-muted/50 rounded-lg p-6 border border-border">
          <h3 className="font-semibold text-lg mb-4 text-foreground">How to use:</h3>
          <div className="space-y-4 text-muted-foreground">
            <div>
              <p className="font-medium text-foreground mb-2">For Merging PDFs:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Create an Excel file with columns for each source PDF (PDF1, PDF2, etc.)</li>
                <li>Add a final column named "New PDF Name" for the output filename</li>
                <li>Each row represents one merge operation</li>
                <li>Upload all PDF files and the Excel instruction file</li>
                <li>Click "Process PDFs" to merge and download</li>
              </ol>
            </div>
            <div>
              <p className="font-medium text-foreground mb-2">For Deleting Pages:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Create an Excel file with three columns: PDF1, Delete Pages, New PDF Name</li>
                <li>In "Delete Pages", specify pages like "1", "2-4", or "1,3,5-7"</li>
                <li>Each row represents one PDF to process</li>
                <li>Upload all PDF files and the Excel instruction file</li>
                <li>Click "Process PDFs" to process and download</li>
              </ol>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
