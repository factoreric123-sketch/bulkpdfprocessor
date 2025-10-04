import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Shield, Lock, Server, CreditCard, Key, FileCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const Security = () => {
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
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-10 h-10 text-primary" />
            <h1 className="text-4xl font-bold">Security</h1>
          </div>
          <p className="text-muted-foreground">
            Your files and data are protected with enterprise-grade security measures
          </p>
        </div>

        <div className="space-y-8">
          {/* Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Our Security Commitment</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none dark:prose-invert">
              <p>
                At Bulk PDF Processor, security is our top priority. We employ industry-standard security 
                measures to protect your files, personal information, and account data. This page outlines 
                our comprehensive security practices and what you can do to keep your account safe.
              </p>
              <div className="flex flex-wrap gap-2 mt-4">
                <Badge variant="secondary">TLS 1.2+ Encryption</Badge>
                <Badge variant="secondary">AES-256 Encryption</Badge>
                <Badge variant="secondary">SOC 2 Compliant</Badge>
                <Badge variant="secondary">ISO 27001</Badge>
                <Badge variant="secondary">PCI-DSS Level 1</Badge>
              </div>
            </CardContent>
          </Card>

          {/* File Security */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="w-5 h-5" />
                File Security & Privacy
              </CardTitle>
              <CardDescription>How we protect your PDFs during processing</CardDescription>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none dark:prose-invert">
              <div className="bg-primary/10 p-4 rounded-lg border border-primary/20 mb-4">
                <p className="font-semibold mb-2">Zero Persistence Policy:</p>
                <ul className="mb-0">
                  <li>Your files are processed in-memory only</li>
                  <li>Temporary storage used only during active processing</li>
                  <li>Files automatically deleted immediately after processing completes</li>
                  <li>No file retention or archiving on our servers</li>
                </ul>
              </div>

              <h3 className="font-semibold text-foreground">Processing Security:</h3>
              <ul>
                <li><strong>Isolated Processing:</strong> Each user's files are processed in isolated environments</li>
                <li><strong>No Human Access:</strong> Staff cannot view your files unless you explicitly grant permission for debugging</li>
                <li><strong>Automatic Deletion:</strong> Files are purged from all systems within seconds of processing completion</li>
                <li><strong>Failed Uploads:</strong> Incomplete or failed uploads are immediately discarded</li>
              </ul>

              <h3 className="font-semibold text-foreground">File Transfer Security:</h3>
              <ul>
                <li>All file uploads use TLS 1.2+ encryption</li>
                <li>End-to-end encryption during transit</li>
                <li>Secure download links with time-limited access</li>
                <li>No third-party file processing or storage</li>
              </ul>
            </CardContent>
          </Card>

          {/* Encryption */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Encryption Standards
              </CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none dark:prose-invert space-y-4">
              <div>
                <h3 className="font-semibold text-foreground">Data in Transit</h3>
                <ul>
                  <li><strong>TLS 1.2+:</strong> All data transmitted between your browser and our servers is encrypted</li>
                  <li><strong>HTTPS Only:</strong> We enforce HTTPS for all connections</li>
                  <li><strong>Certificate Pinning:</strong> Protection against man-in-the-middle attacks</li>
                  <li><strong>Perfect Forward Secrecy:</strong> Session keys cannot be compromised even if private keys are stolen</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground">Data at Rest</h3>
                <ul>
                  <li><strong>AES-256 Encryption:</strong> Industry-standard encryption for any temporary file storage</li>
                  <li><strong>Encrypted Databases:</strong> User data stored in encrypted database volumes</li>
                  <li><strong>Encrypted Backups:</strong> All backup data is encrypted before storage</li>
                  <li><strong>Key Management:</strong> Encryption keys are securely managed and regularly rotated</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Account Security */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                Account Security
              </CardTitle>
              <CardDescription>Protecting your account credentials</CardDescription>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none dark:prose-invert">
              <h3 className="font-semibold text-foreground">Password Protection:</h3>
              <ul>
                <li><strong>Bcrypt Hashing:</strong> Passwords are hashed using bcrypt with strong salt</li>
                <li><strong>Never Stored in Plain Text:</strong> We cannot see or retrieve your password</li>
                <li><strong>Password Requirements:</strong> Minimum 6 characters (we recommend 12+ with mixed characters)</li>
                <li><strong>Secure Password Reset:</strong> Time-limited, single-use reset tokens</li>
              </ul>

              <h3 className="font-semibold text-foreground">Authentication Options:</h3>
              <ul>
                <li><strong>Email/Password:</strong> Traditional authentication with secure password hashing</li>
                <li><strong>Google OAuth:</strong> Secure sign-in using your Google account</li>
                <li><strong>Session Management:</strong> Automatic logout after inactivity</li>
                <li><strong>Device Tracking:</strong> Monitor active sessions from different devices</li>
              </ul>

              <div className="bg-primary/10 p-4 rounded-lg border border-primary/20 mt-4">
                <p className="font-semibold mb-2">Security Best Practices:</p>
                <ul className="mb-0">
                  <li>Use a unique, strong password for your account</li>
                  <li>Never share your password with anyone</li>
                  <li>Log out when using shared or public computers</li>
                  <li>Report suspicious activity immediately</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Infrastructure Security */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="w-5 h-5" />
                Infrastructure Security
              </CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none dark:prose-invert">
              <h3 className="font-semibold text-foreground">Hosting & Cloud Security:</h3>
              <ul>
                <li>
                  <strong>Enterprise Cloud Provider:</strong> Hosted on tier-1 cloud infrastructure with 
                  SOC 2 and ISO 27001 compliance
                </li>
                <li><strong>Geographic Redundancy:</strong> Data replicated across multiple secure data centers</li>
                <li><strong>DDoS Protection:</strong> Advanced protection against distributed denial-of-service attacks</li>
                <li><strong>Firewall Protection:</strong> Multi-layered firewall and network security</li>
                <li><strong>Regular Backups:</strong> Automated encrypted backups with point-in-time recovery</li>
              </ul>

              <h3 className="font-semibold text-foreground">Access Controls:</h3>
              <ul>
                <li><strong>Principle of Least Privilege:</strong> Staff have minimum necessary access rights</li>
                <li><strong>Multi-Factor Authentication:</strong> Required for all administrative access</li>
                <li><strong>Audit Logging:</strong> All system access is logged and monitored</li>
                <li><strong>Regular Security Audits:</strong> Periodic third-party security assessments</li>
              </ul>

              <h3 className="font-semibold text-foreground">Monitoring & Detection:</h3>
              <ul>
                <li><strong>24/7 Monitoring:</strong> Continuous system and security monitoring</li>
                <li><strong>Intrusion Detection:</strong> Automated detection of suspicious activity</li>
                <li><strong>Anomaly Detection:</strong> Machine learning-based threat detection</li>
                <li><strong>Incident Response:</strong> Documented procedures for security incidents</li>
              </ul>
            </CardContent>
          </Card>

          {/* Payment Security */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Payment Security
              </CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none dark:prose-invert">
              <div className="bg-primary/10 p-4 rounded-lg border border-primary/20 mb-4">
                <p className="font-semibold mb-2">Powered by Stripe:</p>
                <p className="mb-0">
                  All payment processing is handled by Stripe, a PCI-DSS Level 1 certified payment processor. 
                  We never see or store your full credit card numbers.
                </p>
              </div>

              <h3 className="font-semibold text-foreground">Payment Processing:</h3>
              <ul>
                <li><strong>PCI-DSS Compliant:</strong> Highest level of payment card industry security standards</li>
                <li><strong>Tokenization:</strong> Card numbers are tokenized and encrypted by Stripe</li>
                <li><strong>No Card Storage:</strong> We only store payment method tokens, never actual card numbers</li>
                <li><strong>3D Secure:</strong> Additional authentication for supported cards</li>
                <li><strong>Fraud Detection:</strong> Advanced machine learning-based fraud prevention</li>
              </ul>

              <h3 className="font-semibold text-foreground">What We Store:</h3>
              <ul>
                <li>Stripe customer ID (a reference token)</li>
                <li>Last 4 digits of card (for your reference)</li>
                <li>Card brand (Visa, Mastercard, etc.)</li>
                <li>Billing history and invoice details</li>
              </ul>
            </CardContent>
          </Card>

          {/* User Responsibilities */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Your Security Responsibilities
              </CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none dark:prose-invert">
              <p>Security is a shared responsibility. Here's how you can help protect your account:</p>
              
              <h3 className="font-semibold text-foreground">Password Security:</h3>
              <ul>
                <li>Use a strong, unique password (at least 12 characters recommended)</li>
                <li>Include a mix of uppercase, lowercase, numbers, and special characters</li>
                <li>Never reuse passwords from other websites</li>
                <li>Consider using a password manager</li>
                <li>Change your password if you suspect it may be compromised</li>
              </ul>

              <h3 className="font-semibold text-foreground">Account Safety:</h3>
              <ul>
                <li>Keep your login credentials confidential</li>
                <li>Log out when using shared or public computers</li>
                <li>Be cautious of phishing emails claiming to be from us</li>
                <li>Verify the URL is correct before entering your password</li>
                <li>Report any suspicious account activity immediately</li>
              </ul>

              <h3 className="font-semibold text-foreground">Device Security:</h3>
              <ul>
                <li>Keep your operating system and browser up to date</li>
                <li>Use antivirus and anti-malware software</li>
                <li>Avoid accessing your account on unsecured public WiFi</li>
                <li>Use a VPN when connecting from public networks</li>
              </ul>
            </CardContent>
          </Card>

          {/* Reporting Security Issues */}
          <Card>
            <CardHeader>
              <CardTitle>Reporting Security Issues</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none dark:prose-invert">
              <p>
                We take security vulnerabilities seriously. If you discover a security issue or vulnerability, 
                please report it to us immediately.
              </p>
              
              <h3 className="font-semibold text-foreground">How to Report:</h3>
              <ul>
                <li>Contact us through your account settings marked "Security Issue"</li>
                <li>Provide detailed information about the vulnerability</li>
                <li>Do not publicly disclose the issue until we've addressed it</li>
                <li>We will acknowledge your report within 48 hours</li>
              </ul>

              <h3 className="font-semibold text-foreground">What Happens Next:</h3>
              <ul>
                <li>We investigate all security reports promptly</li>
                <li>Critical issues are addressed within 24-48 hours</li>
                <li>We will keep you informed of our progress</li>
                <li>We may recognize responsible disclosure in our security acknowledgments</li>
              </ul>
            </CardContent>
          </Card>

          {/* Compliance & Certifications */}
          <Card>
            <CardHeader>
              <CardTitle>Compliance & Certifications</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none dark:prose-invert">
              <p>We maintain compliance with industry security standards and regulations:</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold text-foreground">Industry Standards:</h3>
                  <ul>
                    <li>SOC 2 Type II compliance</li>
                    <li>ISO 27001 certified infrastructure</li>
                    <li>PCI-DSS Level 1 (via Stripe)</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-foreground">Data Protection:</h3>
                  <ul>
                    <li>GDPR compliant (EU users)</li>
                    <li>CCPA compliant (California users)</li>
                    <li>Regular security audits</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Updates */}
          <Card>
            <CardHeader>
              <CardTitle>Security Updates</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none dark:prose-invert">
              <p>
                This security page is regularly updated to reflect our current security practices. 
                We continuously improve our security measures to protect your data.
              </p>
              <p>
                Last reviewed: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Security;
