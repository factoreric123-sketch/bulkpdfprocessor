import { Link } from 'react-router-dom';
import { FileText, Shield, FileCheck } from 'lucide-react';

export const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-card border-t mt-auto">
      <div className="container max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-6 h-6 text-primary" />
              <span className="font-bold text-lg">Bulk PDF Processor</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Powerful PDF processing made simple. Merge, split, delete, reorder, and rename PDFs in bulk using Excel instructions.
            </p>
          </div>

          {/* Legal Links */}
          <div>
            <h3 className="font-semibold mb-3">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link 
                  to="/privacy-policy" 
                  className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2"
                >
                  <Shield className="w-4 h-4" />
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link 
                  to="/terms-of-service" 
                  className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2"
                >
                  <FileCheck className="w-4 h-4" />
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link 
                  to="/security" 
                  className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2"
                >
                  <Shield className="w-4 h-4" />
                  Security
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="font-semibold mb-3">Resources</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link 
                  to="/subscriptions" 
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  Pricing & Plans
                </Link>
              </li>
              <li>
                <Link 
                  to="/contact" 
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  Contact Us
                </Link>
              </li>
              <li>
                <Link 
                  to="/auth" 
                  state={{ isSignUp: true }}
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  Get Started
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t mt-8 pt-6 text-center text-sm text-muted-foreground">
          <p>© {currentYear} Bulk PDF Processor. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};
