import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/Footer";
import { ArrowLeft, ArrowRight } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const Article8 = () => {
  useEffect(() => {
    document.title = "How to Rename PDF Files Automatically Based on Excel Columns | Bulk PDF Processor";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute(
        "content",
        "Systematically rename hundreds of PDFs using data from Excel spreadsheets. Complete guide to automated bulk PDF renaming."
      );
    }
    // SEO: keywords and canonical
    const keywords = [
      "mass PDF renaming",
      "rename PDFs automatically",
      "bulk rename via Excel",
      "Excel-driven bulk actions",
      "Excel-based PDF commands",
      "spreadsheet automation",
      "Excel-controlled PDF system",
      "PDF file organizer",
      "organize PDFs in bulk",
      "how to batch rename PDFs",
      "data-driven file processing",
      "online bulk PDF processor"
    ].join(", ");

    let metaKeywords = document.querySelector('meta[name="keywords"]');
    if (!metaKeywords) {
      metaKeywords = document.createElement('meta');
      metaKeywords.setAttribute('name', 'keywords');
      document.head.appendChild(metaKeywords);
    }
    metaKeywords.setAttribute('content', keywords);

    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', window.location.origin + '/blog/rename-pdf-files-automatically');
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
            <div className="inline-block bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-semibold mb-4">
              Automation
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              How to Rename PDF Files Automatically Based on Excel Columns
            </h1>
            <p className="text-xl text-muted-foreground">
              Transform chaotic file names into organized, searchable systems using Excel-driven bulk renaming. No programming required.
            </p>
          </header>

          {/* TL;DR */}
          <div className="mb-10 p-5 rounded-lg border border-border bg-card">
            <h2 className="text-lg font-semibold mb-2 text-foreground">TL;DR</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Turn naming chaos into order with Excel-driven, bulk renaming.</li>
              <li>Use simple formulas to generate clean, consistent, searchable filenames.</li>
              <li>Rename hundreds of PDFs in seconds—no code, no typos, no drudgery.</li>
              <li>Great for invoices, case files, HR records, and large archives.</li>
            </ul>
          </div>

          <div className="prose prose-lg max-w-none">
            <h2>The File Naming Crisis</h2>
            <p>
              Open any long-standing project folder and you'll find naming chaos: "Document1.pdf," "Final_Version_ACTUAL.pdf," "ClientFile_v3_revised_FINAL2.pdf." Files named by scan dates, random alphanumeric codes, or whoever happened to save them first. Finding specific documents becomes archaeological excavation.
            </p>
            <p>
              Manual renaming is mind-numbing. Opening each file to determine content, thinking of a new name, carefully typing it out—repeated hundreds of times. One typo, and sorting breaks. One forgotten convention, and consistency evaporates.
            </p>
            <p>
              The solution: Excel-driven bulk renaming. Define your naming system once in a spreadsheet using data and formulas, then execute all renames in seconds.
            </p>

            <h2>The Basic Renaming Workflow</h2>

            <h3>Step 1: Extract Current Names</h3>
            <p>
              Get a list of all current PDF filenames using command-line tools:
            </p>
            <ul>
              <li><strong>Windows CMD:</strong> <code>dir /b *.pdf &gt; filelist.txt</code></li>
              <li><strong>Mac/Linux Terminal:</strong> <code>ls *.pdf &gt; filelist.txt</code></li>
              <li><strong>PowerShell:</strong> <code>Get-ChildItem -Name *.pdf &gt; filelist.txt</code></li>
            </ul>
            <p>
              Import this text file into Excel. You now have all current names in column A.
            </p>

            <h3>Step 2: Define New Naming Convention</h3>
            <p>
              Create a standard naming pattern that includes key identifiers:
            </p>
            <ul>
              <li><strong>Date-based:</strong> YYYY-MM-DD_Description.pdf</li>
              <li><strong>Client-based:</strong> ClientName_ProjectID_Type_Date.pdf</li>
              <li><strong>Sequential:</strong> Category_NNN_Description.pdf</li>
              <li><strong>Metadata-based:</strong> LastName_FirstName_ID_DocType.pdf</li>
            </ul>
            <p>
              Whatever convention you choose, make it descriptive, sortable, and searchable.
            </p>

            <h3>Step 3: Build New Names with Formulas</h3>
            <p>
              Use Excel formulas to construct new filenames from existing data:
            </p>
            <p>
              <strong>Example:</strong> You have client data in columns B (ClientName), C (Date), D (DocType):
            </p>
            <p>
              <code>=CONCATENATE(TEXT(C2,"YYYY-MM-DD"), "_", B2, "_", D2, ".pdf")</code>
            </p>
            <p>
              This generates: "2025-03-15_AcmeCorp_Contract.pdf"
            </p>

            <h3>Step 4: Create Rename Instruction File</h3>
            <p>
              Your bulk renaming file needs two columns:
            </p>
            <ul>
              <li><strong>Current Name:</strong> (Column A) The existing filename</li>
              <li><strong>New Name:</strong> (Column E) The generated new filename</li>
            </ul>
            <p>
              Remove any intermediate working columns. Save as CSV or clean Excel file for upload.
            </p>

            <h3>Step 5: Execute Bulk Rename</h3>
            <p>
              Upload your PDFs and instruction file to a bulk processor. Review the preview mapping (Old → New names). Execute. Hundreds of files rename consistently in seconds.
            </p>

            <h2>Advanced Renaming Techniques</h2>

            <h3>Extracting Data from Current Filenames</h3>
            <p>
              If existing names contain useful data, extract it with Excel functions:
            </p>
            <ul>
              <li><strong>LEFT/RIGHT/MID:</strong> Extract specific characters</li>
              <li><strong>FIND:</strong> Locate delimiter positions</li>
              <li><strong>Text-to-Columns:</strong> Split by delimiters</li>
            </ul>
            <p>
              <strong>Example:</strong> Current name "2025-03-15-ClientABC-Invoice.pdf"
            </p>
            <p>
              Extract date: <code>=LEFT(A2,10)</code> → "2025-03-15"<br/>
              Extract client: <code>=MID(A2,12,9)</code> → "ClientABC"
            </p>

            <h3>VLOOKUP for Metadata Enrichment</h3>
            <p>
              If you have external data (client list, product catalog), use VLOOKUP to add information:
            </p>
            <p>
              <strong>Scenario:</strong> Files named "INV001.pdf" through "INV500.pdf" need client names added.
            </p>
            <p>
              Create a lookup table:
            </p>
            <table>
              <thead>
                <tr>
                  <th>Invoice ID</th>
                  <th>Client Name</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>INV001</td>
                  <td>Acme Corp</td>
                </tr>
                <tr>
                  <td>INV002</td>
                  <td>Widget Inc</td>
                </tr>
              </tbody>
            </table>
            <p>
              Use VLOOKUP to fetch client names, then build new filenames incorporating them.
            </p>

            <h3>Conditional Naming with IF Statements</h3>
            <p>
              Apply different naming rules based on file characteristics:
            </p>
            <p>
              <code>=IF(C2="Contract", CONCATENATE(B2,"_CONTRACT_",TEXT(D2,"YYYY-MM")),<br/>
              CONCATENATE(B2,"_INVOICE_",TEXT(D2,"YYYY-MM")))</code>
            </p>
            <p>
              This creates different patterns for contracts versus invoices.
            </p>

            <h3>Sequential Numbering</h3>
            <p>
              Add sequential numbers to ensure uniqueness:
            </p>
            <p>
              <code>=CONCATENATE(B2, "_", TEXT(ROW()-1,"000"), "_", C2, ".pdf")</code>
            </p>
            <p>
              Generates: "ClientName_001_DocType.pdf", "ClientName_002_DocType.pdf", etc.
            </p>

            <h3>Cleaning and Normalizing Text</h3>
            <p>
              Remove problematic characters from generated names:
            </p>
            <ul>
              <li><strong>TRIM:</strong> Remove extra spaces</li>
              <li><strong>SUBSTITUTE:</strong> Replace illegal filename characters (/, \, :, *, ?, ", &lt;, &gt;, |)</li>
              <li><strong>UPPER/LOWER/PROPER:</strong> Normalize capitalization</li>
            </ul>
            <p>
              <code>=SUBSTITUTE(SUBSTITUTE(TRIM(B2),"/","-"),":","-")</code>
            </p>
            <p>
              This ensures filenames are filesystem-safe.
            </p>

            <h2>Real-World Renaming Projects</h2>

            <h3>Law Firm Case Files</h3>
            <p>
              <strong>Challenge:</strong> 800 case documents with scan date names like "20250315_091523.pdf." Need to rename as "CaseNumber_PartyName_DocType_Date.pdf."
            </p>
            <p>
              <strong>Solution:</strong>
            </p>
            <ol>
              <li>Import case metadata from case management system</li>
              <li>Use VLOOKUP to match scan dates with case details</li>
              <li>Build new names combining case number, party, document type, and formatted date</li>
              <li>Execute bulk rename—800 files properly identified in minutes</li>
            </ol>

            <h3>Accounting Firm Client Invoices</h3>
            <p>
              <strong>Challenge:</strong> 1,200 invoices named "Invoice_[random_number].pdf." Need format: "ClientName_YYYY-MM_InvoiceNumber.pdf."
            </p>
            <p>
              <strong>Solution:</strong>
            </p>
            <ol>
              <li>Extract invoice numbers from current filenames</li>
              <li>VLOOKUP invoice numbers against billing database to get client names and dates</li>
              <li>Generate standardized names using CONCATENATE with date formatting</li>
              <li>Bulk rename transforms chaos into sorted, searchable organization</li>
            </ol>

            <h3>Real Estate Transaction Documents</h3>
            <p>
              <strong>Challenge:</strong> 500 property documents with address fragments in names. Need full addresses and document types.
            </p>
            <p>
              <strong>Solution:</strong>
            </p>
            <ol>
              <li>Create property master list with partial address → full address mapping</li>
              <li>Extract address fragments from current names using MID/FIND functions</li>
              <li>VLOOKUP to get full addresses and property details</li>
              <li>Generate: "123_Main_St_City_ST_PropertyID_DocType.pdf"</li>
              <li>Bulk rename creates perfect filing structure</li>
            </ol>

            <h2>Handling Edge Cases</h2>

            <h3>Duplicate Generated Names</h3>
            <p>
              <strong>Problem:</strong> Multiple files generate identical new names (e.g., same client, same date, same type).
            </p>
            <p>
              <strong>Solution:</strong> Add sequential suffixes:
            </p>
            <p>
              <code>=CONCATENATE(NewName, "_", COUNTIF($E$2:E2,E2), ".pdf")</code>
            </p>
            <p>
              This appends _1, _2, _3 to duplicates automatically.
            </p>

            <h3>Missing Metadata</h3>
            <p>
              <strong>Problem:</strong> Some files lack metadata for complete naming.
            </p>
            <p>
              <strong>Solution:</strong> Use IF with ISBLANK to provide defaults:
            </p>
            <p>
              <code>=IF(ISBLANK(B2),"Unknown_Client",B2)</code>
            </p>
            <p>
              Flag these for manual review after bulk renaming.
            </p>

            <h3>Filename Length Limits</h3>
            <p>
              <strong>Problem:</strong> Generated names exceed filesystem limits (255 characters).
            </p>
            <p>
              <strong>Solution:</strong> Use LEFT to truncate, adding ellipsis or abbreviations:
            </p>
            <p>
              <code>=LEFT(GeneratedName, 100) &amp; "_" &amp; UniqueID &amp; ".pdf"</code>
            </p>

            <h2>Best Practices for Bulk Renaming</h2>

            <h3>Always Keep Backups</h3>
            <p>
              Before renaming, backup original files. If something goes wrong, you can restore and retry without data loss.
            </p>

            <h3>Test on Small Batches</h3>
            <p>
              Rename 10-20 files first. Verify the results match expectations. Adjust formulas if needed, then scale to full batch.
            </p>

            <h3>Document Your Convention</h3>
            <p>
              Write down your naming convention and save it with the Excel file. Future you (and teammates) will need to understand the logic.
            </p>

            <h3>Use Consistent Delimiters</h3>
            <p>
              Choose one delimiter (underscore, hyphen, period) and stick with it. Consistency enables programmatic parsing later if needed.
            </p>

            <h3>Build Sortable Names</h3>
            <p>
              Put most important sort key first (usually date in YYYY-MM-DD format). This ensures alphabetical file listings remain logical.
            </p>

            <h2>Your Renaming Transformation Starts Now</h2>
            <p>
              Stop manually renaming files one by one. Master Excel-driven bulk renaming in three steps:
            </p>
            <ol>
              <li>Extract current filenames to Excel</li>
              <li>Build new names with formulas and data</li>
              <li>Execute bulk rename in seconds</li>
            </ol>
            <p>
              What once took days now takes hours in planning and seconds in execution. Your files become organized, searchable, professional assets rather than chaotic liabilities.
            </p>
          </div>

          <div className="mt-12 mb-12">
            <h2 className="text-2xl font-bold mb-6">Frequently Asked Questions</h2>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="faq-1">
                <AccordionTrigger>Can I undo a bulk rename if I make a mistake?</AccordionTrigger>
                <AccordionContent>
                  If you kept backups of originals, simply delete the renamed versions and restore. Some bulk tools offer undo functions. Best practice: always keep original names in your Excel file so you can reverse the operation if needed.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="faq-2">
                <AccordionTrigger>What if two files would get the same new name?</AccordionTrigger>
                <AccordionContent>
                  Good bulk processors detect duplicate target names before executing and alert you. Add distinguishing suffixes (sequential numbers, timestamps, or other unique identifiers) to make all names unique.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="faq-3">
                <AccordionTrigger>Can I rename files in subfolders all at once?</AccordionTrigger>
                <AccordionContent>
                  Yes, when generating your file list, use recursive directory listings (Windows: <code>dir /b /s</code>, Linux/Mac: <code>find . -name "*.pdf"</code>). Include full paths in your Excel file, and the bulk processor will rename files in their current locations.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="faq-4">
                <AccordionTrigger>Do I need to know complex Excel formulas?</AccordionTrigger>
                <AccordionContent>
                  Basic formulas (CONCATENATE, TEXT, LEFT, RIGHT, MID) handle most renaming scenarios. VLOOKUP helps with metadata enrichment. These are standard Excel functions with abundant tutorials available. Start simple and add complexity as needed.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          <div className="bg-gradient-to-br from-primary/10 to-secondary/10 rounded-lg p-8 border border-border">
            <h2 className="text-2xl font-bold mb-4">Transform Your File Naming Chaos Into Order</h2>
            <p className="text-muted-foreground mb-6">
              Stop wasting time on manual renames. Use Bulk PDF Processor with Excel-driven automation to rename hundreds of files in seconds.
            </p>
            <Link to="/">
              <Button size="lg" className="font-semibold">
                Start Renaming PDFs Automatically
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
};

export default Article8;
