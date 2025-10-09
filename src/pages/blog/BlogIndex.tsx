import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Footer } from "@/components/Footer";
import { ArrowRight, FileText } from "lucide-react";
import { useEffect } from "react";

const blogPosts = [
  {
    id: 1,
    slug: "automate-repetitive-pdf-tasks",
    title: "How to Automate Repetitive PDF Tasks and Save Hours Every Week",
    description: "Discover proven strategies to automate PDF merging, splitting, and processing tasks that consume hours of your workday.",
    category: "Automation",
  },
  {
    id: 2,
    slug: "ultimate-guide-batch-processing-pdfs",
    title: "The Ultimate Guide to Batch Processing PDFs: Merge, Split, Rename, and More",
    description: "Master bulk PDF operations with this comprehensive guide to processing hundreds of documents simultaneously.",
    category: "Guide",
  },
  {
    id: 3,
    slug: "why-every-office-needs-bulk-pdf-processor",
    title: "Why Every Office Needs a Bulk PDF Processor in 2025",
    description: "Learn how modern offices are transforming document workflows with intelligent PDF automation tools.",
    category: "Productivity",
  },
  {
    id: 4,
    slug: "from-chaos-to-clarity",
    title: "From Chaos to Clarity: Streamlining Your Document Workflow in Minutes",
    description: "Transform disorganized PDF collections into structured, manageable document systems effortlessly.",
    category: "Workflow",
  },
  {
    id: 5,
    slug: "manage-100-pdfs-at-once",
    title: "How to Manage 100 PDFs at Once Without Losing Your Mind",
    description: "Practical techniques for handling massive PDF batches without stress or manual repetition.",
    category: "Productivity",
  },
  {
    id: 6,
    slug: "merge-pdfs-with-excel",
    title: "How to Merge Hundreds of PDFs Using Excel Instructions",
    description: "Use Excel spreadsheets as your command center for sophisticated PDF merging operations.",
    category: "Tutorial",
  },
  {
    id: 7,
    slug: "delete-split-reorder-pages-bulk",
    title: "Delete, Split, and Reorder Pages in Bulk — No Code Needed",
    description: "Perform complex PDF page manipulation across multiple files without writing a single line of code.",
    category: "Tutorial",
  },
  {
    id: 8,
    slug: "rename-pdf-files-automatically",
    title: "How to Rename PDF Files Automatically Based on Excel Columns",
    description: "Systematically rename hundreds of PDFs using data from your Excel spreadsheets.",
    category: "Automation",
  },
  {
    id: 9,
    slug: "bulk-pdf-processor-law-firms-accountants",
    title: "A Step-by-Step Guide to Using Bulk PDF Processor for Law Firms and Accountants",
    description: "Industry-specific workflows for legal and accounting professionals managing document-heavy operations.",
    category: "Industry Guide",
  },
  {
    id: 10,
    slug: "convert-clean-pdfs-fast",
    title: "Convert and Clean Up PDFs Fast: A Beginner's Tutorial",
    description: "Start processing PDFs efficiently with this beginner-friendly introduction to bulk operations.",
    category: "Tutorial",
  },
  {
    id: 11,
    slug: "automation-future-document-management",
    title: "Why Automation Is the Future of Document Management",
    description: "Explore how intelligent automation is reshaping how businesses handle documents in the digital age.",
    category: "Trends",
  },
  {
    id: 12,
    slug: "top-10-pdf-workflow-tools",
    title: "Top 10 Tools to Simplify Your PDF Workflow (And How Bulk PDF Processor Stands Out)",
    description: "Compare leading PDF automation tools and discover what makes Bulk PDF Processor uniquely powerful.",
    category: "Comparison",
  },
  {
    id: 13,
    slug: "behind-the-scenes-smart-logic",
    title: "Behind the Scenes: How Bulk PDF Processor Uses Smart Logic to Handle Massive Tasks",
    description: "Understand the technology and algorithms that power efficient bulk PDF processing.",
    category: "Technical",
  },
  {
    id: 14,
    slug: "excel-meets-pdfs",
    title: "Excel Meets PDFs: How Spreadsheets Became the Ultimate Automation Tool",
    description: "Discover why Excel integration makes PDF automation accessible to everyone.",
    category: "Automation",
  },
  {
    id: 15,
    slug: "boost-productivity-10x",
    title: "Boost Productivity by 10x with Intelligent PDF Automation",
    description: "Real-world examples of teams achieving dramatic productivity gains through PDF automation.",
    category: "Productivity",
  },
  {
    id: 16,
    slug: "get-file-names-folder-30-seconds",
    title: "How to Get a List of All File Names in a Folder in Under 30 Seconds",
    description: "Quick command-line tricks to extract file names for your Excel-based PDF workflows.",
    category: "Tutorial",
  },
];

const BlogIndex = () => {
  useEffect(() => {
    document.title = "Blog - PDF Automation Tips & Guides | Bulk PDF Processor";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute(
        "content",
        "Human-written guides on batch PDF processing, no-code PDF automation, Excel integration, and smart document workflows. Learn practical ways to save hours every week."
      );
    }

    // Add/Update meta keywords for SEO (kept concise, non-stuffy)
    const keywords = [
      "bulk PDF processor",
      "batch PDF processing",
      "PDF automation tool",
      "no-code PDF automation",
      "Excel to PDF integration",
      "merge PDFs in bulk",
      "split PDFs automatically",
      "rename PDFs automatically",
      "secure PDF processing",
      "AI-powered document management"
    ].join(", ");
    let keywordsTag = document.querySelector('meta[name="keywords"]');
    if (!keywordsTag) {
      keywordsTag = document.createElement("meta");
      keywordsTag.setAttribute("name", "keywords");
      document.head.appendChild(keywordsTag);
    }
    keywordsTag.setAttribute("content", keywords);
  }, []);

  const categories = Array.from(new Set(blogPosts.map(post => post.category)));
  const popularTopics = [
    "batch PDF processing",
    "no-code PDF automation",
    "merge PDFs in bulk",
    "split PDFs automatically",
    "rename PDFs automatically",
    "Excel integration",
    "secure PDF processing",
    "AI-powered document management",
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1">
        {/* Header */}
        <div className="bg-gradient-to-br from-primary/10 via-background to-secondary/10 border-b border-border">
          <div className="container mx-auto px-4 py-16 md:py-24">
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-6">
                <FileText className="h-4 w-4" />
                <span className="text-sm font-medium">Knowledge Base</span>
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Human‑Friendly PDF Automation
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
                No fluff—just clear checklists, real examples, and Excel‑driven, no‑code batch PDF processing. 
                Practical playbooks for teams who want to work faster with fewer errors.
              </p>
              <div className="mt-6 flex flex-wrap gap-2 justify-center">
                {popularTopics.map((topic) => (
                  <span key={topic} className="text-xs font-medium bg-muted text-foreground px-3 py-1 rounded-full border border-border">
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Articles Grid */}
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {blogPosts.map((post) => (
                <Card key={post.id} className="group hover:shadow-lg transition-shadow duration-300 border-border bg-card">
                  <CardHeader>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full">
                        {post.category}
                      </span>
                    </div>
                    <CardTitle className="text-xl group-hover:text-primary transition-colors">
                      <Link to={`/blog/${post.slug}`} className="hover:underline">
                        {post.title}
                      </Link>
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                      {post.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Link to={`/blog/${post.slug}`}>
                      <Button variant="ghost" className="group/btn p-0 h-auto font-semibold text-primary">
                        Read Article
                        <ArrowRight className="ml-2 h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* CTA Section */}
          <div className="max-w-4xl mx-auto mt-20 text-center bg-gradient-to-br from-primary/10 to-secondary/10 rounded-lg p-8 md:p-12 border border-border">
            <h2 className="text-3xl font-bold mb-4">Ready to Automate Your PDF Workflow?</h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Put these strategies into action. Process hundreds of PDFs in minutes with our powerful bulk processing tool.
            </p>
            <Link to="/">
              <Button size="lg" className="font-semibold">
                Try Bulk PDF Processor Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default BlogIndex;
