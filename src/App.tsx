import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import ScrollToTop from "./components/ScrollToTop";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Subscriptions from "./pages/Subscriptions";
import SubscriptionSuccess from "./pages/SubscriptionSuccess";
import Profile from "./pages/Profile";
import Contact from "./pages/Contact";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import Security from "./pages/Security";
import NotFound from "./pages/NotFound";
import BlogIndex from "./pages/blog/BlogIndex";
import Article1 from "./pages/blog/Article1";
import Article2 from "./pages/blog/Article2";
import Article3 from "./pages/blog/Article3";
import Article4 from "./pages/blog/Article4";
import Article5 from "./pages/blog/Article5";
import Article6 from "./pages/blog/Article6";
import Article7 from "./pages/blog/Article7";
import Article8 from "./pages/blog/Article8";
import Article9 from "./pages/blog/Article9";
import Article10 from "./pages/blog/Article10";
import Article11 from "./pages/blog/Article11";
import Article12 from "./pages/blog/Article12";
import Article13 from "./pages/blog/Article13";
import Article14 from "./pages/blog/Article14";
import Article15 from "./pages/blog/Article15";
import Article16 from "./pages/blog/Article16";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/subscriptions" element={<Subscriptions />} />
            <Route path="/subscription-success" element={<SubscriptionSuccess />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms-of-service" element={<TermsOfService />} />
            <Route path="/security" element={<Security />} />
            <Route path="/blog" element={<BlogIndex />} />
            <Route path="/blog/automate-repetitive-pdf-tasks" element={<Article1 />} />
            <Route path="/blog/ultimate-guide-batch-processing-pdfs" element={<Article2 />} />
            <Route path="/blog/why-every-office-needs-bulk-pdf-processor" element={<Article3 />} />
            <Route path="/blog/from-chaos-to-clarity" element={<Article4 />} />
            <Route path="/blog/manage-100-pdfs-at-once" element={<Article5 />} />
            <Route path="/blog/merge-pdfs-with-excel" element={<Article6 />} />
            <Route path="/blog/delete-split-reorder-pages-bulk" element={<Article7 />} />
            <Route path="/blog/rename-pdf-files-automatically" element={<Article8 />} />
            <Route path="/blog/bulk-pdf-processor-law-firms-accountants" element={<Article9 />} />
            <Route path="/blog/convert-clean-pdfs-fast" element={<Article10 />} />
            <Route path="/blog/automation-future-document-management" element={<Article11 />} />
            <Route path="/blog/top-10-pdf-workflow-tools" element={<Article12 />} />
            <Route path="/blog/behind-the-scenes-smart-logic" element={<Article13 />} />
            <Route path="/blog/excel-meets-pdfs" element={<Article14 />} />
            <Route path="/blog/boost-productivity-10x" element={<Article15 />} />
            <Route path="/blog/get-file-names-folder-30-seconds" element={<Article16 />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
