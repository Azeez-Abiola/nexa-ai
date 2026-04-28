import { useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import axios from "axios";
import Navbar from "@/landing/Navbar";
import Footer from "@/landing/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

const ContactPage = () => {
  const [searchParams] = useSearchParams();
  const intent = searchParams.get("intent") === "demo" ? "demo" : "contact";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const title = useMemo(
    () => (intent === "demo" ? "Request a demo" : "Contact us"),
    [intent]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await axios.post("/api/v1/public/contact", {
        name,
        email,
        company,
        message,
        intent
      });
      setDone(true);
      setName("");
      setEmail("");
      setCompany("");
      setMessage("");
    } catch (err: any) {
      setError(err.response?.data?.error || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-xl px-4 sm:px-6 pt-24 sm:pt-28 md:pt-32 pb-16 sm:pb-24">
        <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Nexa.ai</p>
        <h1 className="text-3xl md:text-4xl font-extrabold text-[#1A1A1A] font-sans mb-3">{title}</h1>
        <p className="text-muted-foreground mb-10 leading-relaxed">
          {intent === "demo"
            ? "Tell us about your organization and what you want to achieve with Nexa. We will follow up by email."
            : "Send us a message — questions, partnerships, or support. We will get back to you as soon as we can."}
        </p>

        {done ? (
          <div className="rounded-2xl border border-border/60 bg-[#F8F9FF] p-8 text-center">
            <p className="font-bold text-[#1A1A1A] mb-2">Thank you</p>
            <p className="text-muted-foreground text-sm mb-6">Your message has been received.</p>
            <Button asChild variant="outline" className="rounded-full font-bold">
              <Link to="/">Back to home</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive font-medium">
                {error}
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="contact-name" className="font-bold">
                Full name
              </Label>
              <Input
                id="contact-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-12 rounded-xl"
                placeholder="Your name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-email" className="font-bold">
                Work email
              </Label>
              <Input
                id="contact-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-xl"
                placeholder="you@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-company" className="font-bold">
                Company / organization <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="contact-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="h-12 rounded-xl"
                placeholder="e.g. UAC Foods"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-message" className="font-bold">
                Message
              </Label>
              <textarea
                id="contact-message"
                required
                rows={6}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder={intent === "demo" ? "What would you like to see in a demo?" : "How can we help?"}
              />
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button type="submit" disabled={submitting} className="rounded-full px-8 font-bold gap-2">
                {submitting ? <Loader2 className="animate-spin" size={18} /> : null}
                Send message
              </Button>
              <Button type="button" variant="ghost" asChild className="rounded-full font-bold">
                <Link to="/">Cancel</Link>
              </Button>
            </div>
          </form>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default ContactPage;
