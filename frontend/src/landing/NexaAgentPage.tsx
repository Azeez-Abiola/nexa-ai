import { Link } from "react-router-dom";
import Navbar from "@/landing/Navbar";
import Footer from "@/landing/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  Github,
  MessageSquare,
  FileEdit,
  ListChecks,
  History,
  Mic,
  Paperclip,
  Terminal,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";

const REPO_URL = "https://github.com/1879-Tech-Hub/Nexa-Agent";
const RELEASES_URL = `${REPO_URL}/releases/latest`;

const features = [
  {
    icon: MessageSquare,
    title: "Chat with any model",
    description: "Claude Opus 4.8, GPT-5, Kimi k2.5, or DeepSeek v4 — pick per conversation.",
  },
  {
    icon: FileEdit,
    title: "Reads and edits your code",
    description: "Explores the workspace, proposes edits as a diff you approve, and runs terminal commands with your confirmation.",
  },
  {
    icon: ListChecks,
    title: "Agent or Plan mode",
    description: "Agent mode makes changes end to end. Plan mode is read-only — it explores and proposes without touching anything.",
  },
  {
    icon: History,
    title: "Session history",
    description: "Past conversations are saved per project and resumable — pick up exactly where you left off.",
  },
  {
    icon: Paperclip,
    title: "Attachments",
    description: "Paste or attach PDFs, DOCX, XLSX, and images — the agent reads and reasons over them as context.",
  },
  {
    icon: Mic,
    title: "Voice dictation",
    description: "Speak instead of type — requires the free sox CLI tool installed locally.",
  },
];

type IdeStep = { title: string; body: string };

const ideInstructions: Record<string, { label: string; menuHint: string; steps: IdeStep[]; cli: string }> = {
  vscode: {
    label: "VS Code",
    menuHint: 'Extensions view (Cmd/Ctrl+Shift+X) → "…" menu at the top → "Install from VSIX..."',
    cli: "code --install-extension nexa-agent-<version>.vsix",
    steps: [
      { title: "Download the .vsix", body: "Grab the latest .vsix file from the GitHub Releases page linked above." },
      { title: "Open the Extensions view", body: 'Click the Extensions icon in the Activity Bar, or press Cmd/Ctrl+Shift+X.' },
      { title: 'Install from VSIX', body: 'Click the "…" (More Actions) menu at the top of the Extensions panel and choose "Install from VSIX...", then select the file you downloaded.' },
      { title: "Reload if prompted", body: "VS Code may ask to reload the window — accept it." },
    ],
  },
  cursor: {
    label: "Cursor",
    menuHint: 'Extensions view → "…" menu → "Install from VSIX..." (same flow as VS Code)',
    cli: "cursor --install-extension nexa-agent-<version>.vsix",
    steps: [
      { title: "Download the .vsix", body: "Grab the latest .vsix file from the GitHub Releases page linked above." },
      { title: "Open the Extensions view", body: "Click the Extensions icon in Cursor's sidebar." },
      { title: "Install from VSIX", body: 'Use the "…" menu at the top of the panel → "Install from VSIX..." → select the downloaded file.' },
      { title: "Reload if prompted", body: "Accept the reload prompt if Cursor shows one." },
    ],
  },
  other: {
    label: "Other editors",
    menuHint: "Windsurf, VSCodium, Trae, and other VS Code-based editors support the same Extensions → Install from VSIX flow — menu wording may vary slightly.",
    cli: "<your-editor-binary> --install-extension nexa-agent-<version>.vsix",
    steps: [
      { title: "Download the .vsix", body: "Grab the latest .vsix file from the GitHub Releases page linked above." },
      { title: "Open your Extensions panel", body: "Every VS Code fork ships one — usually the same icon and shortcut as VS Code." },
      { title: 'Find "Install from VSIX..."', body: 'Look in the panel\'s "…" / overflow menu. If you can\'t find it, use the Command Palette and search "Install from VSIX".' },
      { title: "Or use the command line", body: "If your editor has a CLI shim installed, run the command shown below with the path to the downloaded file." },
    ],
  },
};

const NexaAgentPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto max-w-5xl px-4 sm:px-6 pt-24 sm:pt-28 md:pt-36 pb-20 sm:pb-28">
        {/* Hero */}
        <div className="mb-14 sm:mb-20 text-center">
          <Badge variant="secondary" className="mb-4 rounded-full px-4 py-1 text-xs font-bold tracking-wide">
            Internal tool · 1879 Tech Hub
          </Badge>
          <h1 className="text-4xl md:text-5xl font-extrabold text-[#1A1A1A] font-sans mb-4 tracking-tight">
            Nexa Agent
          </h1>
          <p className="max-w-2xl mx-auto text-muted-foreground text-lg leading-relaxed mb-8">
            Nexa AI, inside your editor. Chat with it, let it read and edit your codebase, run commands, and pick up
            past conversations — without leaving VS Code, Cursor, or any VS Code-based editor.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="rounded-full px-8 font-bold gap-2">
              <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer">
                <Download size={18} />
                Download latest release
              </a>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full px-8 font-bold gap-2">
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
                <Github size={18} />
                View repository
              </a>
            </Button>
          </div>
        </div>

        {/* Access notice */}
        <Card className="mb-14 sm:mb-20 border-amber-200 bg-amber-50/60 rounded-2xl">
          <CardContent className="flex items-start gap-4 p-6">
            <ShieldAlert className="mt-0.5 shrink-0 text-amber-600" size={22} />
            <div>
              <p className="font-bold text-[#1A1A1A] mb-1">This repository is private</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                You need to be added as a collaborator on{" "}
                <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="text-primary font-semibold underline underline-offset-2">
                  1879-Tech-Hub/Nexa-Agent
                </a>{" "}
                before you can view or download a release. If the link 404s for you, ask an admin for access, or{" "}
                <Link to="/contact" className="text-primary font-semibold underline underline-offset-2">
                  reach out here
                </Link>
                .
              </p>
            </div>
          </CardContent>
        </Card>

        {/* What it can do */}
        <section className="mb-16 sm:mb-24">
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3 text-center">What it can do</p>
          <h2 className="text-2xl md:text-3xl font-extrabold text-[#1A1A1A] text-center mb-10">
            A full coding agent, not just autocomplete
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <Card key={f.title} className="rounded-2xl border-border/60 hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <f.icon size={20} />
                  </div>
                  <CardTitle className="text-base font-bold">{f.title}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <CardDescription className="leading-relaxed">{f.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Install instructions */}
        <section className="mb-16 sm:mb-24">
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3 text-center">Installation</p>
          <h2 className="text-2xl md:text-3xl font-extrabold text-[#1A1A1A] text-center mb-3">
            Install from a .vsix file
          </h2>
          <p className="max-w-xl mx-auto text-center text-muted-foreground mb-10 leading-relaxed">
            Nexa Agent isn't published to a public marketplace — it's distributed as a downloadable .vsix, the same
            way for every VS Code-based editor.
          </p>

          <Tabs defaultValue="vscode" className="w-full">
            <TabsList className="mx-auto mb-8 flex h-auto w-fit max-w-full flex-wrap justify-center gap-1 p-1">
              {Object.entries(ideInstructions).map(([key, ide]) => (
                <TabsTrigger
                  key={key}
                  value={key}
                  className="whitespace-nowrap px-4 py-2 font-semibold text-xs sm:text-sm"
                >
                  {ide.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {Object.entries(ideInstructions).map(([key, ide]) => (
              <TabsContent key={key} value={key}>
                <Card className="rounded-2xl border-border/60">
                  <CardContent className="p-6 sm:p-8">
                    <p className="text-sm text-muted-foreground mb-6">{ide.menuHint}</p>
                    <ol className="space-y-5 mb-6">
                      {ide.steps.map((step, i) => (
                        <li key={step.title} className="flex gap-4">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
                            {i + 1}
                          </span>
                          <div>
                            <p className="font-bold text-[#1A1A1A] text-sm mb-0.5">{step.title}</p>
                            <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                    <div className="rounded-xl bg-[#F8F9FF] border border-border/60 p-4">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <Terminal size={13} /> Or from a terminal
                      </p>
                      <code className="block text-sm font-mono text-[#1A1A1A] break-all">{ide.cli}</code>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </section>

        {/* First-time setup */}
        <section className="mb-16 sm:mb-24">
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3 text-center">First run</p>
          <h2 className="text-2xl md:text-3xl font-extrabold text-[#1A1A1A] text-center mb-10">
            Log in and start chatting
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              {
                title: "Log in",
                body: 'Open the Command Palette (Cmd/Ctrl+Shift+P) and run "Nexa Agent: Log In" — use your existing Nexa account.',
              },
              {
                title: "Open the chat",
                body: "Click the Nexa Agent icon in the Activity Bar (left-hand icon strip) to open the chat panel.",
              },
              {
                title: "Pick a model and go",
                body: "Choose Agent or Plan mode, pick a model, and start a conversation about your open workspace.",
              },
            ].map((s, i) => (
              <Card key={s.title} className="rounded-2xl border-border/60">
                <CardContent className="p-6">
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    {i + 1}
                  </div>
                  <p className="font-bold text-[#1A1A1A] mb-1.5">{s.title}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Requirements */}
        <section>
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3 text-center">Requirements</p>
          <h2 className="text-2xl md:text-3xl font-extrabold text-[#1A1A1A] text-center mb-10">Before you install</h2>
          <div className="max-w-2xl mx-auto space-y-4">
            {[
              "An existing Nexa account (same login as the Nexa AI web app).",
              "Collaborator access to the private 1879-Tech-Hub/Nexa-Agent GitHub repo.",
              "VS Code, Cursor, or any VS Code-based editor that supports installing extensions from a .vsix file.",
              "Optional — for voice dictation: the sox CLI tool installed locally (brew install sox on macOS; apt install sox on Linux; available via Chocolatey on Windows).",
            ].map((req) => (
              <div key={req} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 shrink-0 text-primary" size={18} />
                <p className="text-sm text-muted-foreground leading-relaxed">{req}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default NexaAgentPage;
