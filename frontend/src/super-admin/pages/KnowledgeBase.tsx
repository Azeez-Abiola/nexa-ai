import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Plus,
  Search,
  FileText,
  Trash2,
  Edit3,
  Upload,
  X,
  FileIcon,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  Filter,
  ArrowUpRight,
  Loader2,
  BookOpen,
  Tags,
  Calendar,
  FolderOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/lib/use-toast";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { cn } from '@/lib/utils';

const ALL_GRADES_TOKEN = "ALL";

const EMPLOYEE_GRADE_KEYS = new Set([
  "Executive",
  "Senior VP",
  "VP",
  "Associate",
  "Senior Analyst",
  "Analyst"
]);

function docUsesSpecificGrades(allowed?: string[]): boolean {
  return (allowed ?? []).some((g) => EMPLOYEE_GRADE_KEYS.has(g));
}

interface Document {
  _id: string;
  title: string;
  category: string;
  content: string;
  tags: string[];
  allowedGrades?: string[];
  uploadedBy?: {
    adminId: string;
    adminEmail: string;
    adminName?: string;
  };
  sourceFile?: {
    filename: string;
    fileType: "text" | "docx" | "pdf";
    uploadedAt: string;
  };
}

const KnowledgeBase: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<Document | null>(null);
  const [docToDelete, setDocToDelete] = useState<string | null>(null);
  const { toast } = useToast();

  // Form State
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  /** When true, material is visible to every grade (sent as ALL). */
  const [allUsers, setAllUsers] = useState(true);
  /** Used only when `allUsers` is false — one or more employee grades. */
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [formOptions, setFormOptions] = useState<{ categories: string[]; grades: string[] }>({
    categories: [],
    grades: []
  });
  const [formOptionsLoading, setFormOptionsLoading] = useState(true);

  const isSuper = window.location.pathname.startsWith('/super-admin');
  const token = isSuper
    ? (localStorage.getItem('cpanelToken') || localStorage.getItem('nexa-token'))
    : localStorage.getItem('nexa-token');

  const headers = React.useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const fetchDocuments = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data } = await axios.get('/api/v1/admin/policies', { headers });
      setDocuments(data);
    } catch (error) {
      console.error("Failed to load documents:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load knowledge base documents."
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const fetchFormOptions = useCallback(async () => {
    try {
      setFormOptionsLoading(true);
      const { data } = await axios.get<{ categories: string[]; grades: string[] }>(
        "/api/v1/admin/policies/meta/form-options",
        { headers }
      );
      setFormOptions({
        categories: data.categories ?? [],
        grades: data.grades ?? []
      });
    } catch (e) {
      console.error("Failed to load form options", e);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not load categories and grades. Refresh the page to try again."
      });
    } finally {
      setFormOptionsLoading(false);
    }
  }, [headers, toast]);

  useEffect(() => {
    fetchFormOptions();
  }, [fetchFormOptions]);


  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      if (!title) setTitle(uploadedFile.name.replace(/\.[^/.]+$/, ""));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || (!file && !content) || !category) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Title, category, and either a file or pasted text are required."
      });
      return;
    }

    try {
      setIsSaving(true);
      const formData = new FormData();
      formData.append("title", title);
      formData.append("category", category);
      if (tags.length > 0) formData.append("tags", tags.join(","));
      if (allUsers) {
        formData.append("allowedGrades", ALL_GRADES_TOKEN);
      } else if (selectedGrades.length === 0) {
        toast({
          variant: "destructive",
          title: "Select grades",
          description: "Choose at least one employee grade, or turn on “All users”."
        });
        return;
      } else {
        formData.append("allowedGrades", selectedGrades.join(","));
      }

      if (file) {
        formData.append("file", file);
      } else {
        formData.append("content", content);
      }

      if (editingDoc) {
        await axios.put(`/api/v1/admin/policies/${editingDoc._id}`, formData, {
          headers: { ...headers, "Content-Type": "multipart/form-data" }
        });
        toast({ title: "Success", description: "Document updated successfully." });
      } else {
        await axios.post('/api/v1/admin/policies', formData, {
          headers: { ...headers, "Content-Type": "multipart/form-data" }
        });
        toast({ title: "Success", description: "Document added to knowledge base." });
      }

      resetForm();
      setIsDrawerOpen(false);
      fetchDocuments();
    } catch (error) {
      console.error("Save error:", error);
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "Could not save document. Please try again."
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!docToDelete) return;
    try {
      await axios.delete(`/api/v1/admin/policies/${docToDelete}`, { headers });
      toast({ title: "Deleted", description: "Material removed from knowledge base." });
      setDocToDelete(null);
      fetchDocuments();
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete document." });
    }
  };

  const resetForm = () => {
    setTitle("");
    setCategory("");
    setContent("");
    setTags([]);
    setFile(null);
    setAllUsers(true);
    setSelectedGrades([]);
    setEditingDoc(null);
  };

  const startEdit = (doc: Document) => {
    setEditingDoc(doc);
    setTitle(doc.title);
    setCategory(doc.category);
    setContent(doc.content);
    setTags(doc.tags);
    const raw = Array.isArray(doc.allowedGrades) ? doc.allowedGrades : [];
    if (docUsesSpecificGrades(raw)) {
      setAllUsers(false);
      setSelectedGrades(raw.filter((g) => EMPLOYEE_GRADE_KEYS.has(g)));
    } else {
      setAllUsers(true);
      setSelectedGrades([]);
    }
    setIsDrawerOpen(true);
  };

  const selectCategories = React.useMemo(() => {
    const base = formOptions.categories;
    if (category && !base.includes(category)) {
      return [category, ...base];
    }
    return base;
  }, [formOptions.categories, category]);

  const filteredDocs = documents.filter(d =>
    d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-10">
      {/* Header & Stats Section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 font-['Sen']">Knowledge Base</h1>
          <p className="text-slate-400 font-medium mt-1 text-sm">Manage and optimize training materials for your Business Unit AI.</p>
        </div>

        <Sheet open={isDrawerOpen} onOpenChange={(open) => {
          setIsDrawerOpen(open);
          if (!open) resetForm();
        }}>
          <SheetTrigger asChild>
            <Button
              className="h-12 px-6 rounded-2xl text-white font-bold gap-2 shadow-lg transition-all active:scale-95"
              style={{ backgroundColor: 'var(--brand-color)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
            >
              <Plus size={20} />
              Add Knowledge material
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-xl p-0 border-none shadow-2xl overflow-hidden flex flex-col">
            <div className="p-10 pb-6">
              <SheetHeader className="mb-0">
                <SheetTitle className="text-3xl font-black font-['Sen'] tracking-tight">
                  {editingDoc ? 'Update Knowledge' : 'Add Knowledge'}
                </SheetTitle>
                <div id="knowledge-sheet-description" className="text-slate-500 font-medium mt-2">
                  {editingDoc
                    ? 'Modify the existing documentation to refine AI responses.'
                    : 'Upload policies, SOPs, or company manuals to train your AI.'}
                </div>
              </SheetHeader>
            </div>

            <div className="flex-1 overflow-y-auto px-10 pb-10">

              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-slate-700">Material Title</Label>
                    <Input
                      placeholder="e.g. Employee Travel Policy"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="h-12 rounded-xl border-slate-200 focus-visible:ring-0 focus-visible:ring-offset-0 focus:border-[var(--brand-color)]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-slate-700">Category</Label>
                    {formOptionsLoading ? (
                      <Skeleton className="h-12 w-full rounded-xl" />
                    ) : (
                      <Select
                        value={category || undefined}
                        onValueChange={setCategory}
                        disabled={selectCategories.length === 0}
                      >
                        <SelectTrigger
                          className={cn(
                            "h-12 rounded-xl border-2 shadow-sm transition-colors",
                            "border-[var(--brand-color)]/35 bg-white",
                            "focus-visible:ring-2 focus-visible:ring-[var(--brand-color)]/30 focus-visible:ring-offset-0",
                            "data-[state=open]:border-[var(--brand-color)]"
                          )}
                        >
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[min(320px,60vh)] border-[var(--brand-color)]/20">
                          {selectCategories.map((c) => (
                            <SelectItem
                              key={c}
                              value={c}
                              className="text-left cursor-pointer focus:bg-[var(--brand-color)]/10 focus:text-[var(--brand-color)] data-[highlighted]:bg-[var(--brand-color)]/10 data-[highlighted]:text-[var(--brand-color)]"
                            >
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <p className="text-xs text-slate-400 font-medium">
                      Categories are defined by your organization and loaded from the server.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-bold text-slate-700">Visible to grades</Label>
                    <p className="text-xs text-slate-400 font-medium -mt-1">
                      Choose <span className="font-bold text-[var(--brand-color)]">All users</span> so every employee grade can use this material in chat, or turn it off and pick specific grades.
                    </p>
                    <div
                      className={cn(
                        "rounded-2xl border-2 p-4 space-y-3 max-h-56 overflow-y-auto transition-colors",
                        "border-[var(--brand-color)]/30 bg-[var(--brand-color)]/[0.06]"
                      )}
                    >
                      {formOptionsLoading ? (
                        <Skeleton className="h-20 w-full rounded-xl" />
                      ) : (
                        <>
                          <label className="flex items-center gap-3 cursor-pointer select-none text-sm font-bold text-slate-800 pb-2 border-b border-[var(--brand-color)]/15">
                            <Checkbox
                              checked={allUsers}
                              onCheckedChange={(checked) => {
                                const on = checked === true;
                                setAllUsers(on);
                                if (on) setSelectedGrades([]);
                              }}
                              className={cn(
                                "border-2 border-[var(--brand-color)]/50 data-[state=checked]:bg-[var(--brand-color)] data-[state=checked]:border-[var(--brand-color)]",
                                "focus-visible:ring-2 focus-visible:ring-[var(--brand-color)]/35"
                              )}
                            />
                            <span>All users</span>
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--brand-color)] ml-auto">
                              Every grade
                            </span>
                          </label>
                          {formOptions.grades.map((grade) => (
                            <label
                              key={grade}
                              className={cn(
                                "flex items-center gap-3 select-none text-sm font-medium text-slate-700",
                                allUsers ? "opacity-45 cursor-not-allowed" : "cursor-pointer"
                              )}
                            >
                              <Checkbox
                                disabled={allUsers}
                                checked={selectedGrades.includes(grade)}
                                onCheckedChange={(checked) => {
                                  if (allUsers) return;
                                  if (checked === true) {
                                    setSelectedGrades((prev) =>
                                      prev.includes(grade) ? prev : [...prev, grade]
                                    );
                                  } else {
                                    setSelectedGrades((prev) => prev.filter((g) => g !== grade));
                                  }
                                }}
                                className={cn(
                                  "border-2 border-[var(--brand-color)]/50 data-[state=checked]:bg-[var(--brand-color)] data-[state=checked]:border-[var(--brand-color)]",
                                  "focus-visible:ring-2 focus-visible:ring-[var(--brand-color)]/35"
                                )}
                              />
                              <span>{grade}</span>
                            </label>
                          ))}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-slate-700">Source Input</Label>
                    {!file ? (
                      <div className="space-y-4">
                        <div className="relative group cursor-pointer">
                          <input
                            type="file"
                            id="file-upload"
                            className="hidden"
                            accept=".pdf,.docx,.txt"
                            onChange={handleFileUpload}
                          />
                          <label
                            htmlFor="file-upload"
                            className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 hover:bg-slate-100 hover:border-[var(--brand-color)]/20 transition-all group-hover:shadow-inner"
                          >
                            <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 mb-3 group-hover:scale-110 transition-transform">
                              <Upload size={22} />
                            </div>
                            <p className="text-sm font-bold text-slate-600">Drag or Browse Documents</p>
                            <p className="text-xs text-slate-400 mt-1">PDF, DOCX, or TXT (Max 10MB)</p>
                          </label>
                        </div>
                        <div className="relative flex items-center gap-4">
                          <div className="flex-1 h-px bg-slate-100" />
                          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">OR PASTE TEXT</span>
                          <div className="flex-1 h-px bg-slate-100" />
                        </div>
                        <textarea
                          className="w-full min-h-[160px] p-4 rounded-2xl border border-slate-200 focus:ring-0 focus:border-[var(--brand-color)] outline-none transition-all placeholder:text-slate-300 text-sm"
                          placeholder="Paste document content directly..."
                          value={content}
                          onChange={(e) => setContent(e.target.value)}
                        />
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-4 bg-rose-50 rounded-2xl border border-rose-100 group">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-[var(--brand-color)]">
                            <FileText size={20} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900 leading-tight">{file.name}</p>
                            <p className="text-[10px] font-bold text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setFile(null)}
                          className="rounded-full hover:bg-white text-slate-400 hover:text-[var(--brand-color)]"
                        >
                          <X size={18} />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <SheetFooter className="pt-6">
                  <Button
                    type="submit"
                    disabled={isSaving}
                    className="w-full h-14 rounded-2xl text-white font-bold text-lg shadow-xl transition-all active:scale-95 disabled:opacity-50"
                    style={{ backgroundColor: 'var(--brand-color)' }}
                  >
                    {isSaving ? (
                      <div className="flex items-center gap-3">
                        <Loader2 size={20} className="animate-spin" />
                        <span>Processing...</span>
                      </div>
                    ) : (
                      <span>{editingDoc ? 'Update Knowledge' : 'Submit for AI Training'}</span>
                    )}
                  </Button>
                </SheetFooter>
              </form>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatsCard
          icon={BookOpen}
          label="Total Materials"
          value={documents.length.toString()}
          color="rose"
        />
        <StatsCard
          icon={Tags}
          label="Categories"
          value={Array.from(new Set(documents.map(d => d.category))).length.toString()}
          color="blue"
        />
        <StatsCard
          icon={Calendar}
          label="Updated Recently"
          value={documents.filter(d => {
            const updated = d.sourceFile?.uploadedAt ? new Date(d.sourceFile.uploadedAt) : new Date();
            return (Date.now() - updated.getTime()) < (7 * 24 * 60 * 60 * 1000);
          }).length.toString()}
          color="green"
        />
      </div>

      {/* Material Table Section */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/30">
          <h2 className="text-xl font-bold font-['Sen']">Knowledge Repository</h2>
          <div className="relative w-full md:w-80 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[var(--brand-color)] transition-colors" size={18} />
            <Input
              placeholder="Search knowledge..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-11 rounded-xl bg-white border-slate-100 focus:ring-rose-50"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-6">
                <Skeleton className="w-12 h-12 rounded-xl" />
                <Skeleton className="h-6 flex-1 rounded-lg" />
                <Skeleton className="h-6 w-32 rounded-lg" />
                <Skeleton className="h-6 w-24 rounded-lg" />
                <Skeleton className="h-6 w-10 rounded-lg" />
              </div>
            ))}
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="h-80 flex flex-col items-center justify-center text-center p-10">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-200 mb-4">
              <FolderOpen size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 font-['Sen']">Empty Repository</h3>
            <p className="text-slate-500 max-w-[280px] mt-2 font-medium">No materials found. Start adding documents to train your Business Unit AI.</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="hover:bg-transparent border-slate-50">
                <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest pl-8 w-[40%]">Document Title</TableHead>
                <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">Category</TableHead>
                <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">Grades</TableHead>
                <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">Source</TableHead>
                <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">Last Synced</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDocs.map((doc) => (
                <TableRow key={doc._id} className="group hover:bg-slate-50/50 transition-colors border-slate-50">
                  <TableCell className="pl-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:text-[var(--brand-color)] group-hover:border-[var(--brand-color)]/20 transition-all">
                        <FileText size={18} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm leading-none mb-1">{doc.title}</p>
                        <div className="flex gap-1">
                          {doc.tags.slice(0, 2).map(tag => (
                            <span key={tag} className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">#{tag}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="bg-[var(--brand-color)]/[0.06] font-bold text-xs rounded-lg py-1 px-3 max-w-[200px] whitespace-normal text-left border-[var(--brand-color)]/25 text-[var(--brand-color)] ring-1 ring-[var(--brand-color)]/15"
                    >
                      {doc.category}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {!docUsesSpecificGrades(doc.allowedGrades) ? (
                      <span className="text-xs font-bold text-[var(--brand-color)]">All users</span>
                    ) : (
                      <div className="flex flex-wrap gap-1 max-w-[220px]">
                        {(doc.allowedGrades ?? [])
                          .filter((g) => EMPLOYEE_GRADE_KEYS.has(g))
                          .map((g) => (
                            <Badge
                              key={g}
                              variant="secondary"
                              className="text-[10px] font-bold rounded-md px-2 py-0.5 bg-[var(--brand-color)]/10 text-[var(--brand-color)] ring-1 ring-[var(--brand-color)]/20 border-0"
                            >
                              {g}
                            </Badge>
                          ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {doc.sourceFile ? (
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-600 truncate max-w-[120px]" title={doc.sourceFile.filename}>
                          {doc.sourceFile.filename}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{doc.sourceFile.fileType}</span>
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-[var(--brand-color)]">Manual Input</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <p className="text-sm font-bold text-slate-500">
                      {doc.sourceFile?.uploadedAt
                        ? format(new Date(doc.sourceFile.uploadedAt), 'MMM d, yyyy')
                        : 'Today'
                      }
                    </p>
                  </TableCell>
                  <TableCell className="pr-8">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" onClick={() => startEdit(doc)} className="h-9 w-9 rounded-xl hover:bg-white hover:text-blue-600">
                        <Edit3 size={16} />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDocToDelete(doc._id)} className="h-9 w-9 rounded-xl hover:bg-white hover:text-[var(--brand-color)]">
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!docToDelete} onOpenChange={(open) => !open && setDocToDelete(null)}>
        <AlertDialogContent className="rounded-2xl border-none shadow-2xl p-8">
          <AlertDialogHeader>
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-[var(--brand-color)] mb-4 border border-slate-100">
              <AlertCircle size={24} />
            </div>
            <AlertDialogTitle className="text-xl font-bold font-['Sen']">Remove material?</AlertDialogTitle>
            <AlertDialogDescription className="font-medium text-slate-500">
              The AI model will no longer use this data for processing requests. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 gap-3">
            <AlertDialogCancel className="bg-slate-50 border-none rounded-xl h-12 font-bold text-slate-500">Cancel Access</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-[var(--brand-color)] hover:opacity-90 rounded-xl h-12 font-bold transition-all">Confirm Deletion</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const StatsCard = ({ icon: Icon, label, value, color, description }: any) => {
  const colors = {
    rose: "bg-white text-[var(--brand-color)] ring-slate-100 border border-slate-100",
    blue: "bg-blue-50 text-blue-600 ring-blue-100",
    green: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    indigo: "bg-indigo-50 text-indigo-600 ring-indigo-100"
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex items-center gap-5 group hover:shadow-md transition-all">
      <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center ring-1", colors[color as keyof typeof colors])}>
        <Icon size={26} strokeWidth={1.5} className="group-hover:scale-110 transition-transform" />
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1.5">{label}</p>
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-bold text-slate-900 font-['Sen'] leading-none">{value}</p>
          {description && <span className="text-[10px] font-bold text-emerald-500 leading-none">{description}</span>}
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBase;
