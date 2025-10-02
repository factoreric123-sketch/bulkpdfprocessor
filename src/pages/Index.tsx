import { useState } from 'react';
import { FileText, Merge, Scissors, Download } from 'lucide-react';
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
import { downloadMergeTemplate, downloadDeleteTemplate } from '@/lib/templateGenerator';

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

  const handleRemovePdfFile = (index: number) => {
    setPdfFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemoveExcelFile = (index: number) => {
    setExcelFile(prev => prev.filter((_, i) => i !== index));
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
                Upload your PDF files and an Excel file with merge instructions. The Excel file should have columns: PDF1, PDF2, PDF3, PDF4, PDF5, and New PDF Name (last column). Empty cells are allowed if you need fewer PDFs.
              </p>

              <div className="grid md:grid-cols-2 gap-6">
                <FileUpload
                  onFilesSelected={handlePdfFiles}
                  accept=".pdf"
                  multiple={true}
                  title="Upload PDF Files"
                  description="Drag & drop or click to select multiple PDFs"
                  files={pdfFiles}
                  onRemoveFile={handleRemovePdfFile}
                />
                <FileUpload
                  onFilesSelected={handleExcelFile}
                  accept=".xlsx,.xls"
                  multiple={false}
                  title="Upload Excel Instructions"
                  description="Excel file with merge instructions"
                  files={excelFile}
                  onRemoveFile={handleRemoveExcelFile}
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
                  onRemoveFile={handleRemovePdfFile}
                />
                <FileUpload
                  onFilesSelected={handleExcelFile}
                  accept=".xlsx,.xls"
                  multiple={false}
                  title="Upload Excel Instructions"
                  description="Excel file with page deletion instructions"
                  files={excelFile}
                  onRemoveFile={handleRemoveExcelFile}
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

        {/* Templates Section */}
        <div className="mt-12 bg-muted/50 rounded-lg p-6 border border-border">
          <h3 className="font-semibold text-lg mb-6 text-foreground">Excel Templates & Instructions</h3>
          
          <div className="grid md:grid-cols-2 gap-8">
            {/* Merge Template */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-foreground">PDF Merge Template</h4>
                <Button
                  onClick={downloadMergeTemplate}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download Template
                </Button>
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-3">
                  <strong className="text-foreground">Columns:</strong> PDF1, PDF2, PDF3, PDF4, PDF5, New PDF Name
                </p>
                <p className="text-sm text-muted-foreground mb-3">
                  <strong className="text-foreground">Example Row:</strong>
                </p>
                <code className="text-xs bg-secondary px-2 py-1 rounded block mb-3">
                  part1.pdf | part2.pdf | part3.pdf | part4.pdf | part5.pdf | complete.pdf
                </code>
                <p className="text-sm text-muted-foreground">
                  Each row merges the listed PDFs into a single output file. Leave cells empty if you need fewer than 5 PDFs.
                </p>
              </div>
            </div>

            {/* Delete Template */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-foreground">Delete Pages Template</h4>
                <Button
                  onClick={downloadDeleteTemplate}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download Template
                </Button>
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-3">
                  <strong className="text-foreground">Columns:</strong> PDF1, Delete Pages, New PDF Name
                </p>
                <p className="text-sm text-muted-foreground mb-3">
                  <strong className="text-foreground">Example Row:</strong>
                </p>
                <code className="text-xs bg-secondary px-2 py-1 rounded block mb-3">
                  document.pdf | 1,3,5-7 | document_edited.pdf
                </code>
                <p className="text-sm text-muted-foreground">
                  Specify pages to delete like "1,3,5-7" or "2-4". Use commas for individual pages and hyphens for ranges.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
