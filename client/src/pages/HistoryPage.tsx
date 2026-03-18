import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Copy, Trash2, Clock, Filter } from "lucide-react";
import type { TranslationHistory } from "@shared/schema";

const LANG_LABELS: Record<string, string> = { en: "🇺🇸 EN", ja: "🇯🇵 JA" };
const TONE_LABELS: Record<string, string> = { formal: "격식체", casual: "친근체", premium: "프리미엄" };

export default function HistoryPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filterLang, setFilterLang] = useState<string>("all");

  const { data: history = [], isLoading } = useQuery<TranslationHistory[]>({
    queryKey: ["/api/history"],
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/history");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/history"] });
      toast({ title: "번역 기록이 삭제되었습니다." });
    },
  });

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast({ title: "복사됨" });
  };

  const filtered = filterLang === "all"
    ? history
    : history.filter(h => h.targetLanguage === filterLang);

  const formatTime = (date: string | Date) => {
    const d = new Date(date);
    return d.toLocaleString("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Layout>
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-semibold text-foreground">번역 기록</h1>
            <p className="text-xs text-muted-foreground mt-0.5">최근 {history.length}개의 번역 기록</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Filter */}
            <div className="flex gap-1.5">
              {[
                { value: "all", label: "전체" },
                { value: "en", label: "🇺🇸 영어" },
                { value: "ja", label: "🇯🇵 일어" },
              ].map(f => (
                <button
                  key={f.value}
                  onClick={() => setFilterLang(f.value)}
                  data-testid={`filter-lang-${f.value}`}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    filterLang === f.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-primary/50"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {history.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-7 text-destructive hover:text-destructive"
                onClick={() => clearMutation.mutate()}
                disabled={clearMutation.isPending}
                data-testid="button-clear-history"
              >
                <Trash2 className="w-3 h-3" />
                전체 삭제
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <div className="text-center">
              <Clock className="w-8 h-8 mx-auto mb-2 animate-pulse opacity-40" />
              <p className="text-sm">기록 불러오는 중...</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <div className="text-center">
              <Clock className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">번역 기록이 없습니다</p>
              <p className="text-xs mt-1 opacity-70">번역하면 여기에 자동으로 저장됩니다</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => (
              <Card
                key={item.id}
                className="p-4"
                data-testid={`history-item-${item.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Original */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">🇰🇷 원문</span>
                      </div>
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                        {item.originalText}
                      </p>
                    </div>
                    {/* Translated */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                          {LANG_LABELS[item.targetLanguage] || item.targetLanguage} 번역
                        </span>
                      </div>
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                        {item.translatedText}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {LANG_LABELS[item.targetLanguage]}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {TONE_LABELS[item.tone] || item.tone}
                    </Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTime(item.createdAt)}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 gap-1 text-xs"
                    onClick={() => handleCopy(item.translatedText)}
                    data-testid={`copy-history-${item.id}`}
                  >
                    <Copy className="w-3 h-3" />
                    번역문 복사
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
