import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, CreditCard, AlertTriangle, Ban } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const TermsOfService = () => {
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
          <h1 className="text-4xl font-bold mb-2">Terms of Service</h1>
          <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>

        <div className="space-y-8">
          {/* Acceptance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Acceptance of Terms
              </CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none dark:prose-invert">
              <p>
                By accessing or using Bulk PDF Processor ("the Service"), you agree to be bound by these 
                Terms of Service ("Terms"). If you disagree with any part of the terms, you may not access the Service.
              </p>
              <ul>
                <li>You must be at least 18 years of age or the age of majority in your jurisdiction</li>
                <li>You must provide accurate and complete registration information</li>
                <li>You are responsible for maintaining the security of your account</li>
                <li>You agree to accept responsibility for all activities that occur under your account</li>
              </ul>
            </CardContent>
          </Card>

          {/* Permitted Use */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Permitted Use
              </CardTitle>
              <CardDescription>Rules and restrictions for using our service</CardDescription>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none dark:prose-invert space-y-4">
              <div>
                <h3 className="font-semibold text-foreground">You May:</h3>
                <ul>
                  <li>Use the Service for lawful purposes only</li>
                  <li>Process PDFs that you own or have authorization to modify</li>
                  <li>Use the Service for personal or commercial purposes as permitted by your plan</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground">You May Not:</h3>
                <ul>
                  <li>Upload malicious files, viruses, or harmful code</li>
                  <li>Process copyrighted material without proper authorization</li>
                  <li>Attempt to reverse engineer, decompile, or hack the Service</li>
                  <li>Use the Service to violate any laws or regulations</li>
                  <li>Abuse the Service by excessive automated requests or processing</li>
                  <li>Share your account credentials with others</li>
                  <li>Resell or redistribute the Service without authorization</li>
                </ul>
              </div>

              <div className="bg-destructive/10 p-4 rounded-lg border border-destructive/20">
                <p className="font-semibold mb-2">Violation of these terms may result in:</p>
                <ul className="mb-0">
                  <li>Immediate suspension or termination of your account</li>
                  <li>Loss of unused credits without refund</li>
                  <li>Legal action if applicable</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Account & Credits */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Account & Credits System
              </CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none dark:prose-invert space-y-4">
              <div>
                <h3 className="font-semibold text-foreground">Free Trial</h3>
                <ul>
                  <li>New users receive 3 free credits upon account creation</li>
                  <li>Free credits may be modified or discontinued at any time</li>
                  <li>Credits are non-transferable and have no cash value</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground">Credit Usage</h3>
                <ul>
                  <li>Each PDF operation (merge, split, delete, reorder, rename) consumes 1 credit per output file</li>
                  <li>Credits are deducted immediately upon successful processing</li>
                  <li>Failed operations do not consume credits</li>
                  <li>Credits expire based on your subscription plan terms</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground">Subscription Plans</h3>
                <ul>
                  <li><strong>Starter:</strong> 50 credits per month</li>
                  <li><strong>Professional:</strong> 200 credits per month</li>
                  <li><strong>Business:</strong> Unlimited credits</li>
                  <li>Monthly credits reset on your billing cycle date</li>
                  <li>Unused credits do not roll over to the next month (except Business plan)</li>
                  <li>Subscription prices may change with 30 days notice</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Refund Policy */}
          <Card>
            <CardHeader>
              <CardTitle>Refund Policy</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none dark:prose-invert">
              <p>
                We want you to be satisfied with our service. Our refund policy is as follows:
              </p>
              <ul>
                <li>
                  <strong>Subscription Refunds:</strong> You may cancel your subscription at any time. 
                  Cancellations take effect at the end of your current billing period. No partial refunds 
                  are provided for the current billing period.
                </li>
                <li>
                  <strong>Technical Issues:</strong> If you experience technical issues that prevent you 
                  from using the Service, contact our support team within 7 days. We may issue credits or 
                  refunds on a case-by-case basis.
                </li>
                <li>
                  <strong>Unused Credits:</strong> Credits have no cash value and are non-refundable.
                </li>
                <li>
                  <strong>Disputed Charges:</strong> Contact us within 30 days of the charge to dispute it.
                </li>
              </ul>
              <p>
                Refund requests can be made through your account settings or by contacting support.
              </p>
            </CardContent>
          </Card>

          {/* Service Availability */}
          <Card>
            <CardHeader>
              <CardTitle>Service Availability & Limitations</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none dark:prose-invert">
              <p>We strive to provide reliable service, but please be aware:</p>
              <ul>
                <li>The Service is provided "as is" without warranties of any kind</li>
                <li>We do not guarantee uninterrupted or error-free service</li>
                <li>Scheduled maintenance may cause temporary service interruptions</li>
                <li>We reserve the right to modify or discontinue features with notice</li>
                <li>File size and processing limits apply based on your plan</li>
                <li>Maximum file size: 50MB per PDF</li>
                <li>Maximum files per operation: 100 files</li>
              </ul>
            </CardContent>
          </Card>

          {/* Limitation of Liability */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ban className="w-5 h-5" />
                Limitation of Liability
              </CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none dark:prose-invert">
              <div className="bg-primary/10 p-4 rounded-lg border border-primary/20 mb-4">
                <p className="font-semibold mb-2">IMPORTANT - READ CAREFULLY:</p>
                <p className="mb-0">
                  TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR ANY INDIRECT, 
                  INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR 
                  REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, 
                  OR OTHER INTANGIBLE LOSSES.
                </p>
              </div>
              
              <ul>
                <li>We are not responsible for lost, corrupted, or damaged files</li>
                <li>Always maintain backup copies of important documents</li>
                <li>Our maximum liability is limited to the amount you paid in the last 30 days</li>
                <li>We are not liable for third-party service failures (Stripe, hosting providers)</li>
                <li>You assume all risk when uploading files to the Service</li>
              </ul>

              <p className="font-semibold">
                You agree to indemnify and hold us harmless from any claims, damages, or expenses 
                arising from your use of the Service or violation of these Terms.
              </p>
            </CardContent>
          </Card>

          {/* Termination */}
          <Card>
            <CardHeader>
              <CardTitle>Account Termination</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none dark:prose-invert">
              <div>
                <h3 className="font-semibold text-foreground">By You:</h3>
                <ul>
                  <li>You may close your account at any time through account settings</li>
                  <li>You may cancel your subscription at any time (effective at period end)</li>
                  <li>Account closure does not entitle you to a refund of unused credits or subscription fees</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground">By Us:</h3>
                <ul>
                  <li>We may suspend or terminate your account for Terms violations</li>
                  <li>We may terminate accounts that have been inactive for over 12 months</li>
                  <li>We may terminate the Service entirely with 30 days notice</li>
                  <li>Terminated accounts may lose access to all data and credits</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground">Effect of Termination:</h3>
                <ul>
                  <li>All provisions that should survive termination shall survive (liability, indemnification, disputes)</li>
                  <li>You remain liable for any outstanding payments</li>
                  <li>We will delete your personal data according to our Privacy Policy</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Intellectual Property */}
          <Card>
            <CardHeader>
              <CardTitle>Intellectual Property</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none dark:prose-invert">
              <div>
                <h3 className="font-semibold text-foreground">Our Rights:</h3>
                <ul>
                  <li>The Service, including all content, features, and functionality, is owned by us</li>
                  <li>Our trademarks, logos, and service marks are our property</li>
                  <li>You may not use our intellectual property without written permission</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground">Your Rights:</h3>
                <ul>
                  <li>You retain all rights to the PDFs you upload and process</li>
                  <li>You grant us a limited license to process your files for providing the Service</li>
                  <li>This license terminates when your files are deleted from our systems</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Changes to Terms */}
          <Card>
            <CardHeader>
              <CardTitle>Changes to These Terms</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none dark:prose-invert">
              <p>
                We reserve the right to modify these Terms at any time. We will notify you of material 
                changes by email or through the Service. Your continued use of the Service after changes 
                become effective constitutes acceptance of the revised Terms.
              </p>
              <p>
                If you do not agree to the modified Terms, you must stop using the Service and may 
                close your account.
              </p>
            </CardContent>
          </Card>

          {/* Governing Law */}
          <Card>
            <CardHeader>
              <CardTitle>Governing Law & Disputes</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none dark:prose-invert">
              <p>
                These Terms shall be governed by and construed in accordance with the laws of the 
                jurisdiction in which we operate, without regard to its conflict of law provisions.
              </p>
              <p>
                Any disputes arising from these Terms or the Service shall be resolved through binding 
                arbitration, except where prohibited by law. You agree to waive any right to a jury trial 
                or participation in a class action lawsuit.
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
                If you have any questions about these Terms of Service, please contact us through your 
                account settings or visit our support page.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default TermsOfService;
