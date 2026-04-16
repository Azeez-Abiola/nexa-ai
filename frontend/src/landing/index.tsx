import Navbar from "@/landing/Navbar";
import HeroSection from "@/landing/HeroSection";
import ProblemSection from "@/landing/ProblemSection";
import SolutionSection from "@/landing/SolutionSection";
import HowItWorksSection from "@/landing/HowItWorksSection";
import FeaturesSection from "@/landing/FeaturesSection";
import UseCasesSection from "@/landing/UseCasesSection";
import DifferentiationSection from "@/landing/DifferentiationSection";
import SecuritySection from "@/landing/SecuritySection";
import CTASection from "@/landing/CTASection";
import Footer from "@/landing/Footer";

const NewLandingPage = () => (
  <div id="marketing-top" className="min-h-screen bg-background overflow-x-hidden">
    <Navbar />
    <HeroSection />
    <ProblemSection />
    <SolutionSection />
    <HowItWorksSection />
    <FeaturesSection />
    <UseCasesSection />
    <DifferentiationSection />
    <SecuritySection />
    <CTASection />
    <Footer />
  </div>
);

export default NewLandingPage;
