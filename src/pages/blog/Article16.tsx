import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/Footer";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const Article16 = () => {
  useEffect(() => {
    document.title = "Get a List of All File Names in a Folder in Under 30 Seconds | Bulk PDF Processor";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute("content", "Learn the fastest methods to extract file names from folders using command line tools and automation tricks for bulk PDF processing workflows.");
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1">
        <article className="container mx-auto px-4 py-12 max-w-4xl">
          <Link to="/blog" className="inline-flex items-center text-primary hover:underline mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Blog
          </Link>
          <header className="mb-8">
            <div className="inline-block bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-semibold mb-4">Quick Tip</div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">How to Get a List of All File Names in a Folder in Under 30 Seconds</h1>
            <p className="text-xl text-muted-foreground">Master the fastest command-line tricks to extract file lists for bulk PDF processing and automation workflows.</p>
          </header>
          <div className="prose prose-lg max-w-none">
            <h2>Why You Need File Lists for Automation</h2>
            <p>Every bulk PDF workflow starts the same way: you need a list of files to process. Manually typing hundreds of filenames into Excel? Nightmare. Copying and pasting one by one? Tedious and error-prone.</p>
            <p>The solution: automated file list extraction. One command. Seconds of execution. Complete, accurate filename lists ready for your automation templates.</p>
            
            <h2>Method 1: Windows Command Prompt (The Fastest)</h2>
            <h3>Basic File List</h3>
            <p>Open Command Prompt in your target folder (Shift + Right-click folder → "Open command window here" or "Open PowerShell window here").</p>
            <p>Type this command:</p>
            <p><code>dir /b &gt; filelist.txt</code></p>
            <p>Result: A text file called "filelist.txt" containing every filename in the folder, one per line. Takes 2 seconds.</p>
            
            <h3>PDF Files Only</h3>
            <p>To list only PDF files:</p>
            <p><code>dir /b *.pdf &gt; pdf_files.txt</code></p>
            <p>The <code>*.pdf</code> filter shows only PDF files. Ignore subfolders, images, and other file types.</p>
            
            <h3>Include Full Paths</h3>
            <p>For workflows needing full file paths:</p>
            <p><code>dir /b /s *.pdf &gt; pdf_paths.txt</code></p>
            <p>The <code>/s</code> flag includes files in subfolders with complete path information.</p>
            
            <h3>Command Breakdown</h3>
            <ul>
              <li><code>dir</code> – Directory command (lists files)</li>
              <li><code>/b</code> – Bare format (filenames only, no dates/sizes)</li>
              <li><code>/s</code> – Include subdirectories</li>
              <li><code>*.pdf</code> – Filter for PDF files only</li>
              <li><code>&gt; filename.txt</code> – Save output to text file</li>
            </ul>
            
            <h2>Method 2: PowerShell (More Powerful)</h2>
            <h3>Basic PowerShell File List</h3>
            <p>Open PowerShell in your target folder, then run:</p>
            <p><code>Get-ChildItem -Name &gt; filelist.txt</code></p>
            
            <h3>Filter by File Type</h3>
            <p><code>Get-ChildItem -Filter *.pdf -Name &gt; pdf_files.txt</code></p>
            
            <h3>Include Subdirectories</h3>
            <p><code>Get-ChildItem -Filter *.pdf -Recurse -Name &gt; all_pdfs.txt</code></p>
            
            <h3>Export to CSV with Metadata</h3>
            <p>For advanced workflows needing file size, dates, etc.:</p>
            <p><code>Get-ChildItem -Filter *.pdf | Select-Object Name, Length, LastWriteTime | Export-Csv -Path files.csv -NoTypeInformation</code></p>
            <p>This creates a CSV file with filename, file size, and last modified date—perfect for Excel-based automation templates.</p>
            
            <h2>Method 3: macOS/Linux Terminal</h2>
            <h3>Basic File List</h3>
            <p>Open Terminal, navigate to folder (<code>cd /path/to/folder</code>), then:</p>
            <p><code>ls &gt; filelist.txt</code></p>
            
            <h3>PDF Files Only</h3>
            <p><code>ls *.pdf &gt; pdf_files.txt</code></p>
            
            <h3>One File Per Line (Handles Spaces)</h3>
            <p><code>ls -1 *.pdf &gt; pdf_files.txt</code></p>
            <p>The <code>-1</code> flag ensures one filename per line, even with spaces in names.</p>
            
            <h3>Include Subdirectories</h3>
            <p><code>find . -name "*.pdf" &gt; all_pdfs.txt</code></p>
            
            <h2>Method 4: Using File Explorers</h2>
            <h3>Windows Explorer Trick</h3>
            <ol>
              <li>Open folder in Windows Explorer</li>
              <li>Select all files (Ctrl+A)</li>
              <li>Hold Shift, right-click selection</li>
              <li>Choose "Copy as path"</li>
              <li>Paste into Excel or text editor</li>
            </ol>
            <p>This copies full paths including filenames. Clean up in Excel by extracting just filenames if needed.</p>
            
            <h3>Third-Party Tools</h3>
            <p>Tools like "Karen's Directory Printer" or "Print Folder" provide GUI interfaces for file list generation. Useful for non-technical users uncomfortable with command line.</p>
            
            <h2>Integrating File Lists into Automation Workflows</h2>
            <h3>Step 1: Generate File List</h3>
            <p>Use any method above to create <code>filelist.txt</code> or <code>filelist.csv</code>.</p>
            
            <h3>Step 2: Import to Excel</h3>
            <p>Open Excel. Use Data → From Text/CSV. Import your file list. Filenames now populate Column A.</p>
            
            <h3>Step 3: Build Automation Instructions</h3>
            <p>With filenames in Column A, use formulas to generate:</p>
            <ul>
              <li><strong>Rename instructions:</strong> Column B contains new names using CONCATENATE</li>
              <li><strong>Merge instructions:</strong> Columns B-E list files to merge per output</li>
              <li><strong>Split instructions:</strong> Column B specifies page ranges per file</li>
            </ul>
            
            <h3>Step 4: Execute Bulk Operation</h3>
            <p>Upload Excel instruction file to bulk PDF processor. Execute. All files processed according to your instructions.</p>
            
            <h2>Advanced File List Techniques</h2>
            <h3>Filtering by Date (Windows)</h3>
            <p>List only files modified in last 7 days:</p>
            <p><code>forfiles /D -7 /M *.pdf /C "cmd /c echo @file" &gt; recent_pdfs.txt</code></p>
            
            <h3>Sorting File Lists</h3>
            <p>Sort alphabetically (PowerShell):</p>
            <p><code>Get-ChildItem -Name *.pdf | Sort-Object &gt; sorted_files.txt</code></p>
            
            <h3>Excluding Patterns</h3>
            <p>List PDFs except those starting with "temp" (PowerShell):</p>
            <p><code>Get-ChildItem -Filter *.pdf | Where-Object &#123;$_.Name -notlike "temp*"&#125; | Select-Object -ExpandProperty Name &gt; filtered_files.txt</code></p>
            
            <h2>Common Use Cases</h2>
            <h3>Preparing Bulk Rename Operations</h3>
            <p>Generate file list → Import to Excel → Apply naming formula → Upload rename instructions. Rename 500 files in minutes.</p>
            
            <h3>Building Merge Templates</h3>
            <p>List all client folders → Generate merge instructions per client → Batch process hundreds of client packages.</p>
            
            <h3>Discovery Document Inventories</h3>
            <p>Extract complete file lists with metadata → Import to case management system → Track document processing status.</p>
            
            <h2>Troubleshooting Common Issues</h2>
            <h3>Issue: Output File Empty</h3>
            <p><strong>Cause:</strong> Wrong directory or no matching files.</p>
            <p><strong>Solution:</strong> Verify you're in correct folder. Check file extension filter.</p>
            
            <h3>Issue: Filenames Truncated</h3>
            <p><strong>Cause:</strong> Using <code>dir</code> without <code>/b</code> flag.</p>
            <p><strong>Solution:</strong> Always include <code>/b</code> for bare format: <code>dir /b</code></p>
            
            <h3>Issue: Can't Find Output File</h3>
            <p><strong>Cause:</strong> File saved in different directory than expected.</p>
            <p><strong>Solution:</strong> Specify full output path: <code>dir /b &gt; C:\Users\YourName\Desktop\filelist.txt</code></p>
          </div>
          <div className="mt-12 mb-12">
            <h2 className="text-2xl font-bold mb-6">Frequently Asked Questions</h2>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="faq-1">
                <AccordionTrigger>Can I extract file lists without using command line?</AccordionTrigger>
                <AccordionContent>Yes. Windows Explorer's "Copy as path" feature (Shift+Right-click) or third-party GUI tools like "Karen's Directory Printer" work without command line knowledge.</AccordionContent>
              </AccordionItem>
              <AccordionItem value="faq-2">
                <AccordionTrigger>How do I handle folders with thousands of files?</AccordionTrigger>
                <AccordionContent>Command line methods handle any file count. For 10,000+ files, output to CSV and import to Excel in batches if needed. PowerShell and command prompt have no practical file count limits.</AccordionContent>
              </AccordionItem>
              <AccordionItem value="faq-3">
                <AccordionTrigger>Can I get file lists from network drives or cloud storage?</AccordionTrigger>
                <AccordionContent>Yes. Navigate to network path or synced cloud folder in command prompt/PowerShell, then run the same commands. Ensure you have read permissions for the folder.</AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
          <div className="bg-gradient-to-br from-primary/10 to-secondary/10 rounded-lg p-8 border border-border">
            <h2 className="text-2xl font-bold mb-4">Automate Your PDF Workflows Today</h2>
            <p className="text-muted-foreground mb-6">Now that you can extract file lists in seconds, use Bulk PDF Processor to automate your entire workflow.</p>
            <Link to="/"><Button size="lg" className="font-semibold">Start Processing<ArrowRight className="ml-2 h-5 w-5" /></Button></Link>
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
};

export default Article16;