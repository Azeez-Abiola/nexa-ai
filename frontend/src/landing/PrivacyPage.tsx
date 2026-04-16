import { useNavigate } from "react-router-dom";
import Navbar from "@/landing/Navbar";
import { PrivacyPolicy } from "@/components/PrivacyPolicy";

/** Standalone privacy view for marketing footer links. */
const PrivacyPage = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <PrivacyPolicy isOpen={true} onClose={() => navigate("/")} type="user" variant="light" />
    </div>
  );
};

export default PrivacyPage;
