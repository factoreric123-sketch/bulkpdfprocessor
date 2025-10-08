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
  mergePDFs,
  deletePagesFromPDF,
  splitPDF,
  reorderPDF,
  renamePDF,
  downloadPDFsAsZip,
  type MergeInstruction,
  type DeletePagesInstruction,
  type SplitInstruction,
  type ReorderInstruction,
  type RenameInstruction,
} from '@/lib/pdfProcessor';
import { 
  downloadMergeTemplate, 
  downloadDeleteTemplate,
  downloadSplitTemplate,
  downloadReorderTemplate,
  downloadRenameTemplate
} from '@/lib/templateGenerator';

const Index = () => {
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
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

      // 1) Upload PDFs to storage with the user's prefix
      setMessage('Uploading files to secure storage...');
      const CONCURRENCY = 5;
      const bucket = supabase.storage.from('pdf-uploads');
      const chunks: File[][] = [];
      for (let i = 0; i < pdfFiles.length; i += CONCURRENCY) {
        chunks.push(pdfFiles.slice(i, i + CONCURRENCY));
      }
      let uploaded = 0;
      for (const group of chunks) {
        await Promise.all(group.map(async (file) => {
          const path = `${user.id}/${file.name}`;
          await bucket.upload(path, file, { upsert: true, contentType: 'application/pdf' }).catch(() => {});
          uploaded += 1;
          setMessage(`Uploading files... (${uploaded}/${pdfFiles.length})`);
          setProgress((uploaded / pdfFiles.length) * 30); // reserve first 30% for uploads
        }));
      }

      // 2) Start server job
      setMessage('Starting server job...');
      const { data: start } = await supabase.functions.invoke('process-pdf-batch', {
        body: { operation: 'merge', instructions },
      });
      const jobId: string | undefined = (start as any)?.jobId;
      if (!jobId) throw new Error('Failed to start processing job');

      // 3) Poll job status until completion
      setMessage('Server processing your PDFs...');
      const pollInterval = 3000;
      const maxPollAttempts = 600; // 30 minutes max (600 * 3000ms)
      let pollAttempts = 0;
      await new Promise<void>((resolve, reject) => {
        const timer = setInterval(async () => {
          pollAttempts++;
          
          // Prevent infinite polling
          if (pollAttempts >= maxPollAttempts) {
            clearInterval(timer);
            reject(new Error('Processing timeout - job took too long'));
            return;
          }

          const { data, error } = await supabase
            .from('processing_jobs')
            .select('status, processed, total, errors, result_path')
            .eq('id', jobId)
            .single();

          if (error) {
            clearInterval(timer);
            reject(error);
            return;
          }

          if (!data) return;

          const pct = data.total > 0 ? (data.processed / data.total) * 70 + 30 : 30; // remaining 70%
          setProgress(Math.min(99, pct));
          setMessage(`Processing on server... (${data.processed}/${data.total})`);

          if (data.status === 'completed') {
            clearInterval(timer);
            setProgress(100);
            setStatus('success');

            // 4) Download ZIP via signed URL
            if (data.result_path) {
              const { data: urlData } = await supabase.storage
                .from('pdf-results')
                .createSignedUrl(data.result_path, 60 * 60);
              if (urlData?.signedUrl) window.open(urlData.signedUrl, '_blank');
            }

            // Deduct credits after successful processing
            deductCredits(creditsNeeded);

            // Show error report if any
            const errs: string[] = (data.errors as any) || [];
            if (errs.length > 0) {
              setErrorReport({ successful: data.total, failed: errs });
              toast({ title: 'Completed with warnings', description: `${errs.length} issue(s) encountered.`, });
            } else {
              toast({ title: 'Success!', description: `Processed ${data.total} PDFs. ${creditsNeeded} credit${creditsNeeded > 1 ? 's' : ''} used.` });
            }

            resolve();
          }

          if (data.status === 'failed') {
            clearInterval(timer);
            setStatus('error');
            setMessage('Server processing failed');
            const errs: string[] = (data.errors as any) || [];
            if (errs.length > 0) setErrorReport({ successful: data.processed, failed: errs });
            toast({ title: 'Processing failed', description: errs[0] || 'Unknown error', variant: 'destructive' });
            reject(new Error('Job failed'));
          }
        }, pollInterval);
      });
    } catch (error) {
      logger.error('Error processing PDFs:', error);
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'An error occurred while processing PDFs');
      toast({ title: 'Processing failed', description: error instanceof Error ? error.message : 'An error occurred', variant: 'destructive' });
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
      const creditsNeeded = instructions.length;

      // Check credits before processing
      if (!hasCredits(creditsNeeded)) {
        setRequiredCredits(creditsNeeded);
        setShowNoCreditsDialog(true);
        setStatus('idle');
        return;
      }

      const pdfMap = new Map(pdfFiles.map((file) => [file.name, file]));
      const processedPDFs: { name: string; data: Uint8Array }[] = [];
      const allMissingFiles: string[] = [];

      for (let i = 0; i < instructions.length; i++) {
        const instruction = instructions[i];
        setMessage(`Processing ${instruction.sourceFile}... (${i + 1}/${instructions.length})`);
        
        const result = await deletePagesFromPDF(instruction, pdfMap, (fileProgress) => {
          const totalProgress = ((i / instructions.length) * 100) + (fileProgress / instructions.length);
          setProgress(totalProgress);
        });

        if (result) {
          processedPDFs.push({ name: instruction.outputName, data: result.data });
        } else {
          allMissingFiles.push(instruction.sourceFile);
        }
      }

      setMessage('Creating ZIP file...');
      await downloadPDFsAsZip(processedPDFs);

      // Deduct credits after successful processing
      deductCredits(creditsNeeded);

      setStatus('success');
      setMessage(`Successfully processed ${processedPDFs.length} PDF${processedPDFs.length > 1 ? 's' : ''}!`);
      setProgress(100);
      
      // Show error report if there were missing files
      if (allMissingFiles.length > 0) {
        setErrorReport({ successful: processedPDFs.length, failed: allMissingFiles });
      }
      
      toast({
        title: allMissingFiles.length > 0 ? 'Completed with warnings' : 'Success!',
        description: allMissingFiles.length > 0 
          ? `Processed ${processedPDFs.length} PDF${processedPDFs.length > 1 ? 's' : ''}. ${allMissingFiles.length} file${allMissingFiles.length > 1 ? 's were' : ' was'} skipped.`
          : `Downloaded ${processedPDFs.length} processed PDF${processedPDFs.length > 1 ? 's' : ''} as ZIP. ${creditsNeeded} credit${creditsNeeded > 1 ? 's' : ''} used.`,
      });
    } catch (error) {
      logger.error('Error processing PDFs:', error);
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'An error occurred while processing PDFs');
      toast({
        title: 'Processing failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  const processSplit = async () => {
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
      const instructions = await parseSplitExcel(excelFile[0]);
      const creditsNeeded = instructions.length;

      // Check credits before processing
      if (!hasCredits(creditsNeeded)) {
        setRequiredCredits(creditsNeeded);
        setShowNoCreditsDialog(true);
        setStatus('idle');
        return;
      }

      const pdfMap = new Map(pdfFiles.map((file) => [file.name, file]));
      const processedPDFs: { name: string; data: Uint8Array }[] = [];
      const allMissingFiles: string[] = [];

      for (let i = 0; i < instructions.length; i++) {
        const instruction = instructions[i];
        setMessage(`Splitting ${instruction.sourceFile}... (${i + 1}/${instructions.length})`);
        
        const splitPdfFiles = await splitPDF(instruction, pdfMap, (fileProgress) => {
          const totalProgress = ((i / instructions.length) * 100) + (fileProgress / instructions.length);
          setProgress(totalProgress);
        });

        if (splitPdfFiles) {
          processedPDFs.push(...splitPdfFiles);
        } else {
          allMissingFiles.push(instruction.sourceFile);
        }
      }

      setMessage('Creating ZIP file...');
      await downloadPDFsAsZip(processedPDFs);

      // Deduct credits after successful processing
      deductCredits(creditsNeeded);

      setStatus('success');
      setMessage(`Successfully split ${processedPDFs.length} PDF${processedPDFs.length > 1 ? 's' : ''}!`);
      setProgress(100);
      
      // Show error report if there were missing files
      if (allMissingFiles.length > 0) {
        setErrorReport({ successful: processedPDFs.length, failed: allMissingFiles });
      }
      
      toast({
        title: allMissingFiles.length > 0 ? 'Completed with warnings' : 'Success!',
        description: allMissingFiles.length > 0 
          ? `Processed ${processedPDFs.length} PDF${processedPDFs.length > 1 ? 's' : ''}. ${allMissingFiles.length} file${allMissingFiles.length > 1 ? 's were' : ' was'} skipped.`
          : `Downloaded ${processedPDFs.length} split PDF${processedPDFs.length > 1 ? 's' : ''} as ZIP. ${creditsNeeded} credit${creditsNeeded > 1 ? 's' : ''} used.`,
      });
    } catch (error) {
      logger.error('Error processing PDFs:', error);
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'An error occurred while processing PDFs');
      toast({
        title: 'Processing failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  const processReorder = async () => {
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
      const instructions = await parseReorderExcel(excelFile[0]);
      const creditsNeeded = instructions.length;

      // Check credits before processing
      if (!hasCredits(creditsNeeded)) {
        setRequiredCredits(creditsNeeded);
        setShowNoCreditsDialog(true);
        setStatus('idle');
        return;
      }

      const pdfMap = new Map(pdfFiles.map((file) => [file.name, file]));
      const processedPDFs: { name: string; data: Uint8Array }[] = [];
      const allMissingFiles: string[] = [];

      for (let i = 0; i < instructions.length; i++) {
        const instruction = instructions[i];
        setMessage(`Reordering ${instruction.sourceFile}... (${i + 1}/${instructions.length})`);
        
        const result = await reorderPDF(instruction, pdfMap, (fileProgress) => {
          const totalProgress = ((i / instructions.length) * 100) + (fileProgress / instructions.length);
          setProgress(totalProgress);
        });

        if (result) {
          processedPDFs.push({ name: instruction.outputName, data: result.data });
        } else {
          allMissingFiles.push(instruction.sourceFile);
        }
      }

      setMessage('Creating ZIP file...');
      await downloadPDFsAsZip(processedPDFs);

      // Deduct credits after successful processing
      deductCredits(creditsNeeded);

      setStatus('success');
      setMessage(`Successfully reordered ${processedPDFs.length} PDF${processedPDFs.length > 1 ? 's' : ''}!`);
      setProgress(100);
      
      // Show error report if there were missing files
      if (allMissingFiles.length > 0) {
        setErrorReport({ successful: processedPDFs.length, failed: allMissingFiles });
      }
      
      toast({
        title: allMissingFiles.length > 0 ? 'Completed with warnings' : 'Success!',
        description: allMissingFiles.length > 0 
          ? `Processed ${processedPDFs.length} PDF${processedPDFs.length > 1 ? 's' : ''}. ${allMissingFiles.length} file${allMissingFiles.length > 1 ? 's were' : ' was'} skipped.`
          : `Downloaded ${processedPDFs.length} reordered PDF${processedPDFs.length > 1 ? 's' : ''} as ZIP. ${creditsNeeded} credit${creditsNeeded > 1 ? 's' : ''} used.`,
      });
    } catch (error) {
      logger.error('Error processing PDFs:', error);
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'An error occurred while processing PDFs');
      toast({
        title: 'Processing failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  const processRename = async () => {
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
      const instructions = await parseRenameExcel(excelFile[0]);
      const creditsNeeded = instructions.length;

      // Check credits before processing
      if (!hasCredits(creditsNeeded)) {
        setRequiredCredits(creditsNeeded);
        setShowNoCreditsDialog(true);
        setStatus('idle');
        return;
      }

      const pdfMap = new Map(pdfFiles.map((file) => [file.name, file]));
      const processedPDFs: { name: string; data: Uint8Array }[] = [];
      const allMissingFiles: string[] = [];

      for (let i = 0; i < instructions.length; i++) {
        const instruction = instructions[i];
        setMessage(`Renaming ${instruction.oldName}... (${i + 1}/${instructions.length})`);
        
        const renamedPdf = await renamePDF(instruction, pdfMap);
        
        if (renamedPdf) {
          processedPDFs.push(renamedPdf);
        } else {
          allMissingFiles.push(instruction.oldName);
        }
        
        const progress = ((i + 1) / instructions.length) * 100;
        setProgress(progress);
      }

      setMessage('Creating ZIP file...');
      await downloadPDFsAsZip(processedPDFs);

      // Deduct credits after successful processing
      deductCredits(creditsNeeded);

      setStatus('success');
      setMessage(`Successfully renamed ${processedPDFs.length} PDF${processedPDFs.length > 1 ? 's' : ''}!`);
      setProgress(100);
      
      // Show error report if there were missing files
      if (allMissingFiles.length > 0) {
        setErrorReport({ successful: processedPDFs.length, failed: allMissingFiles });
      }
      
      toast({
        title: allMissingFiles.length > 0 ? 'Completed with warnings' : 'Success!',
        description: allMissingFiles.length > 0 
          ? `Processed ${processedPDFs.length} PDF${processedPDFs.length > 1 ? 's' : ''}. ${allMissingFiles.length} file${allMissingFiles.length > 1 ? 's were' : ' was'} skipped.`
          : `Downloaded ${processedPDFs.length} renamed PDF${processedPDFs.length > 1 ? 's' : ''} as ZIP. ${creditsNeeded} credit${creditsNeeded > 1 ? 's' : ''} used.`,
      });
    } catch (error) {
      logger.error('Error processing PDFs:', error);
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
    } else if (activeTab === 'delete') {
      processDeletePages();
    } else if (activeTab === 'split') {
      processSplit();
    } else if (activeTab === 'reorder') {
      processReorder();
    } else if (activeTab === 'rename') {
      processRename();
    }
  };

  const resetFiles = () => {
    setPdfFiles([]);
    setExcelFile([]);
    setStatus('idle');
    setProgress(0);
    setMessage('');
    setErrorReport(null);
    setBatchProgress({ current: 0, total: 0 });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <header className="bg-gradient-primary text-primary-foreground py-8 px-4 relative z-10">
        <div className="container max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div className="flex-1">
              <CreditDisplay 
                credits={credits} 
                isLoading={creditsLoading} 
                planName={subscription?.plan_name}
                isUnlimited={isUnlimited}
              />
            </div>
            <div className="flex-1 flex justify-center">
              <FileText className="w-16 h-16" />
            </div>
            <div className="flex-1 flex justify-end gap-2 relative z-20">
              {user && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/profile')}
                  className="gap-2 bg-background/10 border-primary-foreground/20 hover:bg-background/20 cursor-pointer"
                >
                  <UserCircle className="w-4 h-4" />
                  Profile
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/subscriptions')}
                className="gap-2 bg-background/10 border-primary-foreground/20 hover:bg-background/20 cursor-pointer"
              >
                <CreditCard className="w-4 h-4" />
                Plans
              </Button>
              {user ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="gap-2 bg-background/10 border-primary-foreground/20 hover:bg-background/20 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/auth')}
                    className="gap-2 bg-background/10 border-primary-foreground/20 hover:bg-background/20 cursor-pointer"
                  >
                    Login
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/auth', { state: { isSignUp: true } })}
                    className="gap-2 bg-background/10 border-primary-foreground/20 hover:bg-background/20 cursor-pointer"
                  >
                    Get Started
                  </Button>
                </>
              )}
            </div>
          </div>
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Bulk PDF Processor
            </h1>
            <p className="text-lg md:text-xl opacity-90 max-w-2xl mx-auto">
              Process PDFs in bulk - merge, split, delete pages, reorder, and rename using Excel instructions
            </p>
          </div>
        </div>
      </header>
      
      <NoCreditsDialog 
        open={showNoCreditsDialog}
        onOpenChange={setShowNoCreditsDialog}
        requiredCredits={requiredCredits}
        availableCredits={credits}
        isAuthenticated={!!user}
      />

      {/* Main Content */}
      <main className="container max-w-6xl mx-auto px-4 py-12">
        <SubscriptionStatus />
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="grid w-full max-w-6xl mx-auto grid-cols-5 bg-card shadow-soft">
            <TabsTrigger value="merge" className="flex items-center gap-2">
              <Merge className="w-4 h-4" />
              Merge
            </TabsTrigger>
            <TabsTrigger value="delete" className="flex items-center gap-2">
              <Scissors className="w-4 h-4" />
              Delete
            </TabsTrigger>
            <TabsTrigger value="split" className="flex items-center gap-2">
              <FileStack className="w-4 h-4" />
              Split
            </TabsTrigger>
            <TabsTrigger value="reorder" className="flex items-center gap-2">
              <ArrowDownUp className="w-4 h-4" />
              Reorder
            </TabsTrigger>
            <TabsTrigger value="rename" className="flex items-center gap-2">
              <FileEdit className="w-4 h-4" />
              Rename
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

          <TabsContent value="split" className="space-y-6">
            <div className="bg-card rounded-lg p-6 shadow-medium border border-border">
              <h2 className="text-2xl font-semibold mb-4 text-foreground">
                Bulk PDF Splitting
              </h2>
              <p className="text-muted-foreground mb-6">
                Upload your PDF files and an Excel file with split instructions. The Excel file should have columns: PDF File, Page Ranges (e.g., "1-5, 6-10"), and Output Names.
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
                  description="Excel file with split instructions"
                  files={excelFile}
                  onRemoveFile={handleRemoveExcelFile}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="reorder" className="space-y-6">
            <div className="bg-card rounded-lg p-6 shadow-medium border border-border">
              <h2 className="text-2xl font-semibold mb-4 text-foreground">
                Bulk Page Reordering
              </h2>
              <p className="text-muted-foreground mb-6">
                Upload your PDF files and an Excel file with reorder instructions. The Excel file should have columns: PDF File, New Page Order (e.g., "5,2,1-3"), and Output Name.
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
                  description="Excel file with reorder instructions"
                  files={excelFile}
                  onRemoveFile={handleRemoveExcelFile}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="rename" className="space-y-6">
            <div className="bg-card rounded-lg p-6 shadow-medium border border-border">
              <h2 className="text-2xl font-semibold mb-4 text-foreground">
                Bulk PDF Renaming
              </h2>
              <p className="text-muted-foreground mb-6">
                Upload your PDF files and an Excel file with rename instructions. The Excel file should have columns: Old File Name and New File Name.
              </p>

              <div className="grid md:grid-cols-2 gap-6">
                <FileUpload
                  onFilesSelected={handlePdfFiles}
                  accept=".pdf"
                  multiple={true}
                  title="Upload PDF Files"
                  description="Drag & drop or click to select PDFs"
                  files={pdfFiles}
                  onRemoveFile={handleRemovePdfFile}
                />
                <FileUpload
                  onFilesSelected={handleExcelFile}
                  accept=".xlsx,.xls"
                  multiple={false}
                  title="Upload Excel Instructions"
                  description="Excel file with rename instructions"
                  files={excelFile}
                  onRemoveFile={handleRemoveExcelFile}
                />
              </div>
            </div>
          </TabsContent>

          {/* Processing Status */}
          <ProcessingStatus status={status} progress={progress} message={message} batchProgress={batchProgress} />
          
          {/* Error Report */}
          {errorReport && (
            <ErrorReport 
              successful={errorReport.successful} 
              failed={errorReport.failed}
              onClose={() => setErrorReport(null)}
            />
          )}

          {/* Action Buttons */}
          <div className="flex justify-center gap-4">
            <Button
              onClick={handleProcess}
              disabled={pdfFiles.length === 0 || excelFile.length === 0 || status === 'processing'}
              size="lg"
              className="min-w-[200px]"
            >
              {status === 'processing' ? 'Processing...' : 'Process Files'}
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
        <div className="mt-12 bg-card rounded-lg p-8 shadow-medium border border-border">
          <h3 className="text-2xl font-semibold text-foreground mb-8">Excel Templates & Instructions</h3>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Merge Template */}
            <div className="border border-border rounded-lg p-5 space-y-3 hover:shadow-lg transition-shadow bg-background">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h4 className="font-semibold text-foreground text-base leading-tight">PDF Merge Template</h4>
                <Button
                  onClick={downloadMergeTemplate}
                  variant="outline"
                  size="sm"
                  className="gap-1.5 shrink-0 h-8 text-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Template
                </Button>
              </div>
              <div className="bg-secondary/50 rounded-md p-3 space-y-2">
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">Columns:</strong> PDF1, PDF2, PDF3, PDF4, PDF5, New PDF Name
                </p>
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">Example Row:</strong>
                </p>
                <code className="text-[10px] bg-background px-2 py-1 rounded block">
                  part1.pdf | part2.pdf | part3.pdf | part4.pdf | part5.pdf | complete.pdf
                </code>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Each row merges the listed PDFs into a single output file. Leave cells empty if you need fewer than 5 PDFs.
                </p>
              </div>
            </div>

            {/* Delete Template */}
            <div className="border border-border rounded-lg p-5 space-y-3 hover:shadow-lg transition-shadow bg-background">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h4 className="font-semibold text-foreground text-base leading-tight">Delete Pages Template</h4>
                <Button
                  onClick={downloadDeleteTemplate}
                  variant="outline"
                  size="sm"
                  className="gap-1.5 shrink-0 h-8 text-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Template
                </Button>
              </div>
              <div className="bg-secondary/50 rounded-md p-3 space-y-2">
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">Columns:</strong> PDF1, Delete Pages, New PDF Name
                </p>
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">Example Row:</strong>
                </p>
                <code className="text-[10px] bg-background px-2 py-1 rounded block">
                  document.pdf | 1,3,5-7 | document_edited.pdf
                </code>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Specify pages to delete like "1,3,5-7" or "2-4". Use commas for individual pages and hyphens for ranges.
                </p>
              </div>
            </div>

            {/* Split Template */}
            <div className="border border-border rounded-lg p-5 space-y-3 hover:shadow-lg transition-shadow bg-background">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h4 className="font-semibold text-foreground text-base leading-tight">Split Template</h4>
                <Button
                  onClick={downloadSplitTemplate}
                  variant="outline"
                  size="sm"
                  className="gap-1.5 shrink-0 h-8 text-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </Button>
              </div>
              <div className="bg-secondary/50 rounded-md p-3 space-y-2">
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">Columns:</strong> PDF File, Page Ranges, Output Names
                </p>
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">Example:</strong>
                </p>
                <code className="text-[10px] bg-background px-2 py-1 rounded block">
                  document.pdf | 1-5, 6-10 | part1.pdf, part2.pdf
                </code>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Split a PDF into multiple files using page ranges. Each range creates a separate output file.
                </p>
              </div>
            </div>

            {/* Reorder Template */}
            <div className="border border-border rounded-lg p-5 space-y-3 hover:shadow-lg transition-shadow bg-background">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h4 className="font-semibold text-foreground text-base leading-tight">Reorder Template</h4>
                <Button
                  onClick={downloadReorderTemplate}
                  variant="outline"
                  size="sm"
                  className="gap-1.5 shrink-0 h-8 text-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </Button>
              </div>
              <div className="bg-secondary/50 rounded-md p-3 space-y-2">
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">Columns:</strong> PDF File, New Page Order, Output Name
                </p>
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">Example:</strong>
                </p>
                <code className="text-[10px] bg-background px-2 py-1 rounded block">
                  document.pdf | 5,2,1-3,6 | reordered.pdf
                </code>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Rearrange pages in a PDF. Use numbers for individual pages and ranges like "1-3".
                </p>
              </div>
            </div>

            {/* Rename Template */}
            <div className="border border-border rounded-lg p-5 space-y-3 hover:shadow-lg transition-shadow bg-background">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h4 className="font-semibold text-foreground text-base leading-tight">Rename Template</h4>
                <Button
                  onClick={downloadRenameTemplate}
                  variant="outline"
                  size="sm"
                  className="gap-1.5 shrink-0 h-8 text-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </Button>
              </div>
              <div className="bg-secondary/50 rounded-md p-3 space-y-2">
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">Columns:</strong> Old File Name, New File Name
                </p>
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">Example:</strong>
                </p>
                <code className="text-[10px] bg-background px-2 py-1 rounded block">
                  document.pdf | renamed_document.pdf
                </code>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Bulk rename PDF files according to your Excel instructions.
                </p>
              </div>
            </div>

          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Index;
