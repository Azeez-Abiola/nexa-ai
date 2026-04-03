declare module "*.module.css" {
  const content: { [className: string]: string };
  export default content;
}

declare const styles: {
  homeContainer: string;
  logoContainer: string;
  logoText: string;
  contentWrapper: string;
  textContent: string;
  title: string;
  body: string;
  description: string;
  cursor: string;
  blink: string;
  cta: string;
  revealed: string;
  revealsFloat: string;
  ctaButton: string;
  floatingChatBtn: string;
  mainContent: string;
  avatarSection: string;
  centralAvatarImage: string;
  textSection: string;
  avatarContainer: string;
  avatar: string;
  howItWorksContainer: string;
  howItWorksContent: string;
  stepsColumn: string;
  avatarColumn: string;
  avatarImage: string;
};

export default styles;
