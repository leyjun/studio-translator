import { useState, useRef, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Copy, Check, Languages, Loader2, Zap, ChevronRight,
  Link, CheckCircle, AlertCircle, X, MessageSquare,
  ArrowLeftRight, Wand2
} from "lucide-react";
import type { SavedPhrase } from "@shared/schema";

// Direction modes
type Direction = "to_foreign" | "to_korean";

const LANGUAGES = [
  { value: "en", label: "🇺🇸 영어 (English)", short: "EN", flag: "🇺🇸" },
  { value: "ja", label: "🇯🇵 일본어 (日本語)", short: "JA", flag: "🇯🇵" },
];

const TONES = [
  { value: "formal", label: "격식체", desc: "정중하고 전문적인 표현" },
  { value: "casual", label: "친근체", desc: "따뜻하고 친근한 표현" },
  { value: "premium", label: "프리미엄", desc: "럭셔리 서비스 느낌" },
];

const CATEGORIES = ["전체", "인사", "예약", "가격", "안내", "정책", "SNS"];

function getLangLabel(lang: string) {
  if (lang === "en") return "🇺🇸 영어";
  if (lang === "ja") return "🇯🇵 일본어";
  return lang;
}

export default function TranslatorPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [inputText, setInputText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [targetLang, setTargetLang] = useState("ja");
  const [tone, setTone] = useState("formal");
  const [selectedCategory, setSelectedCategory] = useState("전체");
  const [direction, setDirection] = useState<Direction>("to_foreign");
  const [detectedLang, setDetectedLang] = useState<string | null>(null);
  const [autoSwitched, setAutoSwitched] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const resultTextRef = useRef<HTMLTextAreaElement>(null);
  const detectTimer = useRef<NodeJS.Timeout | null>(null);

  // Chat context state
  const [chatUrl, setChatUrl] = useState("");
  const [chatContext, setChatContext] = useState("");
  const [contextStatus, setContextStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [contextSummary, setContextSummary] = useState("");

  const { data: phrases = [] } = useQuery<SavedPhrase[]>({
    queryKey: ["/api/phrases"],
  });

  const filteredPhrases = selectedCategory === "전체"
    ? phrases
    : phrases.filter(p => p.category === selectedCategory);

  // Auto-detect language when user pastes/types
  const detectLanguage = useCallback(async (text: string) => {
    if (!text || text.trim().length < 3) {
      setDetectedLang(null);
      setAutoSwitched(false);
      return;
    }
    try {
      const res = await apiRequest("POST", "/api/detect-language", { text });
      const data = await res.json();
      const lang = data.language;
      setDetectedLang(lang);

      if (lang === "ko" && direction === "to_korean") {
        // Input is Korean but we're in reverse mode — suggest switch
        setAutoSwitched(true);
      } else if (lang !== "ko" && direction === "to_foreign") {
        // Input is foreign but we're in forward mode — suggest switch
        setAutoSwitched(true);
        // Auto-set which language
        if (lang === "ja" || lang === "en") setTargetLang(lang);
      } else {
        setAutoSwitched(false);
      }
    } catch {
      // silently ignore detect errors
    }
  }, [direction]);

  const handleInputChange = (text: string) => {
    setInputText(text);
    setTranslatedText("");
    setAutoSwitched(false);

    // Debounce detection
    if (detectTimer.current) clearTimeout(detectTimer.current);
    detectTimer.current = setTimeout(() => detectLanguage(text), 400);
  };

  // Toggle direction
  const handleToggleDirection = () => {
    const newDir: Direction = direction === "to_foreign" ? "to_korean" : "to_foreign";
    setDirection(newDir);
    setAutoSwitched(false);
    setDetectedLang(null);
    // Swap input/output
    if (translatedText) {
      setInputText(translatedText);
      setTranslatedText("");
    }
  };

  // Accept auto-switch suggestion
  const handleAcceptSwitch = () => {
    setDirection(prev => prev === "to_foreign" ? "to_korean" : "to_foreign");
    setAutoSwitched(false);
  };

  // Fetch chat context mutation
  const fetchChatMutation = useMutation({
    mutationFn: async (url: string) => {
      const res = await apiRequest("POST", "/api/fetch-chat", { url });
      return res.json();
    },
    onSuccess: (data) => {
      setContextStatus("loaded");
      setContextSummary(data.summary);
      setChatContext(data.summary);
      toast({ title: "대화 컨텍스트 로드 완료", description: "이제 이 대화의 맥락을 반영해서 번역합니다." });
    },
    onError: (error: any) => {
      setContextStatus("error");
      toast({
        title: "컨텍스트 로드 실패",
        description: error?.message || "URL을 확인하거나 카카오 비즈니스에 로그인 후 다시 시도해주세요.",
        variant: "destructive",
      });
    },
  });

  const translateMutation = useMutation({
    mutationFn: async (data: {
      text: string;
      targetLanguage: string;
      tone: string;
      direction: Direction;
      chatContext?: string;
    }) => {
      const res = await apiRequest("POST", "/api/translate", data);
      return res.json();
    },
    onSuccess: (data) => {
      setTranslatedText(data.translatedText);
      qc.invalidateQueries({ queryKey: ["/api/history"] });
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 100);
    },
    onError: () => {
      toast({
        title: "번역 실패",
        description: "번역 중 오류가 발생했습니다. 다시 시도해주세요.",
        variant: "destructive",
      });
    },
  });

  const handleLoadContext = () => {
    if (!chatUrl.trim()) return;
    setContextStatus("loading");
    fetchChatMutation.mutate(chatUrl.trim());
  };

  const handleClearContext = () => {
    setChatUrl("");
    setChatContext("");
    setContextSummary("");
    setContextStatus("idle");
  };

  const handleTranslate = () => {
    if (!inputText.trim()) {
      toast({ title: "텍스트를 입력해주세요", variant: "destructive" });
      return;
    }
    translateMutation.mutate({
      text: inputText,
      targetLanguage: targetLang,
      tone,
      direction,
      chatContext: chatContext || undefined,
    });
  };

  const handleCopy = async () => {
    if (!translatedText) return;

    let copied = false;

    // Method 1: modern clipboard API
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(translatedText);
        copied = true;
      }
    } catch {}

    // Method 2: execCommand via hidden textarea
    if (!copied) {
      try {
        const el = document.createElement("textarea");
        el.value = translatedText;
        el.setAttribute("readonly", "");
        el.style.cssText = "position:fixed;top:0;left:0;width:2px;height:2px;opacity:0;";
        document.body.appendChild(el);
        el.focus();
        el.select();
        el.setSelectionRange(0, 99999);
        copied = document.execCommand("copy");
        document.body.removeChild(el);
      } catch {}
    }

    // Method 3: select the visible textarea in the result box
    if (!copied && resultTextRef.current) {
      resultTextRef.current.focus();
      resultTextRef.current.select();
      resultTextRef.current.setSelectionRange(0, 99999);
      try {
        copied = document.execCommand("copy");
      } catch {}
    }

    if (copied) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } else {
      // Last resort: select the textarea so user can Ctrl+C manually
      if (resultTextRef.current) {
        resultTextRef.current.focus();
        resultTextRef.current.select();
        resultTextRef.current.setSelectionRange(0, 99999);
      }
      toast({
        title: "텍스트가 선택됐어요",
        description: "Ctrl+C (Mac: ⌘+C) 로 복사해주세요.",
      });
    }
  };

  const handlePhrase = (phrase: SavedPhrase) => {
    setInputText(phrase.originalText);
    setTranslatedText("");
    setDirection("to_foreign"); // Phrases are always Korean → Foreign
    setAutoSwitched(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      handleTranslate();
    }
  };

  const currentLang = LANGUAGES.find(l => l.value === targetLang);
  const currentTone = TONES.find(t => t.value === tone);
  const isToKorean = direction === "to_korean";

  // Source/target labels for direction display
  const sourceLabel = isToKorean ? getLangLabel(targetLang) : "🇰🇷 한국어";
  const targetLabel = isToKorean ? "🇰🇷 한국어" : getLangLabel(targetLang);

  return (
    <Layout>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* LEFT: Quick Phrases */}
        <div className="lg:col-span-1 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">빠른 문구</h2>
            <Badge variant="outline" className="text-xs">{filteredPhrases.length}개</Badge>
          </div>

          {/* Category filter */}
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                data-testid={`btn-category-${cat}`}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  selectedCategory === cat
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-primary"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Phrase list */}
          <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
            {filteredPhrases.map(phrase => (
              <button
                key={phrase.id}
                onClick={() => handlePhrase(phrase)}
                data-testid={`btn-phrase-${phrase.id}`}
                className="w-full text-left p-3 rounded-lg border border-border bg-card hover:border-primary/50 hover:bg-accent/30 transition-all group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{phrase.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                      {phrase.originalText}
                    </p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary flex-shrink-0 mt-0.5 transition-colors" />
                </div>
                <Badge variant="secondary" className="mt-1.5 text-[10px]">{phrase.category}</Badge>
              </button>
            ))}
          </div>
        </div>

        {/* RIGHT: Translator */}
        <div className="lg:col-span-2 space-y-4">

          {/* ── Chat Context URL Panel ── */}
          <div className={`rounded-xl border p-3 space-y-2.5 transition-colors ${
            contextStatus === "loaded"
              ? "border-primary/40 bg-accent/20"
              : "border-border bg-muted/20"
          }`}>
            <div className="flex items-center gap-2">
              <MessageSquare className={`w-3.5 h-3.5 flex-shrink-0 ${contextStatus === "loaded" ? "text-primary" : "text-muted-foreground"}`} />
              <span className="text-xs font-semibold text-foreground">대화 컨텍스트</span>
              {contextStatus === "loaded" && (
                <Badge className="text-[10px] h-4 px-1.5 bg-primary/20 text-primary border-0">
                  활성
                </Badge>
              )}
              <span className="text-[10px] text-muted-foreground ml-auto">
                카카오 비즈니스 채팅 URL 붙여넣기 → AI가 대화 맥락 파악
              </span>
            </div>

            {contextStatus !== "loaded" ? (
              <div className="flex gap-2">
                <Input
                  value={chatUrl}
                  onChange={e => setChatUrl(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleLoadContext()}
                  placeholder="https://business.kakao.com/_bxdzbs/chats/..."
                  className="text-xs h-8 flex-1 font-mono"
                  data-testid="input-chat-url"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs px-3 whitespace-nowrap"
                  onClick={handleLoadContext}
                  disabled={!chatUrl.trim() || contextStatus === "loading"}
                  data-testid="button-load-context"
                >
                  {contextStatus === "loading" ? (
                    <><Loader2 className="w-3 h-3 animate-spin" />읽는 중...</>
                  ) : (
                    <><Link className="w-3 h-3" />불러오기</>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-background border border-primary/20">
                  <CheckCircle className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-foreground leading-relaxed flex-1">{contextSummary}</p>
                  <button
                    onClick={handleClearContext}
                    className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                    data-testid="button-clear-context"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-[10px] text-primary/80 pl-1">
                  ✓ 이 대화의 맥락을 반영해서 번역합니다
                </p>
              </div>
            )}

            {contextStatus === "error" && (
              <div className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>불러오기 실패 — 카카오 비즈니스에 로그인 후 다시 시도해주세요</span>
              </div>
            )}
          </div>

          {/* ── Direction & Language Controls ── */}
          <div className="rounded-xl border border-border bg-muted/10 p-3 space-y-3">
            {/* Direction toggle row */}
            <div className="flex items-center gap-3">
              {/* Source language pill */}
              <div className="flex-1 text-center">
                <span className={`text-sm font-semibold px-3 py-1.5 rounded-lg inline-block ${
                  !isToKorean
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {isToKorean ? currentLang?.label : "🇰🇷 한국어"}
                </span>
              </div>

              {/* Swap button */}
              <button
                onClick={handleToggleDirection}
                data-testid="btn-swap-direction"
                className="flex items-center justify-center w-8 h-8 rounded-full border border-border bg-background hover:bg-accent hover:border-primary/50 transition-all group flex-shrink-0"
                title="번역 방향 전환"
              >
                <ArrowLeftRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>

              {/* Target language pill */}
              <div className="flex-1 text-center">
                <span className={`text-sm font-semibold px-3 py-1.5 rounded-lg inline-block ${
                  isToKorean
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {isToKorean ? "🇰🇷 한국어" : currentLang?.label}
                </span>
              </div>
            </div>

            {/* Language selector (foreign language) + Tone */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 flex-1">
                <span className="text-xs text-muted-foreground whitespace-nowrap">외국어</span>
                <div className="flex gap-1.5">
                  {LANGUAGES.map(lang => (
                    <button
                      key={lang.value}
                      onClick={() => { setTargetLang(lang.value); setTranslatedText(""); }}
                      data-testid={`btn-lang-${lang.value}`}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        targetLang === lang.value
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-background text-muted-foreground border-border hover:border-primary/50"
                      }`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tone (only relevant for to_foreign) */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">톤</span>
                <Select value={tone} onValueChange={(v) => { setTone(v); setTranslatedText(""); }}>
                  <SelectTrigger className="w-32 h-8 text-xs" data-testid="select-tone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TONES.map(t => (
                      <SelectItem key={t.value} value={t.value} className="text-xs">
                        <div>
                          <span className="font-medium">{t.label}</span>
                          <span className="text-muted-foreground ml-1">— {t.desc}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* ── Auto-detect suggestion banner ── */}
          {autoSwitched && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg border border-amber-400/40 bg-amber-50/10 dark:bg-amber-900/10">
              <Wand2 className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
              <span className="text-xs text-foreground flex-1">
                {isToKorean
                  ? "한국어가 감지됐어요. 한국어 → 외국어 번역으로 전환할까요?"
                  : `${detectedLang === "ja" ? "일본어" : "영어"}가 감지됐어요. → 한국어 번역으로 전환할까요?`}
              </span>
              <button
                onClick={handleAcceptSwitch}
                className="text-xs font-semibold text-amber-500 hover:text-amber-600 transition-colors whitespace-nowrap"
              >
                전환하기
              </button>
              <button
                onClick={() => setAutoSwitched(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                {sourceLabel} 입력
                {isToKorean && (
                  <span className="ml-1.5 text-[10px] text-primary/70">
                    (고객 메시지 붙여넣기)
                  </span>
                )}
              </label>
              <span className="text-xs text-muted-foreground">{inputText.length}자</span>
            </div>
            <Textarea
              value={inputText}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isToKorean
                  ? `${currentLang?.short === "JA" ? "일본어" : "영어"} 고객 메시지를 붙여넣으세요... (Ctrl+Enter로 번역)`
                  : "번역할 한국어 텍스트를 입력하세요... (Ctrl+Enter로 번역)"
              }
              className="min-h-[130px] text-sm resize-none font-[inherit] leading-relaxed"
              data-testid="input-source-text"
            />
          </div>

          {/* Translate button */}
          <Button
            onClick={handleTranslate}
            disabled={translateMutation.isPending || !inputText.trim()}
            className="w-full gap-2"
            size="lg"
            data-testid="button-translate"
          >
            {translateMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {chatContext ? "맥락 반영해서 번역 중..." : "번역 중..."}
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                {isToKorean
                  ? `${currentLang?.label} → 🇰🇷 한국어로 번역`
                  : chatContext
                    ? `맥락 반영 · ${currentLang?.label}로 번역`
                    : `${currentLang?.label}로 번역`}
                <span className="ml-auto text-xs opacity-70">Ctrl+Enter</span>
              </>
            )}
          </Button>

          {/* Result */}
          <div ref={resultRef} className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                {targetLabel} 번역 결과
                {!isToKorean && <> · <span className="text-primary">{currentTone?.label}</span></>}
                {chatContext && <span className="text-primary/70"> · 맥락 반영</span>}
                {isToKorean && (
                  <span className="ml-1.5 text-[10px] text-primary/70">
                    · 뉘앙스 분석 포함
                  </span>
                )}
              </label>
              {translatedText && (
                <Button
                  size="sm"
                  variant="ghost"
                  className={`h-6 gap-1 text-xs transition-all ${
                    copySuccess ? "text-green-500" : ""
                  }`}
                  onClick={handleCopy}
                  data-testid="button-copy"
                >
                  {copySuccess ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copySuccess ? "복사됨!" : "복사"}
                </Button>
              )}
            </div>

            <div
              className={`relative min-h-[130px] rounded-lg border transition-colors ${
                translatedText
                  ? isToKorean
                    ? "bg-blue-500/5 border-blue-400/30"
                    : "bg-accent/20 border-primary/30"
                  : "bg-muted/30 border-border"
              }`}
            >
              {translateMutation.isPending ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-sm">AI가 번역 중...</span>
                  </div>
                </div>
              ) : translatedText ? (
                <div className="p-3 space-y-2">
                  {/* Selectable textarea — user can also manually Ctrl+C */}
                  <textarea
                    ref={resultTextRef}
                    readOnly
                    value={translatedText}
                    data-testid="text-translation-result"
                    onClick={(e) => {
                      (e.target as HTMLTextAreaElement).select();
                      (e.target as HTMLTextAreaElement).setSelectionRange(0, 99999);
                    }}
                    className="w-full text-sm leading-relaxed text-foreground bg-transparent border-0 resize-none outline-none cursor-pointer select-all p-0"
                    style={{ minHeight: "80px", height: "auto", overflow: "hidden" }}
                    rows={Math.max(3, translatedText.split("\n").length)}
                  />
                  <Button
                    size="sm"
                    variant={copySuccess ? "default" : "outline"}
                    className={`gap-1.5 text-xs h-7 transition-all ${
                      copySuccess ? "bg-green-500 border-green-500 text-white hover:bg-green-600" : ""
                    }`}
                    onClick={handleCopy}
                    data-testid="button-copy-result"
                  >
                    {copySuccess ? (
                      <><Check className="w-3 h-3" />복사됨!</>
                    ) : (
                      <><Copy className="w-3 h-3" />클립보드 복사</>
                    )}
                  </Button>
                  <p className="text-[10px] text-muted-foreground">텍스트 클릭 시 전체 선택 · Ctrl+C로도 복사 가능</p>
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <Languages className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">번역 결과가 여기에 표시됩니다</p>
                    {isToKorean && (
                      <p className="text-xs mt-1 opacity-70">뉘앙스 분석도 함께 표시됩니다</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick tip */}
          <p className="text-xs text-muted-foreground text-center">
            💡 ⇄ 버튼으로 번역 방향 전환 · 외국어 감지 시 자동 안내 · 왼쪽 문구 클릭으로 자동 입력
          </p>
        </div>
      </div>
    </Layout>
  );
}
