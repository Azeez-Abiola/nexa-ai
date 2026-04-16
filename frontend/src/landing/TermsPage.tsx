import { Link } from "react-router-dom";
import Navbar from "@/landing/Navbar";
import { Button } from "@/components/ui/button";

const TermsPage = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <main className="container mx-auto max-w-3xl px-6 pt-32 pb-24">
      <Button variant="ghost" asChild className="mb-8 font-bold -ml-2">
        <Link to="/">← Back to home</Link>
      </Button>
      <h1 className="text-3xl font-extrabold text-[#1A1A1A] font-sans mb-6">Terms of service</h1>
      <p className="text-muted-foreground text-sm mb-8">Last updated: {new Date().toLocaleDateString()}</p>
      <section className="space-y-4 text-[15px] leading-relaxed text-[#374151]">
        <p>
          Nexa.ai provides an enterprise AI assistant that answers questions using your organization&apos;s approved
          documents and policies. By accessing or using Nexa, you agree to use the product in line with your
          employer&apos;s acceptable-use and data policies.
        </p>
        <p>
          You are responsible for the accuracy of information you submit and for not attempting to bypass access
          controls, extract data you are not entitled to, or misuse the service in ways that could harm your
          organization or others.
        </p>
        <p>
          AI-generated responses are assistive and may be incomplete or incorrect. Critical decisions should always be
          confirmed against official records, finance systems, and human experts inside your organization.
        </p>
        <p>
          We may update these terms from time to time. Continued use of Nexa after changes constitutes acceptance of the
          revised terms where permitted by law.
        </p>
        <p>
          For questions about these terms, use the{" "}
          <Link to="/contact" className="text-primary font-bold hover:underline">
            contact form
          </Link>
          .
        </p>
      </section>
    </main>
  </div>
);

export default TermsPage;
