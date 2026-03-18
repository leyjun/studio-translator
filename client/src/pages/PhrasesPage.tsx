import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit, BookOpen, Zap } from "lucide-react";
import { useLocation } from "wouter";
import type { SavedPhrase } from "@shared/schema";

const CATEGORIES = ["인사", "예약", "가격", "안내", "정책", "SNS", "기타"];
const CATEGORY_COLORS: Record<string, string> = {
  인사: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  예약: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  가격: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  안내: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  정책: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  SNS: "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400",
  기타: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

export default function PhrasesPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editPhrase, setEditPhrase] = useState<SavedPhrase | null>(null);
  const [filterCat, setFilterCat] = useState("전체");

  const [formTitle, setFormTitle] = useState("");
  const [formText, setFormText] = useState("");
  const [formCat, setFormCat] = useState("예약");

  const { data: phrases = [], isLoading } = useQuery<SavedPhrase[]>({
    queryKey: ["/api/phrases"],
  });

  const addMutation = useMutation({
    mutationFn: async (data: { title: string; originalText: string; category: string; sortOrder: number }) => {
      const res = await apiRequest("POST", "/api/phrases", data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/phrases"] });
      toast({ title: "문구가 추가되었습니다." });
      setIsAddOpen(false);
      resetForm();
    },
  });

  const editMutation = useMutation({
    mutationFn: async (data: { id: number; title: string; originalText: string; category: string }) => {
      const res = await apiRequest("PATCH", `/api/phrases/${data.id}`, {
        title: data.title,
        originalText: data.originalText,
        category: data.category,
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/phrases"] });
      toast({ title: "문구가 수정되었습니다." });
      setEditPhrase(null);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/phrases/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/phrases"] });
      toast({ title: "문구가 삭제되었습니다." });
    },
  });

  const resetForm = () => {
    setFormTitle("");
    setFormText("");
    setFormCat("예약");
  };

  const openEdit = (phrase: SavedPhrase) => {
    setFormTitle(phrase.title);
    setFormText(phrase.originalText);
    setFormCat(phrase.category);
    setEditPhrase(phrase);
  };

  const handleAdd = () => {
    if (!formTitle.trim() || !formText.trim()) {
      toast({ title: "제목과 내용을 입력해주세요.", variant: "destructive" });
      return;
    }
    addMutation.mutate({
      title: formTitle,
      originalText: formText,
      category: formCat,
      sortOrder: phrases.length + 1,
    });
  };

  const handleEdit = () => {
    if (!editPhrase || !formTitle.trim() || !formText.trim()) return;
    editMutation.mutate({
      id: editPhrase.id,
      title: formTitle,
      originalText: formText,
      category: formCat,
    });
  };

  const filtered = filterCat === "전체"
    ? phrases
    : phrases.filter(p => p.category === filterCat);

  return (
    <Layout>
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-semibold text-foreground">저장 문구 관리</h1>
            <p className="text-xs text-muted-foreground mt-0.5">자주 쓰는 상담 문구를 저장하고 바로 번역하세요</p>
          </div>
          <Dialog open={isAddOpen} onOpenChange={(o) => { setIsAddOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5" data-testid="button-add-phrase">
                <Plus className="w-4 h-4" />
                문구 추가
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>새 문구 추가</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="phrase-title" className="text-sm">제목</Label>
                  <Input
                    id="phrase-title"
                    value={formTitle}
                    onChange={e => setFormTitle(e.target.value)}
                    placeholder="예: 예약 확인 안내"
                    data-testid="input-phrase-title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phrase-text" className="text-sm">문구 내용 (한국어)</Label>
                  <Textarea
                    id="phrase-text"
                    value={formText}
                    onChange={e => setFormText(e.target.value)}
                    placeholder="번역할 한국어 문구를 입력하세요"
                    className="min-h-[100px] text-sm resize-none"
                    data-testid="input-phrase-text"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">카테고리</Label>
                  <Select value={formCat} onValueChange={setFormCat}>
                    <SelectTrigger data-testid="select-phrase-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddOpen(false)}>취소</Button>
                <Button onClick={handleAdd} disabled={addMutation.isPending} data-testid="button-save-phrase">
                  저장
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Edit dialog */}
        <Dialog open={!!editPhrase} onOpenChange={(o) => { if (!o) { setEditPhrase(null); resetForm(); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>문구 수정</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-sm">제목</Label>
                <Input value={formTitle} onChange={e => setFormTitle(e.target.value)} data-testid="input-edit-title" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">문구 내용</Label>
                <Textarea
                  value={formText}
                  onChange={e => setFormText(e.target.value)}
                  className="min-h-[100px] text-sm resize-none"
                  data-testid="input-edit-text"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">카테고리</Label>
                <Select value={formCat} onValueChange={setFormCat}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setEditPhrase(null); resetForm(); }}>취소</Button>
              <Button onClick={handleEdit} disabled={editMutation.isPending} data-testid="button-save-edit">
                저장
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Filter */}
        <div className="flex flex-wrap gap-1.5">
          {["전체", ...CATEGORIES].map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCat(cat)}
              data-testid={`filter-cat-${cat}`}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                filterCat === cat
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-primary/50"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Phrases grid */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">저장된 문구가 없습니다</p>
            <p className="text-xs mt-1 opacity-70">+ 문구 추가 버튼으로 새 문구를 만드세요</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((phrase) => (
              <Card key={phrase.id} className="p-4 flex flex-col gap-3" data-testid={`phrase-card-${phrase.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{phrase.title}</p>
                    <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full mt-1.5 ${CATEGORY_COLORS[phrase.category] || CATEGORY_COLORS["기타"]}`}>
                      {phrase.category}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed flex-1 line-clamp-3">
                  {phrase.originalText}
                </p>
                <div className="flex items-center gap-1.5 pt-1 border-t border-border">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 text-xs flex-1"
                    onClick={() => openEdit(phrase)}
                    data-testid={`edit-phrase-${phrase.id}`}
                  >
                    <Edit className="w-3 h-3" />
                    수정
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 text-xs flex-1 text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate(phrase.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`delete-phrase-${phrase.id}`}
                  >
                    <Trash2 className="w-3 h-3" />
                    삭제
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
