import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Shield, Lock, Database, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
        </div>
      </header>

      <main className="container max-w-4xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>

        <div className="space-y-8">
          {/* Introduction */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Our Commitment to Your Privacy
              </CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none dark:prose-invert">
              <p>
                At PDF Bulk Processor, we take your privacy seriously. This Privacy Policy explains how we collect, 
                use, disclose, and safeguard your information when you use our service. Please read this privacy 
                policy carefully. If you do not agree with the terms of this privacy policy, please do not access the site.
              </p>
            </CardContent>
          </Card>

          {/* Data Collection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Data Collection
              </CardTitle>
              <CardDescription>Information we collect from you</CardDescription>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none dark:prose-invert space-y-4">
              <div>
                <h3 className="font-semibold text-foreground">Account Information</h3>
                <ul>
                  <li>Email address (for account creation and authentication)</li>
                  <li>Password (encrypted and never stored in plain text)</li>
                  <li>Display name (optional)</li>
                  <li>Plan tier (Free, Starter, Professional, Business)</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground">Usage Data</h3>
                <ul>
                  <li>Number of PDFs processed</li>
                  <li>Credits consumed</li>
                  <li>Processing operation types (merge, split, delete, reorder, rename)</li>
                  <li>Login timestamps and session data</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground">Payment Details</h3>
                <ul>
                  <li>Payment processing handled exclusively by Stripe</li>
                  <li>We do not store full credit card numbers</li>
                  <li>We receive payment confirmation and subscription status from Stripe</li>
                  <li>Billing history and invoice information</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground">Uploaded PDFs</h3>
                <ul>
                  <li>Processed in-memory during your session only</li>
                  <li>Not retained permanently after processing</li>
                  <li>Automatically deleted after processing completes</li>
                  <li>Never stored on our servers beyond the processing duration</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Data Usage */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                How We Use Your Data
              </CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none dark:prose-invert">
              <p>We use the information we collect for the following purposes:</p>
              <ul>
                <li><strong>Operate the Service:</strong> Enable credits, subscriptions, and payment processing</li>
                <li><strong>Process Your Files:</strong> Perform PDF operations as requested</li>
                <li><strong>Improve Performance:</strong> Troubleshoot errors and optimize service quality</li>
                <li><strong>Account Management:</strong> Manage your subscription and credit balance</li>
                <li><strong>Communication:</strong> Send service updates and respond to inquiries (marketing only if opted-in)</li>
                <li><strong>Security:</strong> Detect and prevent fraud, abuse, and security incidents</li>
              </ul>
            </CardContent>
          </Card>

          {/* File Handling */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                File Handling & Storage
              </CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none dark:prose-invert">
              <div className="bg-primary/10 p-4 rounded-lg border border-primary/20 mb-4">
                <p className="font-semibold mb-2">Your Files Are Safe:</p>
                <ul className="mb-0">
                  <li>PDFs are processed in-memory or with temporary storage</li>
                  <li>Files are automatically deleted after processing completes</li>
                  <li>No human review of your files unless explicitly authorized for debugging</li>
                  <li>All file transfers use encrypted connections (TLS 1.2+)</li>
                </ul>
              </div>
              <p>
                We understand that your documents may contain sensitive information. We never store your 
                PDF files beyond the time needed to complete your requested processing operation.
              </p>
            </CardContent>
          </Card>

          {/* Third Parties */}
          <Card>
            <CardHeader>
              <CardTitle>Third-Party Services</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none dark:prose-invert">
              <p>We work with the following third-party service providers:</p>
              <ul>
                <li>
                  <strong>Stripe:</strong> Payment processing and subscription management. 
                  View <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Stripe's Privacy Policy</a>
                </li>
                <li>
                  <strong>Supabase:</strong> Backend infrastructure and authentication. 
                  View <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Supabase's Privacy Policy</a>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Compliance */}
          <Card>
            <CardHeader>
              <CardTitle>Data Protection & Compliance</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none dark:prose-invert space-y-4">
              <div>
                <h3 className="font-semibold text-foreground">GDPR Rights (EU Users)</h3>
                <p>If you are located in the European Union, you have the following rights:</p>
                <ul>
                  <li><strong>Right to Access:</strong> Request a copy of your personal data</li>
                  <li><strong>Right to Deletion:</strong> Request deletion of your personal data</li>
                  <li><strong>Right to Rectification:</strong> Correct inaccurate or incomplete data</li>
                  <li><strong>Right to Data Portability:</strong> Receive your data in a structured format</li>
                  <li><strong>Right to Object:</strong> Object to processing of your personal data</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground">CCPA Rights (California Users)</h3>
                <p>If you are a California resident, you have the following rights:</p>
                <ul>
                  <li><strong>Right to Know:</strong> Know what personal information we collect and how it's used</li>
                  <li><strong>Right to Delete:</strong> Request deletion of your personal information</li>
                  <li><strong>Right to Opt-Out:</strong> Opt-out of sale/sharing of personal information (we do not sell your data)</li>
                  <li><strong>Right to Non-Discrimination:</strong> Equal service regardless of privacy rights exercise</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground">Cookies & Tracking</h3>
                <p>
                  We use essential cookies to maintain your session and authentication. We do not use 
                  third-party analytics or tracking cookies without your consent.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground">Exercising Your Rights</h3>
                <p>
                  To exercise any of your data protection rights, please contact us through your account 
                  settings or via email. We will respond to your request within 30 days.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Changes to Privacy Policy */}
          <Card>
            <CardHeader>
              <CardTitle>Changes to This Privacy Policy</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none dark:prose-invert">
              <p>
                We may update this Privacy Policy from time to time. We will notify you of any changes by 
                posting the new Privacy Policy on this page and updating the "Last updated" date at the top 
                of this Privacy Policy. You are advised to review this Privacy Policy periodically for any changes.
              </p>
            </CardContent>
          </Card>

          {/* Contact */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Us</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none dark:prose-invert">
              <p>
                If you have any questions about this Privacy Policy, please contact us through your account 
                settings or visit our support page.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default PrivacyPolicy;
