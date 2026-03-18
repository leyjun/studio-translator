import { savedPhrases, translationHistory, type SavedPhrase, type InsertSavedPhrase, type TranslationHistory, type InsertTranslationHistory } from "@shared/schema";

export interface IStorage {
  // Saved Phrases
  getSavedPhrases(): Promise<SavedPhrase[]>;
  getSavedPhrasesByCategory(category: string): Promise<SavedPhrase[]>;
  createSavedPhrase(phrase: InsertSavedPhrase): Promise<SavedPhrase>;
  updateSavedPhrase(id: number, phrase: Partial<InsertSavedPhrase>): Promise<SavedPhrase | undefined>;
  deleteSavedPhrase(id: number): Promise<boolean>;

  // Translation History
  getTranslationHistory(limit?: number): Promise<TranslationHistory[]>;
  addTranslationHistory(item: InsertTranslationHistory): Promise<TranslationHistory>;
  clearTranslationHistory(): Promise<void>;
}

export class MemStorage implements IStorage {
  private savedPhrasesMap: Map<number, SavedPhrase> = new Map();
  private translationHistoryList: TranslationHistory[] = [];
  private phraseCounter = 1;
  private historyCounter = 1;

  constructor() {
    // Mirror by Me — 실제 카카오 채널 기반 문구
    const defaults: InsertSavedPhrase[] = [
      // ── 인사 / 첫 응대 ──
      {
        title: "첫 문의 환영 인사",
        originalText: "안녕하세요! 미러 바이 미입니다 😊\n문의해 주셔서 감사합니다. 원하시는 날짜와 컨셉을 알려주시면 예약 가능 여부를 확인해 드릴게요!",
        category: "인사", sortOrder: 1
      },
      {
        title: "인스타 보고 문의 오셨을 때",
        originalText: "안녕하세요! 인스타그램을 통해 문의해 주셨군요 😊\n미러 바이 미 인스타(@mirror_by_me)에서 마음에 드시는 컨셉 사진을 골라 보내주시면 더 빠르게 안내드릴 수 있어요!",
        category: "인사", sortOrder: 2
      },
      // ── 예약 안내 ──
      {
        title: "예약 가능 여부 확인 요청",
        originalText: "촬영 희망 날짜와 시간, 그리고 원하시는 컨셉(인스타 사진 링크나 번호)을 알려주시면 예약 가능 여부를 확인해 드리겠습니다!",
        category: "예약", sortOrder: 3
      },
      {
        title: "예약 확정 안내",
        originalText: "예약이 확정되었습니다! 🎉\n촬영 당일 뵙겠습니다. 궁금하신 점은 언제든지 연락 주세요 😊",
        category: "예약", sortOrder: 4
      },
      {
        title: "예약금 안내",
        originalText: "예약 확정을 위해 예약금 1인당 100,000원을 계좌이체로 부탁드립니다.\n\n우리은행 1005-402-682829 (홍준혁)\n\n입금 확인 후 예약이 최종 확정됩니다!",
        category: "예약", sortOrder: 5
      },
      {
        title: "예약금 입금 확인",
        originalText: "예약금 입금 확인하였습니다! 감사합니다 😊\n촬영 날 즐거운 시간 보내실 수 있도록 최선을 다하겠습니다. 궁금한 점 있으시면 편하게 문의해 주세요!",
        category: "예약", sortOrder: 6
      },
      // ── 가격 안내 ──
      {
        title: "가격 안내 (가격표 전송 전)",
        originalText: "가격 안내드릴게요! 자세한 가격표와 컨셉 사진을 보내드리겠습니다.\n기본적으로 컨셉 수에 따라 금액이 달라지며, 헤어메이크업은 별도로 추가 가능합니다.",
        category: "가격", sortOrder: 7
      },
      {
        title: "헤어메이크업 포함 여부 문의 답변",
        originalText: "네, 스튜디오 내에 전문 헤어메이크업 아티스트가 상주해 있어 촬영과 함께 예약 가능합니다 😊\n원하시는 날짜의 헤어메이크업 가능 여부도 함께 확인해 드릴게요!",
        category: "가격", sortOrder: 8
      },
      // ── 촬영 안내 ──
      {
        title: "컨셉 설명 (1컨셉이란?)",
        originalText: "1컨셉은 조명 1가지 + 배경 1가지 + 의상 1벌 + 헤어메이크업 1가지로 구성됩니다.\n컨셉당 약 250~300장을 촬영하며, 촬영 데이터 전체를 전달해 드립니다!",
        category: "안내", sortOrder: 9
      },
      {
        title: "촬영 당일 준비 안내",
        originalText: "촬영 당일 안내사항이에요!\n\n✅ 컬러렌즈, 액세서리는 직접 지참해 주세요 (스튜디오 제공 불가)\n✅ 의상은 직접 가져오시거나 대여 가능합니다 (대여 목록 별도 안내)\n✅ 헤어메이크업을 스튜디오에서 받으시면 맨얼굴로 오셔도 됩니다\n✅ 인스타그램(@mirror_by_me)에 있는 컨셉 사진 중에서만 촬영 가능합니다",
        category: "안내", sortOrder: 10
      },
      {
        title: "의상 대여 안내",
        originalText: "의상 대여도 가능합니다! 단, 종류와 사이즈가 제한적이라 개인 의상을 가져오시는 것을 추천드려요.\n대여 가능한 의상 목록은 아래 링크에서 확인하실 수 있습니다:\nhttps://naver.me/53lDbG32",
        category: "안내", sortOrder: 11
      },
      {
        title: "위치 안내",
        originalText: "스튜디오 위치 안내드립니다 📍\n\n서울 강남구 선릉로111길 22-8 유엔아이빌 지하1층\n(선릉역 근처, 베이지색 건물 지하 1층)\n\n찾아오시기 어려우시면 언제든지 연락 주세요!",
        category: "안내", sortOrder: 12
      },
      // ── 정책 안내 ──
      {
        title: "취소/변경 정책",
        originalText: "예약 취소 및 변경 안내드립니다.\n\n📌 취소: 촬영일 2개월 전까지 가능 (이후 예약금 환불 불가)\n📌 날짜 변경: 촬영일 1개월 전까지 가능\n📌 노쇼 또는 당일 취소: 예약금 환불 불가\n\n예약 확정 후에는 날짜/시간 변경이 어려우니 신중하게 결정해 주세요!",
        category: "정책", sortOrder: 13
      },
      {
        title: "결제 수단 안내",
        originalText: "결제는 계좌이체, QR코드, WowPass 앱, Wise Pay로 가능합니다.\n카드 결제 시 10% 세금이 추가됩니다.\n\n잔금은 촬영 당일 현장에서 결제해 주시면 됩니다!",
        category: "정책", sortOrder: 14
      },
      // ── 단골/SNS ──
      {
        title: "SNS 게시 동의 확인",
        originalText: "촬영 사진을 미러 바이 미 인스타그램에 게시할 수 있도록 해 주셔도 될까요? 원치 않으시면 미리 말씀해 주시면 게시하지 않겠습니다 😊",
        category: "SNS", sortOrder: 15
      },
    ];
    defaults.forEach(p => {
      const phrase: SavedPhrase = { id: this.phraseCounter++, ...p };
      this.savedPhrasesMap.set(phrase.id, phrase);
    });
  }

  async getSavedPhrases(): Promise<SavedPhrase[]> {
    return Array.from(this.savedPhrasesMap.values()).sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async getSavedPhrasesByCategory(category: string): Promise<SavedPhrase[]> {
    return Array.from(this.savedPhrasesMap.values())
      .filter(p => p.category === category)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async createSavedPhrase(phrase: InsertSavedPhrase): Promise<SavedPhrase> {
    const newPhrase: SavedPhrase = { id: this.phraseCounter++, ...phrase };
    this.savedPhrasesMap.set(newPhrase.id, newPhrase);
    return newPhrase;
  }

  async updateSavedPhrase(id: number, phrase: Partial<InsertSavedPhrase>): Promise<SavedPhrase | undefined> {
    const existing = this.savedPhrasesMap.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...phrase };
    this.savedPhrasesMap.set(id, updated);
    return updated;
  }

  async deleteSavedPhrase(id: number): Promise<boolean> {
    return this.savedPhrasesMap.delete(id);
  }

  async getTranslationHistory(limit = 50): Promise<TranslationHistory[]> {
    return this.translationHistoryList.slice(-limit).reverse();
  }

  async addTranslationHistory(item: InsertTranslationHistory): Promise<TranslationHistory> {
    const newItem: TranslationHistory = {
      id: this.historyCounter++,
      ...item,
      createdAt: new Date(),
    };
    this.translationHistoryList.push(newItem);
    // Keep only last 200
    if (this.translationHistoryList.length > 200) {
      this.translationHistoryList = this.translationHistoryList.slice(-200);
    }
    return newItem;
  }

  async clearTranslationHistory(): Promise<void> {
    this.translationHistoryList = [];
  }
}

export const storage = new MemStorage();
