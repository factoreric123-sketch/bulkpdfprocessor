import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Merge, Scissors, Download, FileStack, ArrowDownUp, FileEdit, LogOut, CreditCard, UserCircle, FileType, File } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileUpload } from '@/components/FileUpload';
import { ProcessingStatus } from '@/components/ProcessingStatus';
import { CreditDisplay } from '@/components/CreditDisplay';
import { SubscriptionStatus } from '@/components/SubscriptionStatus';
import { NoCreditsDialog } from '@/components/NoCreditsDialog';
import { ErrorReport } from '@/components/ErrorReport';
import { Footer } from '@/components/Footer';
import { useToast } from '@/hooks/use-toast';
import { useCredits } from '@/hooks/useCredits';
import {
  parseMergeExcel,
  parseDeletePagesExcel,
  parseSplitExcel,
  parseReorderExcel,
  parseRenameExcel,
  deletePagesFromPDF,
  splitPDF,
  reorderPDF,
  renamePDF,
  downloadPDFsAsZip,
} from '@/lib/pdfProcessor';
import { processMergeV2 } from '@/lib/mergeProcessorV2';
import { FILE_PROCESSING } from '@/lib/constants';
import { 
  downloadMergeTemplate, 
  downloadDeleteTemplate,
  downloadSplitTemplate,
  downloadReorderTemplate,
  downloadRenameTemplate
} from '@/lib/templateGenerator';
import {
  parseWordToPdfExcel,
  parsePdfToWordExcel,
  parseRenameWordExcel,
} from '@/lib/wordExcelParser';
import {
  convertWordToPdf,
  convertPdfToWord,
  renameWordFile,
  downloadFilesAsZip,
  type WordToPdfInstruction,
  type PdfToWordInstruction,
  type RenameWordInstruction,
} from '@/lib/wordProcessor';
import {
  downloadWordToPdfTemplate,
  downloadPdfToWordTemplate,
  downloadRenameWordTemplate,
} from '@/lib/wordTemplateGenerator';

const IndexV2 = () => {
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [wordFiles, setWordFiles] = useState<File[]>([]);
  const [excelFile, setExcelFile] = useState<File[]>([]);
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('merge');
  const [showNoCreditsDialog, setShowNoCreditsDialog] = useState(false);
  const [requiredCredits, setRequiredCredits] = useState(0);
  const [errorReport, setErrorReport] = useState<{ successful: number; failed: string[] } | null>(null);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const { toast } = useToast();
  const navigate = useNavigate();
  const { credits, isLoading: creditsLoading, deductCredits, hasCredits, user, subscription, isUnlimited } = useCredits();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: 'Signed out',
        description: 'You have been signed out successfully.',
      });
      navigate('/auth');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to sign out.',
        variant: 'destructive',
      });
    }
  };

  const handlePdfFiles = (files: File[]) => {
    setPdfFiles(files);
  };

  const handleWordFiles = (files: File[]) => {
    setWordFiles(files);
  };

  const handleExcelFile = (files: File[]) => {
    setExcelFile(files);
  };

  const handleRemovePdfFile = (index: number) => {
    setPdfFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemoveWordFile = (index: number) => {
    setWordFiles(prev => prev.filter((_, i) => i !== index));
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

    // Check file count limit
    if (pdfFiles.length > FILE_PROCESSING.MAX_FILES_PER_BATCH) {
      toast({
        title: 'Too many files',
        description: `Maximum ${FILE_PROCESSING.MAX_FILES_PER_BATCH} files allowed per batch. You have ${pdfFiles.length} files.`,
        variant: 'destructive',
      });
      return;
    }

    setStatus('processing');
    setMessage('Parsing Excel instructions...');
    setProgress(0);
    setErrorReport(null);
    setBatchProgress({ current: 0, total: 0 });

    try {
      const instructions = await parseMergeExcel(excelFile[0]);
      const creditsNeeded = instructions.length;

      if (!hasCredits(creditsNeeded)) {
        setRequiredCredits(creditsNeeded);
        setShowNoCreditsDialog(true);
        setStatus('idle');
        return;
      }

      if (!user?.id) {
        toast({ title: 'Sign in required', description: 'Please sign in to start processing.', variant: 'destructive' });
        setStatus('idle');
        return;
      }

      // Use the new V2 processor
      const result = await processMergeV2({
        pdfFiles,
        excelFile: excelFile[0],
        userId: user.id,
        onProgress: (progress, message) => {
          setProgress(progress);
          setMessage(message);
        },
        onBatchProgress: (current, total) => {
          setBatchProgress({ current, total });
        },
      });

      if (result.success) {
        // Deduct credits after successful processing
        await deductCredits(creditsNeeded);
        
        setStatus('success');
        setMessage('✅ Processing completed successfully!');
        
        if (result.errors && result.errors.length > 0) {
          setErrorReport({
            successful: result.processedCount || 0,
            failed: result.errors,
          });
          toast({
            title: 'Completed with warnings',
            description: `Processed ${result.processedCount} items. ${result.errors.length} issue(s) encountered.`,
          });
        } else {
          toast({
            title: 'Success!',
            description: `Successfully processed ${result.processedCount} merge operations. ${creditsNeeded} credit${creditsNeeded > 1 ? 's' : ''} used.`,
          });
        }
      } else {
        throw new Error(result.message || 'Processing failed');
      }
    } catch (error) {
      logger.error('Merge error:', error);
      setStatus('error');
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
      toast({
        title: 'Processing failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      // Reset batch progress
      setBatchProgress({ current: 0, total: 0 });
    }
  };

  // ... rest of the component code remains the same as original Index.tsx ...
  // (processDeletePages, processSplit, processReorder, processRename, processWordToPdf, etc.)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="w-full bg-white shadow-sm relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FileText className="h-8 w-8 text-primary" />
              Bulk PDF Processor
            </h1>
            <div className="flex items-center gap-4">
              <CreditDisplay 
                credits={credits} 
                isLoading={creditsLoading}
                planName={subscription?.plan_name || undefined}
                isUnlimited={isUnlimited}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/subscriptions')}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Upgrade
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/profile')}
              >
                <UserCircle className="h-4 w-4 mr-2" />
                Profile
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            Process Multiple PDFs at Once
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Upload your PDF files and an Excel instruction file to merge, split, delete pages, 
            reorder, rename, or convert them in bulk. Save hours of manual work!
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Maximum {FILE_PROCESSING.MAX_FILES_PER_BATCH} files per batch
          </p>
        </div>

        <SubscriptionStatus />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 mb-8">
            <TabsTrigger value="merge" className="flex items-center gap-1">
              <Merge className="h-4 w-4" />
              <span className="hidden sm:inline">Merge</span>
            </TabsTrigger>
            <TabsTrigger value="split" className="flex items-center gap-1">
              <Scissors className="h-4 w-4" />
              <span className="hidden sm:inline">Split</span>
            </TabsTrigger>
            <TabsTrigger value="delete" className="flex items-center gap-1">
              <FileStack className="h-4 w-4" />
              <span className="hidden sm:inline">Delete Pages</span>
            </TabsTrigger>
            <TabsTrigger value="reorder" className="flex items-center gap-1">
              <ArrowDownUp className="h-4 w-4" />
              <span className="hidden sm:inline">Reorder</span>
            </TabsTrigger>
            <TabsTrigger value="rename" className="flex items-center gap-1">
              <FileEdit className="h-4 w-4" />
              <span className="hidden sm:inline">Rename</span>
            </TabsTrigger>
            <TabsTrigger value="convert" className="flex items-center gap-1">
              <FileType className="h-4 w-4" />
              <span className="hidden sm:inline">Convert</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab content would continue here... */}
          {/* For brevity, I'm showing just the merge tab as an example */}
          <TabsContent value="merge" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">1. Upload PDF Files to Merge</h3>
                <FileUpload
                  accept=".pdf"
                  multiple
                  onFilesSelected={handlePdfFiles}
                  files={pdfFiles}
                  onRemoveFile={handleRemovePdfFile}
                  title="Upload PDF Files"
                  description="Drag and drop your PDF files here or click to browse"
                />
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">2. Upload Excel Instructions</h3>
                <FileUpload
                  accept=".xlsx,.xls"
                  multiple={false}
                  onFilesSelected={handleExcelFile}
                  files={excelFile}
                  onRemoveFile={handleRemoveExcelFile}
                  title="Upload Excel Instructions"
                  description="Upload your Excel file with merge instructions"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadMergeTemplate}
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Excel Template
                </Button>
              </div>
            </div>

            {status !== 'idle' && (
              <ProcessingStatus 
                status={status} 
                progress={progress} 
                message={message} 
                batchProgress={batchProgress}
              />
            )}

            {errorReport && (
              <ErrorReport
                successful={errorReport.successful}
                failed={errorReport.failed}
                onClose={() => setErrorReport(null)}
              />
            )}

            <Button
              onClick={processMerge}
              disabled={status === 'processing' || pdfFiles.length === 0 || excelFile.length === 0}
              size="lg"
              className="w-full"
            >
              <Merge className="h-5 w-5 mr-2" />
              Merge PDFs ({pdfFiles.length} files)
            </Button>
          </TabsContent>
        </Tabs>

        <NoCreditsDialog
          open={showNoCreditsDialog}
          onOpenChange={setShowNoCreditsDialog}
          requiredCredits={requiredCredits}
          availableCredits={credits}
          isAuthenticated={!!user}
        />
      </main>

      <Footer />
    </div>
  );
};

export default IndexV2;